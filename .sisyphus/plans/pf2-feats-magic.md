# PF2 Feats & Magic Completion (Data-Driven with Dynamic Fetch)

## TL;DR

> **Quick Summary**: Fetch PF2 feat/spell data from Pf2ools GitHub at runtime, implement feat effects framework, and add spell casting UI to ActionBar with heightening and area spell support.
> 
> **Deliverables**:
> - Dynamic Pf2ools data fetcher (fetch at server startup, file cache, local fallback)
> - Feat effect framework with data-driven definitions
> - 8 combat feat effects (AoO, Shield Block, Power Attack, etc.)
> - Spell casting UI in mobile ActionBar
> - Spell heightening mechanics (from Pf2ools data)
> - Burst area spell targeting and resolution
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 (Data Fetcher) → Task 2 (Feat Parser) → Task 4 (AoO fix) → Tasks 5-11 (feats) → Tasks 12-15 (Magic UI)
> 
> **Data Architecture**:
> ```
> Server Startup → Check Cache → Fresh? Use it : Fetch GitHub
>                                         ↓
>                              Success? Save cache, use data
>                              Fail? Use stale cache OR empty array (graceful degradation)
> ```
> 
> **No data files committed to repo** - everything is fetched dynamically and cached locally.

---

## Context

### Original Request
Complete PF2 Feats system (currently storage-only with zero combat effects) and PF2 Magic UI (backend exists but no UI for spell casting).

### Interview Summary
**Key Discussions**:
- Feats: Create framework + 8 example feats with combat effects
- Magic UI: Integrate in ActionBar with "Cast Spell" button
- Include spell heightening mechanics
- Include area spell resolution (burst shape)
- TDD approach for all mechanics
- **Data Source**: Pf2ools Data (NOT hardcoded)

**Research Findings**:
- `PF2Feat` type exists but minimal: `{ id, name, type, level, description }`
- Feats saved on character but have NO effect in combat
- **Critical**: AoO currently works for ALL combatants, not just feat holders!
- 8 spells exist in database with full definitions
- **Pf2ools Data**: JSON bundles available with full feat/spell definitions
  - MIT licensed, actively maintained (2026)
  - Same content as Archives of Nethys
  - Structured schema with Zod validation

### Metis Review
**Identified Gaps** (addressed):
- AoO not feat-gated: Will add `hasFeat()` check to `getAoOReactors()`
- Area shapes scope: Limiting to burst only (Fireball)
- Desktop UI: Out of scope, mobile ActionBar first
- Data source: Using Pf2ools instead of hardcoding

---

## Work Objectives

### Core Objective
Import PF2 data from Pf2ools, make feats mechanically functional in combat, and enable spell casting through the game UI.

### Concrete Deliverables
- `data/pf2ools/` - Pf2ools data bundles (git submodule or copied)
- `shared/rulesets/pf2/pf2oolsParser.ts` - Parser for Pf2ools JSON format
- `shared/rulesets/pf2/featData.ts` - Parsed feat definitions
- `shared/rulesets/pf2/feats.ts` - Feat effect framework and combat integration
- `shared/rulesets/pf2/feats.test.ts` - TDD tests for feat effects
- Modified `server/src/handlers/pf2/reaction.ts` - AoO feat-gating, Shield Block
- Modified `server/src/handlers/pf2/attack.ts` - Power Attack, Intimidating Strike, etc.
- `src/components/rulesets/pf2/PF2ActionBar.tsx` - Spell casting UI
- `src/components/rulesets/pf2/SpellPicker.tsx` - Spell selection component
- Modified `shared/rulesets/pf2/spellData.ts` - Heightening from Pf2ools
- Modified `server/src/handlers/pf2/spell.ts` - Area spell resolution

### Definition of Done
- [ ] `npx vitest run --grep "pf2"` passes (all PF2 tests)
- [ ] `npm run lint` passes
- [ ] Feat data imported from Pf2ools JSON
- [ ] All 8 feats have working combat effects with tests
- [ ] Spell casting works from ActionBar for single-target and burst spells
- [ ] Spell heightening uses Pf2ools data
- [ ] AoO only triggers for combatants with Attack of Opportunity feat

