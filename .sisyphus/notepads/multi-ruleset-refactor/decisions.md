# Decisions

## 2026-01-25T19:20:10Z Sequencing adjustment (baseline not green)
- Baseline: `npm run build` and `npm run lint` currently fail; only vitest is green.
- Decision: prioritize making `npm run build` green early by pulling forward type-guard/type-safety tasks (plan Phase 4 items) before adding more refactor surface.
- Rationale: without a green build, later refactors create unbounded compile noise and reduce confidence.
