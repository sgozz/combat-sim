# Movement UI/UX Improvements

## Bug da Fixare

1. **Nessun feedback quando si clicca hex non raggiungibile** - Il server risponde con errore "Troppo lontano" ma l'utente non vede niente

## Alta Priorità

| Problema | Proposta |
|----------|----------|
| **MP poco visibile** | Ingrandire "5 MP" con font bold, colore verde, magari con icona piede/scarpa |
| **Nessun feedback click invalido** | Mostrare toast/flash rosso "Troppo lontano!" quando si clicca hex non raggiungibile |
| **Istruzione ridondante** | Rimuovere "Click a hex to move" duplicato, tenere solo quello nel pannello movimento |
| **Istruzione obsoleta dopo Skip** | Aggiornare "You can step 1 hex first" → "Movement skipped" o nascondere |

## Media Priorità

| Problema | Proposta |
|----------|----------|
| **Gerarchia colori hex** | Usare gradiente più evidente: verde brillante (1-2 MP) → giallo (3-4) → arancione (5+) |
| **Costo movimento su hover** | Mostrare il costo in MP dell'hex quando ci si passa sopra (già funziona ma poco visibile) |
| **Pulsanti rotazione confusi** | Aggiungere tooltip "Ruota sx/dx (-1 MP)" o mostrare costo rotazione |
| **Mobile: pulsanti troppo piccoli** | Aumentare dimensione pulsanti Undo/Skip/Confirm su mobile |

## Bassa Priorità (Polish)

| Problema | Proposta |
|----------|----------|
| **Animazione movimento** | Aggiungere animazione quando il personaggio si muove (già presente ma veloce) |
| **Path preview** | Mostrare linea tratteggiata del percorso quando si passa sopra un hex raggiungibile |
| **Suono feedback** | Audio click per movimento valido, buzz per invalido |
| **Undo multiplo** | Permettere undo step-by-step invece di reset completo |

## Miglioramenti Specifici Mobile

| Problema | Proposta |
|----------|----------|
| **Affollamento orizzontale** | Raggruppare Facing buttons in un dropdown o modal |
| **Testo troppo piccolo** | "5 MP - Tap hex" → solo "5 MP" con icona, tooltip per dettagli |
| **Sovrapposizione header** | Ridurre padding o spostare "← Lobbies" in menu hamburger |
