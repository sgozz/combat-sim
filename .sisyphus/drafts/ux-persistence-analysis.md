# Draft: Analisi Problemi UX e Persistenza

## Data: 2026-02-01
## Progetto: Combat Simulator

---

## Problemi di Persistenza Identificati

### 1. Race Condition nella Gestione Disconnessione/Riconnessione
**File**: `server/src/index.ts:43-80`
**Problema**: Quando un socket si chiude, il server rimuove immediatamente il giocatore dalle lobby "waiting" (line 51-58). Se il giocatore si riconnette rapidamente (entro pochi ms), potrebbe trovare la lobby vuota o ricevere un errore "not a member".

**Codice problematico**:
```typescript
socket.on("close", async () => {
  // ...
  for (const matchRow of userMatches) {
    if (matchRow.status === 'waiting') {
      removeMatchMember(matchRow.id, connState.userId);  // Rimozione immediata!
      await sendToMatch(matchRow.id, { type: "player_left", ... });
    }
  }
})
```

**Impatto**: Giocatori che "scompaiono" per altri giocatori anche se si sono riconnessi.

### 2. Inconsistenza Stato Memoria vs Database
**File**: `server/src/handlers.ts:270-274`
**Problema**: Il rejoin controlla prima `state.matches` (memoria), poi cerca nel DB. Ma se il server è stato riavviato, `state.matches` potrebbe essere vuoto anche se il match esiste nel DB.

**Codice problematico**:
```typescript
let matchState = state.matches.get(matchRow.id);
if (!matchState && matchRow.state_json) {
  matchState = JSON.parse(matchRow.state_json) as MatchState;
  state.matches.set(matchRow.id, matchState);  // Caricato solo se non in memoria
}
```

**Impatto**: Giocatori che vedono stato vecchio o non vedono il match attivo.

### 3. Mancanza di Handling per Match Terminati durante Rejoin
**File**: `src/hooks/useGameSocket.ts:43-50`
**Problema**: Quando un utente si riconnette, il codice tenta di rejoinare automaticamente (`pendingRejoinRef`). Ma se il match è terminato mentre l'utente era offline, riceve solo un generico errore.

**Codice problematico**:
```typescript
if (savedMatchId && (savedScreen === 'match' || savedScreen === 'waiting')) {
  setActiveMatchId(savedMatchId)
  setScreen(savedScreen)
  pendingRejoinRef.current = savedMatchId  // No controllo se match esiste!
}
```

### 4. Sincronizzazione Multipla dello Stato Connessione
**File**: Multipli (`db.ts`, `state.ts`, `handlers.ts`)
**Problema**: Ci sono tre fonti di verità per lo stato di connessione:
- `match_members.is_connected` (DB)
- `state.userSockets` (Map in memoria)
- `matchState.players[].isConnected` (stato match)

Queste possono diventare inconsistenti, specialmente dopo un riavvio server.

---

## Problemi di UX Identificati

### 1. Stato di Caricamento Troppo Aggressivo
**File**: `src/components/game/GameScreen.tsx:154-179`
**Problema**: Il componente richiede TUTTI i dati per renderizzare i pannelli:
```typescript
const canRenderPanels = matchState && player && currentCombatant && playerCharacter
```
Se anche solo uno manca, mostra "Loading..." o "Waiting for match..." senza spiegare cosa manca.

**Impatto**: UX confusa - l'utente non sa se sta caricando, se c'è un errore, o se sta solo aspettando altri giocatori.

### 2. Nessun Feedback durante Sync Iniziale
**File**: `src/hooks/useGameSocket.ts`
**Problema**: Non c'è indicatore visivo che mostra quando i dati iniziali stanno arrivando dal server dopo il login.

**Sequenza problematica**:
1. Utente fa login
2. Socket si connette
3. `auth_ok` arriva
4. `my_matches` arriva asincronamente
5. Durante questo gap, la UI mostra schermata vuota o "matches" senza dati

### 3. Combatant Non Trovato = Schermata Vuota
**File**: `src/components/arena/ArenaScene.tsx:72-76`
**Problema**: Se `combatants.find()` non trova il giocatore (per esempio se i dati non sono sincronizzati), le variabili `playerCombatant` e `activeCombatant` sono `null`/`undefined`.

**Codice problematico**:
```typescript
const playerCombatant = combatants.find(c => c.playerId === playerId)
const playerPosition = playerCombatant?.position ?? null  // Silenziosamente null
```

Non c'è avviso o fallback - il giocatore semplicemente non appare sulla griglia.

### 4. Gestione Errori Confusa
**File**: `src/hooks/useGameSocket.ts:154-166`
**Problema**: Alcuni errori (es. "Match not found") causano pulizia automatica del localStorage, altri no. Non c'è consistenza.

### 5. Stato "In Lobby Ma Senza Match" Mal Gestito
**File**: `src/components/game/GameScreen.tsx:291-393`
**Problema**: La logica `inLobbyButNoMatch` mostra l'overlay di setup, ma non gestisce il caso in cui il match esiste nel DB ma lo stato non è ancora arrivato al client.

---

## Domande per l'Utente

1. **Quando i giocatori "non si vedono"**, è:
   - All'inizio del match (lobby)?
   - Durante il combattimento?
   - Dopo una riconnessione?
   - Dopo un refresh della pagina?

2. **Persistenza**: Qual è il comportamento atteso quando:
   - Un giocatore refresha la pagina durante un match attivo?
   - Il server si riavvia durante un match?
   - Un giocatore perde la connessione per 5-10 secondi?

3. **Priorità**: Qual è più urgente?
   - Fixare la sincronizzazione giocatori
   - Migliorare i feedback UX (loading, errori)
   - Entrambi insieme

---

## Possibili Soluzioni

### Per Persistenza:
1. Aggiungere delay prima di rimuovere giocatore da lobby waiting (grace period)
2. Implementare heartbeat/ping per rilevare disconnessioni reali vs temporanee
3. Migliorare la logica di rejoin per gestire match terminati/finiti
4. Unificare le fonti di verità per lo stato connessione

### Per UX:
1. Stati di caricamento granulari ("Caricamento match...", "Sincronizzazione giocatori...")
2. Toast/notification per errori di connessione
3. Retry automatico con backoff esponenziale
4. Fallback quando combatant non trovato (mostrare messaggio informativo)

---

## Note Tecniche

- Il sistema usa WebSocket con reconnect automatico (esponenziale backoff fino a 30s)
- Lo stato è mantenuto in SQLite con cache in-memory (`state.matches`)
- Ci sono già test E2E con Playwright che coprono scenari multi-giocatore
- La gestione dello stato è distribuita tra: React state, WebSocket messages, localStorage, SQLite
