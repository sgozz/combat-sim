# Server Ruleset Separation

## Context

### Original Request
Separare nettamente nel server le parti generiche da quelle specifiche di GURPS e Pathfinder 2e, usando directory dedicate per ogni ruleset.

### Current Problem
- `server/src/match.ts` ha `if (rulesetId === 'pf2')` per creare personaggi e combatant
- `server/src/bot.ts` ha logica PF2 e GURPS mescolata insieme
- Difficile aggiungere nuovi ruleset
- Codice duplicato tra factory functions

### Target Architecture
```
server/src/rulesets/
  types.ts              # Interfacce comuni (CharacterFactory, CombatantFactory, etc.)
  index.ts              # Registry: getRulesetFactory(rulesetId)
  gurps/
    character.ts        # createDefaultCharacter per GURPS
    combatant.ts        # createCombatant per GURPS  
    bot.ts              # executeBotAttack per GURPS
    index.ts            # Bundle export
  pf2/
    character.ts        # createDefaultCharacter per PF2
    combatant.ts        # createCombatant per PF2
    bot.ts              # executeBotAttack per PF2
    index.ts            # Bundle export
```

---

## Work Objectives

### Core Objective
Creare una struttura server-side con directory per ruleset, eliminando tutti gli `if (rulesetId === 'pf2')` da `match.ts` e `bot.ts`.

### Concrete Deliverables
1. Directory structure `server/src/rulesets/{gurps,pf2}/`
2. Factory interfaces in `server/src/rulesets/types.ts`
3. GURPS factories in `server/src/rulesets/gurps/`
4. PF2 factories in `server/src/rulesets/pf2/`
5. Registry in `server/src/rulesets/index.ts`
6. Refactored `match.ts` usando registry
7. Refactored `bot.ts` usando registry

### Definition of Done
- [x] Zero `if (rulesetId === 'pf2')` in `match.ts`
- [x] Zero `if (currentMatch.rulesetId === 'pf2')` in `bot.ts`
- [x] Ogni ruleset in directory separata
- [x] Tests passano: `npx vitest run`
- [x] Build passa: `npm run build --prefix server`

---

## Verification Strategy

### Test Infrastructure
Esistono già test in `shared/rulesets/`. Il refactoring è server-side only, quindi verificheremo:
1. Build server compila
2. Tests esistenti passano
3. Manual testing: creare match GURPS e PF2, verificare combat funziona

### Commands
```bash
npm run build --prefix server    # Build check
npx vitest run                   # Unit tests
```

---

## TODOs

- [x] 1. Create Base Types and Interfaces

  **What to do**:
  - Create `server/src/rulesets/types.ts` with:
    ```typescript
    import type { CharacterSheet, MatchState } from "../../../shared/types";
    import type { CombatantState } from "../../../shared/rulesets/gurps/types";

    export type CharacterFactory = (name: string) => CharacterSheet;

    export type CombatantFactory = (
      character: CharacterSheet,
      playerId: string,
      position: { x: number; y: number; z: number },
      facing: number
    ) => CombatantState;

    export type BotAttackExecutor = (
      matchId: string,
      match: MatchState,
      botCombatant: CombatantState,
      target: CombatantState,
      activePlayer: { id: string; name: string }
    ) => Promise<MatchState>;

    export interface RulesetServerFactory {
      createDefaultCharacter: CharacterFactory;
      createCombatant: CombatantFactory;
      executeBotAttack: BotAttackExecutor;
    }
    ```

  **Parallelizable**: NO (foundational)

  **References**:
  - `shared/rulesets/serverAdapter.ts` - Pattern da seguire per interfacce
  - `server/src/match.ts:74-141` - Logica combatant da estrarre
  - `server/src/bot.ts:92-226` - Logica bot attack da estrarre

  **Acceptance Criteria**:
  - [ ] File creato con tipi esportati
  - [ ] `npm run build --prefix server` passa

  **Commit**: NO (raggruppa con task 2-4)

---

