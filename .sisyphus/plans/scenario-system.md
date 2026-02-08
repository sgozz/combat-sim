# Scenario System — 3D Environments with Quaternius Assets

## TL;DR

> **Quick Summary**: Add a 3D environment/scenery system to the tactical combat simulator. Maps are server-authoritative, procedurally generated from 2 biomes (dungeon, wilderness), rendered with Quaternius.com CC0 GLB assets, and integrated into gameplay (blocked terrain, difficult terrain, cover). Players select scenarios in the lobby with a 2D minimap preview.
> 
> **Deliverables**:
> - Shared `MapDefinition` type system with terrain properties per cell
> - Procedural map generator for 2 biomes (dungeon rooms+corridors, wilderness open-field)
> - 3D prop rendering in ArenaScene using Quaternius GLB assets with instancing
> - Movement validation respecting terrain (blocked cells, difficult terrain 2x cost)
> - Cover mechanic integration into combat resolution
> - Lobby scenario selector with 2D minimap preview
> - MiniMap updated to show terrain
> - Full backward compatibility (matches without maps = empty grid)
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 3 waves (~40% speedup)
> **Critical Path**: Task 1 → Task 2 → Task 5 → Task 7 → Task 9 → Task 10

---

## Context

### Original Request
Add environment/scenery management to the tactical combat simulator, using 3D assets from quaternius.com. Reconstruct a previously created plan that was lost.

### Interview Summary
**Key Discussions**:
- **Biomes**: 2 confirmed — Dungeon (rooms + corridors, modular tiles) and Wilderness (open field with scattered trees/rocks)
- **Terrain Properties**: 3 generic properties — `blocked` (impenetrable), `difficult` (2x movement cost), `cover` (defense bonus). Each ruleset interprets via adapter.
- **Generation**: Procedural — dungeon uses room+corridor algorithm, wilderness uses scattered props on open field
- **Assets**: Quaternius.com CC0 license GLB — Modular Dungeon Pack + Stylized Nature subset
- **Server Authority**: Maps stored in MatchState as `MapDefinition`, generated server-side
- **Backward Compatible**: Matches without maps work as current empty grid
- **Test Strategy**: TDD with Vitest

### Research Findings
- **Current ArenaScene** (`src/components/arena/ArenaScene.tsx`): Renders BattleGrid + Combatant components. Uses `@react-three/drei` (OrbitControls, Environment, Html). Ground is a simple plane mesh. Environment props would be added as siblings to BattleGrid.
- **Current BattleGrid** (`src/components/arena/BattleGrid.tsx`): Renders individual cells with styling based on game state (reachable, enemy, selected). Each cell is a mesh with geometry. Terrain would add visual indicators to cells.
- **GridSystem abstraction** (`shared/grid/types.ts`): Clean `GridCoord` + `GridSystem` interface with `distance()`, `neighbors()`, `coordToWorld()`. Terrain system should use `GridCoord` as keys.
- **Movement validation**: `calculateReachableHexesInfo()` in serverAdapter takes `occupiedHexes: HexCoord[]`. Needs extension to also consider terrain. Both GURPS (`shared/rulesets/gurps/rules.ts`) and PF2 (`shared/rulesets/pf2/rules.ts`) have their own movement implementations.
- **MiniMap** (`src/components/game/MiniMap.tsx`): 2D SVG rendering of grid cells and combatant positions. Already handles both hex and square grids. Needs terrain overlay.
- **Match creation** (`server/src/match.ts`): `createMatchState()` creates players, characters, combatants with spawn positions. Map generation would be called here.
- **MatchState** (`shared/types.ts`): No map field yet. Needs optional `mapDefinition?: MapDefinition`.

### Gap Analysis (Self-Conducted)
**Identified gaps addressed in this plan**:
1. **Line of Sight (LoS)**: Blocked terrain should block ranged attacks → OUT OF SCOPE for v1 (would need raycasting algorithm). Cover bonus only for adjacent cells.
2. **Map size vs grid radius**: BattleGrid currently uses `radius=10`. Maps define their own dimensions; BattleGrid radius adapts.
3. **Random seed**: Map generation uses a seed for reproducibility (same seed = same map).
4. **Bot AI + terrain**: Bot pathfinding must respect blocked/difficult terrain.
5. **Performance**: Use InstancedMesh for repeated props; limit prop count per map.
6. **Multi-level terrain**: OUT OF SCOPE — flat terrain only for v1.
7. **Spawn positions**: Map generator must produce valid spawn points that aren't on blocked terrain.

---

## Work Objectives

### Core Objective
Add a server-authoritative map/scenario system with 3D environment rendering, procedural generation, and terrain-aware gameplay mechanics.

### Concrete Deliverables
- `shared/map/types.ts` — MapDefinition, TerrainCell, BiomeId types
- `shared/map/generator.ts` — Procedural map generator (dungeon + wilderness biomes)
- `shared/map/generator.test.ts` — TDD tests for generator
- `shared/map/terrain.ts` — Terrain query helpers (isBlocked, isDifficult, hasCover)
- `shared/map/terrain.test.ts` — TDD tests for terrain helpers
- Modified `shared/types.ts` — MapDefinition added to MatchState
- Modified `shared/rulesets/serverAdapter.ts` — calculateReachableHexesInfo accepts terrain
- Modified movement logic in GURPS and PF2 rules — terrain-aware movement
- Modified `server/src/match.ts` — map generation in createMatchState
- Modified `server/src/handlers/` — terrain checks in movement handlers
- `src/components/arena/EnvironmentProps.tsx` — 3D prop renderer using Quaternius GLB assets
- Modified `src/components/arena/ArenaScene.tsx` — integrates EnvironmentProps
- Modified `src/components/arena/BattleGrid.tsx` — visual terrain indicators on cells
- Modified `src/components/game/MiniMap.tsx` — terrain visualization
- `src/components/lobby/ScenarioSelector.tsx` — lobby biome/scenario picker
- `public/models/environment/` — Quaternius GLB asset files
- Modified combat resolution — cover bonus applied

### Definition of Done
- [x] `npx vitest run` — all tests pass including new terrain/generator tests
- [x] `npm run build` — production build succeeds
- [x] Match with map=dungeon: walls block movement, rooms are connected
- [x] Match with map=wilderness: trees/rocks are placed, some provide cover
- [x] Match without map: works exactly as before (empty grid)
- [x] Bot combatants pathfind around blocked terrain
- [x] Lobby shows scenario selector; selected biome generates a map

