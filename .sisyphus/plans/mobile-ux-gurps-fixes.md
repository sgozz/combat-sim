# Mobile UX Fixes for GURPS Players

## TL;DR

> **Quick Summary**: Fix 14 mobile UX defects discovered during GURPS playtesting on a 390×844 (iPhone 14) viewport. Issues range from critical gameplay blockers (can't select targets, wrong ruleset) to polish items (missing FP display, abbreviation tooltips).
> 
> **Deliverables**:
> - Ruleset selection persisted correctly through auth flow
> - Tappable initiative tracker for target selection on mobile
> - Auto-centering camera on active combatant
> - Navigation fixes (Quick Create → lobby, Create Match modal scroll)
> - Combat log accessible on mobile
> - FP display, feedback improvements, and polish fixes
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 (ruleset fix) → Task 2 (initiative tracker tappable) → Task 6 (combat feedback)

---

## Context

### Original Request
Fix all mobile UX defects found during a GURPS playtesting session. The tester played through the complete flow (homepage → lobby → character creation → combat) on a 390×844 mobile viewport and identified 14 issues of varying severity.

### Interview Summary
**Key Discussions**:
- Target selection approach: User chose "tap on initiative tracker" — simplest, no new components needed
- Camera orientation: User chose "auto-center camera" — camera centers on active combatant at turn start, no minimap needed
- Test strategy: User chose "tests-after" — implement fixes first, write unit tests for logic changes, Playwright QA for UI

**Research Findings**:
- `selectedTargetId` lives in `App.tsx:62`, only set via `handleCombatantClick` triggered by canvas clicks
- `InitiativeTracker.tsx` is purely display — no click handlers at all
- `CameraControls.tsx` already has `targetPosition` prop and `focusPositions` — can be extended for auto-center
- `CharacterEditor.tsx:49,65,69` hardcodes `navigate('/armory')` — root cause of Quick Create not returning to lobby
- `"Sincronizzazione..."` is at `PlayerList.tsx:33` — single hardcoded Italian string
- `GurpsActionBar.tsx` shows HP but not FP in the char-btn
- `CombatToast.tsx` exists and is rendered in `GameScreen.tsx:160` — may need mobile visibility fix

### Self-Review Gap Analysis
**Identified Gaps (addressed)**:
- The initiative tracker change affects BOTH rulesets (GURPS and PF2) — all fixes should be ruleset-agnostic where possible
- Camera auto-center must not override manual user panning — only trigger on turn change
- FP display is GURPS-specific — PF2 has different secondary resources
- The "Sincronizzazione..." fix needs a proper English replacement, not just removal
- Quick Create return-to-lobby needs the lobby URL to be stored/passed through navigation

---

## Work Objectives

### Core Objective
Make the mobile GURPS combat experience fully playable by fixing 14 UX defects, prioritizing gameplay-blocking issues first.

### Concrete Deliverables
- Fixed ruleset persistence through auth in `App.tsx` / `useAuth.ts`
- Clickable initiative tracker entries in `InitiativeTracker.tsx`
- Camera auto-center logic in `CameraControls.tsx` / `ArenaScene.tsx`
- Navigation fix in `CharacterEditor.tsx` (return to lobby when coming from lobby)
- Scrollable Create Match modal in `CreateMatchDialog.css`
- Mobile combat log in `GameScreen.tsx` / `ActionBar`
- FP display in `GurpsActionBar.tsx`
- Various polish fixes across 5+ files

### Definition of Done
- [ ] All 14 defects verified fixed via Playwright at 390×844
- [ ] `npx vitest run` passes with no regressions
- [ ] `npm run build` succeeds
- [ ] No new TypeScript errors

### Must Have
- Target selection works on mobile without touching 3D canvas
- Ruleset selection on landing page carries through to match creation
- Camera auto-centers on active combatant each turn
- Quick Create from lobby returns to lobby after save

### Must NOT Have (Guardrails)
- **Do NOT add a minimap component** — camera auto-center is the chosen solution
- **Do NOT change desktop UI behavior** — all changes scoped to mobile breakpoint or additive
- **Do NOT modify combat rules or server logic** — purely client-side UI fixes
- **Do NOT refactor ActionBar architecture** — fix within existing pattern
- **Do NOT add new npm dependencies** — use existing libs only
- **Do NOT change the Three.js rendering pipeline** — defect #6 (canvas instability) is addressed by CSS, not by changing WebGL

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks verified by agent using Playwright at 390×844 viewport.

### Test Decision
- **Infrastructure exists**: YES (Vitest + happy-dom)
- **Automated tests**: Tests-after (unit tests for logic, Playwright for UI)
- **Framework**: Vitest

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)
Every task includes Playwright scenarios at mobile viewport (390×844). The agent will resize the browser, navigate the full flow, and take screenshots as evidence.

**Verification Tool by Deliverable Type:**

