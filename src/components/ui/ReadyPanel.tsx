import type { EquippedItem, Equipment, ReadyAction, EquipmentSlot } from '../../../shared/types';
import { Tooltip } from './Tooltip';

type ReadyPanelProps = {
  equipped: EquippedItem[];
  equipment: Equipment[];
  onReadyAction: (action: ReadyAction, itemId: string, targetSlot?: EquipmentSlot) => void;
};

export const ReadyPanel = ({ equipped, equipment, onReadyAction }: ReadyPanelProps) => {
  const getEquippedState = (itemId: string) => equipped.find(e => e.equipmentId === itemId);
  const isHandSlot = (slot: EquipmentSlot) => slot === 'right_hand' || slot === 'left_hand';
  
  const rightHand = equipped.find(e => e.slot === 'right_hand');
  const leftHand = equipped.find(e => e.slot === 'left_hand');

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

  const getItemName = (itemId: string) => {
    return equipment.find(e => e.id === itemId)?.name ?? 'Unknown Item';
  };

  return (
    <div className="ready-panel">
      <div className="ready-header">
        <div className="hand-status">
          <div className={`hand-indicator ${rightHand ? 'occupied' : 'free'}`}>
            <span className="hand-label">Right Hand</span>
            <span className="hand-content">{rightHand ? getItemName(rightHand.equipmentId) : 'Empty'}</span>
          </div>
          <div className={`hand-indicator ${leftHand ? 'occupied' : 'free'}`}>
            <span className="hand-label">Left Hand</span>
            <span className="hand-content">{leftHand ? getItemName(leftHand.equipmentId) : 'Empty'}</span>
          </div>
        </div>
      </div>

      <div className="ready-items-list">
        {equipment.map(item => {
          const equippedState = getEquippedState(item.id);
          const inHand = equippedState && isHandSlot(equippedState.slot);
          const isReady = equippedState?.ready ?? false;
          
          return (
            <div key={item.id} className="ready-item card">
              <div className="ready-item-info">
                <div className="ready-item-header">
                  <span className="ready-item-name">{item.name}</span>
                  <span className="ready-item-type">{item.type}</span>
                </div>
                
                <div className="ready-item-status-row">
                  {equippedState ? (
                    <>
                      <span className="ready-slot-badge">
                        {getSlotLabel(equippedState.slot)}
                      </span>
                      {isReady ? (
                        <span className="ready-status ready">READY</span>
                      ) : (
                        <span className="ready-status unready">UNREADY</span>
                      )}
                    </>
                  ) : (
                    <span className="ready-slot-badge stored">Stored</span>
                  )}
                </div>
              </div>

              <div className="ready-item-actions">
                {inHand && (
                  <>
                    {isReady ? (
                      <>
                        <button 
                          className="action-btn small"
                          onClick={() => onReadyAction('sheathe', item.id)}
                        >
                          Sheathe
                        </button>
                        {item.type === 'ranged' && (
                          <button 
                            className="action-btn small"
                            onClick={() => onReadyAction('reload', item.id)}
                          >
                            Reload
                          </button>
                        )}
                      </>
                    ) : (
                      <button 
                        className="action-btn small primary"
                        onClick={() => onReadyAction('prepare', item.id)}
                      >
                        Prepare
                      </button>
                    )}
                  </>
                )}

                {!inHand && (
                  <div className="draw-buttons">
                    {!rightHand && (
                      <button 
                        className="action-btn small primary"
                        onClick={() => onReadyAction('draw', item.id, 'right_hand')}
                      >
                        Draw (R)
                      </button>
                    )}
                    {!leftHand && (
                      <button 
                        className="action-btn small primary"
                        onClick={() => onReadyAction('draw', item.id, 'left_hand')}
                      >
                        Draw (L)
                      </button>
                    )}
                    {(rightHand && leftHand) && (
                      <Tooltip content="Both hands full. Sheathe an item first." position="top">
                        <span className="action-hint-text">Hands Full</span>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        {equipment.length === 0 && (
          <div className="empty-state">No equipment found</div>
        )}
      </div>
    </div>
  );
};
