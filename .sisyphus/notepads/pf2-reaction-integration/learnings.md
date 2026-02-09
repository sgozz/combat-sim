# PF2 Reaction Integration — Learnings

## Task 1: Shield Block + Reactive Shield (COMPLETE)
- Shield Block and Reactive Shield are auto-triggered server-side (no player prompt needed)
- Integration is in `handlePF2AttackAction` only (main attack function)
- Reactive Shield goes BEFORE attack roll evaluation (raises shield → increases AC)
- Shield Block goes AFTER damage calc but BEFORE HP application (reduces damage)
- Sudden Charge uses `movedMatch` variable (not `currentMatch`)
- All 36 attack tests pass, 905 total tests pass

## Task 2: PF2ReactionModal (COMPLETE)
- Created `src/components/rulesets/pf2/PF2ReactionModal.tsx` — simple modal with Strike/Decline buttons
- Reuses existing CSS classes: `modal-overlay`, `modal`, `defense-header`, `warning-badge`, `defense-cards`, `defense-card`
- 6 tests in `PF2ReactionModal.test.tsx` — all pass
- Uses `as unknown as` for test type casting since MatchState has many required fields

## Task 3: Bot Auto-Reaction (COMPLETE)
- Added pendingReaction check in `scheduleBotTurn()` in `server/src/bot.ts`
- Exported `resumeStrideAfterReaction` from `reaction.ts` (was private)
- Bot always accepts AoO (calls `executeAoOStrike` directly)
- If reactor is human, bot returns early (waits for human response)
- Check goes BEFORE bot combatant check to handle reactions from any bot

## Task 4: GameScreen Integration (COMPLETE)
- Imported PF2ReactionModal directly in GameScreen (not via rulesetUiSlots)
- Renders when `matchState.pendingReaction` exists AND `rulesetId === 'pf2'`
- Placed right after GURPS DefenseModal section
- Did NOT modify rulesetUiSlots — PF2ReactionModal has different props than DefenseModal slot type

## Final Stats
- 911 tests pass (905 + 6 new PF2ReactionModal tests)
- Build passes
- No lint errors in changed files
