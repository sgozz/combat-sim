# PF2 Complete Implementation

## TL;DR

> **Quick Summary**: Complete Pathfinder 2e implementation with full spell system, bot AI with simple heuristics, and TDD approach. Starts with critical UI wire-up fix, then implements core actions, conditions, reactions, and spells.
> 
> **Deliverables**:
> - Working PF2 UI panels (status, actions, mobile)
> - 6 core actions (Strike, Stride, Step, Stand, Raise Shield, End Turn) - all with full client→server wiring
> - 2 priority conditions (prone, flat_footed) with combat modifiers
> - Reaction system (Attack of Opportunity)
> - Spell casting system (cantrips, slots, focus spells)
> - Bot AI with simple heuristics
> 
> **Estimated Effort**: Large (3-4 weeks)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

---

## Context

### Original Request
Complete the PF2 implementation with full spell system, intelligent bot AI, and TDD approach.

### Interview Summary
**Key Discussions**:
- **Scope**: PF2 Completo - fedele alle regole PF2e
- **Bot AI**: Intelligente con tattica, conditions, shield, positioning
- **Test Strategy**: TDD - test prima, poi implementazione
- **Spells**: Sistema completo (slot, focus, spell attack/DC)
- **Character Creation**: Pathbuilder import only (già implementato)

**Research Findings**:
- PF2 panels ESISTONO (`PF2GameActionPanel`, `PF2GameStatusPanel`) ma GameScreen.tsx li ignora
- GameScreen.tsx hardcodato a GURPS (linee 149, 256)
- Rules engine ha buona base (49 test passanti)
- MAP calcolato correttamente in rules, ma potrebbe non essere applicato negli handlers
- Pathbuilder import completo e funzionante

### Metis Review
**Identified Gaps** (addressed):
- **GameScreen.tsx hardcoding**: Phase 0 - fix immediato
- **Scope creep su azioni**: Limitato a 6 azioni core
- **Scope creep su conditions**: Limitato a 5 conditions prioritarie
- **Spell effects**: Esclusi - solo meccaniche di casting

---

## Work Objectives

### Core Objective
Implementare PF2e completo con combat funzionante, spell system, e bot AI con euristiche semplici.

### Concrete Deliverables
- `src/components/game/GameScreen.tsx` - condizionale per PF2 panels
- `server/src/handlers/pf2/stride.ts` - Stride action handler
- `server/src/handlers/pf2/actions.ts` - Stand, Raise Shield handlers
- `shared/rulesets/pf2/conditions.ts` - Condition effect system
- `shared/rulesets/pf2/reactions.ts` - Reaction trigger system
- `shared/rulesets/pf2/spells.ts` - Spell casting system
- `server/src/rulesets/pf2/bot.ts` - PF2 bot AI with simple heuristics
- Test files per ogni modulo

### Definition of Done
- [ ] `npm run build` passes
- [ ] `npx vitest run` - all tests pass
- [ ] PF2 match loads with correct UI panels
- [ ] All 6 core actions work in browser
- [ ] Bot can play a complete match autonomously
- [ ] Spells can be cast from Pathbuilder-imported character

### Must Have
- GameScreen.tsx uses PF2 panels for PF2 matches
- MAP correctly applied to attacks
- Stride moves up to Speed/5 squares with movement overlay
- Step moves exactly 1 square (does NOT trigger AoO)
- Raise Shield grants +2 AC
- At least 1 cantrip castable
- Bot uses 3 actions per turn

### Must NOT Have (Guardrails)
- NO spell effects implementation (only casting mechanics)
- NO more than 6 actions in Phase 2
- NO skill actions (Demoralize, Trip, etc.)
- NO modifications to GURPS code
- NO new conditions beyond 5 priority ones
- NO "intelligent" bot - simple heuristics only
- NO metamagic or heightening

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Vitest)
- **User wants tests**: TDD
- **Framework**: Vitest with happy-dom

### TDD Workflow
Each TODO follows RED-GREEN-REFACTOR:
1. **RED**: Write failing test first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping green

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 0 (BLOCKER - Must Complete First):
└── Task 0: Fix GameScreen.tsx PF2 panel wire-up

Wave 1 (After Wave 0):
├── Task 1: Fix test fixtures (add rulesetId)
├── Task 2: Fix MAP tracking in attack handler
└── Task 3: Implement Stride action

Wave 2 (After Wave 1):
├── Task 4: Implement Stand action
├── Task 5: Implement Raise Shield action
└── Task 6: Implement condition effects (prone, flat_footed)

Wave 3 (After Wave 2):
├── Task 7: Implement Attack of Opportunity reaction
└── Task 8: Implement spell casting system

Wave 4 (After Wave 3):
└── Task 9: Implement PF2 bot AI

Wave 5 (After Wave 4):
├── Task 10: Mobile UI (PF2ActionBar wire-up)
└── Task 11: Polish and edge cases

Critical Path: 0 → 1,2,3 → 4,5,6 → 7,8 → 9 → 10,11
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 0 | None | ALL | None (BLOCKER) |
| 1 | 0 | 2,3,4,5,6 | 2, 3 |
| 2 | 0 | 9 | 1, 3 |
| 3 | 0 | 9 | 1, 2 |
| 4 | 1 | 6 | 5 |
| 5 | 1 | 7 | 4 |
| 6 | 4 | 7 | 5 |
| 7 | 5, 6 | 9 | 8 |
| 8 | 1 | 9 | 7 |
| 9 | 2, 3, 7, 8 | 10, 11 | None |
| 10 | 9 | None | 11 |
| 11 | 9 | None | 10 |

---

