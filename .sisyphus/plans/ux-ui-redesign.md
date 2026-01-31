# UX/UI Redesign: Login, Dashboard, Lobby, Character Armory

## TL;DR

> **Quick Summary**: Complete UX/UI redesign of the 4 pre-game screens (Login, Dashboard, Lobby, Armory) with modern/clean design, dedicated full-screen lobby, standalone character roster, and dashboard hub. Requires foundational refactoring first (hook decomposition, route consolidation, design tokens).
> 
> **Deliverables**:
> - Phase 0: Refactored `useGameSocket` into focused hooks, router-only navigation, CSS design tokens, new WS message types
> - Phase 1: Redesigned Login/Welcome screen with loading states and connection feedback
> - Phase 2: Full Dashboard home page with match list, stats, quick actions
> - Phase 3: Character Armory (standalone roster + tab-based editor, no more `window.prompt()`)
> - Phase 4: Full-screen Lobby with ready system, character preview, match settings
> 
> **Estimated Effort**: XL (5 phases, ~25 tasks)
> **Parallel Execution**: YES - within phases, some tasks parallelize
> **Critical Path**: Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4

---

## Context

### Original Request
User requested a UX/UI study of login, first page, match preparation, and character management. After analysis, evolved into a complete redesign plan.

### Interview Summary
**Key Discussions**:
- **Target audience**: Experienced TTRPG players — efficiency and depth over onboarding
- **Lobby**: Full-screen dedicated page, not modal overlay
- **Character**: Standalone Armory section accessible from home, independent of matches
- **Home**: Dashboard hub with stats, recent matches, quick actions, favorite characters
- **Visual**: Modern/clean theme — less decoration, more whitespace, clear typographic hierarchy
- **Match creation**: Dialog with essential options (name, ruleset, max players, visibility)
- **Character editor**: Tab-based (Attributes | Skills | Equipment | Traits)
- **Responsive**: Desktop and mobile designed in parallel

**Research Findings**:
- `useGameSocket` is 388-line monolith managing connection, auth, matches, state, effects, spectating, localStorage
- Dual navigation: `ScreenState` in hook AND React Router — must consolidate
- Character DB persistence exists (`loadCharactersByOwner()`, `upsertCharacter()`) but no WS messages expose it
- 11 `window.prompt()` calls in `useCharacterEditor.ts` (lines 83, 87, 93, 99, 117, 119, 120, 143, 145, 158, 160) for adding skills/equipment/advantages/disadvantages
- Lobby is a conditional overlay in GameScreen.tsx (lines 291-393), not a separate route/component
- Bot count uses DOM manipulation (`dataset.count`) instead of React state
- No CSS design system — 5 CSS files, many inline styles, no tokens
- Current routes: `/` (welcome), `/matches` (browser), `/game` (game + lobby overlay)

### Metis Review
**Identified Gaps** (addressed):
- Hook decomposition must be Phase 0 prerequisite — adding armory/ready/roster state to 388-line hook is unsustainable
- Navigation consolidation critical — dual system (ScreenState + Router) will cause bugs with new routes
- CSS tokens needed before building screens — prevents inconsistency
- New WS messages must be typed in `shared/types.ts` first
- Character editor data model stays unchanged — UI-only changes
- Back button behavior needs explicit handling for each route transition

---

## Work Objectives

### Core Objective
Redesign all pre-game UX into a modern, clean interface optimized for experienced TTRPG players, with proper navigation, standalone character management, and full-featured lobby.

### Concrete Deliverables
- 5 new/reworked routes: `/` (login), `/home` (dashboard), `/armory` (character roster), `/lobby/:matchId` (lobby), `/game/:matchId` (game)
- Decomposed hooks: `useAuth`, `useMatches`, `useMatchState`, `useCharacterRoster`
- CSS design tokens in `src/index.css`
- New WS messages: `list_characters`, `delete_character`, `toggle_favorite`, `player_ready`, `update_match_settings`
- Server handlers for new messages
- Route transition rules for reconnection (replacing ScreenState + localStorage persistence)
- Tab-based character editor with inline forms (no `window.prompt()`)
- Full-screen lobby with ready system and character preview
- Dashboard with match list, stats summary, quick actions
- Playwright e2e tests for each new screen

### Definition of Done
- [ ] All 5 routes render correctly on desktop (>1200px) and mobile (<768px)
- [ ] Zero `window.prompt()` calls in codebase
- [ ] `useGameSocket` decomposed into focused hooks (each <100 lines)
- [ ] Ready system functional in lobby (all players must ready before start)
- [ ] Character roster: create, edit, delete, list, favorite, filter by ruleset
- [ ] `npx vitest run` — all existing tests pass (zero regressions)
- [ ] `npx playwright test` — all existing + new e2e tests pass

### Must Have
- Loading states on all async actions (connect, create match, save character)
- Connection timeout with error message (10s)
- Proper back button behavior between all routes
- Responsive layout for both desktop and mobile
- Character roster persistence across sessions

### Must NOT Have (Guardrails)
- **No changes** to in-game HUD (GameStatusPanel, GameActionPanel, ActionBar)
- **No changes** to ArenaScene / Three.js / combat rendering
- **No changes** to combat rules engine (`shared/rulesets/gurps/rules.ts`, `shared/rulesets/pf2/rules.ts`)
- **No changes** to bot AI logic
- **No new CSS framework** or UI component library (vanilla CSS)
- **No state management library** (no Redux/Zustand — keep hooks)
- **No new auth system** (keep nickname-based WS auth)
- **No chat system, matchmaking, leaderboards, or ranking**
- **No chart/graph libraries** for dashboard stats
- **No over-engineering**: login stays nickname-only, stats are simple counts

### Allowed Type/Contract Changes (Explicit Exceptions)
These existing types/messages ARE allowed to change (additive only, backward-compatible):
- `CharacterSheet` types: Add optional `isFavorite?: boolean` field
- `create_match` message: Add optional `isPublic?: boolean` field
- `auth_ok` message: Add optional `activeMatches?: MatchSummary[]` field for reconnection
- `start_combat` handler: Add ready validation check before creating match state
- `select_character` handler: Remains match-scoped only (requires matchId). Standalone saves use the new `save_character` message.
- `match_joined` message: Add optional `readyPlayers?: string[]` field for lobby initial state
- `list_public_matches` behavior: Keep existing (active/paused for spectating). Add new `list_public_waiting` for joinable matches.

---

## WebSocket Contracts (New Messages)

### Character Roster Messages

**Client → Server:**
```typescript
{ type: 'list_characters' }
{ type: 'save_character', character: CharacterSheet }  // Create or update (upsert). No matchId required.
{ type: 'delete_character', characterId: string }
{ type: 'toggle_favorite', characterId: string }
```

**Server → Client:**
```typescript
{ type: 'character_list', characters: CharacterSheet[] }  // each has isFavorite: boolean
{ type: 'character_saved', characterId: string }          // Confirmation (echoes back the client-supplied id)
{ type: 'character_deleted', characterId: string }
{ type: 'character_favorited', characterId: string, isFavorite: boolean }
```

**Armory Persistence Rules:**
- `save_character` is the standalone save mechanism (account-scoped, no match dependency). Uses existing `upsertCharacter(character, userId)` in `server/src/db.ts`.
- `select_character` (existing message, `server/src/handlers.ts:301`) remains for match-scoped assignment. It calls `upsertCharacter` AND `updateMatchMemberCharacter`. Used in lobby when selecting a character for a match.
- **ID assignment**: Client ALWAYS supplies `character.id`. The `createCharacter(name)` functions (at `shared/rulesets/gurps/index.ts:48` and `shared/rulesets/pf2/index.ts`) already generate UUIDs. Server never assigns IDs.
- **Create vs Update distinction**: Server uses `ON CONFLICT(id) DO UPDATE`. If `id` is new → insert. If `id` exists → update. No explicit create/update flag needed.
- **Creating a new character**: Client calls `rulesets[rulesetId].ruleset.createCharacter(name)` to get a new CharacterSheet with fresh UUID, then sends `save_character`. Server upserts and responds with `character_saved`.
- **Duplicating a character**: Client deep-clones the sheet, assigns new `id` via `crypto.randomUUID()`, sends `save_character`.
- Ownership: Server sets `owner_id` on save from authenticated user. Only owners can edit/delete.
- **Ownership enforcement (exact server behavior)**:
  - `save_character`: If `character.id` already exists in DB AND `owner_id !== userId` → reject with `{ type: 'error', message: 'You do not own this character' }`. If new (no existing row) → insert with `owner_id = userId`. If exists and `owner_id === userId` → update.
  - `toggle_favorite`: SELECT `owner_id` from characters WHERE id = characterId. If `owner_id !== userId` → reject. If not found → reject.
  - `delete_character`: Already specified in delete flow above (step 1 verifies ownership).
- **Delete edge cases**:
  - **Delete character handler flow** (in `server/src/handlers.ts`):
    ```
    1. Verify ownership: SELECT owner_id FROM characters WHERE id = ?
    2. Check active/paused references:
       SELECT COUNT(*) FROM match_members mm
       INNER JOIN matches m ON mm.match_id = m.id
       WHERE mm.character_id = ? AND m.status IN ('active', 'paused')
       → If count > 0: reject with { type: 'error', message: 'Cannot delete a character in an active match' }
    3. Clear waiting match references (single SQL, no iteration):
       UPDATE match_members SET character_id = NULL
       WHERE character_id = ?
       AND match_id IN (SELECT id FROM matches WHERE status = 'waiting')
    4. Clear user default_character_id reference:
       UPDATE users SET default_character_id = NULL WHERE default_character_id = ?
    5. Delete character:
       DELETE FROM characters WHERE id = ? AND owner_id = ?
    6. Send: { type: 'character_deleted', characterId }
    ```
  - Add DB helpers in `server/src/db.ts`:
    - `countActiveMatchesForCharacter(characterId: string): number` — step 2
    - `clearCharacterFromWaitingMatches(characterId: string): void` — step 3
    - `clearDefaultCharacter(characterId: string): void` — step 4
    - `deleteCharacter(characterId: string, ownerId: string): void` — step 5

### Ready System Messages

**Client → Server:**
```typescript
{ type: 'player_ready', matchId: string, ready: boolean }
```

**Server → Client (broadcast to all match members):**
```typescript
{ type: 'player_ready_update', matchId: string, playerId: string, ready: boolean }
{ type: 'all_players_ready', matchId: string }
```

**Ready Enforcement Rules:**
- Ready state tracked **server-side** in a separate in-memory `Map<matchId, Set<playerId>>` (NOT inside MatchState, which only exists after `start_combat`). Stored in `server/src/state.ts` alongside existing `matches`, `users`, `connections` maps.
- **Lifecycle**: Ready map entry created on `create_match` (empty Set), cleared on `start_combat` (match transitions to active).
- **Abandoned match cleanup**: When the last member disconnects from a waiting match (all members removed via `server/src/index.ts:51` disconnect handler → `removeMatchMember`), the ready set entry is also deleted. After `removeMatchMember`, call `getMatchMemberCount(matchId)` (existing function at `server/src/db.ts:271`). If count === 0: delete the ready set entry via `state.readySets.delete(matchId)` AND update match status to `finished` in DB via `updateMatchStatus(matchId, 'finished')`. This ensures abandoned waiting matches don't linger in listings and the ready map doesn't leak memory. Verification: after cleanup, `list_public_waiting` should NOT return abandoned matches.
- **Initial state on join**: When a player joins a match, they start as NOT ready (not in the Set). The `match_joined` response (currently `{ type: "match_joined", matchId }` in `shared/types.ts:134`) is expanded to include `readyPlayers: string[]` from the in-memory Set. This is listed as an allowed additive change above.
- **Source of truth for lobby initial load**: The client uses the `readyPlayers` array from the `match_joined` response as the initial state when the lobby screen mounts. After that, real-time `player_ready_update` events maintain the state.
- **Implementation details**:
  - Server handler in `server/src/handlers.ts` (cases "create_match" and "join_match"): after the existing response code, read the ready Set from `state.readySets.get(matchId)` and include `readyPlayers: Array.from(set)` in the `match_joined` message.
  - `MatchSummary.readyPlayers` (used in `myMatches` listing on Dashboard) is populated by the match summary builder: add a `getReadyPlayers(matchId): string[]` helper in `server/src/state.ts` that returns `Array.from(readySets.get(matchId) ?? [])`, and call it from the summary builder in `server/src/handlers.ts` (where summaries are sent, NOT in `server/src/db.ts` which has no access to in-memory state).
  - Dashboard match cards show ready count (e.g., "2/3 ready") from `MatchSummary.readyPlayers.length` vs total members.
