# Multi-Ruleset Architecture Refactor

## TL;DR

> **Quick Summary**: Refactor architetturale preventivo per rimuovere il "GURPS leakage" dai contratti condivisi, aggiungere discriminated unions con `rulesetId`, e preparare l'architettura per futuri ruleset (D&D 5e).
> 
> **Deliverables**:
> - CombatantState e CharacterSheet come discriminated unions con `rulesetId`
> - Action payloads separati per ruleset
> - Type guards ergonomici che accettano `unknown`
> - shared/types.ts senza import diretti da GURPS
> - Ruleset.ts con tipi base generici
> 
> **Estimated Effort**: Medium (1-2 giorni)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 5 → Task 6 → Task 7

---

## Context

### Original Request
Review architetturale del progetto combat-sim per identificare aree di miglioramento.

### Interview Summary
**Key Discussions**:
- L'architettura attuale è "GURPS-shaped" con contratti condivisi che importano da GURPS
- Build passa ma l'architettura ha technical debt che complica futura estensibilità
- Oracle ha raccomandato discriminated unions e rimozione GURPS leakage

**Research Findings**:
- `shared/types.ts` importa `CombatantState`, `ManeuverType` da `./rulesets/gurps/types`
- `shared/rulesets/Ruleset.ts` importa tipi GURPS-specifici
- PF2 actions sono embedded nei tipi GURPS (`CombatActionPayload` include `pf2_step`, `pf2_stand`)
- Type guards attuali richiedono `CharacterSheet` come input, non `unknown`

### Metis Review
**Identified Gaps** (addressed):
- Build state: Verificato che passa (non è fix urgente)
- Type discrimination strategy: Deciso "belt and suspenders" (rulesetId + shape)
- Action payload: Deciso separazione per ruleset
- Backward compat alias `CombatantState = GurpsCombatantState`: Da deprecare

---

## Work Objectives

### Core Objective
Rendere l'architettura dei tipi veramente ruleset-agnostica, permettendo a TypeScript di distinguere correttamente tra GURPS, PF2 e futuri ruleset tramite discriminated unions.

### Concrete Deliverables
- `shared/rulesets/base/types.ts` - Tipi base con `rulesetId` discriminante
- `shared/types.ts` - Import da base, non da GURPS
- `shared/rulesets/gurps/types.ts` - Tipi GURPS-specifici + action payload
- `shared/rulesets/pf2/types.ts` - Tipi PF2-specifici + action payload
- `shared/rulesets/index.ts` - Type guards ergonomici
- `shared/rulesets/Ruleset.ts` - Interfacce generiche senza GURPS

### Definition of Done
- [ ] `npm run build` passa senza errori
- [ ] `npx vitest run` → 356 test passano
- [ ] `grep -r "from.*rulesets/gurps" shared/types.ts` → nessun risultato
- [ ] `grep -r "from.*rulesets/gurps" shared/rulesets/Ruleset.ts` → nessun risultato
- [ ] Type guards accettano `unknown` come input

### Must Have
- `rulesetId` discriminante su CombatantState
- `rulesetId` discriminante su CharacterSheet
- Action payloads separati per ruleset
- Type guards che accettano `unknown`
- Zero import GURPS in shared/types.ts

### Must NOT Have (Guardrails)
- ❌ Nuove feature PF2 (Stride, conditions) - OUT OF SCOPE
- ❌ Implementazione D&D 5e - OUT OF SCOPE
- ❌ Modifiche al comportamento runtime - solo tipi
- ❌ Refactoring UI oltre a fix import - solo tipi
- ❌ Nuovi test - 356 esistenti sono sufficienti
- ❌ Modifiche a WebSocket message shapes

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Vitest)
- **User wants tests**: NO (existing 356 tests as safety net)
- **Framework**: Vitest

### Manual Execution Verification

Ogni task include:
1. `npx vitest run` → tutti i test passano
2. `npm run build` → build completo
3. Verifica grep per import GURPS dove richiesto

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Add rulesetId to base types
└── Task 4: Create separate action payloads

Wave 2 (After Wave 1):
├── Task 2: Update CharacterSheet union
├── Task 3: Update CombatantState union
└── Task 5: Update shared/types.ts imports

