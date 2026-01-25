# PF2 Character Sheet Type System - Learnings

## Task 1: PF2CharacterSheet Type Definition

### Key Decisions

1. **Abilities Structure**: Used inline type definition in `PF2CharacterSheet` rather than importing `Abilities` type directly
   - Reason: Ensures discriminant clarity (`abilities.constitution` NOT `attributes.health`)
   - Re-exported `Abilities as PF2Aliases` for consistency with naming conventions

2. **Derived Stats**: Separated into `PF2CharacterDerivedStats` type
   - Matches `calculateDerivedStats()` return type from `rules.ts:153-179`
   - Includes all 7 fields: hitPoints, armorClass, speed, fortitudeSave, reflexSave, willSave, perception

3. **Recalculation Fields**: Included all fields needed for `calculateDerivedStats()` recalculation
   - `classHP`: Base HP from class
   - `saveProficiencies`: Record of fortitude/reflex/will proficiencies
   - `perceptionProficiency`: Wisdom-based perception
   - `armorProficiency`: Used in AC calculation

4. **Equipment Types**: Separated into distinct types for clarity
   - `PF2CharacterWeapon`: Includes proficiency category, runes, traits
   - `PF2CharacterArmor`: Includes proficiency category, AC bonus, dex cap, runes
   - `PF2Feat`: Minimal structure (id, name, type, level, optional description)
   - `PF2SpellInfo`: Tradition + proficiency + known spell names (no slot tracking)

### Type Reuse
- Imported and re-used from `types.ts`:
  - `Proficiency` (untrained|trained|expert|master|legendary)
  - `PF2DamageType` (all 13 damage types)
  - `PF2Skill` (id, name, ability, proficiency)
  - `PF2WeaponTrait` (all 19 weapon traits)

### File Structure
- Created: `shared/rulesets/pf2/characterSheet.ts` (89 lines)
- Updated: `shared/rulesets/pf2/index.ts` (added 8-line export block)
- Build: ✅ Passes TypeScript compilation

### Discriminant Field
**CRITICAL**: `PF2CharacterSheet.abilities.constitution` is the discriminant field
- NOT `attributes.health` (GURPS pattern)
- This enables type guards: `isPF2Combatant()` checks for `abilities.constitution`

## Task 2: GurpsCharacterSheet Type Definition

### Key Decisions

1. **Exact Copy Pattern**: Created `GurpsCharacterSheet` as exact copy of `CharacterSheet` from `shared/types.ts`
   - Reason: Maintains compatibility with existing GURPS logic while enabling future divergence
   - All 9 fields preserved: id, name, attributes, derived, skills, advantages, disadvantages, equipment, pointsTotal

2. **Type Imports**: Imported GURPS-specific types from `./types.ts`
   - `Attributes` (with `health` field - GURPS discriminant)
   - `DerivedStats`, `Skill`, `Advantage`, `Disadvantage`, `Equipment`
   - `Id` from `../../types` (shared ID type)

3. **Export Pattern**: Used re-export pattern in `index.ts`
   - Added: `export type { GurpsCharacterSheet } from './characterSheet'`
   - Keeps exports clean and centralized

### Discriminant Field
**CRITICAL**: `GurpsCharacterSheet.attributes.health` is the GURPS discriminant
- Distinguishes GURPS from PF2 (which uses `abilities.constitution`)
- Enables type guards: `isGurpsCombatant()` checks for `attributes.health`

### File Structure
- Created: `shared/rulesets/gurps/characterSheet.ts` (15 lines)
- Updated: `shared/rulesets/gurps/index.ts` (added 1-line export)
- Build: ✅ Passes TypeScript compilation

### Next Steps
- Task 3: Create `PF2CharacterSheet` (already done in Task 1)
- Task 4: Remove `CharacterSheet` from `shared/types.ts` and update imports

## Task 3: CharacterSheet Union Type and Resilient Type Guards

### Key Decisions

1. **Union Type Pattern**: Created `CharacterSheet = PF2CharacterSheet | GurpsCharacterSheet`
   - Centralized in `shared/rulesets/characterSheet.ts`
   - Enables type-safe discrimination across the codebase
   - Follows TypeScript union best practices

