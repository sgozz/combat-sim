## Pf2ools Data Fetcher Implementation

### Architecture Decisions
- **Cache-first with TTL**: 24-hour cache freshness check prevents excessive GitHub API calls
- **Graceful degradation**: Returns empty array if both fetch and cache fail, allowing server to start without blocking
- **Stale cache fallback**: Uses stale cache data if fresh fetch fails, prioritizing availability over freshness
- **File-based caching**: Simple `fs/promises` approach, no external dependencies

### Implementation Patterns
- **Pure helper functions**: `tryReadCache`, `isCacheFresh`, `writeCache` are testable in isolation
- **Error handling**: Silent failures for cache reads (returns null), logged warnings/errors for fetch failures
- **Type safety**: Uses `unknown[]` for fetched data (will be validated by consumers)

### Testing Insights
- **Spy setup timing**: Console spies must be created in `beforeEach`, not at module level, to avoid `vi.clearAllMocks()` interference
- **Cache isolation**: Tests must clean up `data/cache/` directory in both `beforeEach` and `afterEach` to prevent cross-test pollution
- **File mtime manipulation**: `fs.utimes()` allows testing stale cache scenarios without waiting 24 hours

### File Structure
```
server/src/data/
  pf2oolsFetcher.ts       # Main implementation
  pf2oolsFetcher.test.ts  # Comprehensive test suite (6 tests)
data/cache/               # Gitignored cache directory
  pf2ools-feat.json       # Cached feat data
  pf2ools-spell.json      # Cached spell data
```

### Next Steps
- Integration: Call `fetchPf2oolsData('feat')` and `fetchPf2oolsData('spell')` at server startup
- Validation: Add Zod schemas to validate fetched data structure
- Indexing: Build lookup maps for fast feat/spell queries by name or ID

## Pf2ools Feat Parser Implementation (Task 2)

### Architecture Decisions
- **Target feat filtering**: Hardcoded `TARGET_FEATS` Set with 8 feat names prevents parsing unnecessary data
- **Type-safe parsing**: `Pf2oolsFeat` interface matches Pf2ools schema exactly; `PF2FeatDefinition` extends `PF2Feat` with additional fields
- **ID generation**: Feat IDs derived from display name (lowercase, spaces→underscores) for consistent lookups
- **Lazy initialization**: `featData.ts` uses lazy-loaded cache pattern with `initializeFeatDatabase()` for server startup integration

### Implementation Patterns
- **Pure parser function**: `parsePf2oolsFeat()` converts single Pf2ools feat to internal format
- **Batch loader**: `loadFeatsFromPf2ools()` filters and maps entire data array, returns `Map<string, PF2FeatDefinition>`
- **Type guards**: Checks `feat.type === 'feat'` and `TARGET_FEATS.has(name)` to filter safely
- **Optional fields**: `actionCost`, `prerequisites` are optional in both schema and parsed output

### Testing Insights
- **TDD approach**: 10 tests written first, all pass on first implementation
- **Edge cases covered**: Empty data, non-feat entries, missing optional fields, all 8 target feats
- **Mock data patterns**: Tests use realistic Pf2ools structure with `name.display`, `data.level`, `tags.source`
- **Filtering verification**: Tests confirm non-target feats are excluded and only 8 targets are loaded

### File Structure
```
shared/rulesets/pf2/
  pf2oolsParser.ts       # Parser + loader (60 lines)
  pf2oolsParser.test.ts  # TDD tests (10 tests, all passing)
  featData.ts            # Lazy-loaded database + helpers
  characterSheet.ts      # PF2Feat base type (extended by PF2FeatDefinition)
```

### Integration Points
- **Server startup**: Call `initializeFeatDatabase(pf2oolsData)` after `fetchPf2oolsData('feat')`
- **Feat lookup**: Use `getFeat(name)` or `FEAT_DATABASE.get(name)` for combat effects
- **Type safety**: `PF2FeatDefinition` includes `actionCost`, `traits`, `prerequisites` for effect framework

### Next Steps
- Task 4: Create feat effect framework with `hasFeat()` helper
- Task 4: Gate AoO behind Attack of Opportunity feat check
- Tasks 5-11: Implement individual feat effects using parsed data

## Pf2ools Spell Heightening Parser Implementation (Task 3)

