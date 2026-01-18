# Tactical Combat Combat Simulator - Implementation Plan

## Overview

Piano dettagliato per implementare le modifiche UI proposte in `UI_REDESIGN_PROPOSAL.md`.
Organizzato in 4 fasi con task atomici, dipendenze, file coinvolti e stime di effort.

**Tempo totale stimato**: ~120-160 ore di sviluppo

---

## Phase 1: Core Combat Completion

**Obiettivo**: Rendere il combattimento base Tactical Combat-compliant
**Durata stimata**: 40-50 ore
**Priorità**: CRITICA

---

### 1.1 Hit Location System

**Effort**: 12-15 ore
**Dipendenze**: Nessuna

#### 1.1.1 Backend: Types & Rules

**File da modificare**:
- `shared/types.ts`
- `shared/rules.ts`

**Task**:
```
[ ] 1.1.1.1 Aggiungere HitLocation type
    File: shared/types.ts
    
    export type HitLocation = 
      | 'eye' | 'skull' | 'face' | 'neck'
      | 'torso' | 'vitals' | 'groin'
      | 'arm_right' | 'arm_left' | 'hand_right' | 'hand_left'
      | 'leg_right' | 'leg_left' | 'foot_right' | 'foot_left';

[ ] 1.1.1.2 Aggiungere hit location penalties e multipliers
    File: shared/rules.ts
    
    export const HIT_LOCATION_DATA: Record<HitLocation, {
      penalty: number;
      damageMultiplier: number;
      damageTypes?: DamageType[]; // Solo questi tipi ricevono multiplier
      cripplingThreshold?: number; // Frazione di HP per cripple
      notes: string;
    }>

[ ] 1.1.1.3 Aggiungere random hit location roll (3d6)
    File: shared/rules.ts
    
    export const rollRandomHitLocation = (random?: () => number): HitLocation

[ ] 1.1.1.4 Modificare resolveAttack per accettare hit location
    File: shared/rules.ts
    
    Aggiungere hitLocation al parametro options
    Applicare penalty al calcolo skill
    Applicare multiplier al damage

[ ] 1.1.1.5 Aggiungere test per hit location
    File: shared/rules.test.ts
    
    - Test penalty application
    - Test damage multiplier
    - Test random roll distribution
```

#### 1.1.2 Backend: Server Handler

**File da modificare**:
- `server/src/handlers.ts`
- `shared/types.ts` (message types)

**Task**:
```
[ ] 1.1.2.1 Estendere AttackPayload con hitLocation
    File: shared/types.ts
    
    type AttackActionPayload = {
      type: 'attack';
      targetId: Id;
      hitLocation?: HitLocation; // default 'torso'
    }

[ ] 1.1.2.2 Modificare handler attack per usare hit location
    File: server/src/handlers.ts
    
    - Leggere hitLocation da payload
    - Passare a resolveAttack
    - Includere nel log message
```

#### 1.1.3 Frontend: Hit Location Picker Component

**File da creare/modificare**:
- `src/components/ui/HitLocationPicker.tsx` (NEW)
- `src/components/game/GameHUD.tsx`
- `src/App.css`

**Task**:
```
[ ] 1.1.3.1 Creare HitLocationPicker component
    File: src/components/ui/HitLocationPicker.tsx (NEW)
    
    Props:
    - selectedLocation: HitLocation
    - onSelect: (location: HitLocation) => void
    - showPenalties: boolean
    
    UI: Body diagram SVG con aree cliccabili
    Ogni area mostra penalty on hover

[ ] 1.1.3.2 Aggiungere CSS per HitLocationPicker
    File: src/App.css
    
    - .hit-location-picker
    - .body-part (hover states)
    - .body-part.selected
    - .penalty-label

[ ] 1.1.3.3 Integrare in GameActionPanel
    File: src/components/game/GameHUD.tsx
    
    - Aggiungere state: selectedHitLocation
    - Mostrare picker quando canAttack && selectedTargetId
    - Passare hitLocation al payload attack

[ ] 1.1.3.4 Aggiornare attack preview con hit location penalty
    File: src/components/game/GameHUD.tsx
    
    - Mostrare penalty nel calcolo
    - Ricalcolare effective skill
```

