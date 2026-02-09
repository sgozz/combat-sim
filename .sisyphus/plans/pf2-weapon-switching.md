# PF2 Weapon Switching System (Interact Action)

## TL;DR

> **Quick Summary**: Add weapon switching to PF2 combat via the "Interact" action (1 action cost). Players can draw, sheathe, and swap weapons during combat. Mirrors the existing GURPS Ready system but adapted for PF2's 3-action economy.
> 
> **Deliverables**:
> - Server handler for PF2 Interact action (draw/sheathe/swap)
> - PF2ReadyPanel UI component (mobile + desktop)
> - Attack handler updated to use equipped weapon
> - Bot AI weapon preference
> - TDD test coverage
> 
> **Estimated Effort**: Medium (3-4 hours)
> **Parallel Execution**: YES — 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 5

---

## Context

### Original Request
Complete the deferred PF2 weapon switching feature from combat-sim-fixes.md Task 7. Type definitions were added but server handler, UI, and attack integration remain.

### Prior Work (Already Done)
- `EquippedItem[]` type added to `PF2CombatantState` (shared/rulesets/pf2/types.ts:179)
- Auto-equip first weapon on combatant init (shared/rulesets/pf2/index.ts)
- EquippedItem type imported from GURPS types (shared/rulesets/pf2/types.ts:3)

### Research Findings
- **GURPS Pattern**: Full reference exists — `ReadyPanel.tsx` (145 lines, shows hands/items/draw/sheathe) + `ready.ts` handler (141 lines, draw/sheathe/reload/prepare/pickup)
- **PF2 Difference**: PF2 uses "Interact" (1 action, no maneuver lock) vs GURPS "Ready" (full-turn maneuver). PF2 players can draw and attack in same turn.
- **Attack Handler**: `attack.ts:36-55` `getWeaponInfo()` hardcodes `character.weapons[0]` — must use equipped weapon
- **Router**: `server/src/handlers/pf2/router.ts` needs new case for `pf2_interact`
- **UI Slots**: PF2ActionBar and PF2GameActionPanel both need Interact button + ReadyPanel

---

## Work Objectives

### Core Objective
Enable PF2 combatants to switch weapons during combat using the Interact action (1 action), with UI for weapon management and attack integration.

### Concrete Deliverables
- `server/src/handlers/pf2/interact.ts` — Interact action handler
- `server/src/handlers/pf2/interact.test.ts` — TDD tests
- `src/components/rulesets/pf2/PF2ReadyPanel.tsx` — Weapon management UI
- Modified `server/src/handlers/pf2/attack.ts` — Use equipped weapon
- Modified `server/src/handlers/pf2/router.ts` — Route pf2_interact
- Modified `src/components/rulesets/pf2/PF2ActionBar.tsx` — Interact button + panel
- Modified `src/components/rulesets/pf2/PF2GameActionPanel.tsx` — Desktop version

### Definition of Done
- [x] Interact action draws/sheathes weapons (1 action cost)
- [x] Attack uses equipped weapon (not hardcoded weapons[0])
- [x] UI shows weapon management panel
- [x] `npx vitest run` — all tests pass
- [x] `npm run build` — succeeds

### Must Have
- Draw weapon from inventory to hand (1 action)
- Sheathe weapon from hand to inventory (1 action)
- Attack uses the weapon in dominant hand
- Unarmed fallback when no weapon equipped
- Both mobile and desktop UI

### Must NOT Have (Guardrails)
- Do NOT modify GURPS ready logic or ReadyPanel
- Do NOT add two-weapon fighting rules (out of scope)
- Do NOT add weapon proficiency checks (all weapons usable for now)
- Do NOT add Quick Draw feat implementation (separate feature)
- Do NOT change EquippedItem type (already correct from GURPS)
- Do NOT add item drop/pickup from ground
- Do NOT add weapon runes or magic weapon properties

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**

### Test Decision
- **Infrastructure exists**: YES (Vitest with happy-dom)
- **Automated tests**: TDD (RED-GREEN-REFACTOR)
- **Framework**: Vitest

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — Server + Types):
├── Task 1: Interact handler + tests (server)
└── Task 2: PF2ReadyPanel UI component

