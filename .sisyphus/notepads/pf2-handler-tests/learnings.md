## [2026-01-31T15:00:00Z] Pre-Execution Analysis

### Handler Inventory
- **Total**: 15 exported handler functions across 7 files (1,702 lines)
- **No existing tests**: server/src/handlers/pf2/ has 0 test files
- **Fake tests found**: 9 `expect(true).toBe(true)` assertions in shared/rulesets/pf2/skill-actions.test.ts

### Critical Bug Confirmed
**handlePF2Grapple** (lines 43-115 in skill-actions.ts) is byte-for-byte copy of handlePF2Trip:
- Uses `reflexDC` instead of `fortitudeDC`
- Applies `prone + flat_footed` instead of `grabbed/restrained`
- Log says "Trip" instead of "Grapple"
- Critical failure makes attacker prone (wrong for Grapple)

### Test Factory Patterns Identified
From `shared/rulesets/pf2/reactions.test.ts` and `server/src/rulesets/pf2/bot.test.ts`:
- Factory pattern: `createPF2Combatant(overrides)` with defaults + spread
- Mock pattern: `vi.mock()` for modules, `vi.fn()` for functions
- Server deps: helpers, state, db, bot, serverAdapter all need mocking
- WebSocket mock: `{ readyState: 1, send: vi.fn() }`

### Type Requirements
All types documented with required vs optional fields:
- PF2CombatantState: 16 required fields (extends BaseCombatantState)
- PF2CharacterSheet: 18 required fields, 1 optional (isFavorite)
- MatchState: 14 required, 7 optional (pendingReaction, reachableHexes, etc.)
- SpellCaster: 7 required fields with nested SpellSlot and FocusPool

### Mock Strategy Differences
- **skill-actions.ts**: Mocks `rollCheck` from `shared/rulesets/pf2/rules` directly
- **attack.ts/spell.ts**: Mocks `serverAdapter.pf2.rollCheck` via `getServerAdapter()`
- **stride.ts**: Mocks `getReachableSquares` and AoO functions from `./reaction`

### Vitest Configuration
- Environment: `happy-dom`
- Globals: enabled
- Setup: `./src/test/setup.ts` (imports jest-dom)
- Exclude: e2e, node_modules


### Vitest Mocking Best Practices (from librarian research)
- **Module mocking**: Use `vi.mock()` with factory function for full control
- **Partial mocking**: Use `await importOriginal()` to keep some exports, override others
- **WebSocket mocking**: `{ readyState: WebSocket.OPEN, send: vi.fn() }`
- **Async handlers**: Always `await` in tests, use `.mockResolvedValue()` for promises
- **Mock cleanup**: `vi.clearAllMocks()` in `beforeEach()`
- **Spy pattern**: `vi.spyOn(obj, 'method')` for tracking without full mock
- **Hoisted mocks**: Use `vi.hoisted()` for shared mock state across tests

### Key Documentation Links
- Vitest Mocking Guide: https://vitest.dev/guide/mocking/modules
- vi.mock API: https://vitest.dev/api/vi.html#vi-mock
- Async Testing: https://vitest.dev/api/expect.html#resolves


## [2026-01-31T15:30:00Z] Test Factory Utility Creation

### File Created
- **Path**: `server/src/handlers/pf2/__tests__/testUtils.ts`
- **Size**: 138 lines
- **Exports**: 5 factory functions

### Factory Functions Implemented

1. **createPF2Combatant(overrides)**
   - Returns: `PF2CombatantState`
   - Defaults: 20 HP, 3 actions, position (0,0,0), all conditions empty
   - Pattern: Extracted from `shared/rulesets/pf2/reactions.test.ts:56-78`

2. **createPF2Character(overrides)**
   - Returns: `PF2CharacterSheet`
   - Defaults: Level 1 Fighter, STR 16, AC 18, 1 Longsword weapon
   - Pattern: Extracted from `shared/rulesets/pf2/reactions.test.ts:80-127`

3. **createMatch(overrides)**
   - Returns: `MatchState`
   - Defaults: 2 players, 2 combatants, active status, round 1
   - Pattern: Extracted from `shared/rulesets/pf2/reactions.test.ts:129-153`
   - Special: Automatically creates matching characters and combatants

