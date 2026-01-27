# Problems - Architecture Refactor

## CRITICAL: Server Build Failure in Docker

### Issue
`shared/rulesets/gurps/ui.ts` and `shared/rulesets/pf2/ui.ts` import from `../../../src/data/characterTemplates` which does NOT exist in server context.

### Error
```
[ERROR] Could not resolve "../../../src/data/characterTemplates"
[ERROR] Could not resolve "../../../src/data/pf2CharacterTemplates"
```

### Root Cause
UI adapters (which are CLIENT-ONLY) are importing from client-only paths. Server build in Docker doesn't have `src/` directory.

### Impact
- Docker build fails
- Server cannot be deployed
- BLOCKING all further work

### Fix Required
Move template names to shared/ or make UI adapters not import from client paths.