### Architecture Decisions
- **HeightenData interface**: Unified type for both interval and fixed heightening patterns
- **Interval heightening**: Applies damage scaling per spell level above base (e.g., +1d4 per level)
- **Fixed heightening**: Applies discrete bonuses at specific spell levels (e.g., +1 missile at levels 3, 5, 7, 9)
- **Accumulative fixed heightening**: Fixed bonuses stack - at level 5, all bonuses from levels 3 and 5 apply

### Implementation Patterns
- **parseSpellHeightening()**: Extracts heightening data from Pf2ools spell schema
- **getHeightenedDamage()**: Runtime helper that scales damage formulas based on cast level
- **Regex-based formula parsing**: Extracts dice count/sides and modifiers from damage strings
- **Graceful fallback**: Returns base formula if no heightening data or cast level equals base level

### Testing Insights
- **TDD approach**: 12 heightening tests written first, all pass after implementation
- **Interval vs fixed patterns**: Tests verify both scaling types work correctly
- **Accumulation logic**: Fixed heightening requires summing all applicable levels, not just the current one
- **Edge cases**: Tests cover base level (no heightening), missing heightening data, and both damage types

### Heightening Formulas Implemented
1. **Electric Arc** (cantrip, level 0): +1d4 per level → at level 2: 3d4+{mod}
2. **Fireball** (level 3): +2d6 per level → at level 5: 10d6
3. **Heal** (level 1): +1d8 per level → at level 3: 3d8
4. **Magic Missile** (level 1): +1 missile at levels 3,5,7,9 → at level 5: 3d4+3

### File Structure
```
shared/rulesets/pf2/
  pf2oolsParser.ts       # Extended with Pf2oolsSpell interface + parseSpellHeightening()
  spellData.ts           # Updated with heighten field for 4 spells + getHeightenedDamage()
  types.ts               # Added HeightenData import, updated SpellDefinition
  spells.test.ts         # Added 12 heightening tests (all passing)
```

### Integration Points
- **Spell casting**: `getHeightenedDamage(spell, castLevel)` called when resolving spell damage
- **UI display**: Heightening options shown in spell picker based on spell.heighten data
- **Server resolution**: Area spells use heightened damage for all targets in burst

