# Ruleset Lock — One-Time Selection

## TL;DR

> **Quick Summary**: Add one-time ruleset selection at login. After choosing GURPS or PF2, the entire app filters to that ruleset. Simplify all UIs that currently ask for ruleset choice.
> 
> **Deliverables**:
> - DB migration: `preferred_ruleset_id` on users table
> - Welcome Screen redesign with ruleset cards
> - Dashboard header ruleset badge + switch dialog
> - CreateMatchDialog simplified (no ruleset picker)
> - CharacterArmory simplified (no filter bar, no dropdown)
> - Server-side match filtering by user's preferred ruleset
> - Updated tests for all changes
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: DB migration → Server handlers → Client auth → UI components

---

## Context

### Original Request
User observed that choosing between GURPS and PF2 happens too many times (create match, new character, armory filter). Should be a one-time choice that tailors the entire experience.

### Interview Summary
**Key Discussions**:
- Ruleset chosen at registration, persisted server-side
- Two large illustrative cards on Welcome Screen
- Dashboard navbar has badge/button to switch ruleset
- All UIs that currently show ruleset selectors get simplified
- No cross-ruleset visibility for match lists
- Join-by-code IS allowed cross-ruleset (explicit intent)
- Spectating IS allowed cross-ruleset
- Switching ruleset with active matches is allowed (existing matches stay visible)

### Metis Review
**Identified Gaps** (addressed):
- Existing user migration → default to GURPS + toast
- Cross-ruleset join-by-code → allowed
- Active match behavior on switch → matches stay visible
- Spectating cross-ruleset → allowed
- Characters table has no ruleset_id column → filter in app code using data_json
- create_match should use server-side preferredRulesetId, not trust client

---

## Work Objectives

### Core Objective
Add `preferredRulesetId` to the user model and thread it through the entire app so that ruleset selection happens once at login and all subsequent UIs are simplified.

### Concrete Deliverables
- `preferred_ruleset_id` column on `users` table (DB migration)
- `preferredRulesetId` field on `User` type in `shared/types.ts`
- `register` message includes `preferredRulesetId`
- New `set_preferred_ruleset` server message for switching
- Welcome Screen with username + two ruleset cards
- Dashboard header with ruleset badge + switch dialog
- CreateMatchDialog without ruleset selector
- CharacterArmory without filter bar and without GURPS/PF2 dropdown
- Server filters `list_my_matches` and `list_public_matches` by preferred ruleset
- `loadCharactersByOwner` filters by preferred ruleset (app-level)

### Definition of Done
- [ ] New user registration includes ruleset selection
- [ ] Existing users default to GURPS on reconnect
- [ ] Create Match uses preferred ruleset automatically
- [ ] Armory shows only characters for preferred ruleset
- [ ] Match lists filtered by preferred ruleset
- [ ] Ruleset switchable from dashboard header
- [ ] `npx vitest run` passes
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes (no new errors)

### Must Have
- One-time ruleset selection at registration
- Server-side persistence of preference
- All UIs simplified to remove redundant ruleset choices
- Server-side filtering of match lists
- Ability to switch ruleset from dashboard

### Must NOT Have (Guardrails)
- Multi-ruleset per user (toggle per match)
- Ruleset-specific onboarding/tutorial
- Character migration between rulesets
- Fancy animations for the ruleset cards (simple CSS only)
- Rewriting CharacterArmory entirely (just remove filter/dropdown)
- Touching game/combat components (GameScreen, ArenaScene, HUD)
- Modifying bot logic (bots already derive ruleset from match)
- Adding `ruleset_id` column to `characters` table (filter in app code)
- New database tables

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: YES (Tests-after)
- **Framework**: Vitest + @testing-library/react

### Automated Verification

Each task includes executable verification via Vitest tests and build commands.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: DB migration + User type update
└── Task 2: Welcome Screen redesign (can stub preferredRulesetId)

Wave 2 (After Wave 1):
├── Task 3: Server handlers (register, auth, set_preferred_ruleset, match filtering)
├── Task 4: Client auth hook (store + expose preferredRulesetId)
└── Task 5: Dashboard header badge + switch dialog