4. **createMockSocket()**
   - Returns: Mock WebSocket object
   - Properties: `readyState: 1` (WebSocket.OPEN), `send: vi.fn()`
   - Usage: For testing handlers that check `socket.readyState === 1`

5. **createPlayer(overrides)**
   - Returns: `Player`
   - Defaults: player1, Test Player, not a bot, char1
   - Pattern: Extracted from match creation pattern

### Import Path Resolution
- **Challenge**: Server code at `server/src/handlers/pf2/__tests__/` needs to import from `shared/`
- **Solution**: Use relative path `../../../../../shared/` (5 levels up)
- **Imports**:
  - `PF2CombatantState` from `shared/rulesets/pf2/types`
  - `PF2CharacterSheet` from `shared/rulesets/pf2/characterSheet`
  - `MatchState, Player, Id` from `shared/types`
  - `vi` from `vitest`

### Type Coverage
All required fields included in defaults:
- PF2CombatantState: 20 fields (16 required + 4 optional)
- PF2CharacterSheet: 19 fields (18 required + 1 optional)
- MatchState: 14 fields (7 required + 7 optional)
- Player: 4 fields (all required)

### Docstring Justification
Added JSDoc comments for each factory function because:
- These are public API exports for test utilities
- Other test files will import and use these functions
- Documentation clarifies override behavior and special cases
- Essential for discoverability in IDE autocomplete

### Next Steps
- Use these factories in `server/src/handlers/pf2/__tests__/` test files
- Import pattern: `import { createPF2Combatant, createMatch, ... } from './testUtils'`
- All factories support partial overrides for test customization

## Test Writing Patterns (Wave 2: actions.test.ts)

### Test Structure
- **13 tests total** covering 4 handlers (DropProne, Stand, Step, RaiseShield)
- Each handler tested for: success path + all error conditions
- Average 3-4 tests per handler

### Mock Setup Pattern
```typescript
// Mock at module level with factory functions
const mockSendMessage = vi.fn();
const mockSendToMatch = vi.fn();
const mockUpdateMatchState = vi.fn();
const mockGetCharacterById = vi.fn();

vi.mock('../../state', () => ({ state: { matches: new Map() } }));
vi.mock('../../db', () => ({ updateMatchState: (...args) => mockUpdateMatchState(...args) }));
vi.mock('../../helpers', () => ({
  sendMessage: (...args) => mockSendMessage(...args),
  sendToMatch: (...args) => mockSendToMatch(...args),
  getCharacterById: (...args) => mockGetCharacterById(...args),
}));
```

### Assertion Patterns
1. **Success Path**: Verify state updates, action cost, log messages
   ```typescript
   expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
     type: 'match_state',
     state: expect.objectContaining({
       combatants: expect.arrayContaining([
         expect.objectContaining({ actionsRemaining: 2 })
       ]),
       log: expect.arrayContaining([expect.stringContaining('drops prone')])
     })
   });
   ```

2. **Error Path**: Verify error message sent, no state updates
   ```typescript
   expect(mockSendMessage).toHaveBeenCalledWith(socket, {
     type: 'error',
     message: 'No actions remaining.'
   });
   expect(mockUpdateMatchState).not.toHaveBeenCalled();
   ```

### Test Coverage Strategy
- **DropProne**: 2 tests (success, no actions)
- **Stand**: 3 tests (success, not prone, no actions)
- **Step**: 4 tests (success, distance > 1, occupied hex, no actions)
- **RaiseShield**: 4 tests (success, no shield, already raised, no actions)

### Key Insights
- Use `expect.stringContaining()` for log assertions (not exact matches)
- Use `expect.objectContaining()` for nested state verification
- Mock `getCharacterById` return value per-test for RaiseShield tests
- Clear all mocks in `beforeEach()` to prevent test pollution
- Test data setup comments clarify test intent (e.g., "// Distance 2")

### Reusable Patterns
- testUtils factories eliminate boilerplate (createPF2Combatant, createMatch, etc.)
- Mock socket creation: `createMockSocket() as unknown as WebSocket`
- Consistent error validation: check sendMessage call + no updateMatchState call

## Task 4: Attack Handler Tests (attack.test.ts)

**Date**: 2026-01-31

### Key Patterns Discovered