## TODOs

- [ ] 0. Fix GameScreen.tsx PF2 Panel Wire-up (BLOCKER)

  **What to do**:
  - Find all occurrences of `rulesetId === 'gurps'` in GameScreen.tsx
  - Change to support both GURPS and PF2 panels
  - Use pattern: `matchState?.rulesetId === 'gurps' ? <GurpsPanel/> : matchState?.rulesetId === 'pf2' ? <PF2Panel/> : <Loading/>`
  - Import PF2 panels at top of file

  **Must NOT do**:
  - Don't modify GURPS panel logic
  - Don't add new props to panels
  - Don't change panel component internals

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 0 (solo)
  - **Blocks**: Tasks 1-11 (ALL)
  - **Blocked By**: None

  **References**:
  - `src/components/game/GameScreen.tsx:149-170` - GameStatusPanel GURPS-only gate
  - `src/components/game/GameScreen.tsx:256-280` - GameActionPanel GURPS-only gate
  - `src/components/game/GameScreen.tsx:434-447` - ActionBar (mobile) GURPS-only gate
  - Note: TurnStepper already renders for all rulesets (no gate to fix)
  - `src/components/rulesets/pf2/PF2GameActionPanel.tsx` - PF2 action panel to import
  - `src/components/rulesets/pf2/PF2GameStatusPanel.tsx` - PF2 status panel to import

  **Acceptance Criteria**:
  - [ ] Test: Create PF2 match → panels show correctly (not "Loading...")
  - [ ] Verify in browser: PF2 match shows HP bar, action pips, Strike button
  - [ ] `npm run build` → SUCCESS
  - [ ] GURPS matches still work (regression test)

  **Commit**: YES
  - Message: `fix(pf2): wire up PF2 UI panels in GameScreen`
  - Files: `src/components/game/GameScreen.tsx`

---

- [ ] 1. Audit and Fix Any Test Fixture Type Errors

  **What to do**:
  - Run `npx tsc --noEmit` on shared/ to identify any remaining type errors
  - Run `npx vitest run` to confirm all 356+ tests pass
  - Fix any `CombatantState | undefined` issues by adding proper null checks
  - Verify `shared/rulesets/pf2/rules.test.ts` fixtures already have `rulesetId: 'pf2'`

  **Must NOT do**:
  - Don't change test logic, only fixture data and null checks
  - Don't add new tests yet

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2, 3)
  - **Blocks**: Tasks 4, 5, 6
  - **Blocked By**: Task 0

  **References**:
  - `shared/rulesets/base/types.ts:10` - rulesetId field definition
  - `shared/rulesets/pf2/rules.test.ts` - Already has rulesetId in fixtures (verified)
  - `shared/rules.test.ts` - GURPS-focused tests, check for any undefined access issues

  **Acceptance Criteria**:
  - [ ] `npx vitest run` → 356+ tests pass, 0 failures
  - [ ] `npx tsc --noEmit` on shared/ → 0 errors
  - [ ] `npm run build` → SUCCESS

  **Commit**: YES
  - Message: `fix(tests): resolve type errors in test fixtures`
  - Files: `shared/rules.test.ts`

---

- [ ] 2. Fix MAP Tracking in Attack Handler

  **What to do**:
  - Fix `handlePF2AttackAction` for correct MAP handling
  - Remove hardcoded `attacksThisTurn = 0`
  - Apply `combatant.mapPenalty` to attack roll
  - Increment mapPenalty AFTER attack resolves

  **MAP Semantics** (MATCHING EXISTING CODE):
  - Existing `getMultipleAttackPenalty()` returns NEGATIVE values: 0, -5, -10 (or -4, -8 for agile)
  - Existing tests (`shared/rulesets/pf2/rules.test.ts:306-316`) expect `applyActionCost(..., isAttack=true)` to set `mapPenalty = -5`
  - **Use this convention**: `mapPenalty` is the NEGATIVE penalty for the CURRENT attack
  
  **Semantics**:
  - At turn start: `mapPenalty = 0` (no penalty)
  - After 1st attack: `mapPenalty = -5` (or -4 for agile)
  - After 2nd attack: `mapPenalty = -10` (or -8 for agile)
  - Apply: `attackBonus = calculateAttackBonus(...) + mapPenalty` (adding negative = subtracting)

  **Attack handler changes**:
  ```typescript
  // In handlePF2AttackAction:
  const mapPenalty = combatant.mapPenalty || 0;  // e.g. 0, -5, -10
  const attackBonus = calculateAttackBonus(character, weapon) + mapPenalty;
  // ... resolve attack ...
  // After resolution - apply penalty for NEXT attack, capped at -10/-8:
  const isAgile = weapon.traits?.includes('agile');
  const minPenalty = isAgile ? -8 : -10;  // Cap at 3rd attack penalty
  const penaltyStep = isAgile ? -4 : -5;
  combatant.mapPenalty = Math.max(minPenalty, (combatant.mapPenalty || 0) + penaltyStep);
  // 0 → -5 → -10 (capped), or 0 → -4 → -8 (capped for agile)
  ```

  **UI fix** (`PF2GameActionPanel.tsx`, `PF2GameStatusPanel.tsx`):
  - Read `combatant.mapPenalty` directly instead of computing from `attacksThisTurn`
  - Display as: 0 → green, -5 → yellow, -10 → red

  **Must NOT do**:
  - Don't change damage calculation
  - Don't add new attack types

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 1, 3)
  - **Blocks**: Task 9 (Bot)
  - **Blocked By**: Task 0

  **References**:
  - `server/src/handlers/pf2/attack.ts` - Attack handler (currently hardcodes attackNumber=0)
  - `shared/rulesets/pf2/rules.ts:getMultipleAttackPenalty` - Utility function
  - `shared/rulesets/pf2/types.ts:PF2CombatantState.mapPenalty` - State field
  - `shared/rulesets/pf2/rules.ts:advanceTurn` - Where mapPenalty resets to 0
  - `src/components/rulesets/pf2/PF2GameActionPanel.tsx:52` - UI fix needed

  **Acceptance Criteria**:
  - [ ] Test: First strike applies 0 penalty (mapPenalty starts at 0)
  - [ ] Test: After first strike, mapPenalty = -5 (or -4 for agile)
  - [ ] Test: Second strike applies -5 penalty (or -4)
  - [ ] Test: After second strike, mapPenalty = -10 (or -8)
  - [ ] Test: Third+ strike capped at -10 (or -8) - no further penalty
  - [ ] Test: MAP resets to 0 on advanceTurn
  - [ ] UI shows correct MAP badge from combatant.mapPenalty (display absolute value)
  - [ ] `npx vitest run -t "MAP"` → tests pass

  **Commit**: YES
  - Message: `fix(pf2): correctly track and apply MAP to attacks`
  - Files: `server/src/handlers/pf2/attack.ts`, `src/components/rulesets/pf2/PF2GameActionPanel.tsx`, `src/components/rulesets/pf2/PF2GameStatusPanel.tsx`

