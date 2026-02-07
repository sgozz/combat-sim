# PF2 Playtest Bugfix — 11 Defects

## TL;DR

> **Quick Summary**: Fix all 11 defects found during a full PF2 playtest session. Covers critical gameplay bugs (AC calculation, melee range, spawn positions), broken functionality (dashboard stats, Step action, WebSocket reconnection), and UX polish (TurnStepper, tutorial, victory screen, name truncation).
> 
> **Deliverables**:
> - 11 bug fixes with TDD test coverage
> - Each fix includes failing test → implementation → passing test
> - Playwright QA verification for UI bugs
> 
> **Estimated Effort**: Medium-Large (11 distinct fixes across server, shared, and client)
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Task 1 (AC fix) → Task 2 (Strike range) → Task 3 (Spawn) → all others parallel

---

## Context

### Original Request
User asked to simulate being a new PF2-expert player, play a full match, then report and plan fixes for all defects found.

### Playtest Session Summary
**Flow tested**: Welcome → Login as "Valeros" → PF2 ruleset → Armory → Create "Valeros the Fighter" (Level 1, Str 18, Dex 14, Con 14, Full Plate, Longsword, Shield +2) → Dashboard → New Match (2 players, 1 bot) → Lobby → Character selection → Combat (3 rounds) → Victory → Leave → Dashboard

**Key Findings**:
- AC showed 10 instead of 18 (Full Plate ignored)
- Strike failed with "out of melee range" on visually adjacent combatants
- Both combatants spawned on same tile
- Step action always disabled
- Dashboard stats never update
- WebSocket disconnects on logout
- TurnStepper frozen, tutorial mentions hex grid for PF2, no victory screen, name truncation

### Research Findings
- **Bug 1 Root Cause**: `shared/rulesets/pf2/index.ts:23` — `getDerivedStats()` calls `calculateDerivedStats(abilities, level, classHP)` without armor params (armorBonus defaults to 0). Fix pattern exists in `useCharacterEditor.ts:59-68`.
- **Bug 2**: `attack.ts:120` checks `distance > 1` using Chebyshev distance. `calculateGridDistance` converts `{x,z}` to `{q,r}`. Stride in `stride.ts:125` sets position `{x: payload.to.q, z: payload.to.r}`. Possible coordinate mismatch or stale state issue.
- **Bug 3**: `match.ts:51-60` uses `Math.random()` offsets that can produce same positions. No collision check.
- **Bug 5**: PF2 Step action — `actions.ts` needs a Step handler or the ActionBar condition to enable it is wrong.

---

## Work Objectives

### Core Objective
Fix all 11 defects to make PF2 mode fully playable with correct rules and good UX.

### Concrete Deliverables
- 11 bug fixes (server + shared + client)
- 11+ test cases (TDD)
- Passing test suite (`npx vitest run`)
- Passing lint (`npm run lint`)

### Definition of Done
- [x] `npx vitest run` → all tests pass (0 failures)
- [x] `npm run lint` → no errors
- [x] Full PF2 match playable: login → create character → combat → victory screen
- [x] AC correctly includes armor bonus
- [x] Strike works on adjacent combatants after Stride
- [x] Combatants spawn on separate tiles

### Must Have
- All 11 fixes implemented and tested
- No regressions in existing tests
- PF2 combat rules correct per RAW (AC, MAP, crits, etc.)

### Must NOT Have (Guardrails)
- Do NOT modify GURPS ruleset logic or tests
- Do NOT refactor unrelated code alongside fixes
- Do NOT add new features beyond what's needed to fix each bug
- Do NOT change the message protocol between client/server (keep backward compatible)
- Do NOT change grid coordinate system — fix within existing {x,y,z} / {q,r} convention
- Do NOT add AI/bot improvements beyond spawn position fix

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
> ALL tasks verified by agent using tools. No human action required.

### Test Decision
- **Infrastructure exists**: YES (vitest, happy-dom)
- **Automated tests**: TDD (red-green-refactor)
- **Framework**: vitest
- **Test commands**: `npx vitest run` (all), `npx vitest run <file>` (specific)

### TDD Workflow Per Task

1. **RED**: Write failing test that reproduces the bug
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping green

### Agent-Executed QA Scenarios