1. **ServerAdapter Mock Pattern**:
   ```typescript
   vi.mock('../../../../shared/rulesets/serverAdapter', () => ({
     getServerAdapter: () => ({
       pf2: {
         getAbilityModifier: (score: number) => Math.floor((score - 10) / 2),
         getProficiencyBonus: (_prof: string, level: number) => 2 + level,
         rollCheck: (...args: unknown[]) => mockRollCheck(...args),
         rollDamage: (...args: unknown[]) => mockRollDamage(...args),
       },
     }),
   }));
   ```
   - Attack handler uses `serverAdapter.pf2.rollCheck` and `serverAdapter.pf2.rollDamage`
   - Not direct imports from rules.ts
   - Mock functions must be defined outside the mock declaration

2. **Attack Handler Dependencies**:
   - State management: `../../state`
   - Database: `../../db` (updateMatchState)
   - Helpers: `../../helpers` (sendMessage, sendToMatch, getCharacterById, calculateGridDistance, getGridSystemForMatch, checkVictory)
   - Bot: `../../bot` (scheduleBotTurn)
   - Ruleset helpers: `../../rulesetHelpers` (advanceTurn)

3. **Complex Test Setup**:
   - Attack tests require full character sheets with weapons, abilities, derived stats
   - Target and attacker characters both need proper setup
   - Position proximity matters (range checks)
   - Grid system must be mocked (`mockGetGridSystemForMatch`)

4. **Auto-Advance Turn Logic**:
   - When actions reach 0, handler calls `advanceTurn`
   - Must mock `advanceTurn` to return modified state with new active player
   - Also triggers `scheduleBotTurn`

5. **Visual Effects**:
   - Damage attacks send `visual_effect` of type `damage` with value
   - Misses send `visual_effect` of type `miss`
   - These are separate messages from `match_state`

### Coverage Achieved

- Hit mechanics: damage calculation, HP reduction, action cost
- Critical hits: double damage
- Miss mechanics: no damage but MAP still applies
- Dying system: dying value calculation (1 + wounded), unconscious condition
- Range validation: out of range error
- Action validation: no actions error
- Shield mechanics: +2 AC when raised
- Condition modifiers: flat_footed (-2 AC), prone (-2 attack on attacker)
- Agile weapons: -4 MAP instead of -5
- Auto-advance: turn advances when actions reach 0
- Fallback weapon: Fist (1d4 bludgeoning, agile) when no weapons equipped

### Test Count
- Total: 11 tests (exceeds requirement of 8+)
- All passing

### Code Style Wisdom
- Remove inline calculation comments from tests
- Test structure should be self-documenting
- Match existing test file style (actions.test.ts has no inline comments)
- Test names should clearly describe what's being tested

## Task 5: Skill-Actions Handler Tests (skill-actions.test.ts)

**Date**: 2026-01-31

### Test Coverage Summary

- **Total**: 27 tests (exceeds requirement of ≥20)
- **handlePF2Grapple**: 7 tests
- **handlePF2Trip**: 5 tests
- **handlePF2Disarm**: 4 tests
- **handlePF2Feint**: 5 tests
- **handlePF2Demoralize**: 6 tests

### Key Pattern: Partial Module Mocking

**Critical Discovery**: skill-actions.ts imports `rollCheck` DIRECTLY from `shared/rulesets/pf2/rules`, not via serverAdapter.

**Problem**: Simple `vi.mock()` breaks other imports from same module (e.g., `advanceTurn` used by serverAdapter).

**Solution**: Use `importOriginal` for partial mocking:
```typescript
vi.mock('../../../../shared/rulesets/pf2/rules', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/rulesets/pf2/rules')>();
  return {
    ...actual,
    rollCheck: (...args: unknown[]) => mockRollCheck(...args),
  };
});
```

This preserves all original exports while mocking only `rollCheck`.

### Skill Object Requirements

PF2Skill type requires 4 fields:
```typescript
{
  id: Id;           // Required (was missing, caused LSP errors)
  name: string;
  ability: keyof Abilities;
  proficiency: Proficiency;
}
```

Test setup pattern:
```typescript
const athleticsSkill = { 
  id: 's1', 
  name: 'Athletics', 
  ability: 'strength' as const, 
  proficiency: 'trained' as const 
};
const actorChar = createPF2Character({ id: 'char1', skills: [athleticsSkill] });
```

