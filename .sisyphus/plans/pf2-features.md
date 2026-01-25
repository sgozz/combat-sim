# PF2 Feature Completion: Step, Stand, Drop Prone, Flat-footed

## Context

### Original Request
Complete the PF2 feature implementation by adding Step, Stand, Drop Prone actions and flat-footed condition support.

### Interview Summary
**Key Discussions**:
- This is Phase 5 of the multi-ruleset migration (Phases 1-4 complete)
- 4 specific features: Step, Stand, Drop Prone, flat-footed
- Follow existing patterns from GURPS `change_posture` handler

**Research Findings**:
- Types already defined in `shared/rulesets/pf2/types.ts`: `PF2ActionPayload` has `step`, `stand`, `drop_prone`
- `getActionCost()` already handles these action types
- UI components: `PF2GameActionPanel.tsx` and `PF2ActionBar.tsx` both need updates
- Server uses `posture` field (from GURPS base) - use this for prone, not conditions array

### Metis Review
**Critical Bug Identified**:
- `getActionCost('step')` returns `'free'` but PF2 RAW says **1 action**
- Test at `rules.test.ts:276` expects `'free'` - also wrong
- **MUST FIX** as part of this work

**Identified Gaps** (addressed):
- Prone storage: Use existing `posture` field for consistency
- Flat-footed application: Apply at attack resolution, not in calculateAC()
- Step restrictions: Cannot Step while prone

---

## Work Objectives

### Core Objective
Add 4 PF2 combat features (Step, Stand, Drop Prone, flat-footed) following established patterns.

### Concrete Deliverables
1. Fix Step action cost to 1 (from incorrect 'free')
2. Server handlers for `pf2_step`, `pf2_stand`, `pf2_drop_prone` actions
3. UI buttons in both `PF2GameActionPanel.tsx` and `PF2ActionBar.tsx`
4. Flat-footed -2 AC penalty in `pf2-attack.ts`
5. Unit tests for all new functionality

### Definition of Done
- [ ] `npx vitest run` → All tests pass (including new tests)
- [ ] `npm run build` → Client builds without errors
- [ ] `npm run build --prefix server` → Server builds without errors
- [ ] Step action costs 1 action (not free)
- [ ] Stand/Drop Prone change posture correctly
- [ ] Flat-footed applies -2 AC during attacks

### Must Have
- Step: 1 action, move exactly 1 square, blocked if prone
- Stand: 1 action, changes posture from prone to standing
- Drop Prone: free action, changes posture from standing to prone
- Flat-footed: -2 AC penalty applied in attack resolution

### Must NOT Have (Guardrails)
- NO Crawl action (out of scope)
- NO Attack of Opportunity / Reactive Strike implementation
- NO difficult terrain handling
- NO condition duration tracking
- NO modifications to GURPS code paths
- NO changes to calculateAC() function signature
- NO other conditions beyond flat-footed and prone

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Vitest)
- **User wants tests**: YES (TDD for rules, tests-after for handlers)
- **Framework**: Vitest with happy-dom

### Verification Commands
```bash
# Run all tests
npx vitest run

# Run PF2 tests specifically
npx vitest run -t "PF2"

# Type check
npm run build
npm run build --prefix server

# Manual testing
npm run dev &
npm run dev --prefix server
# Then play a PF2 match and test each action
```

---

## Task Flow

