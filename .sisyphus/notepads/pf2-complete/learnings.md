# PF2 Panel Verification - Task 0 Complete

## Verification Date
2025-01-29 02:24 AM

## Summary
✅ **VERIFIED**: PF2 panels now render correctly after GameScreen.tsx fix.

## What Was Verified

### 1. Dev Servers Started Successfully
- Client dev server: ✅ Running on localhost:5173
- Server dev server: ✅ Running on localhost:8080
- Both servers connected and communicating

### 2. App Loads Without Errors
- ✅ App loads at http://localhost:5173
- ✅ WebSocket connection established
- ✅ No console errors

### 3. PF2 Match Created Successfully
- ✅ Ruleset selector shows "Pathfinder 2e" option
- ✅ New Match button creates PF2 match
- ✅ Match starts without errors
- ✅ Game screen loads with 3D arena

### 4. PF2GameStatusPanel Renders Correctly
**Location**: Left panel of game screen

**Elements Verified**:
- ✅ Character name: "TestPlayer"
- ✅ HP bar: Shows 20/20 (green bar visible)
- ✅ **Action pips**: Shows 3 green circles (●●●) - PF2-specific action economy
- ✅ Abilities section: STR 14, DEX 12, CON 14, INT 10, WIS 10, CHA 10
- ✅ AC: 14 and Speed: 25 ft displayed
- ✅ Weapons section: Longsword 1d8 listed
- ✅ Participants section: Shows Bot 3 and TestPlayer

**Critical Fix Verified**: No "Loading..." placeholder - panel fully renders with actual character data

### 5. PF2GameActionPanel Renders Correctly
**Location**: Right panel of game screen

**Elements Verified**:
- ✅ Header: "Your Turn (3 actions)"
- ✅ **Action pips**: Shows 3 diamond symbols (◆◆◆) - PF2-specific action display
- ✅ All PF2 action buttons present:
  - ⚔️ Strike
  - 🏃 Stride
  - 👣 Step
  - 🔻 Drop Prone
  - 🛡️ Raise Shield
  - ✋ Interact
- ✅ "End Turn (3 unused)" button
- ✅ "Give Up" button

**Critical Fix Verified**: No "Loading..." placeholder - panel fully renders with action buttons

### 6. No "Loading..." Placeholders
- ✅ Status panel: Shows actual character data, not "Loading..."
- ✅ Action panel: Shows action buttons, not "Waiting for match..."
- ✅ Both panels render immediately when match starts

## Technical Details

### GameScreen.tsx Fix Impact
The fix removed hardcoded `rulesetId === 'gurps'` checks and now uses `getRulesetComponents()` to dynamically select the correct panels based on ruleset.

**Before**: PF2 matches showed "Loading..." placeholders
**After**: PF2 matches show fully functional PF2-specific panels

### PF2-Specific UI Elements Confirmed
1. **Action Pips**: PF2 uses action economy (3 actions per turn) displayed as circles/diamonds
2. **Action Buttons**: All 6 core PF2 actions available (Strike, Stride, Step, Drop Prone, Raise Shield, Interact)
3. **Character Stats**: Displays PF2 ability scores and AC correctly
4. **Speed**: Shows movement speed in feet (25 ft)

## Regression Testing
- ✅ GURPS matches still work (verified in previous session)
- ✅ No TypeScript errors
- ✅ No console errors during gameplay

## Screenshot Evidence
- File: `pf2-panels-verification.png`
- Shows full game screen with both panels rendering correctly
- Timestamp: 2025-01-29 02:24 AM

## Next Steps
Task 0 (GameScreen.tsx fix) is complete and verified. Ready to proceed with:
- Task 1: Audit and fix test fixtures
- Task 2: Fix MAP tracking in attack handler
- Task 3: Implement Stride action

## Notes
- The fix is minimal and focused - only changes panel selection logic
- No changes to panel component internals
- Both GURPS and PF2 panels work correctly
- Ready for Wave 1 tasks to begin

## Test Fixture Audit - COMPLETED

### Summary
✅ All 356 tests pass
✅ TypeScript type check: 0 errors
✅ Production build: SUCCESS
✅ All test fixtures properly typed with `rulesetId`

### Findings

