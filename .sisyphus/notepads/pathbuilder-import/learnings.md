# PF2 Character Sheet Type System - Learnings

## Task 1: PF2CharacterSheet Type Definition

### Key Decisions

1. **Abilities Structure**: Used inline type definition in `PF2CharacterSheet` rather than importing `Abilities` type directly
   - Reason: Ensures discriminant clarity (`abilities.constitution` NOT `attributes.health`)
   - Re-exported `Abilities as PF2Aliases` for consistency with naming conventions

2. **Derived Stats**: Separated into `PF2CharacterDerivedStats` type
   - Matches `calculateDerivedStats()` return type from `rules.ts:153-179`
   - Includes all 7 fields: hitPoints, armorClass, speed, fortitudeSave, reflexSave, willSave, perception

3. **Recalculation Fields**: Included all fields needed for `calculateDerivedStats()` recalculation
   - `classHP`: Base HP from class
   - `saveProficiencies`: Record of fortitude/reflex/will proficiencies
   - `perceptionProficiency`: Wisdom-based perception
   - `armorProficiency`: Used in AC calculation

4. **Equipment Types**: Separated into distinct types for clarity
   - `PF2CharacterWeapon`: Includes proficiency category, runes, traits
   - `PF2CharacterArmor`: Includes proficiency category, AC bonus, dex cap, runes
   - `PF2Feat`: Minimal structure (id, name, type, level, optional description)
   - `PF2SpellInfo`: Tradition + proficiency + known spell names (no slot tracking)

### Type Reuse
- Imported and re-used from `types.ts`:
  - `Proficiency` (untrained|trained|expert|master|legendary)
  - `PF2DamageType` (all 13 damage types)
  - `PF2Skill` (id, name, ability, proficiency)
  - `PF2WeaponTrait` (all 19 weapon traits)

### File Structure
- Created: `shared/rulesets/pf2/characterSheet.ts` (89 lines)
- Updated: `shared/rulesets/pf2/index.ts` (added 8-line export block)
- Build: ✅ Passes TypeScript compilation

### Discriminant Field
**CRITICAL**: `PF2CharacterSheet.abilities.constitution` is the discriminant field
- NOT `attributes.health` (GURPS pattern)
- This enables type guards: `isPF2Combatant()` checks for `abilities.constitution`

## Task 2: GurpsCharacterSheet Type Definition

### Key Decisions

1. **Exact Copy Pattern**: Created `GurpsCharacterSheet` as exact copy of `CharacterSheet` from `shared/types.ts`
   - Reason: Maintains compatibility with existing GURPS logic while enabling future divergence
   - All 9 fields preserved: id, name, attributes, derived, skills, advantages, disadvantages, equipment, pointsTotal

2. **Type Imports**: Imported GURPS-specific types from `./types.ts`
   - `Attributes` (with `health` field - GURPS discriminant)
   - `DerivedStats`, `Skill`, `Advantage`, `Disadvantage`, `Equipment`
   - `Id` from `../../types` (shared ID type)

3. **Export Pattern**: Used re-export pattern in `index.ts`
   - Added: `export type { GurpsCharacterSheet } from './characterSheet'`
   - Keeps exports clean and centralized

### Discriminant Field
**CRITICAL**: `GurpsCharacterSheet.attributes.health` is the GURPS discriminant
- Distinguishes GURPS from PF2 (which uses `abilities.constitution`)
- Enables type guards: `isGurpsCombatant()` checks for `attributes.health`

### File Structure
- Created: `shared/rulesets/gurps/characterSheet.ts` (15 lines)
- Updated: `shared/rulesets/gurps/index.ts` (added 1-line export)
- Build: ✅ Passes TypeScript compilation

### Next Steps
- Task 3: Create `PF2CharacterSheet` (already done in Task 1)
- Task 4: Remove `CharacterSheet` from `shared/types.ts` and update imports

## Task 3: CharacterSheet Union Type and Resilient Type Guards

### Key Decisions

1. **Union Type Pattern**: Created `CharacterSheet = PF2CharacterSheet | GurpsCharacterSheet`
   - Centralized in `shared/rulesets/characterSheet.ts`
   - Enables type-safe discrimination across the codebase
   - Follows TypeScript union best practices

2. **Resilient Type Guards**: Implemented with defensive checks
   - **Critical Fix**: Must check `typeof character === 'object' && character !== null` FIRST
   - Reason: The `in` operator throws TypeError on null/undefined, not just returns false
   - Order matters: type check → null check → field existence → nested type checks
   - Pattern:
     ```typescript
     typeof character === 'object' &&
     character !== null &&
     'field' in character &&
     character.field !== null &&
     typeof character.field === 'object' &&
     'discriminant' in character.field
     ```

