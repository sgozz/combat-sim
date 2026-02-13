import type { 
  CharacterSheet, 
  RulesetId
} from '../../../../shared/types';
import type {
  PendingDefense,
  DefenseType, 
  DefenseChoice,
} from '../../../../shared/rulesets/gurps/types';
import type { CombatantState } from '../../../../shared/rulesets';
import { getRulesetUiSlots } from '../../game/shared/rulesetUiSlots';
import { isGurpsCharacter } from '../../../../shared/rulesets/characterSheet';
import { isGurpsCombatant } from '../../../../shared/rulesets';
import { useDefenseOptions } from '../../../hooks/useDefenseOptions';

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
  const gurpsChar = isGurpsCharacter(character) ? character : null;
  const gurpsCombatant = isGurpsCombatant(combatant) ? combatant : null;
  const { options: defenseOpts, retreat, setRetreat, dodgeAndDrop, setDodgeAndDrop } = useDefenseOptions(
    gurpsChar, gurpsCombatant, pendingDefense
  );

  if (!gurpsChar || !gurpsCombatant || !defenseOpts) {
    return null;
  }

  const getSlotForDefense = (defenseName: string | undefined) => {
    if (!defenseName) return null;
    const item = gurpsChar.equipment.find((e: typeof gurpsChar.equipment[0]) => e.name === defenseName);
    if (!item) return null;
    const equipped = gurpsCombatant.equipped.find((e: typeof gurpsCombatant.equipped[0]) => e.equipmentId === item.id);
    return equipped ? equipped.slot.replace('_', ' ') : null;
  };

  const dodgeValue = defenseOpts.dodge;
  const parryValue = defenseOpts.parry?.value ?? 0;
  const blockValue = defenseOpts.block?.value ?? 0;

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

  const canRetreat = defenseOpts.canRetreat;

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
          {pendingDefense.feintPenalty && pendingDefense.feintPenalty > 0 && (
            <div className="penalty-notice">
              Feint: -{pendingDefense.feintPenalty} to defense
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
            <div className="defense-sub">Base: {defenseOpts.baseDodge}</div>
          </button>

          <button 
            className={`defense-card parry ${!defenseOpts.parry ? 'disabled' : ''}`}
            onClick={() => defenseOpts.parry && handleDefend('parry')}
            disabled={!defenseOpts.parry}
          >
            <div className="defense-title">PARRY</div>
            {defenseOpts.parry ? (
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
                <div className="defense-sub">{defenseOpts.parry.weapon}</div>
                {getSlotForDefense(defenseOpts.parry.weapon) && (
                  <div className="defense-source-indicator">
                    <span className="defense-source-icon">✋</span>
                    <span style={{ textTransform: 'capitalize' }}>{getSlotForDefense(defenseOpts.parry.weapon)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="defense-unavailable">N/A</div>
            )}
          </button>

          <button 
            className={`defense-card block ${!defenseOpts.block ? 'disabled' : ''}`}
            onClick={() => defenseOpts.block && handleDefend('block')}
            disabled={!defenseOpts.block}
          >
            <div className="defense-title">BLOCK</div>
            {defenseOpts.block ? (
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
                <div className="defense-sub">{defenseOpts.block.shield}</div>
                {getSlotForDefense(defenseOpts.block.shield) && (
                  <div className="defense-source-indicator">
                    <span className="defense-source-icon">🛡️</span>
                    <span style={{ textTransform: 'capitalize' }}>{getSlotForDefense(defenseOpts.block.shield)}</span>
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
                  {!canRetreat && <span className="option-warning"> (Already retreated)</span>}
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

        {gurpsCombatant.defensesThisTurn > 0 && (
          <div className="defense-penalty-alert">
            ⚠️ Multiple Defenses: -{gurpsCombatant.defensesThisTurn} cumulative penalty applied
            {defenseOpts.baseParry && gurpsCombatant.parryWeaponsUsedThisTurn?.includes(defenseOpts.baseParry.weapon) && (
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