1. **Test Fixtures Status**
   - PF2 tests (`shared/rulesets/pf2/rules.test.ts`): All fixtures have `rulesetId: 'pf2'`
   - GURPS tests (`shared/rules.test.ts`): All fixtures have `rulesetId: 'gurps'`
   - No `CombatantState | undefined` issues found
   - No null check issues in test code

2. **Type Safety**
   - All combatant fixtures properly typed with required fields
   - No missing `rulesetId` in any test fixture
   - Type guards working correctly across both rulesets

3. **Build Status**
   - `npm run build` completes successfully
   - Minor warning: JS chunk size > 500KB (expected for this project)
   - No TypeScript compilation errors

### Verification Commands Run
```bash
npx tsc --noEmit --project tsconfig.json  # ✅ 0 errors
npx vitest run                             # ✅ 356 tests passed
npm run build                              # ✅ SUCCESS
```

### Conclusion
Test fixtures are properly typed and all tests pass. No fixes needed. The multi-ruleset architecture is correctly implemented with proper type safety across GURPS and PF2 systems.

## MAP Tracking Implementation (Completed)

### Changes Made

1. **Attack Handler** (`server/src/handlers/pf2/attack.ts`):
   - Removed hardcoded `attackNumber = 0`
   - Read `mapPenalty` from `actorCombatant.mapPenalty || 0`
   - Apply penalty to attack roll: `totalAttackBonus = abilityMod + profBonus + mapPenalty`
   - After attack: increment MAP with proper capping logic
   - Agile weapons: -4/-8 progression
   - Non-agile weapons: -5/-10 progression

2. **UI Component** (`src/components/rulesets/pf2/PF2GameActionPanel.tsx`):
   - Removed hardcoded `attacksThisTurn = 0` and `getMapPenalty()` function
   - Read directly from `combatant.mapPenalty`
   - Updated badge display condition from `attacksThisTurn > 0` to `mapPenalty < 0`

3. **Tests** (`shared/rulesets/pf2/map.test.ts`):
   - Created comprehensive test suite for MAP behavior
   - Verified progression: 0 → -5 → -10 (non-agile)
   - Verified progression: 0 → -4 → -8 (agile)
   - Verified capping logic
   - Verified semantics (negative values, addition subtracts)

### Key Patterns

**MAP Increment Pattern:**
```typescript
const isAgile = weapon.traits.includes('agile');
const minPenalty = isAgile ? -8 : -10;
const penaltyStep = isAgile ? -4 : -5;
const newMapPenalty = Math.max(minPenalty, (c.mapPenalty || 0) + penaltyStep);
```

**MAP Application Pattern:**
```typescript
const mapPenalty = actorCombatant.mapPenalty || 0;
const totalAttackBonus = abilityMod + profBonus + mapPenalty; // Adding negative = subtracting
```

### Verification

- ✅ All existing tests pass
- ✅ New MAP tests pass (14 tests)
- ✅ Client build passes
- ✅ Server build passes
- ✅ MAP resets to 0 on turn advance (already implemented in `advanceTurn`)


# PF2 Stride Implementation - Learnings

## Flow Pattern
- PF2 stride uses a 2-step flow: `pf2_request_move` populates `reachableHexes` on MatchState, then `pf2_stride` validates and moves
- Unlike GURPS which uses `turnMovement.phase === 'moving'`, PF2 stride uses `reachableHexes` presence without turnMovement
- App.tsx `handleGridClick` checks for PF2 reachableHexes separately from GURPS movement phase

## Key Patterns
- `getReachableSquares()` returns a Map keyed by `q,r` string, with cost per cell
- Grid coordinates: position.x = q, position.z = r (y is always 0 for ground level)
- PF2CombatActionPayload union type in `shared/rulesets/pf2/types.ts` must include all PF2-specific action types
- Router in `server/src/handlers/pf2/router.ts` has its own local PF2ActionPayload type that must stay in sync

## Files Modified
- `shared/rulesets/pf2/types.ts` - Added pf2_request_move, pf2_stride to PF2CombatActionPayload
- `server/src/handlers/pf2/stride.ts` - NEW: handlePF2RequestMove + handlePF2Stride
- `server/src/handlers/pf2/router.ts` - Wired new handlers, replaced stride stub
- `src/components/rulesets/pf2/PF2GameActionPanel.tsx` - Stride button sends pf2_request_move
- `src/components/rulesets/pf2/PF2ActionBar.tsx` - Same for mobile
- `src/App.tsx` - handleGridClick dispatches pf2_stride when overlay active
- `shared/rulesets/pf2/rules.test.ts` - 6 new stride tests