#### 1.1.4 Frontend: Mobile Integration

**File da modificare**:
- `src/components/game/ActionBar.tsx`

**Task**:
```
[ ] 1.1.4.1 Aggiungere hit location dropdown/modal per mobile
    File: src/components/game/ActionBar.tsx
    
    - Dropdown compatto: [Torso ▼]
    - O modal con body picker semplificato
```

---

### 1.2 Defense Choice System

**Effort**: 15-18 ore
**Dipendenze**: Nessuna

#### 1.2.1 Backend: Defense Flow Refactor

**File da modificare**:
- `shared/types.ts`
- `shared/rules.ts`
- `server/src/handlers.ts`
- `server/src/match.ts`

**Task**:
```
[ ] 1.2.1.1 Aggiungere tipi per defense choice
    File: shared/types.ts
    
    export type DefenseType = 'dodge' | 'parry' | 'block' | 'none';
    
    export type DefenseChoice = {
      type: DefenseType;
      retreat: boolean;
      dodgeAndDrop: boolean;
    };
    
    export type PendingDefense = {
      attackerId: Id;
      defenderId: Id;
      attackRoll: number;
      hitLocation: HitLocation;
      weapon: string;
      timeout: number;
    };

[ ] 1.2.1.2 Aggiungere pendingDefense a MatchState
    File: shared/types.ts
    
    type MatchState = {
      // ...existing
      pendingDefense?: PendingDefense;
    }

[ ] 1.2.1.3 Modificare resolveAttack per separare hit da defense
    File: shared/rules.ts
    
    - resolveAttackRoll(): { hit: boolean, roll: number, critical: boolean }
    - resolveDefense(): { success: boolean, roll: number }
    - Separare le due fasi

[ ] 1.2.1.4 Creare nuovo message type per defense
    File: shared/types.ts
    
    type DefendActionPayload = {
      type: 'defend';
      defenseType: DefenseType;
      retreat: boolean;
      dodgeAndDrop: boolean;
    };

[ ] 1.2.1.5 Modificare attack handler per flow a due fasi
    File: server/src/handlers.ts
    
    Fase 1 (attack):
    - Roll attack
    - Se hit && non critical → set pendingDefense, broadcast
    - Se miss o critical → resolve immediatamente
    
    Fase 2 (defend):
    - Ricevi defense choice
    - Roll defense
    - Resolve damage se defense fails
    - Clear pendingDefense

[ ] 1.2.1.6 Aggiungere timeout per defense (15 sec)
    File: server/src/match.ts
    
    - Se timeout → auto-dodge
    - Timer gestito server-side
```

#### 1.2.2 Frontend: Defense Modal Component

**File da creare/modificare**:
- `src/components/ui/DefenseModal.tsx` (NEW)
- `src/components/game/GameScreen.tsx`
- `src/App.css`

**Task**:
```
[ ] 1.2.2.1 Creare DefenseModal component
    File: src/components/ui/DefenseModal.tsx (NEW)
    
    Props:
    - pendingDefense: PendingDefense
    - defenseOptions: DefenseOptions (from rules.ts)
    - onDefend: (choice: DefenseChoice) => void
    - timeRemaining: number
    
    UI:
    - Header: "⚠️ INCOMING ATTACK!"
    - Attack info (attacker, weapon, location)
    - 3 defense cards (Dodge/Parry/Block) con %
    - Checkboxes: Retreat, Dodge and Drop
    - "Don't Defend" button
    - Countdown timer

[ ] 1.2.2.2 Aggiungere CSS per DefenseModal
    File: src/App.css
    
    - .defense-modal-overlay
    - .defense-modal
    - .defense-card (hover, selected)
    - .defense-timer

[ ] 1.2.2.3 Integrare DefenseModal in GameScreen
    File: src/components/game/GameScreen.tsx
    
    - Mostrare quando matchState.pendingDefense?.defenderId === player.id
    - Gestire countdown locale
    - Chiamare onAction('defend', payload)

[ ] 1.2.2.4 Aggiungere hook per countdown
    File: src/hooks/useCountdown.ts (NEW)
    
    export const useCountdown = (seconds: number, onComplete: () => void)
```