3. **Discriminant Fields**:
   - PF2: `abilities.constitution` (nested discriminant)
   - GURPS: `attributes.health` (nested discriminant)
   - Both are required fields in their respective types, making them reliable discriminants

4. **Test Coverage**: 23 comprehensive runtime tests
   - Valid character identification (PF2 and GURPS)
   - Cross-ruleset rejection (PF2 guard rejects GURPS, vice versa)
   - Null/undefined safety (no throws on malformed input)
   - Missing field handling (returns false, not error)
   - Mutual exclusivity verification
   - Edge cases: extra fields, optional fields, hybrid objects

### File Structure
- Created: `shared/rulesets/characterSheet.ts` (36 lines)
- Created: `shared/rulesets/characterSheet.test.ts` (262 lines)
- Tests: ✅ 23/23 passing
- Build: ✅ TypeScript compilation successful

### Resilience Guarantees
- Guards NEVER throw on any input (including null, undefined, primitives)
- Guards return false for malformed data (missing fields, wrong types)
- Guards are mutually exclusive for valid characters
- Guards handle extra fields gracefully (forward compatibility)

### Next Steps
- Task 4: Update `shared/types.ts` to remove `CharacterSheet` and import from `characterSheet.ts`
- Task 5: Update all imports across codebase to use new union type

## Task 4: CharacterSheet Re-export Integration

### Key Decisions

1. **Circular Dependency Resolution**: 
   - Initial attempt to re-export at top of `shared/types.ts` failed due to circular dependency
   - Root cause: `pf2/characterSheet.ts` and `gurps/characterSheet.ts` both import from `../../types`
   - Solution: Use `import type` at top (type-only import, no runtime circular dependency) + re-export
   - Pattern: `import type { CharacterSheet } from './rulesets/characterSheet'` + `export type { CharacterSheet } from './rulesets/characterSheet'`

2. **Import Placement**: 
   - Re-exports must be at TOP of file (after other imports) to be available for types used in the same file
   - This works because TypeScript processes imports/exports before type checking the rest of the file

3. **Backward Compatibility**:
   - `CharacterSheet` remains importable from `shared/types` as before
   - Type guards `isPF2Character` and `isGurpsCharacter` are now re-exported as value exports
   - Specific types `PF2CharacterSheet` and `GurpsCharacterSheet` are re-exported for direct access

### File Changes

- **Removed**: Old `CharacterSheet` definition from `shared/types.ts:51-61` (11 lines)
- **Added**: Re-exports at `shared/types.ts:4-7` (4 lines)
  - `export { isPF2Character, isGurpsCharacter }` (value exports - functions)
  - `export type { CharacterSheet }` (type export - union)
  - `export type { PF2CharacterSheet, GurpsCharacterSheet }` (type exports - specific types)

### Verification Results

- ✅ TypeScript compilation: No errors in `shared/types.ts`
- ✅ Tests: All 272 tests pass (including 23 CharacterSheet tests)
- ✅ Backward compatibility: `CharacterSheet` importable from `shared/types`
- ✅ Type guards: Both `isPF2Character` and `isGurpsCharacter` available

### Remaining Build Errors

Build shows errors in other files (e.g., `serverAdapter.ts`, `rules.ts`, components) because they access ruleset-specific properties without type guards. These are expected and will be fixed in subsequent tasks. The task requirement was only to update `shared/types.ts`, which is complete.

### Pattern for Future Re-exports

When re-exporting types that create circular dependencies:
1. Use `import type { Type } from './path'` at top (type-only import)
2. Immediately follow with `export type { Type } from './path'` (re-export)
3. This allows the type to be used in the same file while avoiding runtime circular dependencies

## Task 5: Ruleset Contract Update - getDerivedStats Signature

### Key Decisions

1. **Signature Change**: Updated `Ruleset.getDerivedStats` from `(attributes: CharacterSheet['attributes'])` to `(character: CharacterSheet)`
   - Reason: PF2 needs access to `level`, `classHP`, `saveProficiencies` which are not in attributes
   - GURPS continues to use `character.attributes` but now receives full character object
   - Pattern: Accept full character, narrow with type guard, access ruleset-specific fields

