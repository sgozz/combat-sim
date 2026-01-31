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