### Must Have
- Pf2ools data integration (feat.json, spell.json bundles)
- Feat parser for Pf2ools → combat-sim format
- Feat effect framework with `hasFeat()` helper
- 8 feat effect implementations
- Spell casting button in ActionBar
- Spell picker with slot display
- Burst area targeting for Fireball
- Heightening from Pf2ools spell data

### Must NOT Have (Guardrails)
- ❌ More than 8 feat effects - stick to the list
- ❌ Import ALL Pf2ools feats - only parse what we need for effects
- ❌ Feat prerequisite validation - Pathbuilder handles this
- ❌ Focus spell casting - regular slots only
- ❌ Desktop spell UI (GameActionPanel) - mobile ActionBar first
- ❌ Cone, line, emanation shapes - burst only
- ❌ Multi-caster support in spell picker
- ❌ Spell preparation/management UI

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (vitest configured)
- **User wants tests**: TDD
- **Framework**: vitest

### TDD Workflow
Each TODO follows RED-GREEN-REFACTOR:
1. **RED**: Write failing test first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping green

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Data Infrastructure):
├── Task 1: Setup Pf2ools data access
├── Task 2: Create Pf2ools feat parser
└── Task 3: Create Pf2ools spell parser (heightening)

Wave 2 (Feat Framework + Core):
├── Task 4: Feat effect framework + AoO fix (CRITICAL)
├── Task 5: Shield Block reaction
├── Task 6: Reactive Shield reaction
└── Task 13: Spell picker component

Wave 3 (Remaining Feats + Spell UI):
├── Task 7: Power Attack
├── Task 8: Sudden Charge
├── Task 9: Intimidating Strike
├── Task 10: Combat Grab
├── Task 11: Knockdown
├── Task 14: Cast Spell button in ActionBar
└── Task 15: Burst area spell resolution

Wave 4 (Integration):
└── Task 16: Integration testing and polish
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 (Data Setup) | None | 2, 3 | None |
| 2 (Feat Parser) | 1 | 4-11 | 3 |
| 3 (Spell Parser) | 1 | 15 | 2 |
| 4 (Framework+AoO) | 2 | 5-11, 16 | 13 |
| 5 (Shield Block) | 4 | 16 | 6, 13 |
| 6 (Reactive Shield) | 4 | 16 | 5, 13 |
| 7-11 (Feats) | 4 | 16 | Each other, 14, 15 |
| 13 (SpellPicker) | None | 14 | 4, 5, 6 |
| 14 (ActionBar) | 13 | 15, 16 | 7-11 |
| 15 (Area Spells) | 3, 14 | 16 | 7-11 |
| 16 (Integration) | All | None | None |

---

## TODOs

### PHASE 0: DATA INFRASTRUCTURE