- [x] 2. Create GURPS Character Factory

  **What to do**:
  - Create `server/src/rulesets/gurps/character.ts`:
    ```typescript
    import { randomUUID } from "node:crypto";
    import type { CharacterSheet } from "../../../../shared/types";
    import { getServerAdapter } from "../../../../shared/rulesets/serverAdapter";
    import type { CharacterFactory } from "../types";

    export const createDefaultCharacter: CharacterFactory = (name) => {
      const adapter = getServerAdapter('gurps');
      const attributes = {
        strength: 10,
        dexterity: 10,
        intelligence: 10,
        health: 10,
      };
      return {
        id: randomUUID(),
        name,
        attributes,
        derived: adapter.calculateDerivedStats(attributes),
        skills: [{ id: randomUUID(), name: "Brawling", level: 12 }],
        advantages: [],
        disadvantages: [],
        equipment: [{
          id: randomUUID(),
          name: "Club",
          type: "melee",
          damage: "1d+1",
          reach: '1' as const,
          parry: 0,
          skillUsed: "Brawling"
        }],
        pointsTotal: 100,
      };
    };
    ```

  **Parallelizable**: YES (with task 3, 4)

  **References**:
  - `server/src/match.ts:32-61` - Current GURPS character creation
  - `server/src/bot.ts:23-51` - Current bot character creation

  **Acceptance Criteria**:
  - [ ] Factory esporta `createDefaultCharacter`
  - [ ] Danno usa formato GURPS `"1d+1"`

  **Commit**: NO (raggruppa)

---

- [x] 3. Create GURPS Combatant Factory

  **What to do**:
  - Create `server/src/rulesets/gurps/combatant.ts`:
    ```typescript
    import type { CharacterSheet } from "../../../../shared/types";
    import type { CombatantState, EquippedItem } from "../../../../shared/rulesets/gurps/types";
    import type { CombatantFactory } from "../types";

    export const createCombatant: CombatantFactory = (character, playerId, position, facing) => {
      const equipped: EquippedItem[] = [];
      const primaryWeapon = character.equipment.find(e => e.type === 'melee' || e.type === 'ranged');
      const shield = character.equipment.find(e => e.type === 'shield');

      if (primaryWeapon) {
        equipped.push({ equipmentId: primaryWeapon.id, slot: 'right_hand', ready: true });
      }
      if (shield) {
        equipped.push({ equipmentId: shield.id, slot: 'left_hand', ready: true });
      }

      return {
        playerId,
        characterId: character.id,
        position,
        facing,
        posture: 'standing' as const,
        maneuver: null,
        aoaVariant: null,
        aodVariant: null,
        currentHP: character.derived.hitPoints,
        currentFP: character.derived.fatiguePoints,
        statusEffects: [],
        aimTurns: 0,
        aimTargetId: null,
        evaluateBonus: 0,
        evaluateTargetId: null,
        equipped,
        inCloseCombatWith: null,
        closeCombatPosition: null,
        grapple: { grappledBy: null, grappling: null, cpSpent: 0, cpReceived: 0 },
        usedReaction: false,
        shockPenalty: 0,
        attacksRemaining: 1,
        retreatedThisTurn: false,
        defensesThisTurn: 0,
        parryWeaponsUsedThisTurn: [],
        waitTrigger: null,
      };
    };
    ```

  **Parallelizable**: YES (with task 2, 4)

  **References**:
  - `server/src/match.ts:87-125` - Current combatant creation (base part)

  **Acceptance Criteria**:
  - [ ] Factory esporta `createCombatant`
  - [ ] `attacksRemaining: 1` (GURPS has 1 attack per turn)

  **Commit**: NO (raggruppa)

---

- [x] 4. Create GURPS Bot Attack Executor

  **What to do**:
  - Create `server/src/rulesets/gurps/bot.ts`:
  - Extract lines 282-401 from `server/src/bot.ts` (GURPS attack logic)
  - Export as `executeBotAttack: BotAttackExecutor`

  **Parallelizable**: YES (with task 2, 3)

  **References**:
  - `server/src/bot.ts:282-401` - GURPS attack flow
  - `server/src/bot.ts:428-463` - `chooseBotDefense` (GURPS-specific)

  **Acceptance Criteria**:
  - [ ] Factory esporta `executeBotAttack`
  - [ ] Include `chooseBotDefense` helper
  - [ ] Uses `resolveAttackRoll`, `rollDamage` from adapter

  **Commit**: NO (raggruppa)