---

- [ ] 3. Implement Stride and Step Actions

  **What to do**:
  - Create `server/src/handlers/pf2/stride.ts` handler for Stride
  - Extend existing `server/src/handlers/pf2/actions.ts:handlePF2Step` for Step
  - Cost: 1 action each (use `applyActionCost`)
  - Update `server/src/handlers/pf2/router.ts` to dispatch both `pf2_stride` and `pf2_step`

  **Stride vs Step**:
  - **Stride**: Move up to Speed/5 squares (e.g., 25ft = 5 squares). Triggers AoO.
  - **Step**: Move exactly 1 square. Does NOT trigger AoO.

  **API Signature** (VERIFIED from `shared/rulesets/pf2/rules.ts`):
  ```typescript
  getReachableSquares(
    startPos: SquarePosition,      // { q: number, r: number }
    speed: number,                 // In FEET (e.g. 25)
    occupiedSquares?: SquarePosition[]
  ): Map<string, { position: SquarePosition; cost: number }>
  // Returns Map with key = "q,r" string, value = position + movement cost
  ```

  **Coordinate Conversion** (CRITICAL):
  - Combatant stores `position: {x, y, z}` (grid coords)
  - `getReachableSquares` uses `SquarePosition {q, r}` (axial coords)
  - Converters are in `shared/rulesets/serverAdapter.ts`:
    - `pf2GridToHex({x, z})` → returns `{q, r}`
    - `pf2HexToGrid({q, r})` → returns `{x, y, z}`
  - Also exported from `shared/rulesets/pf2/rules.ts` as `gridToHex` / `hexToGrid`

  **Movement Overlay Flow** (Server-Driven):
  
  Movement overlay uses the existing `matchState.reachableHexes` mechanism:
  1. Client clicks Stride/Step button → calls `onAction('pf2_request_move', { mode: 'stride' | 'step' })`
  2. Server receives request → computes reachable squares via `getReachableSquares()`
  3. Server broadcasts `match_state` with `reachableHexes: [{q, r}, ...]` populated
  4. Client renders overlay from `matchState.reachableHexes` (already implemented in `src/components/arena/ArenaScene.tsx:180-195`)
  5. Client clicks destination → calls `onAction('pf2_stride', { to: {q, r} })` or `onAction('pf2_step', { to: {q, r} })`
  6. Server validates destination is in reachable set, moves combatant, clears `reachableHexes`
  
  **Existing reachableHexes rendering** (`src/components/arena/ArenaScene.tsx:180-195`):
  - Already renders green overlay for hexes in `matchState.reachableHexes`
  - No changes needed to rendering - just populate from server

  **End-to-End Wiring - Stride**:
  
  **Current client behavior** (`src/components/rulesets/pf2/PF2GameActionPanel.tsx:99-107`):
  - "Stride" button triggers `onAction('select_maneuver', { maneuver: 'move' })`
  - This doesn't match server's expected `pf2_stride` action
  
  **Required client changes** (`src/components/rulesets/pf2/PF2GameActionPanel.tsx`):
  1. Add state: `const [pendingMove, setPendingMove] = useState<'stride' | 'step' | null>(null)`
  2. Stride button: `onClick={() => { setPendingMove('stride'); onAction('pf2_request_move', { mode: 'stride' }) }}`
  3. Step button: `onClick={() => { setPendingMove('step'); onAction('pf2_request_move', { mode: 'step' }) }}`
  4. Grid click handler (via `onHexClick` prop from parent): 
     `if (pendingMove && hex) { onAction(pendingMove === 'stride' ? 'pf2_stride' : 'pf2_step', { to: hex }); setPendingMove(null) }`
  
  **End-to-End Wiring - Step**:
  
  **Current handler** (`server/src/handlers/pf2/actions.ts:handlePF2Step`):
  - Already exists but returns stub error
  - Fix to: validate destination is exactly 1 square away, move combatant
  
  **Server expects**:
  - `payload.type === 'pf2_stride'` with `payload.to: { q: number, r: number }`
  - `payload.type === 'pf2_step'` with `payload.to: { q: number, r: number }`
  
  **Handler flow (Stride)**:
  1. Convert combatant.position to {q, r} using `gridToHex`
  2. Call `getReachableSquares(pos, character.derived.speed, occupied)`
  3. Check if `payload.to` key exists in returned Map
  4. If valid: Update `combatant.position = hexToGrid(payload.to)`
  5. Decrement `combatant.actionsRemaining`
  6. Clear `matchState.reachableHexes`
  7. Broadcast `match_state`
  
  **Handler flow (Step)**:
  1. Convert combatant.position to {q, r} using `gridToHex`
  2. Check destination is exactly distance 1 from current position
  3. Check destination is not occupied
  4. If valid: Update `combatant.position = hexToGrid(payload.to)`
  5. Decrement `combatant.actionsRemaining`
  6. Broadcast `match_state`

  **Must NOT do**:
  - Don't implement difficult terrain
  - Don't implement movement preview animation (just final position)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 1, 2)
  - **Blocks**: Task 9 (Bot)
  - **Blocked By**: Task 0

  **References**:
  - `server/src/handlers/pf2/router.ts:43-45` - Stub for `pf2_stride` (returns error)
  - `server/src/handlers/pf2/router.ts:46-48` - Stub for `pf2_step` (returns error)
  - `server/src/handlers/pf2/actions.ts:handlePF2Step` - Step handler stub to fix
  - `shared/rulesets/pf2/rules.ts:getReachableSquares` - Returns `Map<string, {position, cost}>`
  - `shared/rulesets/serverAdapter.ts:pf2GridToHex, pf2HexToGrid` - Coordinate converters
  - `shared/rulesets/pf2/rules.ts:gridToHex, hexToGrid` - Also exported here
  - `shared/rulesets/pf2/characterSheet.ts:PF2CharacterSheet.derived.speed` - Speed in feet
  - `src/components/rulesets/pf2/PF2GameActionPanel.tsx:99-107` - Current Stride button (needs change)
  - `src/components/arena/ArenaScene.tsx:180-195` - Existing reachableHexes overlay rendering
  - `shared/types.ts:MatchState.reachableHexes` - Server-side hex array for movement overlay

  **Acceptance Criteria**:
  - [ ] Test: Stride with speed=25 can reach 5 squares (25/5)
  - [ ] Test: Stride costs 1 action
  - [ ] Test: Stride blocked by occupied squares
  - [ ] Test: Stride fails if 0 actions remaining
  - [ ] Test: Step moves exactly 1 square
  - [ ] Test: Step costs 1 action
  - [ ] Test: Step fails if destination > 1 square away
  - [ ] Browser: Click Stride → overlay appears → click destination → character moves
  - [ ] Browser: Click Step → overlay appears (1 square only) → click destination → character moves
  - [ ] `npx vitest run -t "stride"` → tests pass
  - [ ] `npx vitest run -t "step"` → tests pass

  **Commit**: YES
  - Message: `feat(pf2): implement Stride and Step actions with movement overlay`
  - Files: `server/src/handlers/pf2/stride.ts`, `server/src/handlers/pf2/actions.ts`, `server/src/handlers/pf2/router.ts`, `src/components/rulesets/pf2/PF2GameActionPanel.tsx`

