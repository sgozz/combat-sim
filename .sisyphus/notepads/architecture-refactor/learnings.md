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

## Task 3: CombatantState Union with Literal rulesetId Overrides (COMPLETED)

### Implementation
- Added `rulesetId: 'gurps'` literal override to `GurpsCombatantState` in `shared/rulesets/gurps/types.ts`
- Added `rulesetId: 'pf2'` literal override to `PF2CombatantState` in `shared/rulesets/pf2/types.ts`
- Exported union `CombatantState = GurpsCombatantState | PF2CombatantState` from `shared/rulesets/index.ts`
- Fixed PF2 bundle's `getInitialCombatantState` to return correct PF2-specific fields instead of GURPS fields
- Updated `Ruleset.ts` to use `GurpsCombatantState | PF2CombatantState` union in return type

### Key Insights
1. **Discriminated Union Pattern**: Extended types must override base type's `rulesetId: RulesetId` with literal values (`'gurps'` or `'pf2'`) for TypeScript to properly narrow types
2. **Circular Dependency Avoidance**: `Ruleset.ts` imports directly from `gurps/types.ts` and `pf2/types.ts` to avoid circular dependency with `index.ts`
3. **PF2 Bundle Bug Fix**: The PF2 bundle was incorrectly returning GURPS-specific fields (posture, maneuver, etc.). Fixed to return only PF2 fields (actionsRemaining, reactionAvailable, conditions, etc.)
4. **Type Safety**: The union now enables proper type narrowing - TypeScript can distinguish between GURPS and PF2 combatants based on `rulesetId` field

### Files Modified
- `shared/rulesets/gurps/types.ts`: Added `rulesetId: 'gurps'` override to GurpsCombatantState
- `shared/rulesets/pf2/types.ts`: Added `rulesetId: 'pf2'` override to PF2CombatantState
- `shared/rulesets/index.ts`: Exported `CombatantState` union type with documentation
- `shared/rulesets/pf2/index.ts`: Fixed `getInitialCombatantState` to return correct PF2 fields
- `shared/rulesets/Ruleset.ts`: Updated to use union type in return signature

### Verification Results
- All 356 tests pass (10 test files)
- Production build succeeds with no TypeScript errors
- Type guards (`isGurpsCombatant`, `isPF2Combatant`) continue to work correctly
- Discriminated union enables proper type narrowing in components and handlers

### Blockers Unblocked
- Task 5 (Handler routing) can now use discriminated union for clean action routing
- Task 7 (Type guards) can leverage literal rulesetId for improved type safety

## Task 2: Add rulesetId Discriminant to CharacterSheet Types (COMPLETED)

### Implementation
- Added `rulesetId: 'gurps'` literal type to `GurpsCharacterSheet` interface in `shared/rulesets/gurps/characterSheet.ts`
- Added `rulesetId: 'pf2'` literal type to `PF2CharacterSheet` interface in `shared/rulesets/pf2/characterSheet.ts`
- Updated all character creation functions to include the `rulesetId` field:
  - `shared/rulesets/gurps/index.ts`: `createCharacter` function
  - `shared/rulesets/pf2/index.ts`: `createCharacter` function
  - `shared/rulesets/pf2/pathbuilderMapping.ts`: `mapPathbuilderToCharacter` function
  - `src/data/characterTemplates.ts`: `createTemplate` function for GURPS templates
  - `src/data/pf2CharacterTemplates.ts`: `createPF2Template` function for PF2 templates

### Pattern Applied
- Followed exact pattern from `BaseCombatantState.rulesetId` (Task 1)
- Placed discriminant field early in interface (after `name` field) for visibility
- Used literal types (`'gurps'` not just `string`) for proper type narrowing
- Union type `CharacterSheet = PF2CharacterSheet | GurpsCharacterSheet` already existed in `shared/rulesets/characterSheet.ts`

### Type System Improvements
- Updated `Ruleset.ts` to import `PF2CombatantState` directly to avoid circular dependency
- Changed `getInitialCombatantState` return type to `Omit<CombatantState | PF2CombatantState, ...>` to support both GURPS and PF2 combatants
- This enables TypeScript to properly discriminate between GURPS and PF2 character sheets at runtime

### Verification Results
- All 356 tests pass (10 test files) - no regressions
- Production build succeeds with no TypeScript errors
- Type guards (`isPF2Character`, `isGurpsCharacter`) continue to work correctly
- Discriminated union enables proper type narrowing in components and handlers