## Stand & Drop Prone Implementation - Completed

### Changes Made

1. **handlePF2DropProne** (`server/src/handlers/pf2/actions.ts`):
   - Added `{ condition: 'prone' }` to `combatant.conditions` array
   - Costs 1 action via `updateCombatantActions(c, 1)`
   - Validates 1+ action available before executing
   - Logs action to match log

2. **handlePF2Stand** (`server/src/handlers/pf2/actions.ts`):
   - Checks if combatant has `prone` condition
   - Returns error if not prone
   - Removes prone condition from array via filter
   - Costs 1 action via `updateCombatantActions(c, 1)`
   - Validates 1+ action available before executing
   - Logs action to match log

### Key Patterns

**Condition Management Pattern:**
```typescript
// Add condition
conditions: [...c.conditions, { condition: 'prone' as const }]

// Remove condition
conditions: c.conditions.filter(cond => cond.condition !== 'prone')

// Check condition exists
if (!combatant.conditions.some(c => c.condition === 'prone'))
```

**Action Cost Pattern:**
```typescript
// Use updateCombatantActions helper
return {
  ...updateCombatantActions(c, 1),
  conditions: [...c.conditions, { condition: 'prone' as const }],
};
```

### Verification

- ✅ All 55 PF2 tests pass
- ✅ Server builds successfully
- ✅ Drop Prone adds prone condition to array
- ✅ Stand removes prone condition from array
- ✅ Both actions cost 1 action
- ✅ Stand fails if not prone
- ✅ Both fail if 0 actions remaining

### Type Safety

- Used `as const` for condition type to satisfy TypeScript
- Checked `isPF2Combatant()` before accessing PF2-specific fields
- Properly typed `ConditionValue` with `condition: PF2Condition`


## PF2 Condition Effect System (2026-01-29)

- `PF2CombatantState` has both `conditions: ConditionValue[]` (authoritative) and `statusEffects: string[]` (legacy GURPS pattern). UI was rendering `statusEffects` instead of `conditions`.
- Condition modifiers are pure functions in `shared/rulesets/pf2/conditions.ts` — keeps attack handler clean.
- Attack handler currently hardcodes `'melee'` attack type. When ranged attacks are added, need to pass actual attack type to `getConditionACModifier`.
- PF2 circumstance penalties technically don't stack (worst penalty applies), but for prone + flat_footed the simple sum works since they affect different aspects. May need revisiting when more conditions are added.

## AoO Reaction System (2026-01-29)

### Router Changes
- Added `pf2_reaction_choice` to local `PF2ActionPayload` in `router.ts` (must stay in sync with `PF2CombatActionPayload` in shared types).
- Router dispatches to `handlePF2ReactionChoice` without `actorCombatant` param (reaction handler finds combatants from `match.pendingReaction`).

### Test Pattern for Server-Side Functions
- Server handler functions (in `server/src/handlers/`) need extensive mocking when tested from `shared/` location.
- Mock targets: `server/src/helpers`, `server/src/state`, `server/src/db`, `server/src/bot`, `shared/rulesets/serverAdapter`.
- The `vi.mock` path is resolved relative to the test file, not the module being tested.
- Use `vi.fn()` references declared before `vi.mock` to allow per-test customization with `mockReturnValue`.

### AoO Flow
1. `handlePF2Stride` → `getAoOReactors()` detects adjacent enemies with reaction available.
2. Bot reactors: auto-execute via `executeAoOStrike`.
3. Player reactors: set `pendingReaction` on match state, send `reaction_prompt` message.
4. Player responds with `pf2_reaction_choice` → router → `handlePF2ReactionChoice`.
5. Handler executes or declines AoO, clears `pendingReaction`, resumes stride via `resumeStrideAfterReaction`.

### Client-Side Gap
- `reaction_prompt` message type exists in `shared/types.ts` (line 146) but NO client handler exists.
- No component in `src/` handles this message. Players won't see the prompt yet.
- This is a known gap for a future UI task.

### Key Design: AoO Ignores MAP
- `executeAoOStrike` intentionally does NOT include `reactor.mapPenalty` in the attack bonus.
- AoO is a reaction, not an action on your turn, so MAP doesn't apply (PF2 core rules).