---

- [ ] 4. Implement Stand Action (and fix Drop Prone)

  **What to do**:
  - Fix `handlePF2Stand` to actually work
  - Remove prone condition from combatant.conditions
  - Cost: 1 action
  - Fail if not prone

  **Prerequisite fix** - Drop Prone currently doesn't add condition:
  - `handlePF2DropProne` (`actions.ts:32-64`) currently does NOT add prone to conditions
  - Must fix: Add `{ condition: 'prone' }` to `combatant.conditions` array
  - Condition model: `conditions: ConditionValue[]` where `ConditionValue = { condition: string; value?: number }`

  **Stand implementation**:
  - Find and remove `{ condition: 'prone' }` from `combatant.conditions`
  - Use: `combatant.conditions = combatant.conditions.filter(c => c.condition !== 'prone')`

  **Must NOT do**:
  - Don't implement Crawl (separate action)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References**:
  - `server/src/handlers/pf2/actions.ts:handlePF2Stand` - Current stub (returns error)
  - `server/src/handlers/pf2/actions.ts:handlePF2DropProne:32-64` - Needs fix to add condition
  - `shared/rulesets/pf2/types.ts:ConditionValue` - `{ condition: string; value?: number }`
  - `shared/rulesets/pf2/types.ts:PF2CombatantState.conditions` - Array of ConditionValue

  **Acceptance Criteria**:
  - [ ] Test: Drop Prone adds `{ condition: 'prone' }` to conditions
  - [ ] Test: Stand removes prone condition
  - [ ] Test: Stand costs 1 action
  - [ ] Test: Stand fails if not in conditions
  - [ ] Test: Stand fails if 0 actions
  - [ ] `npx vitest run -t "stand"` → tests pass

  **Commit**: YES
  - Message: `feat(pf2): implement Stand action and fix Drop Prone`
  - Files: `server/src/handlers/pf2/actions.ts`

---

