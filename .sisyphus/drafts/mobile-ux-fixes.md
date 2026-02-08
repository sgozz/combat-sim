# Draft: Mobile UX Fixes for GURPS Players

## Requirements (confirmed)
- Fix all 14 defects identified during mobile GURPS playtesting
- Viewport tested: 390×844 (iPhone 14)
- Full flow: homepage → lobby → character creation → combat

## Defects (from testing session)

### CRITICAL
1. Ruleset selection on landing page ignored after Enter Arena (defaults to PF2)
2. Cannot select target by tapping 3D canvas on mobile
3. No minimap on mobile — player blind to combatant positions

### SEVERE
4. Quick Create → Save navigates to Armory instead of back to lobby
5. Cancel/Create Match buttons cut off in Create Match modal
6. Three.js continuous rendering causes UI element instability

### MODERATE
7. Hit Location selector too large / hard to tap on 390px
8. No combat log accessible on mobile
9. No feedback after End Turn / bot's turn
10. Initiative tracker names not interactive (can't tap to select target)

### MINOR
11. "Sincronizzazione..." Italian debug text in lobby
12. "New Character" default name unhelpful
13. No FP (Fatigue Points) in action bar — GURPS-critical stat missing
14. Maneuver abbreviations potentially confusing, no long-press tooltip

## Technical Decisions (confirmed)
- Target selection: Tap on initiative tracker to select target
- Camera: Auto-center on player's combatant at turn start, center between player+target on selection
- Test strategy: Tests-after (unit tests for logic, Playwright QA for UI)

## Open Questions
- (none remaining)