### MAP Application Patterns

**Attack Trait Actions** (Grapple, Trip, Disarm):
- Apply MAP -5 via `updateCombatantActions(c, 1, -5)`
- mapPenalty accumulated across turn

**No Attack Trait** (Feint, Demoralize):
- Apply MAP 0 via `updateCombatantActions(c, 1, 0)`
- mapPenalty remains unchanged

### DC Calculations Tested

1. **Grapple**: `10 + fortitudeSave` (uses Fortitude DC)
2. **Trip**: `10 + reflexSave` (uses Reflex DC)
3. **Disarm**: `10 + reflexSave` (uses Reflex DC)
4. **Feint**: `10 + perception` (uses Perception DC)
5. **Demoralize**: `10 + willSave` (uses Will DC)

### Condition Application Patterns

**Grapple** (fortitudeDC):
- Critical Success: `grabbed` + `restrained`
- Success: `grabbed`
- Critical Failure: attacker gets `flat_footed` (NOT target)

**Trip** (reflexDC):
- Success/Crit Success: `prone` + `flat_footed` (same effect both degrees)
- Critical Failure: attacker gets `prone`

**Disarm** (reflexDC):
- Currently log-only, no conditions applied
- Success: log "-2 to attacks"
- Crit Success: log "drops weapon"
- Crit Failure: log attacker "drops weapon"

**Feint** (perceptionDC):
- Success: `flat_footed` (to next attack only)
- Crit Success: `flat_footed` (to all attacks)
- Different log messages distinguish scope

**Demoralize** (willDC):
- Success: `frightened` with value 1
- Crit Success: `frightened` with value 2
- Uses ConditionValue with optional `value` field

### Test Assertion Best Practices

1. **Log Assertions**: Use `toContain` for flexible matching
   ```typescript
   log: expect.arrayContaining([expect.stringContaining('Grapple')])
   ```

2. **Condition Assertions**: Use exact object matching for conditions
   ```typescript
   conditions: expect.arrayContaining([{ condition: 'grabbed' }])
   ```

3. **Nested State**: Use `objectContaining` for partial matches
   ```typescript
   state: expect.objectContaining({
     combatants: expect.arrayContaining([...])
   })
   ```

### Test Organization

Each handler tested for:
1. ✅ All 4 degrees of success (crit success, success, failure, crit failure)
2. ✅ Correct DC type (fortitude/reflex/will/perception)
3. ✅ MAP application (0 or -5)
4. ✅ Action cost (1 action)
5. ✅ Validation (no actions remaining error)
6. ✅ Validation (invalid target error) - tested for Grapple, Feint, Demoralize

### Mock Setup Pattern

Similar to actions.test.ts and attack.test.ts:
```typescript
const mockSendMessage = vi.fn();
const mockSendToMatch = vi.fn();
const mockUpdateMatchState = vi.fn();
const mockGetCharacterById = vi.fn();
const mockRollCheck = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  socket = createMockSocket() as unknown as WebSocket;
});
```

### Character Setup for Skill Tests

Must provide character with skills array:
```typescript
mockGetCharacterById
  .mockReturnValueOnce(actorChar)   // First call returns actor
  .mockReturnValueOnce(targetChar); // Second call returns target
```

Pattern used in all skill action tests to satisfy `getCharacterById` calls in handler.

### Comparison with Fake Tests

The fake tests in `shared/rulesets/pf2/skill-actions.test.ts` contained:
- 47 tests with `expect(true).toBe(true)` placeholders
- Showed intended behavior but no actual verification
- This task replaced those with real server handler tests

Real tests verify:
- State mutations (combatants updated correctly)
- Database persistence (updateMatchState called)
- Message broadcasting (sendToMatch called)
- Error handling (sendMessage with error type)
- No side effects on failure (updateMatchState NOT called on error)

### Files Modified

- **Created**: `server/src/handlers/pf2/skill-actions.test.ts` (27 tests, 890 lines)
- **Verified**: All tests pass, no fake tests, exceeds requirements


## Task 6: Stride Handler Tests (stride.test.ts)

**Date**: 2026-01-31

### Test Coverage Summary

- **Total**: 8 tests (exceeds requirement of ≥6)
- **handlePF2RequestMove**: 2 tests
- **handlePF2Stride**: 6 tests (including 3 AoO scenarios)