```
Task 0 (Bug Fix: Step cost)
       ↓
Task 1 (Add CombatActionPayload types)
       ↓
Task 2 (Drop Prone) → Task 3 (Stand) [sequential - Stand depends on prone]
       ↓
Task 4 (Step)
       ↓
Task 5 (Flat-footed)
       ↓
Task 6 (UI: Desktop) ←→ Task 7 (UI: Mobile) [parallel]
       ↓
Task 8 (Integration tests)
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 6, 7 | Independent UI files (desktop vs mobile) |

| Task | Depends On | Reason |
|------|------------|--------|
| 1 | 0 | Type updates after bug fix |
| 2 | 1 | Needs payload types |
| 3 | 2 | Stand requires prone to exist |
| 4 | 1 | Needs payload types |
| 5 | 1 | Needs flat-footed condition logic |
| 6, 7 | 2, 3, 4, 5 | UI shows buttons after handlers work |
| 8 | 6, 7 | Integration after all features |

---

## TODOs

- [x] 0. Fix Step action cost bug (1 action, not free)

  **What to do**:
  - Edit `shared/rulesets/pf2/rules.ts` line 276: change `'step'` case to return `1` instead of `'free'`
  - Edit `shared/rulesets/pf2/rules.test.ts` line 276: update test expectation from `'free'` to `1`
  - Verify no other tests depend on step being free

  **Must NOT do**:
  - Change any other action costs

  **Parallelizable**: NO (foundation for all other tasks)

  **References**:
  - `shared/rulesets/pf2/rules.ts:276-279` - getActionCost switch case for 'step'
  - `shared/rulesets/pf2/rules.test.ts:276` - Test "step is free" (needs update)
  - PF2 RAW: Step costs 1 action (confirmed via Archives of Nethys)

  **Acceptance Criteria**:
  - [ ] `getActionCost('step')` returns `1`
  - [ ] `npx vitest run -t "getActionCost"` → PASS
  - [ ] `npx vitest run shared/rulesets/pf2/rules.test.ts` → All PASS

  **Commit**: YES
  - Message: `fix(pf2): correct Step action cost from free to 1 action`
  - Files: `shared/rulesets/pf2/rules.ts`, `shared/rulesets/pf2/rules.test.ts`
  - Pre-commit: `npx vitest run shared/rulesets/pf2/rules.test.ts`

---

- [x] 1. Add PF2 action types to CombatActionPayload

  **What to do**:
  - Edit `shared/rulesets/gurps/types.ts` to add `pf2_step`, `pf2_stand`, `pf2_drop_prone` to `CombatActionPayload` union
  - Pattern: `| { type: "pf2_step"; to: { q: number; r: number } }`
  - Pattern: `| { type: "pf2_stand" }`
  - Pattern: `| { type: "pf2_drop_prone" }`

  **Must NOT do**:
  - Modify existing GURPS action types
  - Add types for actions not being implemented

  **Parallelizable**: NO (required by handlers)

  **References**:
  - `shared/rulesets/gurps/types.ts:CombatActionPayload` - Union type to extend
  - `shared/rulesets/pf2/types.ts:176-183` - PF2ActionPayload for reference (step has `to` coord)

  **Acceptance Criteria**:
  - [ ] TypeScript compiles: `npm run build` → No type errors
  - [ ] New types available: `CombatActionPayload` includes `pf2_step`, `pf2_stand`, `pf2_drop_prone`

  **Commit**: YES
  - Message: `feat(pf2): add step/stand/drop_prone action types`
  - Files: `shared/rulesets/gurps/types.ts`
  - Pre-commit: `npm run build`

---

- [x] 2. Implement Drop Prone action handler

  **What to do**:
  - Add handler in `server/src/handlers.ts` after line 809 (after `change_posture`)
  - Check: `if (payload.type === "pf2_drop_prone")`
  - Validate: Not already prone (`actorCombatant.posture !== 'prone'`)
  - Validate: PF2 ruleset only (`match.rulesetId === 'pf2'`)
  - Action: Free (no action cost)
  - Update: `posture: 'prone'`
  - Log: `"${player.name} drops prone."`
  - Do NOT call `advanceTurn` (free action)

  **Must NOT do**:
  - Consume any actions (free action)
  - End the turn
  - Modify GURPS code paths

  **Parallelizable**: NO (Stand depends on this)

  **References**:
  - `server/src/handlers.ts:769-810` - `change_posture` handler pattern
  - `shared/rulesets/pf2/rules.ts:278` - `getActionCost('drop_prone')` returns `'free'`
  - PF2 RAW: Drop Prone is a free action

  **Acceptance Criteria**:
  - [ ] Handler compiles: `npm run build --prefix server` → No errors
  - [ ] Manual test: In PF2 match, click Drop Prone → combatant becomes prone
  - [ ] Log shows: "{name} drops prone."
  - [ ] Actions remaining unchanged (free action)

  **Commit**: YES
  - Message: `feat(pf2): add drop prone action handler`
  - Files: `server/src/handlers.ts`
  - Pre-commit: `npm run build --prefix server`

---

- [x] 3. Implement Stand action handler

  **What to do**:
  - Add handler in `server/src/handlers.ts` after Drop Prone handler
  - Check: `if (payload.type === "pf2_stand")`
  - Validate: Currently prone (`actorCombatant.posture === 'prone'`)
  - Validate: PF2 ruleset only
  - Validate: Has actions remaining (costs 1)
  - Action: 1 action (update `pf2.actionsRemaining`)
  - Update: `posture: 'standing'`
  - Log: `"${player.name} stands up."`
  - Do NOT call `advanceTurn` (may have actions left)

  **Must NOT do**:
  - End the turn automatically
  - Allow standing when not prone

  **Parallelizable**: NO (Step depends on posture validation)

  **References**:
  - `server/src/handlers.ts:769-810` - `change_posture` handler pattern
  - `shared/rulesets/pf2/rules.ts:265` - `getActionCost('stand')` returns `1`
  - Task 2 handler for posture update pattern

  **Acceptance Criteria**:
  - [ ] Handler compiles: `npm run build --prefix server` → No errors
  - [ ] Manual test: When prone, click Stand → combatant becomes standing
  - [ ] Actions remaining decremented by 1
  - [ ] When not prone, Stand returns error

  **Commit**: YES
  - Message: `feat(pf2): add stand action handler`
  - Files: `server/src/handlers.ts`
  - Pre-commit: `npm run build --prefix server`

---

- [x] 4. Implement Step action handler

  **What to do**:
  - Add handler in `server/src/handlers.ts` after Stand handler
  - Check: `if (payload.type === "pf2_step")`
  - Validate: NOT prone (`actorCombatant.posture !== 'prone'`) → error "Cannot Step while prone. Use Stand first."
  - Validate: PF2 ruleset only
  - Validate: Has actions remaining (costs 1)
  - Validate: Target hex is exactly 1 square away (Chebyshev distance)
  - Validate: Target hex is not occupied
  - Action: 1 action (update `pf2.actionsRemaining`)
  - Update: `position` to target hex
  - Log: `"${player.name} steps to (${q}, ${r})."`

  **Must NOT do**:
  - Allow Step while prone
  - Allow Step more than 1 square
  - Implement AoO avoidance (not in scope)

  **Parallelizable**: NO (depends on posture logic)

  **References**:
  - `server/src/handlers.ts:812-830` - `move` handler for position update pattern
  - `server/src/handlers/movement.ts:17-91` - `handleMoveStep` for adapter pattern
  - `shared/rulesets/pf2/rules.ts:276` - `getActionCost('step')` returns `1` (after Task 0 fix)

  **Acceptance Criteria**:
  - [ ] Handler compiles: `npm run build --prefix server` → No errors
  - [ ] Manual test: Click Step + adjacent hex → combatant moves 1 square
  - [ ] Manual test: Try to Step 2+ squares → error
  - [ ] Manual test: Try to Step while prone → error "Cannot Step while prone"
  - [ ] Actions remaining decremented by 1

  **Commit**: YES
  - Message: `feat(pf2): add step action handler`
  - Files: `server/src/handlers.ts`
  - Pre-commit: `npm run build --prefix server`

---

- [x] 5. Implement flat-footed AC penalty

  **What to do**:
  - Edit `server/src/handlers/pf2-attack.ts`
  - In `handlePF2AttackAction`, after getting target AC (line 60-62)
  - Check if target has flat-footed condition OR is prone
  - Apply -2 AC penalty if flat-footed/prone
  - Add to combat log: "(flat-footed, -2 AC)" when applicable
  - Create helper: `hasCondition(combatant, 'flat_footed')` or inline check

  **Must NOT do**:
  - Modify `calculateAC()` function
  - Stack multiple flat-footed penalties
  - Implement flanking (out of scope)

  **Parallelizable**: YES (with tasks 2-4)

  **References**:
  - `server/src/handlers/pf2-attack.ts:60-62` - `calculateAC()` call
  - `shared/rulesets/pf2/types.ts:57` - `PF2Condition` includes `flat_footed`
  - `shared/rulesets/pf2/types.ts:78-81` - `ConditionValue` type
  - PF2 RAW: Flat-footed applies -2 to AC, prone makes you flat-footed

  **Acceptance Criteria**:
  - [ ] Handler compiles: `npm run build --prefix server` → No errors
  - [ ] When target is prone, attacks use AC - 2
  - [ ] Combat log shows "(flat-footed, -2 AC)" when applicable
  - [ ] Test: `npx vitest run -t "flat.footed"` → PASS (after adding test)

  **Commit**: YES
  - Message: `feat(pf2): apply flat-footed penalty during attack resolution`
  - Files: `server/src/handlers/pf2-attack.ts`
  - Pre-commit: `npm run build --prefix server`

---

- [x] 6. Add PF2 action buttons to desktop UI (PF2GameActionPanel)

  **What to do**:
  - Edit `src/components/rulesets/pf2/PF2GameActionPanel.tsx`
  - Add Step button after Stride (line 107):
    - Icon: 👣
    - Label: "Step"
    - Tooltip: "Move 5 feet. Costs 1 action. Cannot use while prone."
    - Disabled: `actionsRemaining === 0 || combatant.posture === 'prone'`
    - OnClick: Enter movement mode for 1 square only
  - Add Stand button (conditional, only when prone):
    - Icon: 🧍
    - Label: "Stand"
    - Tooltip: "Stand up from prone. Costs 1 action."
    - Show only when: `combatant.posture === 'prone'`
    - Disabled: `actionsRemaining === 0`
  - Add Drop Prone button (conditional, only when standing):
    - Icon: 🔻
    - Label: "Drop Prone"
    - Tooltip: "Drop to the ground. Free action."
    - Show only when: `combatant.posture !== 'prone'`

  **Must NOT do**:
  - Change existing button layouts significantly
  - Add buttons for unimplemented features

  **Parallelizable**: YES (with Task 7)

  **References**:
  - `src/components/rulesets/pf2/PF2GameActionPanel.tsx:77-130` - Existing action buttons
  - `src/components/rulesets/pf2/PF2GameActionPanel.tsx:50-51` - Getting combatant state
  - Pattern: Follow Stride button structure (lines 98-107)

  **Acceptance Criteria**:
  - [ ] Build passes: `npm run build` → No errors
  - [ ] Manual test: Step button visible, disabled when prone
  - [ ] Manual test: Stand button appears only when prone
  - [ ] Manual test: Drop Prone button appears only when standing
  - [ ] Tooltips display correctly on hover

  **Commit**: NO (groups with Task 7)

---

- [x] 7. Add PF2 action buttons to mobile UI (PF2ActionBar)

  **What to do**:
  - Edit `src/components/rulesets/pf2/PF2ActionBar.tsx`
  - Add Step button after Stride (line 191):
    - Icon: 👣
    - Label: "Step"
    - Same logic as desktop
  - Add Stand button (conditional):
    - Icon: 🧍
    - Label: "Stand"
  - Add Drop Prone button (conditional):
    - Icon: 🔻
    - Label: "Drop"

  **Must NOT do**:
  - Break mobile layout
  - Add complex UI elements

  **Parallelizable**: YES (with Task 6)

  **References**:
  - `src/components/rulesets/pf2/PF2ActionBar.tsx:168-198` - Main action buttons
  - Pattern: Follow Strike/Stride button structure

  **Acceptance Criteria**:
  - [ ] Build passes: `npm run build` → No errors
  - [ ] Manual test on mobile viewport: All buttons visible and functional
  - [ ] Buttons disabled/hidden appropriately based on state

  **Commit**: YES (with Task 6)
  - Message: `feat(pf2): add step/stand/drop prone buttons to UI`
  - Files: `src/components/rulesets/pf2/PF2GameActionPanel.tsx`, `src/components/rulesets/pf2/PF2ActionBar.tsx`
  - Pre-commit: `npm run build`

---

- [x] 8. Add integration tests for PF2 actions

  **What to do**:
  - Create or extend `shared/rulesets/pf2/rules.test.ts` with new tests:
    - Test: "Step costs 1 action" (already covered in Task 0)
    - Test: "Cannot Step while prone"
    - Test: "Stand removes prone condition"
    - Test: "Drop Prone sets prone condition"
    - Test: "Flat-footed applies -2 AC"
  - Ensure all tests use deterministic random function

  **Must NOT do**:
  - Add tests for unimplemented features
  - Modify existing passing tests

  **Parallelizable**: NO (final validation)

  **References**:
  - `shared/rulesets/pf2/rules.test.ts` - Existing PF2 tests
  - `shared/rulesets/gurps/rules.test.ts` - Pattern for combat tests

  **Acceptance Criteria**:
  - [ ] `npx vitest run shared/rulesets/pf2/rules.test.ts` → All PASS
  - [ ] Test coverage includes all new actions
  - [ ] Tests are deterministic (no flaky tests)

  **Commit**: YES
  - Message: `test(pf2): add tests for step/stand/prone/flat-footed`
  - Files: `shared/rulesets/pf2/rules.test.ts`
  - Pre-commit: `npx vitest run shared/rulesets/pf2/rules.test.ts`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 0 | `fix(pf2): correct Step action cost from free to 1 action` | rules.ts, rules.test.ts | `npx vitest run -t "getActionCost"` |
| 1 | `feat(pf2): add step/stand/drop_prone action types` | gurps/types.ts | `npm run build` |
| 2 | `feat(pf2): add drop prone action handler` | handlers.ts | `npm run build --prefix server` |
| 3 | `feat(pf2): add stand action handler` | handlers.ts | `npm run build --prefix server` |
| 4 | `feat(pf2): add step action handler` | handlers.ts | `npm run build --prefix server` |
| 5 | `feat(pf2): apply flat-footed penalty during attack resolution` | pf2-attack.ts | `npm run build --prefix server` |
| 6+7 | `feat(pf2): add step/stand/drop prone buttons to UI` | PF2*.tsx | `npm run build` |
| 8 | `test(pf2): add tests for step/stand/prone/flat-footed` | rules.test.ts | `npx vitest run` |

---

## Success Criteria

### Verification Commands
```bash
# All tests pass
npx vitest run  # Expected: 240+ tests pass

# Builds succeed
npm run build                     # Expected: No errors
npm run build --prefix server     # Expected: No errors

# Specific feature tests
npx vitest run -t "Step"          # Expected: PASS
npx vitest run -t "Stand"         # Expected: PASS
npx vitest run -t "prone"         # Expected: PASS
npx vitest run -t "flat.footed"   # Expected: PASS
```

### Final Checklist
- [x] Step action costs 1 action (bug fixed)
- [x] Step moves exactly 1 square
- [x] Step blocked when prone
- [x] Stand requires being prone
- [x] Stand costs 1 action
- [x] Drop Prone costs 1 action (updated from free per RAW)
- [x] Flat-footed applies -2 AC
- [x] Prone makes you flat-footed
- [x] UI buttons appear/hide correctly
- [x] All 249 tests pass
- [x] Both client and server build