### Key Learnings
- **Accumulative fixed heightening**: Must iterate through all fixed levels ≤ castLevel and sum bonuses
- **Formula preservation**: Modifiers like {mod} must be preserved in interval heightening
- **Base level comparison**: Use `castLevel < baseLevel` to detect invalid heightening (shouldn't happen in practice)
- **Regex safety**: Always check regex match results before accessing capture groups

### Next Steps
- Task 4: Integrate heightening into feat effect framework
- Task 15: Use heightened damage in burst area spell resolution
- Future: Add heightening UI to spell picker component

## Task 3: Feat Effect Framework (2026-02-01)

### Implementation Summary
Created feat effect framework with `hasFeat()` helper and `FEAT_EFFECTS` registry to gate Attack of Opportunity behind feat ownership.

### Files Created
- `shared/rulesets/pf2/feats.ts` - Core feat framework
- `shared/rulesets/pf2/feats.test.ts` - Comprehensive test suite (14 tests)

### Files Modified
- `server/src/handlers/pf2/reaction.ts` - Added feat check to `getAoOReactors()`
- `shared/rulesets/pf2/reactions.test.ts` - Added feat-gating tests, updated test fixtures

### Architecture Patterns
1. **Registry Pattern**: `FEAT_EFFECTS` Map follows `conditions.ts` modifier approach
   - Pure data structure (no execution logic)
   - Handler names reference implementation functions
   - Extensible for future feats

2. **Type Safety**: `PF2FeatEffect` interface with strict type union (`'reaction' | 'action' | 'modifier'`)

3. **Helper Functions**:
   - `hasFeat(character, featName)` - Simple boolean check
   - `getFeatEffect(featName)` - Registry lookup

### Critical Bug Fixed
**Before**: ALL PF2 combatants could trigger Attack of Opportunity reactions
**After**: Only combatants with "Attack of Opportunity" feat can trigger AoO

### Test Coverage
- 14 tests in `feats.test.ts` (all passing)
- 3 new tests in `reactions.test.ts` for feat-gating (all passing)
- All existing PF2 handler tests still pass (70 tests)

### Key Learnings
1. **TDD Approach**: Writing tests first revealed the need for mock setup in `getAoOReactors` tests
2. **Mock Management**: `mockGetCharacterById` needed setup in multiple `describe` blocks
3. **Test Fixtures**: Updated `createMatch()` helper to include AoO feat by default for cleaner tests
4. **Type Guards**: Used `isPF2Character()` in `getAoOReactors()` for safe feat access

### Integration Points
- `getAoOReactors()` now checks:
  1. Distance (existing)
  2. Reaction availability (existing)
  3. **NEW**: Character has "Attack of Opportunity" feat
  
### Future Extensibility
Registry includes 8 feats ready for implementation:
- Attack of Opportunity (implemented)
- Shield Block, Power Attack, Sudden Charge, Reactive Shield, Nimble Dodge, Quick Draw, Point-Blank Shot (registered, handlers pending)

### Performance Notes
- `hasFeat()` uses `Array.some()` - O(n) where n = number of feats per character (typically < 20)
- No caching needed at this scale
- Registry lookup is O(1) via Map

### Documentation
Added JSDoc comments for public API (necessary for shared library module):
- Interface documentation
- Function signatures with examples
- Architectural pattern references

## Task 5: Shield Block Reaction Implementation (2026-02-01)

### Implementation Summary
Implemented Shield Block reaction that reduces incoming damage by shield hardness and applies remaining damage to the shield, with shield breaking at HP ≤ 0.

### Files Created
- None (added function to existing file)

### Files Modified
- `server/src/handlers/pf2/reaction.ts` - Added `handleShieldBlockReaction()` function
- `shared/rulesets/pf2/reactions.test.ts` - Added 8 Shield Block tests (all passing)
- `shared/rulesets/pf2/characterSheet.ts` - Added `shieldHardness: number` field
- Multiple test files - Added `shieldHardness: 0` to all PF2CharacterSheet fixtures
- `shared/rulesets/pf2/pathbuilderMapping.ts` - Added shield hardness mapping (5 if shield present, 0 otherwise)

### Architecture Patterns
1. **Pure Function Design**: `handleShieldBlockReaction()` returns both updated match state and reduced damage
   - Input: `match`, `matchId`, `defender`, `incomingDamage`
   - Output: `{ match: MatchState; reducedDamage: number }`
   - Allows caller to use reduced damage for subsequent calculations

2. **Guard Clauses**: Early returns for invalid states (no feat, shield not raised, no reaction)
   - Follows existing pattern from `executeAoOStrike()`
   - Type guards (`isPF2Combatant`, `isPF2Character`) ensure safe property access

3. **Shield Data Model**:
   - `PF2CharacterSheet.shieldHardness` - Damage reduction value (typically 3-5)
   - `PF2CombatantState.shieldHP` - Current shield HP (optional, defaults to 0)
   - `PF2CombatantState.shieldRaised` - Boolean flag (must be true for Shield Block)

### Shield Block Mechanics (PF2 SRD)
- **Trigger**: Would take damage from physical attack
- **Requirements**: Shield raised + Shield Block feat + reaction available
- **Effect**:
  1. Reduce damage by shield's Hardness
  2. Shield takes remaining damage (after hardness reduction)
  3. Shield breaks if HP ≤ 0

### Test Coverage
- 8 new tests in `reactions.test.ts` (all passing)
- Total PF2 test suite: 238 tests passing
- Tests cover:
  - Damage reduction by hardness
  - Shield damage calculation
  - Shield breaking at HP ≤ 0
  - Feat requirement
  - Shield raised requirement
  - Reaction availability requirement
  - Edge cases (damage/HP cannot go below 0)

### Key Learnings
1. **Type Safety**: Added `shieldHardness` to character sheet required updating 11+ files
   - All PF2CharacterSheet fixtures needed the new field
   - TypeScript caught all missing fields at compile time
   - Default value: 0 (no shield), 5 (basic shield from Pathbuilder)

2. **TDD Approach**: Tests written first revealed the need for:
   - Type assertions (`as PF2CombatantState`) in test fixtures
   - `equipped: []` field in combatant test helpers
   - Proper mock setup for `getCharacterById`

3. **Shield Hardness Defaults**:
   - Basic shields: 5 hardness (PF2 SRD standard)
   - No shield: 0 hardness
   - Pathbuilder import: Inferred from `shieldBonus > 0`

4. **Return Value Pattern**: Function returns both updated state AND computed value
   - Allows caller to use `reducedDamage` for damage application
   - Avoids recalculating hardness reduction in caller
   - Follows functional programming principles (no side effects)

### Integration Points
- **Future**: Integrate with damage application flow in attack handlers
- **Future**: Add UI for shield HP display and broken state
- **Future**: Implement shield repair mechanics (requires downtime/crafting)

### Performance Notes
- `handleShieldBlockReaction()` is O(n) where n = number of combatants (map operation)
- No caching needed - reactions are infrequent (once per round max)
- Shield hardness lookup is O(1) (direct property access)

### Documentation
- Function includes clear parameter/return types
- Log messages use shield emoji (🛡️) for visual clarity
- Test names are self-documenting (no comments needed)

### Next Steps
- Task 6+: Implement remaining feat effects (Power Attack, Sudden Charge, etc.)
- Future: Integrate Shield Block into damage application pipeline
- Future: Add shield management UI (HP bar, broken state indicator)

## Task 6: Reactive Shield Reaction Implementation (2026-02-01)

### Implementation Summary
Implemented Reactive Shield reaction that raises shield as a reaction before attack resolves, granting AC bonus retroactively.

### Files Modified
- `server/src/handlers/pf2/reaction.ts` - Added `handleReactiveShieldReaction()` function
- `shared/rulesets/pf2/reactions.test.ts` - Added 5 Reactive Shield tests (all passing)

### Architecture Patterns
1. **Pure Function Design**: `handleReactiveShieldReaction()` returns updated match state
   - Input: `match`, `matchId`, `defender`
   - Output: `MatchState` with `shieldRaised: true` and `reactionAvailable: false`
   - Simpler than Shield Block (no damage calculation needed)

2. **Guard Clauses**: Early returns for invalid states
   - No Reactive Shield feat → return unchanged match
   - Shield already raised → return unchanged match
   - No reaction available → return unchanged match
   - Type guards (`isPF2Combatant`, `isPF2Character`) ensure safe property access

3. **Reactive Shield vs Shield Block**:
   - **Reactive Shield**: Raises shield BEFORE attack resolves (AC bonus applies to triggering attack)
   - **Shield Block**: Reduces damage AFTER attack hits (requires shield already raised)
   - Both consume reaction, but different triggers and effects

### Reactive Shield Mechanics (PF2 SRD)
- **Trigger**: Enemy hits you with melee Strike
- **Requirements**: Wielding shield + Reactive Shield feat + reaction available
- **Effect**: Raise shield, gaining +2 AC bonus (applies to triggering attack)
- **Action Cost**: Reaction (⚡)

### Test Coverage
- 5 new tests in `reactions.test.ts` (all passing)
- Total PF2 reaction test suite: 27 tests passing
- Tests cover:
  - Shield raised as reaction
  - Reaction consumed
  - Shield NOT already raised requirement
  - Feat requirement
  - Reaction availability requirement
  - AC bonus calculation (18 → 20 with shield raised)

### Key Learnings
1. **Simpler than Shield Block**: No damage calculation, just state update
   - Only sets `shieldRaised: true` and `reactionAvailable: false`
   - AC bonus handled by existing AC calculation logic

2. **TDD Approach**: Tests written first, then implementation
   - Initial tests checked conditions only (passed trivially)
   - Updated tests to call handler function (verified actual behavior)

3. **Guard Clause Pattern**: Consistent with Shield Block and AoO
   - Check feat → check shield state → check reaction → apply effect
   - Early returns keep code clean and readable

4. **Log Message Format**: Consistent emoji usage (🛡️) for shield-related actions
   - Matches Shield Block pattern for visual consistency

### Integration Points
- **Future**: Integrate with attack resolution flow to offer Reactive Shield before damage
- **Future**: Add UI prompt for Reactive Shield reaction (similar to AoO prompt)
- **Future**: Implement reaction priority system (multiple reactions available)

### Performance Notes
- `handleReactiveShieldReaction()` is O(n) where n = number of combatants (map operation)
- No caching needed - reactions are infrequent (once per round max)
- Simpler than Shield Block (no damage calculations)

### Documentation
- Function follows existing pattern from Shield Block
- Test names are self-documenting
- Log messages use shield emoji for visual clarity

### Next Steps
- Task 7+: Implement remaining feat effects (Power Attack, Sudden Charge, etc.)
- Future: Integrate Reactive Shield into attack flow (offer reaction before damage)
- Future: Add reaction UI prompt system

## Task 7: Power Attack Feat Action Implementation (2026-02-01)

### Implementation Summary
Implemented Power Attack feat action that costs 2 actions, adds +1 damage die, and counts as 2 attacks for MAP calculation.

### Files Modified
- `server/src/handlers/pf2/attack.ts` - Added `handlePF2PowerAttack()` function
- `server/src/handlers/pf2/attack.test.ts` - Added 5 Power Attack tests (all passing)
- `server/src/handlers/pf2/router.ts` - Added routing for `pf2_power_attack` message type

### Architecture Patterns
1. **Followed Strike Pattern**: `handlePF2PowerAttack()` mirrors `handlePF2AttackAction()` structure
   - Same guard clauses (feat check, action cost, range validation)
   - Same attack resolution flow (roll check, calculate damage, apply effects)
   - Same visual effects and turn advancement logic

2. **Damage Die Enhancement**: Regex-based damage formula parsing
   - Pattern: `/^(\d+)d(\d+)$/` extracts dice count and size
   - Enhancement: `1d8` → `2d8`, `2d6` → `3d6`, etc.
   - Preserves modifier: `enhancedDamage + strMod` passed to `rollDamage()`

3. **MAP Calculation**: Counts as 2 attacks instead of 1
   - Normal attack: `mapPenalty + penaltyStep` (e.g., 0 → -5)
   - Power Attack: `mapPenalty + (penaltyStep * 2)` (e.g., 0 → -10)
   - Respects agile weapon trait (-4/-8 instead of -5/-10)

### Power Attack Mechanics (PF2 SRD)
- **Actions**: 2 actions (⚔️⚔️)
- **Requirements**: Wielding melee weapon + Power Attack feat
- **Effect**: Make melee Strike with +1 weapon damage die
- **Special**: Counts as 2 attacks for MAP (e.g., first Power Attack at -0, second at -10)

### Test Coverage
- 5 new tests in `attack.test.ts` (all passing)
- Total attack test suite: 16 tests passing
- Total PF2 handler suite: 75 tests passing
- Tests cover:
  - 2-action cost
  - Extra damage die (1d8 → 2d8)
  - MAP increment by 2 (0 → -10)
  - Feat requirement
  - Action requirement (needs 2 actions)

### Key Learnings
1. **TDD Approach**: Tests written first revealed:
   - Need for `handlePF2PowerAttack` export in attack.ts
   - Need for `pf2_power_attack` type in router payload union
   - PF2Feat type requires `type` field (not just `id`, `name`, `level`)

2. **Damage Formula Parsing**: Regex approach is simple and effective
   - Handles standard dice notation (`1d8`, `2d6`, etc.)
   - Gracefully falls back to original damage if pattern doesn't match
   - Preserves ability modifier in final damage calculation

3. **MAP Multiplication**: Multiplying penalty step by 2 is cleaner than incrementing twice
   - `(penaltyStep * 2)` is more explicit than two separate increments
   - Respects min/max penalty bounds with `Math.max(minPenalty, ...)`

4. **Code Reuse**: 90% of Power Attack logic is identical to Strike
   - Only differences: action cost (2 vs 1), damage formula, MAP increment
   - Future refactoring opportunity: extract shared attack logic to helper function

### Integration Points
- **Router**: `pf2_power_attack` message type added to PF2ActionPayload union
- **Feat Registry**: Power Attack already registered in `FEAT_EFFECTS` (Task 4)
- **UI**: Backend ready, UI implementation pending (future task)

### Performance Notes
- Regex parsing is O(1) for standard damage formulas (short strings)
- No caching needed - damage formula parsed once per attack
- Same performance characteristics as normal Strike action

### Documentation
- Function includes docstring for public API (necessary for exported function)
- Inline comments removed - code is self-explanatory with clear variable names
- Test names are self-documenting

### Next Steps
- Task 8+: Implement remaining feat effects (Sudden Charge, Quick Draw, etc.)
- Future: Add Power Attack UI button (2-action cost indicator)
- Future: Consider refactoring shared attack logic into helper function

## Task 8: Sudden Charge Feat Action Implementation (2026-02-01)

### Implementation Summary
Implemented Sudden Charge feat action that costs 2 actions, allows double Stride movement (up to 2x speed), and ends with a melee Strike.

### Files Modified
- `server/src/handlers/pf2/attack.ts` - Added `handlePF2SuddenCharge()` function and movement imports
- `server/src/handlers/pf2/attack.test.ts` - Added 6 Sudden Charge tests (all passing)
- `server/src/handlers/pf2/router.ts` - Added routing for `pf2_sudden_charge` message type

### Architecture Patterns
1. **Movement + Attack Combo**: `handlePF2SuddenCharge()` combines movement and attack logic
   - First validates movement using `getReachableSquares()` with 2x speed
   - Moves combatant to target hex
   - Then executes Strike attack from new position
   - Follows same attack resolution flow as `handlePF2AttackAction()`

2. **Guard Clauses**: Early returns for invalid states (same pattern as Power Attack)
   - Feat check → action cost check → movement validation → target validation → execute
   - Type guards (`isPF2Combatant`, `isPF2Character`) ensure safe property access

3. **Movement Validation**:
   - Uses `getReachableSquares(startPos, doubleSpeed, occupiedSquares)` from `pf2/rules.ts`
   - Checks if destination hex is in reachable set
   - Validates target is within melee reach (1 hex) after movement

### Sudden Charge Mechanics (PF2 SRD)
- **Actions**: 2 actions (⚔️⚔️)
- **Requirements**: Sudden Charge feat + 2 actions remaining
- **Effect**: 
  1. Stride twice (up to 2x speed total movement)
  2. Make melee Strike if target within reach after movement
- **Special**: Can use with Burrow, Climb, Fly, or Swim if you have those movement types

### Test Coverage
- 6 new tests in `attack.test.ts` (all passing)
- Total attack test suite: 22 tests passing
- Tests cover:
  - 2-action cost
  - Double Stride movement (up to 2x speed)
  - Strike attack at destination
  - Feat requirement
  - Action requirement (needs 2 actions)
  - Movement range validation (rejects beyond 2x speed)

### Key Learnings
1. **TDD Approach**: Tests written first revealed the need for:
   - Mock setup for `getReachableSquares()` and `gridToHex()` from `pf2/rules.ts`
   - Proper reachable squares Map structure: `Map<string, { position, cost }>`
   - Key format for reachable squares: `"q,r"` (e.g., `"2,0"`)

2. **Movement + Attack Pattern**: Sudden Charge required combining two existing patterns
   - Movement validation from `stride.ts` (reachable squares calculation)
   - Attack resolution from `attack.ts` (Strike logic)
   - Created intermediate `movedMatch` state before executing attack

3. **Position Updates**: Movement updates position before attack
   - `movedCombatants` array created with updated position
   - `movedMatch` state used for distance calculations in attack
   - Final state includes both movement and attack effects

4. **Mock Management**: New mocks needed for movement functions
   - `mockGetReachableSquares` returns Map with destination hex
   - `mockGridToHex` converts position to hex coordinates
   - Both mocks set up in `beforeEach` with default empty/identity values

5. **Log Message Format**: Consistent emoji usage (⚔️⚔️) for 2-action feats
   - Includes movement path: `"from (0, 0) to (2, 0)"`
   - Matches Power Attack pattern for visual consistency

### Integration Points
- **Router**: `pf2_sudden_charge` message type added to PF2ActionPayload union
- **Feat Registry**: Sudden Charge already registered in `FEAT_EFFECTS` (Task 4)
- **Movement System**: Reuses `getReachableSquares()` from `pf2/rules.ts`
- **Attack System**: Reuses Strike logic from `handlePF2AttackAction()`
- **UI**: Backend ready, UI implementation pending (future task)

### Performance Notes
- `getReachableSquares()` is O(n) where n = reachable hexes (typically < 100)
- No caching needed - movement calculated once per action
- Same attack performance characteristics as normal Strike action

### Documentation
- Function includes docstring for public API (necessary for exported function)
- Test names are self-documenting
- Log messages use emoji for visual clarity

### Next Steps
- Task 9+: Implement remaining feat effects (Quick Draw, Point-Blank Shot, etc.)
- Future: Add Sudden Charge UI button (2-action cost indicator)
- Future: Consider refactoring shared attack logic into helper function (DRY with Power Attack)

## Task 9: Intimidating Strike Feat Action Implementation (2026-02-01)

### Implementation Summary
Implemented Intimidating Strike feat action that costs 2 actions, makes a Strike attack, and applies frightened condition on hit (frightened 1 on normal hit, frightened 2 on critical hit).

### Files Modified
- `server/src/handlers/pf2/attack.ts` - Added `handlePF2IntimidatingStrike()` function
- `server/src/handlers/pf2/attack.test.ts` - Added 6 Intimidating Strike tests (all passing)
- `server/src/handlers/pf2/router.ts` - Added routing for `pf2_intimidating_strike` message type
- `shared/rulesets/pf2/feats.ts` - Added Intimidating Strike to FEAT_EFFECTS registry

### Architecture Patterns
1. **Strike + Condition Pattern**: `handlePF2IntimidatingStrike()` combines attack and condition application
   - First executes Strike attack (same logic as `handlePF2AttackAction()`)
   - Then applies frightened condition ONLY on hit (success or critical success)
   - Frightened value depends on attack degree: 1 for success, 2 for critical success

2. **Two-Phase Combatant Update**: Separate damage and condition application
   - Phase 1: `updatedCombatants` - Apply damage, HP reduction, dying/unconscious
   - Phase 2: `finalCombatants` - Apply frightened condition only on hit
   - Prevents condition from being applied on miss

3. **Guard Clauses**: Same pattern as Power Attack and Sudden Charge
   - Feat check → action cost check → target validation → execute
   - Type guards (`isPF2Combatant`, `isPF2Character`) ensure safe property access

### Intimidating Strike Mechanics (PF2 SRD)
- **Actions**: 2 actions (⚔️⚔️)
- **Requirements**: Intimidating Strike feat + 2 actions remaining + wielding melee weapon
- **Effect**: 
  1. Make melee Strike
  2. On hit: target becomes frightened 1
  3. On critical hit: target becomes frightened 2
- **Special**: Uses Intimidation skill modifier (simplified in our implementation)

### Test Coverage
- 6 new tests in `attack.test.ts` (all passing)
- Total attack test suite: 28 tests passing
- Tests cover:
  - 2-action cost
  - Frightened 1 on normal hit
  - Frightened 2 on critical hit
  - NO frightened on miss
  - Feat requirement
  - Action requirement (needs 2 actions)

### Key Learnings
1. **TDD Approach**: Tests written first revealed the need for:
   - Two-phase combatant update pattern (damage first, then condition)
   - Conditional frightened application (only on hit, not on miss)
   - Proper log message formatting with frightened value

2. **Condition Application Pattern**: Frightened applied AFTER damage resolution
   - `updatedCombatants` handles damage/HP/dying
   - `finalCombatants` handles frightened condition
   - Prevents condition from being applied if target dies from damage

3. **Degree-Based Condition Values**: Frightened value depends on attack roll degree
   - `critical_success` → frightened 2
   - `success` → frightened 1
   - `failure` or `critical_failure` → no condition
   - Pattern reusable for other degree-based effects

4. **Log Message Clarity**: Clear indication of condition application
   - `. Target is frightened 1!` or `. Target is frightened 2!`
   - Appended to attack log entry for single-line readability
   - Matches Demoralize pattern from skill-actions.ts

5. **Code Reuse**: 95% of Intimidating Strike logic is identical to Strike
   - Only differences: action cost (2 vs 1), frightened application on hit
   - Future refactoring opportunity: extract shared attack logic to helper function
   - Pattern consistent with Power Attack and Sudden Charge

### Integration Points
- **Router**: `pf2_intimidating_strike` message type added to PF2ActionPayload union
- **Feat Registry**: Intimidating Strike registered in `FEAT_EFFECTS` with handler name
- **Condition System**: Reuses existing frightened condition from conditions.ts
- **UI**: Backend ready, UI implementation pending (future task)

### Performance Notes
- Same performance characteristics as normal Strike action
- Condition application is O(n) where n = number of combatants (map operation)
- No caching needed - conditions applied once per attack

### Documentation
- Function includes docstring for public API (necessary for exported function)
- Test names are self-documenting
- Log messages use emoji for visual clarity (⚔️⚔️)

### Next Steps
- Task 10+: Implement remaining feat effects (Quick Draw, Point-Blank Shot, etc.)
- Future: Add Intimidating Strike UI button (2-action cost indicator)
- Future: Consider refactoring shared attack logic into helper function (DRY with Power Attack, Sudden Charge)
