# Decisions - Architecture Refactor

## Type Discrimination Strategy
- **Decision**: Belt and suspenders (rulesetId + shape check)
- **Rationale**: Maximum robustness for future extensibility

## Action Payload Separation
- **Decision**: Separate GurpsCombatActionPayload and PF2CombatActionPayload
- **Rationale**: Remove PF2 actions from GURPS types, proper union

## Type Guards
- **Decision**: Accept `unknown` instead of specific types
- **Rationale**: Usable anywhere without prior type assertion