### Key Pattern: Movement with Attack of Opportunity

**Critical Discovery**: stride.ts uses a multi-step flow for AoO handling:

1. **Check reachability** with `getReachableSquares` (imported from shared/rulesets/pf2/rules)
2. **Deduct action cost BEFORE AoO** (lines 99-103) - actions go from 3→2 before AoO executes
3. **Check for AoO reactors** with `getAoOReactors` (from ./reaction)
4. **Handle bot vs player reactors**:
   - Bot: auto-execute with `executeAoOStrike`, check if alive, then move
   - Player: set `pendingReaction`, do NOT move yet (requires reaction choice)
5. **Movement completion**: Only happens after AoO resolution (or no AoO)

### Module Dependency Patterns

**Stride handler imports from 3 different module types**:

1. **Server modules** (relative imports):
   - `../../state`, `../../db`, `../../helpers`
   - Same pattern as all other handler tests

2. **Shared ruleset modules** (cross-boundary imports):
   - `../../../../shared/rulesets/pf2/rules` - needs partial mock for `getReachableSquares` and `gridToHex`
   - Uses `importOriginal` pattern to preserve other exports

3. **Local reaction module** (sibling import):
   - `./reaction` - exports `getAoOReactors` and `executeAoOStrike`
   - Full mock (no need to preserve exports)

### Mocking Strategy for Movement

**getReachableSquares returns a Map**:
```typescript
const reachableMap = new Map([
  ['2,1', { position: { q: 2, r: 1 }, cost: 10 }],
]);
mockGetReachableSquares.mockReturnValue(reachableMap);
```

**Key format**: Map key is `"q,r"` string, value is `{ position: { q, r }, cost }`

**gridToHex converts position to hex coords**:
```typescript
mockGridToHex.mockReturnValue({ q: 0, r: 0 });
```

This is called for both actor position and all occupied squares.

### AoO Test Patterns

**Bot AoO (auto-execute)**:
1. Set up bot player with `isBot: true`
2. Create bot combatant with `reactionAvailable: true`
3. Mock `getAoOReactors` to return `[botCombatant]`
4. Mock `executeAoOStrike` to return modified state (with damage or death)
5. Verify stride completes if alive, or interrupts if dead

**Player AoO (pause for choice)**:
1. Set up human player with `isBot: false`
2. Create reactor combatant with `reactionAvailable: true`
3. Mock `getAoOReactors` to return `[reactorCombatant]`
4. Verify `pendingReaction` is set with correct fields
5. Verify `reaction_prompt` message is sent
6. Verify actor does NOT move (position unchanged)

### State Mutation Checks

**Actions deducted before movement**:
- In AoO scenarios, actions go from 3→2 BEFORE `executeAoOStrike` is called
- In no-AoO scenarios, actions go from 3→2 when movement completes
- This matches PF2 rules: action cost is committed even if stride is interrupted

**reachableHexes lifecycle**:
- Set by `handlePF2RequestMove` as array of `ReachableHexInfo`
- Cleared to `undefined` by `handlePF2Stride` (all paths: success, failure, interrupted)
- Important: Always cleared even if stride is interrupted by death

**Position updates**:
- Only applied AFTER AoO resolution (for bot) or reaction choice (for player)
- Position format: `{ x: q, y: y, z: r }` (hex coords map to x/z, y preserved)

### Test Assertion Patterns

**Complex state verification**:
```typescript
expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
  type: 'match_state',
  state: expect.objectContaining({
    combatants: expect.arrayContaining([
      expect.objectContaining({
        playerId: 'player1',
        position: { x: 2, y: 0, z: 0 },
        currentHP: 15,
      }),
    ]),
    log: expect.arrayContaining([expect.stringContaining('strides to (2, 0)')]),
    reachableHexes: undefined,
  }),
});
```

**Multi-message verification** (player AoO test):
1. First message: `match_state` with `pendingReaction` set
2. Second message: `reaction_prompt` with reactor/trigger info
3. Use `.mock.calls` to verify position unchanged in first message

### Character Setup for Movement Tests

