# Multi-Ruleset Architecture Refactoring

## Context

### Original Request
User requested an architecture review and refactoring of the combat simulator to:
1. Verify the current multi-ruleset implementation is correct
2. Eliminate scattered `if (rulesetId === 'pf2')` conditionals
3. Create a clean separation strategy between GURPS and Pathfinder 2e
4. Enable easy addition of a third ruleset (like D&D 5e)

### Interview Summary
**Key Discussions**:
- Scope: Architecture cleanup only, NOT completing PF2 features (defense/close combat stay stubs)
- Grid: Support hex + square only (no extensible grid abstraction needed)
- Bot: Include in refactoring, make ruleset-aware
- Defaults: Require explicit `rulesetId` everywhere (eliminate all `?? 'gurps'`)
- Tests: TDD with vitest (already configured with 7 test files)

**Research Findings**:
- 21 instances of hardcoded `?? 'gurps'` defaults across codebase
- 15 explicit `=== 'pf2'` conditionals outside `shared/rulesets/` directory
- 9 files import GURPS-specific types in shared/generic code
- 6 inline grid type selections (`rulesetId === 'pf2' ? 'square' : 'hex'`)
- Bot AI hardcoded to GURPS in `server/src/bot.ts`
- TypeScript errors: GURPS components receive union type instead of specific type

### Metis Review
**Identified Gaps** (addressed):
- Migration strategy for legacy database entries with `rulesetId: undefined`
- Error handling behavior when `rulesetId` is missing
- Legacy `chooseBotDefense` function removal
- Type guard enforcement pattern

---

## Work Objectives

### Core Objective
Refactor the combat simulator to have clean ruleset separation, eliminating all scattered conditionals and hardcoded defaults, making it trivial to add a third ruleset like D&D 5e.

### Concrete Deliverables
1. Zero `?? 'gurps'` patterns outside explicit fallback function
2. Zero `=== 'pf2'` conditionals outside `shared/rulesets/` directory  
3. All GURPS-specific type imports removed from shared code
4. Grid type selection centralized in adapter
5. Bot AI made ruleset-aware
6. New test coverage for refactored patterns
7. Database migration for `rulesetId` requirement

### Definition of Done
- [ ] `grep -r "?? 'gurps'" --include="*.ts" . | wc -l` returns 0 (or 1 for explicit default function)
- [ ] `grep -r "=== 'pf2'" --include="*.ts" src/ server/src/handlers.ts` returns 0
- [ ] `npm run build` succeeds with 0 TypeScript errors
- [ ] `npx vitest run` passes all tests
- [ ] `npm run lint` exits 0
- [ ] Manual test: GURPS match with bot works (bot attacks and defends)
- [ ] Manual test: PF2 match works (movement and attacks function)

### Must Have
- Centralized default ruleset function (not scattered `?? 'gurps'`)
- Type guards used consistently before accessing ruleset-specific fields
- Grid type derived from adapter, not inline conditionals
- Bot uses `getServerAdapter(rulesetId)` for defense selection
- Database migration handles existing matches

### Must NOT Have (Guardrails)
- DO NOT implement PF2 defense logic (keep stubs)
- DO NOT implement PF2 close combat (keep stubs)
- DO NOT implement PF2 bot defense AI (keep returning `null`)
- DO NOT add new rulesets or ruleset selection UI
- DO NOT change combat resolution logic
- DO NOT refactor grid coordinate math
- DO NOT modify `shared/rulesets/gurps/rules.ts` internals
- DO NOT change test file structure (only add new tests)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (vitest 4.0.17, happy-dom)
- **User wants tests**: TDD
- **Framework**: vitest

### TDD Workflow
Each task follows RED-GREEN-REFACTOR:
1. **RED**: Write failing test first
2. **GREEN**: Implement minimum code to pass  
3. **REFACTOR**: Clean up while keeping green

### Baseline Commands
```bash
# Before starting - capture baseline
npx vitest run  # Should pass

# After each change
npm run build   # TypeScript check
npx vitest run  # Test suite
npm run lint    # Linting
```

---

## Task Flow

