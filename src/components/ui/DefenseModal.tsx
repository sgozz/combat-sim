import { useState, useMemo } from 'react';
import type { 
  CharacterSheet, 
  CombatantState, 
  PendingDefense, 
  DefenseType, 
  DefenseChoice,
  RulesetId
} from '../../../shared/types';
import { 
  getDefenseOptions, 
  calculateDefenseValue, 
  getPostureModifiers 
} from '../../../shared/rules';
import { getRulesetUiSlots } from '../game/shared/rulesetUiSlots';

export type DefenseModalProps = {
  pendingDefense: PendingDefense;
  character: CharacterSheet;
  combatant: CombatantState;
  attackerName: string;
  inCloseCombat: boolean;
  onDefend: (choice: DefenseChoice) => void;
  rulesetId?: RulesetId;
};

// 3d6 probability of rolling <= N
const SUCCESS_CHANCE: Record<number, number> = {
  3: 0.5, 4: 1.9, 5: 4.6, 6: 9.3, 7: 16.2, 8: 25.9,
  9: 37.5, 10: 50.0, 11: 62.5, 12: 74.1, 13: 83.8,
  14: 90.7, 15: 95.4, 16: 98.1
};

const getSuccessChance = (target: number): number => {
  if (target < 3) return 0;
  if (target >= 16) return 98.1; // Capped at 16 for critical failure rules on 17-18
  return SUCCESS_CHANCE[target] || 0;
};