- [x] 1. Create Pf2ools dynamic data fetcher

  **What to do**:
  - Create `server/src/data/pf2oolsFetcher.ts` with:
    - `fetchPf2oolsData(type: 'feat' | 'spell'): Promise<unknown[]>` - main fetcher
    - `PF2OOLS_BASE_URL` constant pointing to GitHub raw content
    - File cache in `data/cache/` (auto-created, gitignored)
    - Cache freshness check (e.g., 24h TTL)
    - Graceful degradation if fetch fails and no cache
  - Add `data/cache/` to `.gitignore`
  - Call fetcher at server startup in `server/src/index.ts`
  - Log warning if data unavailable (server continues, feat effects disabled)

  **Architecture**:
  ```typescript
  // server/src/data/pf2oolsFetcher.ts
  
  const PF2OOLS_BASE = 'https://raw.githubusercontent.com/Pf2ools/pf2ools-data/master/bundles/byDatatype/core';
  const CACHE_DIR = 'data/cache';
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  
  export async function fetchPf2oolsData(type: 'feat' | 'spell'): Promise<unknown[]> {
    const cacheFile = `${CACHE_DIR}/pf2ools-${type}.json`;
    
    // 1. Check cache (use even if stale as fallback)
    const cachedData = await tryReadCache(cacheFile);
    
    // 2. If cache is fresh, use it
    if (cachedData && isCacheFresh(cacheFile)) {
      return cachedData;
    }
    
    // 3. Try fetch from GitHub
    try {
      const data = await fetch(`${PF2OOLS_BASE}/${type}.json`).then(r => r.json());
      await writeCache(cacheFile, data);
      return data;
    } catch (error) {
      // 4. If fetch fails, use stale cache if available
      if (cachedData) {
        console.warn(`Pf2ools fetch failed, using stale cache: ${error}`);
        return cachedData;
      }
      // 5. No cache, no fetch = graceful degradation
      console.error(`Pf2ools data unavailable, feat effects disabled: ${error}`);
      return [];
    }
  }
  ```

  **Graceful Degradation**:
  - Se dati non disponibili → `FEAT_DATABASE` vuoto
  - `hasFeat()` ritorna sempre `false` → nessun feat effect attivo
  - Server funziona, combat funziona, ma senza feat speciali

  **Must NOT do**:
  - Committare file dati nel repo
  - Bloccare il server se dati non disponibili
  - Fetch ad ogni request (solo a startup)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Network fetching + file I/O + caching logic, moderate complexity
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (foundational)
  - **Parallel Group**: Wave 1 (first)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None

  **References**:
  - `https://raw.githubusercontent.com/Pf2ools/pf2ools-data/master/bundles/byDatatype/core/feat.json` - Feat data URL
  - `https://raw.githubusercontent.com/Pf2ools/pf2ools-data/master/bundles/byDatatype/core/spell.json` - Spell data URL
  - `server/src/index.ts` - Server entry point to call fetcher
  - Node.js `fs/promises` for file I/O

  **Acceptance Criteria**:

  **TDD Tests** (`server/src/data/pf2oolsFetcher.test.ts`):
  - [ ] Test: `fetchPf2oolsData returns feat array from GitHub` (mock fetch)
  - [ ] Test: `fetchPf2oolsData uses cache when fresh`
  - [ ] Test: `fetchPf2oolsData uses stale cache when fetch fails`
  - [ ] Test: `fetchPf2oolsData returns empty array when no cache and fetch fails`
  - [ ] Test: `cache is written after successful fetch`

  **Automated Verification**:
  ```bash
  # Agent runs:
  npx vitest run server/src/data/pf2oolsFetcher.test.ts
  # Assert: All tests pass
  
  # Verify cache is gitignored
  grep "data/cache" .gitignore
  # Assert: Found in gitignore
  
  # Verify no data files committed
  ls data/
  # Assert: Only cache/ directory (empty or gitignored)
  ```

  **Commit**: YES
  - Message: `feat(pf2): add dynamic Pf2ools data fetcher with file cache`
  - Files: `server/src/data/pf2oolsFetcher.ts`, `server/src/data/pf2oolsFetcher.test.ts`, `.gitignore`

---

- [x] 2. Create Pf2ools feat parser

  **What to do**:
  - Create `shared/rulesets/pf2/pf2oolsParser.ts` with:
    - `Pf2oolsFeat` interface matching Pf2ools schema
    - `parsePf2oolsFeat(raw: Pf2oolsFeat): PF2FeatDefinition` converter
    - `loadFeatsFromPf2ools(): Map<string, PF2FeatDefinition>` loader
  - Create `shared/rulesets/pf2/featData.ts`:
    - Import and parse the 8 target feats from Pf2ools
    - Export `FEAT_DATABASE: Map<string, PF2FeatDefinition>`
  - Write tests first (TDD)

  **Pf2ools Feat Schema** (from research):
  ```typescript
  interface Pf2oolsFeat {
    type: 'feat';
    name: { display: string; specifier?: string };
    data: {
      level: number;
      traits: string[];
      actionCost?: { actions: number };
      prerequisites?: string[];
      description: string;
    };
    tags: { source: { title: string; page: number } };
  }
  ```

  **Must NOT do**:
  - Parse ALL feats (only the 8 we need for effects)
  - Implement feat effects in this task (just data parsing)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Data parsing, clear input/output
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 3)
  - **Blocks**: Tasks 4-11
  - **Blocked By**: Task 1

  **References**:
  - `data/pf2ools/feat.json` - Source data (from Task 1)
  - `https://github.com/Pf2ools/pf2ools-schema` - Schema documentation
  - `shared/rulesets/pf2/types.ts:PF2Feat` - Target type to extend

  **Acceptance Criteria**:

  **TDD Tests** (`shared/rulesets/pf2/pf2oolsParser.test.ts`):
  - [ ] Test: `parsePf2oolsFeat converts Pf2ools format to PF2FeatDefinition`
  - [ ] Test: `loadFeatsFromPf2ools loads Attack of Opportunity`
  - [ ] Test: `loadFeatsFromPf2ools loads all 8 target feats`
  - [ ] Test: `parsed feat has correct level, traits, actionCost`

  **Automated Verification**:
  ```bash
  npx vitest run shared/rulesets/pf2/pf2oolsParser.test.ts
  # Assert: All tests pass
  ```

  **Commit**: YES
  - Message: `feat(pf2): add Pf2ools feat parser and data loader`
  - Files: `shared/rulesets/pf2/pf2oolsParser.ts`, `shared/rulesets/pf2/pf2oolsParser.test.ts`, `shared/rulesets/pf2/featData.ts`