| Type | Tool | How Agent Verifies |
|------|------|-------------------|
| UI/ActionBar | Playwright | Navigate, resize to 390×844, interact, assert DOM, screenshot |
| Navigation | Playwright | Click through flow, assert URL changes |
| Camera | Playwright + evaluate | Check Three.js camera position via JS evaluate |
| CSS fixes | Playwright | Screenshot comparison, element visibility checks |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — no dependencies):
├── Task 1: Fix ruleset selection persistence
├── Task 4: Fix Quick Create → lobby navigation
├── Task 5: Fix Create Match modal scroll on mobile
└── Task 11: Fix "Sincronizzazione..." text

Wave 2 (After Wave 1):
├── Task 2: Make initiative tracker tappable for target selection
├── Task 3: Auto-center camera on active combatant
└── Task 8: Add mobile combat log access

Wave 3 (After Wave 2):
├── Task 7: Improve hit location selector for mobile
├── Task 9: Add turn change feedback
├── Task 10: (merged into Task 2)
├── Task 13: Add FP to GURPS action bar
└── Task 14: Add long-press tooltip to maneuvers

Wave 4 (After Wave 3):
├── Task 6: Fix Three.js canvas instability for touch
├── Task 12: Better default character name
└── Task 15: Run full test suite + Playwright integration smoke test
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | None | 4, 5, 11 |
| 2 | None | 9 | 3, 8 |
| 3 | None | None | 2, 8 |
| 4 | None | None | 1, 5, 11 |
| 5 | None | None | 1, 4, 11 |
| 6 | 2 | None | 12 |
| 7 | 2 | None | 9, 13, 14 |
| 8 | None | None | 2, 3 |
| 9 | 2 | None | 7, 13, 14 |
| 11 | None | None | 1, 4, 5 |
| 12 | None | None | 6 |
| 13 | None | None | 7, 9, 14 |
| 14 | None | None | 7, 9, 13 |
| 15 | All | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended |
|------|-------|------------|
| 1 | 1, 4, 5, 11 | 4 parallel agents, category="quick" |
| 2 | 2, 3, 8 | 3 parallel agents, category="visual-engineering" / "unspecified-low" |
| 3 | 7, 9, 13, 14 | 4 parallel agents, category="quick" |
| 4 | 6, 12, 15 | 3 parallel, final QA sequential |

---

## TODOs

---