| Type | Tool | How Agent Verifies |
|------|------|-------------------|
| Server logic bugs (1,2,3) | vitest unit tests | `npx vitest run <test-file>` |
| UI bugs (5,7,8,9,10,11) | Playwright | Navigate, interact, assert DOM, screenshot |
| Full integration (all) | Playwright | Play full match end-to-end |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — Independent foundation fixes):
├── Task 1: AC ignores armor [shared/server]
├── Task 5: Step always disabled [server/client]
├── Task 8: Tutorial says hex grid [client]
└── Task 11: Editor header name truncation [client]

Wave 2 (After Wave 1 — depends on AC fix for correct testing):
├── Task 2: Strike melee range bug [server]
├── Task 3: Spawn overlap [server]
├── Task 4: Dashboard stats [server/client]
├── Task 6: WebSocket reconnect [client]
└── Task 10: Name truncation initiative tracker [client]

Wave 3 (After Wave 2 — depends on combat working correctly):
├── Task 7: TurnStepper not updating [client]
├── Task 9: Victory screen [client]
└── Task 12: Full integration Playwright test [e2e]
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3, 12 | 5, 8, 11 |
| 2 | 1 | 12 | 3, 4, 6, 10 |
| 3 | 1 | 12 | 2, 4, 6, 10 |
| 4 | None | 12 | 2, 3, 6, 10 |
| 5 | None | 12 | 1, 8, 11 |
| 6 | None | 12 | 2, 3, 4, 10 |
| 7 | 2, 5 | 12 | 9 |
| 8 | None | None | 1, 5, 11 |
| 9 | 2, 3 | 12 | 7 |
| 10 | None | None | 2, 3, 4, 6 |
| 11 | None | None | 1, 5, 8 |
| 12 | ALL | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Dispatch |
|------|-------|---------------------|
| 1 | 1, 5, 8, 11 | 4 parallel agents |
| 2 | 2, 3, 4, 6, 10 | 5 parallel agents |
| 3 | 7, 9, 12 | 3 parallel agents (12 last) |

---

## TODOs

- [x] 1. Fix AC calculation ignoring equipped armor

  **What to do**:
  - **RED**: Write test in `shared/rulesets/pf2/rules.test.ts` (or new file) that verifies `getDerivedStats()` returns correct AC when character has armor equipped (e.g., Full Plate +6 with Dex cap 0 and Dex 14 → AC should be 10 + 0 dex + 6 armor + 3 prof(trained lv1) = 19, NOT 10)
  - **GREEN**: In `shared/rulesets/pf2/index.ts:23`, change `getDerivedStats()` to pass armor and proficiency params to `calculateDerivedStats()`:
    ```typescript
    const stats = calculateDerivedStats(
      character.abilities,
      character.level,
      character.classHP,
      character.armor?.acBonus ?? 0,
      character.armor?.dexCap ?? null,
      character.saveProficiencies,
      character.perceptionProficiency,
      character.armorProficiency
    );
    ```
  - Also fix the `createCharacter()` default (line 82-89): call `calculateDerivedStats` instead of hardcoding `derived.armorClass: 10`
  - Verify the Lobby character preview shows correct AC after fix

  **Must NOT do**:
  - Do NOT change `calculateDerivedStats()` function signature — it already accepts all params
  - Do NOT modify GURPS getDerivedStats

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]
    - `playwright`: For verifying lobby character preview shows correct AC

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 5, 8, 11)
  - **Blocks**: Tasks 2, 3, 12
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/rulesets/useCharacterEditor.ts:59-68` — Correct pattern: passes ALL armor params to `pf2CalculateDerivedStats()`. This is the exact fix pattern to follow.

  **API/Type References**:
  - `shared/rulesets/pf2/rules.ts:156-182` — `calculateDerivedStats()` function signature showing all optional params (armorBonus, armorDexCap, saveProficiencies, etc.)
  - `shared/rulesets/pf2/rules.ts:126-137` — `calculateAC()` formula: `10 + effectiveDex + armorBonus + profBonus`

  **Bug Location**:
  - `shared/rulesets/pf2/index.ts:23` — Only passes 3 of 8 params: `calculateDerivedStats(character.abilities, character.level, character.classHP)`. armorBonus defaults to 0.
  - `shared/rulesets/pf2/index.ts:82-89` — `createCharacter()` hardcodes `derived.armorClass: 10` instead of computing

  **Test References**:
  - `shared/rules.test.ts` — Existing test structure and patterns
  - `server/src/handlers/pf2/attack.test.ts:108` — Shows how tests override derived armorClass

  **Acceptance Criteria**:

  - [ ] Test file created: `shared/rulesets/pf2/index.test.ts`
  - [ ] Test covers: getDerivedStats with Full Plate returns AC ≥ 16 (not 10)
  - [ ] Test covers: getDerivedStats with no armor returns AC = 10 + dexMod + profBonus
  - [ ] `npx vitest run shared/rulesets/pf2/index.test.ts` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: AC correctly calculated with Full Plate in lobby preview
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running, PF2 character "Valeros" with Full Plate exists
    Steps:
      1. Navigate to http://localhost:5173
      2. Login and go to /home
      3. Create new match, go to lobby
      4. Select Valeros character
      5. Assert: Combat section shows AC > 10 (should be 18+)
      6. Screenshot: .sisyphus/evidence/task-1-ac-lobby.png
    Expected Result: AC shows correct armor-included value
    Evidence: .sisyphus/evidence/task-1-ac-lobby.png
  ```

  **Commit**: YES
  - Message: `fix(pf2): pass armor params to getDerivedStats so AC includes equipped armor`
  - Files: `shared/rulesets/pf2/index.ts`, `shared/rulesets/pf2/index.test.ts`
  - Pre-commit: `npx vitest run shared/rulesets/pf2/`

