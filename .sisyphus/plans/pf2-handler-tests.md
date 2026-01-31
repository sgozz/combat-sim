# PF2 Server Handler Tests + Grapple Bugfix

## TL;DR

> **Quick Summary**: Write real unit tests for all 13 PF2 server handler functions (currently 0% coverage), fix the copy-paste Grapple bug, and delete the fake test file.
> 
> **Deliverables**:
> - Shared test factory utility file
> - Fix `handlePF2Grapple` (currently identical to Trip — wrong save, wrong conditions, wrong log)
> - 5 new test files covering all 13 PF2 handlers
> - Delete fake `shared/rulesets/pf2/skill-actions.test.ts`
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (factories) → Task 3 (Grapple fix) → Task 5 (skill-action tests)

---

## Context

### Original Request
User asked to analyze existing PF2 tests and write real tests for combat maneuvers. Analysis revealed server handlers have 0% test coverage, and `skill-actions.test.ts` contains fake assertions (`expect(true).toBe(true)`).

### Interview Summary
**Key Discussions**:
- All 216 PF2 tests pass but only test pure functions in `shared/rulesets/pf2/rules.ts`
- Server handlers in `server/src/handlers/pf2/` have zero real tests
- Found critical bug: `handlePF2Grapple` is byte-for-byte identical to `handlePF2Trip`

**Research Findings**:
- Good mock patterns exist in `server/src/rulesets/pf2/bot.test.ts` and `shared/rulesets/pf2/reactions.test.ts`
- 13 exported handler functions across 6 files
- Handlers share same dependency surface: state, db, WebSocket helpers, bot scheduler
- Two mock strategies needed: skill-actions mock `pf2/rules` directly; attack/spell mock `serverAdapter`

### Metis Review
**Identified Gaps** (addressed):
- `handlePF2ReactionChoice` also needs tests (added to scope)
- Shared factories should be extracted to avoid duplication across 5 test files
- rollCheck mock strategy differs between files (skill-actions vs attack) — documented per task
- `end_turn`/`surrender` in router are out of scope (simple, inlined)
- Old fake `shared/rulesets/pf2/skill-actions.test.ts` should be deleted (rollCheck parts are covered in rules.test.ts)

---

## Work Objectives

### Core Objective
Achieve real test coverage for all PF2 server handler functions, fix the Grapple handler bug, and remove fake tests.

### Concrete Deliverables
- `server/src/handlers/pf2/__tests__/testUtils.ts` — shared factories
- Fix `server/src/handlers/pf2/skill-actions.ts` — Grapple handler
- `server/src/handlers/pf2/actions.test.ts` — DropProne, Stand, Step, RaiseShield
- `server/src/handlers/pf2/skill-actions.test.ts` — Grapple, Trip, Disarm, Feint, Demoralize
- `server/src/handlers/pf2/attack.test.ts` — Strike
- `server/src/handlers/pf2/stride.test.ts` — RequestMove, Stride
- `server/src/handlers/pf2/spell.test.ts` — CastSpell
- Delete `shared/rulesets/pf2/skill-actions.test.ts`

### Definition of Done
- [x] `npx vitest run server/src/handlers/pf2/` → all pass, 0 failures
- [x] `npx vitest run` → full suite passes (including deletions)
- [x] `npm run lint` → clean
- [x] `grep -r "expect(true).toBe(true)" server/src/handlers/pf2/` → no matches
- [x] Every exported `handlePF2*` function has at least 1 test

### Must Have
- Real handler invocations (not manual state construction)
- All 4 degrees of success tested for skill-check handlers
- Validation error paths tested (no actions, invalid target, etc.)
- Each handler's action cost deduction verified
- Grapple bug fixed (correct save DC, correct conditions, correct log)

### Must NOT Have (Guardrails)
- DO NOT test through the router — call handlers directly
- DO NOT test rollCheck/rollDamage math — those are tested in rules.test.ts; mock them
- DO NOT add new game logic or validation to handlers while writing tests
- DO NOT refactor handler code to improve testability
- DO NOT assert exact log message strings — use `toContain` for key substrings
- DO NOT write tests for every spell in the database — test code paths only
- DO NOT create a monolithic `all-handlers.test.ts` — one test file per source file

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (vitest)
- **User wants tests**: YES (this IS the test task)
- **Framework**: vitest with happy-dom

