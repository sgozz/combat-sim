# Learnings - Architecture Refactor

## Conventions
- RulesetId type already exists as 'gurps' | 'pf2'
- MatchState already uses rulesetId discriminant pattern
- BaseCombatantState is extended by both GURPS and PF2

## Patterns
- Discriminated unions use explicit rulesetId field
- Shape checks remain as backup (belt and suspenders approach)
- Type guards will accept unknown for ergonomic usage

## Dependencies
- Task 1 blocks Tasks 2, 3, 5
- Task 4 blocks Task 5
- All Wave 1 tasks independent

## Task 4: Action Payload Separation

### Implementation Pattern
- Created `GurpsCombatActionPayload` in `shared/rulesets/gurps/types.ts` with all GURPS-specific actions
- Created `PF2CombatActionPayload` in `shared/rulesets/pf2/types.ts` with PF2-specific actions (`pf2_step`, `pf2_stand`, `pf2_drop_prone`)
- Exported union `CombatActionPayload = GurpsCombatActionPayload | PF2CombatActionPayload` from `shared/rulesets/index.ts`
- Updated `shared/types.ts` to import union from index instead of directly from gurps/types

### Key Insight
- Backward compatibility alias `CombatActionPayload = GurpsCombatActionPayload` kept in gurps/types.ts for any direct imports
- Union export from index.ts is the canonical source for new code
- No action type strings changed - backend expects exact strings (`pf2_step`, `attack`, etc.)

### Verification
- All 356 tests pass (10 test files)
- Production build succeeds with no errors
- Type safety maintained: ClientToServerMessage still accepts union type correctly

### Blockers Unblocked
- Task 5 (Handler routing) can now proceed with clean action payload types

## Task 1: Add rulesetId Discriminant to BaseCombatantState

### Implementation
- Added `rulesetId: RulesetId` field to `BaseCombatantState` interface in `shared/rulesets/base/types.ts`
- Imported `RulesetId` type from `shared/types.ts` (already defined as `'gurps' | 'pf2'`)
- Updated `getInitialCombatantState` in both GURPS and PF2 rulesets to include `rulesetId: 'gurps'` and `rulesetId: 'pf2'` respectively

### Pattern Applied
- Followed exact pattern from `MatchState.rulesetId` (line 23-33 in shared/types.ts)
- Placed discriminant field early in the interface (after playerId/characterId) for clarity
- Both extended types (GurpsCombatantState, PF2CombatantState) inherit the field automatically

### Verification
- All 356 tests pass (no regressions)
- Production build succeeds
- Changes committed with message: "refactor(types): separate action payloads by ruleset"

### Key Insight
- The discriminant field enables TypeScript to distinguish between GURPS and PF2 combatants at runtime
- This is the foundation for Tasks 2, 3, and 5 which depend on ruleset-specific type narrowing
- No runtime behavior changed - purely a type system enhancement