---

- [x] 2. Fix Strike "Target out of melee range" on adjacent combatants

  **What to do**:
  - **RED**: Write test in `server/src/handlers/pf2/attack.test.ts` that: creates two PF2 combatants at adjacent positions (e.g., `{x:0,y:0,z:0}` and `{x:1,y:0,z:0}`), performs a Stride to move one closer if needed, then attempts Strike. Assert: no "out of melee range" error.
  - **GREEN**: Investigate and fix the root cause. Likely candidates:
    1. After Stride in `stride.ts:125`, position updates as `{x: payload.to.q, y: c.position.y, z: payload.to.r}` — verify the coordinates match what `calculateGridDistance` expects
    2. Check if the `match.combatants` state is stale when Strike handler runs (race condition)
    3. Verify the `gridToHex`/`hexToGrid` conversion round-trips correctly for PF2 square grid
  - The key debugging path: add a test that does Stride then immediately Strike, check that the combatant position was actually updated in the match state before the attack handler reads it

  **Must NOT do**:
  - Do NOT change the `calculateGridDistance` Chebyshev formula (it's correct)
  - Do NOT change grid coordinate system

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`playwright`]
    - `playwright`: For end-to-end verification of stride-then-strike

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 6, 10)
  - **Blocks**: Tasks 7, 9, 12
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `server/src/handlers/pf2/stride.ts:125` — How position is updated after stride: `position: { x: payload.to.q, y: c.position.y, z: payload.to.r }`
  - `server/src/handlers/pf2/attack.ts:119` — Range check: `calculateGridDistance(actorCombatant.position, targetCombatant.position, gridSystem)`
  - `server/src/handlers/pf2/stride.ts:30-34` — Stride uses `gridToHex()` to convert positions before pathfinding

  **API/Type References**:
  - `server/src/helpers.ts:56-64` — `calculateGridDistance()`: converts `{x,z}` to `{q,r}` then calls `gridSystem.distance()`
  - `shared/grid/SquareGridSystem.ts:35-43` — Chebyshev distance: `Math.max(dq, dr)`. Adjacent = distance 1.
  - `shared/rulesets/serverAdapter.ts:910` — PF2 uses `squareGrid8`

  **Bug Context**:
  - During playtest: Stride moved visually adjacent, Strike gave "out of range". Next turn from same position, Strike worked.
  - Possible cause: PF2 Stride handler uses `gridToHex`/`hexToGrid` conversions that may not round-trip cleanly, leaving fractional coordinates

  **Test References**:
  - `server/src/handlers/pf2/attack.test.ts` — Extensive existing tests with positions at `{0,0,0}` and `{1,0,0}` (distance 1)
  - `server/src/handlers/pf2/stride.test.ts:132-158` — Tests stride movement and position updates

  **Acceptance Criteria**:

  - [ ] Test covers: Stride to adjacent tile then Strike → success (no error)
  - [ ] Test covers: Strike from distance 2+ → "out of melee range" error (unchanged behavior)
  - [ ] `npx vitest run server/src/handlers/pf2/attack.test.ts` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Stride then Strike works in live game
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running, PF2 character exists
    Steps:
      1. Create match with bot, start match
      2. Click Stride, move to adjacent tile near bot
      3. Click Strike
      4. Assert: No "Error: Target out of melee range" toast appears
      5. Assert: Combat log shows attack result (hit/miss)
      6. Screenshot: .sisyphus/evidence/task-2-stride-strike.png
    Expected Result: Strike succeeds after Stride to adjacent tile
    Evidence: .sisyphus/evidence/task-2-stride-strike.png
  ```

  **Commit**: YES
  - Message: `fix(pf2): resolve melee range check failure after stride movement`
  - Files: `server/src/handlers/pf2/attack.ts` or `stride.ts` (depends on root cause), test file
  - Pre-commit: `npx vitest run server/src/handlers/pf2/`

---

- [x] 3. Fix combatants spawning on the same tile

  **What to do**:
  - **RED**: Write test in `server/src/match.test.ts` (new file) that creates a match with 2+ combatants and asserts all positions are unique (no two combatants share the same `{x, z}` coordinate).
  - **GREEN**: Fix `server/src/match.ts:48-63` to ensure unique spawn positions:
    1. Remove `Math.random()` offsets (lines 57-59) that cause unpredictable overlaps
    2. Use deterministic spawn positions: player side (e.g., x=-2, z=0), bot side (e.g., x=6, z=0)
    3. If multiple combatants per side, offset by row: `z = index_within_side`
    4. Add collision detection: after assigning positions, verify no duplicates; if found, shift to next free tile
  - Keep spawn positions far enough apart that combat requires movement (PF2 design intent: 5ft step doesn't trivially reach opponent)

  **Must NOT do**:
  - Do NOT make spawn fully random — deterministic positions are better for fairness
  - Do NOT change initiative logic (lines 66-96)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 4, 6, 10)
  - **Blocks**: Tasks 9, 12
  - **Blocked By**: Task 1

  **References**:

  **Bug Location**:
  - `server/src/match.ts:48-63` — Spawn logic with `Math.random()` shifts that can cause overlaps
  - `server/src/match.ts:57-59` — `randomShift` and `finalR` are both random, can create same position for two combatants

  **Pattern References**:
  - `server/src/handlers/gurps/__tests__/testUtils.ts:130-136` — GURPS test utils use explicit separate positions: `{0,0,0}` and `{1,0,0}`

  **Acceptance Criteria**:

  - [ ] Test covers: 2-player match → all combatant positions unique
  - [ ] Test covers: 4-player match → all positions unique
  - [ ] Test covers: 6-player match → all positions unique
  - [ ] `npx vitest run server/src/match.test.ts` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Combatants spawn on different tiles
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running, PF2 character exists
    Steps:
      1. Create match with 1 bot, start match
      2. Assert: Two combatant models are NOT overlapping in the 3D scene
      3. Assert: HP bars show at different screen positions
      4. Screenshot: .sisyphus/evidence/task-3-spawn-positions.png
    Expected Result: Combatants visually separated at game start
    Evidence: .sisyphus/evidence/task-3-spawn-positions.png
  ```

  **Commit**: YES
  - Message: `fix(server): ensure combatants spawn on unique tiles with deterministic positions`
  - Files: `server/src/match.ts`, `server/src/match.test.ts`
  - Pre-commit: `npx vitest run server/src/match.test.ts`