### Must Have
- Terrain properties per grid cell: `blocked`, `difficult`, `cover`
- Procedural dungeon generation (rooms + corridors)
- Procedural wilderness generation (scattered props)
- 3D GLB props from Quaternius rendered in scene
- Movement blocked by `blocked` cells
- Movement cost doubled by `difficult` cells
- Server-authoritative map in MatchState
- Backward compatible (no map = empty grid)
- Both hex and square grid support

### Must NOT Have (Guardrails)
- NO line-of-sight / raycasting for ranged attacks (v2 feature)
- NO multi-level terrain / elevation (flat only)
- NO custom map editor (procedural only)
- NO dynamic terrain changes during combat
- NO asset marketplace / custom asset uploads
- NO weather effects or day/night cycle
- NO pathfinding visualization in UI (only reachable hex highlighting)
- DO NOT change spawn logic to use absolute positions — use relative spawn from map definition
- DO NOT introduce new npm dependencies for generation (use pure algorithms)
- DO NOT modify message protocol types beyond adding mapDefinition to MatchState

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.

### Test Decision
- **Infrastructure exists**: YES (Vitest with happy-dom)
- **Automated tests**: TDD (RED-GREEN-REFACTOR)
- **Framework**: Vitest

### TDD Task Structure
Each TODO follows RED-GREEN-REFACTOR:
1. **RED**: Write failing test first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping green

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — Foundation):
├── Task 1: Shared types (MapDefinition, TerrainCell, BiomeId)
├── Task 3: Download & organize Quaternius GLB assets
└── Task 4: Lobby ScenarioSelector UI component

Wave 2 (After Wave 1 — Core Logic):
├── Task 2: Procedural map generator (depends: 1)
├── Task 5: Terrain query helpers + movement integration (depends: 1)
└── Task 6: 3D EnvironmentProps renderer (depends: 1, 3)

Wave 3 (After Wave 2 — Integration):
├── Task 7: Server integration — match creation + map in state (depends: 2, 5)
├── Task 8: BattleGrid + MiniMap terrain visualization (depends: 1, 6)
└── Task 9: Combat cover integration (depends: 5, 7)

Wave 4 (After Wave 3 — Polish):
└── Task 10: End-to-end integration + bot AI terrain awareness (depends: 7, 8, 9)
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 4, 5, 6, 8 | 3, 4 |
| 2 | 1 | 7 | 5, 6 |
| 3 | None | 6 | 1, 4 |
| 4 | None | 10 | 1, 3 |
| 5 | 1 | 7, 9 | 2, 6 |
| 6 | 1, 3 | 8 | 2, 5 |
| 7 | 2, 5 | 9, 10 | 8 |
| 8 | 1, 6 | 10 | 7, 9 |
| 9 | 5, 7 | 10 | 8 |
| 10 | 7, 8, 9 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 3, 4 | task(category="quick"), task(category="unspecified-low"), task(category="visual-engineering") |
| 2 | 2, 5, 6 | task(category="ultrabrain"), task(category="deep"), task(category="visual-engineering") |
| 3 | 7, 8, 9 | task(category="unspecified-high"), task(category="visual-engineering"), task(category="unspecified-high") |
| 4 | 10 | task(category="deep") |

---

## TODOs

- [x] 1. Define Shared Map Types (MapDefinition, TerrainCell, BiomeId)

  **What to do**:
  - Create `shared/map/types.ts` with:
    ```typescript
    type BiomeId = 'dungeon' | 'wilderness';
    type TerrainProperty = 'blocked' | 'difficult' | 'cover';
    type TerrainCell = {
      q: number;
      r: number;
      terrain: TerrainProperty[];
      propId?: string; // references a 3D prop to render
      propRotation?: number;
    };
    type SpawnZone = {
      team: 'player' | 'enemy';
      cells: { q: number; r: number }[];
    };
    type MapDefinition = {
      id: string;
      biome: BiomeId;
      seed: number;
      width: number;
      height: number;
      cells: TerrainCell[];
      spawnZones: SpawnZone[];
      props: { id: string; model: string; scale?: number }[];
    };
    ```
  - Add `mapDefinition?: MapDefinition` to `MatchState` in `shared/types.ts`
  - Add `mapDefinition?: MapDefinition` to `MatchSummary` (or a subset for preview)
  - Create `shared/map/index.ts` barrel export
  - TDD: Write test that validates MapDefinition shape, TerrainCell creation, and type guards

  **Must NOT do**:
  - Don't add map to the WebSocket message types yet (that's Task 7)
  - Don't create any rendering code
  - Don't add elevation/height to TerrainCell

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward type definitions, small scope
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI work in this task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 3, 4)
  - **Blocks**: Tasks 2, 4, 5, 6, 8
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `shared/types.ts:34-43` — `GridPosition` and `HexCoord` types: use same coordinate pattern for TerrainCell
  - `shared/types.ts:65-86` — `MatchState` type: add `mapDefinition?: MapDefinition` field here
  - `shared/types.ts:88-103` — `MatchSummary` type: may need map metadata for lobby preview
  - `shared/grid/types.ts:3-6` — `GridCoord` type: terrain cells should use same `q, r` coordinate system

  **API/Type References**:
  - `shared/types.ts:16` — `RulesetId` type: BiomeId follows same union string pattern

  **Test References**:
  - `shared/grid/grid.test.ts` — Testing patterns for shared pure types

  **Acceptance Criteria**:
  - [ ] `shared/map/types.ts` exists with MapDefinition, TerrainCell, BiomeId, SpawnZone types
  - [ ] `shared/map/index.ts` barrel export exists
  - [ ] `shared/types.ts` MatchState has optional `mapDefinition?: MapDefinition`
  - [ ] `npx vitest run shared/map` → PASS
  - [ ] Type-check: `npm run build` succeeds (no type errors)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Type definitions compile correctly
    Tool: Bash
    Preconditions: Project has TypeScript configured
    Steps:
      1. Run: npx tsc --noEmit
      2. Assert: Exit code 0
      3. Assert: No errors mentioning "map/types"
    Expected Result: All new types compile without errors
    Evidence: Terminal output captured

  Scenario: Test file passes
    Tool: Bash
    Preconditions: shared/map/types.test.ts exists
    Steps:
      1. Run: npx vitest run shared/map
      2. Assert: Exit code 0
      3. Assert: Output contains "Tests passed" or similar
    Expected Result: All type tests pass
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `feat(map): add MapDefinition and TerrainCell shared types`
  - Files: `shared/map/types.ts`, `shared/map/index.ts`, `shared/map/types.test.ts`, `shared/types.ts`
  - Pre-commit: `npx vitest run shared/map`