---

- [x] 3. Create Pf2ools spell parser (heightening)

  **What to do**:
  - Extend `shared/rulesets/pf2/pf2oolsParser.ts` with:
    - `Pf2oolsSpell` interface
    - `parseSpellHeightening(raw: Pf2oolsSpell): HeightenData` extractor
  - Update `shared/rulesets/pf2/spellData.ts`:
    - Add `heighten` field to existing spells based on Pf2ools data
    - Parse heightening rules for: Electric Arc, Fireball, Heal, Magic Missile
  - Write tests first (TDD)

  **Pf2ools Spell Heightening Format** (expected):
  ```typescript
  interface Pf2oolsSpell {
    data: {
      heightening?: {
        type: 'interval' | 'fixed';
        interval?: number;  // e.g., 1 = every level
        damage?: string;    // e.g., '+1d4'
        levels?: Record<number, { damage?: string }>;
      };
    };
  }
  ```

  **Must NOT do**:
  - Rewrite entire spellData.ts
  - Add new spells (enhance existing 8)
  - Implement heightening UI (just data)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Data parsing extension
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 15
  - **Blocked By**: Task 1

  **References**:
  - `data/pf2ools/spell.json` - Source data
  - `shared/rulesets/pf2/spellData.ts` - Existing spell definitions
  - PF2 SRD: Electric Arc (+1d4/level), Fireball (+2d6/level)

  **Acceptance Criteria**:

  **TDD Tests**:
  - [ ] Test: `parseSpellHeightening extracts interval scaling`
  - [ ] Test: `Electric Arc heightening adds +1d4 per level`
  - [ ] Test: `Fireball heightening adds +2d6 per level`
  - [ ] Test: `getHeightenedDamage(spell, castLevel) returns scaled formula`

  **Automated Verification**:
  ```bash
  npx vitest run shared/rulesets/pf2/spells.test.ts -t "heighten"
  # Assert: All heightening tests pass
  ```

  **Commit**: YES
  - Message: `feat(pf2): add spell heightening data from Pf2ools`
  - Files: `shared/rulesets/pf2/pf2oolsParser.ts`, `shared/rulesets/pf2/spellData.ts`, `shared/rulesets/pf2/spells.test.ts`

---

### PHASE 1: FEAT FRAMEWORK