Wave 3 (After Wave 2):
├── Task 6: CreateMatchDialog simplification
├── Task 7: CharacterArmory simplification
└── Task 8: Update all tests + final verification
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3, 4 | 2 |
| 2 | None | 5 | 1 |
| 3 | 1 | 4, 5, 6, 7 | - |
| 4 | 3 | 5, 6, 7 | - |
| 5 | 2, 4 | - | 6, 7 |
| 6 | 4 | 8 | 5, 7 |
| 7 | 4 | 8 | 5, 6 |
| 8 | 5, 6, 7 | None | None (final) |

---

## TODOs

- [x] 1. DB Migration + User Type Update

  **What to do**:
  - Add `preferred_ruleset_id TEXT NOT NULL DEFAULT 'gurps'` to `users` table in `server/src/db.ts`
  - Follow existing migration pattern (column check → ALTER TABLE) visible at `db.ts:76-105`
  - Add `preferredRulesetId: RulesetId` to `User` type in `shared/types.ts`
  - Update `createUser` in `db.ts` to accept and store `preferredRulesetId`
  - Update `findUserByUsername` and `findUserById` to include `preferred_ruleset_id` in SELECT and map to `preferredRulesetId`
  - Update `register` message type: `{ type: "register"; username: string; preferredRulesetId?: RulesetId }` (optional for backward compat)
  - Add `set_preferred_ruleset` to `ClientToServerMessage`: `{ type: "set_preferred_ruleset"; rulesetId: RulesetId }`

  **Must NOT do**:
  - Add `ruleset_id` column to `characters` table
  - Create new tables
  - Change `MatchState` or combat types

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 4
  - **Blocked By**: None

  **References**:
  - `server/src/db.ts:76-105` — Existing migration pattern (column check → ALTER TABLE)
  - `server/src/db.ts:42-60` — `createUser` function
  - `server/src/db.ts:62-74` — `findUserByUsername` and `findUserById`
  - `shared/types.ts:20-24` — `User` type definition
  - `shared/types.ts:104-124` — `ClientToServerMessage` union
  - `shared/types.ts:137-164` — `ServerToClientMessage` union

  **Acceptance Criteria**:
  - [ ] `preferred_ruleset_id` column exists on `users` table after server restart
  - [ ] `User` type includes `preferredRulesetId: RulesetId`
  - [ ] `createUser('test', false, 'pf2')` stores `preferred_ruleset_id = 'pf2'`
  - [ ] `findUserByUsername('test')` returns `{ ..., preferredRulesetId: 'pf2' }`
  - [ ] `npm run build` succeeds (both client and server)

  **Commit**: YES
  - Message: `feat(db): add preferred_ruleset_id to users table and User type`
  - Files: `server/src/db.ts`, `shared/types.ts`

---

- [x] 2. Welcome Screen Redesign

  **What to do**:
  - Redesign `WelcomeScreen` to show username input + two large ruleset cards + Enter button
  - Cards: "GURPS 4e" and "Pathfinder 2e" with brief description and visual distinction
  - Username and ruleset selection on one screen (not two steps)
  - `onComplete` callback receives `(username: string, preferredRulesetId: RulesetId)`
  - Enter button disabled until both username and ruleset selected
  - Add CSS for card layout (use existing design tokens, simple hover state)

  **Must NOT do**:
  - Animations, parallax, 3D effects
  - Multi-step wizard
  - Loading splash screens

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  - `src/components/WelcomeScreen.tsx` — Current welcome screen (username + Enter)
  - `src/App.tsx:200-201` — Where `onComplete={register}` is passed (must update to pass preferredRulesetId)
  - `src/hooks/useAuth.ts` — `register` function that sends the WebSocket message
  - `src/App.css` — Design tokens and CSS variables
  - `src/components/lobby/LobbyScreen.css:1-20` — Example of card/panel styling in this codebase

  **Acceptance Criteria**:
  - [ ] Welcome screen shows username input and two ruleset cards
  - [ ] Clicking a card selects it (visual highlight)
  - [ ] Enter button disabled when no ruleset selected
  - [ ] `onComplete` called with `(username, rulesetId)` on submit
  - [ ] Cards use existing CSS variables (no hardcoded colors)
  - [ ] Responsive: cards stack vertically on mobile

  **Commit**: YES
  - Message: `feat(ui): redesign welcome screen with ruleset selection cards`
  - Files: `src/components/WelcomeScreen.tsx`, `src/components/WelcomeScreen.css`