#### 1.2.3 Frontend: Mobile Defense UI

**File da modificare**:
- `src/components/game/ActionBar.tsx`

**Task**:
```
[ ] 1.2.3.1 Aggiungere defense UI per mobile
    File: src/components/game/ActionBar.tsx
    
    - Quando pendingDefense attivo:
      - Nascondere action bar normale
      - Mostrare defense bar con 3 bottoni grandi
      - Checkbox retreat sotto
```

---

### 1.3 Retreat Option

**Effort**: 4-5 ore
**Dipendenze**: 1.2 (Defense Choice System)

**Task**:
```
[ ] 1.3.1 Aggiungere retreat bonus a defense calculation
    File: shared/rules.ts
    
    - getDefenseWithRetreat(base: number, type: DefenseType, retreat: boolean)
    - Dodge: +3, Parry/Block: +1

[ ] 1.3.2 Aggiungere hasRetreatedThisTurn a CombatantState
    File: shared/types.ts
    
    - Retreat può essere usato solo 1 volta per turno

[ ] 1.3.3 Implementare movimento retreat server-side
    File: server/src/handlers.ts
    
    - Se retreat: muovi combattente 1 hex indietro
    - Check se hex libero
    - Se bloccato: retreat non disponibile

[ ] 1.3.4 Mostrare retreat option in DefenseModal
    File: src/components/ui/DefenseModal.tsx
    
    - Checkbox abilitato solo se non già usato
    - Mostrare bonus applicato
    - Disabilitare se hex bloccato
```

---

### 1.4 Shock Penalty System

**Effort**: 4-5 ore
**Dipendenze**: Nessuna

**Task**:
```
[ ] 1.4.1 Aggiungere shockPenalty a CombatantState
    File: shared/types.ts
    
    shockPenalty: number; // 0 to -4

[ ] 1.4.2 Calcolare shock quando si riceve danno
    File: server/src/handlers.ts
    
    - shock = min(4, damage received)
    - Applicare a combatant.shockPenalty

[ ] 1.4.3 Applicare shock a attack rolls
    File: shared/rules.ts / server handler
    
    - Sottrarre shockPenalty da effective skill

[ ] 1.4.4 Pulire shock a inizio turno
    File: shared/rules.ts (advanceTurn)
    
    - Reset shockPenalty a 0

[ ] 1.4.5 Mostrare shock indicator in UI
    File: src/components/game/GameHUD.tsx
    
    - Nella status card: "⚡ Shock: -2"
    - Colore rosso/arancione

[ ] 1.4.6 Mostrare shock in attack preview
    File: src/components/game/GameHUD.tsx
    
    - Includere nel calcolo effective skill
    - "Shock Penalty: -2"
```

---

### 1.5 All-Out Attack Variants

**Effort**: 6-8 ore
**Dipendenze**: Nessuna

#### 1.5.1 Backend

