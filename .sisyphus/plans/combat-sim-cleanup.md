# Combat-Sim Cleanup & Improvements

## TL;DR

> **Completo refactoring e miglioramento del tactical combat simulator**: fix di tutti gli errori lint, ripristino test suite, aggiunta coverage mancante, consolidamento codice duplicato, e implementazione di 11 miglioramenti UI/UX per il movimento.
>
> **Deliverables**:
> - 0 errori ESLint (`npm run lint` pass)
> - 100% test suite verde (`npx vitest run` + `npx playwright test`)
> - Coverage GURPS server handlers ≥70%
> - UUID utility consolidato (single source of truth)
> - 11 UX improvements movimento implementati
>
> **Estimated Effort**: Large (3-5 giorni)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Lint fixes → Test fixes → UUID refactor → UX improvements

---

## Context

### Original Request
Analisi completa del progetto combat-sim e creazione piano di lavoro per sistemare problemi tecnici e implementare miglioramenti mancanti.

### Interview Summary
**Key Discussions**:
- Scope completo: fix tecnici + UX improvements + refactor avanzati
- Nessuna deadline: review accurata possibile
- Include sia test unitari che E2E
- Priorità: stabilità build/CI prima di feature work

### Metis Review
**Identified Gaps** (addressed):
- Guardrails: no modifiche cross-cutting prima di baseline verde
- Sequenza: lint → test unitari → test e2e → refactor → coverage → UX
- Rischi: refactor UUID può impattare build, UX potrebbe richiedere nuovi stati
- Criteri: ogni fase ha acceptance criteria misurabili

---

## Work Objectives

### Core Objective
Portare il codebase a uno stato di "clean baseline": build stabile, test affidabili, coverage completa, e UX movimento migliorata secondo specifiche documentate.

### Concrete Deliverables
1. **Lint Fixes**: 22 errori ESLint risolti
2. **Test Fixes**: 9+ file test ripristinati
3. **Coverage GURPS**: Test handlers mancanti (attack, movement, ready)
4. **UUID Consolidation**: Single source of truth per utility UUID
5. **UX Improvements**: 11 miglioramenti movimento da `docs/MOVEMENT_UI_IMPROVEMENTS.md`
6. **PF2 Bots**: Miglioramenti comportamento bot (se scope lo permette)

### Definition of Done
- [ ] `npm run lint` → 0 errori, 0 warnings
- [ ] `npx vitest run` → tutti i test passano
- [ ] `npx playwright test` → tutti i test E2E passano
- [ ] Coverage GURPS handlers ≥70%
- [ ] UUID utility unificato in `shared/utils/uuid.ts`
- [ ] Tutti i file `src/utils/uuid.ts` importano da shared
- [ ] 11 UX improvements movimento implementati e verificabili
- [ ] Documentazione aggiornata (AGENTS.md se necessario)

### Must Have
- Fix tutti i blocking errori (lint + test)
- Non rompere funzionalità esistenti
- Mantenere compatibilità multi-ruleset
- Seguire pattern UI esistenti (desktop + mobile)

### Must NOT Have (Guardrails)
- NO refactoring di logiche business (solo cleanup)
- NO cambi API in `shared/types.ts`
- NO "formatting sweep" globale (solo file toccati)
- NO modifiche cross-cutting prima di baseline verde
- NO aggiunta nuovi ruleset (fuori scope)

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Vitest + Playwright configurati)
- **User wants tests**: YES (TDD per nuovi test, fix per esistenti)
- **Framework**: Vitest per unit, Playwright per E2E

### Test Setup
Nessun setup necessario - infrastruttura esistente. Solo fix dipendenze mancanti.

### Automated Verification

**Per ogni task di lint/test:**
```bash
npm run lint
# Assert: 0 errori

npx vitest run
# Assert: 0 test falliti
```

**Per UX improvements:**
```bash
npm run dev
# Verifica manuale visuale + screenshot per confronto
```

