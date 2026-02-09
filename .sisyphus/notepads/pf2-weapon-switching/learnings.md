# Learnings — PF2 Weapon Switching

## Initial Context
- 881 tests passing, build clean
- EquippedItem[] already on PF2CombatantState (line 179)
- Test utils in `server/src/handlers/pf2/__tests__/testUtils.ts` — createPF2Combatant has `equipped: []` default
- GURPS ready.ts is the reference pattern (141 lines)
- PF2 router.ts has PF2ActionPayload union at lines 17-38
- PF2CombatActionPayload in shared/rulesets/pf2/types.ts lines 203-215