export default function DefenseModal({
  pendingDefense,
  character,
  combatant,
  attackerName,
  inCloseCombat,
  onDefend,
  rulesetId,
}: DefenseModalProps) {
  const [retreat, setRetreat] = useState(false);
  const [dodgeAndDrop, setDodgeAndDrop] = useState(false);

  const baseOptions = useMemo(() => {
    const derivedDodge = character.derived.dodge;
    return getDefenseOptions(character, derivedDodge);
  }, [character]);

  // Calculate final values based on current modifiers
  const getFinalValue = (type: Exclude<DefenseType, 'none'>, base: number, weaponName?: string) => {
    const postureMods = getPostureModifiers(combatant.posture);
    const sameWeaponParry = type === 'parry' && weaponName 
      ? (combatant.parryWeaponsUsedThisTurn ?? []).includes(weaponName)
      : false;
    
    return calculateDefenseValue(base, {
      retreat,
      dodgeAndDrop: type === 'dodge' ? dodgeAndDrop : false,
      inCloseCombat,
      defensesThisTurn: combatant.defensesThisTurn,
      deceptivePenalty: pendingDefense.deceptivePenalty,
      postureModifier: postureMods.defenseVsMelee,
      defenseType: type,
      sameWeaponParry
    });
  };

  const getSlotForDefense = (defenseName: string | undefined) => {
    if (!defenseName) return null;
    const item = character.equipment.find(e => e.name === defenseName);
    if (!item) return null;
    const equipped = combatant.equipped.find(e => e.equipmentId === item.id);
    return equipped ? equipped.slot.replace('_', ' ') : null;
  };

  const dodgeValue = getFinalValue('dodge', baseOptions.dodge);
  const parryValue = baseOptions.parry ? getFinalValue('parry', baseOptions.parry.value, baseOptions.parry.weapon) : 0;
  const blockValue = baseOptions.block ? getFinalValue('block', baseOptions.block.value) : 0;

  const slots = getRulesetUiSlots(rulesetId);
  const slotDefense = slots.renderDefenseOptions?.({
    pendingDefense,
    character,
    combatant,
    attackerName,
    inCloseCombat,
    onDefend,
  });

  const handleDefend = (type: DefenseType) => {
    onDefend({
      type,
      retreat,
      dodgeAndDrop: type === 'dodge' ? dodgeAndDrop : false
    });
  };

  const retreatDisabled = combatant.retreatedThisTurn;
  const canRetreat = !retreatDisabled;

  if (slotDefense) {
    return <>{slotDefense}</>;
  }

  return (
    <div className="modal-overlay defense-modal-overlay">
      <div className="modal defense-modal">
        <div className="defense-header">
          <div className="warning-badge">⚠️ INCOMING ATTACK</div>
          <div className="attack-info">
            <span className="attacker-name">{attackerName}</span>
            <span className="attack-detail">
              attacks your <span className="hit-location">{pendingDefense.hitLocation.replace('_', ' ')}</span>
            </span>
            <span className="weapon-detail">
              with {pendingDefense.weapon} ({pendingDefense.damageType})
            </span>
          </div>
          {pendingDefense.deceptivePenalty > 0 && (
            <div className="penalty-notice">
              Deceptive Attack: -{pendingDefense.deceptivePenalty} to defense
            </div>
          )}
        </div>

        <div className="defense-cards">
          <button 
            className="defense-card dodge"
            onClick={() => handleDefend('dodge')}
          >
            <div className="defense-title">DODGE</div>
            <div className="defense-value">{dodgeValue}</div>
            <div className="defense-chance">
              <div className="chance-bar">
                <div 
                  className="chance-fill" 
                  style={{ width: `${getSuccessChance(dodgeValue)}%` }}
                />
              </div>
              <span>{getSuccessChance(dodgeValue).toFixed(1)}%</span>
            </div>
            <div className="defense-sub">Base: {baseOptions.dodge}</div>
          </button>

          <button 
            className={`defense-card parry ${!baseOptions.parry ? 'disabled' : ''}`}
            onClick={() => baseOptions.parry && handleDefend('parry')}
            disabled={!baseOptions.parry}
          >
            <div className="defense-title">PARRY</div>
            {baseOptions.parry ? (
              <>
                <div className="defense-value">{parryValue}</div>
                <div className="defense-chance">
                  <div className="chance-bar">
                    <div 
                      className="chance-fill" 
                      style={{ width: `${getSuccessChance(parryValue)}%` }}
                    />
                  </div>
                  <span>{getSuccessChance(parryValue).toFixed(1)}%</span>
                </div>
                <div className="defense-sub">{baseOptions.parry.weapon}</div>
                {getSlotForDefense(baseOptions.parry.weapon) && (
                  <div className="defense-source-indicator">
                    <span className="defense-source-icon">✋</span>
                    <span style={{ textTransform: 'capitalize' }}>{getSlotForDefense(baseOptions.parry.weapon)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="defense-unavailable">N/A</div>
            )}
          </button>

          <button 
            className={`defense-card block ${!baseOptions.block ? 'disabled' : ''}`}
            onClick={() => baseOptions.block && handleDefend('block')}
            disabled={!baseOptions.block}
          >
            <div className="defense-title">BLOCK</div>
            {baseOptions.block ? (
              <>
                <div className="defense-value">{blockValue}</div>
                <div className="defense-chance">
                  <div className="chance-bar">
                    <div 
                      className="chance-fill" 
                      style={{ width: `${getSuccessChance(blockValue)}%` }}
                    />
                  </div>
                  <span>{getSuccessChance(blockValue).toFixed(1)}%</span>
                </div>
                <div className="defense-sub">{baseOptions.block.shield}</div>
                {getSlotForDefense(baseOptions.block.shield) && (
                  <div className="defense-source-indicator">
                    <span className="defense-source-icon">🛡️</span>
                    <span style={{ textTransform: 'capitalize' }}>{getSlotForDefense(baseOptions.block.shield)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="defense-unavailable">N/A</div>
            )}
          </button>
        </div>

        <div className="defense-options">
          <div className="option-group">
            <label className={`option-checkbox ${!canRetreat ? 'disabled' : ''}`}>
              <input 
                type="checkbox" 
                checked={retreat} 
                onChange={(e) => setRetreat(e.target.checked)}
                disabled={!canRetreat}
              />
              <span className="checkmark"></span>
              <div className="option-text">
                <span className="option-title">Retreat</span>
                <span className="option-desc">
                  {inCloseCombat 
                    ? '+1 Dodge/Parry/Block (Close Combat).'
                    : '+3 Dodge, +1 Parry/Block.'} Moves 1 hex back.
                  {retreatDisabled && <span className="option-warning"> (Already retreated)</span>}
                </span>
              </div>
            </label>

            <label className="option-checkbox">
              <input 
                type="checkbox" 
                checked={dodgeAndDrop} 
                onChange={(e) => setDodgeAndDrop(e.target.checked)}
              />
              <span className="checkmark"></span>
              <div className="option-text">
                <span className="option-title">Dodge and Drop</span>
                <span className="option-desc">+3 Dodge, end turn prone. (Dodge only)</span>
              </div>
            </label>
          </div>

        {combatant.defensesThisTurn > 0 && (
          <div className="defense-penalty-alert">
            ⚠️ Multiple Defenses: -{combatant.defensesThisTurn} cumulative penalty applied
            {baseOptions.parry && combatant.parryWeaponsUsedThisTurn?.includes(baseOptions.parry.weapon) && (
              <span className="same-weapon-warning"> (Parry with same weapon: -4 instead of -1)</span>
            )}
          </div>
        )}
        </div>

        <div className="defense-footer">
          <button 
            className="action-btn danger no-defense-btn"
            onClick={() => onDefend({ type: 'none', retreat: false, dodgeAndDrop: false })}
          >
            🚫 NO DEFENSE
          </button>
        </div>
      </div>
    </div>
  );
}