- [ ] 5. Implement Raise Shield Action

  **What to do**:
  - Create handler `handlePF2RaiseShield` in `server/src/handlers/pf2/actions.ts`
  - Set `combatant.shieldRaised: true`
  - Cost: 1 action (use `applyActionCost`)
  - Verify character has a shield before allowing

  **Shield Detection** (CRITICAL - current model):
  - Pathbuilder exports `acTotal.shieldBonus` (see `shared/rulesets/pf2/pathbuilder.ts:PathbuilderExport`)
  - Current mapping: `mapArmor()` creates `PF2CharacterArmor` with `acBonus` field
  - **Shield detection rule**: If Pathbuilder export has `acTotal.shieldBonus > 0`, character has shield
  - Need to add to mapping: Store `shieldBonus` in character (e.g. `character.shieldBonus: number`)
  - Alternative: Add `hasShield: boolean` field during character creation
  - Check: `character.shieldBonus > 0` before allowing Raise Shield

  **AC Integration**:
  - Current: `server/src/handlers/pf2/attack.ts` reads `targetCharacter.derived.armorClass`
  - Fix: In attack handler, after getting base AC:
    ```typescript
    let effectiveAC = targetCharacter.derived.armorClass;
    if (targetCombatant.shieldRaised) effectiveAC += 2;
    ```
  - Reset: Add to `advanceTurn()` in rules.ts: `shieldRaised: false`

  **Must NOT do**:
  - Don't implement Shield Block reaction (Task 7 area)
  - Don't implement shield HP/hardness tracking

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 4)
  - **Blocks**: Task 7
  - **Blocked By**: Task 1

  **References**:
  - `shared/rulesets/pf2/types.ts:PF2CombatantState.shieldRaised` - Boolean field (exists)
  - `shared/rulesets/pf2/pathbuilder.ts:PathbuilderExport.acTotal.shieldBonus` - Shield source
  - `shared/rulesets/pf2/pathbuilderMapping.ts:mapArmor` - Where to add shieldBonus extraction
  - `server/src/handlers/pf2/attack.ts` - Where to apply +2 AC
  - `shared/rulesets/pf2/rules.ts:advanceTurn` - Where to reset shieldRaised
  - `server/src/handlers/pf2/router.ts` - Add case for `pf2_raise_shield`

  **Acceptance Criteria**:
  - [ ] Test: Raise Shield sets shieldRaised: true
  - [ ] Test: Raise Shield costs 1 action
  - [ ] Test: Attack against shielded target uses AC+2
  - [ ] Test: shieldRaised resets to false at turn start
  - [ ] Test: Fails if character.shieldBonus <= 0
  - [ ] `npx vitest run -t "shield"` → tests pass

  **Commit**: YES
  - Message: `feat(pf2): implement Raise Shield action with AC bonus`
  - Files: `server/src/handlers/pf2/actions.ts`, `server/src/handlers/pf2/attack.ts`, `shared/rulesets/pf2/pathbuilderMapping.ts`, `server/src/handlers/pf2/router.ts`

---

- [ ] 6. Implement Condition Effects (Prone, Flat-Footed)

  **What to do**:
  - Create `shared/rulesets/pf2/conditions.ts` with condition effect helpers
  - Prone: -2 attack, +2 AC vs ranged, -2 AC vs melee
  - Flat-footed: -2 AC (circumstance penalty)
  - Create helper: `getConditionACModifier(combatant, attackType: 'melee' | 'ranged')`
  - Create helper: `getConditionAttackModifier(combatant)`
  - Apply in attack handler and AC calculations

  **Data Model Clarification** (CRITICAL):
  - **Authoritative field**: `PF2CombatantState.conditions: ConditionValue[]`
  - **ConditionValue**: `{ condition: string; value?: number }` (e.g. `{condition: 'prone'}`, `{condition: 'slowed', value: 1}`)
  - **NOT**: `combatant.statusEffects` (that's GURPS-style)
  - Current UI (`PF2GameStatusPanel:81-87`) renders `statusEffects` - must change to render `conditions`
  - Display: Show `condition` name; if `value` exists, show "Condition X" (e.g. "Slowed 1")

  **Must NOT do**:
  - Don't implement all 26 conditions
  - Only: prone, flat_footed in this task
  - Stunned/slowed/quickened require separate implementation (add to this task if time permits, otherwise future work)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 4, 5)
  - **Blocks**: Task 7
  - **Blocked By**: Task 4

  **References**:
  - `shared/rulesets/pf2/types.ts:PF2Condition` - Condition enum (already has prone, flat_footed)
  - `shared/rulesets/pf2/types.ts:PF2CombatantState.conditions` - Array of conditions
  - `shared/rulesets/pf2/types.ts:ConditionValue` - Type definition `{ condition: string; value?: number }`
  - `server/src/handlers/pf2/attack.ts` - Apply condition modifiers here
  - `src/components/rulesets/pf2/PF2GameStatusPanel.tsx:81-87` - UI display currently renders `statusEffects` - must change to render `conditions`

  **Acceptance Criteria**:
  - [ ] Test: Prone gives -2 attack penalty
  - [ ] Test: Prone gives +2 AC vs ranged attacks
  - [ ] Test: Prone gives -2 AC vs melee attacks
  - [ ] Test: Flat-footed gives -2 AC
  - [ ] Test: Multiple conditions stack correctly
  - [ ] UI shows condition badges from `combatant.conditions`
  - [ ] `npx vitest run -t "condition"` → tests pass

  **Commit**: YES
  - Message: `feat(pf2): implement condition effects (prone, flat_footed)`
  - Files: `shared/rulesets/pf2/conditions.ts`, `server/src/handlers/pf2/attack.ts`, `src/components/rulesets/pf2/PF2GameStatusPanel.tsx`

---

