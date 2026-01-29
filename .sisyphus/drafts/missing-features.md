# Draft: Missing Features Plan

## Requirements (confirmed)
- User wants ALL missing features implemented (GURPS + PF2)
- Based on thorough code audit (not outdated docs)
- Outdated planning docs already removed

## Missing Features Identified (from code audit)

### GURPS
1. **Feint (AOA variant)**: Type + disabled UI button exist, no server logic
2. **Wait trigger execution**: Trigger is SET and saved but never checked/fired during other turns
3. **Armor/DR**: No damage reduction from armor anywhere in damage pipeline
4. **Concentrate maneuver**: Not in ManeuverType enum (needed for magic)
5. **Advantage effects**: High Pain Threshold etc. in templates but no mechanical hooks
6. ~~**Surrender action**~~: ALREADY IMPLEMENTED in handlers.ts:462-474 — REMOVED FROM SCOPE

### PF2
7. **Spell Effects**: Casting works (slots consumed, rolls made) but no effects applied
8. **Advanced actions**: Grapple/Trip/Disarm/Feint/Demoralize missing
9. **Dying/Wounded system**: Not implemented

## Metis Review Findings
- Surrender already works (handlers.ts catches it before ruleset router) — scope reduced to 8 features
- Wait trigger is architecturally complex (interrupt-based flow vs turn-based)
- Armor/DR needs decision: flat vs per-location
- Advantage effects need explicit list
- PF2 spell effects need bounded spell list
- Dependency order: Armor/DR before Advantages, Dying/Wounded before Spell Effects
- MUST NOT add bot AI for new features (separate concern)
- MUST NOT add new UI components unless existing are insufficient
- MUST use pure functions with injectable random
- MUST use adapter pattern (no hardcoded ruleset checks)

## Technical Decisions
- Follow existing adapter pattern for all features
- Use existing test infrastructure (vitest, 442 tests)
- Follow TDD for rules engine additions
- Server handlers follow existing router.ts pattern

## Scope Boundaries
- INCLUDE: 8 missing features (surrender removed)
- EXCLUDE: Movement UI/UX polish (separate backlog in docs/MOVEMENT_UI_IMPROVEMENTS.md)
- EXCLUDE: New rulesets (D&D 5e etc.)
- EXCLUDE: Bot AI for new features
- EXCLUDE: New UI components

## Open Questions
- Armor/DR: flat or per-location?
- Wait trigger: simplified (end-of-turn check) or full interrupt?
- Which advantages to implement?
- PF2 spell effects: which spells?