---

- [x] 5. Create GURPS Bundle Index

  **What to do**:
  - Create `server/src/rulesets/gurps/index.ts`:
    ```typescript
    import { createDefaultCharacter } from './character';
    import { createCombatant } from './combatant';
    import { executeBotAttack } from './bot';
    import type { RulesetServerFactory } from '../types';

    export const gurpsServerFactory: RulesetServerFactory = {
      createDefaultCharacter,
      createCombatant,
      executeBotAttack,
    };
    ```

  **Parallelizable**: NO (depends on 2-4)

  **References**:
  - `shared/rulesets/gurps/index.ts` - Pattern da seguire

  **Acceptance Criteria**:
  - [ ] Esporta `gurpsServerFactory`
  - [ ] Build passa

  **Commit**: YES
  - Message: `refactor(server): extract GURPS server factories to dedicated directory`
  - Files: `server/src/rulesets/types.ts`, `server/src/rulesets/gurps/*`

---

- [x] 6. Create PF2 Character Factory

  **What to do**:
  - Create `server/src/rulesets/pf2/character.ts`:
    ```typescript
    import { randomUUID } from "node:crypto";
    import type { CharacterSheet } from "../../../../shared/types";
    import { getServerAdapter } from "../../../../shared/rulesets/serverAdapter";
    import type { CharacterFactory } from "../types";

    export const createDefaultCharacter: CharacterFactory = (name) => {
      const adapter = getServerAdapter('pf2');
      const attributes = {
        strength: 10,
        dexterity: 10,
        intelligence: 10,
        health: 10,
      };
      return {
        id: randomUUID(),
        name,
        attributes,
        derived: adapter.calculateDerivedStats(attributes),
        skills: [{ id: randomUUID(), name: "Brawling", level: 12 }],
        advantages: [],
        disadvantages: [],
        equipment: [{
          id: randomUUID(),
          name: "Club",
          type: "melee",
          damage: "1d6",  // PF2 format
          reach: '1' as const,
          parry: 0,
          skillUsed: "Brawling"
        }],
        pointsTotal: 100,
      };
    };
    ```

  **Parallelizable**: YES (with task 7, 8)

  **References**:
  - `server/src/match.ts:42-56` - Current PF2 branch

  **Acceptance Criteria**:
  - [ ] Factory esporta `createDefaultCharacter`
  - [ ] Danno usa formato PF2 `"1d6"` (NON `"1d+1"`)

  **Commit**: NO (raggruppa)

---

- [x] 7. Create PF2 Combatant Factory

  **What to do**:
  - Create `server/src/rulesets/pf2/combatant.ts`:
    ```typescript
    import type { CharacterSheet } from "../../../../shared/types";
    import type { CombatantState, EquippedItem } from "../../../../shared/rulesets/gurps/types";
    import type { CombatantFactory } from "../types";

    export const createCombatant: CombatantFactory = (character, playerId, position, facing) => {
      const equipped: EquippedItem[] = [];
      const primaryWeapon = character.equipment.find(e => e.type === 'melee' || e.type === 'ranged');
      const shield = character.equipment.find(e => e.type === 'shield');

      if (primaryWeapon) {
        equipped.push({ equipmentId: primaryWeapon.id, slot: 'right_hand', ready: true });
      }
      if (shield) {
        equipped.push({ equipmentId: shield.id, slot: 'left_hand', ready: true });
      }

      return {
        playerId,
        characterId: character.id,
        position,
        facing,
        posture: 'standing' as const,
        maneuver: null,
        aoaVariant: null,
        aodVariant: null,
        currentHP: character.derived.hitPoints,
        currentFP: character.derived.fatiguePoints,
        statusEffects: [],
        aimTurns: 0,
        aimTargetId: null,
        evaluateBonus: 0,
        evaluateTargetId: null,
        equipped,
        inCloseCombatWith: null,
        closeCombatPosition: null,
        grapple: { grappledBy: null, grappling: null, cpSpent: 0, cpReceived: 0 },
        usedReaction: false,
        shockPenalty: 0,
        attacksRemaining: 3,  // PF2 has 3 actions
        retreatedThisTurn: false,
        defensesThisTurn: 0,
        parryWeaponsUsedThisTurn: [],
        waitTrigger: null,
        pf2: {
          actionsRemaining: 3,
          reactionAvailable: true,
          mapPenalty: 0,
          attacksThisTurn: 0,
          shieldRaised: false,
        },
      };
    };
    ```

  **Parallelizable**: YES (with task 6, 8)

  **References**:
  - `server/src/match.ts:127-137` - Current PF2 combatant branch

  **Acceptance Criteria**:
  - [ ] Factory esporta `createCombatant`
  - [ ] Include `pf2` state object
  - [ ] `attacksRemaining: 3`

  **Commit**: NO (raggruppa)

