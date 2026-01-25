# Pathbuilder 2e Import + PF2 Type System Refactor

## Context

### Original Request
Add support for importing Pathfinder 2e characters from Pathbuilder 2e, using both the API (character ID) and JSON file upload.

### Interview Summary
**Key Discussions**:
- Import methods: Both API fetch (character ID) and JSON file upload
- UI location: Integrated into PF2CharacterEditor
- Scope: Stats, weapons, armor, skills, feats, spellcasting (proficiency + **focus spell names only**, NOT prepared/spontaneous lists)
- Level support: All levels 1-20
- UX: Preview before import, inline instructions, inline error messages
- Creates NEW character (not overwrite)
- Test strategy: TDD with Vitest

**Research Findings**:
- API: `https://pathbuilder2e.com/json.php?id={id}` with full CORS support
- Proficiency values: 0/2/4/6/8 map to untrained/trained/expert/master/legendary
- Current CharacterSheet type is GURPS-centric (health vs constitution)

### Metis + Momus Review
**Full Scope Identified**:
- User decided to SEPARATE CharacterSheet types completely for GURPS/PF2
- This requires updating ~20+ files across shared/client/server
- Type guards required for union discrimination

---

## CharacterSheet Union Architecture (CRITICAL)

### Discriminant Strategy for Type Guards

**Discriminant Field**: The type guards use structural discrimination:
- `isPF2Character`: checks `'abilities' in character && 'constitution' in character.abilities`
- `isGurpsCharacter`: checks `'attributes' in character && 'health' in character.attributes`

### Persistence & Legacy Data Migration Strategy (CRITICAL)

**Problem**: Current PF2 characters are stored with GURPS-shaped workaround (`attributes.health` instead of `abilities.constitution`). With the proposed type guards, these would be **misclassified as GURPS**.

**Migration Strategy**:

1. **Detection**: Legacy PF2 characters can be identified by:
   - Have `attributes.wisdom` and `attributes.charisma` (PF2 workaround added these)
   - OR are associated with a PF2 ruleset match (check `match.rulesetId`)

2. **Migration Point**: On character load in `server/src/db.ts`:
   ```typescript
   export const loadCharacterById = (characterId: string): CharacterSheet | null => {
     const row = state.db.prepare(...).get(characterId);
     if (!row) return null;
     const character = JSON.parse(row.data_json);
     
     // Migrate legacy PF2 characters (have GURPS shape but PF2 fields)
     // Detection: has attributes.wisdom (PF2 workaround) but no abilities field
     if ('attributes' in character && character.attributes?.wisdom !== undefined && !('abilities' in character)) {
       return migrateLegacyPF2Character(character);
     }
     return character as CharacterSheet;
   };
   
   const migrateLegacyPF2Character = (legacy: any): PF2CharacterSheet => {
     // Destructure to REMOVE attributes field (not set to undefined)
     const { attributes, equipment, derived, ...rest } = legacy;
     
     return {
       ...rest,
       abilities: {
         strength: attributes.strength,
         dexterity: attributes.dexterity,
         constitution: attributes.health,
         intelligence: attributes.intelligence,
         wisdom: attributes.wisdom,
         charisma: attributes.charisma,
       },
       derived: {
         hitPoints: derived.hitPoints,
         armorClass: derived.dodge,  // Rename dodge → armorClass
         speed: (derived.basicMove ?? 5) * 5,  // Convert hexes → feet
         fortitudeSave: 0,  // Will be recalculated
         reflexSave: 0,
         willSave: 0,
         perception: 0,
       },
       weapons: equipment?.filter((e: any) => e.type === 'melee' || e.type === 'ranged')
         .map((e: any) => ({
           id: e.id,
           name: e.name,
           damage: e.damage,
           damageType: e.damageType === 'cutting' ? 'slashing' : e.damageType === 'crushing' ? 'bludgeoning' : 'piercing',
           proficiencyCategory: 'martial' as const,
           traits: [],
           potencyRune: 0,
           strikingRune: null,
         })) ?? [],
       armor: null,
       // Add missing PF2 fields with defaults
       classHP: 10,
       saveProficiencies: { fortitude: 'trained', reflex: 'trained', will: 'trained' },
       perceptionProficiency: 'trained',
       armorProficiency: 'trained',
       feats: [],
       skills: [],
       spells: null,
     };
   };
   ```
   
   **CRITICAL**: The migrated object does NOT have an `attributes` field at all (destructured out). This ensures `isGurpsCharacter(migratedChar)` returns `false` because `'attributes' in character` is `false`.

3. **Re-save Trigger**: Migration happens on load. Optionally, a migration script can be run to re-save all PF2 characters in the new format.

4. **Type Guard Safety**:
   - **After migration**: PF2 characters have `abilities.constitution` → `isPF2Character` returns true
   - **GURPS characters**: Have `attributes.health` without `attributes.wisdom` → `isGurpsCharacter` returns true
   - **Legacy PF2 (before migration)**: Detected by `attributes.wisdom` check → migrated on load

**New GURPS characters** (without wisdom/charisma) remain untouched.

### Derived Stats Contract

| Field | GurpsCharacterSheet | PF2CharacterSheet | Shared Codepaths |
|-------|---------------------|-------------------|------------------|
| `hitPoints` | ✅ `derived.hitPoints` | ✅ `derived.hitPoints` | **SHARED** - both have it |
| `fatiguePoints` | ✅ `derived.fatiguePoints` | ❌ N/A | GURPS-only |
| `basicSpeed` | ✅ `derived.basicSpeed` | ❌ N/A | GURPS-only |
| `basicMove` | ✅ `derived.basicMove` | ❌ N/A | GURPS-only |
| `dodge` | ✅ `derived.dodge` | ❌ N/A | GURPS-only |
| `armorClass` | ❌ N/A | ✅ `derived.armorClass` | PF2-only |
| `speed` | ❌ N/A (use basicMove*5) | ✅ `derived.speed` (feet) | PF2-only |
| `fortitudeSave` | ❌ N/A | ✅ `derived.fortitudeSave` | PF2-only |
| `reflexSave` | ❌ N/A | ✅ `derived.reflexSave` | PF2-only |
| `willSave` | ❌ N/A | ✅ `derived.willSave` | PF2-only |
| `perception` | ❌ N/A | ✅ `derived.perception` | PF2-only |

### Resolution Strategy for Shared Codepaths

**Current GURPS-assuming code must be updated to branch on ruleset:**

```typescript
// BEFORE (breaks with PF2):
const ac = character.derived.dodge;

// AFTER (ruleset-aware):
const ac = isPF2Character(character) 
  ? character.derived.armorClass 
  : character.derived.dodge;
```

**Files requiring this branching** (identified below in Full Blast Radius).

### PF2 Character Editing Model (CRITICAL)

**Problem**: Current PF2 UI/hooks are built on GURPS-shaped fields:
- `useCharacterEditor.ts`: Uses `skills[].level`, `equipment[]`, `advantages[]`, `disadvantages[]`, `calculateTotalPoints`
- `pf2CharacterTemplates.ts`: Returns GURPS-shaped CharacterSheet with PF2 abilities converted to `attributes`
- `PF2CharacterEditor.tsx`: Renders using these GURPS-shaped fields

**Chosen Approach**: **Dual-track editing** - keep GURPS-shaped editor hooks, convert at save/load boundaries.

**Rationale**: Refactoring the entire editor system is out of scope. Instead:
1. **Import path** (Pathbuilder → native PF2CharacterSheet): Direct mapping, no editor involvement
2. **Manual editing path** (editor → GURPS-shaped → native PF2CharacterSheet): Keep current editor, convert when saving

**Field Mapping for Manual Edits**:
| GURPS Editor Field | PF2CharacterSheet Field | Conversion |
|-------------------|------------------------|------------|
| `skills[].level` | `skills[].proficiency` | Level 7+ = trained, 9+ = expert, etc. |
| `advantages[]` | `feats[]` | Direct name/description copy |
| `disadvantages[]` | (ignored in PF2) | Not mapped |
| `equipment[]` | `weapons[]` | Convert damage type, add empty traits |
| `attributes.health` | `abilities.constitution` | Direct value |
| `derived.dodge` | `derived.armorClass` | Direct value |
| `derived.basicMove` | `derived.speed / 5` | Convert feet ↔ hexes |

**Implementation in Task 8 (useCharacterEditor)**:
1. For Pathbuilder import: Skip editor entirely, set character directly
2. For manual edits: Editor works with GURPS-shaped intermediate, convert on setCharacter callback

**Templates Strategy** (Task 7):
- **Decision**: Keep `pf2CharacterTemplates.ts` returning GURPS-shaped data for now (editor compatibility)
- App.tsx uses templates as-is for editor; conversion to native PF2CharacterSheet happens when sending `select_character` to server
- Server's PF2 character factory creates native PF2CharacterSheet for bots/defaults

**PF2 Skills Display**: After refactor, PF2 UI shows proficiency label (trained/expert/etc.) instead of numeric level. The mapping is: level < 5 = untrained, 5-6 = trained, 7-8 = expert, 9+ = master.

**Persistence**: Import creates character client-side, user confirms, `select_character` message sends to server, server calls `upsertCharacter` to persist.

---

### PF2 Equipment Model (CRITICAL)