### Files Modified
- `shared/rulesets/gurps/characterSheet.ts`: Added `rulesetId: 'gurps'` to GurpsCharacterSheet
- `shared/rulesets/pf2/characterSheet.ts`: Added `rulesetId: 'pf2'` to PF2CharacterSheet
- `shared/rulesets/gurps/index.ts`: Added `rulesetId: 'gurps'` to createCharacter
- `shared/rulesets/pf2/index.ts`: Added `rulesetId: 'pf2'` to createCharacter
- `shared/rulesets/pf2/pathbuilderMapping.ts`: Added `rulesetId: 'pf2'` to mapPathbuilderToCharacter
- `src/data/characterTemplates.ts`: Added `rulesetId: 'gurps'` to createTemplate
- `src/data/pf2CharacterTemplates.ts`: Added `rulesetId: 'pf2'` to createPF2Template
- `shared/rulesets/Ruleset.ts`: Updated import and return type signature

### Key Insights
1. **Belt and Suspenders**: Both discriminant field (`rulesetId`) AND shape-based checks (existing type guards) provide redundant type safety
2. **Consistency**: Applied same pattern across CharacterSheet types as was done for CombatantState types
3. **Cascading Updates**: Adding a required field to interfaces requires updating all creation sites - caught by TypeScript compiler
4. **Import Strategy**: Direct imports from ruleset-specific files avoid circular dependencies while maintaining type safety

### Blockers Unblocked
- Task 5 (Handler routing) can now use discriminated union for clean character-based routing
- Task 7 (Type guards) can leverage literal rulesetId for improved type safety
- Future tasks can rely on `rulesetId` field for runtime type discrimination

## Task 8: Final Cleanup and Verification (COMPLETED)

### Implementation Summary
This final task completed the multi-ruleset architecture refactor by:

1. **Removed Deprecated Alias**: Deleted the backward compatibility alias `CombatantState = GurpsCombatantState` from `shared/rulesets/gurps/types.ts` that was no longer needed.

2. **Updated All Imports**: Changed all imports of `CombatantState` from `gurps/types` to use the union type from `shared/rulesets/index.ts`:
   - `shared/rulesets/serverAdapter.ts`
   - `shared/rulesets/serverTypes.ts`
   - `server/src/rulesets/types.ts`
   - All component files in `src/components/`

3. **Added Type Guards**: Implemented proper type narrowing using `isGurpsCombatant()` and `isPF2Combatant()` guards in:
   - Server adapter functions (serverAdapter.ts)
   - Component files (Combatant.tsx, FloatingStatus.tsx, DefenseModal.tsx, etc.)
   - Test files (rules.test.ts, typeGuards.test.ts, characterSheet.test.ts)

4. **Fixed Test Objects**: Added `rulesetId` discriminant field to all test combatant and character objects to match the new type requirements.

5. **Fixed Component Hooks**: Ensured type guards are placed before React hooks to avoid ESLint violations.

### Verification Results
✅ **All 356 tests pass** - No regressions from the refactor
✅ **Client builds successfully** - `npm run build` completes without errors
✅ **No GURPS imports in shared/types.ts** - Verified with grep
✅ **No GURPS imports in Ruleset.ts** - Verified with grep
✅ **Final commit created** - `refactor(types): complete multi-ruleset architecture cleanup`

### Key Patterns Applied
1. **Discriminated Unions**: `CombatantState = GurpsCombatantState | PF2CombatantState` with `rulesetId` literal overrides
2. **Type Guards**: Safe narrowing with `isGurpsCombatant()` and `isPF2Combatant()` functions
3. **Centralized Exports**: All union types exported from `shared/rulesets/index.ts` for consistency
4. **Belt and Suspenders**: Both discriminant field AND shape-based checks provide redundant type safety

### Architecture Achievements
- ✅ Complete separation of GURPS and PF2 types
- ✅ No hardcoded ruleset conditionals in shared code
- ✅ Type-safe routing based on discriminant field
- ✅ Extensible pattern for adding new rulesets (D&D 5e, etc.)
- ✅ All tests passing with proper type coverage

### Lessons Learned
1. **Discriminated Unions are Powerful**: The `rulesetId` field enables TypeScript to automatically narrow types without runtime checks
2. **Type Guards Must Be Placed Carefully**: In React components, type guards must come before any hooks to avoid ESLint violations
3. **Test Objects Need Discriminants**: All test fixtures must include the discriminant field for proper type checking
4. **Centralized Registry Pattern Works**: Having a single `index.ts` that exports all union types prevents import confusion

### Future Extensibility
The architecture is now ready for:
- Adding new rulesets (D&D 5e, Pathfinder 1e, etc.)
- Implementing ruleset-specific UI components
- Creating ruleset-specific server handlers
- Extending the type system without breaking existing code

All acceptance criteria met. Multi-ruleset architecture refactor complete and verified.
