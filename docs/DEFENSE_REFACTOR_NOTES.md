# Defense Choice System Refactor Notes

## Problem
Current attack resolution auto-selects the best defense. GURPS requires the defender to choose their defense type and whether to retreat.

## Changes Made

### Types (shared/types.ts)
- Added `DefenseType = 'dodge' | 'parry' | 'block' | 'none'`
- Added `DefenseChoice` with retreat and dodgeAndDrop options
- Added `PendingDefense` to track attack waiting for defense
- Added `pendingDefense?: PendingDefense` to MatchState
- Added `defensesThisTurn: number` to CombatantState
- Updated defend action payload with defense options

### Rules (shared/rules.ts)
- Added `resolveAttackRoll()` - just the attack roll
- Added `resolveDefenseRoll()` - just the defense roll
- Added `calculateDefenseValue()` - computes final defense with all modifiers
- Exported `isCriticalSuccess` and `isCriticalFailure`
- Updated `advanceTurn()` to reset `defensesThisTurn`

### Server Handler Flow (WIP)

**Old flow:**
1. Attack action received
2. Calculate attack skill
3. Calculate best defense automatically
4. Call resolveAttack() which does attack roll + defense roll + damage
5. Apply damage if hit
6. Advance turn

**New flow:**
1. Attack action received
2. Calculate attack skill
3. Call resolveAttackRoll() - just the attack roll
4. If miss → log, advance turn
5. If critical → apply damage immediately, advance turn
6. If hit:
   a. Check if defender can defend (not AoA, not backstab)
   b. If no → apply damage, advance turn
   c. If defender is BOT → auto-pick best defense, resolve, advance turn
   d. If defender is HUMAN → create PendingDefense, broadcast, schedule timeout

**Defense action (new):**
1. Receive defense choice from defender
2. Validate pending defense exists and matches defender
3. Calculate defense value with retreat/dodgeAndDrop bonuses
4. Call resolveDefenseRoll()
5. If defended → log, clear pending, advance turn
6. If not → apply damage, clear pending, advance turn
7. If retreat chosen → move defender 1 hex away from attacker

## Incomplete
- Bot defense auto-selection needs updating in bot.ts
- Defense timeout handler
- Frontend DefenseModal component
- Mobile defense UI
