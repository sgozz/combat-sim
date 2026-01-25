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