---

- [x] 4. Fix Dashboard stats always showing "--"

  **What to do**:
  - **RED**: Write test that verifies match results are persisted when a match ends and that the dashboard reads them correctly.
  - **GREEN**: 
    1. Investigate how match completion is handled server-side — check if match result (winner, loser) is stored in the database or sent to the client
    2. Check `src/components/Dashboard.tsx` and `src/hooks/useMatches.ts` — how stats are fetched
    3. Likely issue: the server doesn't persist match outcomes, OR the client doesn't request/receive them
    4. Fix: ensure match completion stores result in DB, and dashboard fetches it on load

  **Must NOT do**:
  - Do NOT add complex analytics — just Total Matches, Wins, Losses, Win Rate

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3, 6, 10)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:

  **Files to investigate**:
  - `src/components/Dashboard.tsx` — Where stats are displayed
  - `src/components/dashboard/StatsBar.tsx` — Stats bar component
  - `src/hooks/useMatches.ts` — Hook for match data
  - `server/src/db.ts` — Database layer, check for match result storage
  - `server/src/handlers.ts` — Match end handler

  **Acceptance Criteria**:

  - [ ] After completing a match, navigating to dashboard shows updated stats
  - [ ] Total Matches shows "1" (not "--") after first match
  - [ ] Wins increments after winning
  - [ ] Win Rate calculates correctly
  - [ ] `npx vitest run` → all related tests pass

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Dashboard stats update after match completion
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running, character exists
    Steps:
      1. Navigate to /home, note initial stats
      2. Create match with bot, play to completion (win)
      3. Click Leave, return to /home
      4. Assert: Total Matches shows "1" (not "--")
      5. Assert: Wins shows "1"
      6. Screenshot: .sisyphus/evidence/task-4-stats-after-match.png
    Expected Result: Stats reflect completed match
    Evidence: .sisyphus/evidence/task-4-stats-after-match.png
  ```

  **Commit**: YES
  - Message: `fix(stats): persist match results and display on dashboard`
  - Files: varies (server/src/handlers.ts, server/src/db.ts, src/components/Dashboard.tsx)
  - Pre-commit: `npx vitest run`

---

- [x] 5. Fix PF2 Step action always disabled

  **What to do**:
  - **RED**: Write test verifying that the Step action is available/enabled when a PF2 combatant has actions remaining and is NOT in a movement mode.
  - **GREEN**:
    1. Find why Step is disabled in the ActionBar. Check `src/components/rulesets/pf2/PF2ActionBar.tsx` for the enabled/disabled condition on the Step button
    2. Check `server/src/handlers/pf2/actions.ts` for Step handler — does it exist? Is it registered?
    3. In PF2, Step is a 1-action activity: move 5ft (1 square) without provoking reactions. It should be enabled whenever the combatant has ≥1 action remaining.
    4. Implement or fix the Step handler server-side (accept step action, validate 1-square move, deduct 1 action)
    5. Fix the client-side enabled condition

  **Must NOT do**:
  - Do NOT implement complex Step variants (e.g., rogue's nimble dodge step)
  - Keep Step as simple 1-square move, no reactions triggered

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 8, 11)
  - **Blocks**: Tasks 7, 12
  - **Blocked By**: None

  **References**:

  **Files to investigate**:
  - `src/components/rulesets/pf2/PF2ActionBar.tsx` — Step button enabled/disabled logic
  - `src/components/game/shared/useGameActions.ts` — Game action dispatch
  - `server/src/handlers/pf2/actions.ts:128-152` — Existing movement handler (Step may need similar logic for 1-square move)
  - `server/src/handlers/pf2/stride.ts` — Stride implementation (Step is similar but 1 square only)

  **PF2 Rules Reference**:
  - Step: 1 action, move 5ft (1 square), does NOT provoke reactions (unlike Stride which does)
  - Available to all characters with ≥1 action remaining
  - Cannot step into difficult terrain

  **Acceptance Criteria**:

  - [ ] Step button is enabled when combatant has ≥1 action and is adjacent to open squares
  - [ ] Clicking Step shows 1-square movement options (only adjacent tiles)
  - [ ] Completing Step deducts 1 action
  - [ ] Step does NOT trigger Attacks of Opportunity (if reaction system exists)
  - [ ] `npx vitest run server/src/handlers/pf2/` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Step action works in combat
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running, in active PF2 match, player's turn
    Steps:
      1. Start match, verify 3 actions available (3 green dots)
      2. Assert: Step button is enabled (not grayed out)
      3. Click Step button
      4. Assert: Adjacent tiles highlighted (1-square range only)
      5. Click adjacent tile
      6. Assert: Character moves 1 square, 2 actions remaining
      7. Screenshot: .sisyphus/evidence/task-5-step-works.png
    Expected Result: Step moves 1 square and costs 1 action
    Evidence: .sisyphus/evidence/task-5-step-works.png
  ```

  **Commit**: YES
  - Message: `fix(pf2): implement Step action (1-square move without provoking)`
  - Files: `server/src/handlers/pf2/actions.ts`, `src/components/rulesets/pf2/PF2ActionBar.tsx`, tests
  - Pre-commit: `npx vitest run server/src/handlers/pf2/`

