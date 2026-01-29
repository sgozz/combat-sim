import type { PF2CombatantState } from './types';

/**
 * AC modifier from conditions. PF2 rules:
 * - Prone: +2 AC vs ranged, -2 AC vs melee
 * - Flat-footed: -2 AC (circumstance penalty)
 */
export function getConditionACModifier(
  combatant: PF2CombatantState,
  attackType: 'melee' | 'ranged'
): number {
  let modifier = 0;

  for (const c of combatant.conditions) {
    if (c.condition === 'prone') {
      modifier += attackType === 'ranged' ? 2 : -2;
    }
    if (c.condition === 'flat_footed') {
      modifier -= 2;
    }
  }

  return modifier;
}

/**
 * Attack roll modifier from conditions. PF2 rules:
 * - Prone: -2 attack rolls
 */
export function getConditionAttackModifier(
  combatant: PF2CombatantState
): number {
  let modifier = 0;

  for (const c of combatant.conditions) {
    if (c.condition === 'prone') {
      modifier -= 2;
    }
  }

  return modifier;
}

export function hasCondition(
  combatant: PF2CombatantState,
  condition: string
): boolean {
  return combatant.conditions.some(c => c.condition === condition);
}

export function formatConditionModifiers(
  attackModifier: number,
  acModifier: number
): string {
  const parts: string[] = [];
  if (attackModifier !== 0) {
    parts.push(`attack ${attackModifier > 0 ? '+' : ''}${attackModifier}`);
  }
  if (acModifier !== 0) {
    parts.push(`AC ${acModifier > 0 ? '+' : ''}${acModifier}`);
  }
  return parts.length > 0 ? ` [conditions: ${parts.join(', ')}]` : '';
}