Wave 2 (After Wave 1 — Integration):
├── Task 3: Attack handler — use equipped weapon
├── Task 4: ActionBar integration (mobile + desktop)
└── Task 5: Bot weapon preference + final tests
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3, 4, 5 | 2 |
| 2 | None | 4 | 1 |
| 3 | 1 | 5 | 4 |
| 4 | 1, 2 | 5 | 3 |
| 5 | 3, 4 | None | None (final) |

---

## TODOs

- [x] 1. PF2 Interact Action Handler (Server)

  **What to do**:
  - **RED**: Write `server/src/handlers/pf2/interact.test.ts`:
    - Test: draw weapon moves it to right_hand with ready=true, costs 1 action
    - Test: sheathe weapon moves to belt with ready=false, costs 1 action
    - Test: draw when hands full → error
    - Test: draw when 0 actions remaining → error
    - Test: sheathe item not in hand → error
  - **GREEN**: Create `server/src/handlers/pf2/interact.ts`:
    - Accept payload: `{ type: 'pf2_interact', action: 'draw' | 'sheathe', itemId: string, targetSlot?: EquipmentSlot }`
    - Validate: combatant has actions remaining (≥1)
    - Validate: item exists in character's weapons array
    - For draw: check target slot is free, add to equipped array
    - For sheathe: check item is in hand, move to storage
    - Deduct 1 action from actionsRemaining
    - Update combatant equipped array in match state
    - Log action
    - If 0 actions remaining after, advance turn
  - Update `server/src/handlers/pf2/router.ts`: add case `'pf2_interact'`
  - Update `shared/rulesets/pf2/types.ts`: add `pf2_interact` to PF2ActionPayload union

  **Must NOT do**:
  - Do NOT copy GURPS maneuver-gating logic (PF2 has no maneuver prerequisite)
  - Do NOT advance turn automatically unless 0 actions remain

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 4, 5
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `server/src/handlers/gurps/ready.ts:23-140` — Full GURPS handler: draw/sheathe/reload/prepare logic. Follow same switch/case pattern but simplified for PF2 (no maneuver check, 1-action cost instead of full turn).
  - `server/src/handlers/pf2/stride.ts:1-50` — PF2 handler pattern: how to validate actions, deduct actions, and update state.

  **API/Type References**:
  - `shared/rulesets/gurps/types.ts:106-113` — `EquippedItem` type: `{ equipmentId: string; slot: EquipmentSlot; ready: boolean }`
  - `shared/rulesets/gurps/types.ts:115-117` — `EquipmentSlot` type: `'right_hand' | 'left_hand' | 'belt' | 'back' | 'quiver'`
  - `shared/rulesets/pf2/types.ts:179` — PF2CombatantState already has `equipped: EquippedItem[]`
  - `shared/rulesets/pf2/types.ts:200-210` — PF2ActionPayload union: add new type here

  **Test References**:
  - `server/src/handlers/pf2/stride.test.ts` — PF2 handler test patterns (mock setup, createPF2Combatant helper)
  - `server/src/handlers/pf2/actions.test.ts` — Action cost validation test patterns

  **Acceptance Criteria**:
  - [x] `server/src/handlers/pf2/interact.ts` exists and handles draw/sheathe
  - [x] Draw weapon: moves to hand slot, costs 1 action
  - [x] Sheathe weapon: moves from hand to storage, costs 1 action
  - [x] Error when hands full
  - [x] Error when 0 actions
  - [x] Router handles `pf2_interact` action type
  - [x] `npx vitest run server/src/handlers/pf2/interact` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Draw weapon costs 1 action
    Tool: Bash
    Steps:
      1. Run: npx vitest run server/src/handlers/pf2/interact -t "draw"
      2. Assert: All draw tests pass
    Expected Result: Drawing weapon deducts 1 action and equips to hand
    Evidence: Test output captured

  Scenario: Error on hands full
    Tool: Bash
    Steps:
      1. Run: npx vitest run server/src/handlers/pf2/interact -t "hands full"
      2. Assert: Error test passes
    Expected Result: Cannot draw when both hands occupied
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `feat(pf2): add Interact action handler for weapon draw/sheathe`
  - Files: `server/src/handlers/pf2/interact.ts`, `server/src/handlers/pf2/interact.test.ts`, `server/src/handlers/pf2/router.ts`, `shared/rulesets/pf2/types.ts`
  - Pre-commit: `npx vitest run server/src/handlers/pf2/`