- [x] 4. Create feat effect framework + Gate AoO (CRITICAL)

  **What to do**:
  - Create `shared/rulesets/pf2/feats.ts` with:
    - `PF2FeatEffect` type: `{ type: 'reaction' | 'action' | 'modifier', handler: string }`
    - `FEAT_EFFECTS: Map<string, PF2FeatEffect>` - maps feat name → effect config
    - `hasFeat(character: PF2CharacterSheet, featName: string): boolean` helper
    - `getFeatEffect(featName: string): PF2FeatEffect | undefined` lookup
  - Modify `server/src/handlers/pf2/reaction.ts`:
    - Import `hasFeat` from feat framework
    - In `getAoOReactors()`, add check: `hasFeat(character, 'Attack of Opportunity')`
    - Only return combatants who have the feat
  - Use feat data from `featData.ts` (Task 2) for metadata
  - Write tests first (TDD)

  **Must NOT do**:
  - Create generic effect execution engine
  - Implement all feat effects (just AoO in this task)
  - Break existing AoO tests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Framework + critical bug fix, moderate complexity
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 13)
  - **Blocks**: Tasks 5-11, 16
  - **Blocked By**: Task 2

  **References**:
  - `shared/rulesets/pf2/featData.ts` - Parsed feat definitions (from Task 2)
  - `server/src/handlers/pf2/reaction.ts:153-168` - `getAoOReactors()` to fix
  - `shared/rulesets/pf2/conditions.ts:41-70` - Modifier pattern to follow
  - `server/src/handlers/pf2/reaction.test.ts` - Existing AoO tests

  **Acceptance Criteria**:

  **TDD Tests** (`shared/rulesets/pf2/feats.test.ts`):
  - [ ] Test: `hasFeat returns true when character has feat`
  - [ ] Test: `hasFeat returns false when character lacks feat`
  - [ ] Test: `getFeatEffect returns effect config for Attack of Opportunity`
  - [ ] Test: `AoO only triggers for combatants with the feat`
  - [ ] Test: `AoO does NOT trigger for combatants without the feat`

  **Automated Verification**:
  ```bash
  npx vitest run shared/rulesets/pf2/feats.test.ts
  # Assert: All tests pass
  
  npx vitest run server/src/handlers/pf2/reaction.test.ts -t "AoO"
  # Assert: All AoO tests pass including feat-gating
  ```

  **Commit**: YES
  - Message: `feat(pf2): add feat effect framework and gate AoO behind feat`
  - Files: `shared/rulesets/pf2/feats.ts`, `shared/rulesets/pf2/feats.test.ts`, `server/src/handlers/pf2/reaction.ts`, `server/src/handlers/pf2/reaction.test.ts`

---

- [x] 5. Implement Shield Block reaction

  **What to do**:
  - Add Shield Block effect to `FEAT_EFFECTS` in `feats.ts`
  - Create `handleShieldBlockReaction()` in `server/src/handlers/pf2/reaction.ts`:
    - Reduce incoming damage by shield hardness (from character's shield data)
    - Apply remaining damage to shield HP
    - Check for shield break (HP ≤ 0)
  - Integrate with damage application flow
  - Write tests first (TDD)

  **Must NOT do**:
  - Implement shield repair
  - Add shield management UI
  - Over-engineer shield system

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Reaction handler following existing patterns
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 6, 13)
  - **Blocks**: Task 16
  - **Blocked By**: Task 4

  **References**:
  - `shared/rulesets/pf2/feats.ts` - Feat framework (Task 4)
  - `shared/rulesets/pf2/types.ts:PF2CombatantState.shieldRaised` - Shield state
  - `shared/rulesets/pf2/characterSheet.ts:PF2CharacterArmor` - Shield hardness data
  - PF2 SRD: Shield Block reduces damage by Hardness, shield takes remaining

  **Acceptance Criteria**:

  **TDD Tests**:
  - [ ] Test: `Shield Block reduces damage by shield hardness`
  - [ ] Test: `Shield takes damage equal to (original - hardness)`
  - [ ] Test: `Shield Block only available if shield raised`
  - [ ] Test: `Shield Block requires Shield Block feat`
  - [ ] Test: `Shield breaks when HP reaches 0`

  **Automated Verification**:
  ```bash
  npx vitest run server/src/handlers/pf2/reaction.test.ts -t "Shield Block"
  # Assert: All Shield Block tests pass
  ```

  **Commit**: YES
  - Message: `feat(pf2): implement Shield Block reaction`
  - Files: `server/src/handlers/pf2/reaction.ts`, `server/src/handlers/pf2/reaction.test.ts`, `shared/rulesets/pf2/feats.ts`

---

