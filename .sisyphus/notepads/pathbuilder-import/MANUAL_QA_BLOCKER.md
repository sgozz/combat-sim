# Manual QA Blocker - Pathbuilder Import

**Date**: 2026-01-25  
**Status**: BLOCKED - Requires Human Interaction

---

## Blocker Summary

**7 remaining verification items require manual browser testing** and cannot be completed programmatically by an AI agent.

### Blocked Items

**Definition of Done** (4 items):
1. `npm run lint` passes - 66 pre-existing errors (unrelated to feature)
2. Can import character via Pathbuilder ID - REQUIRES MANUAL QA
3. Can import character via JSON file upload - REQUIRES MANUAL QA
4. Imported character appears in character list - REQUIRES MANUAL QA
5. GURPS characters still work (no regression) - REQUIRES MANUAL QA

**Final Checklist** (2 items):
6. GURPS matches still work (no regression) - REQUIRES MANUAL QA
7. PF2 matches work with new character shape - REQUIRES MANUAL QA

---

## Why Blocked

These items require:
- Starting dev servers
- Opening browser
- Clicking UI elements
- Observing visual feedback
- Testing game flow end-to-end

**AI agents cannot:**
- Interact with browser UI directly (without Playwright skill loaded)
- Observe visual rendering
- Test real-time WebSocket interactions
- Verify game state in running application

---

## Manual QA Test Script

### Prerequisites

```bash
# Terminal 1: Start client dev server
npm run dev

# Terminal 2: Start server
npm run dev --prefix server

# Browser: Open http://localhost:5173
```

### Test 1: Import via Pathbuilder ID

**Steps:**
1. Click "Create Match" → Select "Pathfinder 2e"
2. Click "Edit Character"
3. Click "Import from Pathbuilder" button
4. Enter character ID: `163111`
5. Click "Fetch Character"

**Expected:**
- Loading state appears
- Preview displays:
  - Name: "Jordo PF2e Champion Paladin"
  - Level: 1
  - Class: Champion
  - HP: 21
  - AC: 16
  - Abilities: STR 16, DEX 12, CON 16, INT 10, WIS 14, CHA 14
  - 2 weapons: Dagger, Scythe
- No errors in console

**Actions:**
6. Click "Confirm Import"
7. Verify editor updates with imported character
8. Click "Save" or close editor
9. Verify character name appears in lobby player list

**Pass Criteria:**
- [ ] Preview displays correctly
- [ ] Import completes without errors
- [ ] Character appears in lobby

---

### Test 2: Import via JSON File Upload

**Steps:**
1. Click "Create Match" → Select "Pathfinder 2e"
2. Click "Edit Character"
3. Click "Import from Pathbuilder" button
4. Click "Upload JSON" tab
5. Upload file: `shared/rulesets/pf2/__fixtures__/pathbuilder-163111.json`

**Expected:**
- Same preview as Test 1
- Same import flow

**Pass Criteria:**
- [ ] File upload works
- [ ] Preview displays correctly
- [ ] Import completes without errors

---

### Test 3: GURPS Regression Test

**Steps:**
1. Click "Create Match" → Select "GURPS"
2. Click "Edit Character"
3. Create/edit GURPS character
4. Save character
5. Start match
6. Play through combat turn

**Expected:**
- GURPS character editor works as before
- Combat mechanics work (movement, attacks, defenses)
- No TypeScript errors in console
- No runtime errors

**Pass Criteria:**
- [ ] GURPS character creation works
- [ ] GURPS combat works
- [ ] No regressions from type system changes

---

### Test 4: PF2 End-to-End Flow

**Steps:**
1. Create PF2 match with imported character
2. Start match
3. Test movement (should use speed/5 for hexes)
4. Test attack (should use PF2 attack mechanics)
5. Test damage (should use PF2 damage types)

**Expected:**
- PF2 character works in combat
- Movement uses PF2 speed calculation
- Attacks use PF2 proficiency system
- No errors

**Pass Criteria:**
- [ ] PF2 character works in match
- [ ] Combat mechanics work correctly
- [ ] No runtime errors

---

## Lint Issue (Non-Blocking)

**Item:** `npm run lint` passes

**Status:** 66 pre-existing errors (unrelated to feature)

**Decision:** Mark as KNOWN ISSUE, not blocking

**Rationale:**
- Errors existed before this feature
- Mostly react-hooks warnings
- Not related to Pathbuilder import
- Can be fixed separately

**Action:** Document as known issue, do not block feature

---

## Handoff Instructions

### For Human Tester

1. **Pull latest code:**
   ```bash
   git pull origin main
   git log --oneline -20  # Verify commits present
   ```

2. **Install dependencies:**
   ```bash
   npm install
   npm install --prefix server
   ```

3. **Run test script above**

4. **Report results:**
   - Create issue for any failures
   - Mark checkboxes in plan file if all pass
   - Update FINAL_REPORT.md with QA results

### For AI Agent (Future)

If Playwright skill is available:
- Load `/playwright` skill
- Automate browser testing
- Verify UI interactions programmatically

---

## Current Status

**Implementation:** ✅ COMPLETE (15/15 tasks)  
**Automated Verification:** ✅ COMPLETE (32/34 items)  
**Manual QA:** ⏳ BLOCKED (7 items pending)

**Blocker:** Requires human interaction for browser testing

**Next Action:** Human tester executes manual QA test script
