## Raise Shield Action Implementation

**Date:** 2026-01-29

### What was implemented:
1. Added `shieldBonus: number` field to `PF2CharacterSheet` in `shared/rulesets/pf2/characterSheet.ts`
2. Extracted shield bonus from Pathbuilder import (`build.acTotal?.shieldBonus ?? 0`) in `pathbuilderMapping.ts`
3. Created `handlePF2RaiseShield` handler in `server/src/handlers/pf2/actions.ts`
4. Updated attack handler to apply +2 AC when `shieldRaised: true` in `server/src/handlers/pf2/attack.ts`
5. Verified `advanceTurn()` already resets `shieldRaised: false` at turn start (line 368 in `rules.ts`)
6. Added routing for `pf2_raise_shield` action in `server/src/handlers/pf2/router.ts`
7. Updated character templates and `createCharacter()` to include `shieldBonus: 0`

### Key patterns discovered:
- **Shield bonus extraction**: Pathbuilder exports `acTotal.shieldBonus` (0 if no shield, else 2)
- **AC calculation**: Shield bonus is applied separately from condition modifiers in attack handler
- **Action cost**: Uses existing `updateCombatantActions()` helper to deduct 1 action
- **Validation**: Checks `character.shieldBonus <= 0` to prevent raising non-existent shield
- **State reset**: `advanceTurn()` already had `shieldRaised: false` reset logic

### Files modified:
- `shared/rulesets/pf2/characterSheet.ts` - Added field
- `shared/rulesets/pf2/pathbuilderMapping.ts` - Extract from import
- `server/src/handlers/pf2/actions.ts` - Handler implementation
- `server/src/handlers/pf2/attack.ts` - AC bonus application
- `server/src/handlers/pf2/router.ts` - Routing
- `shared/rulesets/pf2/index.ts` - Default value in createCharacter
- `src/data/pf2CharacterTemplates.ts` - Default value in templates

### Tests:
- All 392 tests pass
- No TypeScript errors
- Build succeeds