- [x] 6. Implement Reactive Shield reaction

  **What to do**:
  - Add Reactive Shield effect to `FEAT_EFFECTS`
  - Create reaction handler that raises shield before attack resolves
  - Offer reaction opportunity during attack flow
  - Write tests first (TDD)

  **Must NOT do**:
  - Change existing Raise Shield action
  - Add complex timing beyond "before attack resolves"

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Similar to Shield Block
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 13)
  - **Blocks**: Task 16
  - **Blocked By**: Task 4

  **References**:
  - `server/src/handlers/pf2/reaction.ts` - Reaction patterns
  - `shared/rulesets/pf2/types.ts:PF2CombatantState.shieldRaised` - Shield state
  - PF2 SRD: Reactive Shield = Raise Shield as reaction

  **Acceptance Criteria**:

  **TDD Tests**:
  - [ ] Test: `Reactive Shield raises shield as reaction`
  - [ ] Test: `Reactive Shield only when shield not already raised`
  - [ ] Test: `Reactive Shield requires the feat`
  - [ ] Test: `AC bonus applies after Reactive Shield`

  **Automated Verification**:
  ```bash
  npx vitest run server/src/handlers/pf2/reaction.test.ts -t "Reactive Shield"
  # Assert: All tests pass
  ```

  **Commit**: YES
  - Message: `feat(pf2): implement Reactive Shield reaction`
  - Files: `server/src/handlers/pf2/reaction.ts`, `server/src/handlers/pf2/reaction.test.ts`, `shared/rulesets/pf2/feats.ts`

---

- [x] 7. Implement Power Attack

  **What to do**:
  - Add Power Attack effect to `FEAT_EFFECTS`
  - Create action handler: 2 actions, adds damage die, counts as 2 for MAP
  - Read feat data from `featData.ts` for action cost
  - Integrate with router
  - Write tests first (TDD)

  **Must NOT do**:
  - Change existing Strike action
  - Add UI (ActionBar handles later)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: New action type, moderate complexity
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8-11, 14, 15)
  - **Blocks**: Task 16
  - **Blocked By**: Task 4

  **References**:
  - `shared/rulesets/pf2/featData.ts` - Feat metadata (actionCost: 2)
  - `server/src/handlers/pf2/attack.ts` - Strike logic
  - PF2 SRD: Power Attack = 2 actions, +1 damage die, counts as 2 attacks

  **Acceptance Criteria**:

  **TDD Tests**:
  - [ ] Test: `Power Attack costs 2 actions`
  - [ ] Test: `Power Attack adds extra damage die`
  - [ ] Test: `Power Attack counts as 2 attacks for MAP`
  - [ ] Test: `Power Attack requires the feat`

  **Automated Verification**:
  ```bash
  npx vitest run server/src/handlers/pf2/attack.test.ts -t "Power Attack"
  # Assert: All tests pass
  ```

  **Commit**: YES
  - Message: `feat(pf2): implement Power Attack action`
  - Files: `server/src/handlers/pf2/attack.ts`, `server/src/handlers/pf2/attack.test.ts`, `server/src/handlers/pf2/router.ts`, `shared/rulesets/pf2/feats.ts`

---

- [ ] 8. Implement Sudden Charge

  **What to do**:
  - Add Sudden Charge effect to `FEAT_EFFECTS`
  - Create action handler: 2 actions = Stride + Stride + Strike
  - Write tests first (TDD)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 16
  - **Blocked By**: Task 4

  **References**:
  - `server/src/handlers/pf2/movement.ts` - Stride logic
  - `server/src/handlers/pf2/attack.ts` - Strike logic

  **Acceptance Criteria**:

  **TDD Tests**:
  - [ ] Test: `Sudden Charge costs 2 actions`
  - [ ] Test: `Sudden Charge allows double move + Strike`
  - [ ] Test: `Sudden Charge requires the feat`

  **Commit**: YES
  - Message: `feat(pf2): implement Sudden Charge action`

---

- [ ] 9. Implement Intimidating Strike

  **What to do**:
  - Add effect to `FEAT_EFFECTS`
  - Create action handler: 2 actions = Strike + free Demoralize on hit
  - Reuse existing Demoralize logic
  - Write tests first (TDD)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocked By**: Task 4

  **References**:
  - `server/src/handlers/pf2/skill-actions.ts:handleDemoralize` - Reuse this

  **Acceptance Criteria**:

  **TDD Tests**:
  - [ ] Test: `Intimidating Strike costs 2 actions`
  - [ ] Test: `Intimidating Strike triggers Demoralize on hit`
  - [ ] Test: `applies frightened on Demoralize success`

  **Commit**: YES
  - Message: `feat(pf2): implement Intimidating Strike action`

---

