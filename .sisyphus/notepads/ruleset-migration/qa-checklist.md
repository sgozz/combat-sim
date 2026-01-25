# Manual QA Checklist for Ruleset Migration

## Status: AWAITING USER VALIDATION

All automated work is complete. The following manual browser tests are required to mark the migration as fully complete.

---

## Task 6.2: GURPS Playthrough

**How to test**:
```bash
npm run dev &
npm run dev --prefix server
# Open http://localhost:5173
```

**Test Steps**:
1. [ ] Create a new GURPS match
2. [ ] Test all maneuvers:
   - [ ] Move
   - [ ] Attack (with hit location targeting)
   - [ ] All-Out Attack (variants)
   - [ ] All-Out Defense (variants)
   - [ ] Aim
   - [ ] Evaluate
   - [ ] Ready (equipment panel)
   - [ ] Wait (trigger picker)
3. [ ] Test defense modal:
   - [ ] Dodge
   - [ ] Parry
   - [ ] Block
   - [ ] Retreat option
4. [ ] Test posture changes:
   - [ ] Standing → Kneeling
   - [ ] Kneeling → Prone
   - [ ] Prone → Standing
5. [ ] Verify combat log messages are correct
6. [ ] Check for console errors (F12)

**Expected Result**: All GURPS mechanics work exactly as before migration, with no visual or functional regressions.

---

## Task 6.3: PF2 Playthrough

**How to test**:
```bash
# Same dev servers as above
# Create PF2 match instead
```

**Test Steps**:
1. [ ] Create a new PF2 match
2. [ ] Verify square grid (not hex)
3. [ ] Test action economy:
   - [ ] 3 actions per turn
   - [ ] Action counter updates correctly
4. [ ] Test all actions:
   - [ ] Strike (attack with MAP)
   - [ ] Stride (movement)
   - [ ] Step (5-foot step)
   - [ ] Stand (from prone)
   - [ ] Drop Prone
   - [ ] Raise Shield
   - [ ] Interact
5. [ ] Test MAP (Multiple Attack Penalty):
   - [ ] First attack: no penalty
   - [ ] Second attack: -5 penalty
   - [ ] Third attack: -10 penalty
6. [ ] Test bot opponent:
   - [ ] Bot takes valid PF2 actions
   - [ ] Bot attacks work
7. [ ] Check for console errors (F12)

**Expected Result**: All PF2 actions work correctly with proper 3-action economy.

---

## How to Mark Complete

After completing both playthroughs:

1. Update `.sisyphus/plans/ruleset-migration.md`:
   - Change `- [ ] 6.2. Manual GURPS playthrough` to `- [x] 6.2. Manual GURPS playthrough`
   - Change `- [ ] 6.3. Manual PF2 playthrough` to `- [x] 6.3. Manual PF2 playthrough`

2. Update Definition of Done:
   - Change `- [ ] Match GURPS giocabile end-to-end` to `- [x] Match GURPS giocabile end-to-end`
   - Change `- [ ] Match PF2 giocabile end-to-end` to `- [x] Match PF2 giocabile end-to-end`

3. Update Final Checklist:
   - Change `- [ ] GURPS gameplay unchanged` to `- [x] GURPS gameplay unchanged`
   - Change `- [ ] PF2 gameplay improved` to `- [x] PF2 gameplay improved`

---

## Current Automated Status

✅ **All automated work complete**:
- 249/249 tests passing
- Build succeeds with no errors
- Type system refactored
- Components relocated
- Attack handler decoupled
- PF2 features implemented
- Documentation updated

**Only manual browser validation remains.**