---

- [x] 2. Procedural Map Generator (Dungeon + Wilderness Biomes)

  **What to do**:
  - Create `shared/map/generator.ts` with:
    - `generateMap(biome: BiomeId, options: { seed: number; gridType: GridType; width?: number; height?: number }): MapDefinition`
    - Dungeon biome: BSP (Binary Space Partition) or simple room-placement algorithm
      - Generate 3-6 rooms of varying sizes
      - Connect rooms with corridors (1-2 cells wide)
      - Mark room interiors as walkable, walls as `blocked`
      - Add occasional `cover` props (pillars, crates) inside rooms
      - Add `difficult` terrain in some corridors (rubble)
    - Wilderness biome:
      - Open field with scattered trees (some `blocked`, large trunks), rocks (`cover`), bushes (`difficult`)
      - Perimeter can have dense tree line (`blocked`)
      - Central area mostly open for combat
    - Both biomes must generate valid spawn zones (team A and team B on opposite sides)
    - Use seeded PRNG (simple mulberry32 or similar) for reproducibility
    - Grid-type agnostic: works with both hex and square coords
  - TDD: Write comprehensive tests:
    - RED: Test that generated dungeon has rooms, corridors, no isolated areas
    - RED: Test that wilderness has open center, scattered props
    - RED: Test that spawn zones are on opposite sides and not blocked
    - RED: Test same seed produces same map
    - GREEN: Implement generator
    - REFACTOR: Clean up

  **Must NOT do**:
  - Don't generate any 3D geometry — only data (MapDefinition)
  - Don't create more than 2 biomes
  - Don't use external libraries for generation (pure TypeScript algorithms)
  - Don't handle biome-specific visual themes (that's Task 6)

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Algorithm design (BSP, seeded PRNG, connectivity validation) requires careful logic
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI, pure algorithm

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `shared/rulesets/gurps/rules.ts` — Pure function patterns with `random` parameter for testability (same pattern for seeded PRNG)
  - `shared/grid/types.ts:13-25` — `GridSystem` interface: generator should use `GridCoord` for cell positions

  **API/Type References**:
  - `shared/map/types.ts` (from Task 1) — MapDefinition, TerrainCell types to produce
  - `shared/grid/types.ts:1` — GridType ('hex' | 'square') for grid-type awareness

  **Documentation References**:
  - BSP dungeon generation: well-known algorithm — partition rectangle into rooms, connect with corridors
  - Mulberry32 PRNG: simple seeded random `function mulberry32(a: number) { ... }`

  **Test References**:
  - `shared/rulesets/gurps/rules.test.ts` — Pattern for testing pure functions with controlled randomness

  **Acceptance Criteria**:
  - [ ] `shared/map/generator.ts` exports `generateMap()`
  - [ ] `shared/map/generator.test.ts` has tests for both biomes
  - [ ] Dungeon maps have 3-6 connected rooms, no unreachable areas
  - [ ] Wilderness maps have open center, scattered props around edges
  - [ ] Both biomes produce valid spawn zones (not on blocked cells, opposite sides)
  - [ ] Same seed + same options → identical MapDefinition
  - [ ] `npx vitest run shared/map/generator` → PASS (all tests)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Dungeon generation produces valid connected map
    Tool: Bash
    Preconditions: shared/map/generator.ts exists
    Steps:
      1. Run: npx vitest run shared/map/generator -t "dungeon"
      2. Assert: All dungeon tests pass
      3. Assert: Output shows room count between 3-6
    Expected Result: Dungeon generator creates valid connected maps
    Evidence: Test output captured

  Scenario: Seed reproducibility
    Tool: Bash
    Preconditions: Generator and tests exist
    Steps:
      1. Run: npx vitest run shared/map/generator -t "seed"
      2. Assert: Test passes confirming identical output for same seed
    Expected Result: Same seed always produces same map
    Evidence: Test output captured

  Scenario: Wilderness generation has open center
    Tool: Bash
    Preconditions: Generator exists
    Steps:
      1. Run: npx vitest run shared/map/generator -t "wilderness"
      2. Assert: All wilderness tests pass
    Expected Result: Wilderness maps have playable open center
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `feat(map): add procedural map generator for dungeon and wilderness biomes`
  - Files: `shared/map/generator.ts`, `shared/map/generator.test.ts`
  - Pre-commit: `npx vitest run shared/map`

---