---

- [x] 3. Server Handlers Update

  **What to do**:
  - Update `register` handler to read `message.preferredRulesetId` and pass to `createUser`
  - Update `auth_ok` response to include `preferredRulesetId` in user object (already included if User type is updated)
  - Add `set_preferred_ruleset` handler: validates rulesetId, updates DB, sends confirmation
  - Update `create_match` handler: use `user.preferredRulesetId` from DB, ignore client-sent `rulesetId`
  - Update `getUserMatches` query to filter by `m.ruleset_id = ?` using user's preferredRulesetId (BUT keep active/paused matches visible regardless of ruleset)
  - Update `getPublicWaitingMatches` query to filter by user's preferredRulesetId
  - `join_match`: allow cross-ruleset join (no validation change needed)
  - `loadCharactersByOwner`: add optional `rulesetId` parameter, filter in app code after JSON parse
  - Update `list_characters` handler to pass user's preferredRulesetId to loadCharactersByOwner

  **Must NOT do**:
  - Block join_match for cross-ruleset (user confirmed: allow)
  - Block spectating for cross-ruleset
  - Modify combat/action handlers
  - Modify bot creation logic

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential after Task 1)
  - **Blocks**: Tasks 4, 5, 6, 7
  - **Blocked By**: Task 1

  **References**:
  - `server/src/handlers.ts:140-180` — `register` handler
  - `server/src/handlers.ts:424-450` — `list_characters` and `save_character` handlers
  - `server/src/handlers.ts:338-391` — `start_combat` handler (reference for match handler pattern)
  - `server/src/db.ts:42-74` — User CRUD functions
  - `server/src/db.ts:172-181` — `loadCharactersByOwner`
  - `server/src/db.ts:240-270` — `getUserMatches` query
  - `server/src/db.ts:272-300` — `getPublicWaitingMatches` query
  - `shared/types.ts:104-124` — `ClientToServerMessage` (add `set_preferred_ruleset`)

  **Acceptance Criteria**:
  - [ ] `register` with `preferredRulesetId: 'pf2'` stores pf2 in DB
  - [ ] `auth_ok` response includes `preferredRulesetId` in user object
  - [ ] `set_preferred_ruleset` message updates DB and responds with confirmation
  - [ ] `create_match` creates match with user's preferredRulesetId (ignores client rulesetId)
  - [ ] `list_my_matches` returns only matches of user's preferred ruleset (plus active matches regardless)
  - [ ] `list_public_matches` returns only waiting matches of user's preferred ruleset
  - [ ] `list_characters` returns only characters matching user's preferred ruleset
  - [ ] `join_match` allows cross-ruleset joins
  - [ ] `npm run build` succeeds

  **Commit**: YES
  - Message: `feat(server): filter matches and characters by user preferred ruleset`
  - Files: `server/src/handlers.ts`, `server/src/db.ts`

---

- [ ] 4. Client Auth Hook — Store preferredRulesetId

  **What to do**:
  - Update `useAuth` hook to store `preferredRulesetId` from `auth_ok` response
  - Expose `preferredRulesetId` in the hook return value
  - Add `setPreferredRuleset(rulesetId)` function that sends `set_preferred_ruleset` message
  - Update `register` function to pass `preferredRulesetId` to server
  - Handle `preferred_ruleset_updated` response (if server sends one) to update local state
  - Thread `preferredRulesetId` through `useGameSocket` return

  **Must NOT do**:
  - Store ruleset in localStorage (server is source of truth)
  - Modify WebSocket connection logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (after Task 3)
  - **Blocks**: Tasks 5, 6, 7
  - **Blocked By**: Task 3

  **References**:
  - `src/hooks/useAuth.ts` — Auth hook (register, auth_ok handling)
  - `src/hooks/useGameSocket.ts` — Composes all hooks, returns combined state
  - `src/App.tsx:19-43` — Destructures from `useGameSocket()`
  - `shared/types.ts:20-24` — `User` type (now includes `preferredRulesetId`)

  **Acceptance Criteria**:
  - [ ] `useGameSocket()` returns `preferredRulesetId` (from user object)
  - [ ] `register(username, preferredRulesetId)` sends both to server
  - [ ] After `auth_ok`, `preferredRulesetId` is available in state
  - [ ] `setPreferredRuleset('pf2')` sends `set_preferred_ruleset` message
  - [ ] `npm run build` succeeds

  **Commit**: YES
  - Message: `feat(hooks): expose preferredRulesetId from auth hook`
  - Files: `src/hooks/useAuth.ts`, `src/hooks/useGameSocket.ts`