- [ ] 7. Implement Attack of Opportunity Reaction

  **What to do**:
  - Create reaction trigger system for AoO
  - AoO triggers when: enemy uses Stride/Interact (move/manipulate) action in reach (1 square)
  - Check `reactionAvailable` before offering AoO
  - Consume reaction on use

  **Reaction Flow** (DECIDED: Automatic for bots, prompted for players):
  
  1. Stride handler detects enemy with AoO capability in reach (distance === 1)
  2. Check reactor's `reactionAvailable === true`
  3. **If reactor is bot**: Auto-execute AoO strike, apply damage, continue Stride
  4. **If reactor is player**: 
     - Pause action, set `matchState.pendingReaction`
     - Send `reaction_prompt` message to reactor's client
     - Wait for `pf2_reaction_choice` response
  5. Player confirms → execute AoO strike → resume Stride
  6. Player declines → reaction is NOT consumed, Stride continues
  7. After AoO (if taken): set `reactor.reactionAvailable = false`
  
  **Types needed** (use existing WebSocket envelope):
  
  **Match state** (add to `shared/types.ts:MatchState`):
  ```typescript
  pendingReaction?: {
    reactorId: string;
    triggerId: string;
    triggerAction: 'stride' | 'interact';
    originalPayload: CombatActionPayload;
  }
  ```
  
  **Server → Client** (add to `ServerToClientMessage` union in `shared/types.ts`):
  ```typescript
  | { type: 'reaction_prompt'; reactorId: string; triggerAction: string }
  ```
  
  **Client → Server** (use existing `{ type: "action" }` envelope):
  ```typescript
  // Client sends via existing action wrapper:
  { type: "action", matchId, action: "pf2_reaction_choice", payload: { choice: 'aoo' | 'decline' } }
  ```
  
  **Add to PF2CombatActionPayload** (`shared/rulesets/pf2/types.ts`):
  ```typescript
  | { type: 'pf2_reaction_choice'; choice: 'aoo' | 'decline' }
  ```
  
  **Server routing** (`server/src/handlers/pf2/router.ts`):
  ```typescript
  case 'pf2_reaction_choice':
    return handlePF2ReactionChoice(match, player, payload);
  ```
  
  **Handler for reaction choice**:
  1. Get `pendingReaction` from matchState
  2. If `choice === 'aoo'`: Execute strike via `handlePF2AttackAction`, mark reaction used
  3. Clear `pendingReaction`
  4. Resume original action using `originalPayload`

  **Must NOT do**:
  - Don't implement Shield Block (future reaction)
  - Don't implement other reactions

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 8)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 5, 6

  **References**:
  - `shared/rulesets/pf2/types.ts:PF2CombatantState.reactionAvailable` - Boolean field
  - `shared/rulesets/gurps/types.ts:PendingDefense` - Similar pause-and-prompt pattern
  - `server/src/handlers/pf2/stride.ts` - Where to check for AoO triggers
  - `server/src/handlers/pf2/router.ts` - Add reaction handling

  **Acceptance Criteria**:
  - [ ] Test: Stride in enemy reach triggers AoO prompt (for player)
  - [ ] Test: Bot with AoO auto-attacks on trigger
  - [ ] Test: Step does NOT trigger AoO
  - [ ] Test: AoO consumes reactionAvailable
  - [ ] Test: Declining AoO still allows Stride to complete
  - [ ] Test: Reaction resets at turn start
  - [ ] `npx vitest run -t "reaction"` → tests pass

  **Commit**: YES
  - Message: `feat(pf2): implement Attack of Opportunity reaction`
  - Files: `shared/rulesets/pf2/reactions.ts`, `server/src/handlers/pf2/stride.ts`, `server/src/handlers/pf2/router.ts`, `shared/types.ts`

---