---

- [x] 6. Fix WebSocket disconnect after logout

  **What to do**:
  - **RED**: Write test (or manual Playwright scenario) that verifies: after logout and returning to welcome screen, the connection status shows "Connected" (not "Offline").
  - **GREEN**:
    1. Check `src/hooks/useGameSocket.ts` — how WS connection lifecycle works
    2. Check `src/hooks/useAuth.ts` — what happens on logout
    3. Likely issue: logout closes the WebSocket, but navigating back to the welcome screen doesn't trigger a reconnect
    4. Fix: either reconnect WS when welcome screen mounts, or don't close WS on logout (just clear auth state)

  **Must NOT do**:
  - Do NOT change the WS protocol or message format
  - Do NOT introduce WebSocket keepalive/heartbeat (out of scope)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3, 4, 10)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:

  **Files to investigate**:
  - `src/hooks/useGameSocket.ts` — WebSocket connection management
  - `src/hooks/useAuth.ts` — Logout logic
  - `src/components/WelcomeScreen.tsx` — Where connection status is displayed
  - `src/App.tsx` — Route/state management

  **Acceptance Criteria**:

  - [ ] After logout, welcome screen shows "Connected" (not "Offline")
  - [ ] Can log in again after logout without page refresh
  - [ ] No console errors related to WebSocket

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: WebSocket reconnects after logout
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running
    Steps:
      1. Navigate to http://localhost:5173, login as any user
      2. Verify dashboard loads (connected)
      3. Click Logout
      4. Wait for welcome screen
      5. Assert: connection status shows "Connected" (NOT "Offline")
      6. Screenshot: .sisyphus/evidence/task-6-ws-reconnect.png
    Expected Result: WebSocket reconnects on welcome screen
    Evidence: .sisyphus/evidence/task-6-ws-reconnect.png
  ```

  **Commit**: YES
  - Message: `fix(client): reconnect WebSocket after logout`
  - Files: `src/hooks/useGameSocket.ts` or `src/hooks/useAuth.ts`
  - Pre-commit: `npm run lint`

---

- [x] 7. Fix TurnStepper not updating after actions

  **What to do**:
  - **RED**: Write test or Playwright scenario verifying TurnStepper text changes after performing actions.
  - **GREEN**:
    1. Check `src/components/game/TurnStepper.tsx` — how it determines the current step text
    2. Likely issue: it always shows "STEP 1: Choose a maneuver" because it doesn't track `actionsRemaining` or the current action phase
    3. Fix: make TurnStepper responsive to game state. After choosing a maneuver (e.g., Strike), it should say "STEP 2: Select target" or similar. After performing an action, it should count down.
    4. Reasonable step progression: "Choose action" → "Select target/tile" → "Action X complete, N actions remaining"

  **Must NOT do**:
  - Do NOT over-engineer a complex state machine — simple text updates based on actionsRemaining and current mode

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 9)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 2, 5

  **References**:

  **Files to investigate**:
  - `src/components/game/TurnStepper.tsx` — TurnStepper component
  - `src/components/game/GameScreen.tsx` — Parent that passes props
  - `src/hooks/useMatchState.ts` — Game state hook

  **Acceptance Criteria**:

  - [ ] TurnStepper updates after each action (not stuck on "STEP 1")
  - [ ] Shows relevant guidance based on current phase

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: TurnStepper updates during turn
    Tool: Playwright (playwright skill)
    Preconditions: Active PF2 match, player's turn
    Steps:
      1. Verify TurnStepper shows initial guidance text
      2. Click Strike button
      3. Assert: TurnStepper text changed (not still "STEP 1: Choose a maneuver")
      4. Complete the attack
      5. Assert: TurnStepper shows updated info (e.g., actions remaining)
      6. Screenshot: .sisyphus/evidence/task-7-turnstepper-updates.png
    Expected Result: TurnStepper text reflects current game phase
    Evidence: .sisyphus/evidence/task-7-turnstepper-updates.png
  ```

  **Commit**: YES
  - Message: `fix(ui): make TurnStepper update based on current action phase and remaining actions`
  - Files: `src/components/game/TurnStepper.tsx`
  - Pre-commit: `npm run lint`

