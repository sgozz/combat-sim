# Missing Features — GURPS + PF2

## TL;DR

> **Quick Summary**: Implement 8 missing features across GURPS (Armor/DR, Wait triggers, Feint, Concentrate, Advantage effects) and PF2 (Spell effects, Advanced actions, Dying/Wounded) to complete the combat simulator.
> 
> **Deliverables**:
> - GURPS per-location Armor/DR in damage pipeline
> - GURPS Wait trigger full interrupt system
> - GURPS AOA Feint variant (quick contest → defense penalty)
> - GURPS Concentrate maneuver
> - GURPS mechanical advantage effects (4 advantages)
> - PF2 spell effect application (damage, healing, buff/debuff)
> - PF2 advanced combat actions (Grapple, Trip, Disarm, Feint, Demoralize)
> - PF2 dying/wounded/recovery system
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: Task 1 → Task 5 (Armor → Advantages), Task 8 → Task 7 (Dying → Spell Effects)

---

## Context

### Original Request
User asked for a comprehensive audit of missing features, then requested a plan for everything that's missing.

### Interview Summary
**Key Discussions**:
- Code audit revealed 9 missing features; Metis confirmed Surrender is already implemented (handlers.ts:462-474), reducing scope to 8
- Old planning docs (IMPLEMENTATION_PLAN.md, UI_REDESIGN_PROPOSAL.md) were outdated and removed
- Completed .sisyphus plans (pf2-complete, architecture-refactor, multi-ruleset-refactor) also cleaned up

**User Decisions**:
- Armor/DR: Per-location (leverages existing Hit Location system)
- Wait trigger: Full interrupt (mid-turn interruption, architecturally invasive but faithful to GURPS)
- Advantages: All 4 — Combat Reflexes, High Pain Threshold, Hard to Kill, Enhanced Parry
- PF2 Spells: All 3 categories — damage, healing, buff/debuff

### Metis Review
**Identified Gaps** (addressed):
- Surrender removed from scope (already implemented)
- Armor/DR must use ruleset-specific branch to not break PF2 damage pipeline
- Wait trigger interrupt system needs careful design (current architecture is strict turn-based)
- Advantage effects need lookup table approach (Advantage type has no mechanical fields)
- PF2 spell effects need a SpellDefinition data structure
- Dependency ordering established: Armor/DR before Advantages, Dying/Wounded before Spell Effects

---

## Work Objectives

### Core Objective
Complete the combat simulator by implementing all 8 remaining mechanical features across GURPS and PF2 rulesets.

### Concrete Deliverables
- 8 features fully working with server logic, rules engine, and tests
- All features follow existing adapter pattern
- No regressions on existing 442+ tests

### Definition of Done
- [ ] `npx vitest run` passes with 442+ original tests + new tests
- [ ] `npm run build` succeeds (client)
- [ ] `npm run build --prefix server` succeeds (server)
- [ ] Each feature has dedicated unit tests in `shared/rulesets/` test files

### Must Have
- Per-location DR in GURPS damage pipeline
- Full interrupt Wait trigger system
- AOA Feint with quick contest
- Concentrate maneuver (no attack, optional step)
- 4 advantage mechanical hooks
- PF2 spell effect pipeline (damage, heal, conditions)
- PF2 Grapple/Trip/Disarm/Feint/Demoralize actions
- PF2 dying/wounded state machine with recovery checks

### Must NOT Have (Guardrails)
- **No new UI components** — existing UI layer is complete; only enable disabled buttons, add data display, or add action buttons to existing PF2GameActionPanel/PF2ActionBar grids following the existing button pattern
- **No bot AI** for new features — bot intelligence is a separate concern
- **Minimal spell data only** — a small `spellData.ts` with 6-8 representative spells is allowed (pipeline infrastructure, not content expansion)
- **No refactoring** of existing working features
- **No hardcoded `if (rulesetId === 'gurps')`** — use adapter pattern
- **No `any` types** — strict TypeScript throughout
- **No changes to Equipment type that break existing templates** — add optional fields only

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (vitest, 442 tests passing)
- **User wants tests**: TDD
- **Framework**: vitest (`npx vitest run`)

### TDD Workflow
Each TODO follows RED-GREEN-REFACTOR:
1. **RED**: Write failing test first in appropriate test file
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping green

### Regression Check
After every task: `npx vitest run` must pass ALL tests (442 baseline + new).

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — independent foundations):
├── Task 1: GURPS Armor/DR system
├── Task 2: GURPS Concentrate maneuver
├── Task 3: GURPS AOA Feint variant
└── Task 8: PF2 Dying/Wounded system

Wave 2 (After Wave 1 — depends on foundations):
├── Task 4: GURPS Wait trigger interrupt (standalone but complex)
├── Task 5: GURPS Advantage effects (depends: Task 1 for DR interaction)
└── Task 7: PF2 Spell effects pipeline (depends: Task 8 for healing target)

Wave 3 (After Wave 2):
└── Task 6: PF2 Advanced actions (depends: Task 8 for condition framework)

Wave 4 (Final):
└── Task 9: Fix hardcoded GURPS fallback in serverAdapter.ts
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 (Armor/DR) | None | 5 | 2, 3, 8 |
| 2 (Concentrate) | None | None | 1, 3, 8 |
| 3 (Feint) | None | None | 1, 2, 8 |
| 4 (Wait Trigger) | None | None | 5, 7 |
| 5 (Advantages) | 1 | None | 4, 7 |
| 6 (PF2 Actions) | 8 | None | — |
| 7 (PF2 Spells) | 8 | None | 4, 5 |
| 8 (PF2 Dying) | None | 6, 7 | 1, 2, 3 |
| 9 (Fallback fix) | None | None | Any |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2, 3, 8 | 4 parallel agents: `category="unspecified-high"` |
| 2 | 4, 5, 7 | 3 parallel agents: Task 4 = `category="ultrabrain"`, Tasks 5,7 = `category="unspecified-high"` |
| 3 | 6 | 1 agent: `category="unspecified-high"` |
| 4 | 9 | 1 agent: `category="quick"` |

---

## TODOs

