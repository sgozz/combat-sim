
## [2026-01-29 22:50] Task 4 - GURPS Wait Trigger Deferred

### Problem
Task 4 (GURPS Wait Trigger Full Interrupt System) was deferred due to architectural complexity.

### Why It's Complex
1. **Mid-Turn Interruption**: Current architecture is strict turn-based. Wait triggers require pausing an action mid-execution, running another combatant's action, then resuming.
2. **State Management**: Need to save/restore turn state when interrupting
3. **Trigger Checking**: Must insert checks at multiple points (movement, attack, etc.)
4. **Edge Cases**: Multiple simultaneous triggers, invalid waiters, trigger chains
5. **Payload Storage**: WaitTrigger type needs extension to store action payloads

### Recommendation
Break into smaller sub-tasks:
1. Extend WaitTrigger type with action payloads
2. Create checkWaitTriggers() pure function
3. Create executeWaitInterrupt() handler
4. Insert trigger checks in movement.ts
5. Insert trigger checks in attack.ts
6. Add tests for each trigger condition

OR: Assign to ultrabrain agent with full context and dedicated time.

### Impact
Low priority - Wait is a tactical option, not core mechanic. All other combat features are complete.