---

- [x] 8. Create PF2 Bot Attack Executor

  **What to do**:
  - Create `server/src/rulesets/pf2/bot.ts`:
  - Move `executePF2BotAttack` function from `server/src/bot.ts:92-226`
  - Export as `executeBotAttack: BotAttackExecutor`

  **Parallelizable**: YES (with task 6, 7)

  **References**:
  - `server/src/bot.ts:92-226` - `executePF2BotAttack` function

  **Acceptance Criteria**:
  - [ ] Factory esporta `executeBotAttack`
  - [ ] Uses PF2 adapter functions

  **Commit**: NO (raggruppa)

---

- [x] 9. Create PF2 Bundle Index

  **What to do**:
  - Create `server/src/rulesets/pf2/index.ts`:
    ```typescript
    import { createDefaultCharacter } from './character';
    import { createCombatant } from './combatant';
    import { executeBotAttack } from './bot';
    import type { RulesetServerFactory } from '../types';

    export const pf2ServerFactory: RulesetServerFactory = {
      createDefaultCharacter,
      createCombatant,
      executeBotAttack,
    };
    ```

  **Parallelizable**: NO (depends on 6-8)

  **References**:
  - `shared/rulesets/pf2/index.ts` - Pattern da seguire

  **Acceptance Criteria**:
  - [ ] Esporta `pf2ServerFactory`
  - [ ] Build passa

  **Commit**: YES
  - Message: `refactor(server): extract PF2 server factories to dedicated directory`
  - Files: `server/src/rulesets/pf2/*`

---

- [x] 10. Create Registry Index

  **What to do**:
  - Create `server/src/rulesets/index.ts`:
    ```typescript
    import type { RulesetId } from "../../../shared/types";
    import type { RulesetServerFactory } from "./types";
    import { gurpsServerFactory } from "./gurps";
    import { pf2ServerFactory } from "./pf2";

    const factories: Record<RulesetId, RulesetServerFactory> = {
      gurps: gurpsServerFactory,
      pf2: pf2ServerFactory,
    };

    export const getRulesetServerFactory = (rulesetId: RulesetId): RulesetServerFactory => {
      return factories[rulesetId] ?? factories.gurps;
    };

    export type { RulesetServerFactory } from "./types";
    ```

  **Parallelizable**: NO (depends on 5, 9)

  **References**:
  - `shared/rulesets/index.ts` - Pattern da seguire per registry

  **Acceptance Criteria**:
  - [ ] Esporta `getRulesetServerFactory`
  - [ ] Default a GURPS se rulesetId non riconosciuto
  - [ ] Build passa

  **Commit**: NO (raggruppa con 11-12)

---