**Task**:
```
[ ] 1.5.1.1 Aggiungere AOA variant type
    File: shared/types.ts
    
    export type AOAVariant = 'determined' | 'strong' | 'double' | 'feint';
    
    // Modificare select_maneuver payload
    type SelectManeuverPayload = {
      type: 'select_maneuver';
      maneuver: ManeuverType;
      variant?: AOAVariant | AODVariant;
    }

[ ] 1.5.1.2 Aggiungere selectedVariant a CombatantState
    File: shared/types.ts
    
    aoaVariant?: AOAVariant;
    aodVariant?: AODVariant;

[ ] 1.5.1.3 Implementare variant effects
    File: server/src/handlers.ts
    
    - Determined: +4 to hit
    - Strong: +2 damage (o +1 per die)
    - Double: permetti secondo attacco
    - Feint: TODO (richiede feint system)

[ ] 1.5.1.4 Gestire Double attack
    File: server/src/handlers.ts
    
    - Tracciare attacksThisTurn
    - Permettere 2 attacchi se AOA Double
```

#### 1.5.2 Frontend

**Task**:
```
[ ] 1.5.2.1 Creare AOAVariantPicker component
    File: src/components/ui/VariantPicker.tsx (NEW)
    
    - 4 radio buttons con descrizioni
    - Mostrare effect preview

[ ] 1.5.2.2 Integrare variant picker nel maneuver flow
    File: src/components/game/GameHUD.tsx
    
    - Quando click su All-Out Attack:
      - Mostrare variant picker invece di selezionare subito
    - Dopo selezione variant: inviare maneuver + variant

[ ] 1.5.2.3 Mostrare variant attivo nel banner
    File: src/components/game/GameHUD.tsx
    
    - "😡 All-Out Attack (Determined +4)"

[ ] 1.5.2.4 Mobile: variant picker
    File: src/components/game/ActionBar.tsx
    
    - Overlay con variant buttons
```

---

## Phase 2: Tactical Depth

**Obiettivo**: Aggiungere opzioni tattiche avanzate
**Durata stimata**: 35-45 ore
**Priorità**: ALTA

---

### 2.1 All-Out Defense Variants

**Effort**: 5-6 ore
**Dipendenze**: 1.2 (Defense Choice System)

**Task**:
```
[ ] 2.1.1 Aggiungere AOD variant type
    File: shared/types.ts
    
    export type AODVariant = 'dodge' | 'parry' | 'block' | 'double';

[ ] 2.1.2 Implementare variant effects
    File: server/src/handlers.ts
    
    - Increased Dodge/Parry/Block: +2 a quella difesa
    - Double Defense: può usare 2 difese diverse vs stesso attacco

[ ] 2.1.3 Creare AODVariantPicker
    File: src/components/ui/VariantPicker.tsx
    
    - Riutilizzare struttura di AOAVariantPicker

[ ] 2.1.4 Modificare DefenseModal per Double Defense
    File: src/components/ui/DefenseModal.tsx
    
    - Se AOD Double: permettere selezione di 2 difese
    - Prima difesa fallita → tenta seconda
```

---

### 2.2 Evaluate Maneuver

**Effort**: 6-8 ore
**Dipendenze**: Nessuna

**Task**:
```
[ ] 2.2.1 Aggiungere 'evaluate' a ManeuverType
    File: shared/types.ts

[ ] 2.2.2 Aggiungere evaluate tracking a CombatantState
    File: shared/types.ts
    
    evaluateBonus: number;      // 0-3
    evaluateTargetId: Id | null;

[ ] 2.2.3 Implementare evaluate logic
    File: server/src/handlers.ts
    
    - Quando select evaluate:
      - Richiedere target selection
      - Incrementare bonus (max +3) se stesso target
      - Reset se target diverso

[ ] 2.2.4 Applicare evaluate bonus ad attack
    File: server/src/handlers.ts
    
    - Se attacking evaluateTargetId: +evaluateBonus
    - Reset bonus dopo attack

[ ] 2.2.5 Aggiungere maneuver button
    File: src/components/game/GameHUD.tsx
    
    - 🔍 Evaluate button
    - Keyboard shortcut [8]

[ ] 2.2.6 Mostrare evaluate status
    File: src/components/game/GameHUD.tsx
    
    - Status effect tag: "🔍 Eval +2 vs Orc"

[ ] 2.2.7 Mostrare in attack preview
    File: src/components/game/GameHUD.tsx
    
    - "Evaluate Bonus: +2"
```

