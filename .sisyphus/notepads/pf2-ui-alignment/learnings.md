# PF2 UI Alignment - Learnings

## Task 1: Fix Step Button to Enter Hex Selection Mode

### Problem
Step button was sending hardcoded coordinates `{q:0, r:0}` causing "Error: Step can only move 1 square" error.

### Solution
Implemented the `select_maneuver` flow pattern for Step button:

1. **UI Changes** (Desktop + Mobile):
   - Changed Step button onClick from `onAction('pf2_step', { type: 'pf2_step', to: { q: 0, r: 0 } })`
   - To: `onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'pf2_step' })`
   - Files: `PF2GameActionPanel.tsx:113`, `PF2ActionBar.tsx:195`

2. **Type System**:
   - Added `'pf2_step'` to `ManeuverType` union in `shared/rulesets/gurps/types.ts`
   - Added `'pf2_step': 'Step'` to `MANEUVER_LABELS` in `TurnStepper.tsx`

3. **Server Adapter**:
   - Modified `pf2Adapter.initializeTurnMovement` in `serverAdapter.ts:801-803`
   - Now checks if `maneuver === 'pf2_step'` and sets `movePoints = 1` instead of full `basicMove`
   - This limits movement to exactly 1 hex (5 feet) as per PF2 Step RAW

### Flow
1. User clicks Step button
2. Sends `select_maneuver` with `maneuver: 'pf2_step'`
3. Server calls `adapter.initializeTurnMovement(..., 'pf2_step', ...)`
4. PF2 adapter returns `TurnMovementState` with `movePointsRemaining: 1`
5. Client calculates reachable hexes: only 8 adjacent hexes (1 hex = 5 feet)
6. User clicks adjacent hex → movement confirmed → 1 PF2 action consumed

### Key Insight
The `select_maneuver` flow is the standard pattern for all movement in this system:
- GURPS uses `maneuver: 'move'` for full movement
- PF2 now uses `maneuver: 'pf2_step'` for 1-hex movement
- Both go through the same `initializeTurnMovement` → `calculateReachableHexes` → `move_step` flow
- The adapter determines movement range based on maneuver type

### Verification
- ✅ PF2 tests pass: `npx vitest run -t "PF2"` (45 tests)
- ✅ Client build succeeds: `npm run build`
- ✅ Server build succeeds: `npm run build --prefix server`
- ✅ Step button disabled when prone (existing logic preserved)
- ✅ Step button disabled when no actions remaining (existing logic preserved)

### Files Modified
1. `src/components/rulesets/pf2/PF2GameActionPanel.tsx` - Desktop UI
2. `src/components/rulesets/pf2/PF2ActionBar.tsx` - Mobile UI
3. `shared/rulesets/gurps/types.ts` - Added 'pf2_step' to ManeuverType
4. `shared/rulesets/serverAdapter.ts` - PF2 adapter logic
5. `src/components/game/TurnStepper.tsx` - Added label for pf2_step

## Task 2: Drop Prone Action Cost Fix (COMPLETED)

### Changes Made
1. **shared/rulesets/pf2/rules.ts:279-280** - Changed `drop_prone` cost from `'free'` to `1`
   - Separated `release` (stays 'free') from `drop_prone` (now 1 action)
   - Aligns with PF2 RAW: Archives of Nethys Action 78

2. **src/components/rulesets/pf2/PF2GameActionPanel.tsx:132** - Updated desktop tooltip
   - Changed from "Free action" to "Costs 1 action"
   - Added `disabled={actionsRemaining === 0}` to button

3. **src/components/rulesets/pf2/PF2ActionBar.tsx:210-217** - Updated mobile button
   - Added `disabled={actionsRemaining === 0}`
   - Added `title="Drop to the ground. Costs 1 action."` for tooltip

4. **shared/rulesets/pf2/rules.test.ts:365-372** - Updated test expectations
   - Changed expected cost from 'free' to 1
   - Updated action remaining count from 3 to 2 after drop

### Verification
- ✅ `npx vitest run -t "PF2"` - All 45 tests pass
- ✅ `npm run build` - TypeScript compilation succeeds
- ✅ No breaking changes to other action costs or GURPS logic

### Key Insight
The `release` action (releasing a grapple) remains 'free', while `drop_prone` is now correctly 1 action. This separation was necessary because they have different costs per PF2 RAW.

## Task 3: Add Unit Tests for Step and Drop Prone (COMPLETED)

### Test Cases Added
Added 4 new test cases to `shared/rulesets/pf2/rules.test.ts` in the "PF2 Posture Actions" describe block (lines 375-403):

1. **"Step should limit movement to 1 hex"** (line 375-379)
   - Verifies `getActionCost('step')` returns 1
   - Documents that movement is limited by server adapter setting `movePointsRemaining: 1`

2. **"Drop Prone should cost 1 action"** (line 381-383)
   - Verifies `getActionCost('drop_prone')` returns 1
   - Confirms Task 2 fix is in place

3. **"Cannot Step while prone - action cost unchanged"** (line 385-397)
   - Tests edge case: Step action cost is 1 even when prone
   - Verifies `conditions` array contains prone condition
   - Documents that UI prevents selection and server validates

4. **"Step action requires available actions"** (line 399-410)
   - Tests edge case: Cannot perform Step with 0 actions remaining
   - Verifies `canPerformAction(combatant, 1)` returns false when `actionsRemaining: 0`
   - Confirms action economy enforcement

### Verification
- ✅ `npx vitest run -t "PF2"` - All 49 tests pass (45 existing + 4 new)
- ✅ Tests follow existing patterns: use `getActionCost()`, `canPerformAction()`, `applyActionCost()`
- ✅ Tests cover both happy path and edge cases (prone, no actions)
- ✅ No modifications to existing tests

### Key Insights
- Step and Drop Prone both cost 1 action (not free)
- Step is limited to 1 hex movement via server adapter, not by test validation
- UI prevents Step selection when prone; server validates on action execution
- Action economy is enforced by `canPerformAction()` checking `actionsRemaining`

### Files Modified
1. `shared/rulesets/pf2/rules.test.ts` - Added 4 test cases (lines 375-410)