- **Memory leak prevention**: Ready map entries for matches that transition to `active`, `paused`, or `finished` are always cleaned up. The ready map only contains entries for `waiting` matches.
- When `start_combat` is received (`server/src/handlers.ts:312`), server validates ALL human match members are in the ready set; rejects with `{ type: 'error', message: 'Not all players are ready' }` if not. Then clears the ready set for that match.
- Bots are always considered ready (they don't need to toggle)
- Spectators are excluded from ready checks (they are not match members)
- **Disconnect handling** (`server/src/index.ts:43`, the `socket.on("close")` handler): For waiting matches (line 51), when a player disconnects they are removed from the match AND from the ready set. On reconnect (via `rejoin_match`), their ready state starts as false — they must re-ready.
- **Active/paused match disconnect** (line 59): Ready system is irrelevant for active matches (already started). No ready cleanup needed.
- The `all_players_ready` message is a convenience notification; the authoritative check is server-side on `start_combat`
- **Server restart**: Ready state is lost (in-memory only). All players must re-ready after server restart. This is acceptable for a dev/hobby project.

### Match Settings Messages

**Client → Server:**
```typescript
{ type: 'update_match_settings', matchId: string, settings: { isPublic?: boolean } }
```

**Server → Client (broadcast to all match members):**
```typescript
{ type: 'match_settings_updated', matchId: string, settings: { isPublic: boolean } }
```

**Match Settings Rules:**
- Only match creator can update settings (server validates `userId === match.creatorId`)
- Non-creators sending `update_match_settings` receive `{ type: 'error', message: 'Only the match creator can change settings' }`
- Settings can only be changed while match `status === 'waiting'` (pre-combat)
- **Initial state for lobby members**: Add `isPublic: boolean` to `MatchSummary` (in `shared/types.ts`). It's populated from the DB `is_public` column by `buildMatchSummary()` in `server/src/db.ts`. All lobby members receive it via `my_matches` listing and via `match_created`/`match_joined` responses. Changes are broadcast via `match_settings_updated`.

**Bot Count Semantics:**
- Bot count is **creator-local only** until `start_combat`. It is NOT stored on the server or broadcast.
- The creator's lobby UI stores `botCount` in React state (replacing current DOM manipulation).
- When creator clicks "Start Match", the `start_combat` message includes `botCount: number` (this field already exists in the current `start_combat` message at `server/src/handlers.ts:312`).
- Non-creators do NOT see or control bot count. They only see the result after match starts (bots appear as combatants).
- This matches the current behavior — bot count is purely a client-side creator choice passed at start time.

**Public Match Semantics:**
- "Public" means **visible in the Dashboard's public match list AND joinable without a code** (anyone can click "Join" from the list)
- Public matches appear in listings ONLY when `status === 'waiting'` (recruiting players). Active/paused/finished matches are NOT shown publicly.
- Public waiting match summaries include the match `code` so users can join. The existing `buildPublicMatchSummary()` at `server/src/db.ts:374` (which sets `code: ''`) remains UNCHANGED for spectating. Instead, add a NEW function `buildJoinableMatchSummary()` in `server/src/db.ts` that is identical to `buildPublicMatchSummary()` but preserves the `code` field. This function is used ONLY by the `list_public_waiting` handler.
- **How "join without code" works**: Dashboard shows public waiting matches with their `code` embedded in the MatchSummary. When user clicks "Join" on a public match card, client sends `{ type: 'join_match', code: matchSummary.code }` — same mechanism as join-by-code, but code is pre-filled from the listing.
- **Coexistence with spectating**: The existing `list_public_matches` handler (`server/src/handlers.ts:118`) and `getActiveMatches()` (`server/src/db.ts:368`) return active/paused matches for spectating — these remain UNCHANGED. For public waiting matches, add a NEW query function `getPublicWaitingMatches()` in `server/src/db.ts` that selects matches with `is_public = 1 AND status = 'waiting'`. The Dashboard calls a NEW message `list_public_waiting` to get joinable matches. The existing spectate flow uses the unchanged `list_public_matches`.
- Private matches (default) require the code to join — they do NOT appear in public listings.
- Current spectating behavior (watching active matches) is separate from "public" and unchanged.

### Match Creation (Updated)

**Client → Server (updated):**
```typescript
{ type: 'create_match', name: string, maxPlayers: number, rulesetId: string, isPublic?: boolean }
```

`isPublic` defaults to `false` on the server if omitted, maintaining backward compatibility.

---

## Route Transition & Reconnection Logic

### New Route Structure
```
/              → WelcomeScreen (unauthenticated only)
/home          → Dashboard (authenticated, default landing)
/armory        → CharacterArmory (authenticated)
/lobby/:matchId → LobbyScreen (authenticated, match in 'waiting' status)
/game/:matchId  → GameScreen (authenticated, match in 'active'/'paused' status)
```

### Route Guards
- **Unauthenticated** on any route except `/` → redirect to `/`
- **Authenticated** on `/` → redirect to `/home`
- **`/lobby/:matchId`** where match is `active` → redirect to `/game/:matchId`
- **`/game/:matchId`** where match is `waiting` → redirect to `/lobby/:matchId`
- **`/lobby/:matchId` or `/game/:matchId`** where match not found or user not member → redirect to `/home` with toast error

### Navigation on Server Events
| Server Event | Current Route | Navigation Action |
|-------------|---------------|-------------------|
| `match_created` | `/home` | Navigate to `/lobby/:matchId` |
| `match_joined` | `/home` | Navigate to `/lobby/:matchId` |
| `match_state` (status=active) | `/lobby/:matchId` | Navigate to `/game/:matchId` |
| `match_state` (status=finished) | `/game/:matchId` | Stay, show result overlay |
| `match_left` | any | Navigate to `/home` |
| `error: match not found` | `/lobby` or `/game` | Navigate to `/home` |

### Reconnection Logic (Replaces ScreenState + localStorage)
The current app persists `tcs.screenState` and `tcs.activeMatchId` to localStorage. After removing `ScreenState`:

1. **On page load**: Check localStorage for `tcs.sessionToken` only
2. **On `auth_ok` response**: Server includes `activeMatches: MatchSummary[]` (user's non-finished matches)
3. **Auto-rejoin decision** (replaces `pendingRejoinRef`):
   - If user has exactly 1 active/waiting match → auto-navigate to `/lobby/:id` or `/game/:id` based on status
   - If user has multiple active matches → navigate to `/home` (user chooses from dashboard)
   - If user has 0 active matches → navigate to `/home`
4. **`tcs.activeMatchId` localStorage**: KEEP this key for tab-visibility reconnection (rejoin on focus). Remove `tcs.screenState`.
5. **Deep link handling**: `?join=CODE` → after auth, send `join_match` → on `match_joined`, navigate to `/lobby/:matchId`

### Back Button Behavior
| From | Back Goes To | Confirmation? |
|------|-------------|---------------|
| `/home` | N/A (root for authenticated) | No |
| `/armory` | `/home` | No |
| `/lobby/:matchId` | `/home` (sends `leave_match`) | Yes: "Leave this match?" |
| `/game/:matchId` | `/home` (sends `leave_match`) | Yes: "Leave the current game?" |

### Route Param as Source of Truth
- **`activeMatchId` is derived from the URL param** (`useParams().matchId`), NOT stored in hook state
- Components at `/lobby/:matchId` and `/game/:matchId` use `matchId` from URL to fetch/subscribe to match data
- `tcs.activeMatchId` in localStorage is ONLY used for tab-visibility reconnection (when tab regains focus, check if localStorage has a matchId → send `rejoin_match`)
- **Deep-linking flow** (user pastes `/lobby/abc123` when not logged in):
  1. Route guard detects no auth → redirect to `/` with `returnTo=/lobby/abc123` in router state
  2. After auth_ok → check `returnTo` → navigate to `/lobby/abc123`
  3. Component mounts → sends `rejoin_match` with matchId from URL
  4. If server responds with error → redirect to `/home` with toast
- **Error toast**: Use existing `{ type: 'error', message }` WS pattern. Client displays as a temporary notification banner at top of screen (no new toast library — simple CSS animation, auto-dismiss after 5s)

### Exact Reconnection Sequence
```
1. Page load / tab visible
2. Check localStorage for 'tcs.sessionToken'
3. IF token exists:
   a. Connect WebSocket
   b. Send: { type: 'auth', sessionToken }
   c. Receive: { type: 'auth_ok', user, sessionToken, activeMatches }
   d. IF current URL is /lobby/:id or /game/:id:
      - Send: { type: 'rejoin_match', matchId: urlParam.matchId }
      - Stay on current route (match data will arrive via match_state)
   e. ELSE IF activeMatches.length === 1:
      - Auto-navigate to /lobby/:id or /game/:id based on match.status
   f. ELSE:
      - Navigate to /home
4. IF no token:
   a. Navigate to /
   b. Show WelcomeScreen
```

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Vitest + Playwright)
- **User wants tests**: YES (Tests-after — Playwright e2e per screen)
- **Framework**: Vitest for unit, Playwright for e2e

### Approach
Each phase ends with:
1. `npx vitest run` — verify zero regressions in existing 16 unit tests
2. New Playwright e2e spec for the completed screen
3. Visual verification via Playwright screenshots saved to `.sisyphus/evidence/`

---

## Execution Strategy

### Parallel Execution Waves

```
Phase 0 - Foundation (Sequential - must complete first):
├── Task 1: CSS Design Tokens
├── Task 2: Decompose useGameSocket into focused hooks
├── Task 3: Consolidate navigation to router-only (new routes)
├── Task 4: New WS message types in shared/types.ts
└── Task 5: Server handlers for new messages (list_characters, delete_character, player_ready)

Phase 1 - Login (After Phase 0):
└── Task 6: Redesign WelcomeScreen with loading states + timeout

Phase 2 - Dashboard (After Phase 1):
├── Task 7: Dashboard layout and match list
├── Task 8: Stats summary component
└── Task 9: Match creation dialog

Phase 3 - Armory (After Phase 2):
├── Task 10: Character roster list view
├── Task 11: Character editor - Attributes tab
├── Task 12: Character editor - Skills tab (replace prompt())
├── Task 13: Character editor - Equipment tab (replace prompt())
├── Task 14: Character editor - Traits tab (replace prompt())
├── Task 15: Pathbuilder import integration in new editor
└── Task 16: Character picker for lobby integration

Phase 4 - Lobby (After Phase 3):
├── Task 17: Lobby full-screen layout
├── Task 18: Player list with ready system
├── Task 19: Character preview panel
├── Task 20: Match settings and bot controls
└── Task 21: Invite system and start flow

Phase 5 - Polish & Tests:
├── Task 22: E2e tests for all screens
├── Task 23: Mobile responsive polish
└── Task 24: Cleanup old components and CSS
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 (CSS tokens) | None | 6-24 | 2, 3, 4, 5 |
| 2 (Hook decompose) | None | 3, 6-24 | 1, 4, 5 |
| 3 (Router consolidate) | 2 | 6-24 | (sequential after 2) |
| 4 (WS types) | None | 5 | 1, 2, 3 |
| 5 (Server handlers) | 4 | 10, 18 | 1, 2, 3 |
| 6 (Login) | 1, 2, 3 | 7 | None |
| 7 (Dashboard layout) | 6 | 9 | 8 |
| 8 (Stats component) | 6 | None | 7 |
| 9 (Match dialog) | 7 | 17 | None |
| 10 (Roster list) | 5, 6 | 16 | 11 |
| 11 (Attrs tab) | 6 | None | 10, 12, 13, 14 |
| 12 (Skills tab) | 6 | None | 10, 11, 13, 14 |
| 13 (Equipment tab) | 6 | None | 10, 11, 12, 14 |
| 14 (Traits tab) | 6 | None | 10, 11, 12, 13 |
| 15 (Pathbuilder) | 11 | None | 14 |
| 16 (Char picker) | 10 | 19 | 15 |
| 17 (Lobby layout) | 9 | 18, 19, 20 | None |
| 18 (Ready system) | 5, 17 | 21 | 19 |
| 19 (Char preview) | 16, 17 | 21 | 18 |
| 20 (Match settings) | 17 | 21 | 18, 19 |
| 21 (Start flow) | 18, 19, 20 | 22 | None |
| 22 (E2e tests) | 21 | 24 | 23 |
| 23 (Mobile polish) | 21 | 24 | 22 |
| 24 (Cleanup) | 22, 23 | None | None |

### Agent Dispatch Summary

| Phase | Tasks | Recommended Agents |
|------|-------|-------------------|
| 0 | 1-5 | delegate_task(category="unspecified-high", load_skills=["frontend-ui-ux"], run_in_background=true) — parallel |
| 1 | 6 | delegate_task(category="visual-engineering", load_skills=["frontend-ui-ux"]) |
| 2 | 7-9 | delegate_task(category="visual-engineering", load_skills=["frontend-ui-ux"], run_in_background=true) — 7+8 parallel |
| 3 | 10-16 | delegate_task(category="visual-engineering", load_skills=["frontend-ui-ux"], run_in_background=true) — 11-14 parallel |
| 4 | 17-21 | delegate_task(category="visual-engineering", load_skills=["frontend-ui-ux"]) — 18+19+20 parallel |
| 5 | 22-24 | delegate_task(category="unspecified-high", load_skills=["playwright", "frontend-ui-ux"]) — 22+23 parallel |

---

## TODOs

### Phase 0: Foundation

- [x] 1. Establish CSS Design Tokens

  **What to do**:
  - Define CSS custom properties in `src/index.css` for the new modern/clean design system
  - Color tokens: `--bg-primary: #121212`, `--bg-surface: #1a1a1a`, `--bg-elevated: #242424`, `--bg-interactive: #2a2a2a`, `--text-primary: #ffffff`, `--text-secondary: #b0b0b0`, `--text-muted: #707070`, `--accent-primary: #646cff`, `--accent-success: #22c55e`, `--accent-danger: #ef4444`, `--accent-warning: #f59e0b`, `--border-default: #333`, `--border-subtle: #2a2a2a`
  - Spacing tokens: `--space-xs: 4px`, `--space-sm: 8px`, `--space-md: 16px`, `--space-lg: 24px`, `--space-xl: 32px`, `--space-2xl: 48px`
  - Typography tokens: `--font-sans: 'Inter', system-ui, sans-serif`, `--text-xs: 0.75rem`, `--text-sm: 0.875rem`, `--text-base: 1rem`, `--text-lg: 1.125rem`, `--text-xl: 1.25rem`, `--text-2xl: 1.5rem`, `--text-3xl: 2rem`, `--font-normal: 400`, `--font-medium: 500`, `--font-semibold: 600`, `--font-bold: 700`
  - Border radius tokens: `--radius-sm: 4px`, `--radius-md: 8px`, `--radius-lg: 12px`, `--radius-xl: 16px`
  - Transition tokens: `--transition-fast: 150ms ease`, `--transition-normal: 200ms ease`, `--transition-slow: 300ms ease`
  - Breakpoint documentation comment: `/* Breakpoints: sm=480px, md=768px, lg=1024px, xl=1200px */`

  **Must NOT do**:
  - Do NOT change existing component CSS yet — tokens only
  - Do NOT add a CSS framework or preprocessor
  - Do NOT change existing color values in other files

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file change, clear specification, no ambiguity
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Design token expertise, color/spacing systems
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser testing needed for CSS variables

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0A (with Tasks 2, 3, 4, 5)
  - **Blocks**: All Phase 1-5 tasks
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/index.css` — Current global CSS with existing color values to extract into tokens. Currently defines `:root` with `font-family`, `color-scheme`, basic resets. New tokens go here.
  - `src/App.css` — 4000+ lines of component styles. Scan for recurring colors (#121212, #1a1a1a, #252525, #333, #646cff, #4f4, #f44) to confirm token values.

  **Documentation References**:
  - `AGENTS.md:Code Style` — Confirms 2-space indentation, existing patterns

  **WHY Each Reference Matters**:
  - `src/index.css` is where tokens will be added — need to see current `:root` block
  - `src/App.css` contains all the colors currently in use — tokens must match existing palette

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  grep -c '\-\-bg-primary' src/index.css
  # Assert: Output is "1" (token defined)
  
  grep -c '\-\-accent-primary' src/index.css  
  # Assert: Output is "1" (token defined)
  
  grep -c '\-\-space-md' src/index.css
  # Assert: Output is "1" (token defined)
  
  grep -c '\-\-text-base' src/index.css
  # Assert: Output is "1" (token defined)
  
  npx vitest run 2>&1 | tail -5
  # Assert: All tests pass, zero failures
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from grep commands showing all token categories defined
  - [ ] Vitest output confirming no regressions

  **Commit**: YES
  - Message: `style: add CSS design tokens for modern/clean theme`
  - Files: `src/index.css`
  - Pre-commit: `npx vitest run`

---

- [x] 2. Decompose `useGameSocket` into focused hooks

  **What to do**:
  - Extract `useAuth` hook: manages `connectionState`, `user`, `authError`, `register()`, `logout()`, WebSocket connection lifecycle, session token in localStorage, reconnection with exponential backoff
  - Extract `useMatches` hook: manages `myMatches`, `publicMatches`, `refreshMyMatches()`, `fetchPublicMatches()`, match CRUD messages
  - Extract `useMatchState` hook: manages `matchState`, `pendingDefense`, `pendingAction`, `reachableHexes`, `turnMovement`, combat-related state and messages
  - Extract `useCharacterRoster` hook: new hook for character list, CRUD operations, favorite toggle (will connect to new WS messages from Task 5)
  - Keep `useGameSocket` as thin orchestrator that:
    1. **Owns the WebSocket instance and `ws.onmessage`**: Creates the WebSocket, parses incoming JSON, and dispatches to sub-hooks via a shared message handler registry
    2. **Message dispatch mechanism**: Each sub-hook registers a `handleMessage(message: ServerToClientMessage): boolean` callback during initialization. `useGameSocket` iterates callbacks until one returns `true` (message handled). This avoids circular dependencies — sub-hooks don't import each other, they only receive messages.
    3. **Shared `sendMessage` function**: `useGameSocket` provides `sendMessage(msg: ClientToServerMessage)` via React context or direct prop. Sub-hooks receive it as a parameter.
    4. **Composition**: `useGameSocket` calls `useAuth(ws, sendMessage)`, `useMatches(sendMessage)`, `useMatchState(sendMessage)`, `useCharacterRoster(sendMessage)` and collects their exports into one return object (preserving the existing destructuring API in `App.tsx`).
  - Each extracted hook must be <100 lines
  - **Phase 0 Migration Contract (Task 2 → Task 3 transition)**:
    - **After Task 2**: `useGameSocket` return shape is IDENTICAL to today. Internal code moves to sub-hooks, but `App.tsx` still destructures `{ screen, setScreen, activeMatchId, setActiveMatchId, connectionState, user, ... }`. This is a pure internal refactor.
    - **After Task 3**: `useGameSocket` return shape CHANGES. Removed: `screen`, `setScreen` (ScreenState gone). Changed: `activeMatchId` becomes read-only (derived from URL in App.tsx via `useParams()`, no longer in hook state). Removed: `setActiveMatchId` (replaced by `navigate('/lobby/:id')` or `navigate('/game/:id')`). App.tsx passes `matchId` from URL params to sub-components as props. Actions that need `matchId` (like `sendMessage`) receive it from the component's route param, not from hook state.
    - **How components get matchId after Task 3**: `GameScreen` and `LobbyScreen` use `const { matchId } = useParams()`. Dashboard uses `navigate('/lobby/${matchId}')` when handling `match_created`/`match_joined` events. The `useMatches` hook handles navigation on match events: on `match_created` → calls `navigate('/lobby/${matchId}')`, on `match_state` (active) → calls `navigate('/game/${matchId}')`.
    - Tasks 2 and 3 MUST be done in sequence (not parallel) because Task 3 changes the public API that Task 2 preserves.
  - Use `lsp_find_references` on every export from `useGameSocket` before moving it — the primary consumer is `src/App.tsx` (which destructures ~20 values from the hook), but verify no other files import it

  **Must NOT do**:
  - Do NOT change any component that consumes the hook yet — maintain the same public API from `useGameSocket` (it just delegates internally)
  - Do NOT change message handling logic — only move code between files
  - Do NOT add new features yet

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Refactoring a 388-line monolith with 20+ consumers. High risk, requires careful reference tracking.
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React hook patterns, state management architecture
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser testing needed for refactoring
    - `git-master`: Standard commit, no complex git operations

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0A (with Tasks 1, 3, 4, 5)
  - **Blocks**: All Phase 1-5 tasks
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/hooks/useGameSocket.ts` — THE file to decompose. 388 lines. Key sections: connection lifecycle (lines 1-80), auth (80-150), match management (150-250), match state (250-350), effects and localStorage (350-388)
  - `src/App.tsx` — Primary consumer of `useGameSocket`. Destructures ~20 values from the hook. Must maintain same destructuring interface.

  **API/Type References**:
  - `shared/types.ts:ClientToServerMessage` — All message types the hook sends (lines 102-115)
  - `shared/types.ts:ServerToClientMessage` — All message types the hook receives

  **WHY Each Reference Matters**:
  - `useGameSocket.ts` is the target — understand its full structure before splitting
  - `App.tsx` is the primary consumer — the public API must not break
  - `shared/types.ts` defines the message contracts that determine which hook handles which message

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  wc -l src/hooks/useAuth.ts src/hooks/useMatches.ts src/hooks/useMatchState.ts src/hooks/useCharacterRoster.ts
  # Assert: Each file exists and is <100 lines
  
  wc -l src/hooks/useGameSocket.ts
  # Assert: Significantly reduced from 388 lines (should be <80 lines as orchestrator)
  
  npx vitest run 2>&1 | tail -5
  # Assert: All tests pass, zero failures
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds with zero TypeScript errors
  ```

  **Evidence to Capture:**
  - [ ] Line counts of all new hook files
  - [ ] Build output showing zero TS errors
  - [ ] Vitest output confirming no regressions

  **Commit**: YES
  - Message: `refactor: decompose useGameSocket into focused hooks (useAuth, useMatches, useMatchState, useCharacterRoster)`
  - Files: `src/hooks/useGameSocket.ts`, `src/hooks/useAuth.ts`, `src/hooks/useMatches.ts`, `src/hooks/useMatchState.ts`, `src/hooks/useCharacterRoster.ts`
  - Pre-commit: `npm run build && npx vitest run`

---

- [x] 3. Consolidate navigation to router-only

  **What to do**:
  - Remove `ScreenState` type (defined at `src/hooks/useGameSocket.ts:5`) and `screen` state (line 20) and localStorage persistence (line 41). After Task 2, these may be in `useAuth.ts` instead.
  - Remove `localStorage.getItem/setItem('tcs.screenState')` — replace with route-based navigation (see "Route Transition & Reconnection Logic" section above)
  - Keep `tcs.activeMatchId` in localStorage for tab-visibility reconnection
  - Update routes in App.tsx:
    - `/` → WelcomeScreen (login)
    - `/home` → Dashboard (new, replaces `/matches`)
    - `/armory` → CharacterArmory (new)
    - `/lobby/:matchId` → LobbyScreen (new, extracted from GameScreen overlay)
    - `/game/:matchId` → GameScreen (existing, minus lobby overlay)
  - Add route guards: redirect to `/` if not authenticated, redirect to `/home` if authenticated and on `/`
  - Handle `?join=CODE` URL param — after auth, send `join_match`, on `match_joined` navigate to `/lobby/:matchId`
  - Implement reconnection logic: on `auth_ok`, check `activeMatches` array from server response. If 1 active match → auto-navigate to `/lobby/:id` or `/game/:id` based on status. If 0 or >1 → navigate to `/home`.
  - **State ownership bridge during Phase 0 (placeholders only)**:
    - Remove `activeMatchId` state from hooks. Instead, `App.tsx` derives `activeMatchId` from the current URL via `useParams()` (or `useMatch()` from React Router).
    - For Phase 0 placeholders, the `/lobby/:matchId` and `/game/:matchId` routes receive `matchId` from URL params. The placeholder components just display "Loading..." with the matchId.
    - The existing `GameScreen` component (which currently uses `activeMatchId` from hook state) is temporarily updated to read `matchId` from `useParams()` instead. Full GameScreen refactoring is out of scope — only the matchId source changes.
    - `tcs.activeMatchId` localStorage key is ONLY written/read for tab-visibility reconnection: on `beforeunload`, write current route's matchId; on `visibilitychange`, read it to send `rejoin_match`.
  - Extract lobby overlay (GameScreen.tsx lines 291-393) into standalone `src/components/lobby/LobbyScreen.tsx` placeholder (empty component for now, just route placeholder with "Lobby coming soon" text)
  - Update all `navigate()` calls to use new routes
  - Handle back button: `/game` → `/home`, `/lobby` → `/home`, `/armory` → `/home`

  **Must NOT do**:
  - Do NOT build the actual Dashboard, Armory, or Lobby screens yet — just create route placeholders
  - Do NOT modify GameScreen combat UI — only extract the lobby overlay
  - Do NOT break existing reconnection flow

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Structural navigation change affecting all screens. Must not break reconnection.
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React Router patterns, SPA navigation architecture
  - **Skills Evaluated but Omitted**:
    - `playwright`: E2e tests come later in Phase 5

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0A (with Tasks 1, 2, 4, 5)
  - **Blocks**: All Phase 1-5 tasks
  - **Blocked By**: None (but best done alongside Task 2 since both touch useGameSocket)

  **References**:

  **Pattern References**:
  - `src/App.tsx` — Current routing logic. Lines 1-100: route definitions, guards, navigation effects. Must restructure.
  - `src/hooks/useGameSocket.ts:5,20,41` — `ScreenState` type (line 5), `screen` state (line 20), `localStorage` persistence for screen state (line 41). Must remove all three and replace with router-based navigation per the "Route Transition & Reconnection Logic" section.
  - `src/components/game/GameScreen.tsx:291-393` — Lobby overlay to extract. ~100 lines of lobby setup modal.

  **API/Type References**:
  - `src/hooks/useGameSocket.ts:5` — `ScreenState` type is defined HERE (not in shared/types.ts): `export type ScreenState = 'welcome' | 'matches' | 'waiting' | 'match'`. Remove this type and all its usages (lines 5, 20, 41).

  **WHY Each Reference Matters**:
  - `App.tsx` is where all routing lives — need full understanding before restructuring
  - `useGameSocket.ts` has the ScreenState to remove
  - `GameScreen.tsx` has the lobby overlay to extract into its own route

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  grep -r "ScreenState" src/ --include="*.ts" --include="*.tsx" | wc -l
  # Assert: Output is "0" (ScreenState fully removed)
  
  grep -c "'/home'" src/App.tsx
  # Assert: Output >= 1 (new /home route exists)
  
  grep -c "'/armory'" src/App.tsx
  # Assert: Output >= 1 (new /armory route exists)
  
  grep -c "'/lobby/'" src/App.tsx
  # Assert: Output >= 1 (new /lobby/:matchId route exists)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds with zero TypeScript errors
  
  npx vitest run 2>&1 | tail -5
  # Assert: All tests pass
  ```

  **Evidence to Capture:**
  - [ ] Grep output confirming ScreenState removed
  - [ ] Grep output confirming all new routes exist
  - [ ] Build + test output

  **Commit**: YES
  - Message: `refactor: consolidate navigation to router-only with new routes (/home, /armory, /lobby/:matchId)`
  - Files: `src/App.tsx`, `src/hooks/useGameSocket.ts` (or decomposed hooks), `src/components/lobby/LobbyScreen.tsx` (placeholder), `src/components/Dashboard.tsx` (placeholder), `src/components/armory/CharacterArmory.tsx` (placeholder)
  - Pre-commit: `npm run build && npx vitest run`

---

- [x] 4. Define new WebSocket message types in shared/types.ts

  **What to do**:
  - Add to `ClientToServerMessage` union:
    - `{ type: 'list_characters' }` — Request all characters for current user
    - `{ type: 'save_character', character: CharacterSheet }` — Create or update character (standalone, no matchId)
    - `{ type: 'delete_character', characterId: string }` — Delete a character
    - `{ type: 'toggle_favorite', characterId: string }` — Toggle favorite flag
    - `{ type: 'player_ready', matchId: string, ready: boolean }` — Toggle ready status in lobby
    - `{ type: 'update_match_settings', matchId: string, settings: { isPublic?: boolean } }` — Update match settings (creator only)
    - `{ type: 'list_public_waiting' }` — Request public waiting matches (for Dashboard join list)
  - Add to `ServerToClientMessage` union:
    - `{ type: 'character_list', characters: CharacterSheet[] }` — Response to list_characters (each character includes `isFavorite: boolean`)
    - `{ type: 'character_saved', character: CharacterSheet }` — Confirmation of save with server-assigned id if new
    - `{ type: 'character_deleted', characterId: string }` — Confirmation of deletion
    - `{ type: 'character_favorited', characterId: string, isFavorite: boolean }` — Confirmation of toggle
    - `{ type: 'player_ready_update', matchId: string, playerId: string, ready: boolean }` — Broadcast ready status change
    - `{ type: 'all_players_ready', matchId: string }` — All players ready notification
    - `{ type: 'match_settings_updated', matchId: string, settings: { isPublic: boolean } }` — Broadcast settings change
    - `{ type: 'public_waiting_list', matches: MatchSummary[] }` — Response to list_public_waiting
  - Modify `auth_ok` message: add optional `activeMatches?: MatchSummary[]` field (list of user's non-finished matches, for reconnection logic). This is an additive change.
  - Modify `create_match` message: add optional `isPublic?: boolean` field (defaults to false server-side). Additive, backward compatible.
  - Add `isFavorite?: boolean` field to both `GurpsCharacterSheet` (in `shared/rulesets/gurps/characterSheet.ts`) and `PF2CharacterSheet` (in `shared/rulesets/pf2/characterSheet.ts`). Optional field, backward compatible.
  - **`isFavorite` storage rules**:
    - **Source of truth**: DB column `is_favorite` on the `characters` table
    - `save_character` message does NOT control `isFavorite` (server ignores it if present in payload). Only `toggle_favorite` changes the flag.
    - **DB write preservation**: The current `upsertCharacter()` at `server/src/db.ts:166-170` uses `INSERT OR REPLACE INTO characters (id, owner_id, name, data_json) VALUES (?, ?, ?, ?)`, which would reset `is_favorite` to 0 (default) on every save. Fix: change the SQL to `INSERT INTO characters (id, owner_id, name, data_json) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, data_json = excluded.data_json` — this preserves the existing `is_favorite` value. The table schema (`server/src/db.ts:40-47`) has columns: `id, owner_id, name, data_json, created_at`. There is NO `updated_at` column.
    - `loadCharactersByOwner()` in `server/src/db.ts` must be updated to SELECT `is_favorite` and merge it into the CharacterSheet JSON as `isFavorite: boolean` before sending `character_list`.
    - `isFavorite` field on CharacterSheet types is for transport only (server → client). Client reads it from the `character_list` response.
  - Add `readyPlayers?: string[]` field to `MatchSummary` type (list of player IDs who are ready)

  **Must NOT do**:
  - Do NOT implement handlers yet (Task 5)
  - Do NOT change existing message types — only add new ones
  - Do NOT break existing CharacterSheet structure — use optional fields

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding type definitions to a single file. Clear spec, no ambiguity.
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: TypeScript type design
  - **Skills Evaluated but Omitted**:
    - `playwright`: No testing needed for type definitions

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0A (with Tasks 1, 2, 3)
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `shared/types.ts:102-115` — Current `ClientToServerMessage` union type. Follow same pattern for new messages.
  - `shared/types.ts:117-160` — Current `ServerToClientMessage` union type. Follow same pattern.

  **API/Type References**:
  - `shared/rulesets/characterSheet.ts` — `CharacterSheet` union type. Where to add `isFavorite` field.
  - `shared/types.ts:MatchSummary` — Where to add `readyPlayers` field.

  **WHY Each Reference Matters**:
  - `shared/types.ts` is THE file to edit — need exact line numbers for union types
  - `characterSheet.ts` is where the character type lives — need to add optional field

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  grep -c "list_characters" shared/types.ts
  # Assert: >= 2 (client message + server response)
  
  grep -c "save_character" shared/types.ts
  # Assert: >= 2 (client message + server response)
  
  grep -c "delete_character" shared/types.ts
  # Assert: >= 2 (client message + server response)
  
  grep -c "player_ready" shared/types.ts
  # Assert: >= 2 (client message + server broadcast)
  
  grep -c "isFavorite" shared/rulesets/gurps/characterSheet.ts
  # Assert: >= 1 (field added to GURPS sheet)
  
  grep -c "isFavorite" shared/rulesets/pf2/characterSheet.ts
  # Assert: >= 1 (field added to PF2 sheet)
  
  grep -c "update_match_settings" shared/types.ts
  # Assert: >= 1 (match settings message)
  
  grep -c "match_settings_updated" shared/types.ts
  # Assert: >= 1 (match settings broadcast)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Evidence to Capture:**
  - [ ] Grep output confirming all new message types exist (including update_match_settings)
  - [ ] Build output confirming type consistency

  **Commit**: YES
  - Message: `feat(types): add WS message types for character roster, ready system, match settings, and visibility`
  - Files: `shared/types.ts`, `shared/rulesets/characterSheet.ts`
  - Pre-commit: `npm run build`

---

- [x] 5. Implement server handlers for new WS messages

  **What to do**:
  - Add `is_favorite` column to `characters` table in DB schema (boolean, default false)
  - Add `is_public` column to `matches` table (boolean, default false)
  - Implement `list_characters` handler: call existing `loadCharactersByOwner(userId)` from `server/src/db.ts`, add `isFavorite` from DB, send `character_list` response
  - Implement `save_character` handler: call existing `upsertCharacter(character, userId)` from `server/src/db.ts`, set `owner_id` from authenticated user, send `character_saved` confirmation. This is the standalone Armory save — no matchId required.
  - Implement `delete_character` handler: verify ownership via `owner_id` check, delete from DB (add `deleteCharacter(characterId, userId)` to db.ts), send `character_deleted` confirmation
  - Implement `toggle_favorite` handler: update `is_favorite` in DB, send `character_favorited` confirmation
  - Update `auth_ok` response in auth handler (`server/src/handlers.ts` case "auth"): include `activeMatches` field with user's non-finished matches (call existing `getUserMatches(userId)` filtered by status !== 'finished')
  - Implement `player_ready` handler: track ready state per player in match (in-memory `Map<matchId, Set<playerId>>`), broadcast `player_ready_update` to all match members, send `all_players_ready` when all human players ready
  - Implement `update_match_settings` handler: validate `userId === match.creatorId`, validate `match.status === 'waiting'`, update DB, broadcast `match_settings_updated` to all members. Non-creators get `{ type: 'error', message: 'Only the match creator can change settings' }`
  - **Server-side ready enforcement in `start_combat` handler**: Before creating the match state, validate ALL human players (non-bot, non-spectator) are in the ready set. If not, reject with `{ type: 'error', message: 'Not all players are ready' }`. Disconnected players are removed from the ready set on disconnect; on reconnect their ready state resets to false.
  - Add `is_public` to `create_match` handler: accept optional `isPublic` field (default false), store in DB. NOTE: `list_public_matches` remains UNCHANGED (returns active/paused for spectating). Public waiting matches are served by the NEW `list_public_waiting` handler (see below).
  - Add DB migrations for new columns following the existing pattern at `server/src/db.ts:82-86` (PRAGMA table_info + conditional ALTER TABLE — NOT try/catch, uses `db.prepare("PRAGMA table_info(tableName)").all()` to check if column exists, then `db.exec("ALTER TABLE ...")` if missing):
    - `ALTER TABLE characters ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0` — in `server/src/db.ts` init block
    - `ALTER TABLE matches ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0` — in `server/src/db.ts` init block
    - Fresh DB: update the CREATE TABLE statements at `server/src/db.ts:40` (characters) and `server/src/db.ts:49` (matches) to include the new columns
    - Update TypeScript row types in `server/src/types.ts` if they exist, OR use explicit local types in query functions
  - Add `getPublicWaitingMatches()` function in `server/src/db.ts` — SELECT from matches WHERE `is_public = 1 AND status = 'waiting'`
  - Implement `list_public_waiting` handler: call `getPublicWaitingMatches()`, map through the NEW `buildJoinableMatchSummary()` function (which preserves `code` — see "Public Match Semantics" section), send `public_waiting_list`. Do NOT use `buildPublicMatchSummary()` here (that masks `code: ''` and is for spectating only).
  - Update `loadCharactersByOwner()` in `server/src/db.ts` to SELECT `is_favorite` column and merge into the CharacterSheet JSON as `isFavorite: boolean`

  **Must NOT do**:
  - Do NOT modify existing message handlers
  - Do NOT change combat action handlers
  - Do NOT add complex permission system — just ownership checks

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Server-side changes across DB, handlers, and state management. Must not break existing flow.
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: WebSocket message patterns (shared with client)
  - **Skills Evaluated but Omitted**:
    - `playwright`: Server-side, no browser needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1, 2, 3 — NOT 4, needs types first)
  - **Parallel Group**: Wave 0B (after Task 4 completes)
  - **Blocks**: Tasks 10, 18
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - `server/src/handlers.ts:164-181` — Existing `create_match` handler. Follow same pattern for new handlers.
  - `server/src/handlers.ts:case "select_character"` — Existing character handler. Follow same pattern.
  - `server/src/db.ts` — Database functions. Has `loadCharactersByOwner()`, `upsertCharacter()`. Add `deleteCharacter()`, `toggleFavorite()`.

  **API/Type References**:
  - `shared/types.ts` — New message types from Task 4

  **WHY Each Reference Matters**:
  - `handlers.ts` shows the exact pattern for handling messages — must follow same error handling and broadcast patterns
  - `db.ts` has the existing DB functions — must follow same SQLite patterns

  **Acceptance Criteria**:

  ```bash
  # Agent runs (after starting server):
  # Test list_characters handler exists in code
  grep -c "list_characters" server/src/handlers.ts
  # Assert: >= 1
  
  grep -c "delete_character" server/src/handlers.ts
  # Assert: >= 1
  
  grep -c "player_ready" server/src/handlers.ts
  # Assert: >= 1
  
  grep -c "update_match_settings" server/src/handlers.ts
  # Assert: >= 1
  
  grep -c "save_character" server/src/handlers.ts
  # Assert: >= 1 (standalone save handler)
  
  grep -c "is_favorite" server/src/db.ts
  # Assert: >= 1
  
  grep -c "deleteCharacter" server/src/db.ts
  # Assert: >= 1 (delete function exists)
  
  # Verify ready enforcement in start_combat
  grep -c "Not all players are ready\|readyPlayers\|readySet" server/src/handlers.ts
  # Assert: >= 1 (server-side ready check exists)
  
  # Verify auth_ok includes activeMatches
  grep -c "activeMatches" server/src/handlers.ts
  # Assert: >= 1
  
  npm run build --prefix server 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Runtime Verification (requires running server):**
  ```bash
  # Start server, then use wscat or node script to test:
  
  # 1. Verify public waiting matches return code, spectate matches don't:
  # Send: { "type": "list_public_waiting" }
  # Assert response: matches array has `code` field with non-empty string
  # Send: { "type": "list_public_matches" }
  # Assert response: matches array has `code: ""` (code masked)
  
  # 2. Verify ready enforcement:
  # Create match, join with 2 players, do NOT ready
  # Send: { "type": "start_combat", "matchId": "..." }
  # Assert: receives { "type": "error", "message": "Not all players are ready" }
  # Toggle both players ready, then start_combat
  # Assert: receives match_state with status "active"
  ```

  **Evidence to Capture:**
  - [ ] Grep output confirming all handlers exist
  - [ ] Server build output
  - [ ] Runtime test output (if feasible in execution environment)

  **Commit**: YES
  - Message: `feat(server): add handlers for character roster, ready system, public match listings, and match settings`
  - Files: `server/src/handlers.ts`, `server/src/db.ts`
  - Pre-commit: `npm run build --prefix server`

---

### Phase 1: Login / Welcome Screen

- [x] 6. Redesign WelcomeScreen with loading states and connection feedback

  **What to do**:
  - Redesign `WelcomeScreen.tsx` with modern/clean style using CSS tokens from Task 1
  - Add loading spinner on "Enter Arena" button while `connectionState === 'connecting'`
  - Add connection timeout: after 10 seconds of connecting, show error "Server unreachable. Please try again."
  - Disable button during connection attempt
  - Add subtle status indicator: "Connected to server" (green) / "Connecting..." (yellow) / "Offline" (red)
  - Clean typography: larger title, more whitespace, clearer hierarchy
  - Keep existing validation (3-16 chars, alphanumeric + dash/underscore)
  - **Props change**: Expand props from `{ onComplete, authError }` to `{ onComplete, authError, connectionState }`. The `connectionState` prop (type: `'disconnected' | 'connecting' | 'connected'`) is needed for the loading spinner and status indicator. This is an allowed additive change.
  - **CRITICAL**: Currently `App.tsx:180-192` intercepts `connectionState === 'connecting'` with a full-screen "Connecting to server..." div, which PREVENTS WelcomeScreen from rendering during connection. **This early return must be removed** as part of Task 6. The connecting/loading/timeout UX moves INTO WelcomeScreen itself (the spinner shows on the "Enter Arena" button after the user clicks it, not on initial page load). On initial page load with no session token, the app is in `disconnected` state and WelcomeScreen renders immediately. The "connecting" state only occurs AFTER the user submits their name.
  - Keep "How to Play" button and Tutorial integration
  - Apply CSS tokens throughout (replace hardcoded colors)
  - Mobile: full-width card, reduced padding, same functionality
  - Navigate to `/home` instead of `/matches` after successful auth

  **Must NOT do**:
  - Do NOT add email/password auth — keep nickname only
  - Do NOT add OAuth or social login
  - Do NOT change the WebSocket auth protocol

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI redesign with visual polish, responsive layout, loading states
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Modern UI design, loading state patterns, responsive layout
  - **Skills Evaluated but Omitted**:
    - `playwright`: E2e tests come in Phase 5

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Phase 1)
  - **Blocks**: Tasks 7, 8, 10, 11-14
  - **Blocked By**: Tasks 1, 2, 3 (Phase 0 complete)

  **References**:

  **Pattern References**:
  - `src/components/WelcomeScreen.tsx` — Current component to redesign. Keep same props interface `{ onComplete, authError }`.
  - `src/components/WelcomeScreen.css` — Current styling. Replace with token-based CSS.
  - `src/hooks/useAuth.ts` (after Task 2) — Provides `connectionState`, `register()`, `authError`. The `connectionState` value must be passed as a new prop to WelcomeScreen.

  **WHY Each Reference Matters**:
  - `WelcomeScreen.tsx` is the exact file to rewrite — need to preserve props interface
  - `WelcomeScreen.css` shows current responsive breakpoints to maintain or improve
  - `useAuth.ts` is the data source — need to know exactly what state is available

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  grep -c "var(--" src/components/WelcomeScreen.css
  # Assert: >= 5 (CSS tokens in use)
  
  grep -c "connecting" src/components/WelcomeScreen.tsx
  # Assert: >= 1 (loading state handled)
  
  grep -c "timeout\|Timeout\|TIMEOUT" src/components/WelcomeScreen.tsx
  # Assert: >= 1 (timeout implemented)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Automated Verification (Playwright):**
  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: http://localhost:5173/
  2. Assert: input[placeholder] is visible
  3. Assert: button "Enter Arena" is visible
  4. Assert: No loading spinner initially
  5. Fill: input with "TestPlayer"
  6. Click: "Enter Arena"
  7. Assert: Loading spinner or disabled state appears on button
  8. Wait for: navigation to /home (with running server) or timeout error (with dead WS port)
  9. Screenshot: .sisyphus/evidence/task-6-login-redesign.png
  ```

  **Commit**: YES
  - Message: `feat(ui): redesign welcome screen with loading states, timeout, and modern styling`
  - Files: `src/components/WelcomeScreen.tsx`, `src/components/WelcomeScreen.css`
  - Pre-commit: `npm run build && npx vitest run`

---

### Phase 2: Dashboard / Home

- [ ] 7. Build Dashboard layout and match list

  **What to do**:
  - Create `src/components/Dashboard.tsx` replacing the placeholder from Task 3
  - Create `src/components/Dashboard.css` with modern/clean design using CSS tokens
  - Layout: Header bar (username, logout, nav to armory) + Main content area
  - Main content sections:
    - **Quick Actions row**: "New Match" (primary CTA), "Join by Code" (secondary)
    - **Your Turn** section: matches where it's the player's turn (highlighted, prominent)
    - **Active Matches** section: in-progress matches
    - **Waiting for Players** section: lobby-state matches
    - **Recent Completed** section: last 5 finished matches (collapsible)
  - Reuse `MatchCard.tsx` component (update styling to use tokens)
  - Empty state for new users: "No matches yet. Create your first match!"
  - Auto-refresh match list every 5 seconds (migrate from MatchBrowser)
  - Navigation: "New Match" → opens dialog (Task 9), Match card click → `/lobby/:matchId` or `/game/:matchId`
  - Header nav: "Armory" link → `/armory`
  - Mobile: single column, sticky header, scrollable content
  - Desktop: max-width container (1200px), centered

  **Must NOT do**:
  - Do NOT build match creation dialog yet (Task 9)
  - Do NOT build stats component yet (Task 8)
  - Do NOT add spectating UI here — keep it simple for now

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Full page design with multiple sections, responsive layout, component reuse
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Dashboard layout, card-based design, responsive patterns
  - **Skills Evaluated but Omitted**:
    - `playwright`: E2e tests come in Phase 5

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 8)
  - **Parallel Group**: Phase 2A
  - **Blocks**: Task 9
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - `src/components/MatchBrowser.tsx` — Current match list component. Migrate core logic (match categorization, auto-refresh, join-by-code).
  - `src/components/MatchCard.tsx` — Reuse this component (update CSS to use tokens).
  - `src/components/LobbyBrowser.css` — Current match browser styling. Reference for responsive patterns.

  **API/Type References**:
  - `shared/types.ts:MatchSummary` — Match data shape displayed in cards
  - `src/hooks/useMatches.ts` (after Task 2) — Provides `myMatches`, `publicMatches`, `refreshMyMatches()`

  **WHY Each Reference Matters**:
  - `MatchBrowser.tsx` has all the match list logic to migrate — don't rewrite from scratch
  - `MatchCard.tsx` is reused — need to know its props interface
  - `useMatches.ts` is the data source for match listings

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  test -f src/components/Dashboard.tsx && echo "EXISTS" || echo "MISSING"
  # Assert: "EXISTS"
  
  test -f src/components/Dashboard.css && echo "EXISTS" || echo "MISSING"
  # Assert: "EXISTS"
  
  grep -c "var(--" src/components/Dashboard.css
  # Assert: >= 10 (CSS tokens used extensively)
  
  grep -c "MatchCard" src/components/Dashboard.tsx
  # Assert: >= 1 (MatchCard component reused)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Commit**: YES
  - Message: `feat(ui): build dashboard home page with match list, quick actions, and empty states`
  - Files: `src/components/Dashboard.tsx`, `src/components/Dashboard.css`, `src/components/MatchCard.tsx` (token updates)
  - Pre-commit: `npm run build && npx vitest run`