---

- [ ] 5. Dashboard Header — Ruleset Badge + Switch Dialog

  **What to do**:
  - Add ruleset badge to dashboard header (between username and Armory button)
  - Badge shows "GURPS" or "PF2" with ruleset-specific color
  - Clicking badge opens a dialog to switch ruleset
  - Dialog: "Switch to {other ruleset}?" with confirm/cancel
  - On confirm: call `setPreferredRuleset(newRulesetId)`, refresh match lists, show toast
  - For existing users defaulted to GURPS: show one-time toast "Playing GURPS — switch anytime"

  **Must NOT do**:
  - Full settings page
  - Inline editing (use dialog)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 6, 7)
  - **Blocks**: Task 8
  - **Blocked By**: Tasks 2, 4

  **References**:
  - `src/components/Dashboard.tsx` — Dashboard component (header layout)
  - `src/components/Dashboard.css` — Dashboard styles
  - `src/components/lobby/LobbyScreen.tsx:287-310` — Dialog pattern (overlay + dialog box)
  - `src/components/armory/CharacterArmory.css:312-322` — Ruleset badge CSS (`.ruleset-gurps`, `.ruleset-pf2`)

  **Acceptance Criteria**:
  - [ ] Dashboard header shows ruleset badge between username and Armory button
  - [ ] Clicking badge opens switch dialog
  - [ ] Confirming switch calls `setPreferredRuleset`
  - [ ] Badge updates after switch
  - [ ] `npm run build` succeeds

  **Commit**: YES
  - Message: `feat(ui): add ruleset badge and switch dialog to dashboard`
  - Files: `src/components/Dashboard.tsx`, `src/components/Dashboard.css`

---

- [ ] 6. CreateMatchDialog Simplification

  **What to do**:
  - Remove ruleset toggle buttons from CreateMatchDialog
  - Show current ruleset as a static badge (informational, not interactive)
  - `onCreateMatch` no longer receives `rulesetId` from UI (server uses user's preferred)
  - Update `handleCreateMatch` in App.tsx to not pass `rulesetId`
  - Update `ClientToServerMessage` for `create_match`: make `rulesetId` optional (server ignores it)

  **Must NOT do**:
  - Remove the badge entirely (user should still SEE which ruleset the match will use)
  - Restructure the entire dialog

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 5, 7)
  - **Blocks**: Task 8
  - **Blocked By**: Task 4

  **References**:
  - `src/components/dashboard/CreateMatchDialog.tsx` — Dialog component
  - `src/App.tsx:103-105` — `handleCreateMatch` function
  - `shared/types.ts:107` — `create_match` message type

  **Acceptance Criteria**:
  - [ ] CreateMatchDialog has no ruleset toggle buttons
  - [ ] Shows static badge: "This match will use GURPS" (or PF2)
  - [ ] `create_match` message no longer includes `rulesetId` from UI
  - [ ] `npm run build` succeeds

  **Commit**: YES
  - Message: `refactor(ui): remove ruleset selector from create match dialog`
  - Files: `src/components/dashboard/CreateMatchDialog.tsx`, `src/App.tsx`

---