**Per refactor UUID:**
```bash
npm run build
# Assert: Build client completa senza errori

cd server && npm run build
# Assert: Build server completa senza errori
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Fondamentale - Sequential):
├── Task 1: Fix ESLint errors (22 file)
└── Task 2: Fix unit test dependencies (9 file)

Wave 2 (Verifica - Parallel):
├── Task 3: Fix E2E tests (Playwright)
└── Task 4: Consolidate UUID utility

Wave 3 (Espansione - Sequential):
├── Task 5: Add GURPS handler tests (attack, movement, ready)
└── Task 6: Implement UX movement improvements (11 item)

Wave 4 (Bonus - Optional):
└── Task 7: Improve PF2 bots behavior

Critical Path: 1 → 2 → 3 → 4 → 5 → 6
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3 | None |
| 2 | 1 | 3, 5 | None |
| 3 | 1, 2 | 4, 6 | Task 4 (parziale) |
| 4 | 1, 2 | 6 | Task 3 |
| 5 | 1, 2, 3 | 6 | None (dopo baseline) |
| 6 | 1, 2, 3, 4, 5 | None | None |
| 7 | 1-6 | None | None (bonus) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Category | Skills |
|------|-------|---------------------|--------|
| 1 | 1, 2 | quick | - |
| 2 | 3 | quick | playwright |
| 2 | 4 | quick | - |
| 3 | 5 | ultrabrain | - |
| 3 | 6 | visual-engineering | frontend-ui-ux |
| 4 | 7 | deep | - |

---

## TODOs

### Wave 1: Fondamentale

- [x] **1. Fix ESLint Errors - Parte 1 (E2E & DB)**

  **What to do**:
  - Correggi 1 errore in `e2e/pre-game-flow.spec.ts` (variabile `isVisible` non usata)
  - Correggi 1 errore in `server/src/db.ts` (parametro `forUserId` non usato)

  **Must NOT do**:
  - Non modificare logica SQL
  - Non cambiare signature funzioni pubbliche

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: nessuno specifico

  **Parallelization**:
  - **Can Run In Parallel**: YES (con Task 2)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 3
  - **Blocked By**: None

  **References**:
  - `e2e/pre-game-flow.spec.ts:423` - Linea con errore
  - `server/src/db.ts:363` - Linea con errore
  - ESLint rule: `@typescript-eslint/no-unused-vars`

  **Acceptance Criteria**:
  - [ ] `npm run lint` mostra 0 errori sui 2 file modificati
  - [ ] Test E2E `pre-game-flow.spec.ts` eseguibili (anche se con altri errori)

  **Commit**: YES
  - Message: `fix(lint): remove unused variables in e2e and db`
  - Files: `e2e/pre-game-flow.spec.ts`, `server/src/db.ts`

---

- [x] **2. Fix ESLint Errors - Parte 2 (Server Handlers GURPS)**

  **What to do**:
  - Correggi 1 errore in `server/src/handlers/gurps/movement.ts` (`hexDistance` non usato)
  - Correggi 5 errori in `server/src/handlers/gurps/wait-interrupt.ts` (`WaitTrigger`, `triggerSourceId`, `attackPayload`, `movePayload`, `readyPayload`)

  **Must NOT do**:
  - Non rimuovere logica di business (solo cleanup)
  - Non modificare comportamento wait/interrupt

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES (con Task 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  - `server/src/handlers/gurps/movement.ts:19`
  - `server/src/handlers/gurps/wait-interrupt.ts:2,26,47`

  **Acceptance Criteria**:
  - [ ] `npm run lint` 0 errori su entrambi i file
  - [ ] `npx vitest run` (file esistenti) passa

  **Commit**: YES
  - Message: `fix(lint): remove unused imports in gurps handlers`

---

- [x] **3. Fix ESLint Errors - Parte 3 (Server Handlers PF2)**

  **What to do**:
  - Correggi 3 errori in `server/src/handlers/pf2/skill-actions.ts` (`Abilities`, `Proficiency`, `PF2Skill`)
  - Correggi 3 errori in `server/src/handlers/pf2/stride.ts` (`getServerAdapter`, `assertRulesetId`, `payload`)
  - Correggi 1 errore in `server/src/handlers/pf2/__tests__/testUtils.ts` (`Id`)
  - Correggi 1 errore in `server/src/handlers/pf2/attack.ts` (`isAgile`)
  - Correggi 1 errore in `server/src/handlers/pf2/skill-actions.test.ts` (`target`)

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Acceptance Criteria**:
  - [ ] 0 errori ESLint su tutti i file PF2
  - [ ] Test PF2 esistenti passano

  **Commit**: YES
  - Message: `fix(lint): cleanup unused imports in pf2 handlers`

---

- [x] **4. Fix ESLint Errors - Parte 4 (Bot Tests)**

  **What to do**:
  - Correggi 3 errori in `server/src/rulesets/pf2/bot.test.ts` (`Player`, `_grid`, `bot`, `match`)
  - Correggi 1 errore in `server/src/rulesets/gurps/bot.ts` (`DefenseType`)

  **Acceptance Criteria**:
  - [ ] 0 errori ESLint
  - [ ] Test bot passano

  **Commit**: YES
  - Message: `fix(lint): cleanup bot tests and gurps bot`

---

- [x] **5. Fix Unit Test Dependencies**

  **What to do**:
  - Installa `@testing-library/user-event` se mancante
  - Fix import in `src/components/dashboard/CreateMatchDialog.test.tsx`
  - Verifica e fix altri 8 file di test con problemi simili

  **Must NOT do**:
  - Non modificare logica test, solo fix dipendenze/import

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Acceptance Criteria**:
  - [ ] `npx vitest run` → 0 test falliti
  - [ ] Nessun errore "Failed to resolve import"

  **Commit**: YES
  - Message: `fix(test): restore broken unit tests dependencies`

---

### Wave 2: Verifica

- [ ] **6. Fix E2E Tests**

  **What to do**:
  - Analizza e fix test Playwright che falliscono
  - Verifica configurazione fixtures/browser
  - Fix eventuali problemi di timing o selettori

  **Must NOT do**:
  - Non modificare comportamento applicazione, solo test

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `playwright`

  **Acceptance Criteria**:
  - [ ] `npx playwright test` → verde (o flake rate <10%)
  - [ ] Screenshot/evidence per test principali

  **Commit**: YES
  - Message: `fix(e2e): restore playwright test suite`

---

- [x] **7. Consolidate UUID Utility**

  **What to do**:
  - Analizza `src/utils/uuid.ts` e `shared/utils/uuid.ts`
  - Consolidia in `shared/utils/uuid.ts` (single source of truth)
  - Aggiorna tutti gli import in `src/` per usare `shared/utils/uuid`
  - Rimuovi `src/utils/uuid.ts` (o fai re-export per backward compat)

  **Must NOT do**:
  - Non modificare comportamento generazione UUID
  - Non rompere build client/server

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Acceptance Criteria**:
  - [ ] `npm run build` (client) successo
  - [ ] `npm run build` (server) successo
  - [ ] `npx vitest run` passa
  - [ ] Nessun file importa da `src/utils/uuid`

  **Commit**: YES
  - Message: `refactor(uuid): consolidate uuid utility to shared`

---

### Wave 3: Espansione

- [ ] **8. Add GURPS Handler Tests - Attack**

  **What to do**:
  - Crea `server/src/handlers/gurps/attack.test.ts`
  - Testa handler attacchi GURPS (Melee, Ranged, All-Out Attack, etc.)
  - Copertura: successo, fallimento, edge cases

  **Must NOT do**:
  - Non modificare handler esistenti (solo test)
  - Non aggiungere logiche business nuove

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`

  **Acceptance Criteria**:
  - [ ] Coverage attack.ts ≥70%
  - [ ] Test per: melee, ranged, feint, all-out attack
  - [ ] Test per: defense calculation, damage resolution

  **Commit**: YES
  - Message: `test(gurps): add attack handler tests`