---

- [x] 8. Build stats summary component

  **What to do**:
  - Create `src/components/dashboard/StatsBar.tsx` — compact stats row for the dashboard
  - Display: Total Matches, Wins, Losses, Win Rate (%)
  - Derive stats from `myMatches` array: filter by `status === 'finished'`, then check `match.winnerId === currentUser.id` for wins. Use `MatchSummary.winnerId` (`shared/types.ts:98`) and `MatchSummary.winnerName` (`shared/types.ts:99`). Losses = finished matches where `winnerId` exists but !== currentUser.id.
  - Clean card-based design: 4 stat boxes in a row (flex, gap)
  - Each stat: label (muted) + value (bold, large)
  - Win rate: color-coded (green >50%, yellow 40-50%, red <50%)
  - No server-side aggregation — client-side derivation only
  - Mobile: 2x2 grid instead of 1x4 row
  - If no finished matches: show "--" for all values

  **Must NOT do**:
  - Do NOT add a chart/graph library
  - Do NOT create a stats API on the server
  - Do NOT add ELO or ranking calculations

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Small visual component with data derivation
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Stat display design, color coding

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 7)
  - **Parallel Group**: Phase 2A
  - **Blocks**: None
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - `src/components/MatchCard.tsx` — Card styling patterns to follow
  
  **API/Type References**:
  - `shared/types.ts:MatchSummary` — Match data structure. Check for `status`, `winner` fields.

  **WHY Each Reference Matters**:
  - `MatchSummary` determines what data is available for stat derivation

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  test -f src/components/dashboard/StatsBar.tsx && echo "EXISTS" || echo "MISSING"
  # Assert: "EXISTS"
  
  grep -c "Win\|Loss\|Total\|Rate" src/components/dashboard/StatsBar.tsx
  # Assert: >= 3 (stat labels present)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Commit**: YES (groups with Task 7)
  - Message: `feat(ui): add stats summary bar to dashboard`
  - Files: `src/components/dashboard/StatsBar.tsx`, `src/components/dashboard/StatsBar.css`
  - Pre-commit: `npm run build`

