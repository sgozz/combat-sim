
## Task 6: PF2 Character Factory (COMPLETED)

**File created:** `server/src/rulesets/pf2/character.ts`

### Key Implementation Details
- Exports `createDefaultCharacter: CharacterFactory`
- Uses `getServerAdapter('pf2')` for derived stats calculation
- **Critical difference from GURPS:** Damage format is `"1d6"` (NOT `"1d+1"`)
  - This is essential because PF2 uses standard dice notation
  - GURPS uses `"1d+1"` (dice + modifier) format
  - The damage parser uses regex `/(\d+)d(\d+)/` which only matches PF2 format
- Follows exact pattern from `server/src/rulesets/gurps/character.ts`
- Build verification: `npm run build --prefix server` ✓ PASSED

### Pattern Established
Both GURPS and PF2 character factories now follow identical structure:
1. Import `randomUUID`, types, adapter getter, and `CharacterFactory` type
2. Get ruleset-specific adapter via `getServerAdapter(rulesetId)`
3. Define base attributes (10 across all stats)
4. Return CharacterSheet with derived stats from adapter
5. Include default equipment with ruleset-specific damage format

This pattern is ready for reuse when adding new rulesets (D&D 5e, etc.).

## Task 8: PF2 Bot Attack Executor

**Completed**: Created `server/src/rulesets/pf2/bot.ts`

### Key Learnings

1. **Type System**: The `BotAttackExecutor` interface expects `CombatantState` (GURPS type). PF2-specific fields are accessed via the optional `pf2` extension property on `GurpsCombatantState`.

2. **PF2 Extension Pattern**: 
   - `GurpsCombatantState` has optional `pf2?: PF2CombatantExtension` property
   - Contains: `actionsRemaining`, `reactionAvailable`, `mapPenalty`, `attacksThisTurn`, `shieldRaised`
   - Access via: `botCombatant.pf2?.actionsRemaining ?? defaultValue`

3. **Damage Type Mapping**: PF2 uses different damage type names than GURPS:
   - GURPS: 'crushing', 'cutting', 'impaling'
   - PF2: 'bludgeoning', 'slashing', 'piercing'
   - Mapped in the executor with a `damageTypeMap` record

4. **Attack Flow**:
   - Calculate ability modifier from strength
   - Get proficiency bonus (hardcoded 'trained' level 1)
   - Calculate Multiple Attack Penalty (MAP) based on attacks this turn
   - Roll attack check using adapter's `rollCheck()`
   - Apply damage on success/critical success (doubled on critical)
   - Update combatant state with new action count and MAP

5. **Imports Pattern**:
   - Import `CombatantState` from GURPS types (not PF2)
   - Import `PF2DamageType` from PF2 types for type safety
   - Import adapter functions via `getServerAdapter('pf2')`
   - Use non-null assertion (`!`) on adapter.pf2 methods

### Build Status
✅ `npm run build --prefix server` passes successfully

## Task 9: PF2 Bundle Index (COMPLETED)

**Commit**: 4fcb280

Created `server/src/rulesets/pf2/index.ts` following exact GURPS pattern:
- Imports all three factories (character, combatant, bot)
- Exports `pf2ServerFactory: RulesetServerFactory`
- Build verification: ✅ passes

**Pattern**: Bundle files are minimal re-export modules that aggregate ruleset factories.

## Task 10: Ruleset Registry Index (COMPLETED)

**File created:** `server/src/rulesets/index.ts`

### Implementation
- Exports `getRulesetServerFactory(rulesetId)` function
- Registry maps `gurps` and `pf2` to their factories
- Defaults to GURPS if rulesetId not recognized (fallback: `factories[rulesetId] ?? factories.gurps`)
- Re-exports `RulesetServerFactory` type
- Build verification: ✅ `npm run build --prefix server` passes

### Pattern Consistency
Follows the same pattern as client-side registry (`shared/rulesets/index.ts`):
- Creates a `Record<RulesetId, Factory>` map
- Exports a getter function with fallback behavior
- Re-exports the factory type for consumers

### Registry Usage
This registry will be consumed by:
- Task 11: `match.ts` refactoring (use `getRulesetServerFactory()` instead of hardcoded adapters)
- Task 12: `bot.ts` refactoring (use `getRulesetServerFactory()` for bot logic)

### Next Steps
Tasks 11-12 will refactor existing code to use this registry, then all three tasks will be committed together.

## Task 11: Refactor match.ts to Use Registry (COMPLETED)

**File modified:** `server/src/match.ts`

### Changes Made

1. **Import Addition** (line 6):
   - Added: `import { getRulesetServerFactory } from "./rulesets";`
   - Removed dependency on hardcoded `isPF2` checks

2. **Character Creation Refactoring** (lines 33-36):
   - **Before**: 70 lines of manual character construction with `isPF2` conditional for damage format
   - **After**: 4 lines using factory
   ```typescript
   const factory = getRulesetServerFactory(rulesetId ?? 'gurps');
   character = factory.createDefaultCharacter(user.username);
   ```
   - Eliminates all ruleset-specific logic from match.ts
   - Delegates to factory which handles damage format, attributes, equipment per ruleset