---

- [ ] **9. Add GURPS Handler Tests - Movement**

  **What to do**:
  - Crea `server/src/handlers/gurps/movement.test.ts`
  - Testa handler movimento (step, facing, posture)
  - Verifica reachable hexes, costi MP, rotazioni

  **Acceptance Criteria**:
  - [ ] Coverage movement.ts ≥70%
  - [ ] Test per: step movement, facing change, posture
  - [ ] Test per: MP calculation, backward movement

  **Commit**: YES
  - Message: `test(gurps): add movement handler tests`

---

- [ ] **10. Add GURPS Handler Tests - Ready**

  **What to do**:
  - Crea `server/src/handlers/gurps/ready.test.ts`
  - Testa handler ready (equip/unequip armi)

  **Acceptance Criteria**:
  - [ ] Coverage ready.ts ≥70%
  - [ ] Test per: equip weapon, unequip, shield

  **Commit**: YES
  - Message: `test(gurps): add ready handler tests`

---

- [ ] **11. Implement UX Movement Improvements - Alta Priorità**

  **What to do** (da `docs/MOVEMENT_UI_IMPROVEMENTS.md`):
  1. **MP visibile**: Ingrandire "X MP" con font bold, colore verde, icona
  2. **Feedback click invalido**: Toast/flash rosso "Troppo lontano!"
  3. **Rimuovi istruzione ridondante**: Rimuovere "Click a hex to move" duplicato
  4. **Istruzione post-Skip**: Aggiornare messaggio dopo skip movement

  **Must NOT do**:
  - Non cambiare logica movimento (solo UI)
  - Mantenere compatibilità mobile/desktop

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `frontend-ui-ux`

  **Acceptance Criteria**:
  - [ ] MP counter visibile con stile migliorato
  - [ ] Toast errore appare su click hex non raggiungibile
  - [ ] Nessuna istruzione ridondante visibile
  - [ ] Test su desktop (>768px) e mobile (<768px)

  **Commit**: YES
  - Message: `feat(ui): improve movement visibility and feedback (high priority)`