---

- [x] 8. Fix Tutorial mentioning "hex grid" for PF2

  **What to do**:
  - **RED**: Write test in `src/components/ui/Tutorial.test.tsx` (or check existing) that verifies tutorial text varies by ruleset. For PF2 ruleset, assert text contains "square grid" (not "hex grid").
  - **GREEN**: 
    1. Open `src/components/ui/Tutorial.tsx`
    2. Find hardcoded "hex grid" text
    3. Make it ruleset-aware: if PF2 → "square grid", if GURPS → "hex grid"
    4. Pass the current rulesetId as a prop or read from context

  **Must NOT do**:
  - Do NOT rewrite the entire tutorial — just fix the grid reference

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 5, 11)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Files to modify**:
  - `src/components/ui/Tutorial.tsx` — Tutorial text content
  - `src/components/WelcomeScreen.tsx` — Where Tutorial is rendered (passes ruleset context)

  **Acceptance Criteria**:

  - [ ] Tutorial for PF2 says "square grid" not "hex grid"
  - [ ] Tutorial for GURPS still says "hex grid"
  - [ ] `npx vitest run` → PASS (no regressions)

  **Commit**: YES
  - Message: `fix(ui): make tutorial grid description match selected ruleset`
  - Files: `src/components/ui/Tutorial.tsx`
  - Pre-commit: `npm run lint`