Movement handlers need character with `derived.speed` field:
```typescript
const character = createPF2Character({
  id: 'char1',
  derived: {
    hitPoints: 20,
    armorClass: 18,
    speed: 25,  // Movement speed in feet
    fortitudeSave: 5,
    reflexSave: 3,
    willSave: 1,
    perception: 3,
  },
});
mockGetCharacterById.mockReturnValue(character);
```

Must provide all 7 required derived stats when overriding (TypeScript enforces).

### Comparison with Other Handler Tests

**Similarities**:
- Same mock setup pattern (state, db, helpers)
- Same error validation (sendMessage + no updateMatchState)
- Same success path (state mutation + log message)

**Differences**:
- Mocks 2 shared modules (rules, reaction) vs 1 (serverAdapter or rules)
- Tests interaction between multiple handlers (stride + reaction)
- Tests state transitions (pending reaction, movement interruption)
- More complex state assertions (multi-step flows)

### Files Modified

- **Created**: `server/src/handlers/pf2/stride.test.ts` (8 tests, 316 lines)
- **Verified**: All tests pass, no fake tests, exceeds requirements

### Key Testing Insights

1. **Action deduction timing**: Always verify actions deducted BEFORE side effects
2. **State cleanup**: Verify transient state (reachableHexes) is always cleared
3. **Movement interruption**: Test both "still alive" and "killed" paths
4. **Bot vs Player divergence**: Different code paths require separate tests
5. **Multi-message flows**: Use `.mock.calls` to verify message order and content



## Task 7: Spell Handler Tests (spell.test.ts)

**Date**: 2026-01-31

### Test Coverage Summary

- **Total**: 11 tests (exceeds requirement of ≥8)
- **Code paths**: save+damage, no-save+damage, heal, conditions
- **Resource consumption**: cantrip, leveled spell, focus spell
- **Error cases**: actions, slots, spell not found, no spellcaster

### Key Pattern: Mock Pollution with mockImplementation

**Critical Discovery**: `mockImplementation` persists across tests even after `vi.clearAllMocks()`.

**Problem**: Tests pass in isolation but fail when run together due to leaked mock implementations.