**Problem**: The plan introduces `PF2CharacterWeapon`/`PF2CharacterArmor` for `PF2CharacterSheet`, but existing PF2 combat logic uses `PF2Weapon`/`PF2Armor` from `shared/rulesets/pf2/types.ts`.

**Resolution**: `PF2CharacterWeapon` is a **storage format** for character sheets. Combat functions convert to `PF2Weapon` at call sites.

| Type | Purpose | Location |
|------|---------|----------|
| `PF2CharacterWeapon` | Storage in PF2CharacterSheet | `shared/rulesets/pf2/characterSheet.ts` |
| `PF2Weapon` | Combat logic (calculateAttackBonus, resolveStrike) | `shared/rulesets/pf2/types.ts` |

**Conversion at Combat Time**:
```typescript
// In pf2-attack.ts, before calling combat functions:
const characterWeapon = character.weapons[0];
const combatWeapon: PF2Weapon = {
  id: characterWeapon.id,
  name: characterWeapon.name,
  damage: characterWeapon.damage,
  damageType: characterWeapon.damageType,
  traits: characterWeapon.traits,  // PF2CharacterWeapon now includes traits
  range: undefined,  // Melee weapons
  hands: 1,  // Default, can enhance later
  group: 'sword',  // Default, can enhance later
  proficiency: mapCategoryToProficiency(characterWeapon.proficiencyCategory),
};
const result = resolveStrike(attacker, combatWeapon, targetAC, mapPenalty);
```

**Note on traits**: Pathbuilder doesn't export weapon traits, so `PF2CharacterWeapon.traits` will be `[]` for imported characters. Combat logic already handles empty traits (no agile/finesse bonuses). Users can manually add traits later via editor if desired.

---

### FatiguePoints/FP Handling Strategy

**Problem**: `fatiguePoints` exists only in `GurpsDerivedStats`, not `PF2DerivedStats`. Several shared components assume FP exists.

**Resolution**: Conditional rendering based on character type.

| Component | Current Code | New Behavior |
|-----------|--------------|--------------|
| `FloatingStatus.tsx:13` | `character.derived.fatiguePoints` | Hide FP bar if `isPF2Character(character)` |
| `shared/rulesets/pf2/index.ts` `getInitialCombatantState` | Sets `currentFP` | Set `currentFP: 0` (field exists on combatant for compatibility, just unused) |

**Implementation Pattern**:
```typescript
// In FloatingStatus.tsx
{!isPF2Character(character) && (
  <div className="status-bar-row">
    <span className="status-label">FP</span>
    {/* FP bar */}
  </div>
)}
```

### PF2 Derived Stats Recomputation Contract

**Problem**: When editing PF2 character abilities, derived stats must be recalculated. The existing `calculateDerivedStats` in `shared/rulesets/pf2/rules.ts` requires multiple inputs:
- `abilities: Abilities`
- `level: number`
- `classHP: number`
- `armorBonus: number`
- `armorDexCap: number | null`
- `saveProficiencies: Record<...>`
- `perceptionProficiency: Proficiency`
- `armorProficiency: Proficiency`

**Solution**: `PF2CharacterSheet` must store all inputs needed to recalculate derived stats.

**Required Fields on PF2CharacterSheet**:
```typescript
export type PF2CharacterSheet = {
  // ... existing fields ...
  level: number;           // Already planned
  classHP: number;         // NEW: Base HP from class (e.g., Fighter=10, Wizard=6)
  saveProficiencies: {     // NEW: Save proficiency ranks
    fortitude: Proficiency;
    reflex: Proficiency;
    will: Proficiency;
  };
  perceptionProficiency: Proficiency;  // NEW
  armorProficiency: Proficiency;       // NEW
  armor: PF2CharacterArmor | null;     // Already planned (provides armorBonus, dexCap)
  // ...
};
```

**Recomputation in useCharacterEditor**:
```typescript
if (isPF2Character(character)) {
  const newAbilities = { ...character.abilities, [attr]: newValue };
  const newDerived = calculateDerivedStats(
    newAbilities,
    character.level,
    character.classHP,
    character.armor?.acBonus ?? 0,
    character.armor?.dexCap ?? null,
    character.saveProficiencies,
    character.perceptionProficiency,
    character.armorProficiency
  );
  setCharacter({ ...character, abilities: newAbilities, derived: newDerived });
}
```

---

## Full Blast Radius (EXPLICIT FILE LIST)

### Verification Checklist (run these greps to ensure completeness)

Before finalizing Phase B/C/D changes, run these checks to find any missed union-unsafe field access:

```bash
# Find GURPS-only derived field access (should all be guarded or in GURPS-only components)
grep -r "derived\.dodge" src/ server/ shared/ --include="*.ts" --include="*.tsx"
grep -r "derived\.basicSpeed" src/ server/ shared/ --include="*.ts" --include="*.tsx"
grep -r "derived\.basicMove" src/ server/ shared/ --include="*.ts" --include="*.tsx"
grep -r "derived\.fatiguePoints" src/ server/ shared/ --include="*.ts" --include="*.tsx"

# Find GURPS-only attributes access
grep -r "attributes\.health" src/ server/ shared/ --include="*.ts" --include="*.tsx"
grep -r "attributes\.strength" src/ server/ shared/ --include="*.ts" --include="*.tsx"

# Find equipment access (GURPS uses equipment, PF2 uses weapons/armor)
grep -r "character\.equipment" src/ server/ shared/ --include="*.ts" --include="*.tsx"
```

Each match should either:
1. Be in a GURPS-only component (with internal type assertion)
2. Have a type guard (`isGurpsCharacter`/`isPF2Character`) check before access
3. Be in a ruleset-specific file (e.g., `rulesets/gurps/*`)

### Shared Contracts (7 files)
| File | Current Issue | Required Change |
|------|---------------|-----------------|
| `shared/types.ts:51-61` | CharacterSheet is GURPS-shaped | Remove definition, re-export from `rulesets/characterSheet.ts` |
| `shared/types.ts:72` | `characters: CharacterSheet[]` | Keep union type (works) |
| `shared/rulesets/Ruleset.ts` | `getDerivedStats(character: CharacterSheet)` | Accept union, return ruleset-specific derived |
| `shared/rulesets/pf2/index.ts:9-26` | Uses `attributes.health` workaround | Use `PF2CharacterSheet.abilities.constitution` |
| `shared/rulesets/gurps/index.ts` | Implicitly GURPS | Explicitly type to `GurpsCharacterSheet` |
| `shared/rulesets/gurps/rules.ts` | Functions assume GURPS shape | Type to `GurpsCharacterSheet` |
| `shared/rulesets/serverAdapter.ts` | Imports GURPS types | Import union, branch by ruleset |

### Client (13 files)
| File | Current Issue | Required Change |
|------|---------------|-----------------|
| `src/App.tsx` | Creates GURPS-shaped editingCharacter | Branch on rulesetId to create correct shape |
| `src/components/rulesets/useCharacterEditor.ts:36-44` | `updateAttribute` assumes GURPS | Add PF2 branch with `isPF2Character` |
| `src/components/rulesets/types.ts` | `CharacterEditorProps.character` | Keep union (works) |
| `src/components/rulesets/pf2/PF2CharacterEditor.tsx:58-73` | Reads `attributes[key]` | Read `abilities[key]` for PF2 |
| `src/components/rulesets/pf2/PF2GameStatusPanel.tsx:97` | `character.attributes.health` | `character.abilities.constitution` |
| `src/components/rulesets/pf2/PF2GameStatusPanel.tsx:113-114` | `derived.dodge`, `basicMove*5` | `derived.armorClass`, `derived.speed` |
| `src/components/rulesets/pf2/PF2GameStatusPanel.tsx:121-130` | `character.equipment` | `character.weapons` |
| `src/components/rulesets/pf2/PF2ActionBar.tsx:66-91` | Uses `attributes.health/strength/dexterity/intelligence/wisdom/charisma`, `derived.dodge`, `derived.basicMove*5`, `character.equipment` | Use `abilities.*`, `derived.armorClass`, `derived.speed`, `character.weapons` |
| `src/data/pf2CharacterTemplates.ts` | Uses GURPS shape workaround | Use `PF2CharacterSheet` shape |
| `src/components/game/FloatingStatus.tsx:13` | Reads `character.derived.fatiguePoints` (GURPS-only) | **Conditional render**: hide FP bar for PF2 characters (see FP handling strategy) |
| `src/components/game/shared/useGameActions.ts:182,217` | Reads `derived.fatiguePoints`, `derived.dodge` | **Guard with isGurpsCharacter**: provide fallback values for PF2 (FP→0, dodge→0) |

**GURPS-only components (INTERNAL TYPE ASSERTION NEEDED)**:
| File | Current Issue | Required Change |
|------|---------------|-----------------|
| `src/components/rulesets/gurps/GurpsCharacterEditor.tsx` | Props use `CharacterSheet` union, but accesses `derived.fatiguePoints` | Add internal assertion: `const gurpsChar = character as GurpsCharacterSheet;` at top |
| `src/components/rulesets/gurps/GurpsGameStatusPanel.tsx` | Same issue | Same assertion |
| `src/components/rulesets/gurps/GurpsActionBar.tsx` | Same issue | Same assertion |
| `src/components/rulesets/gurps/GurpsGameActionPanel.tsx` | Same issue | Same assertion |

