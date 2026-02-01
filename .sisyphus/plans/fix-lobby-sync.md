# Piano di Lavoro: Fix Sincronizzazione Lobby e Persistenza

## TL;DR
Correzione dei bug critici di sincronizzazione che causano giocatori "invisibili" nelle lobby:
1. Fix sincronizzazione iniziale lobby (nuovo joiner non vede membri esistenti)
2. Implementazione grace period per disconnessioni (evita rimozione immediata su refresh)
3. Fix duplicati nella lista match
4. Miglioramento UX con stato "syncing"

## Stato Attuale dei Bug

### Bug 1: Sincronizzazione Lobby Rotta
**File**: `server/src/handlers.ts:248-268`
- Quando un giocatore joina, riceve `match_created` con summary
- MA il summary potrebbe non includere tutti i membri attuali
- Il nuovo joiner non riceve `player_joined` per i membri già presenti

### Bug 2: Race Condition Disconnessione
**File**: `server/src/index.ts:51-70`
- Disconnessione = rimozione immediata dalla lobby
- Refresh rapido = rimozione + rejoin = stato inconsistente

### Bug 3: Duplicati My Matches
**File**: `src/hooks/useMatches.ts:51-56`
- Ogni `match_created` aggiunge il match alla lista
- Rejoin = match duplicato nella UI

---

## TODOs

### Task 1: Fix Sincronizzazione Iniziale Lobby
**File**: `server/src/handlers.ts`

- [x] 1.1 Modificare `join_match` per inviare `player_joined` al nuovo joiner per ogni membro esistente
  - **Linee**: 248-268
  - **Modifica**: Dopo `addMatchMember`, inviare `player_joined` per ogni membro esistente (tranne se stesso)
  - **Codice da aggiungere**:
    ```typescript
    // Invia player_joined per ogni membro esistente al nuovo joiner
    for (const member of members) {
      if (member.user_id !== user.id) {
        const existingUser = state.users.get(member.user_id);
        if (existingUser) {
          sendMessage(socket, { 
            type: "player_joined", 
            matchId: matchRow.id, 
            player: { 
              id: existingUser.id, 
              name: existingUser.username, 
              isBot: existingUser.isBot,
              characterId: member.character_id ?? ""
            } 
          });
        }
      }
    }
    ```

**Acceptance Criteria**:
- [x] Test E2E: Giocatore B joina lobby di A → B vede A nella lista
- [x] Test E2E: Giocatore C joina dopo → C vede sia A che B

---

### Task 2: Implementare Grace Period Disconnessione
**File**: `server/src/index.ts`, `server/src/state.ts`

- [x] 2.1 Aggiungere Map per tracciare disconnessioni in corso in `state.ts`
  - **Aggiungere**: `pendingDisconnections = new Map<string, NodeJS.Timeout>()`
  - **Chiave**: `matchId:userId`

- [x] 2.2 Modificare `socket.on('close')` in `index.ts`
  - **Linee**: 43-92
  - **Logica**: Se match è 'waiting', avviare timer di 3 secondi invece di rimuovere immediatamente
  - **Codice**:
    ```typescript
    if (matchRow.status === 'waiting') {
      const key = `${matchRow.id}:${connState.userId}`;
      // Cancella timer esistente se c'è
      const existingTimer = state.pendingDisconnections.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      // Avvia nuovo timer
      const timer = setTimeout(async () => {
        // Rimuovi solo se non si è riconnesso
        const userSockets = state.getUserSockets(connState.userId);
        if (userSockets.size === 0) {
          // ... rimozione effettiva ...
        }
        state.pendingDisconnections.delete(key);
      }, 3000);
      state.pendingDisconnections.set(key, timer);
    }
    ```

- [x] 2.3 Aggiungere cleanup del timer in `rejoin_match`
  - Se il giocatore fa rejoin entro 3 secondi, cancellare il timer pending

**Acceptance Criteria**:
- [x] Test E2E: Giocatore fa refresh → non viene rimosso dalla lobby
- [x] Test E2E: Giocatore chiude tab per 5+ secondi → viene rimosso

---

### Task 3: Fix Duplicati My Matches
**File**: `src/hooks/useMatches.ts`