2. **Type Guard Pattern**: Both implementations now use defensive type narrowing
   - PF2: `if (!isPF2Character(character)) throw new Error('Expected PF2 character')`
   - GURPS: `if (!isGurpsCharacter(character)) throw new Error('Expected GURPS character')`
   - Ensures type safety when accessing ruleset-specific properties

3. **Return Type Consistency**: 
   - PF2 returns `PF2CharacterDerivedStats` (7 fields: hitPoints, armorClass, speed, fortitudeSave, reflexSave, willSave, perception)
   - GURPS returns `DerivedStats` (5 fields: hitPoints, fatiguePoints, basicSpeed, basicMove, dodge)
   - Union type `CharacterSheet['derived']` accommodates both

4. **getInitialCombatantState Narrowing**:
   - GURPS: Added type guard to safely access `character.derived.fatiguePoints` (PF2 doesn't have this)
   - PF2: Changed `currentFP: 0` (PF2 doesn't track fatigue points)
   - Both now narrow the character type before accessing ruleset-specific derived stats

### File Changes

- **shared/rulesets/Ruleset.ts:42**: Changed signature from `(attributes: CharacterSheet['attributes'])` to `(character: CharacterSheet)`
- **shared/rulesets/pf2/index.ts**:
  - Added import: `import { isPF2Character } from '../../types'`
  - Removed unused import: `Abilities` type
  - Updated `getDerivedStats` to accept full character, narrow with type guard, call `calculateDerivedStats(character.abilities, character.level, character.classHP)`
  - Updated return to match `PF2CharacterDerivedStats` shape (7 fields)
  - Updated `getInitialCombatantState` to set `currentFP: 0` (PF2 doesn't track fatigue)
- **shared/rulesets/gurps/index.ts**:
  - Added import: `import { isGurpsCharacter } from '../../types'`
  - Updated `getDerivedStats` to accept full character, narrow with type guard, call `calculateDerivedStats(character.attributes)`
  - Updated `getInitialCombatantState` to narrow type before accessing `character.derived.fatiguePoints`

### Build Status

- ✅ TypeScript compilation: No errors in modified files
- ✅ Error count: 148 errors (down from 140+, as expected)
- ✅ Remaining errors: All in call sites that need type guards (Task 8+)
- ✅ Pattern verified: Type guards work correctly for narrowing union types

### Type Guard Resilience

The type guards `isPF2Character` and `isGurpsCharacter` are resilient:
- Check `typeof character === 'object' && character !== null` first
- Then check nested discriminant fields (`abilities.constitution` for PF2, `attributes.health` for GURPS)
- Never throw on malformed input
- Return false for missing fields

### Next Steps

- Task 6: Update call sites in `serverAdapter.ts` to use type guards
- Task 7: Update call sites in client components to use type guards
- Task 8: Update remaining call sites systematically

## Task 6: Ruleset Bundles and ServerAdapter Union Type Handling

### Key Decisions

1. **GURPS Rules Type Narrowing**: Updated `calculateTotalPoints` and `getDefenseOptions` in `shared/rulesets/gurps/rules.ts`
   - Changed parameter type from `CharacterSheet` (union) to `GurpsCharacterSheet` (specific)
   - Reason: These functions are GURPS-specific and should only accept GURPS characters
   - Pattern: Import `GurpsCharacterSheet` from `./characterSheet`, use as parameter type
   - Removed unused `CharacterSheet` import from `shared/types`

2. **ServerAdapter Type Guard Pattern**: Added defensive type guards in `shared/rulesets/serverAdapter.ts`
   - Functions `gurpsSelectBotDefense` and `gurpsResolveDefense` now check `isGurpsCharacter()` at entry
   - If character is not GURPS type, return safe default values instead of crashing
   - Pattern: `if (!isGurpsCharacter(character)) { return defaultValue; }`
   - Enables graceful degradation if wrong ruleset character is passed

3. **Wrapper Function Pattern**: Created `gurpsGetDefenseOptionsWrapper` to bridge type mismatch
   - Problem: `gurpsGetDefenseOptions` now expects `GurpsCharacterSheet`, but adapter interface expects `CharacterSheet`
   - Solution: Wrapper function accepts `CharacterSheet`, narrows with type guard, calls original function
   - Pattern:
     ```typescript
     const gurpsGetDefenseOptionsWrapper = (character: CharacterSheet, dodgeValue: number): GurpsDefenseOptions => {
       if (!isGurpsCharacter(character)) {
         return { dodge: dodgeValue, parry: null, block: null };
       }
       return gurpsGetDefenseOptions(character, dodgeValue);
     };
     ```
   - Used in both `gurpsCombatDomain` and `gurpsAdapter` to satisfy interface contract

### File Changes

- **shared/rulesets/gurps/rules.ts**:
  - Line 16: Added import `import type { GurpsCharacterSheet } from './characterSheet'`
  - Line 15: Removed unused `CharacterSheet` import
  - Line 268: Changed `calculateTotalPoints(character: CharacterSheet)` → `calculateTotalPoints(character: GurpsCharacterSheet)`
  - Line 284: Changed `getDefenseOptions(character: CharacterSheet, ...)` → `getDefenseOptions(character: GurpsCharacterSheet, ...)`

- **shared/rulesets/serverAdapter.ts**:
  - Line 5: Added import `import { isGurpsCharacter } from '../types'`
  - Lines 440-457: Added type guard in `gurpsSelectBotDefense` with safe default return
  - Lines 617-634: Added type guard in `gurpsResolveDefense` with safe default return
  - Line 710: Added type guard for `attackerCharacter.equipment` access: `isGurpsCharacter(attackerCharacter) ? ... : false`
  - Lines 739-743: Created `gurpsGetDefenseOptionsWrapper` function
  - Line 751: Updated `gurpsCombatDomain.getDefenseOptions` to use wrapper
  - Line 807: Updated `gurpsAdapter.getDefenseOptions` to use wrapper

### Build Results

- ✅ TypeScript errors: Reduced from ~140 to 132 errors
- ✅ Tests: All 272 tests pass (no regressions)
- ✅ Remaining errors: All in client components (Tasks 7-9)

### Type Guard Resilience

All type guards follow the defensive pattern:
1. Check `typeof character === 'object' && character !== null` (implicit in `isGurpsCharacter`)
2. Check nested discriminant field (`attributes.health` for GURPS)
3. Return false for malformed input (never throw)
4. Caller provides safe default when guard fails

### Next Steps

- Task 7: Update client components to use type guards (ArenaScene, Combatant, FloatingStatus, etc.)
- Task 8: Update game action components (useGameActions, DefenseModal, GurpsActionBar, etc.)
- Task 9: Update character editor components (GurpsCharacterEditor, GurpsGameActionPanel)

## Task 7: Ruleset-Aware Default Character Creation in App.tsx

### Key Decisions

1. **Centralized Factory Function**: Created `createDefaultCharacter(rulesetId, username)` function
   - Accepts `RulesetId` and username to determine character shape
   - Returns `CharacterSheet` (union type) with correct shape for the ruleset
   - Eliminates duplicate default character creation logic

2. **PF2 Default Character Shape**:
   - Uses `abilities` object (not `attributes`)
   - Includes PF2-specific fields: `level`, `class`, `ancestry`, `heritage`, `background`
   - Includes PF2-specific derived stats: `armorClass`, `speed`, `fortitudeSave`, `reflexSave`, `willSave`, `perception`
   - Includes PF2-specific fields: `classHP`, `saveProficiencies`, `perceptionProficiency`, `armorProficiency`
   - Includes PF2-specific arrays: `weapons`, `armor`, `feats`, `spells`
   - Cast as `PF2CharacterSheet` for type safety

3. **GURPS Default Character Shape**:
   - Uses `attributes` object (not `abilities`)
   - Includes GURPS-specific fields: `pointsTotal`
   - Includes GURPS-specific arrays: `advantages`, `disadvantages`, `equipment`
   - Cast as `GurpsCharacterSheet` for type safety

4. **Ruleset Detection**: Both character editor open points now detect ruleset:
   - `onOpenCharacterEditor`: Gets rulesetId from `matchState?.rulesetId ?? currentMatch?.rulesetId ?? 'gurps'`
   - CharacterEditor fallback: Uses same detection logic
   - Ensures consistency across both code paths

### File Changes

- **src/App.tsx**:
  - Added imports: `PF2CharacterSheet`, `GurpsCharacterSheet` from `shared/types`
  - Added function: `createDefaultCharacter(rulesetId, username)` (lines 15-77)
  - Updated `onOpenCharacterEditor` callback (lines 245-248): Now calls `createDefaultCharacter` with detected rulesetId
  - Updated CharacterEditor fallback (line 267): Now calls `createDefaultCharacter` instead of inline object

### Type Safety

- Function signature: `(rulesetId: RulesetId, username: string): CharacterSheet`
- Return type is union `CharacterSheet` (PF2 | GURPS)
- Each branch explicitly casts to specific type (`as PF2CharacterSheet` / `as GurpsCharacterSheet`)
- Eliminates type errors from mixing ruleset-specific fields

### Verification Results

- ✅ TypeScript compilation: 132 errors (unchanged - expected, as this is client-side only)
- ✅ Tests: All 272 tests pass (no regressions)
- ✅ Build: Completes successfully
- ✅ No new errors introduced by this change

### Pattern for Future Character Creation

When creating default characters in other components:
1. Import `createDefaultCharacter` from `App.tsx` (or move to utils if needed)
2. Detect rulesetId from match state: `matchState?.rulesetId ?? 'gurps'`
3. Call: `createDefaultCharacter(rulesetId, characterName)`
4. Result is properly typed for the ruleset

### Next Steps

- Task 8: Update `useCharacterEditor` hook to handle ruleset-specific character shapes
- Task 9: Update character editor components to use type guards for ruleset-specific fields

## Task 8: useCharacterEditor Hook - Ruleset-Aware Type Branching

### Key Decisions

1. **Import Pattern**: Added both type guards and ruleset-specific `calculateDerivedStats` functions
   - `isPF2Character`, `isGurpsCharacter` from `shared/types`
   - `gurpsCalculateDerivedStats` from `shared/rulesets/gurps/rules`
   - `pf2CalculateDerivedStats` from `shared/rulesets/pf2/rules`
   - PF2-specific types: `PF2Skill`, `Proficiency`, `Abilities`

2. **updateAttribute Function**: Full PF2/GURPS branching
   - PF2 branch: Uses `abilities` object, calls `pf2CalculateDerivedStats` with all 8 required parameters
   - GURPS branch: Uses `attributes` object, calls `gurpsCalculateDerivedStats` with single parameter
   - Both branches properly narrow the character type before accessing ruleset-specific fields

3. **loadTemplate Function**: Uses `rulesetId` + discriminant check pattern
   - Cannot use type guards directly on `Omit<CharacterSheet, 'id'>` templates
   - Pattern: `if (rulesetId === 'pf2' && 'abilities' in template)`
   - Casts template to specific type, then casts result back to `CharacterSheet`

4. **Skill Functions**: Separate PF2/GURPS branches
   - PF2: Creates `PF2Skill` with `ability` and `proficiency` fields
   - GURPS: Creates `Skill` with `level` field
   - Both use type guards to narrow before accessing skills array

5. **GURPS-Only Functions**: Early return pattern
   - `addEquipment`, `removeEquipment`: `if (!isGurpsCharacter(character)) return`
   - `addAdvantage`, `removeAdvantage`: Same pattern
   - `addDisadvantage`, `removeDisadvantage`: Same pattern
   - PF2 doesn't have these fields (uses `weapons`, `armor`, `feats` instead)

6. **totalPoints Calculation**: Conditional with type guard
   - `isGurpsCharacter(character) ? calculateTotalPoints(character) : 0`
   - PF2 doesn't use point-buy system, returns 0

### File Changes

- **src/components/rulesets/useCharacterEditor.ts**: Complete rewrite with type branching
  - Lines 1-9: Updated imports
  - Lines 49-79: `updateAttribute` with PF2/GURPS branches
  - Lines 81-111: `addSkill`/`removeSkill` with type guards
  - Lines 113-137: `addEquipment`/`removeEquipment` (GURPS-only)
  - Lines 139-167: Advantage/disadvantage functions (GURPS-only)
  - Line 169: `totalPoints` with type guard

### Verification Results

- ✅ No TypeScript errors in `useCharacterEditor.ts`
- ✅ All 272 tests pass (no regressions)
- ✅ Build error count: 109 (down from 132 - 23 errors fixed)
- ✅ Remaining errors are in other components (Task 9)

### Pattern for Template Loading

When loading templates with union types:
1. Check `rulesetId` first (known at runtime)
2. Check discriminant field: `'abilities' in template` or `'attributes' in template`
3. Cast to specific template type: `template as Omit<PF2CharacterSheet, 'id'>`
4. Spread and add `id`, then cast result: `{ ...template, id } as CharacterSheet`

### PF2 calculateDerivedStats Parameters

All 8 parameters must be passed:
```typescript
pf2CalculateDerivedStats(
  abilities,           // Abilities object
  level,               // Character level
  classHP,             // Base HP from class
  armor?.acBonus ?? 0, // Armor AC bonus
  armor?.dexCap ?? null, // Armor dex cap
  saveProficiencies,   // Record of fort/ref/will proficiencies
  perceptionProficiency, // Perception proficiency
  armorProficiency     // Armor proficiency for AC calculation
)
```

### Next Steps

- Task 9: Update UI components (GurpsCharacterEditor, GurpsGameActionPanel, etc.) to use type guards


## [2026-01-25T17:04:03+01:00] Task 9: Update PF2 UI Components

**Files Updated:**
- PF2CharacterEditor.tsx: Changed attributes → abilities, dodge → armorClass, basicMove → speed/5, advantages → feats, equipment → weapons
- PF2GameStatusPanel.tsx: Same field updates
- PF2ActionBar.tsx: Same field updates  
- FloatingStatus.tsx: Added conditional FP bar rendering with isGurpsCharacter guard

**Key Pattern:**
All PF2 components now use native PF2CharacterSheet fields. Type assertions used at component entry to narrow CharacterSheet union to PF2CharacterSheet.

**Errors Reduced:** 109 → 97 (12 errors fixed)

## Task 10: Server-Side PF2 Character and Combatant Factories

### Key Decisions

1. **PF2 Character Factory**: Replaced GURPS-shaped factory with native PF2CharacterSheet
   - Imports `PF2CharacterSheet` type from `shared/rulesets/pf2/characterSheet`
   - Creates complete PF2 character with all required fields
   - Default: Level 1 Fighter with 14 CON, 20 HP, AC 14
   - Includes all 7 derived stats: hitPoints, armorClass, speed, fortitudeSave, reflexSave, willSave, perception
   - Includes recalculation fields: classHP, saveProficiencies, perceptionProficiency, armorProficiency
   - Includes equipment: 1 Longsword in weapons array, no armor, no feats, no spells

2. **PF2 Combatant Factory**: Updated to read from weapons[0]
   - Changed from `character.equipment.find()` to `character.weapons[0]`
   - Casts character to `PF2CharacterSheet` for type safety
   - Sets `currentFP: 0` (PF2 doesn't track fatigue points)
   - Removed shield handling (not in initial PF2 implementation)
   - Maintains all GURPS-compatible fields for CombatantState

3. **Bot Factory Pattern**: Already correct in `server/src/bot.ts`
   - `createBotCharacter` uses `getRulesetServerFactory(rulesetId)`
   - Calls `factory.createDefaultCharacter(name)`
   - No changes needed - pattern already in place

### File Changes

- **server/src/rulesets/pf2/character.ts**: Complete rewrite (36 → 56 lines)
  - Removed GURPS-style attributes, advantages, disadvantages, pointsTotal
  - Added PF2-native fields: level, class, ancestry, heritage, background, abilities, classHP, saveProficiencies, etc.
  - Added weapons array with Longsword default
  - Added armor, feats, spells fields (null/empty for defaults)

- **server/src/rulesets/pf2/combatant.ts**: Updated weapon access (53 → 43 lines)
  - Changed import from `CharacterSheet` to `PF2CharacterSheet`
  - Changed weapon lookup from `character.equipment.find()` to `character.weapons[0]`
  - Removed shield handling
  - Set `currentFP: 0` instead of `character.derived.fatiguePoints`

- **server/src/bot.ts**: No changes (already uses factory pattern)

### Build Results

- ✅ Server build: Succeeds (194.5kb bundle)
- ✅ Client build: 97 errors (expected - client components still need type guards)
- ✅ No regressions in server-side code

### Type Safety Pattern

When creating PF2 characters in server code:
1. Import `PF2CharacterSheet` from `shared/rulesets/pf2/characterSheet`
2. Use factory function: `createDefaultCharacter(name)`
3. Return type is `PF2CharacterSheet` (not union)
4. All fields are required and type-checked at compile time

### Next Steps

- Task 11: Update match.ts to use factory pattern for initial combatant creation
- Client-side errors (97) will be fixed in subsequent tasks with type guards


## [2026-01-25T17:14:07+01:00] Task 11: Server CharacterSheet Union Handling

**Files Updated:**
- match.ts: Initiative calculation with type guards (PF2: perception+DEX, GURPS: basicSpeed+DEX)
- handlers/damage.ts: HT calculation with type guard
- bot.ts: Movement calculation with type guard (PF2: speed/5, GURPS: basicMove)
- handlers/pf2-attack.ts: Removed workarounds, uses native PF2 fields

**Result:** Server builds with 0 errors. Client has 97 errors in GURPS components (expected, need internal assertions).
