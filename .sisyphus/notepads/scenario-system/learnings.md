# Learnings — Scenario System

## [2026-02-07T22:32] Initial Analysis
- Baseline: 37 test files, 823 tests all passing
- Pre-existing build error: `@react-three/postprocessing` missing — installed to fix
- MatchState at shared/types.ts:65-86 — needs `mapDefinition?: MapDefinition`
- GridCoord uses `q, r` pattern at shared/grid/types.ts:3-6
- GridSystem interface at shared/grid/types.ts:13-25 with coordToWorld()
- ClientToServerMessage create_match at shared/types.ts:108
- MatchSummary at shared/types.ts:88-103

## [2026-02-08] Task 10 — Bot AI Terrain Awareness
- `computeGridMoveToward` in `server/src/helpers.ts` now accepts optional `MapDefinition` as last param
- Filters blocked neighbors via `isBlocked()` and accounts for difficult terrain cost via `getMovementCost()`
- Both GURPS bot (`server/src/bot.ts`) and PF2 bot (`server/src/rulesets/pf2/bot.ts`) pass `match.mapDefinition`
- `executeBotStride` in PF2 bot validates destination is not blocked before moving
- All terrain helpers return safe defaults when `mapDefinition` is undefined (backward compatible)

## [2026-02-08] Plan Complete — Final Summary
- All 10 tasks completed across 10 commits on `main`
- 40 test files, 873 tests all passing
- Build succeeds, no new lint issues introduced
- Pre-existing lint issue: EnvironmentProps.tsx has 5 react-hooks/refs errors (ref access during render in useMemo for InstancedMesh)
- Subagent delegation system was non-functional throughout — all work done directly by orchestrator