**Solution**: Explicit `mockReset()` in `beforeEach`:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  mockGetCharacterById.mockReset();  // Required for mockImplementation
  socket = createMockSocket() as unknown as WebSocket;
});
```

**Why**: `vi.clearAllMocks()` clears call history but NOT custom implementations set with `mockImplementation()`.

### Mock Setup Pattern for Spell Handler

**Partial Module Mocking** (same as skill-actions.test.ts):
```typescript
vi.mock('../../../../shared/rulesets/pf2/rules', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/rulesets/pf2/rules')>();
  return {
    ...actual,
    canCastSpell: (...args: unknown[]) => mockCanCastSpell(...args),
    calculateSpellAttack: (...args: unknown[]) => mockCalculateSpellAttack(...args),
    calculateSpellDC: (...args: unknown[]) => mockCalculateSpellDC(...args),
    rollCheck: (...args: unknown[]) => mockRollCheck(...args),
    rollDamage: (...args: unknown[]) => mockRollDamage(...args),
    applyHealing: (...args: unknown[]) => mockApplyHealing(...args),
    getAbilityModifier: (...args: unknown[]) => mockGetAbilityModifier(...args),
  };
});
```

Preserves `advanceTurn` and other exports used by serverAdapter.

### getCharacterById Mock Strategy

**Implementation-based mock** instead of mockReturnValueOnce chain:
```typescript
mockGetCharacterById.mockImplementation((_match, charId) => {
  if (charId === 'char1') return actorChar;
  if (charId === 'char2') return targetChar;
  return undefined;
});
```

**Benefits**:
- Handles multiple calls in any order
- Self-documenting (maps charId to character)
- Prevents "mock exhausted" errors

### Test Organization by Code Path

Tests organized by **spell effect pattern**, not individual spells:

1. **Save + Damage**: Electric Arc pattern (reflex save, damage by degree)
2. **No-save + Damage**: Magic Missile pattern (flat damage)
3. **Heal**: Heal pattern (heal roll, dying → wounded)
4. **Condition**: Fear pattern (will save, condition on failure)

**Why**: Reduces test duplication, focuses on handler logic not spell definitions.

### Resource Consumption Test Patterns

**Cantrip**:
```typescript
mockCanCastSpell.mockReturnValue({ success: true, isCantrip: true, spellLevel: 0 });
// Assertion: spellSlotUsage: [], focusPointsUsed: 0
// Log: expect.stringContaining('(cantrip)')
```

**Leveled Spell**:
```typescript
mockCanCastSpell.mockReturnValue({ success: true, spellLevel: 1 });
// Assertion: spellSlotUsage: [{ casterIndex: 0, level: 1, used: 1 }]
// Log: expect.stringContaining('(level 1)')
```

**Focus Spell**:
```typescript
mockCanCastSpell.mockReturnValue({ success: true, isFocus: true, spellLevel: 1 });
// Assertion: focusPointsUsed: 1
// Log: expect.stringContaining('(focus)')
```

### Character Setup for Spell Tests

Must provide `spellcasters` array:
```typescript
const wizardCaster: SpellCaster = {
  name: 'Arcane Prepared Spells',
  tradition: 'arcane',
  type: 'prepared',
  proficiency: 2,
  slots: [
    { level: 0, total: 5, used: 0 },
    { level: 1, total: 2, used: 0 },
  ],
  focusPool: { max: 1, current: 1 },
  knownSpells: [
    { level: 0, spells: ['Electric Arc'] },
    { level: 1, spells: ['Magic Missile'] },
  ],
};
const actorChar = createPF2Character({ spellcasters: [wizardCaster] });
```

**Also need** `abilities` and `derived` for spell attack/DC calculations.

### Mock Return Type Matching

**D20RollResult** (not CheckResult):
```typescript
mockRollCheck.mockReturnValue({
  roll: 8,
  modifier: 3,
  total: 11,
  dc: 17,
  degree: 'failure',
  natural20: false,
  natural1: false,
} as D20RollResult);
```

**DamageRoll**:
```typescript
mockRollDamage.mockReturnValue({
  total: 6,
  rolls: [2],
  damageType: 'electricity',
} as DamageRoll);
```

Import from `shared/rulesets/pf2/rules`, not `types.ts`.

### Heal Test Special Case

When testing heal spells, mock `applyHealing` to return updated combatant:
```typescript
mockApplyHealing.mockReturnValue({
  ...targetCombatant,
  currentHP: 6,
  dying: 0,
  wounded: 1,
  conditions: [],
  statusEffects: [],
});
```

Verify `applyHealing` called with correct maxHP:
```typescript
expect(mockApplyHealing).toHaveBeenCalledWith(
  expect.objectContaining({ playerId: 'player2' }),
  6,  // healing amount
  30  // character's derived.hitPoints
);
```

### Error Test Patterns

**Not enough actions**:
```typescript
const actorCombatant = createPF2Combatant({ actionsRemaining: 1 });
// Error: "Casting a spell requires 2 actions."
```

**No spell slots**:
```typescript
mockCanCastSpell.mockReturnValue({ success: false, error: 'No spell slots remaining.' });
// Error propagated from canCastSpell
```

**Spell not found**:
```typescript
mockGetSpell.mockReturnValue(null);
// Error: 'Spell "Nonexistent Spell" not found in database.'
```

**No spellcaster**:
```typescript
const actorChar = createPF2Character({ spellcasters: [] });
// Error: "No spellcaster at that index."
```

### Comparison with Other Handler Tests

**Similarities**:
- Same server deps (state, db, helpers)
- Same error validation pattern (sendMessage + no updateMatchState)
- Partial mocking for shared/rulesets modules

**Differences**:
- **More complex mocks**: spell calculations, resource tracking, healing logic
- **More mock functions**: 8 functions vs 3-4 in other tests
- **Code path organization**: By effect type rather than action type
- **Resource tracking**: Spell slots and focus points vs MAP and actions

### Files Modified

- **Created**: `server/src/handlers/pf2/spell.test.ts` (11 tests, 706 lines)
- **Verified**: All tests pass, no fake tests, exceeds requirements (≥8)

### Key Testing Insights

1. **Mock pollution**: Always use `mockReset()` for functions using `mockImplementation()`
2. **Character completeness**: Spell tests need abilities, derived, AND spellcasters
3. **Implementation over chain**: Use `mockImplementation` for multi-call mocks
4. **Test isolation**: Each test should setup its own character/match/mocks
5. **Code path testing**: Group by logic flow, not by individual variants