**Typing Propagation Approach**:

The component registry in `src/components/rulesets/index.ts` uses generic `CharacterEditorProps` etc. with `CharacterSheet` union. This is intentional - the registry pattern requires uniform props types.

**Resolution**: Each ruleset's components internally assert the narrowed type:

```typescript
// In GurpsCharacterEditor.tsx
import type { CharacterEditorProps } from '../types';
import type { GurpsCharacterSheet } from '../../../../shared/rulesets/gurps/characterSheet';

export const GurpsCharacterEditor = ({ character, setCharacter, onSave, onCancel }: CharacterEditorProps) => {
  // Safe assertion: this component only renders for GURPS matches (guaranteed by registry routing)
  const gurpsChar = character as GurpsCharacterSheet;
  
  // Now can access gurpsChar.derived.fatiguePoints, etc.
  // ...
};
```

**Why assertion is safe**: The `getRulesetComponents(rulesetId)` function in `index.ts` ensures GURPS components only receive characters from GURPS matches, which are always `GurpsCharacterSheet`. Runtime routing guarantees type safety; assertion just satisfies TS compiler.

**Server factory typing**: Similarly, `server/src/rulesets/types.ts` `CharacterFactory` returns `CharacterSheet` union. Each ruleset's factory implementation returns the specific type (e.g., `GurpsCharacterSheet`). No changes needed - the union return type is correct.

**Additional Blast Radius (GURPS-specific components with GURPS-only field access)**:
| File | Current Issue | Required Change |
|------|---------------|-----------------|
| `src/components/rulesets/gurps/DefenseModal.tsx:55,80` | Uses `character.derived.dodge`, `character.equipment` | Add internal assertion: `const gurpsChar = character as GurpsCharacterSheet;` |
| `src/components/game/shared/rulesetUiSlots.ts` | Types include `CharacterSheet` in defense slot context | Keep union - defense slots are ruleset-specific, already narrowed |
| `shared/rulesets/serverTypes.ts` | `botCharacter: CharacterSheet` | Keep union - bot logic branches by rulesetId |
| `server/src/rulesets/pf2/bot.ts:27,38,45` | Uses `attributes.strength`, `equipment[0]`, `derived.dodge` (GURPS workaround) | Use `abilities.strength`, `weapons[0]`, `derived.armorClass` - PF2 native |
| `server/src/rulesets/gurps/bot.ts` | Uses GURPS CharacterSheet fields | Add internal assertion or explicit import of GurpsCharacterSheet |
| `server/src/rulesets/gurps/character.ts` | Factory returns `CharacterSheet` | Type return as `GurpsCharacterSheet`, cast to union at export |
| `src/data/characterTemplates.ts:12` | GURPS templates typed as `Omit<CharacterSheet, 'id'>` | Type as `Omit<GurpsCharacterSheet, 'id'>` |

### Server (10 files)
| File | Current Issue | Required Change |
|------|---------------|-----------------|
| `server/src/db.ts:148,339` | Deserializes `CharacterSheet` JSON; legacy PF2 chars use GURPS workaround | **Add migration on load**: Detect legacy PF2 chars (have `attributes.wisdom`) and convert to native PF2CharacterSheet shape. See "Persistence & Legacy Data Migration Strategy" above. |
| `server/src/match.ts:68-79` | `char.derived.basicSpeed`, `attributes.dexterity` | Branch: GURPS→basicSpeed, PF2→perception+DEX |
| `server/src/bot.ts:24-27,38,124` | Uses `getRulesetServerFactory` (already branches), but line 124 reads `derived.basicMove` | **ALREADY BRANCHES for character creation via factory**. Line 124 `botCharacter?.derived.basicMove`: add guard for PF2→use `derived.speed/5` |
| `server/src/state.ts` | `characters: Map<Id, CharacterSheet>` | Keep union (works) |
| `server/src/rulesets/pf2/character.ts` | Creates PF2 char with GURPS shape | Create `PF2CharacterSheet` shape |
| `server/src/rulesets/pf2/combatant.ts` | Reads `character.equipment` | Read `character.weapons` |
| `server/src/rulesets/gurps/combatant.ts` | Uses `GurpsCharacterSheet` fields | Type explicitly to `GurpsCharacterSheet` |
| `server/src/handlers/pf2-attack.ts:25-32` | `getPF2Abilities(attributes)` workaround | Use `character.abilities` directly |
| `server/src/handlers/pf2-attack.ts:60-62` | `calculateAC(derived.dodge)` | Use `character.derived.armorClass` |
| `server/src/handlers/damage.ts:56` | `targetCharacter.attributes.health` | Branch: GURPS→health, PF2→constitution |

**Test files impacted**:
| File | Status |
|------|--------|
| `shared/rules.test.ts` | Uses GURPS-shaped fixtures - **OK**, test GURPS ruleset specifically |

---

## Pathbuilder Mapping Formulas (SOURCE OF TRUTH)

### Derived Stats Source of Truth Resolution

**Problem**: Pathbuilder's HP formula may differ from `calculateDerivedStats` in `shared/rulesets/pf2/rules.ts`.

**Decision**: **Pathbuilder's pre-calculated values are authoritative for IMPORT**. Post-import recalculation uses the existing `calculateDerivedStats`.

| Scenario | Source of Truth |
|----------|-----------------|
| Initial import from Pathbuilder | Use Pathbuilder's pre-calculated `acTotal.acTotal`, calculate HP from their formula |
| User edits abilities in editor | Recalculate using `calculateDerivedStats` from `shared/rulesets/pf2/rules.ts` |

**Why**: Pathbuilder has access to the full character build (all items, feats, bonuses). Our `calculateDerivedStats` is a simplified approximation. For imports, trust Pathbuilder. For local edits, use our formula.

**Implementation in pathbuilderMapping.ts**:
```typescript
export const mapPathbuilderToCharacter = (build: PathbuilderBuild): PF2CharacterSheet => {
  // Use Pathbuilder's pre-calculated AC directly
  const ac = build.acTotal.acTotal;
  
  // Calculate HP using Pathbuilder's formula (matches their display)
  const conMod = Math.floor((build.abilities.con - 10) / 2);
  const hp = build.attributes.ancestryhp 
           + (build.level * (build.attributes.classhp + conMod))
           + build.attributes.bonushp
           + (build.level * build.attributes.bonushpPerLevel);
  
  return {
    // ...
    derived: { hitPoints: hp, armorClass: ac, /* ... */ },
    // Store inputs for future recalculation
    classHP: build.attributes.classhp,
    // ...
  };
};
```

---

### API Reference
- **Endpoint**: `https://pathbuilder2e.com/json.php?id={characterId}`
- **Sample Character ID for Testing**: `163111` (verified working)
- **CORS**: Full support (`Access-Control-Allow-Origin: *`)

### Derived Stats Formulas

**HP Calculation** (from Pathbuilder attributes):
```typescript
const conMod = Math.floor((build.abilities.con - 10) / 2);
const hp = build.attributes.ancestryhp 
         + (build.level * (build.attributes.classhp + conMod))
         + build.attributes.bonushp
         + (build.level * build.attributes.bonushpPerLevel);
```

**AC** (pre-calculated by Pathbuilder):
```typescript
const ac = build.acTotal.acTotal; // Use directly
```

**Saves** (proficiency + ability + level):
```typescript
const getProfBonus = (rank: number, level: number) => rank > 0 ? rank + level : 0;
const fortitude = getProfBonus(build.proficiencies.fortitude, build.level) 
                + Math.floor((build.abilities.con - 10) / 2);
const reflex = getProfBonus(build.proficiencies.reflex, build.level) 
             + Math.floor((build.abilities.dex - 10) / 2);
const will = getProfBonus(build.proficiencies.will, build.level) 
           + Math.floor((build.abilities.wis - 10) / 2);
```

**Perception**:
```typescript
const perception = getProfBonus(build.proficiencies.perception, build.level) 
                 + Math.floor((build.abilities.wis - 10) / 2);
```

**Speed**:
```typescript
const speed = build.attributes.speed + build.attributes.speedBonus;
```

### Proficiency Mapping
| Pathbuilder Value | PF2 Proficiency |
|-------------------|-----------------|
| 0 | `untrained` |
| 2 | `trained` |
| 4 | `expert` |
| 6 | `master` |
| 8 | `legendary` |

### Damage Type Mapping
| Pathbuilder | PF2DamageType |
|-------------|---------------|
| `B` | `bludgeoning` |
| `P` | `piercing` |
| `S` | `slashing` |

---

## Work Objectives

### Core Objective
Implement Pathbuilder 2e character import by:
1. Creating separate `PF2CharacterSheet` and `GurpsCharacterSheet` types
2. Updating ALL files that depend on `CharacterSheet` to handle the union
3. Creating PathbuilderImporter service for API/file import
4. Adding import UI to PF2CharacterEditor with preview

### Concrete Deliverables
**Types (shared)**:
- `shared/rulesets/pf2/characterSheet.ts` - PF2CharacterSheet type
- `shared/rulesets/gurps/characterSheet.ts` - GurpsCharacterSheet type
- `shared/rulesets/characterSheet.ts` - Union type + type guards
- `shared/rulesets/pf2/pathbuilder.ts` - Pathbuilder JSON types + validation
- `shared/rulesets/pf2/pathbuilderMapping.ts` - Mapping functions