### Automated Verification

```bash
# All new test files exist
ls server/src/handlers/pf2/__tests__/testUtils.ts \
   server/src/handlers/pf2/actions.test.ts \
   server/src/handlers/pf2/skill-actions.test.ts \
   server/src/handlers/pf2/attack.test.ts \
   server/src/handlers/pf2/stride.test.ts \
   server/src/handlers/pf2/spell.test.ts
# Assert: exit code 0

# All new tests pass
npx vitest run server/src/handlers/pf2/
# Assert: 0 failed

# No fake assertions
grep -r "expect(true).toBe(true)" server/src/handlers/pf2/*.test.ts
# Assert: exit code 1 (no matches found)

# Old fake file deleted
test ! -f shared/rulesets/pf2/skill-actions.test.ts
# Assert: exit code 0

# Full suite still passes
npx vitest run
# Assert: 0 failed

# Lint passes
npm run lint
# Assert: exit code 0
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Create shared test factories
└── Task 2: Fix Grapple handler bug

Wave 2 (After Wave 1):
├── Task 3: actions.test.ts (simple handlers)
├── Task 4: attack.test.ts (strike handler)
└── Task 5: skill-actions.test.ts (5 skill handlers)

Wave 3 (After Wave 2):
├── Task 6: stride.test.ts (movement + AoO)
├── Task 7: spell.test.ts (spellcasting)
└── Task 8: Cleanup (delete fake tests, verify full suite)
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3, 4, 5, 6, 7 | 2 |
| 2 | None | 5 (Grapple tests) | 1 |
| 3 | 1 | 8 | 4, 5 |
| 4 | 1 | 8 | 3, 5 |
| 5 | 1, 2 | 8 | 3, 4 |
| 6 | 1 | 8 | 7 |
| 7 | 1 | 8 | 6 |
| 8 | 3, 4, 5, 6, 7 | None | None (final) |

---

## TODOs

- [x] 1. Create shared test factory utility

  **What to do**:
  - Create `server/src/handlers/pf2/__tests__/testUtils.ts`
  - Extract and adapt factory functions from `shared/rulesets/pf2/reactions.test.ts` lines 56-153
  - Include: `createPF2Combatant(overrides)`, `createPF2Character(overrides)`, `createMatch(overrides)`, `createMockSocket()`
  - `createMockSocket` must return `{ readyState: 1, send: vi.fn() }` (sendMessage checks readyState)
  - Include `createPlayer(overrides)` helper
  - Export all factories

  **Must NOT do**:
  - Do NOT import from test files (only from source types)
  - Do NOT add game logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small file, well-defined output, copy-adapt pattern
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Not domain-specific; any skill works for this boilerplate task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 4, 5, 6, 7
  - **Blocked By**: None

  **References**:
  - `shared/rulesets/pf2/reactions.test.ts:56-153` — Factory pattern to extract (createPF2Combatant, createPF2Character, createMatch)
  - `server/src/rulesets/pf2/bot.test.ts:84-183` — Alternative factory pattern with character weapons
  - `shared/rulesets/pf2/types.ts` — PF2CombatantState type definition
  - `shared/rulesets/pf2/characterSheet.ts` — PF2CharacterSheet type
  - `shared/types.ts` — MatchState, Player types

  **Acceptance Criteria**:
  ```bash
  # File exists
  test -f server/src/handlers/pf2/__tests__/testUtils.ts
  # Assert: exit code 0

  # TypeScript compiles
  npx tsc --noEmit server/src/handlers/pf2/__tests__/testUtils.ts 2>&1
  # Assert: no errors
  ```

  **Commit**: NO (groups with Task 8)

---

- [x] 2. Fix handlePF2Grapple bug (copy-paste from Trip)

  **What to do**:
  - Edit `server/src/handlers/pf2/skill-actions.ts`, function `handlePF2Grapple` (lines 43-115)
  - Change `reflexDC` → `fortitudeDC` (line 75): use `10 + targetCharacter.derived.fortitudeSave`
  - Change log message from `"attempts to Trip"` → `"attempts to Grapple"` (line 79)
  - Change success condition: target gets `grabbed` instead of `prone + flat_footed` (lines 94-99)
  - Change critical success: target gets `restrained` instead of `prone + flat_footed`
  - Change critical failure: attacker gets `flat_footed` instead of `prone` (lines 83-88)
  - Keep MAP application unchanged (-5 per attempt, has attack trait)

  **Must NOT do**:
  - Do NOT change handlePF2Trip (it's correct)
  - Do NOT change other handlers
  - Do NOT add new features (e.g., reach checking)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single function fix with clear before/after
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 5 (Grapple tests need correct behavior)
  - **Blocked By**: None

  **References**:
  - `server/src/handlers/pf2/skill-actions.ts:43-115` — handlePF2Grapple (the broken function)
  - `server/src/handlers/pf2/skill-actions.ts:117-189` — handlePF2Trip (correct reference for Trip behavior)
  - PF2 Grapple rules: Athletics vs **Fortitude DC**. Success → grabbed. Crit success → restrained. Crit fail → attacker flat_footed.
  - PF2 Trip rules: Athletics vs **Reflex DC**. Success → prone + flat_footed. Crit fail → attacker prone.

  **Acceptance Criteria**:
  ```bash
  # Verify log says "Grapple" not "Trip"
  grep -n "attempts to Grapple" server/src/handlers/pf2/skill-actions.ts
  # Assert: at least 1 match

  # Verify uses fortitudeSave
  grep -n "fortitudeSave" server/src/handlers/pf2/skill-actions.ts
  # Assert: at least 1 match

  # Verify grabbed condition
  grep -n "'grabbed'" server/src/handlers/pf2/skill-actions.ts
  # Assert: at least 1 match

  # Build passes
  npm run build
  # Assert: exit code 0

  # Existing tests still pass
  npx vitest run
  # Assert: 0 failed
  ```

  **Commit**: YES
  - Message: `fix(pf2): correct Grapple handler (was copy-pasted from Trip)`
  - Files: `server/src/handlers/pf2/skill-actions.ts`
  - Pre-commit: `npx vitest run`

---

- [x] 3. Write tests for actions.ts (DropProne, Stand, Step, RaiseShield)

  **What to do**:
  - Create `server/src/handlers/pf2/actions.test.ts`
  - Mock dependencies: `../../state`, `../../db`, `../../helpers`, `../../bot`
  - Import factories from `__tests__/testUtils`
  - Test `handlePF2DropProne`:
    - Success: adds `prone` condition, costs 1 action, logs "drops prone"
    - Fail: no actions remaining → sends error
  - Test `handlePF2Stand`:
    - Success: removes `prone` condition, costs 1 action, logs "stands up"
    - Fail: not prone → sends error "Not prone."
    - Fail: no actions remaining → sends error
  - Test `handlePF2Step`:
    - Success: moves position to adjacent square, costs 1 action
    - Fail: distance > 1 → sends error "Step can only move 1 square."
    - Fail: hex occupied → sends error "Hex is occupied."
    - Fail: no actions remaining → sends error
  - Test `handlePF2RaiseShield`:
    - Success: sets `shieldRaised = true`, costs 1 action, logs "raises their shield"
    - Fail: no shield equipped (`shieldBonus <= 0`) → sends error
    - Fail: shield already raised → sends error
    - Fail: no actions remaining → sends error

  **Must NOT do**:
  - Do NOT test action economy math (tested in rules.test.ts)
  - Do NOT assert exact log messages — use `toContain`

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Straightforward test writing following established patterns
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:
  - `server/src/handlers/pf2/actions.ts` — Source file (all 4 handlers)
  - `server/src/handlers/pf2/__tests__/testUtils.ts` — Shared factories (created in Task 1)
  - `shared/rulesets/pf2/reactions.test.ts:1-53` — Mock setup pattern to follow
  - `server/src/rulesets/pf2/bot.test.ts:6-78` — Alternative mock pattern for server-side deps

  **Acceptance Criteria**:
  ```bash
  npx vitest run server/src/handlers/pf2/actions.test.ts
  # Assert: all pass, ≥12 tests (3 per handler minimum)
  ```

  **Commit**: NO (groups with Task 8)

---

- [x] 4. Write tests for attack.ts (Strike handler)

  **What to do**:
  - Create `server/src/handlers/pf2/attack.test.ts`
  - Mock dependencies including `serverAdapter` (attack uses `adapter.pf2!.rollCheck` not direct import)
  - Mock `getServerAdapter` to return `{ pf2: { getAbilityModifier, getProficiencyBonus, rollCheck: mockRollCheck, rollDamage: mockRollDamage } }`
  - Test `handlePF2AttackAction`:
    - Hit: deals damage, reduces target HP, costs 1 action, MAP increases by -5
    - Critical hit: doubles damage
    - Miss: no damage, costs 1 action, MAP still increases
    - Kill: target HP→0 sets dying + unconscious status
    - Out of range: sends error "Target out of melee range."
    - No actions: sends error "No actions remaining."
    - Shield raised on target: +2 AC applied
    - Condition modifiers applied (flat_footed on target → -2 AC, prone on attacker → -2 attack)
    - Agile weapon: MAP -4/-8 instead of -5/-10
    - Auto-advance turn when 0 actions remaining

  **Must NOT do**:
  - Do NOT test rollCheck/rollDamage internal math
  - Do NOT test advanceTurn logic
  - Do NOT test checkVictory logic

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex handler with many code paths (damage, dying, MAP, conditions, auto-advance)
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 5)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:
  - `server/src/handlers/pf2/attack.ts` — Source file (264 lines, full attack flow)
  - `server/src/handlers/pf2/__tests__/testUtils.ts` — Shared factories
  - `shared/rulesets/pf2/reactions.test.ts:37-52` — Mock pattern for `serverAdapter` (rollCheck, rollDamage via adapter)
  - `shared/rulesets/pf2/conditions.ts` — getConditionACModifier, getConditionAttackModifier (imported by attack.ts)
  - `server/src/handlers/pf2/attack.ts:33-50` — `getWeaponInfo` helper (falls back to Fist if no weapon)
  - `server/src/handlers/pf2/attack.ts:161-205` — Combatant update logic (MAP calc, dying/death logic)

  **Acceptance Criteria**:
  ```bash
  npx vitest run server/src/handlers/pf2/attack.test.ts
  # Assert: all pass, ≥8 tests
  ```

  **Commit**: NO (groups with Task 8)

---

- [x] 5. Write tests for skill-actions.ts (Grapple, Trip, Disarm, Feint, Demoralize)

  **What to do**:
  - Create `server/src/handlers/pf2/skill-actions.test.ts` (in server dir, NOT shared)
  - Mock `rollCheck` from `../../../../shared/rulesets/pf2/rules` (skill-actions import directly, NOT via adapter)
  - Mock `getCharacterById` to return characters with skills array
  - Test all 5 handlers with all 4 degrees of success:
  
  - **handlePF2Grapple** (after bug fix):
    - Success: target gets `grabbed`, costs 1 action, MAP -5
    - Crit success: target gets `restrained`
    - Failure: nothing happens to target, still costs action + MAP
    - Crit failure: attacker gets `flat_footed`
    - Validation: no actions → error, invalid target → error
    - Verify: uses `fortitudeSave` for DC (not reflex)
    - Verify: Deception/Intimidation NOT used (Athletics only)
  
  - **handlePF2Trip**:
    - Success: target gets `prone` + `flat_footed`, costs 1 action, MAP -5
    - Crit failure: attacker gets `prone`
    - Verify: uses `reflexSave` for DC
  
  - **handlePF2Disarm**:
    - Success: log contains "takes -2 to attacks"
    - Crit success: log contains "drops their weapon"
    - Crit failure: log contains attacker "drops their weapon"
    - Note: Disarm currently only logs, doesn't apply conditions — test current behavior
  
  - **handlePF2Feint**:
    - Success: target gets `flat_footed`
    - Crit success: target gets `flat_footed` (broader, logged differently)
    - Verify: does NOT apply MAP (mapIncrease = 0)
    - Verify: uses Deception skill, not Athletics
    - Verify: DC is `10 + perception`, not reflex
  
  - **handlePF2Demoralize**:
    - Success: target gets `frightened` with value 1
    - Crit success: target gets `frightened` with value 2
    - Verify: does NOT apply MAP (mapIncrease = 0)
    - Verify: uses Intimidation skill
    - Verify: DC is `10 + willSave`

  **Must NOT do**:
  - Do NOT test rollCheck math
  - Do NOT add range validation to handlers (not currently implemented)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 5 handlers, each with 4+ test cases, careful mock setup for rollCheck
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4) — but waits for Task 2 (Grapple fix)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1, Task 2

  **References**:
  - `server/src/handlers/pf2/skill-actions.ts` — All 5 handlers (404 lines)
  - `server/src/handlers/pf2/skill-actions.ts:31-41` — `getSkillBonus` helper (needs character with skills array)
  - `server/src/handlers/pf2/skill-actions.ts:13-29` — `updateCombatantActions` helper (actions + MAP)
  - `shared/rulesets/pf2/reactions.test.ts:1-53` — Mock pattern to adapt
  - `server/src/handlers/pf2/__tests__/testUtils.ts` — Shared factories
  - `shared/rulesets/pf2/skill-actions.test.ts` — Current FAKE tests to DELETE (shows intended behavior per handler)

  **Acceptance Criteria**:
  ```bash
  npx vitest run server/src/handlers/pf2/skill-actions.test.ts
  # Assert: all pass, ≥20 tests (4 per handler minimum)

  grep -r "expect(true).toBe(true)" server/src/handlers/pf2/skill-actions.test.ts
  # Assert: exit code 1 (no fake assertions)
  ```

  **Commit**: NO (groups with Task 8)

---

- [x] 6. Write tests for stride.ts (RequestMove, Stride)

  **What to do**:
  - Create `server/src/handlers/pf2/stride.test.ts`
  - Mock `getReachableSquares` from `pf2/rules` (returns Map of reachable cells)
  - Mock `getAoOReactors` and `executeAoOStrike` from `./reaction`
  - Test `handlePF2RequestMove`:
    - Success: sets `reachableHexes` on match state, based on speed
    - Fail: no actions remaining → error
  - Test `handlePF2Stride`:
    - Success (no AoO): moves to destination, costs 1 action, clears reachableHexes
    - Fail: destination not reachable → error "Destination not reachable."
    - With bot AoO: auto-executes AoO, then moves if still alive
    - With bot AoO + killed: stride interrupted, logs unconscious
    - With player AoO: sets `pendingReaction`, does NOT move yet
    - Fail: no actions remaining → error

  **Must NOT do**:
  - Do NOT test getReachableSquares pathfinding (tested in rules.test.ts)
  - Do NOT test executeAoOStrike logic (tested in reactions.test.ts)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex interaction with AoO, bot/player fork, pending reaction state
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:
  - `server/src/handlers/pf2/stride.ts` — Source file (191 lines)
  - `server/src/handlers/pf2/reaction.ts:153-168` — `getAoOReactors` (called by stride)
  - `server/src/handlers/pf2/reaction.ts:39-151` — `executeAoOStrike` (called for bot AoO)
  - `shared/rulesets/pf2/rules.ts` — `getReachableSquares`, `gridToHex`
  - `shared/types.ts` — `PendingReaction` type (for player AoO pausing)
  - `server/src/handlers/pf2/__tests__/testUtils.ts` — Shared factories

  **Acceptance Criteria**:
  ```bash
  npx vitest run server/src/handlers/pf2/stride.test.ts
  # Assert: all pass, ≥6 tests
  ```

  **Commit**: NO (groups with Task 8)

---

- [x] 7. Write tests for spell.ts (CastSpell handler)

  **What to do**:
  - Create `server/src/handlers/pf2/spell.test.ts`
  - Mock `canCastSpell`, `calculateSpellAttack`, `calculateSpellDC`, `rollCheck`, `rollDamage`, `applyHealing` from `pf2/rules`
  - Mock `getSpell` from `pf2/spellData`
  - Test `handlePF2CastSpell` by code path (not per spell):
    - **Save + Damage path** (e.g., Electric Arc): save roll, damage by degree, costs 2 actions
    - **No-save + Damage path** (e.g., Magic Missile): flat damage, no save roll
    - **Heal path** (e.g., Heal): heals target HP, handles dying → wounded
    - **Condition path** (e.g., Fear): save roll, applies condition on failure
    - **Cantrip**: unlimited uses, slot not consumed
    - **Leveled spell**: consumes spell slot
    - **Focus spell**: consumes focus point
    - Fail: not enough actions → error "requires 2 actions"
    - Fail: no spell slots → error from canCastSpell
    - Fail: spell not found → error "not found in database"
    - Fail: no spellcaster → error "No spellcaster at that index"

  **Must NOT do**:
  - Do NOT test canCastSpell logic (tested in spells.test.ts)
  - Do NOT test every spell definition
  - Do NOT test applyHealing logic (tested in spells.test.ts)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: High cyclomatic complexity, multiple spell effect paths
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 6)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:
  - `server/src/handlers/pf2/spell.ts` — Source file (263 lines)
  - `shared/rulesets/pf2/spells.test.ts` — Existing spell logic tests (for understanding mock shapes)
  - `shared/rulesets/pf2/types.ts` — `SpellCaster`, `SpellSlotUsage`, `SpellDefinition` types
  - `shared/rulesets/pf2/spellData.ts` — `getSpell()` function to mock
  - `server/src/handlers/pf2/__tests__/testUtils.ts` — Shared factories

  **Acceptance Criteria**:
  ```bash
  npx vitest run server/src/handlers/pf2/spell.test.ts
  # Assert: all pass, ≥8 tests
  ```

  **Commit**: NO (groups with Task 8)

---

- [x] 8. Cleanup: delete fake tests, run full suite, commit

  **What to do**:
  - Delete `shared/rulesets/pf2/skill-actions.test.ts` (the fake test file)
  - Run `npx vitest run` — verify full suite passes
  - Run `npm run lint` — verify lint passes
  - Verify no `expect(true).toBe(true)` in any new test file
  - Commit all test files together

  **Must NOT do**:
  - Do NOT delete any other test files
  - Do NOT modify handler source code (except Grapple fix, already committed)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple cleanup task
  - **Skills**: [`git-master`]
    - `git-master`: For proper commit with verification

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (final task)
  - **Blocks**: None (final)
  - **Blocked By**: Tasks 3, 4, 5, 6, 7

  **References**:
  - `shared/rulesets/pf2/skill-actions.test.ts` — File to DELETE
  - All new test files created in Tasks 1, 3-7

  **Acceptance Criteria**:
  ```bash
  # Old fake file gone
  test ! -f shared/rulesets/pf2/skill-actions.test.ts
  # Assert: exit code 0

  # All tests pass
  npx vitest run 2>&1 | grep -E "Tests|passed|failed"
  # Assert: 0 failed

  # Lint passes
  npm run lint
  # Assert: exit code 0

  # No fake assertions in new files
  grep -r "expect(true).toBe(true)" server/src/handlers/pf2/
  # Assert: exit code 1
  ```

  **Commit**: YES
  - Message: `test(pf2): add real handler tests for all 13 PF2 combat actions`
  - Files: `server/src/handlers/pf2/__tests__/testUtils.ts`, `server/src/handlers/pf2/actions.test.ts`, `server/src/handlers/pf2/skill-actions.test.ts`, `server/src/handlers/pf2/attack.test.ts`, `server/src/handlers/pf2/stride.test.ts`, `server/src/handlers/pf2/spell.test.ts`, delete `shared/rulesets/pf2/skill-actions.test.ts`
  - Pre-commit: `npx vitest run && npm run lint`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 2 | `fix(pf2): correct Grapple handler (was copy-pasted from Trip)` | skill-actions.ts | `npx vitest run` |
| 8 | `test(pf2): add real handler tests for all 13 PF2 combat actions` | 5 test files + testUtils + delete fake | `npx vitest run && npm run lint` |

---

## Success Criteria

### Verification Commands
```bash
npx vitest run server/src/handlers/pf2/  # All handler tests pass
npx vitest run                             # Full suite passes
npm run lint                               # No lint errors
```

### Final Checklist
- [x] All 13 handlers have real tests
- [x] No `expect(true).toBe(true)` anywhere
- [x] Grapple uses Fortitude DC, applies grabbed/restrained
- [x] Old fake file deleted
- [x] All tests pass
- [x] Lint clean