- [ ] 1. GURPS Per-Location Armor/DR System

  **What to do**:
  - Add `dr?: number` and `coveredLocations?: HitLocation[]` fields to `Equipment` type (optional, backwards-compatible)
  - **Worn armor semantics**: All equipment items with `type: 'armor'` are considered worn and always active. No "equip/unequip" mechanism needed — if it's in `character.equipment` with `type: 'armor'`, its DR applies. This matches how weapons work: they're listed in equipment and assumed ready.
  - **Template builder update**: The current template builder in `src/data/characterTemplates.ts:6-23` maps equipment to `{ type: 'melee' as const, ...e }`. Add a parallel `armor` array to the template structure that maps to `{ type: 'armor' as const, dr, coveredLocations, ...a }`. Existing templates without armor continue to work (optional field).
  - Add armor equipment to character templates (e.g., Knight: Chain Mail DR 4 covering torso/groin/arms/legs; Barbarian: Leather DR 2 covering torso/groin)
  - Create `getLocationDR(character, hitLocation)` pure function in `rules.ts`: iterate `character.equipment.filter(e => e.type === 'armor')`, find items whose `coveredLocations` includes `hitLocation`, return highest DR among matching items (stacking rule: best DR wins, per GURPS B282)
  - Insert DR subtraction in `applyDamageToTarget` (damage.ts) BEFORE wounding multiplier is applied (GURPS B379: DR reduces penetrating damage, then multiplier applies). Use adapter: call `adapter.damage?.getLocationDR?.(character, hitLocation) ?? 0` so PF2 path returns 0.
  - Penetrating damage = max(0, baseDamage - DR), then apply wounding multiplier
  - Write tests: DR reduces damage, DR > damage = 0 injury, DR = 0 means full damage, per-location coverage (hit unarmored location = no DR), wounding multiplier applied AFTER DR, highest DR wins when multiple armor pieces cover same location

  **Must NOT do**:
  - Do not change the PF2 damage pipeline
  - Do not make `dr` a required field (breaks existing templates)
  - Do not add DR to `HIT_LOCATION_DATA` constant (DR comes from equipment, not location data)
  - Do not implement equip/unequip armor — armor in equipment list is always worn

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multi-file feature touching types, rules, server handler, and templates
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI changes needed (DR display is existing GurpsGameStatusPanel)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 8)
  - **Blocks**: Task 5 (Advantages — some interact with DR)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `shared/rulesets/gurps/rules.ts:557-573` — `HIT_LOCATION_DATA` constant with all 15 locations and their multipliers. Follow this pattern for DR lookup functions.
  - `shared/rulesets/gurps/rules.ts:575-591` — `getHitLocationPenalty` and `getHitLocationWoundingMultiplier` — follow this pattern for `getLocationDR()` function signature.
  - `server/src/handlers/shared/damage.ts:25-98` — `applyDamageToTarget` — the entire damage pipeline. DR subtraction goes between line 42 (baseDamage received) and line 44 (wounding multiplier applied).

  **API/Type References**:
  - `shared/rulesets/gurps/types.ts:73-87` — `Equipment` type. Add optional `dr?: number` and `coveredLocations?: HitLocation[]` here.
  - `shared/rulesets/gurps/types.ts:51-66` — `HitLocation` type union (15 locations). Use this for `coveredLocations` field type.
  - `shared/rulesets/gurps/characterSheet.ts:11` — `equipment: Equipment[]` on GurpsCharacterSheet. Armor items go here.

  **Test References**:
  - `shared/rules.test.ts:454-482` — `describe('Damage Type Multipliers')` — follow this test structure for DR tests.
  - `shared/rules.test.ts:1452-1567` — `describe('Hit Location System')` — existing location tests, add DR tests nearby.

  **Documentation References**:
  - `docs/GURPS_COMBAT_DECISION_TREE.md` — GURPS combat flow reference.

  **External References**:
  - GURPS Basic Set 4th Ed B379: DR is subtracted from damage before wounding multiplier.

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test file: `shared/rules.test.ts` (add to existing — this is the GURPS test file, NOT `shared/rulesets/gurps/rules.test.ts` which does not exist)
  - [ ] Tests cover: DR subtraction before wounding multiplier, DR=0 full damage, DR > damage = 0 injury, per-location coverage, unarmored location = no DR, highest DR wins
  - [ ] `npx vitest run shared/rules.test.ts` → PASS (all existing + new tests)

  **Automated Verification:**
  ```bash
  npx vitest run -t "Armor DR"
  # Assert: All new DR tests pass
  npx vitest run
  # Assert: 442+ tests pass (no regressions)
  ```

  **Commit**: YES
  - Message: `feat(gurps): add per-location armor DR system`
  - Files: `shared/rulesets/gurps/types.ts`, `shared/rulesets/gurps/rules.ts`, `server/src/handlers/shared/damage.ts`, `src/data/characterTemplates.ts`, `shared/rules.test.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 2. GURPS Concentrate Maneuver

  **What to do**:
  - Add `'concentrate'` to `ManeuverType` union in types.ts
  - Add Concentrate entry to `MANEUVERS` array in ui.ts (key, label, desc, shortcut)
  - Add `concentrate` case to `getMovePointsForManeuver` in rules.ts (returns 1 — allows a step per GURPS B366)
  - Add `concentrate` case in router.ts `select_maneuver` handler (no attack allowed, similar to `do_nothing`)
  - Write tests: Concentrate allows 1 MP (step), Concentrate does not allow attack

  **Must NOT do**:
  - Do not implement spell/magic system (that's a separate feature)
  - Do not add special concentrate effects — just the maneuver selection and movement allowance

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small change across 4 files, straightforward addition following existing patterns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 8)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `shared/rulesets/gurps/types.ts:110-122` — `ManeuverType` union. Add `'concentrate'` here.
  - `shared/rulesets/gurps/ui.ts:4-16` — `MANEUVERS` array. Follow existing entry format for Concentrate.
  - `shared/rulesets/gurps/rules.ts:1188-1213` — `getMovePointsForManeuver` switch statement. Add `case 'concentrate': return 1;` (allows a step).
  - `server/src/handlers/gurps/router.ts:42-143` — `select_maneuver` handler. Concentrate needs no special logic — default path works (set maneuver, initialize movement).

  **Test References**:
  - `shared/rules.test.ts` — Add tests near movement point tests.

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test: Concentrate maneuver allows 1 move point (step only)
  - [ ] Test: Concentrate maneuver does not allow attack
  - [ ] `npx vitest run -t "Concentrate"` → PASS

  **Automated Verification:**
  ```bash
  npx vitest run -t "Concentrate"
  npx vitest run
  # Assert: 442+ tests pass
  ```

  **Commit**: YES
  - Message: `feat(gurps): add Concentrate maneuver`
  - Files: `shared/rulesets/gurps/types.ts`, `shared/rulesets/gurps/ui.ts`, `shared/rulesets/gurps/rules.ts`, `server/src/handlers/gurps/router.ts`, `shared/rules.test.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 3. GURPS AOA Feint Variant

  **What to do**:
  - Implement Feint as AOA variant: a Quick Contest (attacker's melee weapon skill vs defender's best melee defense skill) that reduces defender's defense on the follow-up attack

  **Full Data Flow (step by step)**:
  1. **Attacker skill**: Use the attacker's weapon skill (same skill used for the attack roll). This is already available in the attack handler as `effectiveSkill` computed via `adapter.combat.calculateEffectiveSkill`.
  2. **Defender's best defense skill**: Compute as the HIGHEST of defender's active defense VALUES (not skills): `Math.max(dodge, bestParry, bestBlock)` using `getDefenseOptions(defenderCharacter)` from `rules.ts:286-319`. This returns `{ dodge, parries: [{value, weapon}], blocks: [{value}] }`.
  3. **Quick Contest**: Call existing `quickContest(attackerSkill, defenderBestDefense, random)` from `rules.ts:835-861`. Returns `{ attackerWins, margin }`.
  4. **Store result**: If `attackerWins && margin > 0`, store `feintPenalty: margin` on the `PendingDefense` object. Add `feintPenalty?: number` to `PendingDefense` type in `types.ts:157-166` (alongside existing `deceptivePenalty`).
  5. **Consume penalty**: In `calculateDefenseValue` (`rules.ts:328-372`), subtract `feintPenalty` from the defense value. Add it after the deceptive penalty line (rules.ts:364). The function signature needs a new optional param: `feintPenalty?: number`.
  6. **Server integration**: In `attack.ts` (the `handleAttackAction` function), BEFORE constructing `pendingDefense` (~line 744), check if `actorCombatant.aoaVariant === 'feint'`. If so, run the feint contest, compute the penalty, and include it in the `pendingDefense` object at line 753.
  7. **DO NOT put feint logic in `gurpsGetAttackerManeuverInfo`** — that function only returns static skill/damage bonuses and has no access to defender data or RNG. The feint contest must happen in `attack.ts` where both attacker and defender data are available.

  - In `ui.ts`: update Feint label to remove "(not implemented)" and enable the button
  - In `GurpsGameActionPanel.tsx` lines 123-124: remove the disabled condition for feint
  - In `DefenseModal.tsx`: display feint penalty alongside deceptive penalty (follow same pattern at lines 136-139)
  - Write tests: Feint reduces defense by margin, Feint with 0 or negative margin = no penalty, Feint requires AOA maneuver

  **Must NOT do**:
  - Do not implement standalone Feint maneuver (that's a separate GURPS mechanic — this is only the AOA Feint variant)
  - No bot AI for choosing feint

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Touches rules, server adapter, attack handler, UI — needs understanding of quick contest and defense system
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 8)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `shared/rulesets/gurps/rules.ts:835-861` — `quickContest(attackerSkill, defenderSkill, random)` — USE THIS for the feint contest. Returns `{ attacker, defender, attackerWins, margin }`.
  - `shared/rulesets/gurps/rules.ts:286-319` — `getDefenseOptions(character)` — USE THIS to compute defender's best defense value for the feint contest.
  - `server/src/handlers/gurps/attack.ts:744-755` — `pendingDefense` construction with `deceptivePenalty`. ADD `feintPenalty` here. This is where feint contest runs (both attacker and defender data available).
  - `shared/rulesets/gurps/rules.ts:328-372` — `calculateDefenseValue` — ADD `feintPenalty` subtraction here (follow `deceptivePenalty` pattern at line 364).
  - `src/components/rulesets/gurps/DefenseModal.tsx:136-139` — deceptive penalty display. Follow pattern for feint penalty display.
  - **DO NOT modify** `shared/rulesets/serverAdapter.ts:605-625` (`gurpsGetAttackerManeuverInfo`) — it lacks defender data and RNG access.

  **API/Type References**:
  - `shared/rulesets/gurps/types.ts:138` — `AOAVariant = 'determined' | 'strong' | 'double' | 'feint'` — type already includes 'feint'.
  - `shared/rulesets/gurps/types.ts:157-166` — `PendingDefense` type with `deceptivePenalty`. Add `feintPenalty?: number` here.

  **Test References**:
  - `shared/rules.test.ts:835-861` — Quick Contest tests. Add Feint tests nearby.
  - `shared/rules.test.ts:944-966` — Deceptive Attack tests. Follow this pattern for Feint penalty tests.

  **External References**:
  - GURPS Basic Set B365: All-Out Attack (Feint) — Quick Contest of Skills, margin reduces target's defense.

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test: resolveFeint returns margin from quick contest
  - [ ] Test: Feint penalty reduces defense value
  - [ ] Test: Feint with 0 or negative margin = no penalty
  - [ ] `npx vitest run -t "Feint"` → PASS

  **Automated Verification:**
  ```bash
  npx vitest run -t "Feint"
  npx vitest run
  # Assert: 442+ tests pass
  ```

  **Commit**: YES
  - Message: `feat(gurps): implement AOA Feint variant with quick contest`
  - Files: `shared/rulesets/gurps/rules.ts`, `shared/rulesets/gurps/types.ts`, `shared/rulesets/gurps/ui.ts`, `shared/rulesets/serverAdapter.ts`, `server/src/handlers/gurps/attack.ts`, `src/components/rulesets/gurps/DefenseModal.tsx`, `src/components/rulesets/gurps/GurpsGameActionPanel.tsx`, `shared/rules.test.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 4. GURPS Wait Trigger Full Interrupt System

  **What to do**:
  - Design: When a combatant takes an action that matches another combatant's wait trigger, the waiting combatant's action interrupts and executes immediately before the triggering action completes.

  **Step 1: Extend WaitTrigger type** (`shared/rulesets/gurps/types.ts:124-136`):
  Current `WaitTrigger` only stores `{ condition, targetId?, action }` but lacks the payload needed to execute the action. Extend to:
  ```
  WaitTrigger = {
    condition: WaitTriggerCondition;
    targetId?: Id;                    // existing: who to watch
    action: WaitTriggerAction;         // existing: what to do
    // NEW: action payload (pre-configured when Wait is set)
    attackPayload?: {                  // for action: 'attack'
      targetId: Id;                    // auto-set: closest enemy or trigger source
      weaponId?: Id;                   // current ready weapon at time of Wait
      hitLocation?: HitLocation;       // optional: pre-selected location
    };
    movePayload?: {                    // for action: 'move'
      direction: 'toward_trigger' | 'away_from_trigger';  // simplified: move 1 hex toward/away from trigger source
    };
    readyPayload?: {                   // for action: 'ready'
      readyAction: string;             // e.g., 'draw', weapon id
      itemId?: Id;
    };
  };
  ```
  When the player sets a Wait trigger (router.ts:254-281), the UI should also capture the action payload. For V1 simplification: `attack` auto-targets the trigger source, `move` steps 1 hex toward trigger source, `ready` uses current ready state.

  **Step 2: Create trigger checker** — `checkWaitTriggers(combatants, triggerEvent)` pure function in `rules.ts`. `triggerEvent` type:
  ```
  { type: WaitTriggerCondition, actorId: Id, targetId?: Id, actorPosition: HexPosition }
  ```
  Returns `WaitingCombatant | null` — the first matching waiter (see tie-breaking below).

  **Step 3: Create server handler** — `executeWaitInterrupt(match, waitingCombatantId, triggerSourceId)` in a new file `server/src/handlers/gurps/wait-interrupt.ts`:
  1. Save current `activeTurnPlayerId` to restore later
  2. Set `activeTurnPlayerId` to waiting combatant temporarily
  3. Based on `waitTrigger.action`:
     - `attack`: Call `handleAttackAction` with the stored attackPayload (auto-target trigger source)
     - `move`: Execute 1 hex step toward/away from trigger source using `executeMove`
     - `ready`: Call `handleReadyAction` with stored readyPayload
  4. Clear `waitTrigger` on the combatant
  5. Restore original `activeTurnPlayerId`
  6. Broadcast updated match state

  **Step 4: Insert trigger checks** at these server-side points:
  - **`enemy_moves_adjacent`**: In `movement.ts:handleMoveStep`, after position update (~line 70) — check if any waiter has this trigger and the moving combatant is now adjacent (hexDistance ≤ 1)
  - **`enemy_enters_reach`**: In `movement.ts:handleMoveStep`, after position update — check if moving combatant entered a waiter's weapon reach (`canAttackAtDistance`)
  - **`enemy_attacks_me`**: In `attack.ts:handleAttackAction`, before attack roll (~line 400) — check if target has this trigger
  - **`enemy_attacks_ally`**: In `attack.ts:handleAttackAction`, before attack roll — check if any ally of the target (same team, not target) has this trigger

  **Tie-breaking rules** (when multiple waiters trigger simultaneously):
  - Use initiative order: the waiter with the earliest turn in the current round acts first
  - Only ONE wait trigger fires per triggering event (the highest-priority waiter)
  - If waiter becomes invalid (unconscious, stunned, or HP ≤ 0) at trigger time: skip trigger, clear it, move to next waiter

  **Edge cases**:
  - Waiter is stunned/unconscious at trigger time → trigger is wasted (cleared, no action)
  - Trigger source dies from wait attack → original action is cancelled (e.g., enemy was moving, got killed by wait attack, movement stops)
  - Wait trigger set but waiter's turn comes around → trigger is cleared by `advanceTurn` (already done at rules.ts:726)

  - Write tests: each trigger condition fires correctly, trigger clears after firing, trigger doesn't fire on wrong condition, interrupt resolves before original action, invalid waiter skipped, tie-breaking by initiative

  **Must NOT do**:
  - Do not add new WaitTriggerCondition values — only implement the 4 existing ones
  - Do not add bot AI for wait decisions
  - Do not modify the core `advanceTurn` logic beyond what's needed for interrupt
  - Do not chain wait triggers (a wait interrupt cannot trigger another wait)

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Most architecturally complex task — requires mid-turn interruption in a turn-based system, careful state management, edge cases (what if two waiters trigger simultaneously?)
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (but starts in Wave 2 for scheduling reasons)
  - **Parallel Group**: Wave 2 (with Tasks 5, 7)
  - **Blocks**: None
  - **Blocked By**: None (architecturally independent)

  **References**:

  **Pattern References**:
  - `server/src/handlers/gurps/router.ts:254-281` — `set_wait_trigger` handler. Shows how triggers are stored on combatant state. The trigger is set, then turn advances immediately.
  - `server/src/handlers/gurps/movement.ts:24-99` — `handleMoveStep`. INSERT trigger check after line ~70 (position updated). Check `enemy_moves_adjacent` and `enemy_enters_reach`.
  - `server/src/handlers/gurps/attack.ts:344-773` — `handleAttackAction`. INSERT trigger check around line ~400 (before attack resolves). Check `enemy_attacks_me` and `enemy_attacks_ally`.
  - `server/src/handlers/gurps/close-combat.ts` — `handleExitCloseCombat` (~line 129+). Shows the pattern of interrupting flow to get opponent response via `pending_action` message type, then resuming. The wait interrupt follows a similar "pause-execute-resume" pattern but is synchronous (no player input needed).

  **API/Type References**:
  - `shared/rulesets/gurps/types.ts:124-136` — `WaitTrigger`, `WaitTriggerCondition`, `WaitTriggerAction` types. All 4 conditions and 3 actions already defined.
  - `shared/rulesets/gurps/types.ts:194-214` — `GurpsCombatantState` with `waitTrigger: WaitTrigger | null` field.
  - `shared/rulesets/gurps/rules.ts:713-745` — `advanceTurn` already clears `waitTrigger: null` at line 726.

  **Test References**:
  - `shared/rules.test.ts:360-449` — Turn advancement tests. Add wait trigger tests in a new describe block nearby.

  **External References**:
  - GURPS Basic Set B366: Wait maneuver — "specify a triggering event and an action; if the event occurs before your next turn, you act."

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test: `checkWaitTriggers` finds matching trigger for `enemy_moves_adjacent`
  - [ ] Test: `checkWaitTriggers` finds matching trigger for `enemy_attacks_me`
  - [ ] Test: `checkWaitTriggers` finds matching trigger for `enemy_attacks_ally`
  - [ ] Test: `checkWaitTriggers` finds matching trigger for `enemy_enters_reach`
  - [ ] Test: trigger does NOT fire on wrong condition
  - [ ] Test: trigger clears after firing
  - [ ] `npx vitest run -t "Wait Trigger"` → PASS

  **Automated Verification:**
  ```bash
  npx vitest run -t "Wait Trigger"
  npx vitest run
  # Assert: 442+ tests pass
  ```

  **Commit**: YES
  - Message: `feat(gurps): implement Wait trigger full interrupt system`
  - Files: `shared/rulesets/gurps/types.ts`, `shared/rulesets/gurps/rules.ts`, `server/src/handlers/gurps/wait-interrupt.ts` (new), `server/src/handlers/gurps/movement.ts`, `server/src/handlers/gurps/attack.ts`, `shared/rules.test.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 5. GURPS Mechanical Advantage Effects

  **What to do**:
  - Create a lookup-table approach: `getAdvantageEffect(advantageName, context)` in rules.ts that returns mechanical modifiers. This avoids changing the `Advantage` type (backward-compatible).
  - Implement 4 advantages:
    1. **Combat Reflexes** (+1 to all active defenses, +6 to recover from mental stun):
       - Hook into `calculateDefenseValue` (rules.ts:328-372) — check character's advantages, add +1 to base defense
       - Hook into `getDefenseOptions` (rules.ts:286-319) — include +1 in displayed values
    2. **High Pain Threshold** (no shock penalties, +3 HT rolls for stunning):
       - Hook into shock penalty application (damage.ts:93) — if HPT, set shockPenalty to 0
       - Hook into HT check (rules.ts:699-711) — add +3 to target number for stun checks
    3. **Hard to Kill** (+2 to HT rolls to stay alive):
       - Hook into `rollHTCheck` (rules.ts:699-711) — add +2 to target number for death checks
       - **Death checks in this simulator**: Currently `rollHTCheck` is called from `damage.ts:74` (major wound stun check) and `damage.ts:82` (unconsciousness check at HP 0). The simulator does NOT have explicit "death checks" at negative HP multiples (GURPS B327). For V1: apply Hard to Kill +2 to ALL HT checks (both stun and unconsciousness). This is a simplification — full death check system would be a separate feature.
       - Add `context?: 'stun' | 'unconsciousness' | 'death'` parameter to `rollHTCheck` for future extensibility, but for now Hard to Kill applies to all contexts.
    4. **Enhanced Parry** (+1 to parry with ALL weapons):
       - Hook into `calculateParry` (rules.ts:278-280) — add +1 when character has this advantage
       - **Weapon specificity decision**: In GURPS RAW, Enhanced Parry applies to a specific weapon skill. In this simulator, the `Advantage` type is `{ id, name, description }` with no structured fields. **Simplification**: Apply Enhanced Parry as +1 to ALL parry calculations regardless of weapon. The advantage description in templates (e.g., "Enhanced Parry (Sword)") is flavor text only. This avoids parsing free-text descriptions or changing the Advantage type.
  - Need a helper: `hasAdvantage(character, name)` that checks `character.advantages.some(a => a.name === name)`
  - Write tests for each advantage's mechanical effect

  **Must NOT do**:
  - Do not modify `Advantage` type structure (keep it as `{ id, name, description }`)
  - Do not implement advantages not in the 4-advantage list
  - Do not add advantage selection UI (templates already include them)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Touches multiple hook points across rules engine and damage handler
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 7)
  - **Blocks**: None
  - **Blocked By**: Task 1 (Armor/DR — need DR in pipeline for HPT shock interaction)

  **References**:

  **Pattern References**:
  - `shared/rulesets/gurps/rules.ts:328-372` — `calculateDefenseValue` with all modifiers. ADD Combat Reflexes +1 here.
  - `shared/rulesets/gurps/rules.ts:286-319` — `getDefenseOptions` calculates dodge/parry/block base values. ADD Combat Reflexes +1 to display values.
  - `shared/rulesets/gurps/rules.ts:278-280` — `calculateParry`. ADD Enhanced Parry +1 here.
  - `shared/rulesets/gurps/rules.ts:699-711` — `rollHTCheck`. ADD Hard to Kill +2 / HPT +3 based on context.
  - `server/src/handlers/shared/damage.ts:93` — `shockPenalty: Math.min(4, finalDamage)`. ADD HPT check: if HPT, set to 0.

  **API/Type References**:
  - `shared/rulesets/gurps/types.ts:33-37` — `Advantage` type (name-based lookup, no changes needed).
  - `shared/rulesets/gurps/characterSheet.ts:11` — `advantages: Advantage[]` on character.
  - `src/data/characterTemplates.ts:38-39` — Knight has `Combat Reflexes`, `High Pain Threshold`.
  - `src/data/characterTemplates.ts:59` — Swashbuckler has `Combat Reflexes`, `Enhanced Parry`.
  - `src/data/characterTemplates.ts:79` — Barbarian has `High Pain Threshold`, `Hard to Kill`.

  **Test References**:
  - `shared/rules.test.ts:847-1028` — Defense system tests. Add advantage tests in new describe block.
  - `shared/rules.test.ts:360-449` — Shock penalty / turn advancement tests. Add HPT tests nearby.

  **External References**:
  - GURPS Basic Set B41 (Combat Reflexes), B59 (High Pain Threshold), B58 (Hard to Kill), B51 (Enhanced Parry).

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test: Combat Reflexes adds +1 to dodge, parry, and block
  - [ ] Test: High Pain Threshold prevents shock penalty
  - [ ] Test: High Pain Threshold adds +3 to stun HT checks
  - [ ] Test: Hard to Kill adds +2 to death HT checks
  - [ ] Test: Enhanced Parry adds +1 to parry
  - [ ] Test: No advantage = no bonus (baseline)
  - [ ] `npx vitest run -t "Advantage"` → PASS

  **Automated Verification:**
  ```bash
  npx vitest run -t "Advantage"
  npx vitest run
  # Assert: 442+ tests pass
  ```

  **Commit**: YES
  - Message: `feat(gurps): add mechanical effects for 4 combat advantages`
  - Files: `shared/rulesets/gurps/rules.ts`, `server/src/handlers/shared/damage.ts`, `shared/rules.test.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 6. PF2 Advanced Combat Actions (Grapple, Trip, Disarm, Feint, Demoralize)

  **What to do**:
  - Implement 5 skill-based combat actions following PF2 rules:
    1. **Grapple** (Athletics vs Fortitude DC): On success, target gains `grabbed` condition. On crit success, `restrained`. On crit fail, attacker is `flat_footed`.
    2. **Trip** (Athletics vs Reflex DC): On success, target gains `prone` + `flat_footed`. On crit fail, attacker falls `prone`.
    3. **Disarm** (Athletics vs Reflex DC): On success, target gets -2 to attacks with that weapon. On crit success, target drops weapon. On crit fail, attacker drops own weapon.
    4. **Feint** (Deception vs Perception DC): On success, target is `flat_footed` to attacker's next attack. On crit success, `flat_footed` to all attacks until end of attacker's next turn.
    5. **Demoralize** (Intimidation vs Will DC): On success, target gains `frightened 1`. On crit success, `frightened 2`. Target becomes temporarily immune (3 rounds).
  - For each action:
    - Add handler function in new file `server/src/handlers/pf2/skill-actions.ts`
    - Add routing case in `server/src/handlers/pf2/router.ts`
    - Add action buttons in PF2 UI panels: Add new buttons to the existing action button grid in `src/components/rulesets/pf2/PF2GameActionPanel.tsx` and `src/components/rulesets/pf2/PF2ActionBar.tsx`. Follow the existing pattern used for Step/Stand/Drop Prone/Raise Shield buttons. These are simple `<button onClick={...}>` additions to existing JSX, not new components.
    - Roll uses `rollCheck` from PF2 rules.ts (d20 + modifier vs DC)
    - Apply MAP for actions with `attack` trait (Grapple, Trip, Disarm, Shove)
    - Deduct 1 action cost
  - Add new conditions to conditions.ts mechanical effects: `grabbed` (immobilized, flat_footed, -2 to attacks), `restrained` (immobilized, flat_footed, -2 attacks/defenses), `frightened` (penalty to all checks = value)
  - Write tests per action: success/failure/crit success/crit failure outcomes

  **Must NOT do**:
  - Do not implement Shove, Escape, Tumble Through (keep scope to 5 most impactful actions)
  - Do not implement weapon trait interactions (e.g., Trip trait on weapons)
  - No bot AI for these actions

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 5 actions each needing handler, router case, conditions, and tests. Significant scope but follows repeatable pattern.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential after Wave 2)
  - **Blocks**: None
  - **Blocked By**: Task 8 (Dying/Wounded — establishes condition framework patterns)

  **References**:

  **Pattern References**:
  - `server/src/handlers/pf2/actions.ts` — `handlePF2DropProne`, `handlePF2Stand`, `handlePF2RaiseShield`. Follow this pattern for new action handlers.
  - `server/src/handlers/pf2/router.ts:29-80` — PF2 action routing. Add new cases here.
  - `shared/rulesets/pf2/rules.ts:261-288` — `getActionCost` already returns 1 for grapple/trip/disarm/feint/demoralize.
  - `shared/rulesets/pf2/rules.ts:3-30` — `rollCheck(modifier, dc, random)` — USE THIS for all skill checks.

  **API/Type References**:
  - `shared/rulesets/pf2/types.ts:128-152` — `PF2ActionType` already includes all 5 action types.
  - `shared/rulesets/pf2/types.ts:44-76` — `PF2Condition` type. May need to add `grabbed`, `restrained`, `frightened` if not present.
  - `shared/rulesets/pf2/types.ts:161-177` — `PF2CombatantState` with `conditions: ConditionValue[]`.
  - `shared/rulesets/pf2/conditions.ts:1-63` — Condition mechanical effects. ADD effects for `grabbed`, `restrained`, `frightened`.

  **Test References**:
  - `shared/rulesets/pf2/rules.test.ts` — PF2 rules tests. Add skill action tests here.
  - `shared/rulesets/pf2/conditions.test.ts` — Condition tests. Add grabbed/restrained/frightened tests.
  - `shared/rulesets/pf2/map.test.ts` — MAP tests. Verify MAP applies to attack-trait skill actions.

  **External References**:
  - PF2 CRB: Grapple (p242), Trip (p243), Disarm (p243), Feint (p245), Demoralize (p247).

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test: Grapple success applies `grabbed` condition
  - [ ] Test: Trip success applies `prone` + `flat_footed`
  - [ ] Test: Disarm success applies -2 attack penalty
  - [ ] Test: Feint success applies `flat_footed` to attacker's next attack
  - [ ] Test: Demoralize success applies `frightened 1`
  - [ ] Test: MAP applies to Grapple/Trip/Disarm (attack trait) but NOT Feint/Demoralize
  - [ ] Test: Each action costs 1 action
  - [ ] `npx vitest run shared/rulesets/pf2/` → PASS

  **Automated Verification:**
  ```bash
  npx vitest run -t "grapple|trip|disarm|feint|demoralize"
  npx vitest run
  # Assert: 442+ tests pass
  ```

  **Commit**: YES
  - Message: `feat(pf2): add Grapple, Trip, Disarm, Feint, Demoralize skill actions`
  - Files: `server/src/handlers/pf2/skill-actions.ts` (new), `server/src/handlers/pf2/router.ts`, `shared/rulesets/pf2/types.ts`, `shared/rulesets/pf2/conditions.ts`, `shared/rulesets/pf2/rules.test.ts`, `shared/rulesets/pf2/conditions.test.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 7. PF2 Spell Effects Pipeline

  **What to do**:
  - Create `SpellDefinition` type in `shared/rulesets/pf2/types.ts` with: name, level, tradition, castActions, targetType (self/single/area), save (fortitude/reflex/will/none), damage (formula), damageType, healFormula, conditions (to apply), duration
  - Create spell data: define 6-8 representative spells inline in a new file `shared/rulesets/pf2/spellData.ts`:
    - **Damage**: Electric Arc (reflex save, 1d4+mod), Magic Missile (auto-hit, 1d4+1), Fireball (reflex save, 6d6)
    - **Healing**: Heal (1d8 per level), Soothe (1d10+4)
    - **Buff/Debuff**: Fear (will save → frightened), Bless (+1 status bonus to attacks)
  - Modify `handlePF2CastSpell` (spell.ts) to:
    1. Look up SpellDefinition by spell name
    2. If damage spell: resolve save (using `rollCheck`), apply degree-of-success damage
    3. If healing spell: increase target HP (capped at max)
    4. If condition spell: resolve save, apply condition on failure
    5. Log detailed results
  - Write tests per spell category: damage dealt on failed save, half damage on success, no damage on crit success, healing increases HP, condition applied on failure

  **Must NOT do**:
  - Do not implement more than 8 spells (this is a pipeline, not content expansion)
  - Do not implement spell heightening or metamagic
  - Do not implement area targeting (use single-target for now, even for "area" spells like Fireball — apply to selected target)
  - No bot AI for spell selection

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: New data structure, handler modification, save resolution — medium complexity
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: None
  - **Blocked By**: Task 8 (Dying/Wounded — healing spells interact with dying state)

  **References**:

  **Pattern References**:
  - `server/src/handlers/pf2/spell.ts:24-126` — Current `handlePF2CastSpell`. MODIFY this to resolve effects after slot deduction.
  - `server/src/handlers/pf2/attack.ts:161-186` — PF2 damage application pattern (HP subtraction, unconscious check). Follow this for spell damage.
  - `shared/rulesets/pf2/rules.ts:3-30` — `rollCheck(modifier, dc, random)` — USE for save DCs.
  - `shared/rulesets/pf2/rules.ts:45-75` — Degree of success determination (crit success/success/failure/crit failure).

  **API/Type References**:
  - `shared/rulesets/pf2/types.ts:221-235` — `SpellCaster`, `SpellSlot`, `FocusPool` — existing spell infrastructure.
  - `shared/rulesets/pf2/types.ts:161-177` — `PF2CombatantState` with `currentHP`, `maxHP`, `conditions`.
  - `shared/rulesets/pf2/conditions.ts` — Add spell-applied conditions here.

  **Test References**:
  - `shared/rulesets/pf2/spells.test.ts` — Existing spell tests (casting infrastructure). Add effect tests here.

  **External References**:
  - PF2 CRB: Spells chapter — degree-of-success damage rules (full/half/double/none).

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test: Damage spell deals full damage on failed save
  - [ ] Test: Damage spell deals half damage on successful save
  - [ ] Test: Damage spell deals no damage on critical success save
  - [ ] Test: Damage spell deals double damage on critical failure save
  - [ ] Test: Healing spell increases HP (capped at maxHP)
  - [ ] Test: Condition spell applies condition on failed save
  - [ ] Test: Condition spell does not apply on successful save
  - [ ] `npx vitest run shared/rulesets/pf2/spells.test.ts` → PASS

  **Automated Verification:**
  ```bash
  npx vitest run -t "spell effect"
  npx vitest run
  # Assert: 442+ tests pass
  ```

  **Commit**: YES
  - Message: `feat(pf2): implement spell effect pipeline with damage, healing, and conditions`
  - Files: `shared/rulesets/pf2/types.ts`, `shared/rulesets/pf2/spellData.ts` (new), `server/src/handlers/pf2/spell.ts`, `shared/rulesets/pf2/spells.test.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 8. PF2 Dying/Wounded/Recovery System

  **What to do**:
  - The `dying`, `wounded`, and `doomed` fields already exist on `PF2CombatantState` (types.ts:172-174) but are never modified. Implement the full state machine:
  - **When HP reaches 0** (in `pf2/attack.ts:161-186` and anywhere PF2 damage is applied):
    1. Set `dying: 1 + wounded` (wounded increases initial dying value)
    2. Add `unconscious` condition
    3. If `dying >= (4 - doomed)`: combatant dies → set `statusEffects: ['dead']`
  - **Recovery Check** (at start of dying combatant's turn):
    1. Flat check: DC = 10 + dying value
    2. Critical success: dying reduced by 2 (if dying reaches 0, gain `wounded += 1`, remove unconscious)
    3. Success: dying reduced by 1
    4. Failure: dying increased by 1
    5. Critical failure: dying increased by 2
    6. Check death threshold after each change
  - **When healed while dying**: reduce dying to 0, gain wounded += 1, regain consciousness
  - Add recovery check to PF2 `advanceTurn` (rules.ts) — when the active combatant is dying, auto-roll recovery before their turn
  - Add `dying`, `wounded`, `doomed` condition display (existing UI should handle via condition system)
  - Write tests for full state machine

  **Must NOT do**:
  - Do not implement Hero Points (simplified recovery)
  - Do not implement Doomed condition application (only the death threshold check)
  - Do not modify GURPS damage flow

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: State machine with multiple transitions, interacts with damage and turn advancement
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Tasks 6, 7 (PF2 Actions and Spells depend on condition framework)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `server/src/handlers/pf2/attack.ts:161-186` — Current HP 0 handling (just adds 'unconscious'). REPLACE with dying/wounded logic.
  - `shared/rulesets/pf2/rules.ts` — PF2 `advanceTurn` (search for `export const advanceTurn` — exact line may vary, explore agent reported ~line 352+). ADD recovery check at start of dying combatant's turn.
  - `shared/rulesets/pf2/rules.ts:3-30` — `rollCheck` — USE for recovery flat check (modifier=0, dc=10+dying).

  **API/Type References**:
  - `shared/rulesets/pf2/types.ts:172-174` — `dying: number`, `wounded: number`, `doomed: number` fields ALREADY EXIST on PF2CombatantState.
  - `shared/rulesets/pf2/types.ts:161-177` — Full PF2CombatantState with conditions, statusEffects.
  - `shared/rulesets/pf2/conditions.ts` — Condition effects system. May need `dying` and `wounded` as displayable conditions.

  **Test References**:
  - `shared/rulesets/pf2/rules.test.ts` — PF2 rules tests. Add dying/wounded tests.
  - `shared/rulesets/pf2/conditions.test.ts` — Condition tests.

  **External References**:
  - PF2 CRB p459: Dying and Recovery rules, Wounded condition, Doomed condition.

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test: HP reaching 0 sets dying = 1 + wounded
  - [ ] Test: dying >= (4 - doomed) = death
  - [ ] Test: Recovery check crit success reduces dying by 2
  - [ ] Test: Recovery check success reduces dying by 1
  - [ ] Test: Recovery check failure increases dying by 1
  - [ ] Test: Recovery check crit failure increases dying by 2
  - [ ] Test: Dying reaching 0 adds wounded += 1 and removes unconscious
  - [ ] Test: Healing while dying resets dying to 0 and adds wounded
  - [ ] `npx vitest run -t "dying|wounded|recovery"` → PASS

  **Automated Verification:**
  ```bash
  npx vitest run -t "dying|wounded|recovery"
  npx vitest run
  # Assert: 442+ tests pass
  ```

  **Commit**: YES
  - Message: `feat(pf2): implement dying/wounded/recovery state machine`
  - Files: `shared/rulesets/pf2/types.ts`, `shared/rulesets/pf2/rules.ts`, `shared/rulesets/pf2/conditions.ts`, `server/src/handlers/pf2/attack.ts`, `shared/rulesets/pf2/rules.test.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 9. Fix Hardcoded GURPS Fallback in serverAdapter.ts

  **What to do**:
  - In `serverAdapter.ts:932` (`getServerAdapter`): replace `console.warn` + GURPS fallback with `throw new Error('Unknown ruleset: ${rulesetId}')`
  - In `serverAdapter.ts:939` (`isGurpsMatch`): remove `|| !match.rulesetId` fallback — if rulesetId is missing, it should NOT default to GURPS
  - These changes enforce the "No Hardcoded Defaults" principle from AGENTS.md
  - Write test: unknown rulesetId throws error

  **Must NOT do**:
  - Do not change any other adapter logic
  - Do not add new rulesets

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 2-line change + 1 test
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (or any wave — fully independent)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `shared/rulesets/serverAdapter.ts:932` — `getServerAdapter` with console.warn fallback.
  - `shared/rulesets/serverAdapter.ts:939` — `isGurpsMatch` with `|| !match.rulesetId`.
  - `shared/rulesets/defaults.ts` — `assertRulesetId(id)` — existing assertion pattern to follow.

  **Test References**:
  - `shared/rulesets/serverAdapter.test.ts` — Existing adapter tests. Add error test here.
  - `shared/rulesets/defaults.test.ts` — Default assertion tests. Similar pattern.

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test: `getServerAdapter('unknown')` throws Error
  - [ ] Test: `isGurpsMatch({ rulesetId: undefined })` returns false (not true)
  - [ ] `npx vitest run shared/rulesets/serverAdapter.test.ts` → PASS

  **Automated Verification:**
  ```bash
  npx vitest run -t "Unknown ruleset"
  npx vitest run
  # Assert: 442+ tests pass
  ```

  **Commit**: YES
  - Message: `fix: remove hardcoded GURPS fallback in serverAdapter`
  - Files: `shared/rulesets/serverAdapter.ts`, `shared/rulesets/serverAdapter.test.ts`
  - Pre-commit: `npx vitest run`

