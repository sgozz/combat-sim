# Draft: PF2 Complete Implementation

## Requirements (confirmed)
- **Scope**: PF2 Completo - implementazione fedele alle regole PF2e
- **Bot AI**: Intelligente con tattica, conditions, shield, positioning
- **Test Strategy**: TDD - test prima, poi implementazione

## Current State Analysis

### WORKING
- 3-action economy (actionsRemaining, pips UI)
- Strike base (damage, degrees of success)
- Step (1 action, 1 square)
- Square grid (8-directional)
- PF2 panels exist (PF2GameActionPanel, PF2GameStatusPanel)
- Character creation (minimal template)
- Pathbuilder import

### BROKEN/PARTIAL
- MAP not correctly applied (attacksThisTurn hardcoded to 0)
- Conditions stored but never applied/removed
- GameScreen.tsx hardcoded to GURPS (ignores PF2 panels)
- Stand action returns error

### MISSING
- Stride (full movement)
- Raise Shield (+2 AC)
- Reactions (Attack of Opportunity, Shield Block)
- Defense system (no defender choice)
- Condition effects (prone penalties, flat-footed, etc.)
- Dying/Wounded/Doomed mechanics
- Hero Points
- Ranged combat
- Weapon traits (deadly, fatal, forceful)
- Critical specialization
- Grapple/Shove/Trip/Feint/Demoralize
- Flanking
- Difficult terrain
- Bot AI

## Technical Decisions
- Maintain existing architecture patterns (ruleset adapters, routers, type guards)
- TDD approach: write failing tests first
- Reuse existing UI patterns from GURPS where applicable

## Research Findings
- PF2 panels already exist but not wired to GameScreen
- Server handlers partially implemented in server/src/handlers/pf2/
- Rules engine has good foundation in shared/rulesets/pf2/rules.ts

## Open Questions
- Should we support spells/magic? (big scope increase)
- How deep on character creation? (ancestry/class/feats)
- Mobile UI (ActionBar) - PF2 specific or shared?

## Scope Boundaries
- INCLUDE: Core combat, conditions, reactions, hero points, dying, bot AI
- INCLUDE: All basic actions (stride, strike, step, raise shield, take cover, etc.)
- INCLUDE: Weapon traits and critical specialization
- INCLUDE: **Sistema spell completo** (spell slots, focus spells, spell attack/DC, cantrips)
- INCLUDE: Character import via Pathbuilder (già parzialmente implementato)
- EXCLUDE: Full character builder UI (ancestry/class/feats selection) - usa Pathbuilder
- EXCLUDE: Skills beyond combat (crafting, medicine, etc.)

## Scope Estimate
Questo è un progetto GRANDE. Stima rough:
- Phase 1 (Wire-up + Fix): 2-3 giorni
- Phase 2 (Core Actions): 3-5 giorni  
- Phase 3 (Conditions + Reactions): 3-4 giorni
- Phase 4 (Spell System): 5-7 giorni
- Phase 5 (Bot AI): 3-4 giorni
- Phase 6 (Polish + Edge Cases): 2-3 giorni
**Totale: ~3-4 settimane full-time**
