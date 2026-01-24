import type {
  MatchState,
  DamageType,
  CombatantState,
} from "../../../shared/types";
import { getServerAdapter } from "../../../shared/rulesets/serverAdapter";

export type ApplyDamageResult = {
  updatedCombatants: CombatantState[];
  finalDamage: number;
  logEntry: string;
  fellUnconscious: boolean;
  majorWound: boolean;
  majorWoundStunned: boolean;
};

export const formatRoll = (
  r: { target: number; roll: number; success: boolean; margin: number; dice: number[] }, 
  label: string
) => 
  `(${label} ${r.target} vs ${r.roll} [${r.dice.join(', ')}]: ${r.success ? 'Made' : 'Missed'} by ${Math.abs(r.margin)})`;

export const applyDamageToTarget = (
  match: MatchState,
  targetPlayerId: string,
  baseDamage: number,
  damageFormula: string,
  damageType: DamageType,
  hitLocation: string,
  damageRolls: number[],
  damageModifier: number,
): ApplyDamageResult => {
  const adapter = getServerAdapter(match.rulesetId ?? 'gurps');
  const targetCombatant = match.combatants.find(c => c.playerId === targetPlayerId);
  const targetCharacter = match.characters.find(c => c.id === targetCombatant?.characterId);
  
  if (!targetCombatant || !targetCharacter) {
    return { updatedCombatants: match.combatants, finalDamage: 0, logEntry: '', fellUnconscious: false, majorWound: false, majorWoundStunned: false };
  }

  const baseMultDamage = adapter.damage?.applyDamageMultiplier?.(baseDamage, damageType) ?? baseDamage;
  const hitLocMultiplier = adapter.damage?.getHitLocationWoundingMultiplier?.(hitLocation as any, damageType) ?? 1;
  const finalDamage = Math.floor(baseMultDamage * hitLocMultiplier);
  
  const rolls = damageRolls.join(',');
  const mod = damageModifier !== 0 ? (damageModifier > 0 ? `+${damageModifier}` : `${damageModifier}`) : '';
  const typeMultStr = damageType === 'cutting' ? 'x1.5' : damageType === 'impaling' ? 'x2' : '';
  const hitLocStr = hitLocMultiplier > 1 ? ` ${hitLocation} x${hitLocMultiplier}` : ` ${hitLocation}`;
  const dmgDetail = typeMultStr 
    ? `(${damageFormula}: [${rolls}]${mod} = ${baseDamage} ${damageType} ${typeMultStr}${hitLocStr} = ${finalDamage})`
    : `(${damageFormula}: [${rolls}]${mod} ${damageType}${hitLocStr} = ${finalDamage})`;

  const targetMaxHP = targetCharacter.derived.hitPoints;
  const targetHT = targetCharacter.attributes.health;
  const majorWoundThreshold = Math.floor(targetMaxHP / 2);
  const isMajorWound = finalDamage > majorWoundThreshold;
  
  let fellUnconscious = false;
  let majorWoundStunned = false;
  
  const updatedCombatants = match.combatants.map((combatant) => {
    if (combatant.playerId !== targetPlayerId) return combatant;
    const newHP = combatant.currentHP - finalDamage;
    const wasAboveZero = combatant.currentHP > 0;
    const nowAtOrBelowZero = newHP <= 0;
    
    let effects = [...combatant.statusEffects];
    
     if (isMajorWound && !effects.includes('stunned')) {
       const htCheck = adapter.damage?.rollHTCheck?.(targetHT, combatant.currentHP, targetMaxHP);
       if (!htCheck?.success) {
         effects = [...effects, 'stunned'];
         majorWoundStunned = true;
       }
     }
     
     if (wasAboveZero && nowAtOrBelowZero) {
       const htCheck = adapter.damage?.rollHTCheck?.(targetHT, newHP, targetMaxHP);
       if (!htCheck?.success) {
         effects = [...effects, 'unconscious'];
         fellUnconscious = true;
       }
     }
    
    return { 
      ...combatant, 
      currentHP: newHP,
      statusEffects: effects,
      shockPenalty: Math.min(4, finalDamage),
    };
  });

  return { updatedCombatants, finalDamage, logEntry: dmgDetail, fellUnconscious, majorWound: isMajorWound, majorWoundStunned };
};
