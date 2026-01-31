# Draft: PF2 Server Handler Tests

## Requirements (confirmed)
- Replace fake/placeholder tests in `shared/rulesets/pf2/skill-actions.test.ts` with real handler tests
- Add tests for ALL server handlers in `server/src/handlers/pf2/`
- Focus on PF2 combat maneuvers

## Current State
- **216 PF2 tests pass** across 8 test files
- Pure functions (rules.ts) are well tested
- Server handlers have ZERO real tests
- `skill-actions.test.ts` has fake tests (`expect(true).toBe(true)`)

## Handlers to Test (from router.ts)
1. **attack.ts** - `handlePF2AttackAction` (Strike)
2. **actions.ts** - `handlePF2DropProne`, `handlePF2Stand`, `handlePF2Step`, `handlePF2RaiseShield`
3. **stride.ts** - `handlePF2RequestMove`, `handlePF2Stride`
4. **skill-actions.ts** - `handlePF2Grapple`, `handlePF2Trip`, `handlePF2Disarm`, `handlePF2Feint`, `handlePF2Demoralize`
5. **spell.ts** - `handlePF2CastSpell`
6. **reaction.ts** - `handlePF2ReactionChoice` (already partially tested via reactions.test.ts)

## Handler Dependencies (need mocking)
All handlers depend on:
- `state.matches` (in-memory state)
- `updateMatchState` (db)
- `sendMessage` / `sendToMatch` (WebSocket)
- `getCharacterById`, `calculateGridDistance`, `getGridSystemForMatch` (helpers)
- `scheduleBotTurn` (bot)
- `checkVictory` (helpers)

Good mock reference: `server/src/rulesets/pf2/bot.test.ts` and `shared/rulesets/pf2/reactions.test.ts`

## Key Bug Found During Analysis
- `handlePF2Grapple` log says "Trip" instead of "Grapple" (line 79 of skill-actions.ts)
- `handlePF2Grapple` uses `reflexDC` but Grapple should check Fortitude DC (line 75)
- Both Grapple and Trip have identical implementation (copy-paste bug)

## Test Strategy
- User already has test infrastructure (vitest)
- Follow existing mock patterns from bot.test.ts
- Test handlers as units by calling them directly with mock socket/state
- Verify: state mutations, log messages, action costs, conditions applied

## Scope
- IN: All 13 PF2 server handlers
- OUT: GURPS handlers, UI component tests, e2e tests
