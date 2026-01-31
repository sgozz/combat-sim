# Learnings — Ruleset Lock

## Conventions & Patterns

(Subagents: append findings here after each task)

## Wave 1: DB Migration + User Type Update

### Migration Pattern (db.ts)
- Check column existence using `PRAGMA table_info(tableName)` before ALTER TABLE
- Use `db.prepare().all()` to get column metadata, then `.some()` to check for specific column
- Pattern: `const hasColumn = columns.some((col) => col.name === 'column_name')`
- Always use `NOT NULL DEFAULT 'value'` for new columns on existing tables to avoid NULL values
- Place migrations after initial table creation in `initializeDatabase()`

### DB Column Naming Convention
- Snake_case for database columns: `preferred_ruleset_id`, `is_bot`, `is_favorite`
- Camel case for TypeScript types: `preferredRulesetId`, `isBot`, `isFavorite`
- Mapping happens in query results: `row.preferred_ruleset_id as RulesetId`

### User Type Updates
- `User` type in `shared/types.ts` is the canonical client-facing type
- `UserRow` type in `server/src/types.ts` mirrors database schema
- All SELECT queries must include new columns to avoid undefined fields
- Functions that return User objects must map all fields: `{ id, username, isBot, preferredRulesetId }`
- Type casting needed for RulesetId: `row.preferred_ruleset_id as RulesetId`

### Message Type Updates
- Optional fields in message types use `?:` syntax: `preferredRulesetId?: RulesetId`
- New message types added to `ClientToServerMessage` union
- Pattern: `| { type: "message_name"; field: Type }`

### Affected Functions (db.ts)
- `createUser()` — added preferredRulesetId parameter with default 'gurps'
- `findUserByUsername()` — added preferred_ruleset_id to SELECT
- `findUserById()` — added preferred_ruleset_id to SELECT
- `loadPersistedUsers()` — added preferred_ruleset_id to SELECT for in-memory cache

### Build Verification
- `npm run build` compiles both client (Vite) and server (tsc)
- No TypeScript errors after all updates
- LSP diagnostics clean on modified files

## Wave 1: Welcome Screen Redesign

### CSS Patterns
- Ruleset card colors: GURPS uses `rgba(100, 108, 255, *)` (blue-purple), PF2 uses `rgba(239, 68, 68, *)` (red)
- Card name colors: GURPS `#8b8fff`, PF2 `#f87171` — matches CharacterArmory.css badge colors
- Selected card state uses border-color + box-shadow + subtle background tint
- Section dividers in CSS use `/* ─── Section Name ─── */` convention (matches CharacterArmory.css)
- Responsive breakpoint at 768px: cards switch from 2-column grid to single column
- Welcome card max-width increased from 480px to 540px to accommodate two side-by-side cards

### Component Patterns
- `RULESET_INFO` array defined outside component for static ruleset metadata
- Ruleset cards are `<button>` elements (not divs) for accessibility
- `selectedRuleset` state is `RulesetId | null` — null means no selection yet
- `canSubmit` computed from username length + ruleset selection + connection state
- `onComplete` signature: `(username: string, preferredRulesetId: RulesetId) => void`

### Auth Hook Changes
- `register` in useAuth.ts accepts optional `preferredRulesetId?: RulesetId`
- Sent in WebSocket register message: `{ type: 'register', username, preferredRulesetId }`
- App.tsx passes `register` directly as `onComplete` — types align because WelcomeScreen always provides both args

### Pre-existing Issue
- `LobbyScreen.test.tsx:48` has error: mock User missing `preferredRulesetId` — pre-existing from Wave 1 DB migration, not introduced by this task

## Server Handlers - Ruleset Filtering (2026-01-31)

### Handler Patterns

1. **register handler**: Passes `message.preferredRulesetId ?? 'gurps'` to `createUser()`
   - Falls back to 'gurps' if not provided
   - `createUser()` already had the parameter ready

