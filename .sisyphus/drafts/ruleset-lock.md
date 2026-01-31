# Draft: Ruleset Lock — One-Time Selection

## Requirements (confirmed)
- Ruleset scelto **al login/registrazione**, una volta sola
- Dopo la scelta, **tutta l'esperienza si adatta**: match, armeria, filtri — mono-ruleset
- **Nessuna visibilità cross-ruleset**: match list, public games, join by code — tutto filtrato per il ruleset scelto
- Cambiabile dalle impostazioni (ma non mischiabile)

## Technical Decisions
- (pending) Dove salvare il ruleset scelto? Server (DB user row) vs client (localStorage)
- (pending) Come cambiare il ruleset nelle impostazioni?

## UX Flow (confirmed)
1. Welcome Screen → username + ruleset selector → register
2. Dashboard → niente selettore ruleset
3. Create Match → niente selettore ruleset (usa quello scelto)
4. Armory → New Character → niente dropdown (crea direttamente col ruleset scelto)
5. Armory → Filtro per ruleset → RIMOSSO (tutti i pg sono dello stesso ruleset)
6. Lobby → Character Picker → filtra automaticamente (già funziona)

## UX Decisions (confirmed)
- **Welcome Screen**: dopo il nome, due card grandi illustrative (GURPS 4e / Pathfinder 2e). Click per scegliere.
- **Cambio ruleset**: bottone/badge nella navbar del dashboard (es. "GURPS" cliccabile → dialog per switchare)
- Il cambio ruleset NON cancella i personaggi dell'altro ruleset, li nasconde soltanto

## Edge Case Decisions (from Metis review)
- **Migrazione utenti**: default a GURPS + toast informativo. Nessun blocco.
- **Join cross-ruleset via codice**: PERMESSO. Il codice è un intento esplicito.
- **Switch con match attivi**: PERMESSO. Match esistenti restano visibili/giocabili. Solo nuovi match usano il nuovo ruleset.
- **Spectating cross-ruleset**: PERMESSO. Spectating è read-only, nessun impatto.
- **Welcome Screen**: tutto in una schermata (username + due card + enter)

## Open Questions
- (none remaining)

## Scope Boundaries
- INCLUDE: selezione al login, propagazione a tutti i componenti, persistenza server-side
- EXCLUDE: supporto multi-ruleset simultaneo, migrazione personaggi tra rulesets