- [x] 3.1 Modificare handler `match_created`
  - **Linee**: 51-56
  - **Fix**: Verificare se match esiste già prima di aggiungere
  - **Codice**:
    ```typescript
    case 'match_created':
      setMyMatches(prev => {
        const exists = prev.some(m => m.id === message.match.id);
        if (exists) {
          return prev.map(m => m.id === message.match.id ? message.match : m);
        }
        return [message.match, ...prev];
      });
      // ... resto del codice ...
    ```

**Acceptance Criteria**:
- [x] Test manuale: Rejoin match → non appare duplicato nella lista

---

### Task 4: Miglioramento UX - Stato "Syncing"
**File**: `src/hooks/useMatches.ts`, `src/components/MatchList.tsx` (o componente appropriato)

- [x] 4.1 Aggiungere stato `isSyncing` in `useMatches.ts`
  - **Aggiungere**: `const [isSyncing, setIsSyncing] = useState(false)`
  
- [x] 4.2 Impostare `isSyncing = true` quando si joina una lobby
  - **In**: `match_joined` handler
  
- [x] 4.3 Impostare `isSyncing = false` quando arriva lista completa
  - **In**: Dopo aver ricevuto tutti i `player_joined` o quando arriva `match_state`

- [x] 4.4 Mostrare indicatore visivo nella UI
  - **Componente**: Lista lobby/match
  - **UI**: Spinner o testo "Sincronizzazione..." quando `isSyncing === true`

**Acceptance Criteria**:
- [x] Manuale: Join lobby → si vede indicatore "Sincronizzazione..." → poi lista aggiornata

---

### Task 5: Fix Rejoin Match Waiting
**File**: `server/src/handlers.ts`

- [x] 5.1 Migliorare `rejoin_match` per inviare stato completo
  - **Linee**: 296-342
  - **Aggiungere**: Quando match è in waiting, inviare `match_state` con lista membri aggiornata
  - **Nota**: Anche se non c'è `matchState` in memoria, creare uno stato "virtuale" con i membri

**Acceptance Criteria**:
- [x] Test E2E: Refresh durante lobby → giocatore vede tutti i membri corretti

---

### Task 6: Test E2E Aggiornati
**File**: `e2e/multiplayer-sync.spec.ts` (nuovo file)

- [x] 6.1 Creare test "lobby synchronization"
  - Giocatore A crea lobby
  - Giocatore B joina
  - Verificare che B veda A
  - Verificare che A veda B

- [x] 6.2 Creare test "refresh maintains lobby state"
  - Giocatore A e B in lobby
  - B fa refresh
  - Verificare che entrambi vedano ancora l'altro

- [x] 6.3 Creare test "no duplicate matches in list"
  - Join lobby
  - Refresh pagina
  - Verificare che il match appaia una sola volta nella lista

**Acceptance Criteria**:
- [x] Tutti i test E2E passano

---

## Esecuzione Parallela

### Wave 1 (Indipendenti)
- Task 1: Fix sincronizzazione lobby
- Task 3: Fix duplicati my matches
- Task 4: UX stato syncing

### Wave 2 (Dipende da Wave 1)
- Task 5: Fix rejoin match waiting (dipende da Task 1)

### Wave 3 (Testing)
- Task 6: Test E2E

### Wave 4 (Ottimizzazione)
- Task 2: Grace period (complesso, fare dopo)

---

## Commit Strategy

1. **Task 1**: `fix(server): sync lobby members to new joiner`
2. **Task 3**: `fix(client): prevent duplicate matches in my matches list`
3. **Task 4**: `feat(ui): add syncing state indicator for lobby`
4. **Task 5**: `fix(server): improve rejoin for waiting matches`
5. **Task 6**: `test(e2e): add lobby synchronization tests`
6. **Task 2**: `feat(server): add grace period for lobby disconnections`

---

## Testing Commands

```bash
# Run E2E tests
npx playwright test e2e/multiplayer-sync.spec.ts

# Run all E2E tests
npx playwright test

# Run server tests
npm run test --prefix server
```

---

## Definition of Done

- [x] Tutti i bug elencati sono corretti
- [x] Tutti i test E2E passano
- [x] Nessun regressione nei test esistenti
- [x] UX migliorata con feedback visivo durante sincronizzazione