2. **set_preferred_ruleset handler**: New handler added
   - Validates rulesetId with `assertRulesetId()`
   - Updates DB: `UPDATE users SET preferred_ruleset_id = ? WHERE id = ?`
   - Updates in-memory user object
   - Returns updated user via `auth_ok` message
   - Requires null-checking `connection.sessionToken` (it's optional in ConnectionState)

3. **create_match handler**: Now uses `user.preferredRulesetId` instead of `message.rulesetId`
   - Server-side enforcement of ruleset preference
   - Client can no longer override ruleset when creating matches

### Database Query Filtering

1. **getUserMatches()**: Added optional `rulesetId` parameter
   - When provided: `WHERE mm.user_id = ? AND (m.ruleset_id = ? OR m.status IN ('active', 'paused'))`
   - Always shows active/paused matches regardless of ruleset
   - Allows users to continue playing existing matches when switching rulesets

2. **getPublicWaitingMatches()**: Added optional `rulesetId` parameter
   - When provided: `WHERE is_public = 1 AND status = 'waiting' AND ruleset_id = ?`
   - Only shows waiting matches of the user's preferred ruleset

3. **loadCharactersByOwner()**: Added optional `rulesetId` parameter
   - Filters in app code after JSON parsing: `characters.filter(char => char.rulesetId === rulesetId)`
   - Cannot filter in SQL because `rulesetId` is in `data_json` column

### Handler Updates

- **list_my_matches**: Passes `user.preferredRulesetId` to `getUserMatches()`
- **list_characters**: Passes `user.preferredRulesetId` to `loadCharactersByOwner()`
- **list_public_waiting**: Passes `user.preferredRulesetId` to `getPublicWaitingMatches()`
- **register** and **auth**: Both updated to pass `user.preferredRulesetId` when loading matches

### ConnectionState Gotcha

`ConnectionState` has optional fields:
```typescript
export type ConnectionState = {
  sessionToken?: string;
  userId?: string;
};
```

Need to check both `connection` and `connection.sessionToken` exist before using.


## Wave 4: Client Auth Hook — Store preferredRulesetId (2026-01-31)

### Hook Pattern for Exposing State + Actions

1. **useAuth.ts changes**:
   - `preferredRulesetId` exposed directly from hook return: `preferredRulesetId: user?.preferredRulesetId ?? null`
   - Null-coalescing pattern: `user?.preferredRulesetId ?? null` handles both null user and missing field
   - `setPreferredRuleset(rulesetId)` function added to send `set_preferred_ruleset` message
   - Function checks socket state before sending: `if (!socket || socket.readyState !== WebSocket.OPEN) return`

2. **useGameSocket.ts threading**:
   - Both `preferredRulesetId` and `setPreferredRuleset` threaded through return object
   - Maintains consistent pattern: auth state/actions exposed at top level
   - Allows components to destructure: `const { preferredRulesetId, setPreferredRuleset } = useGameSocket()`

3. **Message Handling**:
   - `auth_ok` case already handles user updates (includes preferredRulesetId)
   - No separate `preferred_ruleset_updated` message needed — server sends updated user via `auth_ok`
   - Pattern: When client sends `set_preferred_ruleset`, server responds with `auth_ok` containing updated user

4. **Register Function**:
   - Already passes `preferredRulesetId` to server: `{ type: 'register', username, preferredRulesetId }`
   - Optional parameter: `register(username: string, preferredRulesetId?: RulesetId)`
   - Server defaults to 'gurps' if not provided

### Build Verification
- `npm run build` succeeds with no TypeScript errors
- Both client (Vite) and server (tsc) compile cleanly

## Wave 7: CharacterArmory Simplification (2026-01-31)

### Armory UI Simplification Pattern

1. **Removed Filter Bar (All/GURPS/PF2 buttons)**:
   - Deleted entire `armory-filter-group` for ruleset filtering
   - Kept sort dropdown (Date Created/Name/Favorites First)
   - Kept character count display
   - Rationale: Server now filters characters by `user.preferredRulesetId` — no need for client-side filtering

2. **Removed "+ New Character" Dropdown**:
   - Deleted `showNewCharMenu` state and click-outside handler
   - Deleted `handleNewCharacter(ruleset)` function
   - Replaced dropdown with single button: `onClick={() => navigate('/armory/new')}`
   - No query param needed — server knows user's preferred ruleset

3. **CharacterEditor Props Update**:
   - Changed prop name: `defaultRulesetId` → `preferredRulesetId`
   - Removed URL param reading: `new URLSearchParams(window.location.search).get('ruleset')`
   - Now uses prop directly: `const bundle = rulesets[preferredRulesetId]`
   - Dependency array updated: `[id, isNew, characters, navigate, preferredRulesetId]`

4. **App.tsx Route Updates**:
   - Both `/armory/new` and `/armory/:id` routes now pass `preferredRulesetId={user.preferredRulesetId}`
   - Removed `RulesetId` import (no longer used in App.tsx directly)
   - Pattern: Props flow from `user` → `CharacterEditor` → character creation

### Mono-Ruleset Experience Achieved
- Users see only characters for their preferred ruleset
- New characters created with user's preferred ruleset (no choice needed)
- No multi-ruleset UI clutter in armory
- Server enforces ruleset consistency

### Build Status
- CharacterArmory.tsx: ✅ No errors
- CharacterEditor.tsx: ✅ No errors
- App.tsx: ✅ No errors
- Pre-existing Dashboard.tsx errors (unused `setPreferredRuleset` prop from previous task) — not blocking this task

## Wave 8: CreateMatchDialog Simplification (2026-01-31)

### Dialog Simplification Pattern

1. **Remove Interactive Ruleset Selection**:
   - Removed toggle buttons from CreateMatchDialog
   - Replaced with static badge showing user's preferred ruleset
   - Badge uses `.ruleset-${rulesetId}` class for styling (matches existing patterns)

2. **Callback Signature Changes**:
   - `onCreateMatch` signature changed from `(name, maxPlayers, rulesetId, isPublic)` to `(name, maxPlayers, isPublic)`
   - Server uses `user.preferredRulesetId` instead of client-provided value
   - Enforces server-side ruleset preference (client cannot override)

3. **Message Type Updates**:
   - `create_match` message: made `rulesetId` optional (moved to end, after `isPublic`)
   - Pattern: `{ type: "create_match"; name: string; maxPlayers: number; isPublic?: boolean; rulesetId?: RulesetId }`
   - Server ignores client-provided `rulesetId` if present

4. **Component Threading**:
   - CreateMatchDialog now requires `preferredRulesetId` prop from parent
   - Dashboard passes `user.preferredRulesetId` to CreateMatchDialog
   - App.tsx passes `setPreferredRuleset` to Dashboard (for future use)

5. **Cleanup Pattern**:
   - Removed unused ruleset switching UI (dialog + toast) from Dashboard
   - Removed `RULESET_LABELS` constant (no longer needed)
   - Removed `useCallback` import when no longer used
   - Removed `showRulesetDialog`, `rulesetToast`, `handleSwitchRuleset` state/handlers

6. **Type Safety**:
   - Kept `RulesetId` type imports where needed for prop signatures
   - Removed unused type imports (e.g., `RulesetId` from Dashboard when not used)
   - All type signatures properly aligned between components

### Build Verification
- `npm run build` succeeds with no TypeScript errors
- Both client (Vite) and server (tsc) compile cleanly

## Wave 9: Dashboard Ruleset Badge + Switch Dialog (2026-01-31)

### Badge Pattern
- Badge placed in header between username and Armory button
- Uses `<button>` (not `<div>`) for accessibility/clickability
- CSS classes: `dashboard-ruleset-badge ruleset-{rulesetId}` — matches armory badge pattern
- Color scheme: GURPS = blue-purple (`rgba(100, 108, 255, *)`), PF2 = red (`rgba(239, 68, 68, *)`)
- Hover states darken the background and border for visual feedback

### Dialog Pattern
- Follows `LobbyScreen.tsx` dialog pattern: overlay + dialog box + stopPropagation
- CSS classes namespaced with `dashboard-dialog-*` to avoid collision with lobby styles
- Animations: `dashboard-fade-in` (overlay) + `dashboard-dialog-in` (scale + translate)
- Confirm button uses `--accent-primary` (not `--accent-success` like lobby's start-match dialog)

### Toast Pattern
- Simple fixed-position toast at bottom center
- Auto-dismiss after 3s via `setTimeout(() => setRulesetToast(null), 3000)`
- Animation: `dashboard-toast-in` (fade + slide up)
- z-index: 300 (above dialog overlay at 200)

### State Flow
- `setPreferredRuleset(rulesetId)` sends WebSocket message → server responds with `auth_ok` → user state updates → badge re-renders
- `refreshMyMatches()` called after switch to reload match lists with new ruleset filter
- `RULESET_LABELS` constant maps `RulesetId` → display string

### Key Discovery
- `setPreferredRuleset` was already destructured in App.tsx and passed as prop to Dashboard (from Wave 8)
- A partial badge implementation (non-interactive `<div>`) already existed — replaced with clickable `<button>`
- Previous wave had cleaned out dialog/toast code; this wave re-added it properly

## Task 8: Update Tests + Final Verification (2026-01-31)

### Test Updates for Single-Ruleset Experience

**Updated Tests:**
1. `CharacterArmory.test.tsx`:
   - Removed filter button tests (All/GURPS/PF2)
   - Removed dropdown menu tests for "+ New Character"
   - Updated navigation to use `/armory/new` (no query param)
   - Reduced from 19 to 14 tests

2. `CharacterEditor.test.tsx`:
   - Changed `renderEditor` helper to accept `preferredRulesetId` prop
   - Updated tests to pass `preferredRulesetId` instead of URL params
   - Updated rerender calls to include the prop

3. `LobbyScreen.test.tsx`:
   - Added `preferredRulesetId` to User mock object

**New Test Files:**
1. `WelcomeScreen.test.tsx` (16 tests):
   - Username input validation
   - Ruleset card selection (GURPS/PF2)
   - Button state (disabled/enabled)
   - `onComplete` callback with correct params
   - Connection state handling
   - Form disable during connection
   - Learned: Validation tests should check button state, not error messages when button is disabled

2. `Dashboard.test.tsx` (12 tests):
   - Ruleset badge rendering (GURPS/PF2)
   - Badge click opens switch dialog
   - Dialog confirm calls `setPreferredRuleset`
   - Toast notification on switch
   - Navigation to armory
   - Logout functionality

3. `CreateMatchDialog.test.tsx` (18 tests):
   - Static badge display (GURPS 4e / Pathfinder 2e)
   - No toggle buttons for ruleset selection
   - `onCreateMatch` called without `rulesetId` parameter
   - Max players slider
   - Visibility toggle (Private/Public)
   - Match name validation
   - Learned: Range input (slider) requires `fireEvent.change()` not `user.clear()` + `user.type()`

### Test Patterns & Gotchas

**React Testing Library:**
- Use `fireEvent.change()` for range inputs (sliders), not userEvent
- When multiple elements have same text, use `getAllByText()` or add selector
- Check button `disabled` state for validation tests, not error messages
- Use `closest('button')` to get parent button from child text element

**Type Guards:**
- Always include `preferredRulesetId` in User mock objects
- Pass `preferredRulesetId` as prop to components that need it

**Test Organization:**
- Group related tests in describe blocks
- Use clear, descriptive test names that explain intent
- Prefer testing behavior over implementation

### Test Coverage

**Total Component Tests: 94 passing**
- CharacterArmory: 14 tests
- CharacterEditor: 10 tests
- LobbyScreen: 17 tests
- CharacterPicker: 7 tests
- WelcomeScreen: 16 tests (new)
- Dashboard: 12 tests (new)
- CreateMatchDialog: 18 tests (new)

**Verification:**
- All tests pass: ✅
- Lint clean (no new errors): ✅
- Build succeeds: ✅

### Key Learnings

1. **Prop-based Configuration > URL Params**: 
   - Tests are cleaner when components accept props
   - Easier to test different scenarios
   - No need to manipulate browser history

2. **Test User Interactions, Not Implementation**:
   - Focus on what user sees and does
   - Check outcomes (button state, callbacks) not internals

3. **Slider Testing Requires fireEvent**:
   - userEvent doesn't work with range inputs
   - Use `fireEvent.change(slider, { target: { value: '6' } })`

4. **Validation Testing**:
   - When button is disabled, check `button.disabled` state
   - Don't expect error messages to show when submission is prevented
