# Mobile UX Fixes - Issues

## Known Issues from Research

### Task 1 (Ruleset Persistence)
- Landing page allows ruleset selection but defaults to PF2 after auth
- Need localStorage bridge between pre-auth and post-auth

### Task 2 (Initiative Tracker)
- Currently purely display component, no click handlers
- Need to wire `onCombatantClick` from App.tsx

### Task 4 (Quick Create Navigation)
- CharacterEditor.tsx:49,65,69 hardcodes `navigate('/armory')`
- Need returnTo param from lobby

### Task 11 (Italian Text)
- Single hardcoded string "Sincronizzazione..." at PlayerList.tsx:33