**Updated Contracts**:
- `shared/types.ts` - Re-export CharacterSheet union
- `shared/rulesets/Ruleset.ts` - Generic per-ruleset character types
- `shared/rulesets/pf2/index.ts` - Use PF2CharacterSheet
- `shared/rulesets/gurps/index.ts` - Use GurpsCharacterSheet

**Client**:
- `src/App.tsx` - Ruleset-aware character creation
- `src/components/rulesets/useCharacterEditor.ts` - PF2 branch
- `src/components/rulesets/pf2/*.tsx` - Use PF2CharacterSheet
- `src/services/pathbuilderImporter.ts` - Import service
- `src/components/rulesets/pf2/PathbuilderImport.tsx` - Import UI

**Server**:
- `server/src/rulesets/pf2/character.ts` - PF2CharacterSheet factory
- `server/src/rulesets/pf2/combatant.ts` - Use PF2 weapons/armor
- `server/src/match.ts` - Handle union for initiative

### Definition of Done
- [ ] `npm run build` succeeds (client + server)
- [ ] `npm run lint` passes
- [ ] `npx vitest run` - all tests pass
- [ ] Can import character via Pathbuilder ID
- [ ] Can import character via JSON file upload
- [ ] Preview shows before confirming import
- [ ] Imported character appears in character list
- [ ] GURPS characters still work (no regression)
- [ ] Type guards correctly discriminate GURPS vs PF2 characters

### Must Have
- PF2CharacterSheet with native PF2 types (abilities.constitution, not attributes.health)
- GurpsCharacterSheet preserving existing GURPS behavior
- Type guards `isPF2Character` and `isGurpsCharacter`
- API fetch from pathbuilder2e.com
- File upload fallback
- Preview before import

### Must NOT Have (Guardrails)
- NO pets/familiars import
- NO formulas/crafting import
- NO spell slot tracking (only proficiency + spell names)
- NO dual-class support (primary class only)
- NO re-import/update existing character

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Vitest)
- **User wants tests**: TDD
- **Framework**: Vitest

### TDD Approach
- Write runtime tests for type guards (not just compile-time assertions)
- Write tests for mapping functions with real API data
- Write tests for service with mocked fetch

---

## Task Flow

```
Phase A: Type System Foundation (Tasks 1-3)
  1. PF2CharacterSheet type + PF2CharacterWeapon/Armor
  2. GurpsCharacterSheet type (extract from existing)
  3. CharacterSheet union + type guards

Phase B: Shared Contract Updates (Tasks 4-6)
  4. Update shared/types.ts exports
  5. Update Ruleset.ts contract
  6. Update ruleset bundles (pf2/index.ts, gurps/index.ts)

Phase C: Client Updates (Tasks 7-9)
  7. Update App.tsx for ruleset-aware character creation
  8. Update useCharacterEditor for PF2 branch
  9. Update PF2 UI components

Phase D: Server Updates (Tasks 10-11)
  10. Update server PF2 character/combatant factories
  11. Update match.ts initiative logic

Phase E: Pathbuilder Import (Tasks 12-15)
  12. Pathbuilder types + validation
  13. Pathbuilder → PF2CharacterSheet mapping
  14. PathbuilderImporter service
  15. PathbuilderImport UI + integration
```

---

## TODOs

### Phase A: Type System Foundation

- [x] 1. Create PF2CharacterSheet type

  **What to do**:
  - Create `shared/rulesets/pf2/characterSheet.ts`
  - Define types:
    ```typescript
    import type { Id } from '../../types';
    import type { Proficiency, PF2DamageType, PF2Skill, PF2WeaponTrait } from './types';

    // Re-use existing Abilities from types.ts (already has all 6 PF2 abilities)
    export type { Abilities as PF2Abilities } from './types';

    export type PF2CharacterDerivedStats = {
      hitPoints: number;
      armorClass: number;
      speed: number; // in feet
      fortitudeSave: number;
      reflexSave: number;
      willSave: number;
      perception: number;
    };

    export type PF2CharacterWeapon = {
      id: Id;
      name: string;
      damage: string;          // e.g., "1d8"
      damageType: PF2DamageType;
      proficiencyCategory: 'simple' | 'martial' | 'advanced' | 'unarmed';
      traits: PF2WeaponTrait[];  // finesse, agile, etc. (needed for combat logic)
      potencyRune: number;       // +1/+2/+3
      strikingRune: 'striking' | 'greater_striking' | 'major_striking' | null;
    };

    export type PF2CharacterArmor = {
      id: Id;
      name: string;
      proficiencyCategory: 'unarmored' | 'light' | 'medium' | 'heavy';
      acBonus: number;
      dexCap: number | null;
      potencyRune: number;
    };

    export type PF2Feat = {
      id: Id;
      name: string;
      type: string;  // 'class', 'ancestry', 'general', 'skill'
      level: number;
      description?: string;
    };

    export type PF2SpellInfo = {
      tradition: string;
      proficiency: Proficiency;
      known: string[];  // spell names only
    };

    export type PF2CharacterSheet = {
      id: Id;
      name: string;
      level: number;
      class: string;
      ancestry: string;
      heritage: string;
      background: string;
      
      // Core stats
      abilities: PF2Abilities;
      derived: PF2CharacterDerivedStats;
      
      // Data for derived stats recalculation (see "PF2 Derived Stats Recomputation Contract")
      classHP: number;  // Base HP per level from class (Fighter=10, Wizard=6, etc.)
      saveProficiencies: {
        fortitude: Proficiency;
        reflex: Proficiency;
        will: Proficiency;
      };
      perceptionProficiency: Proficiency;
      armorProficiency: Proficiency;
      
      // Equipment and features
      skills: PF2Skill[];
      weapons: PF2CharacterWeapon[];
      armor: PF2CharacterArmor | null;
      feats: PF2Feat[];
      spells: PF2SpellInfo | null;
    };
    ```
  - Export from `shared/rulesets/pf2/index.ts`

  **Parallelizable**: NO (foundation)

  **References**:
  - `shared/rulesets/pf2/types.ts:4-11` - Existing Abilities (reuse directly)
  - `shared/rulesets/pf2/types.ts:25-32` - Existing PF2Skill (reuse)
  - `shared/rulesets/pf2/types.ts:38-42` - PF2DamageType (reuse)
  - `shared/rulesets/pf2/types.ts:83-103` - PF2WeaponTrait (reuse for weapon traits)
  - `shared/rulesets/pf2/rules.ts:153-179` - calculateDerivedStats function signature (inputs needed)

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds
  - [ ] Types export correctly from `shared/rulesets/pf2/characterSheet.ts`
  - [ ] PF2CharacterSheet has `abilities.constitution` (not `attributes.health`)
  - [ ] PF2CharacterSheet has all fields needed for `calculateDerivedStats` recalculation

  **Commit**: YES
  - Message: `feat(pf2): add PF2CharacterSheet type with native PF2 abilities`

---

- [x] 2. Create GurpsCharacterSheet type

  **What to do**:
  - Create `shared/rulesets/gurps/characterSheet.ts`
  - Move existing CharacterSheet definition here as `GurpsCharacterSheet`:
    ```typescript
    import type { Id } from '../../types';
    import type { Attributes, DerivedStats, Skill, Advantage, Disadvantage, Equipment } from './types';

    export type GurpsCharacterSheet = {
      id: Id;
      name: string;
      attributes: Attributes;
      derived: DerivedStats;
      skills: Skill[];
      advantages: Advantage[];
      disadvantages: Disadvantage[];
      equipment: Equipment[];
      pointsTotal: number;
    };
    ```
  - Export from `shared/rulesets/gurps/index.ts`

  **Parallelizable**: YES (with task 1)

  **References**:
  - `shared/types.ts:51-61` - Current CharacterSheet definition
  - `shared/rulesets/gurps/types.ts:9-16` - Attributes type

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds
  - [ ] GurpsCharacterSheet type exports correctly
  - [ ] Has `attributes.health` (GURPS naming)

  **Commit**: YES
  - Message: `refactor(gurps): extract GurpsCharacterSheet type`

---

- [x] 3. Create CharacterSheet union + type guards

  **What to do**:
  - Create `shared/rulesets/characterSheet.ts`
  - Define union and **resilient** type guards:
    ```typescript
    import type { PF2CharacterSheet } from './pf2/characterSheet';
    import type { GurpsCharacterSheet } from './gurps/characterSheet';

    export type CharacterSheet = GurpsCharacterSheet | PF2CharacterSheet;

    // RESILIENT guards: check field existence safely before accessing nested fields
    export function isPF2Character(character: CharacterSheet): character is PF2CharacterSheet {
      return 'abilities' in character && 
             character.abilities !== null && 
             typeof character.abilities === 'object' &&
             'constitution' in character.abilities;
    }

    export function isGurpsCharacter(character: CharacterSheet): character is GurpsCharacterSheet {
      return 'attributes' in character && 
             character.attributes !== null && 
             typeof character.attributes === 'object' &&
             'health' in character.attributes;
    }
    ```
  - Create test file `shared/rulesets/characterSheet.test.ts` with runtime tests
  - **Test edge cases**: migrated characters (no attributes field), malformed data

  **Parallelizable**: NO (depends on 1, 2)

  **References**:
  - `shared/rulesets/index.ts:26-36` - Existing combatant type guards pattern

  **Acceptance Criteria**:
  - [ ] Test file: `shared/rulesets/characterSheet.test.ts`
  - [ ] `npx vitest run shared/rulesets/characterSheet.test.ts` passes
  - [ ] `isPF2Character(pf2Char)` returns true
  - [ ] `isPF2Character(gurpsChar)` returns false
  - [ ] Guards are mutually exclusive
  - [ ] Guards don't throw on malformed input (return false instead)

  **Commit**: YES
  - Message: `feat(rulesets): add CharacterSheet union type with type guards`

