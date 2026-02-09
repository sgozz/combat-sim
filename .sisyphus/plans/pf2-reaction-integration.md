# PF2 Reaction Integration — Shield Block, Reactive Shield & UI

## TL;DR

> **Quick Summary**: Wire existing server-side reaction handlers (Shield Block, Reactive Shield) into the PF2 attack flow and add a client-side Reaction Prompt modal. Server framework is ~90% done — this plan focuses on integration and UI.
> 
> **Deliverables**:
> - Shield Block integrated into attack damage flow (auto-reduce damage)
> - Reactive Shield integrated into attack flow (raise shield before hit resolution)
> - PF2ReactionModal client component for human player reaction prompts
> - Bot AI auto-reaction (Shield Block when beneficial, AoO acceptance)
> - PF2 registered in rulesetUiSlots for reaction modal
> 
> **Estimated Effort**: Medium (3-4 hours)
> **Parallel Execution**: YES — 2 waves
> **Critical Path**: Task 1 → Task 3 → Task 4

---

## Context

### Original Request
Complete the deferred PF2 feat effects feature from combat-sim-fixes.md Task 8. A reaction framework was needed — and upon investigation, it already substantially exists.

### Prior Work (Already Done — Extensive!)
**Server-side reaction framework (reaction.ts, 390 lines)**:
- `getAoOReactors()` — finds combatants who can make AoO (checks feat, distance, reactionAvailable)
- `executeAoOStrike()` — resolves AoO attack roll, damage, consumes reaction
- `handlePF2ReactionChoice()` — processes player's choice (aoo/decline), resumes stride
- `handleShieldBlockReaction()` — reduces damage by shield hardness, damages shield, consumes reaction
- `handleReactiveShieldReaction()` — raises shield as reaction when hit, consumes reaction
- `resumeStrideAfterReaction()` — completes interrupted stride after reaction resolved

**State and types**:
- `PendingReaction` type in shared/types.ts (reactorId, triggerId, triggerAction, originalPayload)
- `MatchState.pendingReaction` optional field
- `reactionAvailable: boolean` on PF2CombatantState
- `pf2_reaction_choice` in router.ts (already routed)
- `shieldRaised: boolean` and `shieldHP: number` on PF2CombatantState

**AoO integration (working)**:
- stride.ts:185 sets pendingReaction when AoO reactors exist
- Player stride pauses, waiting for reactor's choice
- After choice, stride resumes or is interrupted

**Feat framework (feats.ts)**:
- FEAT_EFFECTS registry with 11 feats
- hasFeat() and getFeatEffect() helpers
- Feats: AoO, Shield Block, Reactive Shield, Nimble Dodge, Power Attack, Sudden Charge, etc.

**Tests (reactions.test.ts)**:
- 72+ test references for reactions
- Tests for AoO, Shield Block, Reactive Shield

### What's Missing
1. **Client UI**: Zero reaction prompt UI exists. When `pendingReaction` is set on match state, the client doesn't show anything to the reactor player.
2. **Shield Block NOT called from attack.ts**: The handler exists but `attack.ts` never invokes it. Damage is applied directly without checking Shield Block.
3. **Reactive Shield NOT called from attack.ts**: Same — handler exists, attack.ts doesn't use it.
4. **Bot reactions**: No code for bots to auto-respond to pendingReaction. If a bot is the reactor, the game hangs.
5. **rulesetUiSlots**: PF2 has `DefenseModal: null`. Needs a reaction modal registered.

---

## Work Objectives

### Core Objective
Wire existing reaction handlers into the attack flow and add client UI so players and bots can use Shield Block, Reactive Shield, and AoO effectively.

### Concrete Deliverables
- Modified `server/src/handlers/pf2/attack.ts` — calls Shield Block and Reactive Shield
- `src/components/rulesets/pf2/PF2ReactionModal.tsx` — reaction prompt UI
- Modified `src/components/game/shared/rulesetUiSlots.ts` — register PF2 reaction modal
- Modified `src/components/game/GameScreen.tsx` — render reaction modal for PF2
- Modified `server/src/rulesets/pf2/bot.ts` — bot auto-reaction
- Modified `server/src/bot.ts` — handle pendingReaction for bot players