- [x] 11. Refactor match.ts to Use Registry

  **What to do**:
  - Import `getRulesetServerFactory` from `./rulesets`
  - Replace character creation:
    ```typescript
    // BEFORE
    const isPF2 = rulesetId === 'pf2';
    character = { ... damage: isPF2 ? "1d6" : "1d+1" ... };

    // AFTER
    const factory = getRulesetServerFactory(rulesetId ?? 'gurps');
    character = factory.createDefaultCharacter(user.username);
    ```
  - Replace combatant creation:
    ```typescript
    // BEFORE
    const baseCombatant = { ... };
    if (rulesetId === 'pf2') { return { ...baseCombatant, pf2: {...} }; }
    return baseCombatant;

    // AFTER
    return factory.createCombatant(character, player.id, position, facing);
    ```

  **Parallelizable**: NO (depends on 10)

  **References**:
  - `server/src/match.ts` - File da refactorare

  **Acceptance Criteria**:
  - [ ] Zero `if (rulesetId === 'pf2')` nel file
  - [ ] Zero `isPF2` nel file
  - [ ] Build passa
  - [ ] Match creation funziona per entrambi i ruleset

  **Commit**: NO (raggruppa con 12)

---

- [x] 12. Refactor bot.ts to Use Registry

  **What to do**:
  - Import `getRulesetServerFactory` from `./rulesets`
  - Remove `executePF2BotAttack` function (moved to `rulesets/pf2/bot.ts`)
  - Simplify `createBotCharacter`:
    ```typescript
    export const createBotCharacter = (name: string, rulesetId: RulesetId = 'gurps'): CharacterSheet => {
      const factory = getRulesetServerFactory(rulesetId);
      return factory.createDefaultCharacter(name);
    };
    ```
  - Simplify attack dispatch in `scheduleBotTurn`:
    ```typescript
    // BEFORE
    if (currentMatch.rulesetId === 'pf2') {
      let updated = await executePF2BotAttack(...);
      ...
    }
    // GURPS attack code...

    // AFTER
    const factory = getRulesetServerFactory(currentMatch.rulesetId);
    let updated = await factory.executeBotAttack(matchId, currentMatch, botCombatant, target, activePlayer);
    updated = checkVictory(updated);
    ...
    ```

  **Parallelizable**: NO (depends on 10)

  **References**:
  - `server/src/bot.ts` - File da refactorare

  **Acceptance Criteria**:
  - [ ] Zero `if (currentMatch.rulesetId === 'pf2')` nel file
  - [ ] `executePF2BotAttack` rimosso (ora in `rulesets/pf2/bot.ts`)
  - [ ] Build passa
  - [ ] Bot funziona per entrambi i ruleset

  **Commit**: YES
  - Message: `refactor(server): use ruleset registry in match.ts and bot.ts`
  - Files: `server/src/rulesets/index.ts`, `server/src/match.ts`, `server/src/bot.ts`

---

## Task Flow

```
Task 1 (types.ts)
    ↓
Task 2, 3, 4 (GURPS factories) [parallel]
    ↓
Task 5 (GURPS index)
    ↓
Task 6, 7, 8 (PF2 factories) [parallel]
    ↓
Task 9 (PF2 index)
    ↓
Task 10 (registry index)
    ↓
Task 11, 12 (refactor match.ts, bot.ts) [sequential]
```

---

## Commit Strategy

| After Task | Message | Files |
|------------|---------|-------|
| 5 | `refactor(server): extract GURPS server factories` | `rulesets/types.ts`, `rulesets/gurps/*` |
| 9 | `refactor(server): extract PF2 server factories` | `rulesets/pf2/*` |
| 12 | `refactor(server): use ruleset registry in match.ts and bot.ts` | `rulesets/index.ts`, `match.ts`, `bot.ts` |

---

## Success Criteria

### Verification Commands
```bash
npm run build --prefix server  # Should pass
npx vitest run                 # Should pass (249 tests)
```

### Final Checklist
- [x] Zero `if (rulesetId === 'pf2')` in `match.ts`
- [x] Zero `if (currentMatch.rulesetId === 'pf2')` in `bot.ts`
- [x] Directory structure: `server/src/rulesets/{gurps,pf2}/`
- [x] Registry function: `getRulesetServerFactory(rulesetId)`
- [x] All tests pass
- [x] Server builds successfully