- [x] 3. Download and Organize Quaternius GLB Assets

  **What to do**:
  - Visit quaternius.com and download relevant asset packs:
    - **Modular Dungeon Pack**: walls, floors, pillars, doors, crates, barrels
    - **Stylized Nature Pack** (subset): trees (2-3 variants), rocks (2-3 variants), bushes, grass patches
  - Organize into `public/models/environment/`:
    ```
    public/models/environment/
      dungeon/
        wall.glb
        wall_corner.glb
        floor.glb
        pillar.glb
        crate.glb
        barrel.glb
        door.glb
      wilderness/
        tree_01.glb
        tree_02.glb
        rock_01.glb
        rock_02.glb
        bush.glb
        grass.glb
    ```
  - Create `src/data/environmentAssets.ts` — asset registry mapping propId to model path, scale, and terrain properties:
    ```typescript
    type EnvironmentAsset = {
      id: string;
      path: string;
      scale: number;
      defaultTerrain: TerrainProperty[];
      biomes: BiomeId[];
    };
    const ENVIRONMENT_ASSETS: Record<string, EnvironmentAsset> = { ... };
    ```
  - Verify each GLB loads in a browser by creating a simple test scene (optional)
  - Keep total asset size under 5MB for reasonable load times

  **Must NOT do**:
  - Don't modify any existing components
  - Don't create rendering logic (that's Task 6)
  - Don't download entire packs — only select needed assets
  - Don't include animated assets (static props only)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: File download and organization, no complex logic
  - **Skills**: [`dev-browser`]
    - `dev-browser`: Needed to navigate quaternius.com and download assets

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 4)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/data/modelRegistry.ts` — Existing pattern for registering 3D model assets (follow same structure)
  - `src/data/characterTemplates.ts` — Static data registry pattern

  **External References**:
  - Quaternius.com: https://quaternius.com — CC0 licensed 3D asset packs
  - Specifically: "Modular Dungeon" and "Stylized Nature" packs

  **Acceptance Criteria**:
  - [ ] `public/models/environment/dungeon/` contains at least 5 GLB files (wall, floor, pillar, crate, barrel)
  - [ ] `public/models/environment/wilderness/` contains at least 5 GLB files (tree x2, rock x2, bush)
  - [ ] `src/data/environmentAssets.ts` exports asset registry with all downloaded props
  - [ ] Total GLB file size under 5MB
  - [ ] Each asset has correct terrain property mapping

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Asset files exist and are valid GLB
    Tool: Bash
    Preconditions: Assets downloaded
    Steps:
      1. Run: ls -la public/models/environment/dungeon/*.glb | wc -l
      2. Assert: At least 5 files
      3. Run: ls -la public/models/environment/wilderness/*.glb | wc -l
      4. Assert: At least 5 files
      5. Run: du -sh public/models/environment/
      6. Assert: Total size under 5MB
    Expected Result: All required assets present and within size budget
    Evidence: Terminal output captured

  Scenario: Asset registry is valid TypeScript
    Tool: Bash
    Preconditions: environmentAssets.ts exists
    Steps:
      1. Run: npx tsc --noEmit
      2. Assert: Exit code 0
    Expected Result: Asset registry compiles
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `feat(map): add Quaternius GLB environment assets and registry`
  - Files: `public/models/environment/**/*.glb`, `src/data/environmentAssets.ts`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 4. Lobby Scenario Selector UI Component

  **What to do**:
  - Create `src/components/lobby/ScenarioSelector.tsx`:
    - Dropdown or card-based selector for biome: "No Scenario" (default), "Dungeon", "Wilderness"
    - Show biome icon/illustration for each option
    - When a biome is selected, show a brief description
    - "No Scenario" = matches work as before (empty grid)
    - Emit `onBiomeSelect(biome: BiomeId | null)` callback
  - Integrate into lobby flow:
    - Add ScenarioSelector to `src/components/lobby/MatchSettings.tsx` or `LobbyScreen.tsx`
    - Selected biome is passed along when creating/starting a match
  - Add `scenarioBiome?: BiomeId` to `create_match` message in `shared/types.ts` ClientToServerMessage
  - Style consistent with existing lobby UI

  **Must NOT do**:
  - Don't implement the 2D map preview yet (that's part of Task 8/10)
  - Don't generate any maps client-side
  - Don't touch any game screen components
  - Don't add seed configuration UI (seeds are auto-generated server-side)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with styling, needs to match existing lobby aesthetic
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Lobby UI design and styling

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 10
  - **Blocked By**: None (can use BiomeId as simple string union initially)

  **References**:

  **Pattern References**:
  - `src/components/lobby/MatchSettings.tsx` — Existing lobby settings component (integrate here)
  - `src/components/lobby/LobbyScreen.tsx` — Lobby layout and flow
  - `src/components/lobby/PlayerList.tsx` — Lobby component styling patterns
  - `src/components/dashboard/CreateMatchDialog.tsx` — Match creation flow

  **API/Type References**:
  - `shared/types.ts:105-127` — ClientToServerMessage: add `scenarioBiome?: BiomeId` to `create_match`
  - `shared/types.ts:108` — `create_match` message shape

  **Acceptance Criteria**:
  - [ ] `src/components/lobby/ScenarioSelector.tsx` exists and renders biome options
  - [ ] ScenarioSelector integrated into lobby (MatchSettings or LobbyScreen)
  - [ ] "No Scenario" is default option
  - [ ] `create_match` message in shared/types.ts accepts optional `scenarioBiome`
  - [ ] `npm run build` succeeds
  - [ ] Component is styled consistent with existing lobby UI

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: ScenarioSelector renders all options
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running on localhost:5173, user authenticated
    Steps:
      1. Navigate to: http://localhost:5173
      2. Create or join a match lobby
      3. Wait for: lobby screen visible (timeout: 10s)
      4. Assert: ScenarioSelector component visible
      5. Assert: Options include "No Scenario", "Dungeon", "Wilderness"
      6. Click: "Dungeon" option
      7. Assert: Dungeon description text visible
      8. Screenshot: .sisyphus/evidence/task-4-scenario-selector.png
    Expected Result: All biome options render and are selectable
    Evidence: .sisyphus/evidence/task-4-scenario-selector.png
  ```

  **Commit**: YES
  - Message: `feat(lobby): add scenario biome selector to match creation`
  - Files: `src/components/lobby/ScenarioSelector.tsx`, `src/components/lobby/MatchSettings.tsx`, `shared/types.ts`
  - Pre-commit: `npm run build`

---