Wave 3 (After Wave 2):
├── Task 6: Update Ruleset.ts
└── Task 7: Update type guards to accept unknown

Wave 4 (Final):
└── Task 8: Remove deprecated aliases & verify
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3, 5 | 4 |
| 2 | 1 | 5, 7 | 3, 4 |
| 3 | 1 | 5, 7 | 2, 4 |
| 4 | None | 5 | 1 |
| 5 | 1, 2, 3, 4 | 6 | None |
| 6 | 5 | 7 | None |
| 7 | 2, 3, 6 | 8 | None |
| 8 | All | None | None |

---

## TODOs

- [ ] 1. Add `rulesetId` discriminant to base types

  **What to do**:
  - Modify `shared/rulesets/base/types.ts`
  - Add `rulesetId: RulesetId` field to `BaseCombatantState`
  - Add `rulesetId: RulesetId` field to base character type (create if not exists)
  - Ensure `RulesetId = 'gurps' | 'pf2'` is defined

  **Must NOT do**:
  - Don't change runtime behavior
  - Don't modify derived stats calculation

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file modification with clear pattern
  - **Skills**: []
    - No special skills needed - straightforward TypeScript edit
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not needed for simple edit

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 4)
  - **Blocks**: Tasks 2, 3, 5
  - **Blocked By**: None

  **References**:
  
  **Pattern References**:
  - `shared/types.ts:19` - `RulesetId` type definition already exists
  - `shared/types.ts:23-33` - `MatchState` already has `rulesetId` field - follow this pattern

  **Type References**:
  - `shared/rulesets/base/types.ts` - `BaseCombatantState` interface to modify
  - `shared/rulesets/gurps/types.ts:166-228` - `GurpsCombatantState` extends `BaseCombatantState`
  - `shared/rulesets/pf2/types.ts:48-60` - `PF2CombatantState` extends `BaseCombatantState`

  **WHY Each Reference Matters**:
  - `MatchState.rulesetId` shows the exact pattern to follow for discriminant
  - `BaseCombatantState` is where to add the discriminant so it propagates to both GURPS and PF2

  **Acceptance Criteria**:
  - [ ] `BaseCombatantState` has `rulesetId: RulesetId` field
  - [ ] `npx vitest run` → 356 tests pass (existing tests may need minor updates)
  - [ ] `npm run build` → success

  **Commit**: YES
  - Message: `refactor(types): add rulesetId discriminant to BaseCombatantState`
  - Files: `shared/rulesets/base/types.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 2. Update CharacterSheet as discriminated union

  **What to do**:
  - Modify `shared/rulesets/gurps/types.ts` - add explicit `rulesetId: 'gurps'` to `GurpsCharacterSheet`
  - Modify `shared/rulesets/pf2/types.ts` - add explicit `rulesetId: 'pf2'` to `PF2CharacterSheet`
  - Verify union in `shared/rulesets/index.ts` still works

  **Must NOT do**:
  - Don't change existing shape-based discrimination (keep both)
  - Don't modify character creation logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple field additions to existing types
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4)
  - **Blocks**: Tasks 5, 7
  - **Blocked By**: Task 1

  **References**:
  
  **Pattern References**:
  - `shared/types.ts:23-33` - `MatchState` discriminant pattern

  **Type References**:
  - `shared/rulesets/gurps/types.ts:10-110` - `GurpsCharacterSheet` type
  - `shared/rulesets/pf2/types.ts:5-45` - `PF2CharacterSheet` type
  - `shared/rulesets/index.ts:8-12` - `CharacterSheet` union definition

  **WHY Each Reference Matters**:
  - Need to add `rulesetId` to both character sheet types
  - Union definition must remain valid after changes

  **Acceptance Criteria**:
  - [ ] `GurpsCharacterSheet` has `rulesetId: 'gurps'`
  - [ ] `PF2CharacterSheet` has `rulesetId: 'pf2'`
  - [ ] `npx vitest run` → all tests pass
  - [ ] `npm run build` → success

  **Commit**: YES
  - Message: `refactor(types): add rulesetId to CharacterSheet types`
  - Files: `shared/rulesets/gurps/types.ts`, `shared/rulesets/pf2/types.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 3. Update CombatantState as discriminated union

  **What to do**:
  - Modify `shared/rulesets/gurps/types.ts` - ensure `GurpsCombatantState` has `rulesetId: 'gurps'`
  - Modify `shared/rulesets/pf2/types.ts` - ensure `PF2CombatantState` has `rulesetId: 'pf2'`
  - Update `shared/rulesets/index.ts` to export proper `CombatantState` union

  **Must NOT do**:
  - Don't change runtime combatant creation
  - Don't modify existing fields

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Building on Task 1's pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 4)
  - **Blocks**: Tasks 5, 7
  - **Blocked By**: Task 1

  **References**:
  
  **Pattern References**:
  - `shared/types.ts:23-33` - `MatchState` discriminant pattern

  **Type References**:
  - `shared/rulesets/gurps/types.ts:166-228` - `GurpsCombatantState`
  - `shared/rulesets/pf2/types.ts:48-60` - `PF2CombatantState`
  - `shared/rulesets/index.ts` - Union exports

  **WHY Each Reference Matters**:
  - Both combatant states need explicit rulesetId
  - Index.ts is where union is exported for the rest of the codebase

  **Acceptance Criteria**:
  - [ ] `GurpsCombatantState` has `rulesetId: 'gurps'` (from base + override)
  - [ ] `PF2CombatantState` has `rulesetId: 'pf2'` (from base + override)
  - [ ] `CombatantState = GurpsCombatantState | PF2CombatantState` exported from index
  - [ ] `npx vitest run` → all tests pass
  - [ ] `npm run build` → success

  **Commit**: YES
  - Message: `refactor(types): add rulesetId to CombatantState types`
  - Files: `shared/rulesets/gurps/types.ts`, `shared/rulesets/pf2/types.ts`, `shared/rulesets/index.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 4. Create separate action payload types per ruleset

  **What to do**:
  - In `shared/rulesets/gurps/types.ts`:
    - Create `GurpsCombatActionPayload` with ONLY GURPS actions
    - Remove `pf2_step`, `pf2_stand`, `pf2_drop_prone` from it
  - In `shared/rulesets/pf2/types.ts`:
    - Create `PF2CombatActionPayload` with PF2 actions
  - In `shared/rulesets/index.ts`:
    - Export `CombatActionPayload = GurpsCombatActionPayload | PF2CombatActionPayload`

  **Must NOT do**:
  - Don't change action handlers logic
  - Don't rename action type strings (keep `pf2_step`, `attack`, etc.)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Type reorganization, no logic changes
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  
  **Pattern References**:
  - `shared/rulesets/gurps/types.ts:137-200` - Current `CombatActionPayload` with mixed actions

  **Type References**:
  - `shared/rulesets/gurps/types.ts:195-197` - PF2 actions embedded: `pf2_step`, `pf2_stand`, `pf2_drop_prone`
  - `shared/types.ts:92-115` - `ClientToServerMessage` uses `CombatActionPayload`

  **WHY Each Reference Matters**:
  - Need to identify which actions are PF2 vs GURPS
  - ClientToServerMessage contract must stay valid

  **Acceptance Criteria**:
  - [ ] `GurpsCombatActionPayload` has NO `pf2_*` action types
  - [ ] `PF2CombatActionPayload` exists with PF2 actions
  - [ ] `CombatActionPayload` union exported from index
  - [ ] `npx vitest run` → all tests pass
  - [ ] `npm run build` → success

  **Commit**: YES
  - Message: `refactor(types): separate action payloads by ruleset`
  - Files: `shared/rulesets/gurps/types.ts`, `shared/rulesets/pf2/types.ts`, `shared/rulesets/index.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 5. Remove GURPS imports from shared/types.ts

  **What to do**:
  - In `shared/types.ts`:
    - Remove `import { ... } from './rulesets/gurps/types'`
    - Add `import { CombatantState, CharacterSheet, CombatActionPayload } from './rulesets'`
    - Update `MatchState.combatants` to use union `CombatantState[]`
    - Update any other GURPS-specific type references

  **Must NOT do**:
  - Don't change MatchState shape (just type imports)
  - Don't add new fields to messages

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Import reorganization
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on 1, 2, 3, 4)
  - **Parallel Group**: Wave 2.5 (alone)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 1, 2, 3, 4

  **References**:
  
  **Pattern References**:
  - `shared/rulesets/index.ts` - Export point for union types

  **Type References**:
  - `shared/types.ts:5-10` - Current GURPS imports to remove
  - `shared/types.ts:23-60` - `MatchState` using GURPS types

  **Test References**:
  - After this change, run `grep -r "from.*rulesets/gurps" shared/types.ts` to verify no GURPS imports

  **WHY Each Reference Matters**:
  - This is the core change - removing GURPS leakage from shared contracts
  - MatchState is the main consumer of these types

  **Acceptance Criteria**:
  - [ ] `grep -r "from.*rulesets/gurps" shared/types.ts` → NO results
  - [ ] `shared/types.ts` imports from `./rulesets` (the index)
  - [ ] `npx vitest run` → all tests pass
  - [ ] `npm run build` → success

  **Commit**: YES
  - Message: `refactor(types): remove GURPS imports from shared/types.ts`
  - Files: `shared/types.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 6. Update Ruleset.ts to use base types

  **What to do**:
  - In `shared/rulesets/Ruleset.ts`:
    - Remove imports from `./gurps/types`
    - Import from `./base/types` or use generic type parameters
    - Replace `ManeuverType` with generic action type
    - Replace `CombatantState` with base or union type

  **Must NOT do**:
  - Don't change Ruleset interface contract
  - Don't add new methods

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Import cleanup
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (alone)
  - **Blocks**: Task 7
  - **Blocked By**: Task 5

  **References**:
  
  **Pattern References**:
  - `shared/rulesets/base/types.ts` - Base types to use

  **Type References**:
  - `shared/rulesets/Ruleset.ts` - Current file with GURPS imports
  - Line ~1-20 for import statements

  **Test References**:
  - After change: `grep -r "from.*gurps" shared/rulesets/Ruleset.ts` → NO results

  **WHY Each Reference Matters**:
  - Ruleset.ts defines interface used by all rulesets
  - Must be ruleset-agnostic

  **Acceptance Criteria**:
  - [ ] `grep -r "from.*gurps" shared/rulesets/Ruleset.ts` → NO results
  - [ ] Ruleset interface still works for both GURPS and PF2
  - [ ] `npx vitest run` → all tests pass
  - [ ] `npm run build` → success

  **Commit**: YES
  - Message: `refactor(types): remove GURPS imports from Ruleset.ts`
  - Files: `shared/rulesets/Ruleset.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 7. Update type guards to accept `unknown`

  **What to do**:
  - In `shared/rulesets/index.ts`:
    - Change `isGurpsCharacter(char: CharacterSheet)` to `isGurpsCharacter(char: unknown)`
    - Change `isPF2Character(char: CharacterSheet)` to `isPF2Character(char: unknown)`
    - Change `isGurpsCombatant(...)` to accept `unknown`
    - Change `isPF2Combatant(...)` to accept `unknown`
    - Add runtime checks for `null`/`undefined`
    - Prefer `rulesetId` check first, then shape check as backup

  **Must NOT do**:
  - Don't change what the guards return (just input type)
  - Don't remove shape checks (keep both strategies)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small but important API change
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (alone)
  - **Blocks**: Task 8
  - **Blocked By**: Tasks 2, 3, 6

  **References**:
  
  **Pattern References**:
  - TypeScript handbook: Type guards with `unknown` - https://www.typescriptlang.org/docs/handbook/2/narrowing.html

  **Type References**:
  - `shared/rulesets/index.ts:20-50` - Current type guard implementations

  **WHY Each Reference Matters**:
  - Type guards are used throughout codebase for narrowing
  - Accepting `unknown` makes them usable anywhere without prior type assertion

  **Acceptance Criteria**:
  - [ ] All 4 type guards accept `unknown` as first parameter
  - [ ] Guards check for `null`/`undefined` before property access
  - [ ] Guards use `rulesetId` check as primary, shape as secondary
  - [ ] `npx vitest run` → all tests pass
  - [ ] `npm run build` → success

  **Commit**: YES
  - Message: `refactor(types): make type guards accept unknown for ergonomic narrowing`
  - Files: `shared/rulesets/index.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 8. Final cleanup and verification

  **What to do**:
  - Remove deprecated `CombatantState = GurpsCombatantState` alias if exists
  - Run full verification:
    - `npx vitest run` → 356 tests pass
    - `npm run build` → success
    - `cd server && npx tsc --noEmit` → success
    - `npm run lint` → no errors
  - Verify grep checks:
    - `grep -r "from.*rulesets/gurps" shared/types.ts` → 0 results
    - `grep -r "from.*rulesets/gurps" shared/rulesets/Ruleset.ts` → 0 results
  - Manual verification: Start a GURPS match and a PF2 match in browser

  **Must NOT do**:
  - Don't add new features
  - Don't "improve" code while cleaning

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification and small cleanup
  - **Skills**: [`playwright`]
    - `playwright`: For browser verification of matches
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not needed for verification

  **Parallelization**:
  - **Can Run In Parallel**: NO (final task)
  - **Parallel Group**: Wave 4 (final)
  - **Blocks**: None
  - **Blocked By**: All previous tasks

  **References**:
  
  **Documentation References**:
  - This plan's acceptance criteria

  **Acceptance Criteria**:
  - [ ] `npx vitest run` → 356 tests pass
  - [ ] `npm run build` → success
  - [ ] `cd server && npx tsc --noEmit` → success
  - [ ] `npm run lint` → no lint errors
  - [ ] `grep -r "from.*rulesets/gurps" shared/types.ts` → 0 results
  - [ ] `grep -r "from.*rulesets/gurps" shared/rulesets/Ruleset.ts` → 0 results
  - [ ] Browser: GURPS match can start and play
  - [ ] Browser: PF2 match can start (even if features limited)

  **Commit**: YES
  - Message: `refactor(types): complete multi-ruleset architecture cleanup`
  - Files: Any remaining cleanup files
  - Pre-commit: `npx vitest run && npm run lint`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `refactor(types): add rulesetId discriminant to BaseCombatantState` | base/types.ts | npx vitest run |
| 2 | `refactor(types): add rulesetId to CharacterSheet types` | gurps/types.ts, pf2/types.ts | npx vitest run |
| 3 | `refactor(types): add rulesetId to CombatantState types` | gurps/types.ts, pf2/types.ts, index.ts | npx vitest run |
| 4 | `refactor(types): separate action payloads by ruleset` | gurps/types.ts, pf2/types.ts, index.ts | npx vitest run |
| 5 | `refactor(types): remove GURPS imports from shared/types.ts` | shared/types.ts | npx vitest run |
| 6 | `refactor(types): remove GURPS imports from Ruleset.ts` | Ruleset.ts | npx vitest run |
| 7 | `refactor(types): make type guards accept unknown` | index.ts | npx vitest run |
| 8 | `refactor(types): complete multi-ruleset architecture cleanup` | misc | npx vitest run && npm run lint |

---

## Success Criteria

### Verification Commands
```bash
# All tests pass
npx vitest run  # Expected: 356 tests, all pass

# Client builds
npm run build  # Expected: success

# Server compiles
cd server && npx tsc --noEmit  # Expected: no errors

# No lint errors
npm run lint  # Expected: no errors

# GURPS leakage removed
grep -r "from.*rulesets/gurps" shared/types.ts  # Expected: no results
grep -r "from.*rulesets/gurps" shared/rulesets/Ruleset.ts  # Expected: no results
```

### Final Checklist
- [ ] All 356 tests pass
- [ ] Client build succeeds
- [ ] Server compiles without errors
- [ ] No ESLint errors
- [ ] No GURPS imports in shared/types.ts
- [ ] No GURPS imports in Ruleset.ts
- [ ] Type guards accept `unknown`
- [ ] CombatantState is a proper union with discriminant
- [ ] CharacterSheet has `rulesetId` discriminant
- [ ] Action payloads are separate per ruleset
- [ ] GURPS match works in browser
- [ ] PF2 match starts in browser
