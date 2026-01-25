# Manual QA Required - Browser Testing

## Status
All automated tasks complete. Manual browser testing required to verify:

### Task 6.2: Manual GURPS Playthrough
**Objective**: Verify no regressions in GURPS gameplay

**Steps**:
1. Start dev servers:
   ```bash
   npm run dev &
   npm run dev --prefix server
   ```
2. Open browser to `localhost:5173`
3. Create a GURPS match
4. Test core gameplay:
   - Movement (select maneuver, move, confirm)
   - Combat (attack, defense, damage)
   - Posture changes (stand, crouch, prone)
   - Close combat (grapple, etc.)
   - Turn advancement
5. Verify no visual bugs or errors in console

**Expected**: All GURPS features work exactly as before migration

### Task 6.3: Manual PF2 Playthrough
**Objective**: Verify PF2 features work correctly

**Steps**:
1. Create a PF2 match
2. Test new actions:
   - **Step**: Click Step button → verify only 8 adjacent hexes highlighted → click hex → verify movement
   - **Drop Prone**: Click Drop Prone → verify posture changes, button disabled when 0 actions
   - **Stand**: When prone, click Stand → verify posture changes, 1 action consumed
   - **Flat-footed**: Attack prone target → verify AC is reduced by 2
3. Test action economy:
   - Verify 3 actions per turn (●●●)
   - Verify MAP tracking (-0/-5/-10)
   - Verify action consumption
4. Verify no errors in console

**Expected**: All PF2 features work as designed

## Why Manual QA Cannot Be Automated
- Visual verification (hex highlighting, button states)
- User interaction flows (click sequences)
- Browser-specific rendering
- WebSocket real-time updates
- 3D scene rendering (Three.js)

## Completion Criteria
- [ ] GURPS match played through without issues
- [ ] PF2 match played through with all new actions working
- [ ] No console errors
- [ ] No visual regressions

## Notes
This is the final validation step before the migration can be considered production-ready.