- [x] 5. Terrain Query Helpers + Movement Integration

  **What to do**:
  - Create `shared/map/terrain.ts` with pure helper functions:
    ```typescript
    function isBlocked(map: MapDefinition | undefined, q: number, r: number): boolean
    function isDifficultTerrain(map: MapDefinition | undefined, q: number, r: number): boolean
    function hasCover(map: MapDefinition | undefined, q: number, r: number): boolean
    function getMovementCost(map: MapDefinition | undefined, q: number, r: number): number // 1 or 2
    function getTerrainAt(map: MapDefinition | undefined, q: number, r: number): TerrainCell | null
    ```
    - All functions return safe defaults when map is undefined (backward compat)
  - Create `shared/map/terrain.test.ts` — TDD tests for all helpers
  - Modify `calculateReachableHexesInfo` in both GURPS and PF2 rules:
    - Accept optional `MapDefinition` parameter
    - Exclude `blocked` cells from reachable set
    - Double cost for `difficult` cells
    - The function signature in `ServerRulesetAdapter` must be updated:
      `calculateReachableHexesInfo: (state: TurnMovementState, occupiedHexes: HexCoord[], mapDefinition?: MapDefinition) => ReachableHexInfo[]`
  - Modify `executeMove` similarly — reject moves to blocked cells
  - TDD flow:
    - RED: Test that blocked cell is not reachable
    - RED: Test that difficult terrain costs 2 points
    - RED: Test that undefined map = all cells walkable (backward compat)
    - GREEN: Implement
    - REFACTOR

  **Must NOT do**:
  - Don't modify combat/defense logic (that's Task 9)
  - Don't modify UI components
  - Don't change the overall movement algorithm — only add terrain filtering
  - Don't break existing movement tests

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Modifying core movement logic across 2 rulesets requires careful understanding of existing pathfinding
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 6)
  - **Blocks**: Tasks 7, 9
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `shared/rulesets/gurps/rules.ts` — GURPS `calculateReachableHexesInfo()` implementation: this is where terrain filtering is added
  - `shared/rulesets/pf2/rules.ts` — PF2 `calculateReachableHexesInfo()` implementation: same modification needed
  - `shared/rulesets/serverAdapter.ts:228` — `calculateReachableHexesInfo` signature in ServerRulesetAdapter interface

  **API/Type References**:
  - `shared/map/types.ts` (from Task 1) — MapDefinition, TerrainCell
  - `shared/rulesets/serverAdapter.ts:213-283` — ServerRulesetAdapter interface: update method signatures
  - `shared/grid/types.ts:27-31` — ReachableCell type

  **Test References**:
  - `shared/grid/grid.test.ts` — Grid system testing patterns
  - `server/src/handlers/pf2/stride.test.ts` — PF2 movement tests (must still pass)
  - `server/src/handlers/gurps/attack.test.ts` — GURPS handler tests (must still pass)

  **Acceptance Criteria**:
  - [ ] `shared/map/terrain.ts` exports all 5 helper functions
  - [ ] `shared/map/terrain.test.ts` tests all helpers
  - [ ] `calculateReachableHexesInfo` in GURPS rules accepts and respects MapDefinition
  - [ ] `calculateReachableHexesInfo` in PF2 rules accepts and respects MapDefinition
  - [ ] Blocked cells excluded from reachable hexes
  - [ ] Difficult terrain costs 2 movement points
  - [ ] Undefined map = all cells walkable (backward compat)
  - [ ] `npx vitest run` → ALL existing + new tests pass

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Blocked terrain prevents movement
    Tool: Bash
    Preconditions: terrain.test.ts and modified rules exist
    Steps:
      1. Run: npx vitest run shared/map/terrain -t "blocked"
      2. Assert: All blocked terrain tests pass
      3. Run: npx vitest run shared/rulesets -t "reachable"
      4. Assert: Reachable hex tests pass with terrain awareness
    Expected Result: Blocked cells are never in reachable set
    Evidence: Test output captured

  Scenario: Backward compatibility — no map = full movement
    Tool: Bash
    Preconditions: Modified movement functions exist
    Steps:
      1. Run: npx vitest run -t "backward"
      2. Assert: Tests pass showing undefined map doesn't restrict movement
    Expected Result: Existing behavior preserved when no map
    Evidence: Test output captured

  Scenario: All existing tests still pass
    Tool: Bash
    Preconditions: All modifications complete
    Steps:
      1. Run: npx vitest run
      2. Assert: Exit code 0
      3. Assert: No test regressions
    Expected Result: Zero existing test failures
    Evidence: Full test output captured
  ```

  **Commit**: YES
  - Message: `feat(map): add terrain helpers and terrain-aware movement validation`
  - Files: `shared/map/terrain.ts`, `shared/map/terrain.test.ts`, `shared/rulesets/gurps/rules.ts`, `shared/rulesets/pf2/rules.ts`, `shared/rulesets/serverAdapter.ts`
  - Pre-commit: `npx vitest run`

---

- [x] 6. 3D Environment Props Renderer (EnvironmentProps Component)

  **What to do**:
  - Create `src/components/arena/EnvironmentProps.tsx`:
    - Accepts `mapDefinition: MapDefinition | undefined` prop
    - If no map, renders nothing
    - For each TerrainCell with a `propId`, render the corresponding GLB model
    - Use `useGLTF` from `@react-three/drei` to load models
    - Use `<Instances>` / `<InstancedMesh>` for repeated props (walls, floors) for performance
    - Position props using `gridSystem.coordToWorld()` to align with BattleGrid cells
    - Support both hex and square grid positioning
    - Props are static (no animation, no interaction)
  - Preload all biome assets when map is selected using `useGLTF.preload()`
  - Add to ArenaScene as sibling of BattleGrid:
    ```tsx
    <EnvironmentProps mapDefinition={matchState?.mapDefinition} gridType={gridType} />
    ```
  - Performance budget: handle up to 500 instanced props smoothly

  **Must NOT do**:
  - Don't add click handlers to props
  - Don't add animations or particle effects
  - Don't modify BattleGrid cell rendering (that's Task 8)
  - Don't load assets for biomes not in use

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 3D rendering with React Three Fiber, instancing, performance optimization
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: 3D scene composition and visual quality

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 5)
  - **Blocks**: Task 8
  - **Blocked By**: Tasks 1, 3

  **References**:

  **Pattern References**:
  - `src/components/arena/ArenaScene.tsx:147-227` — Current 3D scene structure: EnvironmentProps goes between BattleGrid and Combatant rendering
  - `src/components/arena/Combatant.tsx` — How 3D models are positioned and rendered in the scene
  - `src/components/arena/BattleGrid.tsx:29-31` — getGridSystem() helper for grid type switching

  **API/Type References**:
  - `shared/map/types.ts` (Task 1) — MapDefinition, TerrainCell with propId/propRotation
  - `src/data/environmentAssets.ts` (Task 3) — Asset registry mapping propId to GLB path
  - `shared/grid/types.ts:13-25` — GridSystem.coordToWorld() for positioning

  **External References**:
  - @react-three/drei useGLTF: https://github.com/pmndrs/drei#usegltf — GLB loading
  - Three.js InstancedMesh: https://threejs.org/docs/#api/en/objects/InstancedMesh — Performance instancing

  **Acceptance Criteria**:
  - [ ] `src/components/arena/EnvironmentProps.tsx` exists and renders props from MapDefinition
  - [ ] Props are positioned correctly on grid cells (aligned with BattleGrid)
  - [ ] Uses instancing for repeated props (walls, trees)
  - [ ] Renders nothing when mapDefinition is undefined
  - [ ] Integrated into ArenaScene.tsx
  - [ ] `npm run build` succeeds

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Environment props render in dungeon biome
    Tool: Playwright (playwright skill)
    Preconditions: Dev server on localhost:5173, server on localhost:8080, dungeon assets downloaded
    Steps:
      1. Navigate to: http://localhost:5173
      2. Create a match with "Dungeon" scenario selected
      3. Start combat
      4. Wait for: 3D scene loaded (timeout: 15s)
      5. Assert: Scene contains 3D wall/pillar meshes (visible in canvas)
      6. Screenshot: .sisyphus/evidence/task-6-dungeon-props.png
    Expected Result: Dungeon walls and props visible in 3D scene
    Evidence: .sisyphus/evidence/task-6-dungeon-props.png

  Scenario: No props when no scenario selected
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running
    Steps:
      1. Create a match with "No Scenario" selected
      2. Start combat
      3. Wait for: 3D scene loaded
      4. Assert: No environment props visible (only grid + combatants)
      5. Screenshot: .sisyphus/evidence/task-6-no-scenario.png
    Expected Result: Empty grid as before
    Evidence: .sisyphus/evidence/task-6-no-scenario.png
  ```

  **Commit**: YES
  - Message: `feat(arena): add 3D environment props renderer with GLB instancing`
  - Files: `src/components/arena/EnvironmentProps.tsx`, `src/components/arena/ArenaScene.tsx`
  - Pre-commit: `npm run build`

