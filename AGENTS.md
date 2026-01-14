# AGENTS.md

## Scope
This file applies to the entire repository.

## Summary
- Web client: React + TypeScript + Vite (root).
- Server: Node.js + TypeScript + ws (`server/`).
- Shared types and rules: `shared/`.
- UI uses `@react-three/fiber` and `@react-three/drei` for 3D.

## Required Context Files
- No Cursor rules found in `.cursor/rules/` or `.cursorrules`.
- No Copilot rules found in `.github/copilot-instructions.md`.

## Node Version
- Required: Node `22.12.0` via `nvm` (Vite 7 requires >=20.19 or >=22.12).
- Use: `nvm use 22.12.0` before running client/server.

## Install Commands
- Root: `npm install`
- Server: `npm install` in `server/`

## Build / Lint / Test Commands
### Root (client)
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Preview: `npm run preview`

### Server
- Dev server: `npm run dev` (in `server/`)
- Build: `npm run build` (in `server/`)
- Start: `npm run start` (in `server/`)

### Single Test
- No test runner configured in the repo.
- If tests are added later, document the exact single-test command here.

## Troubleshooting
- If the client shows “WebSocket closed before connection”, verify Node is `22.12.0` and StrictMode remains disabled.
- If the lobby buttons do nothing, confirm the server is listening on `127.0.0.1:8080`.
- Use logs in the right panel to confirm `Connected to server` and `Joined lobby` messages.

## Repository Layout
- `src/` React UI and Three.js arena.
- `shared/` TypeScript types and rules helpers.
- `server/` WebSocket server and match state.
- `public/` static assets.

## Runtime Architecture
- Client connects to WebSocket at `ws://127.0.0.1:8080`.
- Server is authoritative for lobby and match state.
- Client displays lobby, match state, and action buttons.
- React StrictMode is disabled to avoid double WebSocket connect/close in dev.

## Shared Contracts
- Message types live in `shared/types.ts`.
- Keep client/server message schemas in sync.
- Use `ClientToServerMessage` and `ServerToClientMessage` for JSON payloads.

## Rules Engine
- Core rolls and turn advance live in `shared/rules.ts`.
- Keep rules as pure functions with explicit inputs/outputs.
- Avoid side effects inside rules.

## Code Style Guidelines
### General
- Use TypeScript strict mode; avoid `any` and `as any`.
- Prefer explicit types for public APIs and shared contracts.
- Keep functions small and single-purpose.
- Favor immutability for state updates.
- Do not introduce new dependencies without need.

### Imports
- Use ES module imports only.
- Group imports: external libraries first, then local shared, then relative.
- Use type-only imports (`import type { ... }`) where appropriate.

### Naming
- Types and interfaces: `PascalCase`.
- Variables and functions: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` only for true constants.
- WebSocket message types: `snake_case` strings.

### Formatting
- Match existing file formatting and indentation.
- Do not reformat unrelated code.
- Prefer 2-space indentation in TS/TSX files.

### React / UI
- Use functional components.
- Keep UI state and server state separated.
- Avoid inline styling unless already used in the file.
- Keep 3D scene logic in a separate component when possible.

### Three.js / R3F
- Keep scene elements lightweight for MVP.
- Avoid heavy geometry or textures by default.
- Do not add new animation loops unless required.

### Server
- Keep server state in-memory for MVP.
- WebSocket handlers must validate required data.
- Avoid blocking operations inside message handlers.

### Error Handling
- Never swallow errors silently.
- Send structured error messages to the client: `{ type: "error", message }`.
- On client, log errors to the combat log.

### Logging
- Use concise log entries for match events.
- Add logs to `MatchState.log` for user-visible events.

### Types and State
- All match state changes should produce a new object.
- Keep IDs as strings; use UUIDs for new entities.
- Avoid using array indices as identifiers in state.

## Frontend State Expectations
- `player` is set after `auth_ok`.
- `lobbyId` set after `lobby_joined`.
- `matchState` set after `match_state`.
- `lobbyPlayers` should mirror the server lobby state.

## Backend State Expectations
- `players` map keyed by player ID.
- `lobbies` map keyed by lobby ID.
- `matches` map keyed by lobby ID.
- `playerCharacters` map keyed by player ID.

## Bot Behavior
- Bots are added to ensure minimum player count.
- Bot turns are scheduled with a timer.
- Keep bot actions deterministic for now.

## Test Strategy (if added later)
- Prefer unit tests for `shared/rules.ts`.
- Prefer integration tests for server message flow.
- UI tests should focus on lobby and match transitions.

## Documentation
- Keep README minimal unless requested.
- Update `AGENTS.md` when build or test commands change.

## PR / Commit Notes
- Do not commit unless explicitly requested.
- Avoid unrelated refactors in feature work.

## Known Gaps
- Combat actions beyond turn-advance are placeholders.
- Character creation UI not implemented yet.
- No persistence layer configured.

## Quick Start
1. `nvm use 22.12.0`
2. `npm install` (root)
3. `npm install` (server)
4. `npm run dev` (root)
5. `npm run dev` (server)