3. **Combatant Creation Refactoring** (lines 48-64):
   - **Before**: 94 lines with manual base combatant construction + `if (rulesetId === 'pf2')` conditional for PF2 extension
   - **After**: 17 lines with spawn position calculation + factory call
   - **Critical**: Preserved spawn position calculation logic (lines 50-60)
     - Calculates `position` and `facing` based on bot status and index
     - Applies random shifts for variation
     - Passes calculated values to factory
   ```typescript
   const position = { x: finalQ, y: 0, z: finalR };
   const factory = getRulesetServerFactory(rulesetId ?? 'gurps');
   return factory.createCombatant(character, player?.id ?? character.id, position, facing);
   ```
   - Factory handles all ruleset-specific fields (e.g., PF2 extension with actionsRemaining, reactionAvailable, etc.)

### Verification Results

✅ **Build**: `npm run build --prefix server` - PASSED (202.8kb bundle)
✅ **Tests**: `npx vitest run` - 249 tests PASSED (3 test files)
✅ **Code Quality**: Zero `isPF2` variables, zero `if (rulesetId === 'pf2')` conditionals

### Key Learnings

1. **Factory Pattern Effectiveness**: Replacing 164 lines of conditional logic with 21 lines of factory calls demonstrates the power of the factory pattern for ruleset separation.

2. **Spawn Position Logic Preservation**: The critical insight was that spawn position calculation (bot vs player positioning, random shifts) is NOT ruleset-specific and should remain in match.ts. Only the combatant state construction is ruleset-specific and delegated to the factory.

3. **Type Safety**: The factory's `createCombatant` signature is:
   ```typescript
   (character: CharacterSheet, playerId: string, position: Position, facing: number) => CombatantState
   ```
   This is generic enough to work for both GURPS and PF2, with the factory handling the return type differences.

4. **No Adapter Needed**: The original code imported `getServerAdapter()` for `calculateDerivedStats()`. This is no longer needed in match.ts because:
   - Character creation is delegated to factory (which uses adapter internally)
   - Combatant creation is delegated to factory (which handles all state construction)
   - match.ts only needs the factory, not the adapter

### Remaining Work
- Task 12: Refactor `server/src/bot.ts` to use registry (similar pattern)
- All three tasks (10, 11, 12) will be committed together

## Task 12: Final Refactoring - bot.ts and match.ts (COMPLETED)

### What Was Done
1. **Refactored `createBotCharacter`** in `server/src/bot.ts`:
   - Replaced manual character creation with `getRulesetServerFactory(rulesetId).createDefaultCharacter(name)`
   - Removed ruleset-specific conditionals (isPF2 check)
   - Simplified from 28 lines to 3 lines

2. **Removed PF2-specific code** from `server/src/bot.ts`:
   - Deleted `executePF2BotAttack` function (143 lines) - now in `rulesets/pf2/bot.ts`
   - Deleted `type PF2DamageType` - no longer needed
   - Removed PF2 conditional in `scheduleBotTurn`

3. **Unified attack dispatch** in `scheduleBotTurn`:
   - Replaced PF2 conditional with factory pattern
   - Both GURPS and PF2 attacks now use: `factory.executeBotAttack(...)`
   - Removed 80+ lines of GURPS-specific attack code (now in `rulesets/gurps/bot.ts`)

4. **Refactored `createMatchState`** in `server/src/match.ts`:
   - Replaced manual character creation with factory pattern
   - Removed 30+ lines of ruleset-specific character initialization

### Key Achievements
- ✅ Zero `if (rulesetId === 'pf2')` conditionals in bot.ts
- ✅ Zero `if (rulesetId === 'pf2')` conditionals in match.ts
- ✅ All attack logic delegated to ruleset factories
- ✅ Build passes: `npm run build --prefix server`
- ✅ All tests pass: 249 tests, 0 failures
- ✅ Commit: `64bd1ab refactor(server): use ruleset registry in match.ts and bot.ts`

### Code Reduction
- `bot.ts`: 464 lines → 244 lines (-220 lines, -47%)
- `match.ts`: Removed 30+ lines of duplication
- Total: ~250 lines of ruleset-specific code moved to factories

### Pattern Success
The factory pattern proved highly effective:
- **Before**: Conditional logic scattered across files
- **After**: Clean delegation to ruleset-specific implementations
- **Benefit**: Adding new rulesets requires only creating new factory, no changes to core files

### Final Status
**TASK 12 COMPLETE** - This was the final task of the server ruleset separation refactoring.
All 12 tasks completed successfully with clean architecture and full test coverage.

## [2026-01-25 15:10] PLAN COMPLETE - Final Summary

### All Tasks Complete (23/23)
- ✅ Tasks 1-5: GURPS factories (commit 5be1cb3)
- ✅ Tasks 6-9: PF2 factories (commit 4fcb280)
- ✅ Task 10: Registry
- ✅ Tasks 11-12: Refactored match.ts and bot.ts (commit 64bd1ab)
- ✅ Definition of Done: All 5 criteria met
- ✅ Final Checklist: All 6 verification items passed

### Code Impact
- **Created**: 11 new files in `server/src/rulesets/`
- **Reduced**: 336 lines of duplicated code removed
- **Commits**: 3 clean, atomic commits

### Architecture Achievement
Zero conditional logic in core files. Adding a new ruleset now requires:
1. Create `server/src/rulesets/{name}/` directory
2. Implement 3 factory functions (character, combatant, bot)
3. Add to registry
4. **Zero changes to match.ts or bot.ts**

### Verification Results
- Build: ✅ 192.8kb (8ms)
- Tests: ✅ 249 tests, 0 failures
- Conditionals: ✅ Zero PF2 conditionals in core files
- Structure: ✅ Clean directory separation

**Status**: COMPLETE - Ready for production