---

### 2.3 Ready Maneuver

**Effort**: 8-10 ore
**Dipendenze**: Nessuna

#### 2.3.1 Backend: Equipment Ready State

**Task**:
```
[ ] 2.3.1.1 Aggiungere ready state a equipment
    File: shared/types.ts
    
    type EquippedItem = {
      equipmentId: Id;
      slot: 'right_hand' | 'left_hand' | 'back' | 'belt';
      ready: boolean;
    }
    
    // In CombatantState:
    equipped: EquippedItem[];

[ ] 2.3.1.2 Aggiungere 'ready' a ManeuverType
    File: shared/types.ts

[ ] 2.3.1.3 Creare ReadyActionPayload
    File: shared/types.ts
    
    type ReadyActionPayload = {
      type: 'ready';
      action: 'draw' | 'sheathe' | 'pickup' | 'reload';
      itemId: Id;
      targetSlot?: 'right_hand' | 'left_hand';
    }

[ ] 2.3.1.4 Implementare ready handler
    File: server/src/handlers.ts
    
    - draw: muovi item da slot a mano, set ready=true
    - sheathe: muovi item da mano a slot, set ready=false
    - pickup: aggiungi item da ground
    - reload: per armi ranged
```

#### 2.3.2 Frontend: Ready Panel

**Task**:
```
[ ] 2.3.2.1 Creare ReadyPanel component
    File: src/components/ui/ReadyPanel.tsx (NEW)
    
    - Lista weapons disponibili con stato
    - Azioni disponibili per ogni item
    - Preview effetto

[ ] 2.3.2.2 Integrare in GameHUD
    File: src/components/game/GameHUD.tsx
    
    - Mostrare ReadyPanel quando maneuver === 'ready'

[ ] 2.3.2.3 Mostrare equipment status nel left panel
    File: src/components/game/GameHUD.tsx
    
    - Lista equipped items con [Ready] / [Unready] badge
```

---

### 2.4 Posture System

**Effort**: 8-10 ore
**Dipendenze**: Nessuna

**Task**:
```
[ ] 2.4.1 Utilizzare posture esistente in CombatantState
    File: shared/types.ts (già esiste Posture type)

[ ] 2.4.2 Aggiungere 'change_posture' a ManeuverType
    File: shared/types.ts

[ ] 2.4.3 Implementare posture change rules
    File: shared/rules.ts
    
    - getValidPostureChanges(current: Posture): Posture[]
    - Alcune transizioni sono free (standing → crouching)
    - Altre richiedono maneuver

[ ] 2.4.4 Applicare posture modifiers
    File: shared/rules.ts
    
    - Già esistono getPostureModifiers()
    - Applicare a attack e defense

[ ] 2.4.5 Creare PostureControls component
    File: src/components/ui/PostureControls.tsx (NEW)
    
    - Bottoni per ogni posture
    - Indicatore posture corrente
    - Mostrare se free o richiede maneuver

[ ] 2.4.6 Integrare posture nel left panel
    File: src/components/game/GameHUD.tsx
    
    - Sezione POSTURE con controlli
    - Mostrare Move/Dodge correnti
```

---

### 2.5 Deceptive Attack

**Effort**: 4-5 ore
**Dipendenze**: 1.1 (Hit Location per UI position)