- [ ] 8. Implement Spell Casting System

  **What to do**:
  - Create spell casting mechanics (NO effects)
  - Cantrips: unlimited casts, use spell attack bonus
  - Spell slots: track usage per level
  - Focus spells: use focus points
  - Spell attack rolls and spell DCs

  **Pathbuilder Data Source** (CRITICAL - where slots come from):
  
  **Current state** (`shared/rulesets/pf2/pathbuilderMapping.ts:163-193, 209-238`):
  - Current mapping uses `build.focus` for focus spells only
  - `spellCasters` array is typed as `unknown[]` and IGNORED
  - Test fixture (`src/services/pathbuilderImporter.test.ts:156`) has `spellCasters: []`
  
  **Pathbuilder JSON structure** (from actual exports):
  ```typescript
  spellCasters: [{
    name: string;              // e.g. "Wizard Spellcasting"
    magicTradition: string;    // "arcane", "divine", etc.
    spellcastingType: string;  // "prepared", "spontaneous"
    proficiency: number;       // 2=trained, 4=expert, etc.
    perDay: number[];          // Slots per level [cantrips, 1st, 2nd, ...]
    spells: { spellLevel: number; list: string[] }[];
    focusPoints: number;
  }]
  ```
  
  **Need to create test fixture** with non-empty spellCasters:
  - Add to `src/services/pathbuilderImporter.test.ts` or create `shared/rulesets/pf2/spellcasting.test.ts`
  - Include wizard/cleric example with actual perDay and spells
  
  **Mapping changes** (`shared/rulesets/pf2/pathbuilderMapping.ts`):
  1. Type `spellCasters` properly (create `PathbuilderSpellCaster` interface)
  2. Create `mapSpellcasters()` function
  3. Extract `perDay` → `SpellSlot[]` 
  4. Store in `PF2CharacterSheet.spellcasters: SpellCaster[]`

  **Data Model** (add to `types.ts`):
  ```typescript
  SpellSlot = { level: number; total: number; used: number }
  FocusPool = { max: number; current: number }
  SpellCaster = {
    name: string;
    tradition: string;
    proficiency: number;
    slots: SpellSlot[];
    focusPool: FocusPool;
    knownSpells: { level: number; spells: string[] }[];
  }
  PF2CharacterSheet.spellcasters: SpellCaster[]  // Replaces current spells field
  ```
  
  **Runtime state** (add to `PF2CombatantState`):
  ```typescript
  spellSlotUsage: { casterIndex: number; level: number; used: number }[]
  focusPointsUsed: number
  ```

  **Functions to create** in `rules.ts`:
  ```typescript
  calculateSpellAttack(character, casterIndex): number
    // = ability mod + proficiency + level
  calculateSpellDC(character, casterIndex): number
    // = 10 + ability mod + proficiency + level
  ```

  **UI/Action Flow** for spell casting:
  
  **UI** (`PF2GameActionPanel`):
  1. Add "Cast Spell" button (or spell list section)
  2. On click: Show spell list from `character.spellcasters[].knownSpells`
  3. Group by level, show cantrips first
  4. Show available slots per level: "1st (2/3)"
  5. Grayed out if slot exhausted
  
  **Client → Server**:
  ```typescript
  { type: 'pf2_cast_spell', spellName: string, level: number, casterIndex: number }
  ```
  
  **Server handler** (`spell.ts`):
  1. Validate caster exists at index
  2. Validate spell known by caster
  3. If level > 0: Check slot available, decrement `combatant.spellSlotUsage`
  4. If focus spell: Check focus points, increment `combatant.focusPointsUsed`
  5. Roll spell attack if needed (vs target AC)
  6. Decrement `combatant.actionsRemaining` by spell's action cost (usually 2)
  7. Broadcast match state
  
  **NO effects**: Just log "X casts Y", don't apply damage/conditions

  **Must NOT do**:
  - Don't implement spell effects (damage, conditions)
  - Don't implement metamagic or heightening
  - Don't implement Refocus action

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 7)
  - **Blocks**: Task 9
  - **Blocked By**: Task 1

  **References**:
  - `shared/rulesets/pf2/pathbuilder.ts:PathbuilderExport` - Raw export structure (has `spellCasters: unknown[]`)
  - `shared/rulesets/pf2/pathbuilderMapping.ts:163-193` - Current focus spell mapping, extend for full spellcasters
  - `shared/rulesets/pf2/types.ts` - Add SpellSlot, FocusPool, SpellCaster types here
  - `shared/rulesets/pf2/rules.ts` - Add calculateSpellAttack(), calculateSpellDC() functions
  - `server/src/handlers/pf2/spell.ts` - New file for spell casting handler
  - `server/src/handlers/pf2/router.ts` - Add case for `pf2_cast_spell`
  - `src/components/rulesets/pf2/PF2GameActionPanel.tsx` - Add spell list UI section
  - `src/services/pathbuilderImporter.test.ts:156` - Existing test fixture with `spellCasters: []`

  **Acceptance Criteria**:
  - [ ] Types: SpellSlot, FocusPool, SpellCaster defined
  - [ ] Mapping: Pathbuilder spellCasters properly extracted
  - [ ] Test: Cantrip castable unlimited times
  - [ ] Test: Leveled spell consumes slot.used++
  - [ ] Test: Can't cast if slots[level].used >= slots[level].total
  - [ ] Test: Focus spell uses focusPointsUsed++
  - [ ] Test: calculateSpellAttack/DC return correct values
  - [ ] UI shows spell list from character.spellcasters
  - [ ] `npx vitest run -t "spell"` → tests pass

  **Commit**: YES
  - Message: `feat(pf2): implement spell casting system`
  - Files: `shared/rulesets/pf2/types.ts`, `shared/rulesets/pf2/rules.ts`, `shared/rulesets/pf2/pathbuilderMapping.ts`, `server/src/handlers/pf2/spell.ts`

---

- [ ] 9. Fix and Enhance PF2 Bot AI

  **Current state** (`server/src/rulesets/pf2/bot.ts` ALREADY EXISTS):
  - Has basic bot logic but with bugs:
  - Line 45-105: Uses `attacksThisTurn = 0` (hardcoded)
  - Uses inconsistent state: `attacksRemaining` instead of `actionsRemaining`
  - Writes nested `pf2` object instead of top-level fields

  **What to fix**:
  - Use correct state field: `combatant.actionsRemaining` (not `attacksRemaining`)
  - Track MAP via `combatant.mapPenalty` (semantics: penalty for NEXT attack)
  - Remove nested `pf2` object writes
  - Implement multi-action loop

  **MAP Semantics** (MUST BE CONSISTENT with Task 2):
  - `mapPenalty` = NEGATIVE penalty for the CURRENT attack (0, -5, -10 or 0, -4, -8 for agile)
  - After attack: decrement `mapPenalty` by 5 (or 4 for agile): `mapPenalty += -5`
  - At turn start: reset `mapPenalty = 0`
  - Bot logic: stop attacking when `mapPenalty <= -10` (already at max penalty)

  **Multi-Action Loop** (in `server/src/bot.ts`):
  ```typescript
  // Add PF2-specific handler
  if (match.rulesetId === 'pf2') {
    while (botCombatant.actionsRemaining > 0) {
      const action = decidePF2BotAction(match, botCombatant, character);
      if (!action) break;
      
      // Execute action (calls existing handler)
      await executeAction(match, action);
      
      // Refresh combatant after state change
      botCombatant = match.combatants.find(c => c.characterId === character.id);
    }
    advanceTurn(match);
    return;
  }
  // Else: GURPS single-action behavior
  ```

  **Decision logic**:
  1. Find nearest enemy by distance
  2. If distance === 1 AND mapPenalty < 10: return Strike
  3. If distance > 1: return Stride toward enemy
  4. Else: return null (end turn)

  **Must NOT do**:
  - Don't implement complex tactics
  - Don't use spell casting
  - Don't implement target prioritization

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (solo)
  - **Blocks**: Tasks 10, 11
  - **Blocked By**: Tasks 2, 3, 7, 8

  **References**:
  - `server/src/rulesets/pf2/bot.ts:45-105` - Current buggy implementation to fix
  - `server/src/bot.ts` - Add PF2 multi-action dispatcher
  - `shared/rulesets/pf2/types.ts:PF2CombatantState` - Correct fields: actionsRemaining, mapPenalty

  **Acceptance Criteria**:
  - [ ] Bot uses `actionsRemaining` not `attacksRemaining`
  - [ ] Bot uses `mapPenalty` correctly (negative values: 0, -5, -10)
  - [ ] Test: Bot uses all 3 actions per turn
  - [ ] Test: Bot strikes if adjacent (up to 2 strikes)
  - [ ] Test: Bot strides if not adjacent
  - [ ] Test: Bot stops striking at mapPenalty <= -10 (max penalty reached)
  - [ ] Integration: Bot vs Bot match completes
  - [ ] `npx vitest run -t "bot"` → tests pass

  **Commit**: YES
  - Message: `fix(pf2): enhance bot AI with correct state handling`
  - Files: `server/src/rulesets/pf2/bot.ts`, `server/src/bot.ts`