---

## Commit Strategy

| After Task | Message | Key Files | Verification |
|------------|---------|-----------|--------------|
| 1 | `feat(gurps): add per-location armor DR system` | types, rules, damage.ts, templates | `npx vitest run` |
| 2 | `feat(gurps): add Concentrate maneuver` | types, ui, rules, router | `npx vitest run` |
| 3 | `feat(gurps): implement AOA Feint variant` | rules, types, adapter, attack, UI | `npx vitest run` |
| 4 | `feat(gurps): implement Wait trigger full interrupt` | rules, movement, attack | `npx vitest run` |
| 5 | `feat(gurps): add mechanical advantage effects` | rules, damage.ts | `npx vitest run` |
| 6 | `feat(pf2): add skill actions (Grapple/Trip/Disarm/Feint/Demoralize)` | new handler, router, types, conditions | `npx vitest run` |
| 7 | `feat(pf2): implement spell effect pipeline` | types, spellData, spell handler | `npx vitest run` |
| 8 | `feat(pf2): implement dying/wounded/recovery` | types, rules, conditions, attack | `npx vitest run` |
| 9 | `fix: remove hardcoded GURPS fallback` | serverAdapter | `npx vitest run` |

---

## Success Criteria

### Verification Commands
```bash
npx vitest run                    # ALL tests pass (442 baseline + new)
npm run build                     # Client builds
npm run build --prefix server     # Server builds
npx vitest run -t "Armor DR"     # Task 1
npx vitest run -t "Concentrate"  # Task 2
npx vitest run -t "Feint"        # Task 3
npx vitest run -t "Wait Trigger" # Task 4
npx vitest run -t "Advantage"    # Task 5
npx vitest run -t "grapple|trip|disarm|feint|demoralize" # Task 6
npx vitest run -t "spell effect" # Task 7
npx vitest run -t "dying|wounded|recovery" # Task 8
npx vitest run -t "Unknown ruleset" # Task 9
```

### Final Checklist
- [ ] All 8 features implemented with server logic + rules engine + tests
- [ ] All "Must Have" items present
- [ ] All "Must NOT Have" guardrails respected
- [ ] Zero regressions on 442 baseline tests
- [ ] Both client and server build cleanly
- [ ] No `any` types introduced
- [ ] Adapter pattern used throughout (no hardcoded ruleset checks)