**Task**:
```
[ ] 2.5.1 Aggiungere deceptiveLevel ad AttackPayload
    File: shared/types.ts
    
    deceptiveLevel: 0 | 1 | 2; // -2/-4 to hit, -1/-2 enemy defense

[ ] 2.5.2 Applicare deceptive penalty ad attack
    File: server/src/handlers.ts
    
    - Skill penalty: deceptiveLevel * 2

[ ] 2.5.3 Applicare deceptive penalty a defense
    File: server/src/handlers.ts
    
    - Defense penalty: deceptiveLevel

[ ] 2.5.4 Aggiungere slider in Attack Options
    File: src/components/game/GameHUD.tsx
    
    - Slider 0-2
    - Mostrare trade-off: "-2 hit = -1 enemy defense"

[ ] 2.5.5 Aggiornare attack preview
    File: src/components/game/GameHUD.tsx
    
    - Mostrare deceptive penalty nel calcolo
```

---

## Phase 3: Advanced Features

**Obiettivo**: Feature avanzate per simulatore completo
**Durata stimata**: 30-35 ore
**Priorità**: MEDIA

---

### 3.1 Wait Maneuver

**Effort**: 10-12 ore
**Dipendenze**: Nessuna

**Task**:
```
[ ] 3.1.1 Aggiungere 'wait' a ManeuverType
    File: shared/types.ts

[ ] 3.1.2 Definire WaitTrigger type
    File: shared/types.ts
    
    type WaitTrigger = {
      condition: 'enemy_enters_arc' | 'enemy_attacks' | 'enemy_moves';
      targetId?: Id;
      arc?: 'front' | 'side' | 'rear';
      action: 'attack' | 'move' | 'other';
    }

[ ] 3.1.3 Aggiungere waitTrigger a CombatantState
    File: shared/types.ts

[ ] 3.1.4 Creare WaitTriggerPayload
    File: shared/types.ts

[ ] 3.1.5 Implementare wait handler
    File: server/src/handlers.ts
    
    - Set waitTrigger su combatant
    - End turn

[ ] 3.1.6 Implementare trigger checking
    File: server/src/handlers.ts
    
    - Check triggers quando enemy agisce
    - Se triggered: interrompi, esegui wait action

[ ] 3.1.7 Creare WaitTriggerPicker component
    File: src/components/ui/WaitTriggerPicker.tsx (NEW)
    
    - Dropdown condition
    - Target selector (optional)
    - Arc selector (if enemy_enters_arc)
    - Action selector
```

---

### 3.2 Multiple Defenses Penalty

**Effort**: 3-4 ore
**Dipendenze**: 1.2 (Defense Choice System)

**Task**:
```
[ ] 3.2.1 Aggiungere defensesUsedThisTurn a CombatantState
    File: shared/types.ts

[ ] 3.2.2 Applicare penalty cumulativo
    File: shared/rules.ts / server handler
    
    - Ogni difesa dopo la prima: -1
    - Parry con stessa arma: -4 invece di -1

[ ] 3.2.3 Mostrare penalty in DefenseModal
    File: src/components/ui/DefenseModal.tsx
    
    - "⚠️ This is your 2nd defense (-1)"
    - Aggiornare % mostrate
```

---

### 3.3 Encumbrance System

**Effort**: 6-8 ore
**Dipendenze**: 2.3 (Ready Maneuver per equipment tracking)

**Task**:
```
[ ] 3.3.1 Calcolare peso totale equipment
    File: shared/rules.ts
    
    - Somma weights da equipped items
    - Calculate encumbrance level (0-4)

[ ] 3.3.2 Aggiungere encumbrance a CombatantState
    File: shared/types.ts
    
    encumbranceLevel: 0 | 1 | 2 | 3 | 4;

[ ] 3.3.3 Applicare encumbrance penalties
    File: shared/rules.ts
    
    - Move multiplier
    - Dodge penalty

[ ] 3.3.4 Mostrare encumbrance in UI
    File: src/components/game/GameHUD.tsx
    
    - "Enc: Light (-1 Move, -1 Dodge)"
```

---

### 3.4 Weapon Ready State Tracking

**Effort**: 4-5 ore
**Dipendenze**: 2.3 (Ready Maneuver)

