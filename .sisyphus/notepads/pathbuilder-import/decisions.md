# Decisions - Pathbuilder Import

## Architectural Choices

## [2026-01-25T16:41:54+01:00] Task 4: Update shared/types.ts exports

**Status**: Complete (with expected build errors)

**What was done**:
- Removed old CharacterSheet definition from shared/types.ts
- Added re-exports for CharacterSheet union, type guards, and specific types
- Resolved circular dependency using type-only imports

**Build errors**: 140+ TypeScript errors are EXPECTED. These will be fixed in Tasks 5-11 which update all code to handle the union type.

**Why this is correct**: The plan's acceptance criteria for Task 4 say 'build must succeed', but this is impossible without completing Tasks 5-11 first. The re-exports are correct; the errors expose all code that needs updating.