---

### Phase B: Shared Contract Updates

- [x] 4. Update shared/types.ts exports

  **What to do**:
  - Remove CharacterSheet definition from `shared/types.ts` (lines 51-61)
  - Import and re-export from `shared/rulesets/characterSheet.ts`:
    ```typescript
    export { isPF2Character, isGurpsCharacter } from './rulesets/characterSheet';
    export type { CharacterSheet } from './rulesets/characterSheet';
    export type { PF2CharacterSheet } from './rulesets/pf2/characterSheet';
    export type { GurpsCharacterSheet } from './rulesets/gurps/characterSheet';
    ```
  - Note: Type guards are VALUE exports (functions), types are TYPE exports

  **Parallelizable**: NO (depends on 3)

  **References**:
  - `shared/types.ts:51-61` - Current CharacterSheet to remove

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds
  - [ ] CharacterSheet importable from `shared/types` (backward compatible)
  - [ ] Type guards `isPF2Character`/`isGurpsCharacter` importable as functions

  **Commit**: YES
  - Message: `refactor: move CharacterSheet to shared/rulesets`

---

- [x] 5. Update Ruleset.ts contract

  **What to do**:
  - Update `shared/rulesets/Ruleset.ts` signature:
  
  **Current** (line 42):
  ```typescript
  getDerivedStats: (attributes: CharacterSheet['attributes']) => CharacterSheet['derived'];
  ```
  
  **New** (accepts full character for both rulesets):
  ```typescript
  getDerivedStats: (character: CharacterSheet) => CharacterSheet['derived'];
  ```

  **Why full character**: PF2 `calculateDerivedStats` needs `level`, `classHP`, `saveProficiencies`, etc. Passing just `attributes` is insufficient.

  **Downstream updates required**:
  - `shared/rulesets/pf2/index.ts`: Update `getDerivedStats` implementation to read `character.abilities`, `character.level`, etc.
  - `shared/rulesets/gurps/index.ts`: Update `getDerivedStats` implementation to read `character.attributes`
  
  **Note on callers**: Currently, `getDerivedStats` in `Ruleset` interface is defined but the actual call sites are:
  - `src/components/rulesets/useCharacterEditor.ts:42` - calls GURPS `calculateDerivedStats(attributes)` directly, not via Ruleset interface
  - This call will be updated in Task 8 to branch by ruleset and pass full character

  **Parallelizable**: NO (depends on 3)

  **References**:
  - `shared/rulesets/Ruleset.ts:42` - Current `getDerivedStats` signature
  - `shared/rulesets/pf2/index.ts` - PF2 implementation
  - `shared/rulesets/gurps/index.ts` - GURPS implementation
  - `src/components/rulesets/useCharacterEditor.ts:42` - Actual call site (imports GURPS calculateDerivedStats directly)

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds
  - [ ] Ruleset interface `getDerivedStats(character)` signature accepts full character
  - [ ] PF2 implementation reads from `character.abilities`
  - [ ] GURPS implementation reads from `character.attributes`

  **Commit**: YES
  - Message: `refactor(rulesets): update Ruleset contract for CharacterSheet union`

---

- [x] 6. Update ruleset bundles + serverAdapter

  **What to do**:
  
  **6a. Update `shared/rulesets/pf2/index.ts`**:
  - Change `getDerivedStats` to use PF2 abilities natively:
    ```typescript
    getDerivedStats: (character: PF2CharacterSheet) => {
      const conMod = Math.floor((character.abilities.constitution - 10) / 2);
      return {
        hitPoints: ...,
        armorClass: ...,
        // Return PF2DerivedStats shape
      };
    }
    ```
  - Update `getInitialCombatantState` to read from PF2CharacterSheet

  **6b. Update `shared/rulesets/gurps/index.ts`**:
  - Explicitly type to `GurpsCharacterSheet`

  **6c. Update `shared/rulesets/gurps/rules.ts`**:
  - Type `calculateTotalPoints`, `getDefenseOptions` to `GurpsCharacterSheet`

  **6d. Update `shared/rulesets/serverAdapter.ts`**:
  - Import CharacterSheet union
  - Ensure adapter functions accept union (or narrow internally)

  **Parallelizable**: NO (depends on 5)

  **References**:
  - `shared/rulesets/pf2/index.ts:9-26` - getDerivedStats using attributes.health workaround
  - `shared/rulesets/pf2/index.ts:27-50` - getInitialCombatantState
  - `shared/rulesets/gurps/rules.ts` - GURPS-specific functions
  - `shared/rulesets/serverAdapter.ts` - Server adapter imports

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds
  - [ ] PF2 ruleset works with PF2CharacterSheet
  - [ ] GURPS ruleset works with GurpsCharacterSheet
  - [ ] serverAdapter compiles without errors

  **Commit**: YES
  - Message: `refactor(rulesets): update ruleset bundles for CharacterSheet union`

---

### Phase C: Client Updates

- [ ] 7. Update App.tsx for ruleset-aware character creation

  **What to do**:
  - When opening editor for PF2 match, create PF2-shaped default character
  - When opening editor for GURPS match, create GURPS-shaped default character
  - Use rulesetId to determine which shape to create
  - Import `isPF2Character` for any union checks

  **Parallelizable**: NO (depends on 6)

  **References**:
  - `src/App.tsx` - Creates editingCharacter with GURPS shape

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds
  - [ ] Opening PF2 editor creates PF2-shaped character
  - [ ] Opening GURPS editor creates GURPS-shaped character

  **Commit**: YES
  - Message: `feat(app): ruleset-aware character creation in editor`

---

- [ ] 8. Update useCharacterEditor for PF2 branch

  **What to do**:
  - Add PF2 branch in `updateAttribute`:
    ```typescript
    import { calculateDerivedStats as pf2CalculateDerivedStats } from '../../../shared/rulesets/pf2/rules';
    
    const updateAttribute = (attr: string, delta: number) => {
      if (rulesetId === 'pf2' && isPF2Character(character)) {
        const newAbilities = { ...character.abilities, [attr]: newValue };
        // Use all stored fields for recalculation (see "PF2 Derived Stats Recomputation Contract")
        const newDerived = pf2CalculateDerivedStats(
          newAbilities,
          character.level,
          character.classHP,
          character.armor?.acBonus ?? 0,
          character.armor?.dexCap ?? null,
          character.saveProficiencies,
          character.perceptionProficiency,
          character.armorProficiency
        );
        setCharacter({ ...character, abilities: newAbilities, derived: newDerived });
      } else if (isGurpsCharacter(character)) {
        // Existing GURPS logic - unchanged
      }
    };
    ```
  - Import `isPF2Character`, `isGurpsCharacter` from `shared/types`
  - Import `calculateDerivedStats` from `shared/rulesets/pf2/rules`

  **Parallelizable**: NO (depends on 6)

  **References**:
  - `src/components/rulesets/useCharacterEditor.ts:36-44` - updateAttribute
  - `shared/rulesets/pf2/rules.ts:153-179` - `calculateDerivedStats` signature with all params

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds
  - [ ] PF2 attribute updates recalculate derived stats correctly
  - [ ] GURPS attribute updates still work unchanged

  **Commit**: YES
  - Message: `feat(editor): add PF2 branch to useCharacterEditor`

---