**Task**:
```
[ ] 3.4.1 Validare weapon ready per attack
    File: server/src/handlers.ts
    
    - Non permettere attack se weapon non ready

[ ] 3.4.2 Mostrare ready state in equipment list
    File: src/components/game/GameHUD.tsx
    
    - Badge [Ready] verde / [Unready] grigio

[ ] 3.4.3 Quick action per switch weapon
    File: src/components/game/GameHUD.tsx
    
    - Se hai Fast-Draw: tenta roll
    - Altrimenti: richiede Ready maneuver
```

---

### 3.5 Change Posture Maneuver

**Effort**: 3-4 ore
**Dipendenze**: 2.4 (Posture System)

**Task**:
```
[ ] 3.5.1 Distinguere free vs maneuver posture changes
    File: server/src/handlers.ts
    
    - Standing → Crouching: free action
    - Altri: richiedono Change Posture maneuver

[ ] 3.5.2 Aggiungere Change Posture al maneuver grid
    File: src/components/game/GameHUD.tsx
    
    - 🧎 button
    - Mostrare solo se ha senso (non già in piedi senza altre opzioni)

[ ] 3.5.3 Creare PostureChangePicker
    File: src/components/ui/PostureChangePicker.tsx (NEW)
    
    - Lista posture raggiungibili
    - Effetti di ogni posture
```

---

## Phase 4: Polish

**Obiettivo**: Feature di rifinitura e future
**Durata stimata**: 15-25 ore
**Priorità**: BASSA

---

### 4.1 Concentrate Maneuver (Magic Prep)

**Effort**: 4-5 ore

**Task**:
```
[ ] 4.1.1 Aggiungere 'concentrate' a ManeuverType
[ ] 4.1.2 Tracking concentrazione per spell casting
[ ] 4.1.3 UI placeholder per future magic system
```

---

### 4.2 Rapid Strike

**Effort**: 4-5 ore

**Task**:
```
[ ] 4.2.1 Aggiungere rapidStrike flag ad AttackPayload
[ ] 4.2.2 Applicare -6 per ogni attacco
[ ] 4.2.3 Permettere 2 attacchi con Attack maneuver
[ ] 4.2.4 Checkbox in Attack Options UI
```

---

### 4.3 Critical Hit/Miss Tables

**Effort**: 4-5 ore

**Task**:
```
[ ] 4.3.1 Creare critical hit table
[ ] 4.3.2 Creare critical miss table
[ ] 4.3.3 Applicare effetti speciali
[ ] 4.3.4 Mostrare risultato in combat log
```

---

### 4.4 Major Wound Effects

**Effort**: 3-4 ore

**Task**:
```
[ ] 4.4.1 Detect major wound (damage > HP/2)
[ ] 4.4.2 Richiedere HT roll
[ ] 4.4.3 Applicare knockdown/stun se fallito
```

---

## Dependency Graph

```
                    ┌─────────────────┐
                    │   Phase 1       │
                    │   Foundation    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ 1.1 Hit       │   │ 1.2 Defense   │   │ 1.4 Shock    │
│ Location      │   │ Choice        │   │ Penalty      │
└───────┬───────┘   └───────┬───────┘   └───────────────┘
        │                   │
        │           ┌───────┴───────┐
        │           │               │
        │           ▼               ▼
        │   ┌───────────────┐ ┌───────────────┐
        │   │ 1.3 Retreat   │ │ 2.1 AOD      │
        │   └───────────────┘ │ Variants     │
        │                     └───────────────┘
        │
        │   ┌───────────────┐
        │   │ 1.5 AOA       │ (no deps)
        │   │ Variants      │
        │   └───────────────┘
        │
        ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ 2.5 Deceptive │   │ 2.2 Evaluate  │   │ 2.4 Posture  │
│ Attack        │   │ Maneuver      │   │ System       │
└───────────────┘   └───────────────┘   └───────┬───────┘
                                                │
                    ┌───────────────┐           │
                    │ 2.3 Ready     │           │
                    │ Maneuver      │           │
                    └───────┬───────┘           │
                            │                   │
        ┌───────────────────┼───────────────────┤
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ 3.3 Encum-    │   │ 3.4 Weapon    │   │ 3.5 Change   │
│ brance        │   │ Ready State   │   │ Posture      │
└───────────────┘   └───────────────┘   └───────────────┘

┌───────────────┐   ┌───────────────┐
│ 3.1 Wait      │   │ 3.2 Multiple  │
│ (independent) │   │ Defense       │
└───────────────┘   └───────────────┘
                            │
                            │ depends on 1.2
```