---

- [x] 9. Build match creation dialog

  **What to do**:
  - Create `src/components/dashboard/CreateMatchDialog.tsx` — modal dialog opened from Dashboard
  - Fields:
    - Match name: text input (default: `"{username}'s Battle"`, editable)
    - Ruleset: toggle buttons (GURPS 4e / Pathfinder 2e) with icons or labels
    - Max players: number selector (2-6, default 4)
    - Visibility: toggle switch (Public / Private, default Private)
  - Buttons: "Create Match" (primary), "Cancel" (secondary)
  - Loading state on "Create Match" button during creation
  - On success: navigate to `/lobby/:matchId`
  - On error: show error message in dialog
  - Backdrop: semi-transparent overlay, close on backdrop click or Escape
  - Mobile: dialog fills width with padding, same fields
  - Use CSS tokens throughout

  **Must NOT do**:
  - Do NOT add advanced options (timer, map selection, house rules) — keep essential
  - Do NOT add match templates or presets
  - Do NOT change server-side match creation logic beyond adding `isPublic`

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Modal dialog with form inputs, loading states, responsive design
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Form design, modal patterns, toggle controls

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Phase 2B (after Task 7)
  - **Blocks**: Task 17
  - **Blocked By**: Task 7

  **References**:

  **Pattern References**:
  - `src/components/rulesets/pf2/PathbuilderImport.tsx` — Existing modal dialog pattern. Follow same `.modal-overlay` + `.modal-content` structure.
  - `src/App.css:3979-4160` — Existing modal styles (lobby-setup-modal). Follow similar responsive pattern.

  **API/Type References**:
  - `shared/types.ts:ClientToServerMessage` — `create_match` message type. Check required fields.
  - `src/hooks/useMatches.ts` — Provides `createMatch()` function (after Task 2)

  **WHY Each Reference Matters**:
  - `PathbuilderImport.tsx` shows the existing modal pattern — reuse for consistency
  - `create_match` message defines what data must be collected in the form

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  test -f src/components/dashboard/CreateMatchDialog.tsx && echo "EXISTS" || echo "MISSING"
  # Assert: "EXISTS"
  
  grep -c "ruleset\|rulesetId" src/components/dashboard/CreateMatchDialog.tsx
  # Assert: >= 2 (ruleset selector present)
  
  grep -c "maxPlayers\|max_players" src/components/dashboard/CreateMatchDialog.tsx
  # Assert: >= 1 (max players field)
  
  grep -c "isPublic\|visibility\|public" src/components/dashboard/CreateMatchDialog.tsx
  # Assert: >= 1 (visibility toggle)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Commit**: YES
  - Message: `feat(ui): add match creation dialog with ruleset, players, and visibility options`
  - Files: `src/components/dashboard/CreateMatchDialog.tsx`, `src/components/dashboard/CreateMatchDialog.css`
  - Pre-commit: `npm run build && npx vitest run`