### Definition of Done
- [x] Shield Block reduces damage when defender has feat + shield raised + reaction available
- [x] Reactive Shield raises shield as reaction when hit (before damage calc)
- [x] Reaction modal appears for human players when pendingReaction targets them
- [x] Bots auto-respond to pendingReaction (AoO: accept, Shield Block: use if beneficial)
- [x] `npx vitest run` — all tests pass
- [x] `npm run build` — succeeds

### Must Have
- Shield Block damage reduction in attack flow
- Reactive Shield AC bonus in attack flow
- Client reaction prompt modal for AoO
- Bot auto-reaction for AoO and Shield Block
- Both mobile and desktop UI support

### Must NOT Have (Guardrails)
- Do NOT modify GURPS defense system or DefenseModal
- Do NOT implement Nimble Dodge (future feature — handler placeholder exists)
- Do NOT implement Ranged Reprisal (future feature — Champion only)
- Do NOT add complex reaction ordering (single reactor per trigger for now)
- Do NOT add reaction timing options (instant resolution only)
- Do NOT change the existing AoO stride integration (it works)
- Do NOT add shield HP tracking UI (out of scope — just backend)
- Do NOT add new feat registrations beyond what's in FEAT_EFFECTS

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
Wave 1 (Start Immediately — Independent):
├── Task 1: Wire Shield Block + Reactive Shield into attack.ts
├── Task 2: PF2ReactionModal UI component
└── Task 3: Bot auto-reaction for pendingReaction

Wave 2 (After Wave 1 — Integration):
└── Task 4: Register modal in rulesetUiSlots + end-to-end verification
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 4 | 2, 3 |
| 2 | None | 4 | 1, 3 |
| 3 | None | 4 | 1, 2 |
| 4 | 1, 2, 3 | None | None (final) |

---

## TODOs