---

## File Change Summary

### New Files to Create

| File | Phase | Description |
|------|-------|-------------|
| `src/components/ui/HitLocationPicker.tsx` | 1.1 | Body diagram component |
| `src/components/ui/DefenseModal.tsx` | 1.2 | Defense choice modal |
| `src/hooks/useCountdown.ts` | 1.2 | Countdown timer hook |
| `src/components/ui/VariantPicker.tsx` | 1.5 | AOA/AOD variant picker |
| `src/components/ui/ReadyPanel.tsx` | 2.3 | Ready action panel |
| `src/components/ui/PostureControls.tsx` | 2.4 | Posture control buttons |
| `src/components/ui/WaitTriggerPicker.tsx` | 3.1 | Wait trigger config |
| `src/components/ui/PostureChangePicker.tsx` | 3.5 | Posture change picker |

### Files to Modify

| File | Phases | Changes |
|------|--------|---------|
| `shared/types.ts` | 1.1-3.5 | New types, extended payloads |
| `shared/rules.ts` | 1.1-3.5 | New rule functions, modifiers |
| `shared/rules.test.ts` | 1.1+ | Tests for new rules |
| `server/src/handlers.ts` | 1.1-3.5 | New handlers, flow changes |
| `server/src/match.ts` | 1.2 | Defense timeout |
| `src/components/game/GameHUD.tsx` | 1.1-3.5 | Major UI additions |
| `src/components/game/ActionBar.tsx` | 1.1-2.4 | Mobile UI updates |
| `src/components/game/GameScreen.tsx` | 1.2 | Defense modal integration |
| `src/App.css` | 1.1-3.5 | New component styles |

---

## Testing Checklist

### Per ogni feature, verificare:

```
[ ] Unit tests per nuove funzioni in rules.ts
[ ] Handler test per nuovi message types
[ ] UI component render test
[ ] Integration test: full flow client-server
[ ] Mobile responsiveness test
[ ] Keyboard shortcut test (se applicabile)
```

---

## Rollout Strategy

### Suggested Order

1. **Sprint 1** (2 settimane): 1.1 + 1.4 + 1.5
   - Hit Location + Shock + AOA Variants
   - Fondamentali per combat completo

2. **Sprint 2** (2 settimane): 1.2 + 1.3
   - Defense Choice + Retreat
   - Cambia significativamente il flow

3. **Sprint 3** (2 settimane): 2.1 + 2.2 + 2.5
   - AOD Variants + Evaluate + Deceptive
   - Opzioni tattiche

4. **Sprint 4** (2 settimane): 2.3 + 2.4
   - Ready + Posture
   - Equipment management

5. **Sprint 5** (2 settimane): 3.1 + 3.2 + 3.3 + 3.4 + 3.5
   - Wait + Multiple Def + Encumbrance + Ready State + Change Posture
   - Advanced features

6. **Sprint 6** (1 settimana): Phase 4
   - Polish features

---

## Notes

- Ogni task è atomico e può essere assegnato separatamente
- Le dipendenze sono esplicite
- Effort stimato include testing base
- Mobile UI deve essere testato dopo ogni componente desktop
- Mantenere backward compatibility con partite esistenti
