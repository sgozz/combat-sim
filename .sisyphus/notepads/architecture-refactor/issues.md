# Issues - Architecture Refactor

## Known Issues
- None yet - starting fresh

## Gotchas
- Tests may need minor updates when adding rulesetId (356 test baseline)
- Runtime behavior must NOT change (type-only refactor)

## RESOLVED: Server Build Blocker - Template Names Import

### Problem
UI adapters (`shared/rulesets/gurps/ui.ts`, `shared/rulesets/pf2/ui.ts`) imported template names from client-only paths (`../../../src/data/characterTemplates`), causing server Docker build to fail with "Could not resolve" errors.

### Solution Applied
1. Created `shared/rulesets/gurps/templateNames.ts` with GURPS template names array
2. Created `shared/rulesets/pf2/templateNames.ts` with PF2 template names array
3. Updated UI adapters to import from local `./templateNames` instead of client paths
4. Updated client files to re-export from shared (maintains backward compatibility)

### Pattern
```
shared/rulesets/{ruleset}/templateNames.ts
  ↑ (import)
shared/rulesets/{ruleset}/ui.ts
  ↑ (re-export)
src/data/{ruleset}CharacterTemplates.ts
```

### Verification
- ✅ Server build: `cd server && npm run build` → success
- ✅ Client build: `npm run build` → success  
- ✅ Tests: `npx vitest run` → 356 tests pass
- ✅ Commit: `fix(build): move template names to shared for server compatibility`

### Key Learning
Template names are pure data (arrays of strings) that should live in shared/ when used by both client and server. Only template objects (with full character data) stay in client src/data/.
