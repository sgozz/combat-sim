import type { EquippedItem, EquipmentSlot } from '../../../../shared/rulesets/gurps/types';
import type { PF2CharacterWeapon } from '../../../../shared/rulesets/pf2/characterSheet';

type PF2ReadyPanelProps = {
  equipped: EquippedItem[];
  weapons: PF2CharacterWeapon[];
  onInteract: (action: 'draw' | 'sheathe', itemId: string, targetSlot?: EquipmentSlot) => void;
  onClose: () => void;
  actionsRemaining: number;
  isMyTurn: boolean;
};

export const PF2ReadyPanel = ({ equipped, weapons, onInteract, onClose, actionsRemaining, isMyTurn }: PF2ReadyPanelProps) => {
  const isDisabled = !isMyTurn || actionsRemaining < 1;

  const getEquippedState = (weaponId: string) => equipped.find(e => e.equipmentId === weaponId);
  const isHandSlot = (slot: EquipmentSlot) => slot === 'right_hand' || slot === 'left_hand';

  const rightHand = equipped.find(e => e.slot === 'right_hand' && e.ready);
  const leftHand = equipped.find(e => e.slot === 'left_hand' && e.ready);

  const getWeaponName = (equipmentId: string) => {
    return weapons.find(w => w.id === equipmentId)?.name ?? 'Unknown';
  };

  const getSlotLabel = (slot: EquipmentSlot) => {
    switch (slot) {
      case 'right_hand': return 'Right Hand';
      case 'left_hand': return 'Left Hand';
      case 'belt': return 'Belt';
      case 'back': return 'Back';
      case 'quiver': return 'Quiver';
      default: return slot;
    }
  };

  return (
    <div className="pf2-ready-panel">
      <div className="pf2-ready-header">
        <span className="pf2-ready-title">Weapons</span>
        <button className="pf2-ready-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="pf2-hand-status">
        <div className={`pf2-hand-indicator ${rightHand ? 'occupied' : 'free'}`}>
          <span className="pf2-hand-label">Right Hand</span>
          <span className="pf2-hand-content">{rightHand ? getWeaponName(rightHand.equipmentId) : 'Empty'}</span>
        </div>
        <div className={`pf2-hand-indicator ${leftHand ? 'occupied' : 'free'}`}>
          <span className="pf2-hand-label">Left Hand</span>
          <span className="pf2-hand-content">{leftHand ? getWeaponName(leftHand.equipmentId) : 'Empty'}</span>
        </div>
      </div>

      <div className="pf2-ready-items-list">
        {weapons.map(weapon => {
          const equippedState = getEquippedState(weapon.id);
          const inHand = equippedState && isHandSlot(equippedState.slot) && equippedState.ready;

          return (
            <div key={weapon.id} className="pf2-ready-item card">
              <div className="pf2-ready-item-info">
                <div className="pf2-ready-item-header">
                  <span className="pf2-ready-item-name">{weapon.name}</span>
                  {weapon.traits.length > 0 && (
                    <span className="pf2-ready-item-traits">
                      {weapon.traits.join(', ')}
                    </span>
                  )}
                </div>
                <div className="pf2-ready-item-status-row">
                  {equippedState ? (
                    <span className="pf2-ready-slot-badge">
                      {getSlotLabel(equippedState.slot)}
                    </span>
                  ) : (
                    <span className="pf2-ready-slot-badge stored">Stored</span>
                  )}
                </div>
              </div>

              <div className="pf2-ready-item-actions">
                {inHand ? (
                  <button
                    className="action-btn small"
                    disabled={isDisabled}
                    onClick={() => onInteract('sheathe', weapon.id)}
                  >
                    Sheathe
                  </button>
                ) : (
                  <div className="pf2-draw-buttons">
                    {!rightHand && (
                      <button
                        className="action-btn small primary"
                        disabled={isDisabled}
                        onClick={() => onInteract('draw', weapon.id, 'right_hand')}
                      >
                        Draw (R)
                      </button>
                    )}
                    {!leftHand && (
                      <button
                        className="action-btn small primary"
                        disabled={isDisabled}
                        onClick={() => onInteract('draw', weapon.id, 'left_hand')}
                      >
                        Draw (L)
                      </button>
                    )}
                    {rightHand && leftHand && (
                      <span className="pf2-hands-full-text">Hands Full</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {weapons.length === 0 && (
          <div className="empty-state">No weapons available</div>
        )}
      </div>
    </div>
  );
};