- [x] 1. Wire Shield Block + Reactive Shield into Attack Flow

  **What to do**:
  - **RED**: Write tests in `server/src/handlers/pf2/attack.test.ts`:
    - Test: defender with Shield Block feat + shield raised + reaction available → damage reduced by hardness
    - Test: defender without Shield Block feat → full damage
    - Test: defender with Reactive Shield feat + not shield raised + reaction available → shield raised, AC recalculated
    - Test: Reactive Shield consumed → no second use same round
  - **GREEN**: Modify `server/src/handlers/pf2/attack.ts`:
    - After calculating attackRoll but BEFORE applying damage:
      1. Check if defender has Reactive Shield feat, shield not raised, reaction available → call `handleReactiveShieldReaction()`, use updated combatant for AC
      2. Recalculate effectiveAC if shield was raised by Reactive Shield
      3. Re-determine degree of success with new AC if changed
    - After damage is calculated but BEFORE applying to HP:
      1. Check if defender has Shield Block feat, shield raised, reaction available → call `handleShieldBlockReaction()`
      2. Use `reducedDamage` from return value instead of original damage
    - Import `handleShieldBlockReaction` and `handleReactiveShieldReaction` from `./reaction`
  - **REFACTOR**: Ensure log entries show the reactions clearly

  **Must NOT do**:
  - Do NOT change the AoO integration in stride.ts (it already works)
  - Do NOT modify the reaction handlers themselves (they're correct)
  - Do NOT add reaction prompts for Shield Block (auto-trigger when conditions met, per PF2 RAW)
  - Do NOT break any of the 36 existing attack tests

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
    - Reason: Modifying attack flow requires careful understanding of damage resolution order

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `server/src/handlers/pf2/attack.ts:180-235` — Damage application section. Shield Block goes between damage calc (line 183) and HP update (line 193). Reactive Shield goes before attack roll evaluation.
  - `server/src/handlers/pf2/reaction.ts:228-289` — `handleShieldBlockReaction()`: accepts match, matchId, defender, incomingDamage → returns { match, reducedDamage }
  - `server/src/handlers/pf2/reaction.ts:291-335` — `handleReactiveShieldReaction()`: accepts match, matchId, defender → returns updated match with shieldRaised=true, reactionAvailable=false

  **API/Type References**:
  - `shared/rulesets/pf2/types.ts:166` — `reactionAvailable: boolean` on PF2CombatantState
  - `shared/rulesets/pf2/types.ts:176` — `shieldRaised: boolean` on PF2CombatantState
  - `shared/rulesets/pf2/types.ts:177` — `shieldHP: number` on PF2CombatantState

  **Test References**:
  - `server/src/handlers/pf2/attack.test.ts` — 36 existing tests (must all pass)
  - `shared/rulesets/pf2/reactions.test.ts:488-560` — Shield Block test patterns (canShieldBlock logic, hardness reduction)
  - `shared/rulesets/pf2/reactions.test.ts:605-700` — Reactive Shield test patterns

  **Acceptance Criteria**:
  - [x] Shield Block auto-triggers when conditions met (feat + shield raised + reaction available)
  - [x] Damage reduced by shield hardness value
  - [x] Reactive Shield auto-triggers when conditions met (feat + shield not raised + reaction available)
  - [x] Shield raised → AC increases → potentially changes hit to miss
  - [x] Reaction consumed after use (reactionAvailable = false)
  - [x] Log entries show reaction usage
  - [x] All 36+ existing attack tests still pass
  - [x] `npx vitest run server/src/handlers/pf2/attack` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Shield Block reduces damage
    Tool: Bash
    Steps:
      1. Run: npx vitest run server/src/handlers/pf2/attack -t "Shield Block"
      2. Assert: Tests pass confirming damage reduction
    Expected Result: Damage reduced by shield hardness
    Evidence: Test output captured

  Scenario: Reactive Shield raises shield before hit
    Tool: Bash
    Steps:
      1. Run: npx vitest run server/src/handlers/pf2/attack -t "Reactive Shield"
      2. Assert: Tests pass
    Expected Result: Shield raised, AC increased
    Evidence: Test output captured

  Scenario: No regression in existing tests
    Tool: Bash
    Steps:
      1. Run: npx vitest run server/src/handlers/pf2/attack
      2. Assert: All tests pass (36+)
    Expected Result: Zero regressions
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `feat(pf2): integrate Shield Block and Reactive Shield into attack flow`
  - Files: `server/src/handlers/pf2/attack.ts`, `server/src/handlers/pf2/attack.test.ts`
  - Pre-commit: `npx vitest run server/src/handlers/pf2/`

---

- [x] 2. PF2ReactionModal Client Component

  **What to do**:
  - Create `src/components/rulesets/pf2/PF2ReactionModal.tsx`:
    - Shown when `matchState.pendingReaction` exists AND current player is the reactor
    - Display: "Attack of Opportunity! [TriggerName] is moving through your threatened area."
    - Two buttons: "Strike (AoO)" and "Decline"
    - Clicking dispatches `onAction('pf2_reaction_choice', { type: 'pf2_reaction_choice', choice: 'aoo' | 'decline' })`
    - Visual style: overlay modal similar to GURPS DefenseModal
    - Show weapon info for the AoO strike
    - Auto-dismiss when pendingReaction clears from state
  - Write component tests `src/components/rulesets/pf2/PF2ReactionModal.test.tsx`:
    - Renders when pendingReaction targets current player
    - Does not render when no pendingReaction
    - Strike button dispatches aoo choice
    - Decline button dispatches decline choice
    - Shows trigger combatant name

  **Must NOT do**:
  - Do NOT modify GURPS DefenseModal
  - Do NOT add Shield Block prompt (Shield Block auto-triggers server-side)
  - Do NOT add complex reaction queue UI
  - Do NOT add animation/transition effects

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Modal design matching existing game UI style

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/rulesets/gurps/DefenseModal.tsx:21-52` — GURPS defense modal: overlay with attack info, defense choice buttons. Follow same visual pattern.
  - `src/components/game/GameScreen.tsx:250-260` — How DefenseModal is rendered via rulesetUiSlots. Same pattern for ReactionModal.
  - `src/components/game/shared/rulesetUiSlots.ts:215-229` — GURPS registers DefenseModal, PF2 has null. Add reaction modal for PF2.

  **API/Type References**:
  - `shared/types.ts:5-10` — `PendingReaction` type: `{ reactorId, triggerId, triggerAction, originalPayload }`
  - `shared/types.ts:86` — `MatchState.pendingReaction?: PendingReaction`
  - `shared/rulesets/pf2/types.ts:209` — `pf2_reaction_choice` action type

  **Acceptance Criteria**:
  - [x] `src/components/rulesets/pf2/PF2ReactionModal.tsx` exists
  - [x] Modal shows when pendingReaction targets current player
  - [x] "Strike (AoO)" button dispatches aoo choice
  - [x] "Decline" button dispatches decline choice
  - [x] Shows trigger combatant name
  - [x] Styled consistently with game UI
  - [x] `npx vitest run src/components/rulesets/pf2/PF2ReactionModal` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Reaction modal renders with correct info
    Tool: Bash
    Steps:
      1. Run: npx vitest run src/components/rulesets/pf2/PF2ReactionModal
      2. Assert: All tests pass
    Expected Result: Modal renders and dispatches actions
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `feat(pf2): add PF2ReactionModal for Attack of Opportunity prompts`
  - Files: `src/components/rulesets/pf2/PF2ReactionModal.tsx`, `src/components/rulesets/pf2/PF2ReactionModal.test.tsx`
  - Pre-commit: `npx vitest run src/components/rulesets/pf2/`

---

- [x] 3. Bot Auto-Reaction for PendingReaction

  **What to do**:
  - Modify `server/src/bot.ts` (or `server/src/rulesets/pf2/bot.ts`):
    - When match has `pendingReaction` and reactor is a bot:
      - For AoO: always accept (bots should take free attacks)
      - Call `handlePF2ReactionChoice()` with choice='aoo'
    - This prevents the game from hanging when a bot has AoO feat
  - For Shield Block (auto-trigger):
    - No bot action needed — Shield Block auto-triggers in attack flow (Task 1)
  - Add detection in `scheduleBotTurn()`:
    - If `match.pendingReaction && match.pendingReaction.reactorId === botPlayerId`:
      - Auto-respond immediately
    - If `match.pendingReaction && match.pendingReaction.reactorId !== botPlayerId`:
      - Wait (human player needs to respond)
  - Write tests:
    - Test: bot with AoO receives pendingReaction → auto-accepts
    - Test: non-bot reactor → no auto-response

  **Must NOT do**:
  - Do NOT add complex bot strategy for declining AoO
  - Do NOT modify human player reaction flow
  - Do NOT add timeouts for human reactions (out of scope)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `server/src/bot.ts` — `scheduleBotTurn()`: main bot entry point. Add pendingReaction check here.
  - `server/src/rulesets/pf2/bot.ts` — PF2 bot logic: weapon selection, movement, attack decisions.
  - `server/src/handlers/pf2/reaction.ts:176-226` — `handlePF2ReactionChoice()`: what to call for bot auto-reaction.

  **API/Type References**:
  - `shared/types.ts:5-10` — `PendingReaction` type
  - `shared/types.ts:86` — `MatchState.pendingReaction`

  **Test References**:
  - `server/src/rulesets/pf2/bot.test.ts` — 18 existing bot tests

  **Acceptance Criteria**:
  - [x] Bot with AoO auto-accepts when pendingReaction targets them
  - [x] Game does not hang when bot is AoO reactor
  - [x] Non-bot reactor is not auto-responded
  - [x] `npx vitest run server/src/rulesets/pf2/bot` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Bot auto-accepts AoO
    Tool: Bash
    Steps:
      1. Run: npx vitest run server/src/rulesets/pf2/bot -t "reaction"
      2. Assert: Tests pass
    Expected Result: Bot responds to AoO automatically
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `feat(pf2): bot auto-reaction for Attack of Opportunity`
  - Files: `server/src/bot.ts`, `server/src/rulesets/pf2/bot.ts`, `server/src/rulesets/pf2/bot.test.ts`
  - Pre-commit: `npx vitest run server/src/rulesets/pf2/`

---

- [x] 4. Register PF2 Reaction Modal + End-to-End Verification

  **What to do**:
  - Update `src/components/game/shared/rulesetUiSlots.ts`:
    - Import PF2ReactionModal
    - Change PF2 entry from `DefenseModal: null` to render PF2ReactionModal when pendingReaction exists
    - OR: add a new `ReactionModal` slot for PF2
  - Update `src/components/game/GameScreen.tsx` if needed:
    - Ensure PF2ReactionModal renders when `matchState.pendingReaction` exists
    - Pass required props: pendingReaction, combatant names, onAction handler
  - Run full test suite and verify no regressions
  - Verify end-to-end flow:
    - Player strides past enemy with AoO → reaction modal appears for enemy player
    - Enemy clicks "Strike" → AoO resolves, stride completes
    - Attack against Shield Block defender → damage reduced in log
    - Attack against Reactive Shield defender → shield raised in log

  **Must NOT do**:
  - Do NOT break GURPS DefenseModal registration
  - Do NOT change GameScreen layout

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`playwright`]
    - `playwright`: End-to-end browser testing of reaction flow

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (final task)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2, 3

  **References**:

  **Pattern References**:
  - `src/components/game/shared/rulesetUiSlots.ts:215-229` — GURPS registers DefenseModal at line 215. PF2 at line 229 has `DefenseModal: null`. Change this.
  - `src/components/game/GameScreen.tsx:250-260` — DefenseModal rendering. Add PF2 reaction modal rendering.

  **Acceptance Criteria**:
  - [x] PF2ReactionModal registered in rulesetUiSlots
  - [x] Modal appears during AoO triggers in live game
  - [x] Shield Block reduces damage in combat log
  - [x] Reactive Shield raises shield in combat log
  - [x] Bot handles AoO without hanging
  - [x] `npx vitest run` → ALL tests pass (0 failures)
  - [x] `npm run build` → succeeds
  - [x] `npm run lint` → no errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: AoO reaction flow end-to-end
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running, 2-player PF2 match, one character with AoO feat
    Steps:
      1. Player 1 Strides past Player 2's threatened square
      2. Assert: PF2ReactionModal appears for Player 2
      3. Assert: Modal shows "Attack of Opportunity" text
      4. Click "Strike (AoO)"
      5. Assert: Combat log shows AoO attack result
      6. Assert: Stride completes for Player 1
      7. Screenshot: .sisyphus/evidence/task-4-aoo-flow.png
    Expected Result: Full AoO reaction flow works
    Evidence: .sisyphus/evidence/task-4-aoo-flow.png

  Scenario: Shield Block reduces damage in log
    Tool: Playwright (playwright skill)
    Preconditions: Defender has Shield Block, shield raised, reaction available
    Steps:
      1. Attack defender
      2. Assert: Combat log contains "Shield Block" and "damage reduced"
      3. Screenshot: .sisyphus/evidence/task-4-shield-block.png
    Expected Result: Shield Block auto-triggers and reduces damage
    Evidence: .sisyphus/evidence/task-4-shield-block.png

  Scenario: All tests pass
    Tool: Bash
    Steps:
      1. Run: npx vitest run
      2. Assert: Exit code 0, 0 failures
      3. Run: npm run build
      4. Assert: Exit code 0
    Expected Result: Zero regressions, clean build
    Evidence: Test + build output captured
  ```

  **Commit**: YES
  - Message: `feat(pf2): register reaction modal and complete reaction integration`
  - Files: `src/components/game/shared/rulesetUiSlots.ts`, `src/components/game/GameScreen.tsx`
  - Pre-commit: `npx vitest run && npm run build`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(pf2): integrate Shield Block and Reactive Shield into attack flow` | attack.ts + tests | `npx vitest run server/src/handlers/pf2/` |
| 2 | `feat(pf2): add PF2ReactionModal for AoO prompts` | component + test | `npx vitest run src/components/rulesets/pf2/` |
| 3 | `feat(pf2): bot auto-reaction for AoO` | bot.ts + tests | `npx vitest run server/src/rulesets/pf2/` |
| 4 | `feat(pf2): register reaction modal + end-to-end integration` | rulesetUiSlots + GameScreen | `npx vitest run && npm run build` |

---

## Success Criteria

### Verification Commands
```bash
npx vitest run                    # Expected: all tests pass
npm run lint                      # Expected: no errors
npm run build                     # Expected: compiles without errors
```

### Final Checklist
- [x] Shield Block auto-triggers and reduces damage
- [x] Reactive Shield auto-triggers and raises shield
- [x] AoO reaction modal appears for human players
- [x] Bot auto-accepts AoO
- [x] No game hangs on bot reactions
- [x] All existing tests still pass (no regressions)
