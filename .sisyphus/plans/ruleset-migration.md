# Migrazione a Sistema Multi-Ruleset Generico

## Context

### Original Request
Completare la migrazione a un sistema generico che supporta GURPS e Pathfinder 2e, con netta separazione tra i due ruleset in cartelle diverse.

### Interview Summary
**Key Discussions**:
- Struttura tipi: Base + Estensioni (BaseCombatantState generico + estensioni per ruleset)
- Priorità: Pulizia strutturale prima, poi feature PF2
- attack.ts: Refactor completo per estrarre logica in adapter
- Scope PF2: Includere feature base (Step, conditions, reactions)

**Research Findings**:
- 240 test esistenti (180 GURPS + 40 PF2 + 20 Grid)
- Handler ben astratti: movement.ts, close-combat.ts, damage.ts, ready.ts
- Handler da rifare: attack.ts (837 linee GURPS-heavy)
- Componenti GURPS in path generico da spostare: PostureControls, HitLocationPicker, DefenseModal, WaitTriggerPicker, ReadyPanel

### Metis Review
**Identified Gaps** (addressed):
- Database migration per matches esistenti → OUT OF SCOPE (matches vecchi potenzialmente incompatibili)
- Bot AI GURPS-coupled → Minimo supporto PF2, non refactor completo
- `usedReaction` appartiene al tipo base (sia GURPS che PF2 hanno reactions)
- CharacterSheet refactoring → OUT OF SCOPE per questa fase

---

## Work Objectives

### Core Objective
Separare completamente GURPS e PF2 in modo che il codice "shared" sia veramente generico e ogni ruleset abbia il proprio codice isolato.

### Concrete Deliverables
1. `BaseCombatantState` type con campi universali
2. `GurpsCombatantState` e `PF2CombatantState` che estendono il base
3. Componenti GURPS spostati in `src/components/rulesets/gurps/`
4. `attack.ts` refactorato con logica delegata ad adapter
5. PF2 con azioni base funzionanti (Step, Stand, Drop Prone, flat-footed)
6. `shared/types.ts` pulito da export GURPS

### Definition of Done
- [ ] `npx vitest run` → 240+ test passano
- [ ] `npm run build` → compila senza errori (client e server)
- [ ] Match GURPS giocabile end-to-end (nessuna regressione)
- [ ] Match PF2 giocabile end-to-end con nuove azioni
- [ ] Nessun tipo GURPS-specifico esportato da `shared/types.ts`

### Must Have
- Backward compatibility per GURPS (zero regressioni)
- Type guards per distinguere combatants GURPS/PF2
- Test che passano dopo ogni fase

### Must NOT Have (Guardrails)
- NO refactoring di `CharacterSheet` (OUT OF SCOPE)
- NO modifiche allo schema database
- NO modifiche ai contratti WebSocket
- NO redesign UI (solo spostamento componenti)
- NO feature PF2 avanzate (spells, dying, hero points)
- NO bot AI improvements (solo minimo supporto PF2)

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Vitest)
- **User wants tests**: TDD dove possibile
- **Framework**: Vitest con happy-dom

### Verification Commands
```bash
npx vitest run                    # Tutti i test
npx vitest run -t "GURPS"         # Solo test GURPS
npx vitest run -t "PF2"           # Solo test PF2
npm run build                     # Type check + build
npm run dev && npm run dev --prefix server  # Test manuale
```

---

## Task Flow