---

- [ ] **12. Implement UX Movement Improvements - Media Priorità**

  **What to do**:
  5. **Gradiente colori hex**: Verde (1-2 MP) → Giallo (3-4) → Arancione (5+)
  6. **Costo su hover**: Tooltip con costo MP per hex
  7. **Tooltip rotazione**: "Ruota sx/dx (-1 MP)" sui pulsanti facing
  8. **Pulsanti mobile più grandi**: Aumentare dimensione Undo/Skip/Confirm

  **Acceptance Criteria**:
  - [ ] Hex colorati con gradiente basato su distanza
  - [ ] Tooltip costo MP visibile su hover
  - [ ] Facing buttons con tooltip chiaro
  - [ ] Pulsanti mobile ridimensionati

  **Commit**: YES
  - Message: `feat(ui): enhance movement grid and controls (medium priority)`

---

- [ ] **13. Implement UX Movement Improvements - Bassa Priorità**

  **What to do**:
  9. **Animazione movimento**: Animazione più fluida spostamento personaggio
  10. **Path preview**: Linea tratteggiata percorso su hover
  11. **Suono feedback**: Audio per click valido/invalido

  **Must NOT do**:
  - Non aggiungere librerie audio pesanti
  - Mantenere performance >60fps

  **Acceptance Criteria**:
  - [ ] Animazione movimento fluida (≥30fps)
  - [ ] Path preview visibile su hex raggiungibili
  - [ ] Suoni opzionali (toggle nelle impostazioni)

  **Commit**: YES
  - Message: `feat(ui): polish movement animations and feedback (low priority)`

---

### Wave 4: Bonus

- [ ] **14. Improve PF2 Bots Behavior**

  **What to do**:
  - Analizza comportamento bot PF2 attuale (`server/src/rulesets/pf2/bot.ts`)
  - Implementa decisioni più intelligenti (target selection, spell usage)
  - Aggiungi variabilità comportamentale

  **Must NOT do**:
  - Non rendere bot imbattibili
  - Non aggiungere AI complessa (semplice heuristica)

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [ ] Bot PF2 usano abilità in modo sensato
  - [ ] Bot selezionano target appropriati
  - [ ] Test aggiornati passano

  **Commit**: YES (se completato)
  - Message: `feat(ai): improve pf2 bot decision making`

---

## Commit Strategy

| After Task | Message | Scope | Breaking? |
|------------|---------|-------|-----------|
| 1-4 | `fix(lint): ...` | lint | No |
| 5 | `fix(test): ...` | test | No |
| 6 | `fix(e2e): ...` | e2e | No |
| 7 | `refactor(uuid): ...` | uuid | No |
| 8-10 | `test(gurps): ...` | test | No |
| 11-13 | `feat(ui): ...` | ui | No |
| 14 | `feat(ai): ...` | ai | No |

**Branch naming**: `cleanup/combat-sim-cleanup`

---

## Success Criteria

### Final Verification Commands
```bash
# 1. Lint
npm run lint
# Expected: 0 errors, 0 warnings

# 2. Unit Tests
npx vitest run
# Expected: All tests pass

# 3. E2E Tests
npx playwright test
# Expected: All tests pass (or <10% flake)

# 4. Build Client
npm run build
# Expected: Success, no errors

# 5. Build Server
cd server && npm run build
# Expected: Success, no errors

# 6. Type Check
npx tsc --noEmit
# Expected: 0 errors
```

### Final Checklist
- [ ] Tutti i task completati
- [ ] Tutti i commit effettuati
- [ ] CI/CD verde (se applicabile)
- [ ] Documentazione aggiornata (se necessario)
- [ ] Code review completata

---

## Notes

- **Non eseguire questo piano direttamente** - Usare `/start-work` per iniziare l'esecuzione
- Ogni task ha acceptance criteria eseguibili dall'agente
- In caso di problemi imprevisti, consultare questo piano e adattare
- UX improvements seguono specifiche in `docs/MOVEMENT_UI_IMPROVEMENTS.md`