```
Phase 0 (Baseline) ──→ Phase 1 (Tests) ──→ Phase 2 (Defaults) ──→ Phase 3 (Grid) ──→ Phase 4 (Types) ──→ Phase 5 (Bot) ──→ Phase 6 (Conditionals) ──→ Phase 7 (Verify)
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 2.1, 2.2, 2.3 | Independent test files |
| B | 3.2, 3.3, 3.4 | Independent file updates after helper created |

| Task | Depends On | Reason |
|------|------------|--------|
| All Phase 2+ tasks | Phase 0, Phase 1 | Need baseline and tests first |
| 3.2-3.4 | 3.1 | Need helper function before replacing usages |
| Phase 5 | Phase 4 | Type fixes needed before bot refactor |
| Phase 6 | All prior | Highest risk, do last |

---

## TODOs

### Phase 0: Baseline Verification

- [x] 0.1. Run baseline verification

  **What to do**:
  - Run `npx vitest run` and verify all tests pass
  - Run `npm run build` and verify no TypeScript errors
  - Run `npm run lint` and verify no lint errors
  - Count current violations: `grep -r "?? 'gurps'" --include="*.ts" . | wc -l`
  - Count conditionals: `grep -r "=== 'pf2'" --include="*.ts" src/ server/src/handlers.ts | wc -l`

  **Must NOT do**:
  - Make any code changes
  - Skip verification if something fails

  **Parallelizable**: NO (must complete first)

  **References**:
  - `vite.config.ts:9-14` - Test configuration with happy-dom
  - `package.json:8` - Build script: `tsc -b && vite build`
  - `package.json:9` - Lint script: `eslint .`

  **Acceptance Criteria**:
  - [ ] `npx vitest run` → PASS (all existing tests)
  - [ ] `npm run build` → exits 0
  - [ ] `npm run lint` → exits 0
  - [ ] Violation counts documented for comparison

  **Commit**: YES
  - Message: `chore: document baseline metrics before refactor`
  - Files: None (metrics only)
  - Pre-commit: N/A (no changes)

---

### Phase 1: Add Test Infrastructure for Refactoring

- [x] 1.1. Create adapter pattern tests

  **What to do**:
  - Create `shared/rulesets/serverAdapter.test.ts`
  - Test `getServerAdapter('gurps')` returns valid adapter
  - Test `getServerAdapter('pf2')` returns valid adapter
  - Test adapter has required methods: `advanceTurn`, `initializeTurnMovement`, `gridSystem`
  - Test `gridSystem.type` is 'hex' for GURPS, 'square' for PF2

  **Must NOT do**:
  - Test combat resolution logic (out of scope)
  - Test PF2 stub implementations

  **Parallelizable**: YES (with 1.2)

  **References**:
  - `shared/rulesets/serverAdapter.ts:897-911` - `getServerAdapter()` function
  - `shared/rulesets/serverAdapter.ts:11-58` - `ServerRulesetAdapter` interface
  - `shared/rules.test.ts` - Example test patterns in project

  **Acceptance Criteria**:
  - [ ] Test file created: `shared/rulesets/serverAdapter.test.ts`
  - [ ] Tests cover: adapter retrieval, required methods, grid type
  - [ ] `npx vitest run shared/rulesets/serverAdapter.test.ts` → PASS

  **Commit**: YES
  - Message: `test(rulesets): add server adapter pattern tests`
  - Files: `shared/rulesets/serverAdapter.test.ts`
  - Pre-commit: `npx vitest run`

- [x] 1.2. Create type guard tests

  **What to do**:
  - Create `shared/rulesets/typeGuards.test.ts`
  - Test `isGurpsCombatant()` correctly identifies GURPS combatants
  - Test `isPF2Combatant()` correctly identifies PF2 combatants
  - Test `isGurpsCharacter()` correctly identifies GURPS characters
  - Test `isPF2Character()` correctly identifies PF2 characters
  - Test negative cases (GURPS combatant fails PF2 check)

  **Must NOT do**:
  - Modify existing type guards
  - Add new type guards yet

  **Parallelizable**: YES (with 1.1)

  **References**:
  - `shared/rulesets/index.ts:91-97` - `isGurpsCombatant()` type guard
  - `shared/rulesets/index.ts:99-105` - `isPF2Combatant()` type guard
  - `shared/rulesets/characterSheet.ts:31-40` - Character type guards
  - `shared/rulesets/characterSheet.test.ts` - Existing character tests

  **Acceptance Criteria**:
  - [ ] Test file created: `shared/rulesets/typeGuards.test.ts`
  - [ ] Tests cover: combatant guards, character guards, negative cases
  - [ ] `npx vitest run shared/rulesets/typeGuards.test.ts` → PASS

  **Commit**: YES
  - Message: `test(rulesets): add type guard tests`
  - Files: `shared/rulesets/typeGuards.test.ts`
  - Pre-commit: `npx vitest run`

---

### Phase 2: Centralize Default Ruleset Handling

- [x] 2.1. Create centralized default function

  **What to do**:
  - Create `shared/rulesets/defaults.ts`
  - Add function `assertRulesetId(id: RulesetId | undefined): RulesetId` that throws if undefined
  - Add function `getRulesetIdOrThrow(id: RulesetId | undefined, context: string): RulesetId`
  - Add tests in `shared/rulesets/defaults.test.ts`
  - Test that undefined throws with descriptive error
  - Test that valid IDs pass through

  **Must NOT do**:
  - Add a "default" ruleset constant (we want explicit everywhere)
  - Replace usages yet (that's next tasks)

  **Parallelizable**: NO (creates dependency for 2.2-2.4)

  **References**:
  - `shared/rulesets/index.ts:5-8` - `RulesetId` type definition
  - `shared/types.ts:11` - `RulesetId` export

  **Acceptance Criteria**:
  - [ ] Test file created: `shared/rulesets/defaults.test.ts`
  - [ ] Test covers: throw on undefined, pass-through on valid
  - [ ] `npx vitest run shared/rulesets/defaults.test.ts` → PASS
  - [ ] Implementation file created: `shared/rulesets/defaults.ts`
  - [ ] Functions exported: `assertRulesetId`, `getRulesetIdOrThrow`

  **Commit**: YES
  - Message: `feat(rulesets): add centralized ruleset ID assertion helpers`
  - Files: `shared/rulesets/defaults.ts`, `shared/rulesets/defaults.test.ts`
  - Pre-commit: `npx vitest run`

- [x] 2.2. Replace server defaults with assertion

  **What to do**:
  - Update `server/src/handlers.ts`: Replace all `?? 'gurps'` with `getRulesetIdOrThrow()`
  - Update `server/src/match.ts`: Replace `rulesetId ?? 'gurps'` with assertion
  - Update `server/src/rulesetHelpers.ts`: Replace default with assertion
  - Update `server/src/helpers.ts`: Replace default with assertion
  - Update handlers in `server/src/handlers/gurps/` and `server/src/handlers/pf2/`

  **Must NOT do**:
  - Change combat logic
  - Change function signatures (yet)

  **Parallelizable**: YES (with 2.3, 2.4 after 2.1 complete)

  **References**:
  - `server/src/handlers.ts:356,507,575,786,844` - Default usages
  - `server/src/match.ts:35,63` - Match creation defaults
  - `server/src/rulesetHelpers.ts:5` - Helper default
  - `server/src/helpers.ts:66` - Grid system default
  - `server/src/handlers/gurps/movement.ts:42,118,187,294` - Movement defaults
  - `server/src/handlers/gurps/attack.ts:69,347` - Attack defaults
  - `server/src/handlers/shared/damage.ts:36` - Damage default

  **Acceptance Criteria**:
  - [ ] `grep -r "?? 'gurps'" --include="*.ts" server/` → 0 results
  - [ ] `npm run build` → exits 0 (TypeScript compiles)
  - [ ] `npx vitest run` → PASS

  **Commit**: YES
  - Message: `refactor(server): require explicit rulesetId in all handlers`
  - Files: All modified server files
  - Pre-commit: `npx vitest run`

- [x] 2.3. Replace client defaults with assertion

  **What to do**:
  - Update `src/App.tsx`: Replace `?? 'gurps'` with proper type narrowing
  - Update `src/components/game/GameScreen.tsx`: Replace defaults
  - Update `src/components/game/shared/rulesetUiSlots.ts`: Replace default
  - For UI code, if `rulesetId` is truly optional, use explicit "unknown ruleset" handling

  **Must NOT do**:
  - Break the UI for existing matches
  - Change component structure

  **Parallelizable**: YES (with 2.2, 2.4 after 2.1 complete)

  **References**:
  - `src/App.tsx:318,326` - Ruleset ID defaults
  - `src/components/game/GameScreen.tsx:137,248` - GameScreen defaults
  - `src/components/game/shared/rulesetUiSlots.ts:226` - UI slot default

  **Acceptance Criteria**:
  - [ ] `grep -r "?? 'gurps'" --include="*.ts" --include="*.tsx" src/` → 0 results
  - [ ] `npm run build` → exits 0
  - [ ] `npx vitest run` → PASS

  **Commit**: YES
  - Message: `refactor(client): require explicit rulesetId in UI components`
  - Files: All modified client files
  - Pre-commit: `npx vitest run`

- [x] 2.4. Handle database migration for rulesetId

  **What to do**:
  - Update `server/src/db.ts`: Keep `DEFAULT 'gurps'` in schema (for backward compat)
  - Update load functions to NOT use `?? 'gurps'` fallback
  - Add migration that sets `rulesetId = 'gurps'` for any NULL values
  - Ensure loaded matches always have valid `rulesetId`

  **Must NOT do**:
  - Remove the DEFAULT from schema (breaks existing databases)
  - Change match ID generation

  **Parallelizable**: YES (with 2.2, 2.3 after 2.1 complete)

  **References**:
  - `server/src/db.ts:57` - Schema definition with DEFAULT
  - `server/src/db.ts:84` - Migration adding column
  - `server/src/db.ts:304,382` - Load functions with fallbacks

  **Acceptance Criteria**:
  - [ ] Migration ensures no NULL rulesetId values
  - [ ] Load functions return valid rulesetId (not undefined)
  - [ ] `npm run build` → exits 0
  - [ ] Server starts without errors

  **Commit**: YES
  - Message: `fix(db): ensure rulesetId is always defined for loaded matches`
  - Files: `server/src/db.ts`
  - Pre-commit: `npx vitest run`

---

### Phase 3: Centralize Grid Type Selection

- [x] 3.1. Add getGridType helper function

  **What to do**:
  - Add `getGridType(rulesetId: RulesetId): 'hex' | 'square'` to `shared/rulesets/index.ts`
  - Implementation: return GURPS adapter's gridSystem.type or PF2's
  - Add test in typeGuards.test.ts (or new file)

  **Must NOT do**:
  - Create extensible grid abstraction
  - Change GridSystem interface

  **Parallelizable**: NO (creates dependency for 3.2-3.4)

  **References**:
  - `shared/rulesets/serverAdapter.ts:22` - `gridSystem: GridSystem` in adapter
  - `shared/grid/index.ts` - GridSystem interface
  - `shared/rulesets/gurps/index.ts:28` - GURPS uses hexGrid
  - `shared/rulesets/pf2/index.ts:28` - PF2 uses squareGrid8

  **Acceptance Criteria**:
  - [ ] Function exported from `shared/rulesets/index.ts`
  - [ ] `getGridType('gurps')` → 'hex'
  - [ ] `getGridType('pf2')` → 'square'
  - [ ] Test covers both rulesets
  - [ ] `npx vitest run` → PASS

  **Commit**: YES
  - Message: `feat(rulesets): add getGridType helper for centralized grid selection`
  - Files: `shared/rulesets/index.ts`, test file
  - Pre-commit: `npx vitest run`

- [x] 3.2. Replace grid conditionals in ArenaScene

  **What to do**:
  - Update `src/components/arena/ArenaScene.tsx`
  - Replace all `rulesetId === 'pf2' ? 'square' : 'hex'` with `getGridType(rulesetId)`
  - Import `getGridType` from `shared/rulesets`

  **Must NOT do**:
  - Change 3D rendering logic
  - Change camera or lighting

  **Parallelizable**: YES (with 3.3, 3.4 after 3.1 complete)

  **References**:
  - `src/components/arena/ArenaScene.tsx:30` - Grid system selection
  - `src/components/arena/ArenaScene.tsx:125` - Facing arcs conditional
  - `src/components/arena/ArenaScene.tsx:151,179,188` - Grid type props

  **Acceptance Criteria**:
  - [ ] `grep "=== 'pf2'" src/components/arena/ArenaScene.tsx` → 0 results
  - [ ] Arena renders correctly for both rulesets
  - [ ] `npm run build` → exits 0

  **Commit**: YES
  - Message: `refactor(arena): use getGridType instead of inline conditionals`
  - Files: `src/components/arena/ArenaScene.tsx`
  - Pre-commit: `npx vitest run`

- [x] 3.3. Replace grid conditional in MiniMap

  **What to do**:
  - Update `src/components/game/MiniMap.tsx`
  - Replace `matchState?.rulesetId === 'pf2' ? 'square' : 'hex'` with `getGridType()`

  **Must NOT do**:
  - Change minimap rendering logic

  **Parallelizable**: YES (with 3.2, 3.4 after 3.1 complete)

  **References**:
  - `src/components/game/MiniMap.tsx:74` - Grid type selection

  **Acceptance Criteria**:
  - [ ] `grep "=== 'pf2'" src/components/game/MiniMap.tsx` → 0 results
  - [ ] MiniMap renders correctly for both rulesets
  - [ ] `npm run build` → exits 0

  **Commit**: YES
  - Message: `refactor(minimap): use getGridType instead of inline conditional`
  - Files: `src/components/game/MiniMap.tsx`
  - Pre-commit: `npx vitest run`

- [x] 3.4. Move facing arcs logic to adapter

  **What to do**:
  - Add `hasFacingArcs: boolean` to `ServerRulesetAdapter` interface or use existing pattern
  - Update ArenaScene to check adapter instead of `rulesetId === 'pf2'`
  - GURPS: `hasFacingArcs: true`, PF2: `hasFacingArcs: false`

  **Must NOT do**:
  - Change facing arc rendering logic
  - Add complex configuration

  **Parallelizable**: YES (with 3.2, 3.3 after 3.1 complete)

  **References**:
  - `src/components/arena/ArenaScene.tsx:125` - `if (rulesetId === 'pf2') return emptyArcs`
  - `shared/rulesets/serverAdapter.ts:11-58` - Adapter interface

  **Acceptance Criteria**:
  - [ ] No `=== 'pf2'` for facing arcs in ArenaScene
  - [ ] Facing arcs show for GURPS, hidden for PF2
  - [ ] `npm run build` → exits 0

  **Commit**: YES
  - Message: `refactor(arena): derive facing arcs visibility from adapter`
  - Files: `shared/rulesets/serverAdapter.ts`, `src/components/arena/ArenaScene.tsx`
  - Pre-commit: `npx vitest run`

---

### Phase 4: Fix Type System Leakage

- [x] 4.1. Fix GURPS component type guards

  **What to do**:
  - Update `src/components/rulesets/gurps/GurpsGameActionPanel.tsx`
  - Add `isGurpsCharacter()` guard before accessing `.equipment`, `.attributes`
  - Update `src/components/rulesets/gurps/GurpsActionBar.tsx` similarly
  - Fix all TypeScript errors related to union type access

  **Must NOT do**:
  - Change component functionality
  - Add new props

  **Parallelizable**: YES (with 4.2)

  **References**:
  - LSP errors at `GurpsGameActionPanel.tsx:47,55,61,331`
  - LSP errors at `GurpsActionBar.tsx:43,69,70,334-367`
  - `shared/rulesets/characterSheet.ts:31-40` - Type guard implementations

  **Acceptance Criteria**:
  - [ ] `npm run build` → 0 TypeScript errors in GURPS components
  - [ ] Components still render correctly
  - [ ] Type guards used before accessing GURPS-specific fields

  **Commit**: YES
  - Message: `fix(gurps-ui): add type guards before accessing GURPS-specific fields`
  - Files: GURPS component files
  - Pre-commit: `npx vitest run`

- [x] 4.2. Fix useGameActions type guards

  **What to do**:
  - Update `src/components/game/shared/useGameActions.ts`
  - Add type guards before accessing `.attributes`, `.equipment`, `.fatiguePoints`, `.dodge`
  - Consider splitting into `useGurpsGameActions` and `usePF2GameActions` if too complex

  **Must NOT do**:
  - Change hook functionality for current rulesets
  - Remove defense calculation logic

  **Parallelizable**: YES (with 4.1)

  **References**:
  - LSP errors at `useGameActions.ts:174,182,217,218,267,277,285`
  - `shared/rulesets/characterSheet.ts` - Type guards

  **Acceptance Criteria**:
  - [ ] `npm run build` → 0 TypeScript errors in useGameActions
  - [ ] Hook works for both GURPS and PF2 matches
  - [ ] Type guards used consistently

  **Commit**: YES
  - Message: `fix(hooks): add type guards to useGameActions for ruleset safety`
  - Files: `src/components/game/shared/useGameActions.ts`
  - Pre-commit: `npx vitest run`

- [x] 4.3. Replace GURPS imports in shared code

  **What to do**:
  - Update `src/components/game/TurnStepper.tsx`: Import from base types, not GURPS
  - Update `src/App.tsx`: Remove GURPS-specific imports where possible
  - Update `src/components/game/GameScreen.tsx`: Use base types
  - For `ManeuverType`, use the type from `shared/rulesets/gurps/types` ONLY in GURPS components

  **Must NOT do**:
  - Change type definitions
  - Remove functionality

  **Parallelizable**: NO (depends on 4.1, 4.2)

  **References**:
  - `src/components/game/TurnStepper.tsx:1` - GURPS ManeuverType import
  - `src/App.tsx:12` - GURPS CombatActionPayload import
  - `src/components/game/GameScreen.tsx:14` - Multiple GURPS imports

  **Acceptance Criteria**:
  - [ ] Shared components don't import from `shared/rulesets/gurps/`
  - [ ] Shared components use base types or registry patterns
  - [ ] `npm run build` → exits 0

  **Commit**: YES
  - Message: `refactor(ui): remove GURPS-specific imports from shared components`
  - Files: `TurnStepper.tsx`, `App.tsx`, `GameScreen.tsx`
  - Pre-commit: `npx vitest run`

- [ ] 4.4. Fix characterTemplates type safety

  **What to do**:
  - Update `src/data/characterTemplates.ts`
  - Fix LSP error about `attributes` not existing on `CharacterSheet`
  - Use type-specific template functions or type assertions

  **Must NOT do**:
  - Change template data
  - Remove any templates

  **Parallelizable**: YES (with 4.3)

  **References**:
  - LSP error at `characterTemplates.ts:14`
  - `shared/rulesets/characterSheet.ts` - Character type definitions

  **Acceptance Criteria**:
  - [ ] `npm run build` → 0 errors in characterTemplates
  - [ ] Templates work correctly for both rulesets

  **Commit**: YES
  - Message: `fix(templates): add type safety to character templates`
  - Files: `src/data/characterTemplates.ts`
  - Pre-commit: `npx vitest run`

---

### Phase 5: Refactor Bot AI

- [ ] 5.1. Make bot character creation ruleset-aware

  **What to do**:
  - Update `server/src/bot.ts:25` - Remove default `'gurps'` parameter
  - Require explicit `rulesetId` in `createBotCharacter()`
  - Update callers to pass rulesetId

  **Must NOT do**:
  - Change bot character stats
  - Implement new bot strategies

  **Parallelizable**: NO (depends on Phase 4)

  **References**:
  - `server/src/bot.ts:25` - `createBotCharacter` with default
  - Callers of `createBotCharacter` (use `lsp_find_references`)

  **Acceptance Criteria**:
  - [ ] `createBotCharacter` requires explicit rulesetId
  - [ ] All callers updated
  - [ ] `npm run build` → exits 0

  **Commit**: YES
  - Message: `refactor(bot): require explicit rulesetId for bot character creation`
  - Files: `server/src/bot.ts`, caller files
  - Pre-commit: `npx vitest run`

- [ ] 5.2. Make bot defense selection ruleset-aware

  **What to do**:
  - Update `server/src/bot.ts:159` - Use `getServerAdapter(rulesetId)` instead of hardcoded GURPS
  - Bot should use `adapter.combat.selectBotDefense()` if available
  - For PF2, adapter returns `null` (no change needed there)

  **Must NOT do**:
  - Implement PF2 bot defense (stays null)
  - Change GURPS bot defense logic

  **Parallelizable**: NO (after 5.1)

  **References**:
  - `server/src/bot.ts:159` - Hardcoded GURPS adapter
  - `shared/rulesets/serverAdapter.ts:86-90` - `selectBotDefense` in combat domain

  **Acceptance Criteria**:
  - [ ] Bot uses `getServerAdapter(match.rulesetId)` for defense
  - [ ] GURPS bot still defends correctly
  - [ ] PF2 bot gracefully handles null defense
  - [ ] `npm run build` → exits 0

  **Commit**: YES
  - Message: `refactor(bot): use ruleset adapter for defense selection`
  - Files: `server/src/bot.ts`
  - Pre-commit: `npx vitest run`

- [ ] 5.3. Remove legacy chooseBotDefense if unused

  **What to do**:
  - Search for usages: `grep -r "chooseBotDefense" server/`
  - If only defined but not called, remove the function
  - If still used, update callers to use adapter pattern

  **Must NOT do**:
  - Remove if still used
  - Change defense logic

  **Parallelizable**: YES (with 5.2)

  **References**:
  - `server/src/bot.ts:151-190` - Legacy `chooseBotDefense` function

  **Acceptance Criteria**:
  - [ ] Either: function removed, or function updated to use adapter
  - [ ] `grep "chooseBotDefense" server/` → 0 results or all using adapter
  - [ ] `npm run build` → exits 0

  **Commit**: YES
  - Message: `refactor(bot): remove/update legacy chooseBotDefense`
  - Files: `server/src/bot.ts`
  - Pre-commit: `npx vitest run`

---

### Phase 6: Remove Remaining Scattered Conditionals

- [ ] 6.1. Move character creation conditional to registry

  **What to do**:
  - Update `src/App.tsx:20` - Move `if (rulesetId === 'pf2')` character creation to registry
  - Add `createCharacter()` or similar to `Ruleset` interface
  - Each ruleset provides its own character factory

  **Must NOT do**:
  - Change character structure
  - Change default values

  **Parallelizable**: NO (highest risk, do after all else)

  **References**:
  - `src/App.tsx:20` - Character sheet conditional creation
  - `shared/rulesets/Ruleset.ts` - Ruleset interface

  **Acceptance Criteria**:
  - [ ] No `=== 'pf2'` in App.tsx for character creation
  - [ ] Characters created via registry
  - [ ] `npm run build` → exits 0

  **Commit**: YES
  - Message: `refactor(app): use ruleset registry for character creation`
  - Files: `src/App.tsx`, `shared/rulesets/Ruleset.ts`, ruleset bundles
  - Pre-commit: `npx vitest run`

- [ ] 6.2. Move template selection to registry

  **What to do**:
  - Update `src/components/rulesets/useCharacterEditor.ts`
  - Move `rulesetId === 'pf2' ? PF2_TEMPLATE_NAMES : TEMPLATE_NAMES` to registry
  - Add `getTemplateNames()` to `RulesetUIAdapter`

  **Must NOT do**:
  - Change templates themselves
  - Remove any templates

  **Parallelizable**: YES (with 6.3)

  **References**:
  - `src/components/rulesets/useCharacterEditor.ts:19` - Template selection conditional
  - `shared/rulesets/Ruleset.ts` - UI adapter interface

  **Acceptance Criteria**:
  - [ ] No `=== 'pf2'` in useCharacterEditor for templates
  - [ ] Templates accessed via adapter
  - [ ] `npm run build` → exits 0

  **Commit**: YES
  - Message: `refactor(editor): use adapter for template selection`
  - Files: `useCharacterEditor.ts`, `Ruleset.ts`, adapters
  - Pre-commit: `npx vitest run`

- [ ] 6.3. Move defense modal conditional to slots

  **What to do**:
  - Update `src/components/game/GameScreen.tsx:385`
  - Replace `matchState?.rulesetId !== 'pf2'` with slot-based rendering
  - Add defense modal slot to `rulesetUiSlots.ts`
  - GURPS provides DefenseModal, PF2 provides null

  **Must NOT do**:
  - Change defense modal functionality
  - Implement PF2 defense modal

  **Parallelizable**: YES (with 6.2)

  **References**:
  - `src/components/game/GameScreen.tsx:385-395` - Defense modal conditional
  - `src/components/game/shared/rulesetUiSlots.ts` - Slot pattern

  **Acceptance Criteria**:
  - [ ] No `!== 'pf2'` for defense modal in GameScreen
  - [ ] Defense modal rendered via slot
  - [ ] GURPS shows modal, PF2 doesn't
  - [ ] `npm run build` → exits 0

  **Commit**: YES
  - Message: `refactor(game): use slot pattern for defense modal`
  - Files: `GameScreen.tsx`, `rulesetUiSlots.ts`
  - Pre-commit: `npx vitest run`

- [ ] 6.4. Move close combat rejection to adapter

  **What to do**:
  - Update `server/src/handlers/gurps/close-combat.ts:34,132`
  - Instead of `if (match.rulesetId === 'pf2')` early return
  - Check `adapter.closeCombat` availability: if undefined, return appropriate error

  **Must NOT do**:
  - Implement PF2 close combat
  - Change close combat logic

  **Parallelizable**: YES (with 6.2, 6.3)

  **References**:
  - `server/src/handlers/gurps/close-combat.ts:34,132` - PF2 rejection
  - `shared/rulesets/serverAdapter.ts:108-113` - closeCombat domain

  **Acceptance Criteria**:
  - [ ] No `=== 'pf2'` checks in close-combat.ts
  - [ ] PF2 still gracefully rejected (via adapter check)
  - [ ] `npm run build` → exits 0

  **Commit**: YES
  - Message: `refactor(combat): check adapter capability instead of rulesetId`
  - Files: `server/src/handlers/gurps/close-combat.ts`
  - Pre-commit: `npx vitest run`

- [ ] 6.5. Move action routing to adapter

  **What to do**:
  - Update `server/src/handlers.ts:507`
  - Replace `if (match.rulesetId === 'pf2')` with adapter-based routing
  - Consider action type dispatch via adapter

  **Must NOT do**:
  - Change action handling logic
  - Combine GURPS/PF2 handlers

  **Parallelizable**: NO (after 6.4, highest impact)

  **References**:
  - `server/src/handlers.ts:507` - PF2 action routing
  - `shared/rulesets/serverAdapter.ts` - Adapter pattern

  **Acceptance Criteria**:
  - [ ] No `=== 'pf2'` for action routing in handlers.ts
  - [ ] Actions routed via adapter or registry
  - [ ] Both rulesets handle actions correctly
  - [ ] `npm run build` → exits 0

  **Commit**: YES
  - Message: `refactor(handlers): use adapter for action routing`
  - Files: `server/src/handlers.ts`
  - Pre-commit: `npx vitest run`

---

### Phase 7: Final Verification

- [ ] 7.1. Run full verification suite

  **What to do**:
  - Run all automated checks
  - Compare violation counts to baseline
  - Document final metrics

  **Verification Commands**:
  ```bash
  # Automated checks
  npm run build
  npx vitest run
  npm run lint

  # Violation counts (should be 0)
  grep -r "?? 'gurps'" --include="*.ts" . | wc -l
  grep -r "=== 'pf2'" --include="*.ts" src/ server/src/handlers.ts | wc -l
  grep -r "=== 'gurps'" --include="*.ts" src/ server/src/handlers.ts | wc -l
  ```

  **Must NOT do**:
  - Skip any verification step

  **Parallelizable**: NO (final check)

  **Acceptance Criteria**:
  - [ ] `npm run build` → exits 0
  - [ ] `npx vitest run` → all tests pass
  - [ ] `npm run lint` → exits 0
  - [ ] `?? 'gurps'` count: 0 (or 1 if explicit helper)
  - [ ] `=== 'pf2'` outside rulesets/: 0
  - [ ] `=== 'gurps'` outside rulesets/: 0

  **Commit**: NO (verification only)

- [ ] 7.2. Manual testing - GURPS match

  **What to do**:
  - Start dev server: `npm run dev` (client) + `npm run dev --prefix server` (server)
  - Create GURPS match with bot
  - Verify: movement works, attack works, bot defends, damage applied
  - Take screenshots as evidence

  **Using Playwright browser automation**:
  - Navigate to: `http://localhost:5173`
  - Create lobby, add bot, select GURPS ruleset
  - Start match
  - Perform: move, attack bot, verify bot defense
  - Screenshot: `.sisyphus/evidence/7.2-gurps-match.png`

  **Must NOT do**:
  - Skip if automated tests pass (manual verification required)

  **Parallelizable**: NO

  **Acceptance Criteria**:
  - [ ] GURPS match starts successfully
  - [ ] Player can move on hex grid
  - [ ] Player can attack bot
  - [ ] Bot defends (dodge/parry/block)
  - [ ] Damage is applied correctly
  - [ ] Screenshot captured

  **Commit**: NO (verification only)