---

- [x] 7. Server Integration — Match Creation with Maps

  **What to do**:
  - Modify `server/src/handlers.ts` — handle `scenarioBiome` in `create_match` message:
    - Store biome preference on match metadata
  - Modify `server/src/match.ts` — `createMatchState()`:
    - If biome is selected, call `generateMap(biome, { seed: Date.now(), gridType })` 
    - Include generated `MapDefinition` in the MatchState
    - Use map's spawn zones for combatant placement instead of default hardcoded positions
    - If no biome, matchState.mapDefinition = undefined (backward compat)
  - Pass `mapDefinition` through `match_state` messages (already part of MatchState)
  - Modify movement handlers to pass mapDefinition to `calculateReachableHexesInfo`:
    - `server/src/handlers/gurps/movement.ts` — pass `match.mapDefinition`
    - `server/src/handlers/pf2/stride.ts` — pass `match.mapDefinition`
  - Modify server-side movement validation:
    - Reject moves to blocked cells
    - Account for difficult terrain movement costs
  - Add to `ClientToServerMessage` create_match type: `scenarioBiome?: BiomeId`

  **Must NOT do**:
  - Don't modify combat damage/defense handlers (that's Task 9)
  - Don't add map editing endpoints
  - Don't persist maps to database (in-memory with MatchState is sufficient)
  - Don't add map regeneration during combat

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Server-side integration across multiple handlers, requires understanding of message flow
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 9)
  - **Blocks**: Tasks 9, 10
  - **Blocked By**: Tasks 2, 5

  **References**:

  **Pattern References**:
  - `server/src/match.ts:1-61` — `createMatchState()`: add map generation call, use spawn zones for combatant placement
  - `server/src/match.ts:48-61` — Current hardcoded spawn positions: replace with spawn zone logic when map exists
  - `server/src/handlers.ts` — Main message handler: add biome to create_match handling
  - `server/src/handlers/gurps/movement.ts` — GURPS movement handler: pass mapDefinition to reachable hex calculation
  - `server/src/handlers/pf2/stride.ts` — PF2 stride handler: pass mapDefinition

  **API/Type References**:
  - `shared/types.ts:108` — `create_match` message: add `scenarioBiome?: BiomeId`
  - `shared/types.ts:65-86` — MatchState: already has `mapDefinition` from Task 1
  - `shared/map/generator.ts` (Task 2) — `generateMap()` function
  - `shared/map/terrain.ts` (Task 5) — Terrain helpers for validation

  **Test References**:
  - `server/src/handlers/pf2/stride.test.ts` — Existing stride tests (must still pass)
  - `server/src/handlers/pf2/__tests__/testUtils.ts` — PF2 test utilities

  **Acceptance Criteria**:
  - [ ] `create_match` with `scenarioBiome: 'dungeon'` generates a map in MatchState
  - [ ] `create_match` without scenarioBiome → mapDefinition is undefined
  - [ ] Combatants spawned at map spawn zones when map exists
  - [ ] Movement handlers pass mapDefinition to reachable hex calculation
  - [ ] Server rejects moves to blocked cells
  - [ ] `npx vitest run` → ALL tests pass

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Match with dungeon biome has map in state
    Tool: Bash (curl to WebSocket is complex, use test instead)
    Preconditions: Server running on localhost:8080
    Steps:
      1. Run: npx vitest run server/src -t "map"
      2. Assert: Tests pass confirming map generation on match creation
    Expected Result: MatchState includes mapDefinition when biome is selected
    Evidence: Test output captured

  Scenario: Backward compatibility — no biome = no map
    Tool: Bash
    Preconditions: Server tests exist
    Steps:
      1. Run: npx vitest run server/src -t "backward"
      2. Assert: Tests pass for matches without biome selection
    Expected Result: Existing match creation unaffected
    Evidence: Test output captured

  Scenario: All existing server tests pass
    Tool: Bash
    Steps:
      1. Run: npx vitest run
      2. Assert: Exit code 0
    Expected Result: No regressions
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `feat(server): integrate map generation into match creation and movement handlers`
  - Files: `server/src/match.ts`, `server/src/handlers.ts`, `server/src/handlers/gurps/movement.ts`, `server/src/handlers/pf2/stride.ts`, `shared/types.ts`
  - Pre-commit: `npx vitest run`

---