- [ ] 10. Implement Combat Grab

  **What to do**:
  - Add effect to `FEAT_EFFECTS`
  - Create action: 1 action Strike + auto-Grapple on hit
  - Reuse existing Grapple logic
  - Write tests first (TDD)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocked By**: Task 4

  **References**:
  - `server/src/handlers/pf2/skill-actions.ts:handleGrapple` - Reuse this

  **Acceptance Criteria**:

  **TDD Tests**:
  - [ ] Test: `Combat Grab costs 1 action (normal Strike cost)`
  - [ ] Test: `Combat Grab attempts Grapple on hit`
  - [ ] Test: `applies grabbed on success`

  **Commit**: YES
  - Message: `feat(pf2): implement Combat Grab action`

---

- [ ] 11. Implement Knockdown

  **What to do**:
  - Add effect to `FEAT_EFFECTS`
  - Create action: 2 actions = Strike + Trip on critical hit
  - Reuse existing Trip logic
  - Write tests first (TDD)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocked By**: Task 4

  **References**:
  - `server/src/handlers/pf2/skill-actions.ts:handleTrip` - Reuse this

  **Acceptance Criteria**:

  **TDD Tests**:
  - [ ] Test: `Knockdown costs 2 actions`
  - [ ] Test: `Knockdown attempts Trip on critical hit`
  - [ ] Test: `does NOT trip on regular hit`

  **Commit**: YES
  - Message: `feat(pf2): implement Knockdown action`

---

### PHASE 2: MAGIC UI

- [ ] 13. Create SpellPicker component

  **What to do**:
  - Create `src/components/rulesets/pf2/SpellPicker.tsx`:
    - Display spells grouped by level
    - Show spell slot usage (available/total)
    - Highlight available spells
    - Disable when no slots or insufficient actions
    - Show heighten options for heightenable spells
    - Call `onSelectSpell(spellName, castLevel)` callback
  - Follow expandable menu pattern from GURPS
  - Write component tests

  **Must NOT do**:
  - Multi-caster selection
  - Focus spell support
  - Spell preparation UI

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component design
  - **Skills**: `["frontend-ui-ux"]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4-6)
  - **Blocks**: Task 14
  - **Blocked By**: None

  **References**:
  - `src/components/rulesets/gurps/GurpsActionBar.tsx:250-290` - Expandable menu pattern
  - `shared/rulesets/pf2/spellData.ts` - Spell database
  - `shared/rulesets/pf2/types.ts:SpellCaster` - Slot structure

  **Acceptance Criteria**:

  **TDD Tests** (`src/components/rulesets/pf2/SpellPicker.test.tsx`):
  - [ ] Test: `renders spells grouped by level`
  - [ ] Test: `shows slot count per level`
  - [ ] Test: `disables spells without slots`
  - [ ] Test: `shows heighten options`
  - [ ] Test: `calls onSelectSpell with spell and level`

  **Commit**: YES
  - Message: `feat(pf2): add SpellPicker component`

---

- [ ] 14. Add Cast Spell button to ActionBar

  **What to do**:
  - Modify `src/components/rulesets/pf2/PF2ActionBar.tsx`:
    - Add "Cast Spell" button (show if character has spellcasters)
    - Toggle SpellPicker overlay
    - On selection, dispatch `pf2_cast_spell` with spell data
    - Require `selectedTargetId` for single-target spells
  - Write integration tests

  **Must NOT do**:
  - Desktop GameActionPanel
  - Caster selection

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `["frontend-ui-ux"]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7-11)
  - **Blocks**: Tasks 15, 16
  - **Blocked By**: Task 13

  **References**:
  - `src/components/rulesets/pf2/PF2ActionBar.tsx` - ActionBar to modify
  - `shared/types.ts` - `pf2_cast_spell` message type

  **Acceptance Criteria**:

  **TDD Tests**:
  - [ ] Test: `shows Cast Spell when character has spellcasters`
  - [ ] Test: `hides Cast Spell when no spellcasters`
  - [ ] Test: `opens SpellPicker on click`
  - [ ] Test: `dispatches pf2_cast_spell on selection`
  - [ ] Test: `requires target for single-target spells`

  **Commit**: YES
  - Message: `feat(pf2): add Cast Spell to ActionBar`

---