---

- [x] 9. Add victory/defeat screen at match end

  **What to do**:
  - Create a match result overlay that shows when a match ends, instead of just a "Leave" button
  - **RED**: Write Playwright test that after a match ends, asserts the presence of a result banner/modal with outcome text.
  - **GREEN**:
    1. In `src/components/game/GameScreen.tsx`, detect match end state (`status: "finished"`)
    2. Show an overlay/modal with:
       - Victory/Defeat banner
       - Match summary: rounds played, damage dealt, etc.
       - "Return to Dashboard" button
    3. Keep it simple: a styled overlay, not a complex stats page

  **Must NOT do**:
  - Do NOT add complex animations or celebrations
  - Do NOT block the Leave functionality — the overlay should have a clear exit

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`playwright`, `frontend-ui-ux`]
    - `playwright`: For verifying the overlay appears
    - `frontend-ui-ux`: For creating a visually appealing result screen

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `src/components/game/GameScreen.tsx` — Main game container, where match end is handled
  - `src/components/game/TurnBanner.tsx` — Example of overlay/banner component
  - `src/components/game/CombatToast.tsx` — Toast notification pattern

  **Acceptance Criteria**:

  - [ ] When match ends, a victory/defeat overlay appears
  - [ ] Overlay shows match outcome (won/lost)
  - [ ] "Return to Dashboard" button works
  - [ ] Overlay does not block game view (semi-transparent or dismissible)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Victory screen appears after winning
    Tool: Playwright (playwright skill)
    Preconditions: Active PF2 match near end
    Steps:
      1. Kill the bot (reduce to 0 HP)
      2. Assert: Victory overlay/banner appears
      3. Assert: Text contains "Victory" or "You Win"
      4. Click "Return to Dashboard"
      5. Assert: Navigated to /home
      6. Screenshot: .sisyphus/evidence/task-9-victory-screen.png
    Expected Result: Victory screen shown with summary
    Evidence: .sisyphus/evidence/task-9-victory-screen.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add victory/defeat screen on match completion`
  - Files: `src/components/game/GameScreen.tsx` (+ possibly new component)
  - Pre-commit: `npm run lint`

---

- [x] 10. Fix name truncation in initiative tracker

  **What to do**:
  - **RED**: Render InitiativeTracker with a long name (e.g., "Valeros the Fighter") and assert the full name is visible or properly handled (tooltip, ellipsis with title attribute).
  - **GREEN**:
    1. Check `src/components/game/InitiativeTracker.tsx`
    2. Fix CSS: either increase max-width for names, use text-overflow with title tooltip, or use a responsive layout
    3. The minimap labels (`src/components/game/MiniMap.tsx`) and HP bars also truncate — fix those too if time permits

  **Must NOT do**:
  - Do NOT make the tracker so wide it breaks mobile layout

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3, 4, 6)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Files to modify**:
  - `src/components/game/InitiativeTracker.tsx` — Name display in tracker
  - `src/components/game/MiniMap.tsx` — Name labels in minimap
  - `src/components/game/FloatingStatus.tsx` — HP bar name labels

  **Acceptance Criteria**:

  - [ ] Names of 20+ characters either display fully or show with tooltip on hover
  - [ ] No visual overflow or breaking of layout

  **Commit**: YES
  - Message: `fix(ui): handle long character names in initiative tracker and HP bars`
  - Files: `src/components/game/InitiativeTracker.tsx` + related
  - Pre-commit: `npm run lint`

---

- [x] 11. Fix character name truncation in editor header

  **What to do**:
  - **RED**: Render CharacterEditor with a long name and assert the name input is fully visible.
  - **GREEN**:
    1. Check `src/components/armory/CharacterEditor.tsx` — the header layout
    2. Increase the name input flex/min-width, or move buttons to a second row on narrow screens
    3. Ensure name is readable at all viewport widths

  **Must NOT do**:
  - Do NOT redesign the entire header — just fix the name field sizing

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 5, 8)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Files to modify**:
  - `src/components/armory/CharacterEditor.tsx` — Header with name input + buttons

  **Acceptance Criteria**:

  - [ ] Name input shows full 20+ character names without truncation
  - [ ] Buttons (Import, Cancel, Save) remain accessible

  **Commit**: YES
  - Message: `fix(ui): increase character name input width in editor header`
  - Files: `src/components/armory/CharacterEditor.tsx`
  - Pre-commit: `npm run lint`

---

- [x] 12. Full integration Playwright test (end-to-end)

  **What to do**:
  - Write a comprehensive Playwright e2e test that plays a complete PF2 session and verifies all 11 fixes work together:
    1. Login → select PF2
    2. Create character with Full Plate → verify AC in armory preview
    3. Create match → add bot → start
    4. Verify separate spawn positions
    5. Stride → Step → Strike (all work, no errors)
    6. Play to completion
    7. Verify victory screen appears
    8. Return to dashboard → verify stats updated

  **Must NOT do**:
  - Do NOT make this flaky — use generous timeouts and stable selectors
  - Do NOT test GURPS in this test

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`playwright`]
    - `playwright`: Required for browser automation

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (runs last)
  - **Blocks**: None
  - **Blocked By**: ALL other tasks (1-11)

  **References**:

  **Pattern References**:
  - `e2e/` — Existing e2e test directory
  - `playwright.config.ts` — Playwright configuration

  **Acceptance Criteria**:

  - [ ] `npm run test:e2e` → full PF2 session test passes
  - [ ] Test covers: login, character creation, lobby, combat, victory, stats

  **Commit**: YES (groups with all)
  - Message: `test(e2e): add full PF2 session integration test verifying all bugfixes`
  - Files: `e2e/pf2-full-session.spec.ts`
  - Pre-commit: `npm run test:e2e`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `fix(pf2): pass armor params to getDerivedStats so AC includes equipped armor` | shared/rulesets/pf2/index.ts, test | `npx vitest run shared/rulesets/pf2/` |
| 2 | `fix(pf2): resolve melee range check failure after stride movement` | server/src/handlers/pf2/*.ts, test | `npx vitest run server/src/handlers/pf2/` |
| 3 | `fix(server): ensure combatants spawn on unique tiles` | server/src/match.ts, test | `npx vitest run server/src/match.test.ts` |
| 4 | `fix(stats): persist match results and display on dashboard` | server + client | `npx vitest run` |
| 5 | `fix(pf2): implement Step action` | server/client | `npx vitest run server/src/handlers/pf2/` |
| 6 | `fix(client): reconnect WebSocket after logout` | src/hooks/ | `npm run lint` |
| 7 | `fix(ui): make TurnStepper update during combat` | src/components/game/ | `npm run lint` |
| 8 | `fix(ui): make tutorial grid description match ruleset` | src/components/ui/Tutorial.tsx | `npm run lint` |
| 9 | `feat(ui): add victory/defeat screen on match completion` | src/components/game/ | `npm run lint` |
| 10 | `fix(ui): handle long names in initiative tracker` | src/components/game/ | `npm run lint` |
| 11 | `fix(ui): increase character name input width in editor` | src/components/armory/ | `npm run lint` |
| 12 | `test(e2e): add full PF2 session integration test` | e2e/ | `npm run test:e2e` |

---

## Success Criteria

### Verification Commands
```bash
npx vitest run                    # Expected: all tests pass
npm run lint                      # Expected: no errors
npm run build                     # Expected: compiles without errors
npm run test:e2e                  # Expected: PF2 full session test passes
```

### Final Checklist
- [x] AC correctly calculated with armor (not always 10)
- [x] Strike works on adjacent combatants after Stride
- [x] Combatants spawn on separate tiles
- [x] Dashboard stats update after match completion
- [x] Step action is functional
- [x] WebSocket reconnects after logout
- [x] TurnStepper updates during combat
- [x] Tutorial mentions correct grid type per ruleset
- [x] Victory screen appears at match end
- [x] Long names handled in all UI components
- [x] All existing tests still pass (no regressions)
- [x] Full e2e Playwright test passes
