# AGENTS.md

## Overview
Tactical combat simulator with React/Three.js client and Node.js WebSocket server.

**Multi-Ruleset Architecture**: Supports multiple tabletop RPG systems (GURPS, Pathfinder 2e) with clean separation.

| Layer | Stack | Location |
|-------|-------|----------|
| Client | React 19 + Vite 7 + @react-three/fiber | `src/` |
| Server | Node.js + ws + sqlite | `server/` |
| Shared | TypeScript types + rules | `shared/` |
| Rulesets | GURPS, PF2 (extensible) | `shared/rulesets/` |

## Multi-Ruleset Architecture

The simulator supports multiple tabletop RPG systems through a decoupled architecture.

### Core Concepts

1.  **Type System Abstraction**:
    - `BaseCombatantState` (`shared/rulesets/base/types.ts`): Universal fields (HP, position, facing) shared by all systems.
    - Ruleset-specific states (e.g., `GurpsCombatantState`) extend the base state with system-specific fields (maneuvers, fatigue, etc.).
    - **Type Guards**: `isGurpsCombatant()`, `isPF2Combatant()`, `isGurpsCharacter()`, and `isPF2Character()` are used to safely access ruleset-specific data.

2.  **Server Adapter Pattern** (`shared/rulesets/serverAdapter.ts`):
    - The `ServerRulesetAdapter` interface defines the contract for server-side logic (turn advancement, movement validation, combat resolution).
    - `getServerAdapter(rulesetId)` returns the appropriate implementation.
    - **Grid Type**: `getGridType(rulesetId)` returns `'hex'` or `'square'` based on the adapter's configuration.
    - **Capability Checks**: Use adapter properties (e.g., `adapter.closeCombat`) to check for optional feature support instead of hardcoding ruleset IDs.

3.  **Component Registry** (`shared/rulesets/index.ts`):
    - Rulesets are registered in a central registry.
    - `Ruleset` interface: Handles data derivation, initial state, and **character creation** (`createCharacter(name)`).
    - `RulesetUIAdapter` interface: Provides UI-specific configuration (maneuvers, action layouts, instructions).
    - **UI Slots**: `rulesetUiSlots` registry provides ruleset-specific UI components (e.g., defense modals).

4.  **Router Pattern** (`server/src/handlers/{ruleset}/router.ts`):
    - Each ruleset has a dedicated router for handling its specific actions.
    - `handleGurpsAction()` and `handlePF2Action()` encapsulate ruleset-specific logic, keeping the main `handlers.ts` clean.

### Directory Structure
```
shared/rulesets/
  base/                  # Universal types and logic
  gurps/                 # GURPS implementation
    types.ts             # GURPS-specific state and types
    rules.ts             # GURPS combat and movement logic
    ui.ts                # GURPS UI adapter implementation
    index.ts             # GURPS bundle export (includes createCharacter)
  pf2/                   # Pathfinder 2e implementation
    types.ts
    rules.ts
    ui.ts
    index.ts
  serverAdapter.ts       # Server-side adapter pattern & grid helpers
  Ruleset.ts             # Core interfaces (Ruleset, RulesetUIAdapter)
  defaults.ts            # Centralized defaults (assertRulesetId)
  index.ts               # Ruleset registry and type guards
server/src/handlers/
  gurps/router.ts        # GURPS action router
  pf2/router.ts          # PF2 action router
```

### Adding a New Ruleset (e.g., D&D 5e)