---

### Phase 3: Character Armory

- [x] 10. Build character roster list view

  **What to do**:
  - Create `src/components/armory/CharacterArmory.tsx` replacing the placeholder from Task 3
  - Create `src/components/armory/CharacterArmory.css`
  - Layout: Header (title "Armory", back to /home, "New Character" button) + Filter bar + Character grid
  - Filter bar: Ruleset filter (All / GURPS / PF2), Sort (Name / Date / Favorite)
  - Character grid: cards showing each character
  - Character card displays: Name, Ruleset badge (GURPS/PF2), Class/Template, Key stats (HP, main attribute), Favorite star toggle
  - Card actions: Click → open editor, Delete button (with confirmation), Duplicate button
  - Empty state: "No characters yet. Create your first!" with CTA button
  - Fetch characters on mount via `list_characters` WS message (from `useCharacterRoster` hook)
  - Mobile: single column card list, full-width cards
  - Desktop: 3-column grid, max-width 1200px
  - Use CSS tokens throughout

  **Must NOT do**:
  - Do NOT build the character editor here (Tasks 11-14)
  - Do NOT add character import/export
  - Do NOT add character sharing between users

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Grid layout with cards, filters, CRUD actions, responsive design
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Card grid layout, filter patterns, empty states

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 11)
  - **Parallel Group**: Phase 3A
  - **Blocks**: Task 16
  - **Blocked By**: Tasks 5, 6

  **References**:

  **Pattern References**:
  - `src/components/MatchBrowser.tsx` — List + filter pattern. Follow similar categorization approach.
  - `src/components/MatchCard.tsx` — Card component pattern. Create similar `CharacterCard.tsx`.

  **API/Type References**:
  - `shared/rulesets/characterSheet.ts` — CharacterSheet union type. What fields are available for display.
  - `src/hooks/useCharacterRoster.ts` (from Task 2) — Provides `characters`, `deleteCharacter()`, `toggleFavorite()`
  - `shared/types.ts` — New `list_characters`, `delete_character`, `toggle_favorite` messages (from Task 4)

  **WHY Each Reference Matters**:
  - `characterSheet.ts` defines what data each character card can display
  - `useCharacterRoster.ts` is the data source for the list
  - `MatchCard.tsx` shows the card pattern to follow for consistency

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  test -f src/components/armory/CharacterArmory.tsx && echo "EXISTS" || echo "MISSING"
  # Assert: "EXISTS"
  
  grep -c "list_characters\|character_list\|useCharacterRoster" src/components/armory/CharacterArmory.tsx
  # Assert: >= 1 (connected to roster hook/messages)
  
  grep -c "filter\|Filter\|ruleset" src/components/armory/CharacterArmory.tsx
  # Assert: >= 2 (filter UI present)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Commit**: YES
  - Message: `feat(ui): build character armory with roster list, filters, and card grid`
  - Files: `src/components/armory/CharacterArmory.tsx`, `src/components/armory/CharacterArmory.css`, `src/components/armory/CharacterCard.tsx`, `src/components/armory/CharacterCard.css`
  - Pre-commit: `npm run build && npx vitest run`