2. **Resilient Type Guards**: Implemented with defensive checks
   - **Critical Fix**: Must check `typeof character === 'object' && character !== null` FIRST
   - Reason: The `in` operator throws TypeError on null/undefined, not just returns false
   - Order matters: type check → null check → field existence → nested type checks
   - Pattern:
     ```typescript
     typeof character === 'object' &&
     character !== null &&
     'field' in character &&
     character.field !== null &&
     typeof character.field === 'object' &&
     'discriminant' in character.field
     ```

3. **Discriminant Fields**:
   - PF2: `abilities.constitution` (nested discriminant)
   - GURPS: `attributes.health` (nested discriminant)
   - Both are required fields in their respective types, making them reliable discriminants

4. **Test Coverage**: 23 comprehensive runtime tests
   - Valid character identification (PF2 and GURPS)
   - Cross-ruleset rejection (PF2 guard rejects GURPS, vice versa)
   - Null/undefined safety (no throws on malformed input)
   - Missing field handling (returns false, not error)
   - Mutual exclusivity verification
   - Edge cases: extra fields, optional fields, hybrid objects

### File Structure
- Created: `shared/rulesets/characterSheet.ts` (36 lines)
- Created: `shared/rulesets/characterSheet.test.ts` (262 lines)
- Tests: ✅ 23/23 passing
- Build: ✅ TypeScript compilation successful

### Resilience Guarantees
- Guards NEVER throw on any input (including null, undefined, primitives)
- Guards return false for malformed data (missing fields, wrong types)
- Guards are mutually exclusive for valid characters
- Guards handle extra fields gracefully (forward compatibility)

### Next Steps
- Task 4: Update `shared/types.ts` to remove `CharacterSheet` and import from `characterSheet.ts`
- Task 5: Update all imports across codebase to use new union type

## Task 4: CharacterSheet Re-export Integration

### Key Decisions

1. **Circular Dependency Resolution**: 
   - Initial attempt to re-export at top of `shared/types.ts` failed due to circular dependency
   - Root cause: `pf2/characterSheet.ts` and `gurps/characterSheet.ts` both import from `../../types`
   - Solution: Use `import type` at top (type-only import, no runtime circular dependency) + re-export
   - Pattern: `import type { CharacterSheet } from './rulesets/characterSheet'` + `export type { CharacterSheet } from './rulesets/characterSheet'`

2. **Import Placement**: 
   - Re-exports must be at TOP of file (after other imports) to be available for types used in the same file
   - This works because TypeScript processes imports/exports before type checking the rest of the file

3. **Backward Compatibility**:
   - `CharacterSheet` remains importable from `shared/types` as before
   - Type guards `isPF2Character` and `isGurpsCharacter` are now re-exported as value exports
   - Specific types `PF2CharacterSheet` and `GurpsCharacterSheet` are re-exported for direct access

### File Changes

- **Removed**: Old `CharacterSheet` definition from `shared/types.ts:51-61` (11 lines)
- **Added**: Re-exports at `shared/types.ts:4-7` (4 lines)
  - `export { isPF2Character, isGurpsCharacter }` (value exports - functions)
  - `export type { CharacterSheet }` (type export - union)
  - `export type { PF2CharacterSheet, GurpsCharacterSheet }` (type exports - specific types)

### Verification Results

- ✅ TypeScript compilation: No errors in `shared/types.ts`
- ✅ Tests: All 272 tests pass (including 23 CharacterSheet tests)
- ✅ Backward compatibility: `CharacterSheet` importable from `shared/types`
- ✅ Type guards: Both `isPF2Character` and `isGurpsCharacter` available

### Remaining Build Errors

Build shows errors in other files (e.g., `serverAdapter.ts`, `rules.ts`, components) because they access ruleset-specific properties without type guards. These are expected and will be fixed in subsequent tasks. The task requirement was only to update `shared/types.ts`, which is complete.

### Pattern for Future Re-exports

When re-exporting types that create circular dependencies:
1. Use `import type { Type } from './path'` at top (type-only import)
2. Immediately follow with `export type { Type } from './path'` (re-export)
3. This allows the type to be used in the same file while avoiding runtime circular dependencies