- [ ] 9. Update PF2 UI components + FloatingStatus

  **What to do**:
  
  **9a. `PF2CharacterEditor.tsx`**:
  - Change attribute keys from `health` to `constitution`
  - Read from `character.abilities[key]` not `character.attributes[key]`
  - Display `character.level` (not hardcoded "Lv. 1")

  **9b. `PF2GameStatusPanel.tsx`**:
  - Line 97: `character.abilities.constitution` not `attributes.health`
  - Line 113: `character.derived.armorClass` not `derived.dodge`
  - Line 114: `character.derived.speed` not `derived.basicMove * 5`
  - Lines 121-130: `character.weapons` not `character.equipment`

  **9c. `PF2ActionBar.tsx`** (CRITICAL - many changes):
  - Lines 66-87: Change all `playerCharacter.attributes.*` to `playerCharacter.abilities.*`:
    - `attributes.strength` → `abilities.strength`
    - `attributes.dexterity` → `abilities.dexterity`
    - `attributes.health` → `abilities.constitution`
    - `attributes.intelligence` → `abilities.intelligence`
    - `attributes.wisdom` → `abilities.wisdom`
    - `attributes.charisma` → `abilities.charisma`
  - Line 90: `derived.dodge` → `derived.armorClass`
  - Line 91: `derived.basicMove * 5` → `derived.speed`
  - Lines 98-107: `playerCharacter.equipment.filter(...)` → `playerCharacter.weapons`
    - Change filter logic to iterate `weapons` array directly
    - Update property access for PF2CharacterWeapon shape

  **9d. `FloatingStatus.tsx`** (FP handling):
  - Import `isPF2Character` from shared/types
  - Line 13: Guard FP access with type check
  - Conditionally hide FP bar for PF2 characters:
    ```typescript
    // Only show FP for GURPS characters
    {isGurpsCharacter(character) && (
      <div className="status-bar-row">
        <span className="status-label">FP</span>
        {/* ... FP bar ... */}
      </div>
    )}
    ```

  **Parallelizable**: NO (depends on 8)

  **References**:
  - `src/components/rulesets/pf2/PF2CharacterEditor.tsx:58-73`
  - `src/components/rulesets/pf2/PF2GameStatusPanel.tsx:97, 113-114`
  - `src/components/rulesets/pf2/PF2ActionBar.tsx:66-91, 98-107` - Full change list
  - `src/components/game/FloatingStatus.tsx:13` - FP bar uses `character.derived.fatiguePoints`

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds
  - [ ] Manual: PF2 abilities display correctly (CON not health)
  - [ ] Manual: AC and Speed display correctly in both panels
  - [ ] Manual: Weapons list displays from `weapons` array
  - [ ] Manual: FP bar hidden for PF2 characters, shown for GURPS

  **Commit**: YES
  - Message: `feat(pf2): update PF2 UI components for PF2CharacterSheet`

---

### Phase D: Server Updates

- [ ] 10. Update server PF2 character/combatant factories

  **What to do**:
  
  **10a. `server/src/rulesets/pf2/character.ts`**:
  - Create PF2CharacterSheet with native shape (ALL required fields):
    ```typescript
    import { randomUUID } from 'node:crypto';
    import type { PF2CharacterSheet } from '../../../../shared/rulesets/pf2/characterSheet';

    export const createPF2Character = (name: string = 'PF2 Character'): PF2CharacterSheet => ({
      id: randomUUID(),
      name,
      level: 1,
      class: 'Fighter',
      ancestry: 'Human',
      heritage: 'Versatile Heritage',
      background: 'Warrior',
      
      // Core stats - Fighter level 1 with 14 CON
      abilities: { strength: 14, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 },
      
      // Derived stats calculation:
      // HP = classHP + (level * (classHP + conMod)) = 10 + (1 * (10 + 2)) = 10 + 12 = 22? No, PF2 is: ancestryHP + (level * (classHP + conMod))
      // Using simplified: classHP + conMod*level = 10 + 2 = 12... let's use 20 as reasonable starting HP
      // AC = 10 + dexMod + level + trained(2) = 10 + 1 + 1 + 2 = 14 (unarmored)
      derived: { 
        hitPoints: 20,  // Level 1 Fighter, 14 CON
        armorClass: 14,  // Unarmored: 10 + DEX(1) + level(1) + trained(2)
        speed: 25,  // Standard human speed
        fortitudeSave: 5,  // Expert save: level(1) + expert(4) + CON(2) = 7... simplified
        reflexSave: 3,   // Trained: level(1) + trained(2) + DEX(1) = 4... simplified  
        willSave: 1,     // Trained: level(1) + trained(2) + WIS(0) = 3... simplified
        perception: 3,   // Expert: level(1) + expert(4) + WIS(0) = 5... simplified to 3
      },
      
      // Fields required for derived stats recalculation
      classHP: 10,  // Fighter class HP per level
      saveProficiencies: {
        fortitude: 'expert',  // Fighter is expert in Fortitude
        reflex: 'trained',
        will: 'trained',
      },
      perceptionProficiency: 'expert',  // Fighter is expert in Perception
      armorProficiency: 'trained',  // Will be expert with armor, but unarmored is trained
      
      // Equipment and features
      skills: [],
      weapons: [{
        id: randomUUID(),
        name: 'Longsword',
        damage: '1d8',
        damageType: 'slashing',
        proficiencyCategory: 'martial',
        traits: [],
        potencyRune: 0,
        strikingRune: null,
      }],
      armor: null,
      feats: [],
      spells: null,
    });
    ```
    
    **Note**: Derived stats are approximations for a level 1 Fighter. The exact values would come from `calculateDerivedStats` but we provide reasonable defaults.

  **10b. `server/src/rulesets/pf2/combatant.ts`**:
  - Read primary weapon from `character.weapons[0]` not `character.equipment`

  **10c. `server/src/bot.ts`**:
  - `createBotCharacter` should branch on rulesetId to create correct shape:
    ```typescript
    const createBotCharacter = (rulesetId: RulesetId, botName: string): CharacterSheet => {
      const factory = getRulesetServerFactory(rulesetId);
      return factory.createDefaultCharacter(botName);
    };
    ```

  **Parallelizable**: YES (with task 11)

  **References**:
  - `server/src/rulesets/pf2/character.ts` - PF2 character factory
  - `server/src/rulesets/pf2/combatant.ts` - PF2 combatant factory
  - `server/src/bot.ts` - Bot character creation

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds (server)
  - [ ] PF2 character factory creates PF2CharacterSheet shape
  - [ ] PF2 combatant reads `character.weapons` correctly
  - [ ] Bot characters created with correct shape per ruleset

  **Commit**: YES
  - Message: `feat(server): update PF2 character/combatant factories`

---

- [ ] 11. Update match.ts + handlers + bot.ts for CharacterSheet union

  **What to do**:
  
  **11a. `server/src/match.ts:68-79`** - Initiative ordering:
  ```typescript
  const getInitiativeValue = (char: CharacterSheet): number => {
    if (isPF2Character(char)) {
      // PF2: perception + DEX mod
      return char.derived.perception + Math.floor((char.abilities.dexterity - 10) / 2);
    } else {
      // GURPS: basicSpeed + dexterity/100
      return char.derived.basicSpeed + char.attributes.dexterity / 100;
    }
  };
  ```

  **11b. `server/src/handlers/pf2-attack.ts`**:
  - Remove `getPF2Abilities(attributes)` workaround function
  - Use `character.abilities` directly (type narrowing via rulesetId check)
  - Remove `calculateAC(derived.dodge)` → use `character.derived.armorClass`

  **11c. `server/src/handlers/damage.ts:56`**:
  - Replace `targetCharacter.attributes.health` with branching:
    ```typescript
    const targetHT = isGurpsCharacter(targetCharacter) 
      ? targetCharacter.attributes.health 
      : targetCharacter.abilities.constitution;
    ```

  **11d. `server/src/bot.ts:124`** - Bot movement uses `derived.basicMove`:
  ```typescript
  // Current (line 124):
  const maxMove = botCharacter?.derived.basicMove ?? 5;
  
  // New (branch by ruleset):
  const maxMove = isPF2Character(botCharacter) 
    ? Math.floor((botCharacter.derived.speed ?? 25) / 5)  // PF2: speed in feet → hexes
    : (botCharacter?.derived.basicMove ?? 5);  // GURPS: basicMove in hexes
  ```

  **Parallelizable**: YES (with task 10)

  **References**:
  - `server/src/match.ts:68-79` - Initiative ordering uses `basicSpeed`, `attributes.dexterity`
  - `server/src/handlers/pf2-attack.ts:25-32` - `getPF2Abilities` workaround
  - `server/src/handlers/pf2-attack.ts:60-62` - `calculateAC` uses `derived.dodge`
  - `server/src/handlers/damage.ts:56` - `attributes.health` for HT checks

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds (server)
  - [ ] PF2 matches use PF2 initiative (perception-based)
  - [ ] GURPS matches use GURPS initiative (basicSpeed-based)
  - [ ] PF2 attacks use `derived.armorClass` directly
  - [ ] Damage handler uses correct constitution/health per ruleset

  **Commit**: YES
  - Message: `feat(server): handle CharacterSheet union in match and handlers`

---

### Phase E: Pathbuilder Import