---

- [x] 11. Build character editor — Attributes tab

  **What to do**:
  - Create `src/components/armory/CharacterEditor.tsx` — tab-based editor replacing old modal editor
  - Create `src/components/armory/CharacterEditor.css`
  - Tab bar: Attributes | Skills | Equipment | Traits (horizontal tabs)
  - Attributes tab content:
    - GURPS: Name input, Template selector (6 templates as cards), ST/DX/IQ/HT with +/- controls (range 7-20), Derived stats display (HP, FP, Speed, Move, Dodge — read-only, auto-calculated), Point total display
    - PF2: Name input, Class selector (6 classes as cards), Level display, STR/DEX/CON/INT/WIS/CHA with +/- controls (range 1-30), Derived combat stats (HP, AC, Speed — read-only), Save proficiencies display
  - Use `isGurpsCharacter()` / `isPF2Character()` type guards to render correct fields
  - Editor opens as full-width panel within Armory page (not a modal)
  - Back button returns to roster list
  - Save button at bottom (persists via new `save_character` WS message — standalone, no matchId required. See "WebSocket Contracts" section.)
  - "New Character" flow: call `rulesets[rulesetId].ruleset.createCharacter(name)` from the registry. The actual implementations are at `shared/rulesets/gurps/index.ts:48` (GURPS `createCharacter`) and `shared/rulesets/pf2/index.ts` (PF2 `createCharacter`). The registry is at `shared/rulesets/index.ts`. Client calls this to get an initial CharacterSheet, then user edits, then sends `save_character`.
  - Auto-save indicator (optional: "Unsaved changes" warning)
  - Mobile: single column, tabs scroll horizontally
  - Apply CSS tokens

  **Must NOT do**:
  - Do NOT build Skills, Equipment, or Traits tabs yet (Tasks 12-14)
  - Do NOT change CharacterSheet type structure
  - Do NOT change derived stat calculation logic (`shared/rulesets/gurps/rules.ts`, `shared/rulesets/pf2/rules.ts`)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Complex form with tab navigation, conditional rendering by ruleset, responsive design
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Form design, tab navigation, conditional UI patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 10, 12, 13, 14)
  - **Parallel Group**: Phase 3A
  - **Blocks**: Task 15
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - `src/components/rulesets/gurps/GurpsCharacterEditor.tsx` — Current GURPS editor. Migrate attribute section logic.
  - `src/components/rulesets/pf2/PF2CharacterEditor.tsx` — Current PF2 editor. Migrate attribute/class section logic.
  - `src/components/rulesets/useCharacterEditor.ts` — Shared hook for character editing. Reuse `updateAttribute()`, template loading.

  **API/Type References**:
  - `shared/rulesets/gurps/types.ts` — GURPS attribute types, ranges
  - `shared/rulesets/pf2/types.ts` — PF2 ability types, ranges
  - `shared/rulesets/gurps/rules.ts` — Derived stat calculations (HP, FP, Speed, Move, Dodge)
  - `shared/rulesets/pf2/rules.ts` — PF2 derived stat calculations

  **WHY Each Reference Matters**:
  - Current editors have the logic to migrate — don't rewrite calculations from scratch
  - `useCharacterEditor.ts` has the shared editing hook — extend or adapt it
  - Type files define valid ranges and fields for each ruleset

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  test -f src/components/armory/CharacterEditor.tsx && echo "EXISTS" || echo "MISSING"
  # Assert: "EXISTS"
  
  grep -c "Attributes\|Skills\|Equipment\|Traits" src/components/armory/CharacterEditor.tsx
  # Assert: >= 4 (all tab labels present)
  
  grep -c "isGurpsCharacter\|isPF2Character" src/components/armory/CharacterEditor.tsx
  # Assert: >= 2 (type guards used for conditional rendering)
  
  grep -c "window.prompt" src/components/armory/CharacterEditor.tsx
  # Assert: 0 (no prompt() calls)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Commit**: YES
  - Message: `feat(ui): build tab-based character editor with Attributes tab`
  - Files: `src/components/armory/CharacterEditor.tsx`, `src/components/armory/CharacterEditor.css`
  - Pre-commit: `npm run build && npx vitest run`

---

- [x] 12. Build character editor — Skills tab (replace prompt())

  **What to do**:
  - Add Skills tab content to `CharacterEditor.tsx`
  - GURPS skills: list of skills with Name + Level (1-20). Inline "Add Skill" form with name text input + level number input + "Add" button. Remove button per skill.
  - PF2 skills: list of skills with Name + Ability + Proficiency. Inline "Add Skill" form with name input + ability dropdown (str/dex/con/int/wis/cha, from `PF2Skill.ability: keyof Abilities`) + proficiency dropdown (untrained/trained/expert/master/legendary) + "Add" button. Remove button per skill. Source of truth: `shared/rulesets/pf2/types.ts:27` — `PF2Skill = { id, name, ability, proficiency }`.
  - **Replace `window.prompt()` calls** for skills in `useCharacterEditor.ts` with proper state-managed inline forms. Skill-related prompts are at lines 83, 87, 93, 99 (4 calls for PF2: name, ability, proficiency; 1 call for GURPS: level).
  - Skill name input should have a basic autocomplete/suggestion list from common GURPS skills (Broadsword, Shield, Knife, etc.) or PF2 skills (Athletics, Acrobatics, Stealth, etc.)
  - Skills displayed as compact list items with hover highlight
  - Mobile: full-width list items, larger touch targets

  **Must NOT do**:
  - Do NOT add a full skill database — just a hardcoded suggestion list of ~20 common skills per ruleset
  - Do NOT change skill data model
  - Do NOT add skill dependencies or prerequisites

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Form with inline add/remove, autocomplete, ruleset-conditional rendering
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Inline form patterns, autocomplete, list management

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 10, 11, 13, 14)
  - **Parallel Group**: Phase 3A
  - **Blocks**: None
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - `src/components/rulesets/useCharacterEditor.ts:82-120` — Current `window.prompt()` calls for skills. REPLACE these.
  - `src/data/characterTemplates.ts` — GURPS skill names used in templates. Use as autocomplete source.
  - `src/data/pf2CharacterTemplates.ts` — PF2 skill names used in templates. Use as autocomplete source.

  **WHY Each Reference Matters**:
  - `useCharacterEditor.ts` is where prompt() calls live — must replace in-place
  - Template files have curated skill lists — reuse for autocomplete suggestions

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  grep -c "window.prompt" src/components/rulesets/useCharacterEditor.ts
  # Assert: Reduced from 8 (check that skill-related prompts are gone)
  
  grep -c "window.prompt" src/components/armory/CharacterEditor.tsx
  # Assert: 0 (no prompts in new editor)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Commit**: YES
  - Message: `feat(ui): add Skills tab to character editor with inline forms replacing prompt()`
  - Files: `src/components/armory/CharacterEditor.tsx`, `src/components/rulesets/useCharacterEditor.ts`
  - Pre-commit: `npm run build && npx vitest run`

---

- [x] 13. Build character editor — Equipment tab (replace prompt())

  **What to do**:
  - Add Equipment tab content to `CharacterEditor.tsx`
  - GURPS equipment: list with Name + Damage + Damage Type + Reach + Parry. Inline "Add Equipment" form with text inputs for each field + damage type dropdown (crushing/cutting/impaling/piercing) + "Add" button.
  - PF2 weapons: uses `PF2CharacterWeapon` from `shared/rulesets/pf2/characterSheet.ts:17`. Required fields: `id`, `name`, `damage` (string, e.g. "1d8"), `damageType` (PF2DamageType), `proficiencyCategory` ('simple'|'martial'|'advanced'|'unarmed'), `traits` (PF2WeaponTrait[]), `potencyRune` (number, default 0), `strikingRune` ('striking'|'greater_striking'|'major_striking'|null, default null). Inline "Add Weapon" form with: name input, damage input, damageType dropdown, proficiencyCategory dropdown, traits multi-select checkboxes. **Defaults for rune fields**: potencyRune=0, strikingRune=null (Level 1 characters have no runes).
  - **Replace `window.prompt()` calls** for equipment in `useCharacterEditor.ts` (lines 117, 119, 120 — name, damage, damageType: 3 calls)
  - Equipment name autocomplete from template weapons (~15 common weapons per ruleset)
  - When weapon selected from autocomplete, auto-fill damage/type fields
  - Remove button per item
  - GURPS: Also show armor section if applicable (simple select from common armors)
  - PF2: Show armor + shield sections
  - Mobile: stacked form fields, full-width

  **Must NOT do**:
  - Do NOT add a complete weapons database — just common weapons from templates
  - Do NOT change equipment data model
  - Do NOT add inventory management (weight, cost, etc.)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Complex form with autocomplete, auto-fill, multiple field types
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Complex form patterns, autocomplete with auto-fill

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 10, 11, 12, 14)
  - **Parallel Group**: Phase 3A
  - **Blocks**: None
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - `src/components/rulesets/useCharacterEditor.ts:120-168` — Current `window.prompt()` calls for equipment. REPLACE these.
  - `src/data/characterTemplates.ts` — GURPS weapon data from templates. Reuse as autocomplete + auto-fill source.
  - `src/data/pf2CharacterTemplates.ts` — PF2 weapon data from templates.

  **API/Type References**:
  - `shared/rulesets/gurps/types.ts:Equipment` — Equipment type definition (name, type, damage, damageType, reach, parry, block)
  - `shared/rulesets/pf2/types.ts:PF2Weapon` — Weapon type definition

  **WHY Each Reference Matters**:
  - Equipment type definitions determine what fields the form must collect
  - Template weapons provide the autocomplete data source with correct damage values

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  grep -c "window.prompt" src/components/rulesets/useCharacterEditor.ts
  # Assert: Further reduced (equipment prompts gone)
  
  grep -c "damageType\|damage_type" src/components/armory/CharacterEditor.tsx
  # Assert: >= 1 (damage type selector present)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Commit**: YES
  - Message: `feat(ui): add Equipment tab to character editor with inline forms and autocomplete`
  - Files: `src/components/armory/CharacterEditor.tsx`, `src/components/rulesets/useCharacterEditor.ts`
  - Pre-commit: `npm run build && npx vitest run`

---