- [ ] 7.3. Manual testing - PF2 match

  **What to do**:
  - Create PF2 match (with bot or second player)
  - Verify: movement works on square grid, strike works, MAP applied
  - Note: defense not implemented (expected)

  **Using Playwright browser automation**:
  - Navigate to: `http://localhost:5173`
  - Create lobby, select PF2 ruleset
  - Start match
  - Perform: stride, strike
  - Screenshot: `.sisyphus/evidence/7.3-pf2-match.png`

  **Must NOT do**:
  - Expect PF2 defense to work (it's a stub)

  **Parallelizable**: YES (with 7.2)

  **Acceptance Criteria**:
  - [ ] PF2 match starts successfully
  - [ ] Player can move on square grid
  - [ ] Player can strike
  - [ ] MAP is displayed correctly
  - [ ] Screenshot captured

  **Commit**: NO (verification only)

- [ ] 7.4. Document new ruleset addition process

  **What to do**:
  - Update `AGENTS.md` "Adding a New Ruleset" section
  - Document the refactored patterns
  - List files to modify for new ruleset

  **Must NOT do**:
  - Actually add a new ruleset

  **Parallelizable**: YES (with 7.2, 7.3)

  **References**:
  - `AGENTS.md` - Existing "Adding a New Ruleset" section

  **Acceptance Criteria**:
  - [ ] AGENTS.md updated with refactored patterns
  - [ ] Clear step-by-step for adding ruleset
  - [ ] No outdated references to conditionals

  **Commit**: YES
  - Message: `docs: update AGENTS.md with refactored ruleset patterns`
  - Files: `AGENTS.md`
  - Pre-commit: N/A (docs only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 0.1 | `chore: document baseline metrics` | None | N/A |
| 1.1 | `test(rulesets): add server adapter tests` | `serverAdapter.test.ts` | `npx vitest run` |
| 1.2 | `test(rulesets): add type guard tests` | `typeGuards.test.ts` | `npx vitest run` |
| 2.1 | `feat(rulesets): add ruleset assertion helpers` | `defaults.ts`, test | `npx vitest run` |
| 2.2 | `refactor(server): require explicit rulesetId` | Server files | `npx vitest run` |
| 2.3 | `refactor(client): require explicit rulesetId` | Client files | `npx vitest run` |
| 2.4 | `fix(db): ensure rulesetId defined` | `db.ts` | `npx vitest run` |
| 3.1 | `feat(rulesets): add getGridType helper` | `index.ts`, test | `npx vitest run` |
| 3.2 | `refactor(arena): use getGridType` | `ArenaScene.tsx` | `npx vitest run` |
| 3.3 | `refactor(minimap): use getGridType` | `MiniMap.tsx` | `npx vitest run` |
| 3.4 | `refactor(arena): derive facing arcs from adapter` | Multiple | `npx vitest run` |
| 4.1 | `fix(gurps-ui): add type guards` | GURPS components | `npx vitest run` |
| 4.2 | `fix(hooks): add type guards to useGameActions` | `useGameActions.ts` | `npx vitest run` |
| 4.3 | `refactor(ui): remove GURPS imports from shared` | Multiple | `npx vitest run` |
| 4.4 | `fix(templates): add type safety` | `characterTemplates.ts` | `npx vitest run` |
| 5.1 | `refactor(bot): require explicit rulesetId` | `bot.ts` | `npx vitest run` |
| 5.2 | `refactor(bot): use adapter for defense` | `bot.ts` | `npx vitest run` |
| 5.3 | `refactor(bot): remove legacy function` | `bot.ts` | `npx vitest run` |
| 6.1 | `refactor(app): use registry for character creation` | `App.tsx`, adapters | `npx vitest run` |
| 6.2 | `refactor(editor): use adapter for templates` | `useCharacterEditor.ts` | `npx vitest run` |
| 6.3 | `refactor(game): use slot for defense modal` | `GameScreen.tsx` | `npx vitest run` |
| 6.4 | `refactor(combat): check adapter capability` | `close-combat.ts` | `npx vitest run` |
| 6.5 | `refactor(handlers): use adapter for routing` | `handlers.ts` | `npx vitest run` |
| 7.4 | `docs: update ruleset addition process` | `AGENTS.md` | N/A |

---

## Success Criteria

### Verification Commands
```bash
# All must pass
npm run build          # Expected: exits 0, no TypeScript errors
npx vitest run         # Expected: all tests pass
npm run lint           # Expected: exits 0

# Violation counts (all should be 0)
grep -r "?? 'gurps'" --include="*.ts" . | grep -v node_modules | wc -l   # Expected: 0
grep -r "=== 'pf2'" --include="*.ts" src/ | wc -l                        # Expected: 0
grep -r "=== 'gurps'" --include="*.ts" src/ | wc -l                      # Expected: 0
```

### Final Checklist
- [ ] All "Must Have" deliverables present
- [ ] All "Must NOT Have" guardrails respected (no PF2 feature implementation)
- [ ] All 24 tasks completed
- [ ] All tests pass
- [ ] Manual testing confirms both rulesets work
- [ ] AGENTS.md updated with new patterns