1.  **Create Directory**: `shared/rulesets/dnd5e/`.
2.  **Define Types**: Create `types.ts`. Define `DnD5eCombatantState` extending `BaseCombatantState`.
3.  **Implement Rules**: Create `rules.ts`. Implement movement, turn logic, and combat functions.
4.  **Create UI Adapter**: Create `ui.ts`. Implement `RulesetUIAdapter` to define how the system appears in the HUD.
5.  **Implement Server Adapter**: In `shared/rulesets/serverAdapter.ts`, create a `dnd5eAdapter` and add it to the `adapters` record.
6.  **Create Router**: Create `server/src/handlers/dnd5e/router.ts` with `handleDnD5eAction()`.
7.  **Register Ruleset**: In `shared/rulesets/index.ts`:
    - Create a `dnd5eBundle` (implementing `createCharacter`).
    - Add it to the `rulesets` record.
    - Add a type guard `isDnD5eCombatant()`.
8.  **Update Routing**: In `server/src/handlers.ts`, add a routing case for `'dnd5e'` that calls `handleDnD5eAction()`.
9.  **Add UI Slots**: If needed, add D&D 5e specific components to `src/components/game/shared/rulesetUiSlots.ts`.
10. **Add Tests**: Create `shared/rulesets/dnd5e/rules.test.ts` to verify the logic.

### Key Patterns & Best Practices

- **No Hardcoded Defaults**: Use `assertRulesetId(id)` instead of `id ?? 'gurps'`.
- **No Hardcoded Conditionals**: Use the adapter or registry pattern instead of `if (rulesetId === 'pf2')`.
- **Capability Checks**: Check for domain existence (e.g., `if (adapter.closeCombat)`) rather than ruleset identity.
- **Type Safety**: Always use type guards (`isGurpsCharacter`) at component/function entry points to safely access ruleset-specific fields.
- **Generic Shared Components**: Shared components should use generic types (e.g., `string` for maneuvers) and rely on the registry for specific data.

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
    game/       # Game UI (GameHUD, CombatLog, InitiativeTracker, ActionBar)
    ui/         # Modals, editors, CharacterEditor
  data/         # Static data (characterTemplates.ts)
  hooks/        # useGameSocket, etc.
  utils/        # Hex math, helpers
shared/
  types.ts      # Message contracts, game state types
  rules.ts      # Combat rules (pure functions)
  rules.test.ts # Unit tests for rules
server/
  src/          # WebSocket server, match logic
```

## UI Architecture

### Responsive Layout
The game has **two separate UI systems** for desktop and mobile:

| Viewport | Component | Location |
|----------|-----------|----------|
| Desktop (>768px) | `GameActionPanel` | `src/components/game/GameHUD.tsx` |
| Mobile (<768px) | `ActionBar` | `src/components/game/ActionBar.tsx` |

Both are rendered by `GameScreen.tsx`; CSS media queries control visibility.

### Desktop UI (`GameHUD.tsx`)
- **Left panel** (`GameStatusPanel`): HP/FP bars, participant list
- **Right panel** (`GameActionPanel`): Maneuver selection, action buttons, combat log
- Maneuvers shown as a grid with tooltips and keyboard shortcuts (1-7)
- Attack preview with hit probability when target selected

### Mobile UI (`ActionBar.tsx`)
- Fixed bottom bar with compact buttons
- HP bar integrated into action bar
- Maneuver picker opens as overlay when tapped
- Same functionality as desktop but touch-optimized

### Key UI Components
| Component | Purpose |
|-----------|---------|
| `GameScreen` | Main game container, keyboard handling, renders both UIs |
| `TurnStepper` | Step-by-step turn guidance ("STEP 1: Choose maneuver") |
| `InitiativeTracker` | Shows turn order at top of screen |
| `CombatToast` | Floating combat log messages |
| `CombatLog` | Full scrollable log in right panel (desktop only) |
| `MiniMap` | Top-down hex grid overview |
| `ArenaScene` | Three.js 3D scene with hex grid and combatants |

### Adding Actions to Both UIs
When adding new action buttons, update **both**:
1. `GameHUD.tsx` → `GameActionPanel` → `renderContent()` → action buttons section
2. `ActionBar.tsx` → main return block with action buttons

Example: "Give Up" button exists in both files with identical `onAction('surrender', ...)` call.

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