- [ ] 14. Build character editor — Traits tab (replace prompt())

  **What to do**:
  - Add Traits tab content to `CharacterEditor.tsx`
  - GURPS: Two sections — Advantages and Disadvantages. Each has: list with Name + optional Description. Inline "Add" form with name input + optional description textarea + "Add" button.
  - PF2: Single Feats section. List with Name + Type (class/ancestry/general/skill) + Level + optional Description. Inline "Add" form with inputs + type dropdown.
  - **Replace remaining 4 `window.prompt()` calls** in `useCharacterEditor.ts` (lines 143, 145 for advantages: name + description; lines 158, 160 for disadvantages: name + description)
  - Name autocomplete from template data (~15 common traits per ruleset)
  - Remove button per item
  - After this task: **ZERO `window.prompt()` calls should remain in the entire codebase**
  - Mobile: stacked layout, full-width

  **Must NOT do**:
  - Do NOT add a complete advantage/disadvantage database
  - Do NOT add point cost calculations for individual traits (keep total calculation)
  - Do NOT add trait prerequisite validation

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Form with conditional sections per ruleset, autocomplete
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: List management patterns, conditional forms

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 10, 11, 12, 13)
  - **Parallel Group**: Phase 3A
  - **Blocks**: None
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - `src/components/rulesets/useCharacterEditor.ts` — Remaining `window.prompt()` calls for advantages/disadvantages/feats. ALL must be replaced.
  - `src/data/characterTemplates.ts` — GURPS advantage/disadvantage names from templates.
  - `src/data/pf2CharacterTemplates.ts` — PF2 feat names from templates.

  **API/Type References**:
  - `shared/rulesets/gurps/types.ts:Advantage, Disadvantage` — Type definitions
  - `shared/rulesets/pf2/characterSheet.ts:37` — `PF2Feat` type definition (name, type, level, description). NOTE: This is in characterSheet.ts, NOT types.ts.

  **WHY Each Reference Matters**:
  - Type definitions determine form fields
  - Template data provides autocomplete source

  **Acceptance Criteria**:

  ```bash
  # Agent runs — CRITICAL: verify ALL prompts gone from entire codebase
  grep -r "window.prompt" src/ --include="*.ts" --include="*.tsx" | wc -l
  # Assert: Output is "0" (ZERO window.prompt calls in entire src/)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Commit**: YES
  - Message: `feat(ui): add Traits tab to character editor, eliminate all window.prompt() usage`
  - Files: `src/components/armory/CharacterEditor.tsx`, `src/components/rulesets/useCharacterEditor.ts`
  - Pre-commit: `npm run build && npx vitest run`

---

- [x] 15. Integrate Pathbuilder import in new editor

  **What to do**:
  - Add "Import from Pathbuilder" button to PF2 character editor (visible only when `rulesetId === 'pf2'`)
  - Reuse existing `PathbuilderImport.tsx` component or adapt it for the new editor context
  - When import succeeds: populate all tabs (attributes, skills, equipment, feats) with imported data
  - Keep existing import-by-ID and upload-JSON tabs
  - Position: top of editor (above tabs) or as a special action button in header
  - After import: user can still edit before saving

  **Must NOT do**:
  - Do NOT rewrite Pathbuilder parsing logic (reuse `pathbuilderImporter.ts`)
  - Do NOT add GURPS import (no equivalent exists)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Integration of existing component into new editor layout
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Modal integration, data flow between components

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 14)
  - **Parallel Group**: Phase 3B
  - **Blocks**: None
  - **Blocked By**: Task 11

  **References**:

  **Pattern References**:
  - `src/components/rulesets/pf2/PathbuilderImport.tsx` — Existing import component. Reuse or adapt.
  - `src/services/pathbuilderImporter.ts` — Import logic. Do not modify.
  - `src/services/pathbuilderImporter.test.ts` — Existing tests. Must still pass.

  **WHY Each Reference Matters**:
  - `PathbuilderImport.tsx` is the existing working component — reuse to avoid rework
  - `pathbuilderImporter.ts` is the parsing engine — must not break

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  grep -c "PathbuilderImport\|pathbuilder" src/components/armory/CharacterEditor.tsx
  # Assert: >= 1 (Pathbuilder integration present)
  
  npx vitest run src/services/pathbuilderImporter.test.ts 2>&1 | tail -5
  # Assert: All tests pass
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Commit**: YES
  - Message: `feat(ui): integrate Pathbuilder import into new character editor for PF2`
  - Files: `src/components/armory/CharacterEditor.tsx`
  - Pre-commit: `npm run build && npx vitest run`

---

- [x] 16. Build character picker for lobby integration

  **What to do**:
  - Create `src/components/armory/CharacterPicker.tsx` — reusable component for selecting a character from the roster
  - Shows character roster as compact selectable cards (name, class, key stats)
  - Filter by ruleset (auto-filtered to match's ruleset in lobby context)
  - "Select" button per card
  - "Quick Create" button → navigates to armory to create new character
  - Selected character: highlighted card with checkmark
  - This component will be used in the Lobby screen (Task 19)
  - Mobile: scrollable horizontal card list or full-width vertical list

  **Must NOT do**:
  - Do NOT integrate into lobby yet (Task 19)
  - Do NOT add inline character editing — picker only

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Reusable selector component with filter and selection state
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Selection patterns, compact card layouts

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 15)
  - **Parallel Group**: Phase 3B
  - **Blocks**: Task 19
  - **Blocked By**: Task 10

  **References**:

  **Pattern References**:
  - `src/components/armory/CharacterCard.tsx` (from Task 10) — Compact version of this for picker
  - `src/hooks/useCharacterRoster.ts` — Data source for character list

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  test -f src/components/armory/CharacterPicker.tsx && echo "EXISTS" || echo "MISSING"
  # Assert: "EXISTS"
  
  grep -c "onSelect\|onCharacterSelect" src/components/armory/CharacterPicker.tsx
  # Assert: >= 1 (selection callback present)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Commit**: YES
  - Message: `feat(ui): build character picker component for lobby integration`
  - Files: `src/components/armory/CharacterPicker.tsx`, `src/components/armory/CharacterPicker.css`
  - Pre-commit: `npm run build && npx vitest run`

---

### Phase 4: Lobby

- [x] 17. Build lobby full-screen layout

  **What to do**:
  - Create `src/components/lobby/LobbyScreen.tsx` replacing placeholder from Task 3
  - Create `src/components/lobby/LobbyScreen.css`
  - Full-screen layout:
    - Header: Match name, Ruleset badge, Back button → `/home`
    - Left panel (or top on mobile): Player list + Ready status
    - Center: Character preview area
    - Right panel (or bottom on mobile): Match settings + Actions
    - Footer: Invite code/link
  - Fetch match data on mount via `matchId` route param
  - Handle "match not found" — redirect to `/home` with error
  - Handle disconnection — show reconnecting indicator
  - Mobile: single column, sections stacked vertically
  - Desktop: 3-column layout, max-width 1200px
  - Apply CSS tokens

  **Must NOT do**:
  - Do NOT build player list, character preview, or settings yet (Tasks 18-20)
  - Do NOT add chat

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Full-page layout with responsive 3-column grid
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Page layout, responsive grid, section organization

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Phase 4A (sequential start)
  - **Blocks**: Tasks 18, 19, 20
  - **Blocked By**: Task 9

  **References**:

  **Pattern References**:
  - `src/components/game/GameScreen.tsx` — 3-column layout pattern to follow. Also lines 291-393 for lobby overlay to replace.
  - `src/App.tsx` — Route definition for `/lobby/:matchId`

  **API/Type References**:
  - `shared/types.ts:MatchSummary` — Match data available for header display
  - `src/hooks/useMatches.ts` — Match data source

  **WHY Each Reference Matters**:
  - `GameScreen.tsx` has the 3-column pattern that works well on desktop — follow same CSS grid approach
  - Lobby overlay code (lines 291-393) has the current lobby logic to migrate

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  test -f src/components/lobby/LobbyScreen.tsx && echo "EXISTS" || echo "MISSING"
  # Assert: "EXISTS"
  
  grep -c "matchId\|useParams" src/components/lobby/LobbyScreen.tsx
  # Assert: >= 1 (route param used)
  
  grep -c "var(--" src/components/lobby/LobbyScreen.css
  # Assert: >= 10 (CSS tokens used)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Commit**: YES
  - Message: `feat(ui): build full-screen lobby layout with responsive grid`
  - Files: `src/components/lobby/LobbyScreen.tsx`, `src/components/lobby/LobbyScreen.css`
  - Pre-commit: `npm run build && npx vitest run`

---

- [x] 18. Build player list with ready system

  **What to do**:
  - Create `src/components/lobby/PlayerList.tsx` — lobby player list with ready indicators
  - Display each joined player: avatar/icon, name, ready status (green checkmark / gray waiting)
  - "Ready" toggle button for current player → sends `player_ready` WS message
  - Real-time updates when other players toggle ready (via `player_ready_update` WS message)
  - Creator badge (crown icon) on match creator
  - Empty slot indicators for unfilled positions (e.g., "Waiting for player..." with invite hint)
  - Connected/disconnected indicator per player
  - Mobile: horizontal scrollable avatars or vertical compact list

  **Must NOT do**:
  - Do NOT add kick/ban functionality
  - Do NOT add player roles (everyone is equal, except creator starts)
  - Do NOT add voice/chat

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Real-time list with status indicators, WebSocket integration
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Real-time status indicators, toggle patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 19, 20)
  - **Parallel Group**: Phase 4B
  - **Blocks**: Task 21
  - **Blocked By**: Tasks 5, 17

  **References**:

  **Pattern References**:
  - `src/components/game/GameScreen.tsx:300-320` — Current player list in lobby overlay. Migrate and enhance.

  **API/Type References**:
  - `shared/types.ts` — `player_ready` and `player_ready_update` messages (from Task 4)
  - `shared/types.ts:MatchSummary` — `readyPlayers` array (from Task 4)

  **WHY Each Reference Matters**:
  - Current player list has the base logic — enhance with ready indicators
  - New WS messages define the ready system contract

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  test -f src/components/lobby/PlayerList.tsx && echo "EXISTS" || echo "MISSING"
  # Assert: "EXISTS"
  
  grep -c "player_ready\|ready" src/components/lobby/PlayerList.tsx
  # Assert: >= 3 (ready system integrated)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Commit**: YES
  - Message: `feat(ui): build lobby player list with ready system`
  - Files: `src/components/lobby/PlayerList.tsx`, `src/components/lobby/PlayerList.css`
  - Pre-commit: `npm run build && npx vitest run`

---

- [x] 19. Build character preview panel

  **What to do**:
  - Create `src/components/lobby/CharacterPreview.tsx` — shows selected character details in lobby
  - Displays: Character name, Ruleset badge, Class/Template, Attributes summary, Key skills, Equipment list
  - Uses CharacterPicker (from Task 16) to select/change character
  - "Change Character" button opens picker
  - "Edit in Armory" link → `/armory` (with back-to-lobby intent)
  - If no character selected: show picker directly with prompt "Choose your character"
  - GURPS: Show attributes, skills, equipment, point total
  - PF2: Show abilities, class, level, weapons, AC, HP
  - Read-only display (no editing in lobby)
  - Other players' characters: shown as compact cards (name + class only, no full stats — avoid metagaming)

  **Must NOT do**:
  - Do NOT add inline character editing in lobby
  - Do NOT show other players' full character sheets
  - Do NOT add character comparison

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Data display with conditional rendering, component integration
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Data display cards, picker integration

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 18, 20)
  - **Parallel Group**: Phase 4B
  - **Blocks**: Task 21
  - **Blocked By**: Tasks 16, 17

  **References**:

  **Pattern References**:
  - `src/components/armory/CharacterPicker.tsx` (from Task 16) — Integrate picker for character selection
  - `src/components/rulesets/gurps/GurpsCharacterEditor.tsx` — Reference for GURPS stat display layout
  - `src/components/rulesets/pf2/PF2CharacterEditor.tsx` — Reference for PF2 stat display layout

  **API/Type References**:
  - `shared/rulesets/characterSheet.ts` — CharacterSheet union type
  - `shared/rulesets/gurps/types.ts` — GURPS display fields
  - `shared/rulesets/pf2/types.ts` — PF2 display fields

  **WHY Each Reference Matters**:
  - CharacterPicker is the selection mechanism
  - Current editors show what stats are important to display per ruleset

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  test -f src/components/lobby/CharacterPreview.tsx && echo "EXISTS" || echo "MISSING"
  # Assert: "EXISTS"
  
  grep -c "CharacterPicker" src/components/lobby/CharacterPreview.tsx
  # Assert: >= 1 (picker integrated)
  
  grep -c "isGurpsCharacter\|isPF2Character" src/components/lobby/CharacterPreview.tsx
  # Assert: >= 2 (ruleset-specific display)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Commit**: YES
  - Message: `feat(ui): build character preview panel for lobby with picker integration`
  - Files: `src/components/lobby/CharacterPreview.tsx`, `src/components/lobby/CharacterPreview.css`
  - Pre-commit: `npm run build && npx vitest run`

---

- [x] 20. Build match settings and bot controls

  **What to do**:
  - Create `src/components/lobby/MatchSettings.tsx` — settings panel for match creator
  - Bot count: +/- buttons with number display (0-4), using React state (NOT DOM manipulation)
  - Match visibility: toggle switch (Public/Private) — updates via WS message
  - Invite section: Match code display + copy button + shareable URL
  - All settings: only editable by match creator (read-only for others)
  - Non-creator view: shows current settings without edit controls
  - Mobile: compact vertical layout

  **Must NOT do**:
  - Do NOT add turn timer, map selection, or house rules
  - Do NOT use DOM manipulation for bot count (fix the existing bug)
  - Do NOT add match description editing

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Settings panel with role-based UI (creator vs non-creator)
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Settings UI, toggle controls, role-based visibility

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 18, 19)
  - **Parallel Group**: Phase 4B
  - **Blocks**: Task 21
  - **Blocked By**: Task 17

  **References**:

  **Pattern References**:
  - `src/components/game/GameScreen.tsx:340-370` — Current bot count UI (DOM manipulation to replace with React state)
  - `src/components/game/GameScreen.tsx:310-330` — Current invite link section

  **WHY Each Reference Matters**:
  - Current bot count code shows the feature to migrate — must fix DOM manipulation bug
  - Current invite section has the copy-to-clipboard logic to reuse

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  test -f src/components/lobby/MatchSettings.tsx && echo "EXISTS" || echo "MISSING"
  # Assert: "EXISTS"
  
  grep -c "dataset\|querySelector" src/components/lobby/MatchSettings.tsx
  # Assert: 0 (no DOM manipulation)
  
  grep -c "useState\|botCount\|setBotCount" src/components/lobby/MatchSettings.tsx
  # Assert: >= 1 (React state for bot count)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  ```

  **Commit**: YES
  - Message: `feat(ui): build match settings panel with React-state bot controls`
  - Files: `src/components/lobby/MatchSettings.tsx`, `src/components/lobby/MatchSettings.css`
  - Pre-commit: `npm run build && npx vitest run`

---