```
Phase 1 (Types)
    ↓
Phase 2 (Components) ←→ Phase 3 (shared/ cleanup) [parallel]
    ↓
Phase 4 (attack.ts refactor)
    ↓
Phase 5 (PF2 features)
    ↓
Phase 6 (Final validation)
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 2.1-2.5 | Component moves are independent |
| B | 3.1, 3.2 | shared/ cleanups are independent |
| C | 5.1-5.4 | PF2 features are independent |

---

## TODOs

### Phase 1: Type System Refactoring

- [x] 1.1. Create BaseCombatantState type

  **What to do**:
  - Create `shared/rulesets/base/types.ts` with `BaseCombatantState`
  - Include fields: `playerId`, `characterId`, `position`, `facing`, `currentHP`, `statusEffects`, `usedReaction`
  - Export from `shared/rulesets/index.ts`

  **Must NOT do**:
  - Change existing `CombatantState` behavior
  - Add ruleset-specific fields to base

  **Parallelizable**: NO (foundation for all other tasks)

  **References**:
  - `shared/rulesets/gurps/types.ts:202-230` - Current CombatantState definition
  - `shared/rulesets/pf2/types.ts:89-102` - PF2CombatantState with pf2-specific fields

  **Acceptance Criteria**:
  - [ ] `BaseCombatantState` type exists with 7 fields
  - [ ] `npx vitest run` → all tests pass
  - [ ] `npm run build` → no errors

  **Commit**: YES
  - Message: `refactor(types): create BaseCombatantState for ruleset abstraction`
  - Files: `shared/rulesets/base/types.ts`, `shared/rulesets/index.ts`

- [x] 1.2. Refactor GurpsCombatantState to extend base

  **What to do**:
  - Modify `GurpsCombatantState` to extend `BaseCombatantState`
  - Remove duplicated fields from GURPS type
  - Keep `CombatantState` as alias to `GurpsCombatantState` (no breaking changes)

  **Must NOT do**:
  - Change any field names or types
  - Break existing imports

  **Parallelizable**: NO (depends on 1.1)

  **References**:
  - `shared/rulesets/gurps/types.ts:202-230` - Current definition to modify
  - `shared/rulesets/base/types.ts` - Base type to extend (from 1.1)

  **Acceptance Criteria**:
  - [ ] `GurpsCombatantState extends BaseCombatantState`
  - [ ] `CombatantState` is type alias (backward compat)
  - [ ] `npx vitest run` → all 240 tests pass
  - [ ] `npm run build` → no errors

  **Commit**: YES
  - Message: `refactor(types): GurpsCombatantState extends BaseCombatantState`
  - Files: `shared/rulesets/gurps/types.ts`

- [x] 1.3. Create proper PF2CombatantState extending base

  **What to do**:
  - Modify `PF2CombatantState` to extend `BaseCombatantState`
  - Add PF2-specific fields: `actionsRemaining`, `reactionAvailable`, `mapPenalty`, `attacksThisTurn`, `conditions`, `shieldRaised`
  - Remove the current `pf2?` optional extension pattern from `CombatantState`

  **Must NOT do**:
  - Remove fields needed by existing PF2 code
  - Break pf2-attack.ts handler

  **Parallelizable**: NO (depends on 1.1)

  **References**:
  - `shared/rulesets/pf2/types.ts:89-102` - Current PF2CombatantState
  - `server/src/handlers/pf2-attack.ts` - Uses `combatant.pf2.*` fields

  **Acceptance Criteria**:
  - [ ] `PF2CombatantState extends BaseCombatantState`
  - [ ] All PF2 tests pass: `npx vitest run -t "PF2"`
  - [ ] PF2 match playable in browser

  **Commit**: YES
  - Message: `refactor(types): PF2CombatantState extends BaseCombatantState`
  - Files: `shared/rulesets/pf2/types.ts`

- [x] 1.4. Create type guards for combatant discrimination

  **What to do**:
  - Create `isGurpsCombatant(c): c is GurpsCombatantState`
  - Create `isPF2Combatant(c): c is PF2CombatantState`
  - Export from `shared/rulesets/index.ts`

  **Must NOT do**:
  - Use runtime checks that could fail (use discriminant field)

  **Parallelizable**: NO (depends on 1.2, 1.3)

  **References**:
  - `shared/rulesets/serverAdapter.ts:448-454` - Existing `isGurpsMatch`/`isPf2Match` pattern

  **Acceptance Criteria**:
  - [ ] Type guards work correctly in if statements
  - [ ] TypeScript narrows type after guard
  - [ ] `npx vitest run` → passes

  **Commit**: YES
  - Message: `feat(types): add isGurpsCombatant/isPF2Combatant type guards`
  - Files: `shared/rulesets/index.ts`

---

### Phase 2: Component Relocation

- [x] 2.1. Move PostureControls to rulesets/gurps/

  **What to do**:
  - Move `src/components/ui/PostureControls.tsx` to `src/components/rulesets/gurps/PostureControls.tsx`
  - Update all imports (use LSP find references)
  - Update `src/components/rulesets/gurps/index.ts` exports

  **Must NOT do**:
  - Change component logic or styling
  - Rename the component

  **Parallelizable**: YES (with 2.2, 2.3, 2.4, 2.5)

  **References**:
  - `src/components/ui/PostureControls.tsx` - File to move
  - `src/components/rulesets/gurps/index.ts` - Export barrel to update

  **Acceptance Criteria**:
  - [ ] File moved to new location
  - [ ] All imports updated
  - [ ] `npm run build` → no errors
  - [ ] GURPS match: posture controls work

  **Commit**: YES (groups with 2.2-2.5)
  - Message: `refactor(ui): move GURPS-only components to rulesets/gurps/`
  - Files: Multiple component moves

- [x] 2.2. Move HitLocationPicker to rulesets/gurps/

  **What to do**:
  - Move `src/components/ui/HitLocationPicker.tsx` to `src/components/rulesets/gurps/HitLocationPicker.tsx`
  - Update all imports

  **Must NOT do**:
  - Change the SVG diagram or penalties

  **Parallelizable**: YES (with 2.1, 2.3, 2.4, 2.5)

  **References**:
  - `src/components/ui/HitLocationPicker.tsx` - File to move
  - `src/components/rulesets/gurps/GurpsGameActionPanel.tsx:38` - Imports HitLocationPicker

  **Acceptance Criteria**:
  - [ ] File moved
  - [ ] GURPS attack with hit location targeting works

  **Commit**: YES (groups with 2.1)

- [x] 2.3. Move DefenseModal to rulesets/gurps/

  **What to do**:
  - Move `src/components/ui/DefenseModal.tsx` to `src/components/rulesets/gurps/DefenseModal.tsx`
  - Update imports in `GameScreen.tsx`

  **Must NOT do**:
  - Change defense calculation logic

  **Parallelizable**: YES (with 2.1, 2.2, 2.4, 2.5)

  **References**:
  - `src/components/ui/DefenseModal.tsx` - File to move
  - `src/components/game/GameScreen.tsx:384` - Conditional render `rulesetId !== 'pf2'`

  **Acceptance Criteria**:
  - [ ] File moved
  - [ ] GURPS defense modal appears when attacked
  - [ ] PF2 match does NOT show defense modal

  **Commit**: YES (groups with 2.1)

- [x] 2.4. Move WaitTriggerPicker to rulesets/gurps/

  **What to do**:
  - Move `src/components/ui/WaitTriggerPicker.tsx` to `src/components/rulesets/gurps/WaitTriggerPicker.tsx`
  - Update imports

  **Must NOT do**:
  - Change trigger options

  **Parallelizable**: YES (with 2.1, 2.2, 2.3, 2.5)

  **References**:
  - `src/components/ui/WaitTriggerPicker.tsx` - File to move

  **Acceptance Criteria**:
  - [ ] File moved
  - [ ] GURPS Wait maneuver trigger selection works

  **Commit**: YES (groups with 2.1)

- [x] 2.5. Move ReadyPanel to rulesets/gurps/

  **What to do**:
  - Move `src/components/ui/ReadyPanel.tsx` to `src/components/rulesets/gurps/ReadyPanel.tsx`
  - Update imports

  **Must NOT do**:
  - Change equipment ready logic

  **Parallelizable**: YES (with 2.1, 2.2, 2.3, 2.4)

  **References**:
  - `src/components/ui/ReadyPanel.tsx` - File to move

  **Acceptance Criteria**:
  - [ ] File moved
  - [ ] GURPS Ready action equipment panel works

  **Commit**: YES (groups with 2.1)

---

### Phase 3: Shared Directory Cleanup

- [ ] 3.1. Clean shared/types.ts exports

  **What to do**:
  - Remove GURPS-specific type exports from `shared/types.ts`
  - Keep only truly generic types: `Id`, `RulesetId`, `Player`, `MatchState`, `GridPosition`, etc.
  - Add explicit imports from `rulesets/gurps/types` where GURPS types are needed

  **Must NOT do**:
  - Break existing imports (provide migration path)

  **Parallelizable**: YES (with 3.2)

  **References**:
  - `shared/types.ts:5-36` - Current GURPS re-exports to remove
  - Use `lsp_find_references` on each type before removing

  **Acceptance Criteria**:
  - [ ] `Posture`, `HitLocation`, `ManeuverType` NOT exported from `shared/types.ts`
  - [ ] All imports updated to use `rulesets/gurps/types` directly
  - [ ] `npx vitest run` → all tests pass

  **Commit**: YES
  - Message: `refactor(types): remove GURPS-specific exports from shared/types.ts`
  - Files: `shared/types.ts`, multiple import updates

- [ ] 3.2. Remove or repurpose shared/rules.ts

  **What to do**:
  - `shared/rules.ts` currently only re-exports GURPS rules
  - Option A: Delete file, update imports to use adapter
  - Option B: Make it export generic utilities only

  **Must NOT do**:
  - Break test imports

  **Parallelizable**: YES (with 3.1)

  **References**:
  - `shared/rules.ts:1` - Current single-line re-export
  - `shared/rules.test.ts` - Tests that import from rules.ts

  **Acceptance Criteria**:
  - [ ] `shared/rules.ts` either deleted or contains only generic utilities
  - [ ] All tests pass

  **Commit**: YES
  - Message: `refactor: remove GURPS-only shared/rules.ts re-export`
  - Files: `shared/rules.ts`, test imports

---

### Phase 4: Attack Handler Refactoring

- [ ] 4.1. Extract bot defense logic to adapter

  **What to do**:
  - Lines 633-699 in `attack.ts` contain bot defense selection
  - Create `adapter.combat.selectBotDefense(options, random)` method
  - Implement for GURPS (current logic), stub for PF2 (no active defense)

  **Must NOT do**:
  - Change GURPS bot defense behavior
  - Make PF2 bots do active defense

  **Parallelizable**: NO (depends on Phase 1-3)

  **References**:
  - `server/src/handlers/attack.ts:633-699` - Bot defense logic to extract
  - `shared/rulesets/serverAdapter.ts:31-57` - CombatDomain interface to extend

  **Acceptance Criteria**:
  - [ ] `adapter.combat.selectBotDefense()` method exists
  - [ ] GURPS bot defense unchanged (same random seed = same choice)
  - [ ] PF2 bot attacks don't try to select defense

  **Commit**: YES
  - Message: `refactor(attack): extract bot defense logic to adapter`
  - Files: `serverAdapter.ts`, `attack.ts`

- [ ] 4.2. Extract attack skill calculation to adapter

  **What to do**:
  - Attack skill calculation includes maneuver bonuses (aim, evaluate), shock, deceptive attack, rapid strike
  - Create `adapter.combat.calculateEffectiveSkill(combatant, target, options)` 
  - Move all GURPS skill modifiers into GURPS adapter implementation

  **Must NOT do**:
  - Change final effective skill for same inputs

  **Parallelizable**: NO (depends on 4.1)

  **References**:
  - `server/src/handlers/attack.ts:461-530` - Skill calculation with all modifiers
  - `shared/rulesets/serverAdapter.ts` - Adapter to extend

  **Acceptance Criteria**:
  - [ ] Skill calculation delegated to adapter
  - [ ] GURPS attacks have same effective skill
  - [ ] Tests pass

  **Commit**: YES
  - Message: `refactor(attack): extract skill calculation to adapter`
  - Files: `serverAdapter.ts`, `attack.ts`

- [ ] 4.3. Extract defense resolution to adapter

  **What to do**:
  - Defense resolution includes retreat, dodge-and-drop, parry penalties
  - Create `adapter.combat.resolveDefense(defender, attackResult, defenseChoice, options)`
  - Move all GURPS defense logic into GURPS adapter

  **Must NOT do**:
  - Change defense outcomes

  **Parallelizable**: NO (depends on 4.2)

  **References**:
  - `server/src/handlers/attack.ts:700-780` - Defense resolution logic
  - `shared/rulesets/serverAdapter.ts:31-57` - CombatDomain to extend

  **Acceptance Criteria**:
  - [ ] Defense resolution delegated to adapter
  - [ ] GURPS defense outcomes unchanged
  - [ ] All tests pass

  **Commit**: YES
  - Message: `refactor(attack): extract defense resolution to adapter`
  - Files: `serverAdapter.ts`, `attack.ts`

- [ ] 4.4. Clean attack.ts of remaining GURPS coupling

  **What to do**:
  - Review remaining GURPS-specific code in attack.ts
  - Move maneuver checks to adapter
  - Move critical table calls to adapter (already partially done)
  - Ensure handler is ruleset-agnostic

  **Must NOT do**:
  - Break any combat mechanics

  **Parallelizable**: NO (depends on 4.3)

  **References**:
  - `server/src/handlers/attack.ts` - Full file review
  - `server/src/handlers/movement.ts` - Model of good abstraction

  **Acceptance Criteria**:
  - [ ] No direct `maneuver` field access in attack.ts
  - [ ] No direct `posture` field access in attack.ts
  - [ ] All 180 GURPS tests pass
  - [ ] PF2 attacks still work

  **Commit**: YES
  - Message: `refactor(attack): complete GURPS decoupling from attack handler`
  - Files: `attack.ts`

---

### Phase 5: PF2 Feature Completion

- [ ] 5.1. Implement Step action for PF2

  **What to do**:
  - Add `Step` to PF2 action list (free action, 5ft/1 square move, no trigger AoO)
  - Update `PF2GameActionPanel.tsx` with Step button
  - Implement in `pf2-attack.ts` or new `pf2-movement.ts` handler

  **Must NOT do**:
  - Make Step cost an action (it's free in PF2)
  - Allow Step to exceed 5ft

  **Parallelizable**: YES (with 5.2, 5.3, 5.4)

  **References**:
  - `src/components/rulesets/pf2/PF2GameActionPanel.tsx` - Add Step button
  - `shared/rulesets/pf2/rules.ts:258-283` - getActionCost shows 'step' is free

  **Acceptance Criteria**:
  - [ ] Step button visible in PF2 action panel
  - [ ] Step moves character 1 square
  - [ ] Step doesn't cost an action
  - [ ] New test for Step action

  **Commit**: YES
  - Message: `feat(pf2): implement Step action`
  - Files: PF2 components and handlers

- [ ] 5.2. Implement Stand action for PF2

  **What to do**:
  - Add `Stand` action (1 action, removes prone condition)
  - Update UI to show Stand when character is prone
  - Implement handler logic

  **Must NOT do**:
  - Allow Stand when not prone

  **Parallelizable**: YES (with 5.1, 5.3, 5.4)

  **References**:
  - `shared/rulesets/pf2/rules.ts:265` - 'stand' costs 1 action
  - `shared/rulesets/pf2/types.ts` - Add 'prone' to conditions

  **Acceptance Criteria**:
  - [ ] Stand button visible when prone
  - [ ] Stand removes prone condition
  - [ ] Stand costs 1 action
  - [ ] New test for Stand action

  **Commit**: YES
  - Message: `feat(pf2): implement Stand action`
  - Files: PF2 components and handlers

- [ ] 5.3. Implement Drop Prone action for PF2

  **What to do**:
  - Add `Drop Prone` action (1 action, gains prone condition)
  - Update UI with Drop Prone button
  - Implement handler logic

  **Must NOT do**:
  - Allow Drop Prone when already prone

  **Parallelizable**: YES (with 5.1, 5.2, 5.4)

  **References**:
  - `shared/rulesets/pf2/rules.ts:277` - 'drop_prone' is free action
  - Note: PF2 Drop Prone is actually free, not 1 action

  **Acceptance Criteria**:
  - [ ] Drop Prone button visible when standing
  - [ ] Drop Prone adds prone condition
  - [ ] Drop Prone is free action
  - [ ] New test for Drop Prone

  **Commit**: YES
  - Message: `feat(pf2): implement Drop Prone action`
  - Files: PF2 components and handlers

- [ ] 5.4. Implement flat-footed condition for PF2

  **What to do**:
  - Add `flat-footed` condition type
  - Apply -2 AC when flat-footed
  - Show condition in status panel
  - Apply flat-footed when flanked (optional, can be manual for now)

  **Must NOT do**:
  - Implement automatic flanking detection (complex)
  - Add other conditions (frightened, stunned, etc.)

  **Parallelizable**: YES (with 5.1, 5.2, 5.3)

  **References**:
  - `shared/rulesets/pf2/types.ts:35-47` - ConditionName type
  - `shared/rulesets/pf2/rules.ts:123-134` - calculateAC function to modify

  **Acceptance Criteria**:
  - [ ] flat-footed reduces AC by 2
  - [ ] Condition visible in UI
  - [ ] Attack against flat-footed target shows correct AC
  - [ ] New test for flat-footed

  **Commit**: YES
  - Message: `feat(pf2): implement flat-footed condition`
  - Files: PF2 types, rules, UI components

---

### Phase 6: Final Validation

- [ ] 6.1. Full regression test

  **What to do**:
  - Run complete test suite
  - Verify all 240+ tests pass
  - Check for any skipped or pending tests

  **Parallelizable**: NO (final step)

  **Acceptance Criteria**:
  - [ ] `npx vitest run` → 244+ tests pass (240 existing + 4 new PF2)
  - [ ] No skipped tests
  - [ ] No TypeScript errors

  **Commit**: NO

- [ ] 6.2. Manual GURPS playthrough

  **What to do**:
  - Start fresh GURPS match
  - Test all maneuvers (Move, Attack, All-Out Attack, All-Out Defense, etc.)
  - Test defense modal
  - Test posture changes
  - Test hit location targeting
  - Verify combat log messages

  **Parallelizable**: NO

  **Acceptance Criteria**:
  - [ ] All GURPS mechanics work as before migration
  - [ ] No visual regressions
  - [ ] No console errors

  **Commit**: NO

- [ ] 6.3. Manual PF2 playthrough

  **What to do**:
  - Start fresh PF2 match
  - Test all actions (Strike, Stride, Step, Stand, Drop Prone, Raise Shield, Interact)
  - Test action economy (3 actions per turn)
  - Test flat-footed condition
  - Verify square grid
  - Test bot opponent

  **Parallelizable**: NO

  **Acceptance Criteria**:
  - [ ] All PF2 actions work
  - [ ] 3-action economy correct
  - [ ] flat-footed applies -2 AC
  - [ ] Bot takes valid PF2 actions

  **Commit**: NO

- [ ] 6.4. Update documentation

  **What to do**:
  - Update AGENTS.md if architecture section exists
  - Add comments to key abstraction points
  - Document how to add a new ruleset

  **Parallelizable**: NO

  **Acceptance Criteria**:
  - [ ] Architecture documented
  - [ ] New ruleset guide exists

  **Commit**: YES
  - Message: `docs: update architecture for multi-ruleset support`
  - Files: `AGENTS.md` or `README.md`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1.1 | `refactor(types): create BaseCombatantState` | shared/rulesets/base/* | `npx vitest run` |
| 1.2 | `refactor(types): GurpsCombatantState extends base` | gurps/types.ts | `npx vitest run` |
| 1.3 | `refactor(types): PF2CombatantState extends base` | pf2/types.ts | `npx vitest run -t PF2` |
| 1.4 | `feat(types): add combatant type guards` | rulesets/index.ts | `npx vitest run` |
| 2.1-2.5 | `refactor(ui): move GURPS components to rulesets/` | multiple | `npm run build` |
| 3.1 | `refactor(types): clean shared/types.ts exports` | shared/types.ts | `npx vitest run` |
| 3.2 | `refactor: remove shared/rules.ts GURPS re-export` | shared/rules.ts | `npx vitest run` |
| 4.1 | `refactor(attack): extract bot defense to adapter` | serverAdapter, attack | `npx vitest run` |
| 4.2 | `refactor(attack): extract skill calculation` | serverAdapter, attack | `npx vitest run` |
| 4.3 | `refactor(attack): extract defense resolution` | serverAdapter, attack | `npx vitest run` |
| 4.4 | `refactor(attack): complete GURPS decoupling` | attack.ts | `npx vitest run` |
| 5.1 | `feat(pf2): implement Step action` | pf2/* | `npx vitest run -t PF2` |
| 5.2 | `feat(pf2): implement Stand action` | pf2/* | `npx vitest run -t PF2` |
| 5.3 | `feat(pf2): implement Drop Prone action` | pf2/* | `npx vitest run -t PF2` |
| 5.4 | `feat(pf2): implement flat-footed condition` | pf2/* | `npx vitest run -t PF2` |
| 6.4 | `docs: update architecture documentation` | docs | N/A |

---

## Success Criteria

### Verification Commands
```bash
npx vitest run                           # Expected: 244+ tests pass
npm run build                            # Expected: no errors
npm run dev & npm run dev --prefix server  # Manual testing
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] GURPS gameplay unchanged
- [ ] PF2 gameplay improved with new actions
- [ ] Clean separation in folder structure
- [ ] No GURPS types in shared/types.ts exports