- [x] 8. BattleGrid + MiniMap Terrain Visualization

  **What to do**:
  - Modify `src/components/arena/BattleGrid.tsx`:
    - Accept optional `mapDefinition?: MapDefinition` prop
    - Modify `getCellStyle()` to check terrain properties:
      - `blocked` cells: darker color, maybe a subtle X pattern or wall-like texture
      - `difficult` cells: slightly different tint (amber/brown), scratched texture
      - `cover` cells: blue/teal edge highlight
    - Don't render cells outside map bounds when map is defined
    - Adapt grid radius from map dimensions when map exists
  - Modify `src/components/game/MiniMap.tsx`:
    - Accept optional `mapDefinition?: MapDefinition` prop
    - Render terrain cells in the 2D minimap:
      - `blocked` cells: solid dark fill
      - `difficult` cells: hatched/striped fill
      - `cover` cells: small dot or icon
    - Use this also as the "preview" in lobby (optional — can be a separate minimap preview)
  - Pass mapDefinition from GameScreen through to BattleGrid and MiniMap

  **Must NOT do**:
  - Don't modify EnvironmentProps (that's Task 6)
  - Don't change cell click behavior
  - Don't add terrain tooltips (v2)
  - Don't modify movement highlights — they already use reachable hexes which respect terrain

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Visual styling of grid cells and minimap, needs design sensibility
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Visual design for terrain indicators

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 9)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 1, 6

  **References**:

  **Pattern References**:
  - `src/components/arena/BattleGrid.tsx:45-67` — `getCellStyle()` function: extend with terrain-based styling
  - `src/components/game/MiniMap.tsx:1-60` — MiniMap rendering: add terrain cell visualization
  - `src/components/game/MiniMap.tsx:16-26` — Coordinate-to-pixel conversion functions

  **API/Type References**:
  - `shared/map/types.ts` (Task 1) — MapDefinition, TerrainCell
  - `shared/map/terrain.ts` (Task 5) — Terrain query helpers

  **Acceptance Criteria**:
  - [ ] BattleGrid shows visual distinction for blocked/difficult/cover cells
  - [ ] MiniMap shows terrain as colored/styled cells
  - [ ] When no map, both components render as before
  - [ ] Grid adapts to map dimensions when map is defined
  - [ ] `npm run build` succeeds

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: BattleGrid shows terrain styling
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, match with dungeon map active
    Steps:
      1. Navigate to: http://localhost:5173
      2. Join/create match with dungeon biome
      3. Start combat
      4. Wait for: 3D scene loaded (timeout: 15s)
      5. Assert: Grid cells have visible terrain indicators
      6. Assert: Wall cells are visibly different from floor cells
      7. Screenshot: .sisyphus/evidence/task-8-battlegrid-terrain.png
    Expected Result: Grid cells show terrain properties visually
    Evidence: .sisyphus/evidence/task-8-battlegrid-terrain.png

  Scenario: MiniMap shows terrain overlay
    Tool: Playwright (playwright skill)
    Preconditions: Match with map active
    Steps:
      1. Assert: MiniMap component visible
      2. Assert: MiniMap shows dark cells for blocked terrain
      3. Screenshot: .sisyphus/evidence/task-8-minimap-terrain.png
    Expected Result: MiniMap renders terrain information
    Evidence: .sisyphus/evidence/task-8-minimap-terrain.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add terrain visualization to BattleGrid and MiniMap`
  - Files: `src/components/arena/BattleGrid.tsx`, `src/components/game/MiniMap.tsx`, `src/components/game/GameScreen.tsx`
  - Pre-commit: `npm run build`

---

- [x] 9. Combat Cover Integration

  **What to do**:
  - Modify combat resolution to apply cover bonus:
    - When a defender is on a `cover` cell, apply a defense bonus
    - GURPS: +2 to active defense (or -2 to attacker's effective skill)
    - PF2: +2 circumstance bonus to AC (standard cover)
  - Modify relevant combat handlers:
    - `server/src/handlers/gurps/attack.ts` — check defender's cell for cover
    - `server/src/handlers/pf2/attack.ts` — check defender's cell for cover
  - Use terrain helpers from Task 5: `hasCover(map, q, r)`
  - Add cover info to combat log messages: "Target has cover (+2 defense)"
  - TDD:
    - RED: Test that attack against target on cover cell has modified defense
    - RED: Test that cover has no effect when map is undefined
    - GREEN: Implement
    - REFACTOR

  **Must NOT do**:
  - Don't implement line-of-sight / ranged attack blocking (v2)
  - Don't change the cover bonus values (keep simple +2 for both rulesets)
  - Don't add partial cover / three-quarter cover variants
  - Don't modify melee vs ranged distinction for cover (apply uniformly for v1)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Modifying combat resolution in two rulesets requires understanding of attack/defense flow
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 8)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 5, 7

  **References**:

  **Pattern References**:
  - `server/src/handlers/gurps/attack.ts` — GURPS attack resolution: add cover check before defense calculation
  - `server/src/handlers/pf2/attack.ts` — PF2 attack resolution: add cover bonus to AC
  - `shared/rulesets/serverAdapter.ts:539-592` — `gurpsCalculateEffectiveSkill`: potential place for attacker penalty from cover

  **API/Type References**:
  - `shared/map/terrain.ts` (Task 5) — `hasCover()` function
  - `shared/rulesets/serverAdapter.ts:102-151` — CombatDomain interface: cover modifier fits into existing defense calculation flow

  **Test References**:
  - `server/src/handlers/gurps/attack.test.ts` — GURPS attack tests: add cover test cases
  - `server/src/handlers/pf2/attack.test.ts` — PF2 attack tests: add cover test cases

  **Acceptance Criteria**:
  - [ ] Defender on cover cell gets +2 defense bonus (GURPS)
  - [ ] Defender on cover cell gets +2 AC bonus (PF2)
  - [ ] No cover effect when map is undefined
  - [ ] Combat log mentions cover when applicable
  - [ ] `npx vitest run` → ALL tests pass

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Cover bonus applied in GURPS combat
    Tool: Bash
    Steps:
      1. Run: npx vitest run server/src/handlers/gurps/attack -t "cover"
      2. Assert: Tests pass confirming cover bonus
    Expected Result: Defense value increased by 2 when defender has cover
    Evidence: Test output captured

  Scenario: Cover bonus applied in PF2 combat
    Tool: Bash
    Steps:
      1. Run: npx vitest run server/src/handlers/pf2/attack -t "cover"
      2. Assert: Tests pass confirming cover bonus
    Expected Result: AC increased by 2 when defender has cover
    Evidence: Test output captured

  Scenario: No regression in existing combat tests
    Tool: Bash
    Steps:
      1. Run: npx vitest run server/src/handlers
      2. Assert: Exit code 0
    Expected Result: All handler tests pass
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `feat(combat): apply cover defense bonus from terrain`
  - Files: `server/src/handlers/gurps/attack.ts`, `server/src/handlers/pf2/attack.ts`
  - Pre-commit: `npx vitest run`

---

- [x] 10. End-to-End Integration + Bot AI Terrain Awareness

  **What to do**:
  - **Bot AI terrain awareness**:
    - Modify `server/src/bot.ts` — bot movement selection must respect terrain:
      - Don't move to blocked cells
      - Prefer cover cells when approaching enemies
      - Account for difficult terrain in path cost evaluation
    - Modify bot movement in both `server/src/rulesets/gurps/bot.ts` and `server/src/rulesets/pf2/bot.ts`
  - **Full integration testing**:
    - Verify complete flow: lobby → select biome → create match → map generated → 3D scene renders with props → movement respects terrain → cover affects combat → bot navigates terrain
    - Test both biomes (dungeon and wilderness) with both rulesets (GURPS and PF2)
  - **Lobby preview**: Add minimap preview in lobby when biome is selected (reuse MiniMap component with generated preview map)
  - **Edge case handling**:
    - What if all spawn cells are blocked? (shouldn't happen with generator, but add safety check)
    - What if a combatant dies on a cover/difficult cell? (no issue — cell properties are static)
    - Large maps: verify BattleGrid and camera handle bigger areas

  **Must NOT do**:
  - Don't add advanced bot tactics (just basic terrain respect)
  - Don't add new biomes
  - Don't optimize for mobile (desktop-first for v1)
  - Don't add map persistence to database

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Cross-cutting integration task touching bot AI, lobby UI, and 3D rendering
  - **Skills**: [`playwright`]
    - `playwright`: End-to-end browser testing of full flow

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (sequential, final task)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 7, 8, 9

  **References**:

  **Pattern References**:
  - `server/src/bot.ts` — Bot decision making: add terrain checks to movement selection
  - `server/src/rulesets/gurps/bot.ts` — GURPS bot: movement uses reachable hexes (already terrain-filtered from Task 5)
  - `server/src/rulesets/pf2/bot.ts` — PF2 bot: same pattern
  - `src/components/lobby/ScenarioSelector.tsx` (Task 4) — Add minimap preview here

  **API/Type References**:
  - All types from previous tasks
  - `shared/map/terrain.ts` — hasCover() for bot preference

  **Test References**:
  - `server/src/rulesets/pf2/bot.test.ts` — Existing bot tests: extend with terrain scenarios

  **Acceptance Criteria**:
  - [ ] Bot never moves to blocked cells
  - [ ] Bot prefers cover cells when available and moving toward enemy
  - [ ] Full flow works: lobby → biome select → match create → combat with terrain
  - [ ] Both GURPS hex and PF2 square grids work with both biomes
  - [ ] Lobby shows minimap preview when biome is selected
  - [ ] `npx vitest run` → ALL tests pass
  - [ ] `npm run build` → succeeds
  - [ ] `npm run lint` → passes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Full dungeon flow — GURPS
    Tool: Playwright (playwright skill)
    Preconditions: Dev server on :5173, server on :8080
    Steps:
      1. Navigate to: http://localhost:5173
      2. Register/authenticate
      3. Create match with "Dungeon" biome, GURPS ruleset
      4. Add a bot opponent
      5. Start combat
      6. Wait for: 3D scene with dungeon props visible (timeout: 20s)
      7. Assert: Walls visible as 3D objects
      8. Assert: Grid shows blocked cells
      9. Attempt to move player toward a wall cell
      10. Assert: Movement rejected or wall cell not in reachable hexes
      11. Wait for bot turn
      12. Assert: Bot moves to a valid (non-blocked) cell
      13. Screenshot: .sisyphus/evidence/task-10-dungeon-gurps.png
    Expected Result: Complete dungeon gameplay works
    Evidence: .sisyphus/evidence/task-10-dungeon-gurps.png

  Scenario: Full wilderness flow — PF2
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running
    Steps:
      1. Create match with "Wilderness" biome, PF2 ruleset
      2. Start combat with bot
      3. Wait for: 3D scene with trees/rocks visible
      4. Assert: Nature props visible in scene
      5. Assert: MiniMap shows terrain overlay
      6. Screenshot: .sisyphus/evidence/task-10-wilderness-pf2.png
    Expected Result: Wilderness environment renders and plays correctly
    Evidence: .sisyphus/evidence/task-10-wilderness-pf2.png

  Scenario: No scenario = classic empty grid
    Tool: Playwright (playwright skill)
    Steps:
      1. Create match with "No Scenario"
      2. Start combat
      3. Assert: No environment props, classic grid
      4. Assert: Movement unrestricted by terrain
      5. Screenshot: .sisyphus/evidence/task-10-no-scenario.png
    Expected Result: Backward compatible empty grid
    Evidence: .sisyphus/evidence/task-10-no-scenario.png

  Scenario: Lobby minimap preview
    Tool: Playwright (playwright skill)
    Steps:
      1. Navigate to lobby
      2. Select "Dungeon" biome
      3. Assert: 2D minimap preview shows dungeon layout
      4. Select "Wilderness" biome
      5. Assert: Preview updates to show wilderness layout
      6. Screenshot: .sisyphus/evidence/task-10-lobby-preview.png
    Expected Result: Minimap preview updates per biome selection
    Evidence: .sisyphus/evidence/task-10-lobby-preview.png
  ```

  **Commit**: YES
  - Message: `feat(map): complete scenario system integration with bot AI and lobby preview`
  - Files: `server/src/bot.ts`, `server/src/rulesets/gurps/bot.ts`, `server/src/rulesets/pf2/bot.ts`, `src/components/lobby/ScenarioSelector.tsx`
  - Pre-commit: `npx vitest run && npm run build && npm run lint`