- [x] 21. Build start match flow

  **What to do**:
  - Add "Start Match" button to LobbyScreen — visible only to creator
  - Button state logic:
    - Disabled + tooltip "Waiting for all players to ready" if not all ready
    - Disabled + tooltip "Need at least 2 combatants" if <2 (players + bots)
    - Enabled (green, prominent) when all conditions met
  - Click → confirmation dialog: "Start match with N players and M bots?"
  - On confirm → send `start_combat` message with botCount
  - Loading state on button during match initialization
  - On `match_state` received with `status === 'active'` → navigate to `/game/:matchId`
  - "Leave Match" button (red, secondary) → confirmation → send `leave_match` → navigate to `/home`
  - Remove old lobby overlay from GameScreen.tsx (it's now fully replaced by LobbyScreen)
  - Clean up any dead code in GameScreen.tsx related to `inLobbyButNoMatch`

  **Must NOT do**:
  - Do NOT modify GameScreen combat UI (panels, action bar, arena)
  - Do NOT add countdown timer or ready-check popup
  - NOTE: `start_combat` server-side ready validation is handled in Task 5, not here. This task only handles the client-side button state and navigation.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: State-dependent button logic, confirmation dialog, navigation, cleanup
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Button state patterns, confirmation flows

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Phase 4C (after 18, 19, 20)
  - **Blocks**: Task 22
  - **Blocked By**: Tasks 18, 19, 20

  **References**:

  **Pattern References**:
  - `src/components/game/GameScreen.tsx:370-393` — Current start match logic and leave match logic to migrate
  - `src/components/game/GameScreen.tsx:291-393` — ENTIRE lobby overlay to remove after migration

  **WHY Each Reference Matters**:
  - Contains the start/leave logic to migrate and the dead code to clean up

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  grep -c "inLobbyButNoMatch\|lobby-setup-overlay\|lobby-setup-modal" src/components/game/GameScreen.tsx
  # Assert: 0 (old lobby overlay completely removed from GameScreen)
  
  grep -c "start_combat" src/components/lobby/LobbyScreen.tsx
  # Assert: >= 1 (start flow in lobby)
  
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  
  npx vitest run 2>&1 | tail -5
  # Assert: All tests pass
  ```

  **Commit**: YES
  - Message: `feat(ui): add start match flow to lobby, remove old lobby overlay from GameScreen`
  - Files: `src/components/lobby/LobbyScreen.tsx`, `src/components/game/GameScreen.tsx`
  - Pre-commit: `npm run build && npx vitest run`

---

### Phase 5: Polish & Tests

- [x] 22. Write Playwright e2e tests for all new screens

  **What to do**:
  - Create `e2e/pre-game-flow.spec.ts` — comprehensive e2e test for the new pre-game flow
  - Test scenarios:
    1. **Login**: Navigate to `/`, enter name, click Enter Arena, verify redirect to `/home`
    2. **Login timeout**: Test the timeout UI by overriding `VITE_WS_URL` to a dead port (e.g., `ws://127.0.0.1:19999`) in the test environment, or mock the WebSocket connection to never respond. Navigate to `/`, enter name, click Enter Arena, verify timeout error message appears after 10s. NOTE: This test must run separately from the main suite (which auto-starts the server via `playwright.config.ts` webServer config). Use a dedicated test project config or skip the webServer for this spec.
    3. **Dashboard**: Verify match list renders, empty state shows for new user, stats bar visible
    4. **Create Match**: Click New Match, fill dialog, create, verify redirect to `/lobby/:matchId`
    5. **Armory**: Navigate to `/armory`, verify empty state, create character, verify appears in list
    6. **Character Editor**: Open editor, switch tabs, add skill via inline form (NOT prompt), save
    7. **Lobby**: Verify player list, ready toggle, character preview, start button disabled until ready
    8. **Full Flow**: Login → Create Match → Select Character → Ready → Start → Verify in game
  - Follow existing Playwright patterns from `e2e/combat-turn.spec.ts`
  - Use `page.waitForURL()` for route assertions
  - Save screenshots to `.sisyphus/evidence/`

  **Must NOT do**:
  - Do NOT modify existing e2e tests (unless routes changed and they need updating)
  - Do NOT test combat flow (already covered by existing specs)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Comprehensive test suite covering multiple screens and flows
  - **Skills**: [`playwright`, `frontend-ui-ux`]
    - `playwright`: E2e test authoring, page interactions, assertions
    - `frontend-ui-ux`: Understanding UI structure for correct selectors

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 23)
  - **Parallel Group**: Phase 5A
  - **Blocks**: Task 24
  - **Blocked By**: Task 21

  **References**:

  **Pattern References**:
  - `e2e/combat-turn.spec.ts` — Existing e2e test pattern. Follow same `test.describe()` structure, `page.goto()`, assertion patterns.
  - `e2e/feature-tests.spec.ts` — Feature test patterns.
  - `playwright.config.ts` — Playwright configuration. Check base URL, timeouts, browser settings.

  **WHY Each Reference Matters**:
  - Existing e2e tests show the project's testing patterns and conventions
  - Config determines base URL and timeout settings

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  test -f e2e/pre-game-flow.spec.ts && echo "EXISTS" || echo "MISSING"
  # Assert: "EXISTS"
  
  grep -c "test(" e2e/pre-game-flow.spec.ts
  # Assert: >= 5 (at least 5 test cases)
  
  # Note: Actually running tests requires server running
  # The executor should start server + client and run:
  # npx playwright test e2e/pre-game-flow.spec.ts
  ```

  **Commit**: YES
  - Message: `test(e2e): add comprehensive pre-game flow tests for login, dashboard, armory, and lobby`
  - Files: `e2e/pre-game-flow.spec.ts`
  - Pre-commit: `npm run build`

---

- [x] 23. Mobile responsive polish

  **What to do**:
  - Review all new screens (Login, Dashboard, Armory, Lobby) at mobile breakpoints (480px, 768px)
  - Fix any overflow, truncation, or layout issues
  - Ensure all touch targets are ≥44px height
  - Verify tab navigation works on mobile (horizontal scroll for character editor tabs)
  - Verify modals (create match, confirmation) work on small screens
  - Test with Safari mobile viewport (100vh issues)
  - Add `env(safe-area-inset-*)` where needed (bottom bars, headers)
  - Fix any z-index stacking issues between modals and panels

  **Must NOT do**:
  - Do NOT add new mobile-only features
  - Do NOT create separate mobile components (keep responsive CSS approach)
  - Do NOT modify desktop layouts

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Responsive CSS polish, viewport testing, mobile-specific fixes
  - **Skills**: [`frontend-ui-ux`, `playwright`]
    - `frontend-ui-ux`: Responsive design, mobile UX patterns
    - `playwright`: Test at different viewport sizes, take screenshots

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 22)
  - **Parallel Group**: Phase 5A
  - **Blocks**: Task 24
  - **Blocked By**: Task 21

  **References**:

  **Pattern References**:
  - `src/App.css` — Existing responsive breakpoints and media queries. Follow same patterns.
  - `src/components/WelcomeScreen.css` — Mobile breakpoints for login screen.

  **Acceptance Criteria**:

  ```
  # Agent executes via playwright browser automation at 375x812 viewport (iPhone):
  1. Navigate to each route: /, /home, /armory, /lobby/:id
  2. Screenshot each at 375x812
  3. Verify no horizontal scroll (page width = viewport width)
  4. Verify all buttons ≥ 44px tall
  5. Save: .sisyphus/evidence/task-23-mobile-*.png
  ```

  **Commit**: YES
  - Message: `fix(ui): mobile responsive polish for all pre-game screens`
  - Files: Various CSS files
  - Pre-commit: `npm run build`

---

- [x] 24. Cleanup old components and dead CSS

  **What to do**:
  - Remove or archive `src/components/MatchBrowser.tsx` (replaced by Dashboard)
  - Remove `src/components/LobbyBrowser.css` (replaced by Dashboard.css)
  - Remove lobby overlay code from `GameScreen.tsx` (if not done in Task 21)
  - Remove `ScreenState` type from any remaining files
  - Remove `screen` state references from any remaining files
  - Clean up `App.css` — remove unused `.lobby-setup-*` classes
  - Clean up old character editor modals if fully replaced:
    - `src/components/rulesets/gurps/GurpsCharacterEditor.tsx` → archive or remove
    - `src/components/rulesets/pf2/PF2CharacterEditor.tsx` → archive or remove
  - Verify no broken imports
  - Run full build + lint + test suite

  **Must NOT do**:
  - Do NOT remove components still in use
  - Do NOT modify game combat components
  - Do NOT refactor code beyond cleanup

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: File deletion and dead code removal. Low risk with proper verification.
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Understanding component dependencies

  **Parallelization**:
  - **Can Run In Parallel**: NO (final task)
  - **Parallel Group**: Phase 5B (after 22, 23)
  - **Blocks**: None
  - **Blocked By**: Tasks 22, 23

  **References**:

  **Pattern References**:
  - All files listed above — use `lsp_find_references` before deleting any component to verify no remaining imports

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds with zero errors
  
  npm run lint 2>&1 | tail -10
  # Assert: Lint passes
  
  npx vitest run 2>&1 | tail -5
  # Assert: All tests pass
  
  grep -r "MatchBrowser" src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | wc -l
  # Assert: 0 (no remaining references to removed component)
  
  grep -r "ScreenState" src/ --include="*.tsx" --include="*.ts" | wc -l
  # Assert: 0 (fully removed)
  ```

  **Commit**: YES
  - Message: `chore: remove old MatchBrowser, lobby overlay, and character editor modals`
  - Files: Multiple removals and cleanups
  - Pre-commit: `npm run build && npm run lint && npx vitest run`

---

## Commit Strategy

| After Task | Message | Key Files | Verification |
|------------|---------|-----------|--------------|
| 1 | `style: add CSS design tokens` | index.css | vitest |
| 2 | `refactor: decompose useGameSocket` | hooks/*.ts | build + vitest |
| 3 | `refactor: consolidate navigation` | App.tsx, hooks, placeholders | build + vitest |
| 4 | `feat(types): add WS messages` | shared/types.ts | build |
| 5 | `feat(server): add handlers` | server/src/handlers.ts, db.ts | server build |
| 6 | `feat(ui): redesign welcome screen` | WelcomeScreen.tsx/css | build + vitest |
| 7 | `feat(ui): build dashboard` | Dashboard.tsx/css | build + vitest |
| 8 | `feat(ui): add stats bar` | StatsBar.tsx | build |
| 9 | `feat(ui): add create match dialog` | CreateMatchDialog.tsx | build + vitest |
| 10 | `feat(ui): build character armory` | CharacterArmory.tsx, CharacterCard.tsx | build + vitest |
| 11 | `feat(ui): build character editor (Attrs)` | CharacterEditor.tsx | build + vitest |
| 12 | `feat(ui): add Skills tab` | CharacterEditor.tsx, useCharacterEditor.ts | build + vitest |
| 13 | `feat(ui): add Equipment tab` | CharacterEditor.tsx, useCharacterEditor.ts | build + vitest |
| 14 | `feat(ui): add Traits tab (zero prompt())` | CharacterEditor.tsx, useCharacterEditor.ts | build + vitest |
| 15 | `feat(ui): integrate Pathbuilder import` | CharacterEditor.tsx | build + vitest |
| 16 | `feat(ui): build character picker` | CharacterPicker.tsx | build + vitest |
| 17 | `feat(ui): build lobby layout` | LobbyScreen.tsx/css | build + vitest |
| 18 | `feat(ui): build player list + ready` | PlayerList.tsx | build + vitest |
| 19 | `feat(ui): build character preview` | CharacterPreview.tsx | build + vitest |
| 20 | `feat(ui): build match settings` | MatchSettings.tsx | build + vitest |
| 21 | `feat(ui): start flow + cleanup overlay` | LobbyScreen.tsx, GameScreen.tsx | build + vitest |
| 22 | `test(e2e): pre-game flow tests` | e2e/pre-game-flow.spec.ts | build |
| 23 | `fix(ui): mobile polish` | Various CSS | build |
| 24 | `chore: remove old components` | Multiple | build + lint + vitest |

---

## Success Criteria

### Verification Commands
```bash
# Full build (client + server)
npm run build                    # Expected: zero errors
npm run build --prefix server    # Expected: zero errors

# All unit tests
npx vitest run                   # Expected: all pass, zero regressions

# Lint
npm run lint                     # Expected: zero errors

# E2e tests (requires running server + client)
npx playwright test              # Expected: all pass

# Zero window.prompt() in codebase
grep -r "window.prompt" src/ --include="*.ts" --include="*.tsx" | wc -l  # Expected: 0

# Zero ScreenState references
grep -r "ScreenState" src/ --include="*.ts" --include="*.tsx" | wc -l    # Expected: 0

# All new routes exist
grep -E "'/home'|'/armory'|'/lobby/'" src/App.tsx | wc -l                # Expected: >= 3
```

### Final Checklist
- [ ] All 5 routes render on desktop and mobile
- [ ] Zero `window.prompt()` calls in codebase
- [ ] `useGameSocket` decomposed into <100 line hooks
- [ ] CSS design tokens used across all new components
- [ ] Ready system functional in lobby
- [ ] Character roster: CRUD + favorite + filter by ruleset
- [ ] Match creation dialog with name, ruleset, players, visibility
- [ ] Dashboard with match list, stats, quick actions
- [ ] Full-screen lobby with player list, character preview, settings
- [ ] Pathbuilder import works in new editor
- [ ] All existing tests pass (zero regressions)
- [ ] New e2e tests cover complete pre-game flow
- [ ] Old components cleaned up (MatchBrowser, lobby overlay, old editors)