- [ ] 7. CharacterArmory Simplification

  **What to do**:
  - Remove filter bar (All/GURPS/PF2 buttons) — all characters are same ruleset now
  - Remove "+ New Character" dropdown — replace with single "+ New Character" button that navigates to `/armory/new` (server knows the ruleset)
  - Remove the `?ruleset=` query param from navigation (CharacterEditor reads user's preferredRulesetId)
  - Update CharacterEditor to use `preferredRulesetId` prop instead of URL query param for new characters
  - Update App.tsx routes to pass `preferredRulesetId` to CharacterEditor

  **Must NOT do**:
  - Delete the CharacterPicker component (still used in lobby)
  - Rewrite CharacterArmory layout
  - Remove sort dropdown (sort by date/name/favorite stays)
  - Remove Duplicate/Delete/Edit buttons

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 5, 6)
  - **Blocks**: Task 8
  - **Blocked By**: Task 4

  **References**:
  - `src/components/armory/CharacterArmory.tsx:112-147` — Filter bar section
  - `src/components/armory/CharacterArmory.tsx:75-78` — `handleNewCharacter` with dropdown
  - `src/components/armory/CharacterArmory.tsx:88-108` — "+ New Character" dropdown UI
  - `src/components/armory/CharacterEditor.tsx:34-53` — Effect that reads `?ruleset=` from URL
  - `src/App.tsx:220-248` — Armory routes

  **Acceptance Criteria**:
  - [ ] No filter bar (All/GURPS/PF2) in armory
  - [ ] Single "+ New Character" button (no dropdown)
  - [ ] New character created with user's preferred ruleset (not URL param)
  - [ ] Existing characters shown only for preferred ruleset
  - [ ] `npm run build` succeeds

  **Commit**: YES
  - Message: `refactor(ui): simplify armory to single-ruleset experience`
  - Files: `src/components/armory/CharacterArmory.tsx`, `src/components/armory/CharacterEditor.tsx`, `src/App.tsx`

---

- [ ] 8. Update Tests + Final Verification

  **What to do**:
  - Update `src/components/armory/CharacterArmory.test.tsx` — remove filter tests, update for single button
  - Update `src/components/armory/CharacterEditor.test.tsx` — test with preferredRulesetId prop
  - Update `src/components/lobby/LobbyScreen.test.tsx` — if any changes needed
  - Add test for WelcomeScreen ruleset selection
  - Add test for Dashboard ruleset badge + switch
  - Add test for CreateMatchDialog without ruleset picker
  - Run full test suite: `npx vitest run`
  - Run lint: `npm run lint`
  - Run build: `npm run build`

  **Must NOT do**:
  - Skip running the full test suite
  - Leave broken tests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (final task)
  - **Blocks**: None
  - **Blocked By**: Tasks 5, 6, 7

  **References**:
  - `src/components/armory/CharacterArmory.test.tsx` — 19 existing tests
  - `src/components/armory/CharacterEditor.test.tsx` — 10 existing tests
  - `src/components/lobby/LobbyScreen.test.tsx` — 17 existing tests
  - `src/hooks/useMatches.test.ts` — 16 existing tests
  - `src/hooks/useCharacterRoster.test.ts` — 9 existing tests

  **Acceptance Criteria**:
  - [ ] `npx vitest run` — all tests pass, zero failures
  - [ ] `npm run lint` — no new errors
  - [ ] `npm run build` — succeeds
  - [ ] No TypeScript `any` or `@ts-ignore` added

  **Commit**: YES
  - Message: `test: update tests for single-ruleset experience`
  - Files: `src/components/armory/CharacterArmory.test.tsx`, `src/components/armory/CharacterEditor.test.tsx`, etc.

---

## Commit Strategy

| After Task | Message | Verification |
|------------|---------|-------------|
| 1 | `feat(db): add preferred_ruleset_id to users table and User type` | `npm run build` |
| 2 | `feat(ui): redesign welcome screen with ruleset selection cards` | `npm run build` |
| 3 | `feat(server): filter matches and characters by user preferred ruleset` | `npm run build` |
| 4 | `feat(hooks): expose preferredRulesetId from auth hook` | `npm run build` |
| 5 | `feat(ui): add ruleset badge and switch dialog to dashboard` | `npm run build` |
| 6 | `refactor(ui): remove ruleset selector from create match dialog` | `npm run build` |
| 7 | `refactor(ui): simplify armory to single-ruleset experience` | `npm run build` |
| 8 | `test: update tests for single-ruleset experience` | `npx vitest run && npm run lint && npm run build` |

---

## Success Criteria

### Verification Commands
```bash
npx vitest run          # All tests pass
npm run lint            # No new errors
npm run build           # Client + server build succeeds
```

### Final Checklist
- [ ] New user can choose GURPS or PF2 at login
- [ ] Existing user defaults to GURPS with toast
- [ ] CreateMatchDialog has no ruleset picker
- [ ] Armory has no filter bar or ruleset dropdown
- [ ] Match lists show only preferred ruleset matches
- [ ] Dashboard header shows ruleset badge
- [ ] Ruleset switchable via badge click
- [ ] All tests pass
- [ ] No `any`, `@ts-ignore`, or hardcoded colors