---

- [ ] 10. Wire Up Mobile UI (PF2ActionBar)

  **What to do**:
  - Update GameScreen.tsx mobile section for PF2
  - Import and use PF2ActionBar component
  - Ensure same actions available as desktop

  **Must NOT do**:
  - Don't redesign mobile UI
  - Don't add new mobile-only features

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with 11)
  - **Blocks**: None
  - **Blocked By**: Task 9

  **References**:
  - `src/components/game/GameScreen.tsx:434-447` - Mobile ActionBar section
  - `src/components/rulesets/pf2/PF2ActionBar.tsx` - PF2 mobile component
  - `src/components/rulesets/gurps/GurpsActionBar.tsx` - GURPS mobile component (pattern)

  **Acceptance Criteria**:
  - [ ] Mobile view shows PF2ActionBar for PF2 matches
  - [ ] All actions from desktop available on mobile
  - [ ] Touch-friendly button sizes
  - [ ] Visual test on mobile viewport (375px width)

  **Commit**: YES
  - Message: `feat(pf2): wire up mobile PF2ActionBar`
  - Files: `src/components/game/GameScreen.tsx`

---

- [ ] 11. Polish and Edge Cases

  **What to do**:
  - Fix any remaining TypeScript errors
  - Handle edge cases: 0 HP, dying state, victory condition
  - Ensure all tests pass
  - Manual QA of full match flow

  **Must NOT do**:
  - Don't add new features
  - Don't implement dying/wounded system (future)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with 10)
  - **Blocks**: None
  - **Blocked By**: Task 9

  **References**:
  - `shared/rulesets/pf2/rules.ts` - Core rules logic
  - `shared/rulesets/pf2/types.ts` - Type definitions
  - `shared/rulesets/pf2/rules.test.ts` - Test coverage
  - `server/src/handlers/pf2/router.ts` - Server routing
  - `server/src/handlers/pf2/attack.ts` - Attack handling
  - `src/components/rulesets/pf2/PF2GameActionPanel.tsx` - Desktop UI
  - `src/components/rulesets/pf2/PF2ActionBar.tsx` - Mobile UI
  - `src/components/rulesets/pf2/PF2GameStatusPanel.tsx` - Status display

  **Acceptance Criteria**:
  - [ ] `npm run build` → SUCCESS, 0 warnings
  - [ ] `npx vitest run` → ALL tests pass
  - [ ] `cd server && npx tsc --noEmit` → 0 errors
  - [ ] Manual test: Create PF2 match → play full game → victory
  - [ ] Manual test: Bot vs Bot match completes

  **Commit**: YES
  - Message: `chore(pf2): polish and fix edge cases`
  - Files: Various

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 0 | `fix(pf2): wire up PF2 UI panels in GameScreen` | GameScreen.tsx | Browser test |
| 1 | `fix(tests): add rulesetId to PF2 test fixtures` | *.test.ts | vitest |
| 2 | `fix(pf2): correctly track and apply MAP to attacks` | attack.ts | vitest |
| 3 | `feat(pf2): implement Stride and Step actions` | stride.ts, actions.ts, router.ts, PF2GameActionPanel.tsx | vitest + browser |
| 4 | `feat(pf2): implement Stand action` | actions.ts | vitest |
| 5 | `feat(pf2): implement Raise Shield action` | actions.ts, rules.ts | vitest |
| 6 | `feat(pf2): implement condition effects` | conditions.ts, rules.ts | vitest |
| 7 | `feat(pf2): implement Attack of Opportunity` | reactions.ts, router.ts | vitest |
| 8 | `feat(pf2): implement spell casting system` | spells.ts, spell.ts | vitest |
| 9 | `feat(pf2): implement bot AI with simple heuristics` | bot.ts | vitest + match test |
| 10 | `feat(pf2): wire up mobile PF2ActionBar` | GameScreen.tsx | mobile test |
| 11 | `chore(pf2): polish and fix edge cases` | various | full test suite |

---

## Success Criteria

### Verification Commands
```bash
npm run build         # Expected: SUCCESS
npx vitest run        # Expected: 400+ tests, 0 failures
cd server && npx tsc --noEmit  # Expected: 0 errors
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] PF2 match playable end-to-end
- [ ] Bot can complete a match
- [ ] Spells castable from Pathbuilder import