---

## Commit Strategy

| After Task | Message | Key Files | Verification |
|------------|---------|-----------|--------------|
| 1 | `feat(map): add MapDefinition and TerrainCell shared types` | shared/map/* | `npx vitest run shared/map` |
| 2 | `feat(map): add procedural map generator for dungeon and wilderness` | shared/map/generator* | `npx vitest run shared/map` |
| 3 | `feat(map): add Quaternius GLB environment assets and registry` | public/models/**, src/data/environmentAssets.ts | `npx tsc --noEmit` |
| 4 | `feat(lobby): add scenario biome selector to match creation` | src/components/lobby/*, shared/types.ts | `npm run build` |
| 5 | `feat(map): add terrain helpers and terrain-aware movement` | shared/map/terrain*, shared/rulesets/* | `npx vitest run` |
| 6 | `feat(arena): add 3D environment props renderer with GLB instancing` | src/components/arena/* | `npm run build` |
| 7 | `feat(server): integrate map generation into match creation` | server/src/* | `npx vitest run` |
| 8 | `feat(ui): add terrain visualization to BattleGrid and MiniMap` | src/components/arena/BattleGrid*, src/components/game/MiniMap* | `npm run build` |
| 9 | `feat(combat): apply cover defense bonus from terrain` | server/src/handlers/* | `npx vitest run` |
| 10 | `feat(map): complete scenario system with bot AI and lobby preview` | server/src/bot*, src/components/lobby/* | `npx vitest run && npm run build && npm run lint` |

---

## Success Criteria

### Verification Commands
```bash
npx vitest run                    # Expected: all tests pass (existing + new)
npm run build                     # Expected: production build succeeds
npm run lint                      # Expected: no lint errors
```

### Final Checklist
- [ ] All "Must Have" features present and working
- [ ] All "Must NOT Have" items absent (no LoS, no multi-level, no editor)
- [ ] Both biomes generate valid maps (dungeon + wilderness)
- [ ] Both grid types work (hex GURPS + square PF2)
- [ ] Backward compatible — match without biome = empty grid
- [ ] Bot AI respects terrain
- [ ] 3D props render without performance issues
- [ ] All existing tests still pass (zero regressions)
