import type {
  MatchState,
} from "../../../../shared/types";
import { isGurpsCharacter } from "../../../../shared/types";
import type { CombatantState } from "../../../../shared/rulesets";
import type { DamageType, HitLocation } from "../../../../shared/rulesets/gurps/types";
import { getServerAdapter } from "../../../../shared/rulesets/serverAdapter";
import { assertRulesetId } from "../../../../shared/rulesets/defaults";
import { hasAdvantage } from "../../../../shared/rulesets/gurps/rules";

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
  hitLocation: HitLocation,
  damageRolls: number[],
  damageModifier: number,
): ApplyDamageResult => {
  const adapter = getServerAdapter(assertRulesetId(match.rulesetId));
  const targetCombatant = match.combatants.find(c => c.playerId === targetPlayerId);
  const targetCharacter = match.characters.find(c => c.id === targetCombatant?.characterId);
  
  if (!targetCombatant || !targetCharacter) {
    return { updatedCombatants: match.combatants, finalDamage: 0, logEntry: '', fellUnconscious: false, majorWound: false, majorWoundStunned: false };
  }

  const locationDR = adapter.damage?.getLocationDR?.(targetCharacter, hitLocation) ?? 0;
  const afterDR = Math.max(0, baseDamage - locationDR);
  const baseMultDamage = adapter.damage?.applyDamageMultiplier?.(afterDR, damageType) ?? afterDR;
   const hitLocMultiplier = adapter.damage?.getHitLocationWoundingMultiplier?.(hitLocation, damageType) ?? 1;
  const finalDamage = Math.floor(baseMultDamage * hitLocMultiplier);
  
  const rolls = damageRolls.join(',');
  const mod = damageModifier !== 0 ? (damageModifier > 0 ? `+${damageModifier}` : `${damageModifier}`) : '';
  const drStr = locationDR > 0 ? ` - ${locationDR} DR` : '';
  const typeMultStr = damageType === 'cutting' ? 'x1.5' : damageType === 'impaling' ? 'x2' : '';
  const hitLocStr = hitLocMultiplier > 1 ? ` ${hitLocation} x${hitLocMultiplier}` : ` ${hitLocation}`;
  const dmgDetail = typeMultStr 
    ? `(${damageFormula}: [${rolls}]${mod} = ${baseDamage}${drStr} ${damageType} ${typeMultStr}${hitLocStr} = ${finalDamage})`
    : `(${damageFormula}: [${rolls}]${mod}${drStr} ${damageType}${hitLocStr} = ${finalDamage})`;

  const targetMaxHP = targetCharacter.derived.hitPoints;
  const targetHT = isGurpsCharacter(targetCharacter) 
    ? targetCharacter.attributes.health 
    : targetCharacter.abilities.constitution;
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
       const htCheck = adapter.damage?.rollHTCheck?.(targetHT, combatant.currentHP, targetMaxHP, undefined, targetCharacter);
       if (!htCheck?.success) {
         effects = [...effects, 'stunned'];
         majorWoundStunned = true;
       }
     }
     
     if (wasAboveZero && nowAtOrBelowZero) {
       const htCheck = adapter.damage?.rollHTCheck?.(targetHT, newHP, targetMaxHP, undefined, targetCharacter);
       if (!htCheck?.success) {
         effects = [...effects, 'unconscious'];
         fellUnconscious = true;
       }
     }
    
    const hasHighPainThreshold = isGurpsCharacter(targetCharacter) && hasAdvantage(targetCharacter, 'High Pain Threshold');
    const shockPenalty = hasHighPainThreshold ? 0 : Math.min(4, finalDamage);
    
    return { 
      ...combatant, 
      currentHP: newHP,
      statusEffects: effects,
      shockPenalty,
    };
  });

  return { updatedCombatants, finalDamage, logEntry: dmgDetail, fellUnconscious, majorWound: isMajorWound, majorWoundStunned };
};