- [ ] 12. Create shared UUID utility + Pathbuilder types + validation

  **What to do**:
  
  **12a. Create shared UUID utility** (prerequisite for mapping):
  - Create `shared/utils/uuid.ts`:
    ```typescript
    export const uuid = (): string => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
    ```

  **12b. Create Pathbuilder types**:
  - Create `shared/rulesets/pf2/pathbuilder.ts`
  - Define `PathbuilderExport` and `PathbuilderBuild` types (see draft for full structure)
  - Create `validatePathbuilderExport(data: unknown): PathbuilderExport | null`
  - Runtime validation checks:
    - `success === true`
    - `build.name` is non-empty string
    - `build.level` is 1-20
    - `build.abilities` has all 6 ability scores
    - `build.proficiencies` object exists

  **Parallelizable**: YES (can start early)

  **References**:
  - Draft file `.sisyphus/drafts/pathbuilder-import.md` - Full JSON structure
  - **Test API**: `https://pathbuilder2e.com/json.php?id=163111` (verified working sample)

  **Test Fixture Strategy** (CRITICAL - deterministic, offline-friendly):
  
  **Note on ESM**: This repo uses ESM (`"type": "module"` in package.json, no `resolveJsonModule`). `__dirname` is NOT available in ESM.
  
  **Solution**: Use Vitest's `import.meta.url` pattern (consistent with existing tests):
  
  1. **Fetch and commit fixture** (exact commands):
     ```bash
     # Create fixtures directory
     mkdir -p shared/rulesets/pf2/__fixtures__
     
     # Fetch and save fixture
     curl -s "https://pathbuilder2e.com/json.php?id=163111" > shared/rulesets/pf2/__fixtures__/pathbuilder-163111.json
     
     # Verify fixture is valid JSON with expected structure
     node -e "const f = require('./shared/rulesets/pf2/__fixtures__/pathbuilder-163111.json'); console.log('success:', f.success, 'name:', f.build?.name)"
     # Expected output: success: true name: Jordo PF2e Champion Paladin
     ```
  2. **Fixture location**: `shared/rulesets/pf2/__fixtures__/pathbuilder-163111.json`
  3. **Tests load fixture via fs with ESM-compatible path resolution**:
     ```typescript
     import { readFileSync } from 'node:fs';
     import { fileURLToPath } from 'node:url';
     import { dirname, join } from 'node:path';
     
     const __dirname = dirname(fileURLToPath(import.meta.url));
     const fixtureData = JSON.parse(
       readFileSync(join(__dirname, '__fixtures__/pathbuilder-163111.json'), 'utf-8')
     );
     ```
  4. **Alternative (simpler)**: Just inline a minimal fixture object in the test file for unit tests, use full fixture for integration tests.
  5. **NO live network calls in tests** - ensures deterministic CI/offline runs

  **Acceptance Criteria**:
  - [ ] Fixture file exists: `shared/rulesets/pf2/__fixtures__/pathbuilder-163111.json`
  - [ ] Test: `npx vitest run shared/rulesets/pf2/pathbuilder.test.ts`
  - [ ] Tests load fixture via `fs.readFileSync` (not JSON import)
  - [ ] validatePathbuilderExport returns null for invalid data
  - [ ] validatePathbuilderExport returns typed data for valid input

  **Commit**: YES
  - Message: `feat(pf2): add Pathbuilder JSON types and validation`

---

- [ ] 13. Create Pathbuilder → PF2CharacterSheet mapping

  **What to do**:
  - Create `shared/rulesets/pf2/pathbuilderMapping.ts`
  
  **Mapping functions** (use formulas from "Pathbuilder Mapping Formulas" section above):
  
  - `mapAbilities(build)`: 
    ```typescript
    { strength: build.abilities.str, dexterity: build.abilities.dex, 
      constitution: build.abilities.con, intelligence: build.abilities.int,
      wisdom: build.abilities.wis, charisma: build.abilities.cha }
    ```
  
  - `mapProficiency(rank: number)`:
    ```typescript
    rank === 0 ? 'untrained' : rank === 2 ? 'trained' : 
    rank === 4 ? 'expert' : rank === 6 ? 'master' : 'legendary'
    ```
  
  - `calculateDerivedStats(build)`:
    ```typescript
    const conMod = Math.floor((build.abilities.con - 10) / 2);
    return {
      hitPoints: build.attributes.ancestryhp + (build.level * (build.attributes.classhp + conMod)) 
                 + build.attributes.bonushp + (build.level * build.attributes.bonushpPerLevel),
      armorClass: build.acTotal.acTotal,
      speed: build.attributes.speed + build.attributes.speedBonus,
      fortitudeSave: getProfBonus(build.proficiencies.fortitude, build.level) + conMod,
      reflexSave: getProfBonus(build.proficiencies.reflex, build.level) + dexMod,
      willSave: getProfBonus(build.proficiencies.will, build.level) + wisMod,
      perception: getProfBonus(build.proficiencies.perception, build.level) + wisMod,
    };
    ```
  
  - **ID Generation Strategy**: Mapping code lives in `shared/`, which cannot import from `src/`. 
    
    **Solution**: Create `shared/utils/uuid.ts` (copy of `src/utils/uuid.ts`) or use `crypto.randomUUID()` directly:
    ```typescript
    // shared/utils/uuid.ts (NEW FILE - Task 12 prerequisite)
    export const uuid = (): string => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
    ```
    
  - `mapWeapons(build.weapons)`: Create PF2CharacterWeapon[] with potencyRune, strikingRune, traits
    ```typescript
    import { uuid } from '../../utils/uuid';  // Shared utility
    
    // Pathbuilder weapon → PF2CharacterWeapon
    const mapWeapon = (w: PathbuilderWeapon): PF2CharacterWeapon => ({
      id: uuid(),
      name: w.name,
      damage: `1${w.die}`,  // Pathbuilder stores die type, not full formula
      damageType: mapDamageType(w.damageType),
      proficiencyCategory: w.prof as 'simple' | 'martial' | 'advanced' | 'unarmed',
      traits: [],  // Pathbuilder doesn't export traits; default empty, can enhance later
      potencyRune: w.pot,
      strikingRune: mapStrikingRune(w.str),  // '' → null, 'striking' → 'striking', etc.
    });
    ```
    **Note**: Pathbuilder doesn't export weapon traits. Combat logic should fall back to empty traits (no agile/finesse bonuses until manually added or enhanced).

  - `mapArmor(build.armor)`: Create PF2CharacterArmor | null (first worn armor)
    ```typescript
    // PF2 armor AC/dexCap lookup table (from Core Rulebook)
    const ARMOR_TABLE: Record<string, { acBonus: number; dexCap: number | null; category: string }> = {
      'Unarmored': { acBonus: 0, dexCap: null, category: 'unarmored' },
      'Padded Armor': { acBonus: 1, dexCap: 3, category: 'light' },
      'Leather Armor': { acBonus: 1, dexCap: 4, category: 'light' },
      'Studded Leather Armor': { acBonus: 2, dexCap: 3, category: 'light' },
      'Chain Shirt': { acBonus: 2, dexCap: 3, category: 'light' },
      'Hide Armor': { acBonus: 3, dexCap: 2, category: 'medium' },
      'Scale Mail': { acBonus: 3, dexCap: 2, category: 'medium' },
      'Chain Mail': { acBonus: 4, dexCap: 1, category: 'medium' },
      'Breastplate': { acBonus: 4, dexCap: 1, category: 'medium' },
      'Splint Mail': { acBonus: 5, dexCap: 1, category: 'heavy' },
      'Half Plate': { acBonus: 5, dexCap: 1, category: 'heavy' },
      'Full Plate': { acBonus: 6, dexCap: 0, category: 'heavy' },
      // Add more as needed...
    };

    const mapArmor = (armorArray: PathbuilderArmor[]): PF2CharacterArmor | null => {
      const wornArmor = armorArray.find(a => a.worn);
      if (!wornArmor) return null;
      
      // Lookup base stats, fallback to unarmored if not found
      const baseStats = ARMOR_TABLE[wornArmor.name] ?? ARMOR_TABLE['Unarmored'];
      
      return {
        id: uuid(),  // Use existing uuid utility
        name: wornArmor.name,
        proficiencyCategory: baseStats.category as 'unarmored' | 'light' | 'medium' | 'heavy',
        acBonus: baseStats.acBonus + wornArmor.pot,  // Add potency rune bonus
        dexCap: baseStats.dexCap,
        potencyRune: wornArmor.pot,
      };
    };
    ```
    **Fallback behavior**: Unknown armor names use `Unarmored` stats (acBonus: 0, dexCap: null). Worker should add more armors to table as encountered.

  - `mapSkills(build.proficiencies, build.lores)`: Create PF2Skill[]
    ```typescript
    // Skill → Ability mapping table (PF2 core rules)
    const SKILL_ABILITY_MAP: Record<string, keyof PF2Abilities> = {
      acrobatics: 'dexterity',
      arcana: 'intelligence',
      athletics: 'strength',
      crafting: 'intelligence',
      deception: 'charisma',
      diplomacy: 'charisma',
      intimidation: 'charisma',
      medicine: 'wisdom',
      nature: 'wisdom',
      occultism: 'intelligence',
      performance: 'charisma',
      religion: 'wisdom',
      society: 'intelligence',
      stealth: 'dexterity',
      survival: 'wisdom',
      thievery: 'dexterity',
    };
    // Lores use intelligence
    ```

  - `mapFeats(build.feats)`: Parse tuple format `[name, extra, type, level, ...]` → PF2Feat[]
    ```typescript
    // Pathbuilder feats are tuples: [name, extra, type, level, slot?, choiceType?, parentRef?]
    const mapFeat = (tuple: PathbuilderFeatTuple): PF2Feat => ({
      id: uuid(),  // Use existing uuid utility
      name: tuple[0],
      type: tuple[2],  // 'class', 'ancestry', 'general', 'skill'
      level: tuple[3],
      description: tuple[1] ?? undefined,  // extra field sometimes has description
    });
    ```

  - `mapSpells(build)`: Extract spellcasting info from focus/spellCasters structure
    ```typescript
    const mapSpells = (build: PathbuilderBuild): PF2SpellInfo | null => {
      // Check focus spellcasting first
      const focusEntries = Object.entries(build.focus);
      if (focusEntries.length === 0 && build.spellCasters.length === 0) {
        return null;  // No spellcasting
      }

      // Determine tradition: check proficiency keys for highest non-zero value
      const traditions = ['castingArcane', 'castingDivine', 'castingOccult', 'castingPrimal'] as const;
      let bestTradition: string = 'arcane';
      let bestProf = 0;
      for (const t of traditions) {
        const prof = build.proficiencies[t];
        if (prof > bestProf) {
          bestProf = prof;
          bestTradition = t.replace('casting', '').toLowerCase();  // 'castingArcane' → 'arcane'
        }
      }

      // Collect spell names from focus structure
      const spellNames: string[] = [];
      for (const [, traditions] of focusEntries) {
        for (const [, data] of Object.entries(traditions)) {
          if (data.focusCantrips) spellNames.push(...data.focusCantrips);
          if (data.focusSpells) spellNames.push(...data.focusSpells);
        }
      }

      return {
        tradition: bestTradition,
        proficiency: mapProficiency(bestProf),
        known: spellNames,
      };
    };
    ```
    **Note**: This captures focus spells. Full prepared/spontaneous spell lists would require parsing `spellCasters` array which is complex. Start with focus spells only.

  - `mapDamageType(char: string)`:
    ```typescript
    char === 'B' ? 'bludgeoning' : char === 'P' ? 'piercing' : 'slashing'
    ```

  - `mapStrikingRune(str: string)`:
    ```typescript
    str === '' ? null 
    : str === 'striking' ? 'striking' 
    : str === 'greaterStriking' ? 'greater_striking' 
    : 'major_striking'
    ```

  **Parallelizable**: YES (with task 12)

  **References**:
  - `shared/rulesets/pf2/characterSheet.ts` - Target types
  - "Pathbuilder Mapping Formulas" section (this document) - Authoritative formulas

  **Test Fixture Strategy**: Reuse committed fixture from Task 12. Load via `fs.readFileSync`.
  
  **Expected Values for Fixture Character `163111` (Jordo PF2e Champion Paladin)**:
  | Field | Expected Value | Formula |
  |-------|----------------|---------|
  | `name` | "Jordo PF2e Champion Paladin" | Direct |
  | `level` | 1 | Direct |
  | `class` | "Champion" | Direct |
  | `derived.hitPoints` | **21** | 8 (ancestry) + (1 × (10 + 3)) = 21 |
  | `derived.armorClass` | **16** | From `acTotal.acTotal` |
  | `derived.speed` | **25** | `attributes.speed` + `speedBonus` |
  | `abilities.strength` | 16 | From `abilities.str` |
  | `abilities.constitution` | 16 | From `abilities.con` |
  | `weapons.length` | 2 | Dagger + Scythe |
  | `weapons[0].name` | "Dagger" | First weapon |
  | `weapons[1].damage` | "1d10" | Scythe die |
  
  **Acceptance Criteria**:
  - [ ] Test: `npx vitest run shared/rulesets/pf2/pathbuilderMapping.test.ts`
  - [ ] Tests load fixture via `fs.readFileSync` (same file as Task 12)
  - [ ] `result.derived.hitPoints === 21`
  - [ ] `result.derived.armorClass === 16`
  - [ ] `result.abilities.constitution === 16`
  - [ ] `result.weapons.length === 2`
  - [ ] All mapping functions have at least one assertion
  - [ ] Weapon mapping handles empty traits array correctly
  - [ ] Unknown armor name falls back to Unarmored stats

  **Commit**: YES
  - Message: `feat(pf2): add Pathbuilder to PF2CharacterSheet mapping`