- [ ] 1. Fix ruleset selection not persisting through auth

  **What to do**:
  - Investigate how the landing page ruleset selection (GURPS vs PF2) flows into the authenticated session.
  - The landing page in `App.tsx` lets users select a ruleset, but after "Enter Arena" the session defaults to PF2.
  - Find where the selected ruleset is stored before auth and ensure it's passed to `setPreferredRuleset` after authentication.
  - Likely fix: store selected ruleset in localStorage before auth, read it after auth and call `setPreferredRuleset` with it.

  **Must NOT do**:
  - Do not change the WebSocket protocol for `set_preferred_ruleset`
  - Do not change server-side default ruleset logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single focused fix in auth flow, likely 1-2 files
  - **Skills**: [`playwright`]
    - `playwright`: Needed for QA verification of the full auth → home flow

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 4, 5, 11)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/App.tsx:62` — `selectedTargetId` state (nearby is the auth/ruleset flow)
  - `src/hooks/useAuth.ts:92-94` — `setPreferredRuleset` sends `set_preferred_ruleset` message over WebSocket
  - `src/App.tsx:104` — `handleCreateMatch` where ruleset gets used for match creation
  - `src/components/Dashboard.tsx` — Home screen where the ruleset badge (PF2/GURPS) is shown in header

  **Acceptance Criteria**:
  - [ ] Select GURPS on landing page → Enter Arena → header badge shows "GURPS"
  - [ ] Select GURPS on landing page → Enter Arena → New Match → modal shows "GURPS 4e"
  - [ ] Refresh page → ruleset persists (stored in localStorage or server session)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Ruleset selection persists through auth
    Tool: Playwright
    Preconditions: Dev server running on localhost:5173
    Steps:
      1. Set viewport to 390×844
      2. Navigate to http://localhost:5173
      3. Click button containing "GURPS 4e"
      4. Click "Enter Arena"
      5. Wait for /home URL
      6. Assert: header contains text "GURPS" (not "PF2")
      7. Click "New Match"
      8. Assert: ruleset field shows "GURPS 4e"
      9. Screenshot: .sisyphus/evidence/task-1-ruleset-persists.png
    Expected Result: GURPS selection carries through auth to match creation
    Evidence: .sisyphus/evidence/task-1-ruleset-persists.png
  ```

  **Commit**: YES
  - Message: `fix(auth): persist ruleset selection through auth flow`
  - Files: `src/App.tsx`, `src/hooks/useAuth.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 2. Make initiative tracker tappable for target selection (fixes #2 and #10)

  **What to do**:
  - Add an `onCombatantClick` prop to `InitiativeTracker` component
  - Make each combatant entry in the tracker clickable (wrap in button or add onClick)
  - On tap, call `onCombatantClick(playerId)` which already exists in `App.tsx` and propagates to `setSelectedTargetId`
  - Visually indicate the selected target (highlight border, subtle glow)
  - Only allow tapping enemies (not self) — filter by `playerId !== currentPlayerId`
  - Add mobile-specific touch feedback (active state, tap highlight)
  - Update `GameScreen.tsx` to pass `onCombatantClick` and `selectedTargetId` down to `InitiativeTracker`

  **Must NOT do**:
  - Do not remove the existing canvas click-to-select functionality
  - Do not change the initiative tracker layout or reorder combatants
  - Do not add a separate "target picker" popup

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Touch interaction design + visual feedback for selected state
  - **Skills**: [`playwright`, `frontend-ui-ux`]
    - `playwright`: For mobile testing of tap interactions
    - `frontend-ui-ux`: For designing the tappable state and selected highlight

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 8)
  - **Blocks**: Tasks 7, 9 (need target selection working first)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/game/InitiativeTracker.tsx:4-10` — Current purely-display component, needs click handler added
  - `src/components/game/GameScreen.tsx:32,60,191` — Where `onCombatantClick` is passed to ArenaScene but NOT to InitiativeTracker
  - `src/App.tsx:62` — `const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)` — state to set
  - `src/App.tsx:173-176` — `handleCombatantClick` handler that toggles selection

  **API/Type References**:
  - `src/components/arena/ArenaScene.tsx:28` — `onCombatantClick: (playerId: string) => void` — same signature to reuse

  **Acceptance Criteria**:
  - [ ] Initiative tracker entries are tappable on mobile (cursor: pointer, active state)
  - [ ] Tapping enemy name in tracker sets `selectedTargetId`
  - [ ] Tapping same enemy again deselects (toggle behavior matching existing canvas click)
  - [ ] Self-entry (own combatant) is NOT tappable as target
  - [ ] Selected enemy has visible highlight in initiative bar
  - [ ] After selecting via tracker, Attack button becomes active in action bar

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Tap enemy in initiative tracker to select target
    Tool: Playwright
    Preconditions: Game in progress, player's turn, Attack maneuver selected
    Steps:
      1. Set viewport to 390×844
      2. Navigate to active game URL
      3. Select Attack maneuver via action bar
      4. Assert: hint shows "Tap enemy to target"
      5. Click on "Bot 4" text in initiative tracker bar
      6. Assert: hint changes (no longer "Tap enemy to target")
      7. Assert: Attack button appears in action bar (action-bar-btn primary)
      8. Screenshot: .sisyphus/evidence/task-2-target-selected.png
    Expected Result: Enemy selected via initiative tracker, attack button active
    Evidence: .sisyphus/evidence/task-2-target-selected.png

  Scenario: Own combatant is not selectable as target
    Tool: Playwright
    Preconditions: Game in progress, player's turn
    Steps:
      1. Click on own combatant name ("New Character") in initiative tracker
      2. Assert: hint still shows "Tap enemy to target" (unchanged)
      3. Assert: no primary attack button visible
    Expected Result: Self-targeting prevented
    Evidence: .sisyphus/evidence/task-2-no-self-target.png
  ```

  **Commit**: YES
  - Message: `feat(mobile): make initiative tracker tappable for target selection`
  - Files: `src/components/game/InitiativeTracker.tsx`, `src/components/game/GameScreen.tsx`
  - Pre-commit: `npx vitest run`

---

- [ ] 3. Auto-center camera on active combatant at turn start

  **What to do**:
  - Modify `CameraControls.tsx` to smoothly animate the camera to center on the active combatant when the turn changes
  - Use the existing `targetPosition` prop that already receives the active combatant's position
  - Add a `cameraMode` that triggers auto-centering on turn change (e.g., switch from `'free'` to `'follow'` briefly)
  - The camera should smoothly lerp to the target, then return to free mode so the player can pan
  - Also center between player and target when `selectedTargetId` changes (to show both combatants)
  - Ensure the auto-center doesn't interrupt active user panning (only trigger on state changes)

  **Must NOT do**:
  - Do not lock the camera permanently — user must be able to freely orbit after auto-center
  - Do not add a minimap component
  - Do not change the camera zoom level, only position/target

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 3D camera math with lerp animation, needs Three.js knowledge
  - **Skills**: [`playwright`]
    - `playwright`: For QA verification

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 8)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/arena/CameraControls.tsx:10-23` — Existing camera controller with OrbitControls integration
  - `src/components/arena/ArenaScene.tsx:215-216` — `<CameraControls targetPosition={activeCombatantPosition} focusPositions={focusPositions} mode={cameraMode} />` + `<OrbitControls makeDefault />`
  - `src/components/game/GameScreen.tsx:188` — `cameraMode="free"` hardcoded — needs dynamic value

  **External References**:
  - `@react-three/drei` OrbitControls API — for programmatic camera.lookAt and position changes

  **Acceptance Criteria**:
  - [ ] When turn changes to player, camera smoothly centers on player's combatant
  - [ ] When target is selected, camera adjusts to show both player and target
  - [ ] After auto-center completes, player can freely orbit/pan
  - [ ] Auto-center does not trigger during active user panning
  - [ ] Camera transition is smooth (lerp), not instant

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Camera centers on active combatant at turn start
    Tool: Playwright (evaluate JS)
    Preconditions: Game in progress, bot's turn ending
    Steps:
      1. Wait for player's turn to start
      2. Evaluate: get camera.position from Three.js scene
      3. Evaluate: get active combatant world position
      4. Assert: camera is looking approximately at combatant position (within tolerance)
      5. Screenshot: .sisyphus/evidence/task-3-camera-centered.png
    Expected Result: Camera is centered on active combatant
    Evidence: .sisyphus/evidence/task-3-camera-centered.png
  ```

  **Commit**: YES
  - Message: `feat(mobile): auto-center camera on active combatant at turn start`
  - Files: `src/components/arena/CameraControls.tsx`, `src/components/arena/ArenaScene.tsx`, `src/components/game/GameScreen.tsx`
  - Pre-commit: `npx vitest run`

---

- [ ] 4. Fix Quick Create → Save returning to Armory instead of lobby

  **What to do**:
  - In `CharacterEditor.tsx`, the save handler at lines 49/65/69 hardcodes `navigate('/armory')`
  - When coming from the lobby (URL has `?from=lobby&lobbyId=...` or referrer is `/lobby/*`), navigate back to the lobby instead
  - Use the URL search params or `location.state` to pass a return path
  - In `LobbyScreen.tsx:150`, when navigating to Quick Create, add a return path parameter: `navigate(\`/armory/new?ruleset=${match.rulesetId}&returnTo=/lobby/${match.id}\`)`
  - In `CharacterEditor.tsx`, read `returnTo` from search params and use it if present

  **Must NOT do**:
  - Do not change navigation for "Edit" button in Armory page (only from lobby flow)
  - Do not change the save/create character logic itself

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small navigation fix, 2 files
  - **Skills**: [`playwright`]
    - `playwright`: For QA flow testing

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 5, 11)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/armory/CharacterEditor.tsx:49,65,69` — Hardcoded `navigate('/armory')` calls
  - `src/components/lobby/LobbyScreen.tsx:150` — `navigate(\`/armory/new?ruleset=${match.rulesetId}\`)` — where Quick Create navigates from
  - `src/components/lobby/LobbyScreen.tsx:152` — `navigate('/armory')` — where "Create Character" navigates from
  - `src/components/armory/CharacterArmory.tsx:74` — Back button in Armory navigates to `/home`

  **Acceptance Criteria**:
  - [ ] From lobby: Quick Create → fill name → Save → navigates back to lobby (not Armory)
  - [ ] From lobby: Create Character → Save → navigates back to lobby
  - [ ] From Armory page: Edit → Save → still navigates to Armory (unchanged)
  - [ ] From Armory page: New Character → Save → still navigates to Armory

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Quick Create from lobby returns to lobby after save
    Tool: Playwright
    Preconditions: Player in GURPS lobby with no character selected
    Steps:
      1. Set viewport to 390×844
      2. Navigate to lobby URL
      3. Click "+ Quick Create" button
      4. Assert: URL contains /armory/new
      5. Click "Save"
      6. Assert: URL contains /lobby/ (not /armory)
      7. Assert: character appears in the character selection list
      8. Screenshot: .sisyphus/evidence/task-4-returns-to-lobby.png
    Expected Result: Player returns to lobby with character available
    Evidence: .sisyphus/evidence/task-4-returns-to-lobby.png
  ```

  **Commit**: YES
  - Message: `fix(navigation): Quick Create from lobby returns to lobby after save`
  - Files: `src/components/armory/CharacterEditor.tsx`, `src/components/lobby/LobbyScreen.tsx`
  - Pre-commit: `npx vitest run`

---

- [ ] 5. Fix Create Match modal buttons cut off on mobile

  **What to do**:
  - The Create Match dialog content overflows the viewport at 390×844 — the Cancel/Create buttons are below the fold
  - Add proper scrolling to the dialog: `overflow-y: auto`, `max-height: calc(100vh - safe-area)` or similar
  - Alternatively, make the dialog fullscreen on mobile with a sticky footer for the buttons
  - Ensure the Scenario cards at the bottom and the action buttons are always reachable

  **Must NOT do**:
  - Do not change the dialog content or fields
  - Do not remove the Scenario picker

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure CSS fix in one file
  - **Skills**: [`playwright`, `frontend-ui-ux`]
    - `playwright`: For mobile viewport verification
    - `frontend-ui-ux`: For proper mobile modal scroll patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 4, 11)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/dashboard/CreateMatchDialog.tsx:14` — Dialog component
  - `src/components/dashboard/CreateMatchDialog.css` — Dialog styles (need mobile media query additions)

  **Acceptance Criteria**:
  - [ ] At 390×844, all dialog content is scrollable
  - [ ] Cancel and Create Match buttons are visible (either via scroll or sticky footer)
  - [ ] Scenario cards are fully visible and selectable

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Create Match modal is fully scrollable on mobile
    Tool: Playwright
    Preconditions: Logged in, on home page, GURPS selected
    Steps:
      1. Set viewport to 390×844
      2. Click "New Match"
      3. Assert: "Create New Match" heading visible
      4. Scroll to bottom of dialog
      5. Assert: "Create Match" button is visible and clickable
      6. Assert: "Cancel" button is visible
      7. Screenshot: .sisyphus/evidence/task-5-modal-scrollable.png
    Expected Result: All dialog content accessible via scroll
    Evidence: .sisyphus/evidence/task-5-modal-scrollable.png
  ```

  **Commit**: YES (groups with Task 11)
  - Message: `fix(mobile): make Create Match dialog scrollable on small viewports`
  - Files: `src/components/dashboard/CreateMatchDialog.css`
  - Pre-commit: `npx vitest run`

---

- [ ] 6. Reduce Three.js canvas impact on touch stability

  **What to do**:
  - The Three.js canvas renders continuously, causing `requestAnimationFrame` to fire every frame
  - This makes the DOM elements on top "not stable" for touch input
  - Add `touch-action: manipulation` and `will-change: transform` to the action bar container to create a separate compositing layer
  - Consider adding `pointer-events: none` to the canvas when UI overlays are open (maneuver picker, character sheet)
  - In the action-bar CSS, add `transform: translateZ(0)` to force GPU layer separation from the canvas
  - Optionally, investigate adding `frameloop="demand"` to the `<Canvas>` component to reduce unnecessary renders

  **Must NOT do**:
  - Do not change the Three.js rendering pipeline
  - Do not reduce canvas resolution or quality
  - Do not break the canvas click-to-select functionality

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: CSS layer optimization + minor Canvas config
  - **Skills**: [`playwright`]
    - `playwright`: For stability testing

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 12, 15)
  - **Blocks**: None
  - **Blocked By**: Task 2 (need overlay detection for pointer-events toggling)

  **References**:
  - `src/components/action-bar/styles.css:30-52` — Action bar CSS (add GPU layer hints)
  - `src/components/arena/ArenaScene.tsx:64` — Canvas component setup
  - `src/components/game/GameScreen.tsx` — Where canvas and action bar coexist

  **Acceptance Criteria**:
  - [ ] Action bar buttons respond to taps without delay
  - [ ] Maneuver picker opens reliably on first tap
  - [ ] No "element not stable" issues when interacting with UI

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Action bar buttons respond reliably
    Tool: Playwright
    Preconditions: Game in progress, player's turn
    Steps:
      1. Set viewport to 390×844
      2. Click Maneuver button
      3. Assert: maneuver picker opens (action-bar-maneuvers visible)
      4. Click "Attack" in picker
      5. Assert: maneuver selected, picker closes
      6. Repeat 3 times to verify consistency
    Expected Result: All taps register correctly
    Evidence: .sisyphus/evidence/task-6-tap-reliability.png
  ```

  **Commit**: YES
  - Message: `fix(mobile): improve touch stability over Three.js canvas`
  - Files: `src/components/action-bar/styles.css`, `src/components/game/GameScreen.tsx`
  - Pre-commit: `npx vitest run`

---

- [ ] 7. Improve hit location selector for mobile

  **What to do**:
  - The hit location body diagram (config slot) takes up too much vertical space on mobile and the penalty numbers are hard to tap
  - Make the tappable areas larger (min 44×44px touch targets)
  - Consider a simplified list/grid view for mobile instead of the body diagram, or make the diagram zoomable
  - Adjust the `action-bar-config-slot` max-height for mobile to leave enough room for the action bar below

  **Must NOT do**:
  - Do not remove the hit location selector entirely
  - Do not change the hit location penalty values

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Touch target sizing + mobile layout optimization
  - **Skills**: [`playwright`, `frontend-ui-ux`]
    - `playwright`: For mobile viewport testing
    - `frontend-ui-ux`: For touch-friendly hit location design

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 13, 14)
  - **Blocks**: None
  - **Blocked By**: Task 2

  **References**:
  - `src/components/action-bar/styles.css:328-348` — `.action-bar-config-slot` positioning and sizing
  - `src/components/game/shared/rulesetUiSlots.ts` — Where `renderActionConfiguration` is registered for GURPS
  - `src/components/rulesets/gurps/GurpsActionBar.tsx:311-329` — Where config slot is rendered

  **WHY Each Reference Matters**:
  - The config slot CSS controls the overlay size — needs mobile-specific max-height
  - The rulesetUiSlots controls what renders inside — may need a mobile variant
  - The GurpsActionBar controls when it appears — state management

  **Acceptance Criteria**:
  - [ ] Hit location buttons have minimum 44×44px touch targets
  - [ ] Config slot doesn't obscure more than 50% of the screen
  - [ ] All hit locations are selectable via tap

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Hit location selector is usable on mobile
    Tool: Playwright
    Preconditions: Game in progress, Attack maneuver selected, target selected
    Steps:
      1. Set viewport to 390×844
      2. Assert: hit location config slot is visible
      3. Click on a specific hit location (e.g., "head" area / -7 penalty)
      4. Assert: selected location updates to "HEAD"
      5. Assert: action bar is still visible below the config slot
      6. Screenshot: .sisyphus/evidence/task-7-hit-location.png
    Expected Result: Hit locations tappable, action bar not fully obscured
    Evidence: .sisyphus/evidence/task-7-hit-location.png
  ```

  **Commit**: YES
  - Message: `fix(mobile): improve hit location selector touch targets and sizing`
  - Files: UI slot component, `src/components/action-bar/styles.css`
  - Pre-commit: `npx vitest run`

---

- [ ] 8. Add mobile combat log access

  **What to do**:
  - On desktop, `CombatLog` renders in the right panel. On mobile, the right panel has `display: none`.
  - `CombatToast` already renders floating messages in `GameScreen.tsx:160` — verify it's visible on mobile
  - Add a tappable "📜 Log" button to the action bar that opens a scrollable overlay with the full combat log
  - Reuse the existing `action-bar-maneuvers` overlay pattern (positioned above action bar, scrollable, with backdrop)
  - Show the last 20 log entries with timestamps

  **Must NOT do**:
  - Do not show the desktop right panel on mobile
  - Do not auto-popup the log — only on tap

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: New mobile overlay component with scroll
  - **Skills**: [`playwright`, `frontend-ui-ux`]
    - `playwright`: For testing overlay behavior
    - `frontend-ui-ux`: For log overlay design

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/game/GameScreen.tsx:160` — CombatToast already rendered
  - `src/components/game/CombatToast.tsx:11,41` — Toast component with logs prop
  - `src/components/rulesets/gurps/GurpsActionBar.tsx:429-457` — Pattern for overlay above action bar (showManeuvers)
  - `src/components/action-bar/styles.css:270-290` — `.action-bar-maneuvers` overlay CSS to reuse

  **Acceptance Criteria**:
  - [ ] "Log" button visible in action bar on mobile
  - [ ] Tapping "Log" opens scrollable overlay with combat history
  - [ ] Tapping backdrop closes the log
  - [ ] Log shows opponent's actions (what bot did last turn)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Combat log accessible on mobile
    Tool: Playwright
    Preconditions: Game in progress, at least 1 round completed
    Steps:
      1. Set viewport to 390×844
      2. Open character sheet panel (tap 👤 button)
      3. Close it, look for Log button
      4. Tap Log button
      5. Assert: overlay appears with combat log entries
      6. Assert: log contains text about previous round actions
      7. Screenshot: .sisyphus/evidence/task-8-combat-log.png
    Expected Result: Combat log is readable on mobile
    Evidence: .sisyphus/evidence/task-8-combat-log.png
  ```

  **Commit**: YES
  - Message: `feat(mobile): add combat log overlay to action bar`
  - Files: `src/components/rulesets/gurps/GurpsActionBar.tsx`, `src/components/rulesets/pf2/PF2ActionBar.tsx`
  - Pre-commit: `npx vitest run`

---

- [ ] 9. Add feedback after End Turn / bot's turn

  **What to do**:
  - When the player ends their turn, show a brief toast/notification summarizing what happened
  - When the bot's turn completes, show what the bot did (e.g., "Bot 4 chose Move and stepped to hex (3,2)")
  - CombatToast already exists — ensure it's positioned correctly on mobile (not behind the action bar)
  - Parse the combat log entries that arrive during the bot's turn and display them as toasts

  **Must NOT do**:
  - Do not block the UI during the bot's turn
  - Do not add server-side changes

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Toast positioning + log parsing, no new components
  - **Skills**: [`playwright`]
    - `playwright`: For testing toast visibility

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 13, 14)
  - **Blocks**: None
  - **Blocked By**: Task 2

  **References**:
  - `src/components/game/CombatToast.tsx:11-41` — Existing toast component
  - `src/components/game/GameScreen.tsx:160` — Where CombatToast is rendered
  - `src/components/action-bar/styles.css` — May need z-index adjustment for toasts over action bar

  **Acceptance Criteria**:
  - [ ] After End Turn, toast shows brief summary
  - [ ] After bot's turn, toast shows what bot did
  - [ ] Toasts are visible on mobile (not hidden behind action bar)
  - [ ] Toasts auto-dismiss after 3-4 seconds

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Turn feedback visible on mobile
    Tool: Playwright
    Preconditions: Game in progress, player's turn
    Steps:
      1. Set viewport to 390×844
      2. Select maneuver → End turn
      3. Wait for bot's turn to complete (up to 5s)
      4. Assert: toast notification visible above action bar
      5. Assert: toast contains actionable information (bot's action)
      6. Screenshot: .sisyphus/evidence/task-9-turn-feedback.png
    Expected Result: Player sees what happened during bot's turn
    Evidence: .sisyphus/evidence/task-9-turn-feedback.png
  ```

  **Commit**: YES
  - Message: `fix(mobile): ensure combat toasts visible above action bar`
  - Files: `src/components/game/CombatToast.tsx`, `src/components/game/GameScreen.tsx`
  - Pre-commit: `npx vitest run`

---

- [ ] 11. Fix "Sincronizzazione..." hardcoded Italian text

  **What to do**:
  - Replace `"Sincronizzazione..."` with `"Syncing..."` in `PlayerList.tsx:33`
  - This is a single hardcoded string, no i18n system exists

  **Must NOT do**:
  - Do not add an internationalization framework for this single string

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single line change
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 4, 5)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/lobby/PlayerList.tsx:33` — `<span className="player-list-syncing-text">Sincronizzazione...</span>`

  **Acceptance Criteria**:
  - [ ] Text shows "Syncing..." instead of "Sincronizzazione..."

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Syncing text is in English
    Tool: Playwright
    Preconditions: Player joins a lobby
    Steps:
      1. Navigate to lobby
      2. Evaluate: check text content of .player-list-syncing-text
      3. Assert: contains "Syncing" (not "Sincronizzazione")
    Expected Result: English text shown
    Evidence: Terminal output
  ```

  **Commit**: YES (groups with Task 5)
  - Message: `fix(i18n): replace Italian syncing text with English`
  - Files: `src/components/lobby/PlayerList.tsx`
  - Pre-commit: `npx vitest run`

---

- [ ] 12. Better default character name for Quick Create

  **What to do**:
  - When Quick Create is used, the character name defaults to "New Character"
  - Change the default to the player's username (already available from the auth context)
  - If username is not available, use a random GURPS-flavored name (e.g., "Warrior", "Sir Valeros")
  - The name input should be pre-filled but editable

  **Must NOT do**:
  - Do not add a name generation library
  - Do not block character creation on name input

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small default value change, 1-2 files
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 6, 15)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/armory/CharacterEditor.tsx` — Where character name is initialized
  - `src/components/lobby/LobbyScreen.tsx:150` — Where Quick Create navigation happens (could pass player name as param)
  - `shared/rulesets/gurps/index.ts` — `createCharacter(name)` function

  **Acceptance Criteria**:
  - [ ] Quick Create from lobby pre-fills player's username as character name
  - [ ] Name field is still editable
  - [ ] Direct "New Character" from Armory uses a reasonable default

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Quick Create uses player name
    Tool: Playwright
    Preconditions: Logged in as "Valeros", in lobby
    Steps:
      1. Click "+ Quick Create"
      2. Assert: name field contains "Valeros" (not "New Character")
    Expected Result: Player name pre-filled
    Evidence: Terminal output
  ```

  **Commit**: YES
  - Message: `fix(ux): pre-fill character name with player username on Quick Create`
  - Files: `src/components/armory/CharacterEditor.tsx`, `src/components/lobby/LobbyScreen.tsx`
  - Pre-commit: `npx vitest run`

---

- [ ] 13. Add Fatigue Points (FP) to GURPS action bar

  **What to do**:
  - In `GurpsActionBar.tsx`, the char-btn shows HP (10/10) but not FP
  - Add FP display next to or below HP in the character button
  - Use a different color for the FP bar (e.g., blue/cyan) vs HP (green/red)
  - FP data is available: `playerCombatant.currentFP` and `playerCharacter.derived.fatiguePoints`
  - Keep it compact — "HP 10 FP 10" or two small bars stacked

  **Must NOT do**:
  - Do not add FP to PF2 action bar (PF2 doesn't use FP the same way)
  - Do not increase the char-btn width significantly

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small UI addition in one component
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: For compact dual-bar design

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 9, 14)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/rulesets/gurps/GurpsActionBar.tsx:88-91` — HP calculation and display
  - `src/components/rulesets/gurps/GurpsActionBar.tsx:458-481` — char-btn HTML with HP bar
  - `shared/rulesets/gurps/types.ts` — `GurpsCombatantState` type with `currentFP` field

  **Acceptance Criteria**:
  - [ ] GURPS action bar char-btn shows both HP and FP
  - [ ] FP bar has distinct color from HP bar
  - [ ] Both values update in real-time during combat

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: FP visible in action bar
    Tool: Playwright
    Preconditions: GURPS game in progress
    Steps:
      1. Set viewport to 390×844
      2. Snapshot action bar area
      3. Assert: text contains "FP" or fatigue value
      4. Assert: char-btn contains two bar elements (HP + FP)
    Expected Result: Both HP and FP visible
    Evidence: .sisyphus/evidence/task-13-fp-display.png
  ```

  **Commit**: YES
  - Message: `feat(gurps): add FP display to mobile action bar`
  - Files: `src/components/rulesets/gurps/GurpsActionBar.tsx`, `src/components/action-bar/styles.css`
  - Pre-commit: `npx vitest run`

---

- [ ] 14. Add long-press tooltip for maneuver abbreviations

  **What to do**:
  - The maneuver buttons show abbreviated labels (M&A, Eval, Conc) that may confuse players
  - Add a `title` attribute with the full name and description for desktop hover
  - For mobile: on long-press (500ms), show a tooltip overlay with the full maneuver name and 1-line description
  - Use a simple CSS tooltip or a minimal JS long-press handler
  - Apply to all maneuver buttons in the picker

  **Must NOT do**:
  - Do not change the abbreviated button labels themselves
  - Do not add a tooltip library

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple long-press + tooltip, no major architecture
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: For tooltip design

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 9, 13)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/rulesets/gurps/GurpsActionBar.tsx:429-457` — Maneuver picker buttons
  - `shared/rulesets/gurps/ui.ts` — `getManeuvers()` returns maneuver data with full labels
  - `shared/rulesets/Ruleset.ts` — `ManeuverDef` type with `label`, `shortLabel`, `description` fields

  **Acceptance Criteria**:
  - [ ] Long-press (500ms) on a maneuver button shows full name + description
  - [ ] Tooltip disappears on release
  - [ ] Regular tap still selects the maneuver normally
  - [ ] Desktop: hover shows title attribute

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Long-press shows maneuver tooltip
    Tool: Playwright
    Preconditions: Game in progress, maneuver picker open
    Steps:
      1. Set viewport to 390×844
      2. Open maneuver picker
      3. Long-press on "M&A" button (500ms hold)
      4. Assert: tooltip/overlay appears with "Move & Attack" and description
      5. Release press
      6. Assert: tooltip disappears
    Expected Result: Full maneuver info shown on long-press
    Evidence: .sisyphus/evidence/task-14-tooltip.png
  ```

  **Commit**: YES
  - Message: `feat(mobile): add long-press tooltip for maneuver descriptions`
  - Files: `src/components/rulesets/gurps/GurpsActionBar.tsx`, `src/components/action-bar/styles.css`
  - Pre-commit: `npx vitest run`

---

- [ ] 15. Final integration test + full test suite

  **What to do**:
  - Run `npx vitest run` to verify all existing tests still pass
  - Run `npm run build` to verify no TypeScript errors
  - Run a full Playwright smoke test through the complete mobile GURPS flow:
    1. Homepage → select GURPS → Enter Arena
    2. Create Match → verify GURPS → Create
    3. Quick Create character → Save → verify returns to lobby
    4. Select character → Add bot → Start Match
    5. Select maneuver via picker → Select target via initiative tracker
    6. Verify camera centers → Attack → End turn
    7. Verify bot turn feedback → Next round
  - Capture screenshots at each step as evidence

  **Must NOT do**:
  - Do not fix new bugs found — only report them

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: End-to-end integration verification
  - **Skills**: [`playwright`]
    - `playwright`: For full mobile flow testing

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (final task)
  - **Blocks**: None
  - **Blocked By**: ALL previous tasks

  **References**:
  - All files modified in previous tasks

  **Acceptance Criteria**:
  - [ ] `npx vitest run` — all tests pass
  - [ ] `npm run build` — succeeds with no errors
  - [ ] Full Playwright smoke test passes at 390×844
  - [ ] Screenshots captured at each key step

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Complete mobile GURPS flow
    Tool: Playwright
    Preconditions: Both servers running
    Steps:
      1-7 as described above
    Expected Result: All 14 defects fixed, full flow works
    Evidence: .sisyphus/evidence/task-15-*.png (multiple screenshots)
  ```

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task(s) | Message | Key Files |
|---------------|---------|-----------|
| 1 | `fix(auth): persist ruleset selection through auth flow` | App.tsx, useAuth.ts |
| 2 | `feat(mobile): make initiative tracker tappable for target selection` | InitiativeTracker.tsx, GameScreen.tsx |
| 3 | `feat(mobile): auto-center camera on active combatant` | CameraControls.tsx, ArenaScene.tsx |
| 4 | `fix(navigation): Quick Create from lobby returns to lobby after save` | CharacterEditor.tsx, LobbyScreen.tsx |
| 5+11 | `fix(mobile): Create Match dialog scroll + syncing text` | CreateMatchDialog.css, PlayerList.tsx |
| 6 | `fix(mobile): improve touch stability over Three.js canvas` | styles.css, GameScreen.tsx |
| 7 | `fix(mobile): improve hit location selector touch targets` | styles.css, config component |
| 8 | `feat(mobile): add combat log overlay to action bar` | GurpsActionBar.tsx, PF2ActionBar.tsx |
| 9 | `fix(mobile): combat toasts visible above action bar` | CombatToast.tsx |
| 12 | `fix(ux): pre-fill character name with player username` | CharacterEditor.tsx |
| 13 | `feat(gurps): add FP display to mobile action bar` | GurpsActionBar.tsx |
| 14 | `feat(mobile): long-press tooltip for maneuver descriptions` | GurpsActionBar.tsx, styles.css |

---

## Success Criteria

### Verification Commands
```bash
npx vitest run                    # All tests pass
npm run build                     # No TypeScript errors
npm run lint                      # No lint errors
```

### Final Checklist
- [ ] All 14 defects verified fixed at 390×844 viewport
- [ ] Desktop UI unchanged (no regressions)
- [ ] Both GURPS and PF2 rulesets work correctly
- [ ] All existing tests pass
- [ ] Build succeeds