---

- [x] 2. PF2ReadyPanel UI Component

  **What to do**:
  - Create `src/components/rulesets/pf2/PF2ReadyPanel.tsx`:
    - Show current hand status (right hand / left hand contents)
    - List all character weapons with equipped state
    - Draw button (when item not in hand and slot available)
    - Sheathe button (when item in hand)
    - Disable all actions when not player's turn or 0 actions
    - Emit `onInteract(action: 'draw' | 'sheathe', itemId: string, targetSlot?: EquipmentSlot)` callback
  - Write component tests `src/components/rulesets/pf2/PF2ReadyPanel.test.tsx`:
    - Renders hand status
    - Shows draw/sheathe buttons appropriately
    - Disables when no actions
    - Calls onInteract with correct params
  - Style consistent with existing PF2 action bar (reuse `.ready-panel` CSS from GURPS or create `.pf2-ready-panel` if different)

  **Must NOT do**:
  - Do NOT duplicate GURPS CSS classes — use PF2-namespaced classes
  - Do NOT add reload functionality (PF2 doesn't have GURPS reload mechanic)
  - Do NOT modify GURPS ReadyPanel

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: UI component design matching existing PF2 ActionBar style

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/rulesets/gurps/ReadyPanel.tsx:1-147` — Full GURPS UI reference: hand indicators, item list, draw/sheathe/reload buttons. PF2 version is simpler (no reload, no prepare vs draw distinction).
  - `src/components/rulesets/pf2/SpellPicker.tsx:1-179` — PF2 panel component pattern: overlay style, close button, action-bar integration.

  **API/Type References**:
  - `shared/rulesets/gurps/types.ts:106-117` — EquippedItem and EquipmentSlot types
  - `shared/rulesets/pf2/characterSheet.ts:58-70` — PF2CharacterWeapon type (weapons array)

  **Acceptance Criteria**:
  - [x] `src/components/rulesets/pf2/PF2ReadyPanel.tsx` exists
  - [x] Shows hand status (what's equipped in each hand)
  - [x] Draw/sheathe buttons work correctly
  - [x] Disabled when not player's turn
  - [x] Test file passes: `npx vitest run src/components/rulesets/pf2/PF2ReadyPanel`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: PF2ReadyPanel renders weapon list
    Tool: Bash
    Steps:
      1. Run: npx vitest run src/components/rulesets/pf2/PF2ReadyPanel
      2. Assert: All tests pass
    Expected Result: Component renders and interaction works
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `feat(pf2): add PF2ReadyPanel weapon management UI component`
  - Files: `src/components/rulesets/pf2/PF2ReadyPanel.tsx`, `src/components/rulesets/pf2/PF2ReadyPanel.test.tsx`
  - Pre-commit: `npx vitest run src/components/rulesets/pf2/`

---

- [x] 3. Attack Handler — Use Equipped Weapon

  **What to do**:
  - **RED**: Write test in `server/src/handlers/pf2/attack.test.ts`:
    - Test: attack with longsword equipped in right_hand → uses longsword stats
    - Test: attack with no weapon equipped → uses Fist (unarmed) stats
    - Test: attack with ranged weapon equipped → uses ranged stats with range check
  - **GREEN**: Modify `server/src/handlers/pf2/attack.ts`:
    - Change `getWeaponInfo()` function (lines 36-55) to check `combatant.equipped` first:
      ```typescript
      const getWeaponInfo = (character: PF2CharacterSheet, combatant: PF2CombatantState) => {
        const equippedWeapon = combatant.equipped?.find(e => e.ready && (e.slot === 'right_hand' || e.slot === 'left_hand'));
        if (equippedWeapon) {
          const weapon = character.weapons.find(w => w.id === equippedWeapon.equipmentId);
          if (weapon) return { name: weapon.name, damage: weapon.damage, ... };
        }
        // Fallback to unarmed
        return { name: 'Fist', damage: '1d4', damageType: 'bludgeoning', traits: ['agile', 'finesse', 'unarmed'] };
      };
      ```
    - Update the call site to pass combatant: `getWeaponInfo(attackerCharacter, actorCombatant)`
  - Also update `reaction.ts:58-62` `executeAoOStrike` which hardcodes `reactorChar.weapons[0]` — should use equipped weapon

  **Must NOT do**:
  - Do NOT change damage calculation formulas
  - Do NOT add weapon proficiency modifiers
  - Do NOT change how traits affect MAP/finesse (already correct)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `server/src/handlers/pf2/attack.ts:36-55` — Current `getWeaponInfo()`: hardcodes `character.weapons[0]`. Change to check equipped first.
  - `server/src/handlers/pf2/reaction.ts:58-62` — AoO also hardcodes `reactorChar.weapons[0]`. Same fix needed.

  **API/Type References**:
  - `shared/rulesets/pf2/characterSheet.ts:58-70` — `PF2CharacterWeapon` with `id`, `name`, `damage`, `damageType`, `traits`
  - `shared/rulesets/pf2/types.ts:179` — `equipped: EquippedItem[]` on combatant

  **Test References**:
  - `server/src/handlers/pf2/attack.test.ts` — Existing attack tests (36 tests, must not regress)

  **Acceptance Criteria**:
  - [x] Attack uses equipped weapon stats
  - [x] No weapon equipped → unarmed fallback
  - [x] AoO strike uses reactor's equipped weapon
  - [x] All existing attack tests still pass
  - [x] `npx vitest run server/src/handlers/pf2/attack` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Attack uses equipped weapon
    Tool: Bash
    Steps:
      1. Run: npx vitest run server/src/handlers/pf2/attack
      2. Assert: All tests pass including new equipped weapon tests
    Expected Result: Attack handler respects equipped state
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `fix(pf2): attack handler uses equipped weapon instead of hardcoded weapons[0]`
  - Files: `server/src/handlers/pf2/attack.ts`, `server/src/handlers/pf2/reaction.ts`, `server/src/handlers/pf2/attack.test.ts`
  - Pre-commit: `npx vitest run server/src/handlers/pf2/`

---

- [x] 4. ActionBar Integration (Mobile + Desktop)

  **What to do**:
  - Add "Interact" button to `src/components/rulesets/pf2/PF2ActionBar.tsx`:
    - Button shows ⚔️ icon with "Interact" label
    - Enabled when player has ≥1 action and it's their turn
    - Clicking opens PF2ReadyPanel overlay
    - When user draws/sheathes, dispatches `onAction('pf2_interact', { type: 'pf2_interact', action, itemId, targetSlot })`
    - State: `showReadyPanel` boolean (like existing `showSpellPicker`)
  - Add same to `src/components/rulesets/pf2/PF2GameActionPanel.tsx` (desktop version):
    - Same logic but rendered in the right panel layout
  - Add backdrop click handler to close panel

  **Must NOT do**:
  - Do NOT modify the mobile/desktop responsive breakpoint logic
  - Do NOT change action bar layout for other buttons
  - Do NOT add keyboard shortcuts (out of scope)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: UI integration matching existing ActionBar patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `src/components/rulesets/pf2/PF2ActionBar.tsx:115-129` — SpellPicker integration pattern (showSpellPicker state, backdrop, overlay). Follow exact same pattern for ReadyPanel.
  - `src/components/rulesets/pf2/PF2ActionBar.tsx:340-360` — Action button patterns (Strike, Stride, Step, Cast Spell, End Turn). Add Interact button in this row.
  - `src/components/rulesets/pf2/PF2GameActionPanel.tsx:290-330` — Desktop action layout. Add Interact button here too.

  **Acceptance Criteria**:
  - [x] Interact button visible in mobile ActionBar
  - [x] Interact button visible in desktop GameActionPanel
  - [x] Clicking opens PF2ReadyPanel
  - [x] Draw/sheathe dispatches correct action
  - [x] Panel closes after action or backdrop click
  - [x] `npm run build` → succeeds

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Interact button opens weapon panel
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running, active PF2 match, player's turn
    Steps:
      1. Navigate to active PF2 match
      2. Assert: Interact button visible in action bar
      3. Click Interact button
      4. Assert: PF2ReadyPanel overlay appears
      5. Assert: Character's weapons are listed
      6. Screenshot: .sisyphus/evidence/task-4-interact-panel.png
    Expected Result: Weapon management panel opens
    Evidence: .sisyphus/evidence/task-4-interact-panel.png

  Scenario: Draw weapon from panel
    Tool: Playwright (playwright skill)
    Preconditions: PF2ReadyPanel open, weapon not in hand
    Steps:
      1. Click "Draw (R)" next to a sheathed weapon
      2. Assert: Panel closes
      3. Assert: Action count decremented by 1
      4. Screenshot: .sisyphus/evidence/task-4-draw-weapon.png
    Expected Result: Weapon drawn and action consumed
    Evidence: .sisyphus/evidence/task-4-draw-weapon.png
  ```

  **Commit**: YES
  - Message: `feat(pf2): integrate Interact button and weapon panel into ActionBar`
  - Files: `src/components/rulesets/pf2/PF2ActionBar.tsx`, `src/components/rulesets/pf2/PF2GameActionPanel.tsx`
  - Pre-commit: `npm run build`

---

- [x] 5. Bot Weapon Preference + Final Integration

  **What to do**:
  - Update `server/src/rulesets/pf2/bot.ts`:
    - When bot has ranged weapon and target is at distance, draw ranged if not equipped
    - When bot is in melee and has melee weapon stowed, draw melee
    - Bot should spend 1 action on Interact (draw) if needed before attacking
  - Run full test suite and verify no regressions
  - Verify end-to-end flow: player draws weapon → attacks with it → bot responds appropriately

  **Must NOT do**:
  - Do NOT make bot weapon switching overly smart (simple preference only)
  - Do NOT add weapon switching to GURPS bots

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: [`playwright`]
    - `playwright`: End-to-end verification

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (final task)
  - **Blocks**: None
  - **Blocked By**: Tasks 3, 4

  **References**:

  **Pattern References**:
  - `server/src/rulesets/pf2/bot.ts` — Bot decision logic: add weapon switching before attack
  - `server/src/rulesets/pf2/bot.test.ts` — Bot test patterns (18 existing tests)

  **Acceptance Criteria**:
  - [x] Bot draws appropriate weapon before attacking
  - [x] `npx vitest run` → ALL tests pass (0 failures)
  - [x] `npm run build` → succeeds
  - [x] `npm run lint` → no errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Full weapon switching flow
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running, PF2 character with 2 weapons
    Steps:
      1. Create match with bot
      2. Start combat
      3. Click Interact → Draw ranged weapon
      4. Assert: Actions reduced by 1
      5. Click Strike on distant target
      6. Assert: Uses ranged weapon name in combat log
      7. Screenshot: .sisyphus/evidence/task-5-weapon-switch.png
    Expected Result: Full weapon switching flow works
    Evidence: .sisyphus/evidence/task-5-weapon-switch.png

  Scenario: All tests pass
    Tool: Bash
    Steps:
      1. Run: npx vitest run
      2. Assert: Exit code 0, 0 failures
    Expected Result: Zero regressions
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `feat(pf2): bot weapon preference and final weapon switching integration`
  - Files: `server/src/rulesets/pf2/bot.ts`, `server/src/rulesets/pf2/bot.test.ts`
  - Pre-commit: `npx vitest run`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(pf2): add Interact action handler for weapon draw/sheathe` | server handler + test + router | `npx vitest run server/src/handlers/pf2/` |
| 2 | `feat(pf2): add PF2ReadyPanel weapon management UI` | component + test | `npx vitest run src/components/rulesets/pf2/` |
| 3 | `fix(pf2): attack handler uses equipped weapon` | attack.ts + reaction.ts + tests | `npx vitest run server/src/handlers/pf2/` |
| 4 | `feat(pf2): integrate Interact button into ActionBar` | ActionBar + GameActionPanel | `npm run build` |
| 5 | `feat(pf2): bot weapon preference + integration` | bot.ts + bot.test.ts | `npx vitest run` |

---

## Success Criteria

### Verification Commands
```bash
npx vitest run                    # Expected: all tests pass
npm run lint                      # Expected: no errors
npm run build                     # Expected: compiles without errors
```

### Final Checklist
- [x] Interact action draws/sheathes weapon (1 action cost)
- [x] Attack uses equipped weapon stats
- [x] Unarmed fallback when no weapon in hand
- [x] UI panel shows in both mobile and desktop
- [x] Bot draws weapon before attacking
- [x] All existing tests still pass (no regressions)