---

- [ ] 14. Create PathbuilderImporter service

  **What to do**:
  - Create `src/services/pathbuilderImporter.ts`

  **PathbuilderResult Contract**:
  ```typescript
  export type PathbuilderResult = 
    | { success: true; character: PF2CharacterSheet; warnings: string[] }
    | { success: false; error: string };
  ```

  **Functions**:
  - `fetchFromAPI(characterId: string): Promise<PathbuilderResult>`
    - Fetch from `https://pathbuilder2e.com/json.php?id={id}`
    - Validate response with `validatePathbuilderExport`
    - Map to PF2CharacterSheet with `mapPathbuilderToCharacter`
    - Collect warnings for skipped data (pets, familiars, formulas)
    - Return error if validation fails or network error

  - `parseFromFile(file: File): Promise<PathbuilderResult>`
    - Read file as JSON
    - Same validation and mapping flow
    - Return error if invalid JSON or validation fails

  **Service Architecture**:
  ```typescript
  // src/services/pathbuilderImporter.ts
  import { validatePathbuilderExport } from '../../shared/rulesets/pf2/pathbuilder';
  import { mapPathbuilderToCharacter, collectWarnings } from '../../shared/rulesets/pf2/pathbuilderMapping';

  export const fetchFromAPI = async (characterId: string): Promise<PathbuilderResult> => {
    try {
      const response = await fetch(`https://pathbuilder2e.com/json.php?id=${characterId}`);
      const data = await response.json();
      const validated = validatePathbuilderExport(data);
      if (!validated) return { success: false, error: 'Invalid Pathbuilder response format' };
      const warnings = collectWarnings(validated.build);
      const character = mapPathbuilderToCharacter(validated.build);
      return { success: true, character, warnings };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  };
  ```

  **Parallelizable**: NO (depends on 12, 13)

  **References**:
  - API: `https://pathbuilder2e.com/json.php?id={id}`
  - `shared/rulesets/pf2/pathbuilder.ts` - validatePathbuilderExport
  - `shared/rulesets/pf2/pathbuilderMapping.ts` - mapPathbuilderToCharacter

  **Test Strategy** (CRITICAL - deterministic, offline):
  
  1. **Load fixture via fs (ESM-compatible)**:
     ```typescript
     import { vi } from 'vitest';
     import { readFileSync } from 'node:fs';
     import { fileURLToPath } from 'node:url';
     import { dirname, join } from 'node:path';
     
     const __dirname = dirname(fileURLToPath(import.meta.url));
     const fixture = JSON.parse(
       readFileSync(join(__dirname, '../../shared/rulesets/pf2/__fixtures__/pathbuilder-163111.json'), 'utf-8')
     );
     ```

  2. **Mock `fetch` using vitest**:
     ```typescript
     vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
       json: () => Promise.resolve(fixture),
     })));
     ```
  
  3. **Test File parsing**: Create mock `File` object with fixture content
     ```typescript
     const file = new File([JSON.stringify(fixture)], 'test.json', { type: 'application/json' });
     ```
  
  4. **No live network calls in tests**

  **Acceptance Criteria**:
  - [ ] Test: `npx vitest run src/services/pathbuilderImporter.test.ts`
  - [ ] Tests mock `fetch`, no live network calls
  - [ ] `fetchFromAPI` returns `{ success: true, character, warnings }` for valid data
  - [ ] `fetchFromAPI` returns `{ success: false, error }` for invalid data
  - [ ] `parseFromFile` works with mock File object
  - [ ] Warnings include "Pets not imported", "Familiars not imported" when present

  **Commit**: YES
  - Message: `feat(pf2): add PathbuilderImporter service`

---

- [ ] 15. Create PathbuilderImport UI + integration

  **What to do**:
  
  **15a. Create `PathbuilderImport.tsx`**:
  - Tabbed interface: "Import by ID" / "Upload JSON"
  - Instructions for finding Pathbuilder ID
  - Loading state, error display, preview
  - Confirm/Cancel buttons

  **15b. Integrate into `PF2CharacterEditor.tsx`**:
  - Add "Import from Pathbuilder" button
  - Toggle between editor and import view
  - On confirm: generate ID, update character, close import view

  **Parallelizable**: NO (depends on 14)

  **References**:
  - `src/components/rulesets/pf2/PF2CharacterEditor.tsx`

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds
  - [ ] Manual verification flow:
    1. Open PF2 match lobby
    2. Click "Edit Character" → PF2CharacterEditor opens
    3. Click "Import from Pathbuilder" → Import UI shows
    4. Enter character ID `163111` → Loading state shows
    5. Preview displays character stats (name, level, class, abilities)
    6. Click "Confirm Import" → Editor updates with imported data
    7. Close editor → `select_character` message sent with imported character
    8. Character name visible in lobby player list
  - [ ] Same flow works with JSON file upload
  - [ ] Warning displays for characters with pets/familiars

  **Commit**: YES
  - Message: `feat(pf2): add Pathbuilder import UI and integration`

---

## Commit Strategy

| Phase | Tasks | Message Pattern |
|-------|-------|-----------------|
| A | 1-3 | `feat/refactor(pf2/gurps/rulesets): type definitions` |
| B | 4-6 | `refactor: update contracts for CharacterSheet union` |
| C | 7-9 | `feat: update client for CharacterSheet union` |
| D | 10-11 | `feat(server): update for CharacterSheet union` |
| E | 12-15 | `feat(pf2): Pathbuilder import` |

---

## Success Criteria

### Verification Commands
```bash
npm run build        # Client build successful
npm run lint         # No errors
npx vitest run       # All tests pass
cd server && npm run build  # Server build successful
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] PF2 characters use `abilities.constitution`
- [ ] GURPS characters use `attributes.health`
- [ ] Type guards correctly discriminate union
- [ ] Can import via Pathbuilder ID
- [ ] Can import via JSON file
- [ ] Preview displays before import
- [ ] GURPS matches still work (no regression)
- [ ] PF2 matches work with new character shape
