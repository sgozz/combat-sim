# AGENTS.md

## Overview
GURPS combat simulator with React/Three.js client and Node.js WebSocket server.

| Layer | Stack | Location |
|-------|-------|----------|
| Client | React 19 + Vite 7 + @react-three/fiber | `src/` |
| Server | Node.js + ws + sqlite | `server/` |
| Shared | TypeScript types + rules | `shared/` |

## Node Version
**Required**: Node 22.12.0+ (Vite 7 requirement)
```bash
nvm use 22.12.0
```

## Commands

### Client (root)
```bash
npm install          # Install dependencies
npm run dev          # Dev server (localhost:5173)
npm run build        # Type-check + production build
npm run lint         # ESLint
npm run preview      # Preview production build
```

### Server (`server/`)
```bash
npm install          # Install dependencies
npm run dev          # Dev server with hot reload (tsx watch)
npm run build        # Compile TypeScript
npm run start        # Run compiled JS
```

### Tests (Vitest)
```bash
# Run all tests
npx vitest run

# Run single test file
npx vitest run shared/rules.test.ts

# Run tests matching name pattern
npx vitest run -t "Skill Check"

# Watch mode
npx vitest

# With UI
npx vitest --ui
```

Test config: `vite.config.ts` with `happy-dom` environment.
Setup file: `src/test/setup.ts` (imports `@testing-library/jest-dom`).

## Directory Structure
```
src/
  components/
    arena/      # Three.js scene (HexGrid, Combatant, ArenaScene)
    game/       # Game UI (GameHUD, CombatLog, InitiativeTracker)
    ui/         # Modals, editors
  hooks/        # useGameSocket, etc.
  utils/        # Hex math, helpers
shared/
  types.ts      # Message contracts, game state types
  rules.ts      # GURPS rules (pure functions)
  rules.test.ts # Unit tests for rules
server/
  src/          # WebSocket server, match logic
```

## Architecture
- Client connects to `ws://127.0.0.1:8080`
- Server is authoritative for all game state
- Message contracts in `shared/types.ts`: `ClientToServerMessage`, `ServerToClientMessage`
- React StrictMode disabled (prevents double WebSocket connections in dev)

## Code Style

### TypeScript
- Strict mode enabled; **never** use `any`, `as any`, `@ts-ignore`
- Explicit types for public APIs and shared contracts
- Use `import type { ... }` for type-only imports
- Prefer immutability for state updates

### Imports (order)
1. External libraries (`react`, `three`, `ws`)
2. Shared modules (`../shared/types`)
3. Relative imports (`./components/...`)

### Naming
| Element | Convention | Example |
|---------|------------|---------|
| Types/Interfaces | PascalCase | `CharacterSheet`, `MatchState` |
| Variables/Functions | camelCase | `handleGridClick`, `activeCombatant` |
| Constants | UPPER_SNAKE_CASE | `MAX_PLAYERS` |
| Message types | snake_case strings | `"auth_ok"`, `"match_state"` |

### Formatting
- 2-space indentation
- Match existing file style; don't reformat unrelated code

### React
- Functional components only
- Keep UI state separate from server state
- Memoize callbacks with `useCallback` when passed to children
- 3D scene logic in dedicated components under `components/arena/`

### Error Handling
- Never swallow errors silently
- Server sends: `{ type: "error", message: string }`
- Client logs errors to combat log panel

### Rules Engine (`shared/rules.ts`)
- Pure functions only—no side effects
- Accept `random` parameter for testability (defaults to `Math.random`)
- Keep game logic here, not in components or server handlers

## State Management

### Client State Flow
1. `auth` → `auth_ok` → sets `player`
2. `join_lobby` → `lobby_joined` → sets `lobbyId`, `lobbyPlayers`
3. `start_match` → `match_state` → sets `matchState`

### Server State (in-memory)
- `players`: Map<Id, Player>
- `lobbies`: Map<Id, Lobby>
- `matches`: Map<Id, MatchState>

### Types Reference
```typescript
// Key types from shared/types.ts
type MatchState = {
  id: Id;
  players: Player[];
  characters: CharacterSheet[];
  combatants: CombatantState[];
  activeTurnPlayerId: Id;
  round: number;
  log: string[];
  status: "active" | "finished";
};
```

## Testing Strategy
- Unit tests for `shared/rules.ts` (pure functions, mock `random`)
- Integration tests for server message flow
- Use `happy-dom` for React component tests

## Common Patterns

### WebSocket Message Handler
```typescript
// Server-side pattern
case "action":
  const match = matches.get(lobbyId);
  if (!match) { send({ type: "error", message: "No match" }); return; }
  // Validate, update state, broadcast
  break;
```

### React Hook Pattern
```typescript
const handleAction = useCallback((action: string) => {
  sendMessage({ type: 'action', action });
}, [sendMessage]);
```

## Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| WebSocket closed immediately | Wrong Node version | `nvm use 22.12.0` |
| Lobby buttons unresponsive | Server not running | Start server on :8080 |
| Double connections in dev | StrictMode enabled | Keep StrictMode disabled |

## Quick Start
```bash
nvm use 22.12.0
npm install && npm install --prefix server
npm run dev &                    # Terminal 1: client
npm run dev --prefix server      # Terminal 2: server
```

## Notes for Agents
- Do not commit unless explicitly requested
- Avoid unrelated refactors in feature PRs
- Run `npm run lint` and `npx vitest run` before completing tasks
- Keep message schemas in sync between client/server
- Bot actions should be deterministic
