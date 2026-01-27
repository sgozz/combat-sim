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

## Task 4: Action Payload Separation (COMPLETED)

### Implementation Pattern
- Created `GurpsCombatActionPayload` in `shared/rulesets/gurps/types.ts` with all GURPS-specific actions
- Created `PF2CombatActionPayload` in `shared/rulesets/pf2/types.ts` with PF2-specific actions (`pf2_stand`, `pf2_drop_prone`)
- Exported union `CombatActionPayload = GurpsCombatActionPayload | PF2CombatActionPayload` from `shared/rulesets/index.ts`
- Updated `shared/types.ts` to import union from index instead of directly from gurps/types
- Updated `src/components/rulesets/types.ts` to import union from index (CRITICAL FIX)

### Key Insights
1. **Import Path Matters**: Components were importing `CombatActionPayload` from `gurps/types` directly, which prevented the union from being recognized. Fixed by importing from `shared/rulesets/index.ts`.
2. **Backward Compatibility**: Kept `CombatActionPayload = GurpsCombatActionPayload` alias in gurps/types.ts for any direct imports.
3. **Action vs Maneuver**: `pf2_step` remains a ManeuverType (used in `select_maneuver`), while `pf2_stand` and `pf2_drop_prone` are direct actions.
4. **No Action Type String Changes**: All action type strings remain unchanged (`pf2_stand`, `pf2_drop_prone`, etc.) - backend expects exact strings.

### Verification Results
- All 356 tests pass (10 test files)
- Production build succeeds with no TypeScript errors
- Type safety maintained: ClientToServerMessage correctly accepts union type
- Components can now properly dispatch PF2-specific actions

### Files Modified
- `shared/rulesets/gurps/types.ts`: Created `GurpsCombatActionPayload`, kept backward compatibility alias
- `shared/rulesets/pf2/types.ts`: Created `PF2CombatActionPayload`
- `shared/rulesets/index.ts`: Exported union type and individual payload types
- `shared/types.ts`: Updated import to use union from index
- `src/components/rulesets/types.ts`: Updated import to use union from index (critical fix)

### Blockers Unblocked
- Task 5 (Handler routing) can now proceed with clean, separated action payload types
- Type system now properly discriminates between GURPS and PF2 actions