- [ ] 15. Implement burst area spell resolution

  **What to do**:
  - Modify `server/src/handlers/pf2/spell.ts`:
    - Detect `targetType: 'area'` and `areaShape: 'burst'`
    - Calculate affected hexes from target position + radius
    - Apply spell to all combatants in area
    - Roll save for each independently
  - Add area targeting to ActionBar:
    - Enable hex click mode for area spells
    - Show preview of affected hexes
    - Confirm to cast
  - Update Fireball in spellData with `areaShape: 'burst', areaRadius: 4`
  - Write tests

  **Must NOT do**:
  - Cone, line, emanation
  - Visual effects

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex server + client feature
  - **Skills**: `["frontend-ui-ux"]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 16
  - **Blocked By**: Tasks 3, 14

  **References**:
  - `server/src/handlers/pf2/spell.ts` - Spell handler
  - `src/utils/hex.ts` - Hex math
  - `shared/rulesets/pf2/spellData.ts` - Add area fields to Fireball

  **Acceptance Criteria**:

  **TDD Tests**:
  - [ ] Test: `burst affects all combatants within radius`
  - [ ] Test: `rolls save for each target`
  - [ ] Test: `applies damage per save result`
  - [ ] Test: `Fireball radius 4 affects correct hexes`

  **UI Verification** (Playwright):
  ```
  1. Select Fireball
  2. Verify hex selection mode activates
  3. Click target hex
  4. Verify area preview shows
  5. Confirm cast
  6. Verify damage to all in area
  ```

  **Commit**: YES
  - Message: `feat(pf2): implement burst area spell resolution`

---

### PHASE 3: INTEGRATION

- [ ] 16. Integration testing and polish

  **What to do**:
  - Run full test suite
  - Run linter
  - Fix any integration issues
  - Manual smoke test in browser
  - Verify all feats work end-to-end
  - Verify spell UI works end-to-end

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `["playwright"]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (final)
  - **Blocked By**: All previous tasks

  **Acceptance Criteria**:

  **Automated Verification**:
  ```bash
  npx vitest run --grep "pf2"
  # Assert: 0 failures
  
  npm run lint
  # Assert: 0 errors
  
  npx tsc --noEmit
  # Assert: 0 errors
  ```

  **Integration Verification** (Playwright):
  ```
  1. Create PF2 fighter with Attack of Opportunity
  2. Verify AoO triggers when enemy moves away
  3. Create PF2 wizard
  4. Verify AoO does NOT trigger (no feat)
  5. Cast Fireball via UI
  6. Verify area damage
  ```

  **Commit**: YES (if fixes)
  - Message: `fix(pf2): integration fixes`

---

## Commit Strategy

| After Task | Message | Key Files |
|------------|---------|-----------|
| 1 | `chore(pf2): add Pf2ools data bundles` | data/pf2ools/* |
| 2 | `feat(pf2): add Pf2ools feat parser` | pf2oolsParser.ts, featData.ts |
| 3 | `feat(pf2): add spell heightening from Pf2ools` | spellData.ts |
| 4 | `feat(pf2): add feat framework + gate AoO` | feats.ts, reaction.ts |
| 5-11 | `feat(pf2): implement [FeatName]` | handlers |
| 13 | `feat(pf2): add SpellPicker component` | SpellPicker.tsx |
| 14 | `feat(pf2): add Cast Spell to ActionBar` | PF2ActionBar.tsx |
| 15 | `feat(pf2): implement burst area spells` | spell.ts |
| 16 | `fix(pf2): integration fixes` | various |

---

## Success Criteria

### Verification Commands
```bash
# All PF2 tests pass
npx vitest run --grep "pf2"

# Lint passes  
npm run lint

# Type check passes
npx tsc --noEmit

# Specific tests
npx vitest run shared/rulesets/pf2/pf2oolsParser.test.ts
npx vitest run shared/rulesets/pf2/feats.test.ts
npx vitest run server/src/handlers/pf2/reaction.test.ts
npx vitest run server/src/handlers/pf2/spell.test.ts
```

### Final Checklist
- [ ] Pf2ools data bundles integrated
- [ ] Feat parser working for all 8 target feats
- [ ] Spell heightening parsed from Pf2ools
- [ ] All 8 feats have working combat effects
- [ ] AoO only triggers for feat holders
- [ ] Spell casting works from ActionBar
- [ ] Heightening increases damage correctly
- [ ] Burst area spells affect multiple targets
- [ ] All tests pass
- [ ] No lint/type errors