## PF2 Bot AI Multi-Action Loop (2026-01-29)

### Changes Made

1. **`server/src/rulesets/pf2/bot.ts`** - Complete rewrite:
   - Removed hardcoded `attacksThisTurn = 0` and nested `pf2` object writes
   - Added `decidePF2BotAction()`: returns strike (if adjacent + MAP < -10), stride (if not adjacent), or null
   - Added `executeBotStrike()`: single strike with correct MAP tracking (penaltyStep: -5 non-agile, -4 agile)
   - Added `executeBotStride()`: move toward enemy, decrement actionsRemaining
   - Kept `executeBotAttack` as legacy fallback (wraps executeBotStrike + advanceTurn)

2. **`server/src/bot.ts`** - PF2 multi-action loop in `scheduleBotTurn`:
   - Detects `rulesetId === 'pf2'` and `isPF2Combatant(botCombatant)`
   - Loops: decide action → execute → refresh state → repeat until no actions/no valid action
   - Safety cap at 10 iterations to prevent infinite loops
   - After loop: `advanceTurn()` to end bot's turn

3. **`server/src/rulesets/pf2/bot.test.ts`** - 18 unit tests:
   - Decision logic: no actions, no enemies, adjacent strike, distant stride, MAP maxed
   - Strike execution: actionsRemaining decrement, MAP progression (non-agile -5, agile -4), capping at -10
   - Stride execution: position update, actionsRemaining decrement, log entry
   - Multi-action simulation: 3 actions used, MAP stopping logic, stride-then-strike

### Key Patterns

**Bot Decision Loop:**
```typescript
while (actionsTaken < maxActions) {
  const action = decidePF2BotAction(match, currentBot, character);
  if (!action) break;
  if (action.type === 'strike') match = executeBotStrike(...);
  else if (action.type === 'stride') match = executeBotStride(...);
  match = checkVictory(match);
}
const finalState = advanceTurn(match);
```

**MAP in Bot Strike:**
```typescript
const minPenalty = isAgile ? -8 : -10;
const penaltyStep = isAgile ? -4 : -5;
const newMapPenalty = Math.max(minPenalty, mapPenalty + penaltyStep);
```

### Testing Pattern
- Mocked `server/src/helpers` with inline square grid distance calculation
- Mocked `server/src/state`, `server/src/db` to avoid server dependencies
- Pure unit tests for `decidePF2BotAction`, `executeBotStrike`, `executeBotStride`

## Mobile UI Wire-up (Task 10) - Completed

### Summary
✅ **VERIFIED**: PF2ActionBar is already wired up for mobile UI in GameScreen.tsx.

### Implementation Status

The mobile ActionBar is already correctly implemented via dynamic component selection:

1. **GameScreen.tsx (lines 147-151)**:
   ```typescript
   const rulesetId = matchState?.rulesetId ?? 'gurps'
   const { GameStatusPanel, GameActionPanel, ActionBar } = useMemo(
     () => getRulesetComponents(rulesetId),
     [rulesetId]
   )
   ```

2. **ActionBar Rendering (line 445)**:
   - Single ActionBar component rendered for both GURPS and PF2
   - Component type determined by `getRulesetComponents(rulesetId)`
   - For GURPS: renders `GurpsActionBar`
   - For PF2: renders `PF2ActionBar`

3. **CSS Styling**:
   - `.action-bar { display: none }` by default
   - `@media (max-width: 768px)` shows ActionBar with `display: flex`
   - Mobile-optimized layout with touch-friendly buttons (min-height: 44px)

### Verification

- ✅ `npm run build` → SUCCESS (0 errors)
- ✅ `npx vitest run` → 442 tests pass
- ✅ PF2ActionBar component exists and is exported
- ✅ GurpsActionBar component exists and is exported
- ✅ Both components have identical props (ActionBarProps)
- ✅ getRulesetComponents() returns correct component for each ruleset
- ✅ Mobile CSS media query shows ActionBar on small screens

### Key Insight

The implementation uses the **registry pattern** (`getRulesetComponents()`) to dynamically select the correct ActionBar component based on the ruleset. This is the same pattern used for desktop panels (GameStatusPanel, GameActionPanel), ensuring consistency across the codebase.

### No Changes Required

Task 10 is already complete. The mobile UI is correctly wired up for both GURPS and PF2 matches. No code changes needed.

