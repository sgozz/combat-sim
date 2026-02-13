import { useState, useCallback } from 'react'
import type { ActionBarProps } from '../types'
import { isPF2Character } from '../../../../shared/rulesets/characterSheet'
import { isPF2Combatant } from '../../../../shared/rulesets'
import { SpellPicker } from './SpellPicker'
import { PF2ReadyPanel } from './PF2ReadyPanel'
import { getSpell } from '../../../../shared/rulesets/pf2/spellData'
import { useConfirmDialog } from '../../../hooks/useConfirmDialog'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import type { EquipmentSlot } from '../../../../shared/rulesets/gurps/types'

export const PF2ActionBar = ({ 
  matchState,
  combatant: playerCombatant,
  character: playerCharacter,
  isMyTurn, 
  selectedTargetId,
  logs,
  pendingSpellCast,
  onAction,
  onSetPendingSpellCast,
  onLeaveLobby,
}: ActionBarProps) => {
   const [showCharacterSheet, setShowCharacterSheet] = useState(false)
   const [showSpellPicker, setShowSpellPicker] = useState(false)
   const [showReadyPanel, setShowReadyPanel] = useState(false)
   const [showCombatLog, setShowCombatLog] = useState(false)
   const [showMoreActions, setShowMoreActions] = useState(false)
   const { confirm: confirmDialog, dialogProps } = useConfirmDialog()
   
   const closeAllPanels = useCallback(() => {
     setShowCharacterSheet(false)
     setShowSpellPicker(false)
     setShowReadyPanel(false)
     setShowCombatLog(false)
     setShowMoreActions(false)
   }, [])

   if (!isPF2Character(playerCharacter) || !isPF2Combatant(playerCombatant)) {
     return null
   }
  
  const maxHP = playerCharacter.derived.hitPoints
  const currentHP = playerCombatant.currentHP
  const hpPercent = maxHP > 0 ? Math.max(0, (currentHP / maxHP) * 100) : 0
  const hpColor = hpPercent > 50 ? '#4f4' : hpPercent > 25 ? '#ff0' : '#f44'
  
  const actionsRemaining = playerCombatant.actionsRemaining ?? 3
  
  const turnMovement = matchState.turnMovement
  const inMovementPhase = turnMovement?.phase === 'moving'

  if (matchState.status === 'finished') {
    return (
      <div className="action-bar">
        <button className="action-bar-btn danger" onClick={onLeaveLobby}>
          <span className="action-bar-icon">🚪</span>
          <span className="action-bar-label">Leave</span>
        </button>
      </div>
    )
  }

  if (pendingSpellCast) {
    return (
      <div className="action-bar">
        <div className="action-bar-hint" style={{ flex: 1, color: '#ff6600' }}>
          🎯 Tap hex to cast {pendingSpellCast.spellName}
        </div>
        <button
          className="action-bar-btn danger"
          onClick={() => onSetPendingSpellCast(null)}
        >
          <span className="action-bar-icon">✕</span>
          <span className="action-bar-label">Cancel</span>
        </button>
      </div>
    )
  }

  if (!isMyTurn) {
    return (
      <div className="action-bar">
        <div className="action-bar-waiting">Waiting for opponent...</div>
      </div>
    )
  }

  const hasSpells = playerCharacter.spellcasters && playerCharacter.spellcasters.length > 0

  const handleSpellSelect = (spellName: string, castLevel: number) => {
    const spellDef = getSpell(spellName)
    if (!spellDef) return

    // Check if single-target spell requires target
    if (spellDef.targetType === 'single' && !selectedTargetId) {
      confirmDialog({ title: 'Select Target', message: 'Please select a target first', confirmLabel: 'OK', showCancel: false })
      return
    }

    if (spellDef.targetType === 'area') {
      onSetPendingSpellCast({
        spellName,
        castLevel,
        casterIndex: 0,
        areaShape: spellDef.areaShape ?? 'burst',
        areaSize: spellDef.areaSize ?? spellDef.areaRadius ?? 1
      })
      setShowSpellPicker(false)
      return
    }

    onAction('pf2_cast_spell', {
      type: 'pf2_cast_spell',
      casterIndex: 0,
      spellName,
      spellLevel: castLevel,
      targetId: selectedTargetId ?? undefined
    })
    setShowSpellPicker(false)
  }

  return (
    <>
      {(showCharacterSheet || showSpellPicker || showReadyPanel || showMoreActions) && (
        <div 
          className="action-bar-backdrop" 
          onClick={closeAllPanels}
        />
      )}

      {showSpellPicker && hasSpells && (
        <SpellPicker
          spellcaster={playerCharacter.spellcasters[0]}
          onSelectSpell={handleSpellSelect}
          onClose={() => setShowSpellPicker(false)}
          actionsRemaining={actionsRemaining}
        />
      )}

      {showReadyPanel && (
        <PF2ReadyPanel
          equipped={playerCombatant.equipped}
          weapons={playerCharacter.weapons}
          onInteract={(action: 'draw' | 'sheathe', itemId: string, targetSlot?: EquipmentSlot) => {
            onAction('pf2_interact', { type: 'pf2_interact', action, itemId, targetSlot })
            setShowReadyPanel(false)
          }}
          onClose={() => setShowReadyPanel(false)}
          actionsRemaining={actionsRemaining}
          isMyTurn={isMyTurn}
        />
      )}

      {showMoreActions && !inMovementPhase && (
        <div className="action-bar-maneuvers">
          {playerCombatant.conditions.some(c => c.condition === 'prone') ? (
            <button
              className="action-bar-maneuver-btn"
              disabled={actionsRemaining === 0}
              onClick={() => {
                onAction('pf2_stand', { type: 'pf2_stand' })
                setShowMoreActions(false)
              }}
            >
              <span className="action-bar-icon">🧍</span>
              <span className="action-bar-label">Stand</span>
            </button>
          ) : (
            <button
              className="action-bar-maneuver-btn"
              onClick={() => {
                onAction('pf2_drop_prone', { type: 'pf2_drop_prone' })
                setShowMoreActions(false)
              }}
              disabled={actionsRemaining === 0}
            >
              <span className="action-bar-icon">🔻</span>
              <span className="action-bar-label">Drop</span>
            </button>
          )}
          <button
            className={`action-bar-maneuver-btn ${!selectedTargetId ? 'disabled' : ''}`}
            disabled={actionsRemaining === 0 || !selectedTargetId}
            onClick={() => {
              if (selectedTargetId) {
                onAction('pf2_grapple', { type: 'pf2_grapple', targetId: selectedTargetId })
                setShowMoreActions(false)
              }
            }}
          >
            <span className="action-bar-icon">🤼</span>
            <span className="action-bar-label">Grapple</span>
          </button>
          <button
            className={`action-bar-maneuver-btn ${!selectedTargetId ? 'disabled' : ''}`}
            disabled={actionsRemaining === 0 || !selectedTargetId}
            onClick={() => {
              if (selectedTargetId) {
                onAction('pf2_trip', { type: 'pf2_trip', targetId: selectedTargetId })
                setShowMoreActions(false)
              }
            }}
          >
            <span className="action-bar-icon">🦵</span>
            <span className="action-bar-label">Trip</span>
          </button>
          <button
            className={`action-bar-maneuver-btn ${!selectedTargetId ? 'disabled' : ''}`}
            disabled={actionsRemaining === 0 || !selectedTargetId}
            onClick={() => {
              if (selectedTargetId) {
                onAction('pf2_feint', { type: 'pf2_feint', targetId: selectedTargetId })
                setShowMoreActions(false)
              }
            }}
          >
            <span className="action-bar-icon">🎭</span>
            <span className="action-bar-label">Feint</span>
          </button>
          <button
            className={`action-bar-maneuver-btn ${!selectedTargetId ? 'disabled' : ''}`}
            disabled={actionsRemaining === 0 || !selectedTargetId}
            onClick={() => {
              if (selectedTargetId) {
                onAction('pf2_demoralize', { type: 'pf2_demoralize', targetId: selectedTargetId })
                setShowMoreActions(false)
              }
            }}
          >
            <span className="action-bar-icon">😱</span>
            <span className="action-bar-label">Scare</span>
          </button>
          <button
            className="action-bar-maneuver-btn"
            disabled={actionsRemaining < 1}
            onClick={() => {
              setShowMoreActions(false)
              setShowReadyPanel(true)
            }}
          >
            <span className="action-bar-icon">🛡️</span>
            <span className="action-bar-label">Interact</span>
          </button>
          {hasSpells && (
            <button
              className="action-bar-maneuver-btn"
              disabled={actionsRemaining < 2}
              onClick={() => {
                setShowMoreActions(false)
                setShowSpellPicker(true)
              }}
            >
              <span className="action-bar-icon">✨</span>
              <span className="action-bar-label">Cast Spell</span>
            </button>
          )}
          <button
            className="action-bar-maneuver-btn"
            disabled={actionsRemaining === 0}
            onClick={() => {
              onAction('pf2_raise_shield', { type: 'pf2_raise_shield' })
              setShowMoreActions(false)
            }}
          >
            <span className="action-bar-icon">🛡️</span>
            <span className="action-bar-label">Shield</span>
          </button>
        </div>
      )}

      {showCharacterSheet && (
        <div className="action-bar-maneuvers" style={{ flexDirection: 'column', height: 'auto', maxHeight: '70vh', overflowY: 'auto', alignItems: 'stretch', padding: '1rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '1.1rem' }}>{playerCharacter.name}</h3>
          
          <div className="card" style={{ marginBottom: '0.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#aaa', fontSize: '0.9rem' }}>Abilities</h4>
            <div className="attributes-grid pf2-abilities">
              <div className="attr-item">
                <span className="attr-label">STR</span>
                <span className="attr-value">{playerCharacter.abilities.strength}</span>
              </div>
              <div className="attr-item">
                <span className="attr-label">DEX</span>
                <span className="attr-value">{playerCharacter.abilities.dexterity}</span>
              </div>
              <div className="attr-item">
                <span className="attr-label">CON</span>
                <span className="attr-value">{playerCharacter.abilities.constitution}</span>
              </div>
              <div className="attr-item">
                <span className="attr-label">INT</span>
                <span className="attr-value">{playerCharacter.abilities.intelligence}</span>
              </div>
              <div className="attr-item">
                <span className="attr-label">WIS</span>
                <span className="attr-value">{playerCharacter.abilities.wisdom ?? 10}</span>
              </div>
              <div className="attr-item">
                <span className="attr-label">CHA</span>
                <span className="attr-value">{playerCharacter.abilities.charisma ?? 10}</span>
              </div>
            </div>
            <div className="derived-stats pf2-derived">
              <span>AC: {playerCharacter.derived.armorClass}</span>
              <span>Speed: {playerCharacter.derived.speed} ft</span>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '0.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#aaa', fontSize: '0.9rem' }}>Weapons</h4>
            <div className="pf2-weapons-list">
              {playerCharacter.weapons.map(weapon => (
                <div key={weapon.id} className="pf2-weapon-item">
                  <span className="weapon-name">{weapon.name}</span>
                  <span className="weapon-damage">{weapon.damage}</span>
                </div>
              ))}
              {playerCharacter.weapons.length === 0 && (
                <div className="empty-list">Unarmed</div>
              )}
            </div>
          </div>

          {playerCharacter.skills.length > 0 && (
            <div className="card">
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#aaa', fontSize: '0.9rem' }}>Skills</h4>
              <div className="skills-list">
                {playerCharacter.skills.map(skill => (
                  <div key={skill.id} className="skill-item">
                    <span className="skill-name">{skill.name}</span>
                    <span className="skill-level">+{skill.proficiency}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button 
            className="action-bar-maneuver-btn" 
            style={{ marginTop: '1rem', background: '#4a2a2a', borderColor: '#f44', width: '100%' }}
            onClick={async () => {
              const confirmed = await confirmDialog({ title: 'Surrender?', message: 'Surrender and end the match?', confirmLabel: 'Surrender', variant: 'danger' })
              if (confirmed) {
                onAction('surrender', { type: 'surrender' })
                onLeaveLobby()
              }
            }}
          >
            <span className="action-bar-icon">🏳️</span>
            <span className="action-bar-label">Give Up</span>
          </button>
        </div>
      )}
      
      <div className="action-bar">
        <button 
          className={`action-bar-btn char-btn ${showCharacterSheet ? 'active' : ''}`}
          onClick={() => setShowCharacterSheet(!showCharacterSheet)}
        >
          <span className="action-bar-icon">👤</span>
          <div className="char-btn-hp">
            <div className="char-btn-hp-bar">
              <div 
                className="char-btn-hp-fill" 
                style={{ width: `${hpPercent}%`, background: hpColor }}
              />
            </div>
            <span className="char-btn-hp-text">{currentHP}/{maxHP}</span>
          </div>
        </button>
        
        <div className="action-bar-pf2-actions">
          {Array.from({ length: 3 }, (_, i) => (
            <span 
              key={i} 
              className={`pf2-action-pip ${i < actionsRemaining ? 'available' : 'used'}`}
            >
              {i < actionsRemaining ? '●' : '○'}
            </span>
          ))}
        </div>
        
        {!inMovementPhase ? (
          <>
            <button
              className={`action-bar-btn ${selectedTargetId ? 'primary' : ''}`}
              disabled={actionsRemaining === 0 || !selectedTargetId}
              onClick={() => {
                if (selectedTargetId) {
                  onAction('attack', { type: 'attack', targetId: selectedTargetId, hitLocation: 'torso' })
                }
              }}
            >
              <span className="action-bar-icon">⚔️</span>
              <span className="action-bar-label">Strike</span>
            </button>
            <button
              className="action-bar-btn"
              disabled={actionsRemaining === 0}
              onClick={() => onAction('pf2_request_move', { type: 'pf2_request_move', mode: 'stride' })}
            >
              <span className="action-bar-icon">🏃</span>
              <span className="action-bar-label">Stride</span>
            </button>
            <button
              className="action-bar-btn"
              disabled={actionsRemaining === 0}
              onClick={() => onAction('pf2_request_move', { type: 'pf2_request_move', mode: 'step' })}
            >
              <span className="action-bar-icon">👣</span>
              <span className="action-bar-label">Step</span>
            </button>
            <button
              className={`action-bar-btn ${showMoreActions ? 'active' : ''}`}
              onClick={() => {
                setShowCharacterSheet(false)
                setShowSpellPicker(false)
                setShowReadyPanel(false)
                setShowCombatLog(false)
                setShowMoreActions(!showMoreActions)
              }}
            >
              <span className="action-bar-icon">•••</span>
              <span className="action-bar-label">More</span>
            </button>
            <button
              className="action-bar-btn"
              onClick={() => onAction('end_turn', { type: 'end_turn' })}
            >
              <span className="action-bar-icon">✓</span>
              <span className="action-bar-label">End</span>
            </button>
          </>
        ) : (
          <div className="action-bar-movement-controls">
            <button
              className="action-bar-btn small"
              onClick={() => onAction('undo_movement', { type: 'undo_movement' })}
              title="Undo Movement"
            >
              <span className="action-bar-icon">↩</span>
            </button>
            <button
              className="action-bar-btn small"
              onClick={() => onAction('skip_movement', { type: 'skip_movement' })}
              title="Skip Movement"
            >
              <span className="action-bar-icon">⏭</span>
            </button>
            <button
              className="action-bar-btn primary small"
              onClick={() => onAction('confirm_movement', { type: 'confirm_movement' })}
              title="Confirm Movement"
            >
              <span className="action-bar-icon">✓</span>
            </button>
          </div>
        )}
        <button
          className={`action-bar-btn ${showCombatLog ? 'active' : ''}`}
          onClick={() => {
            if (!showCombatLog) {
              closeAllPanels()
            }
            setShowCombatLog(!showCombatLog)
          }}
        >
          <span className="action-bar-icon">📜</span>
          <span className="action-bar-label">Log</span>
        </button>
      </div>

      {showCombatLog && (
        <>
          <div className="action-bar-backdrop" onClick={() => setShowCombatLog(false)} />
          <div className="action-bar-combat-log">
            <div className="action-bar-combat-log-header">
              <span>Combat Log</span>
              <button className="action-bar-combat-log-close" onClick={() => setShowCombatLog(false)}>✕</button>
            </div>
            <div className="action-bar-combat-log-entries">
              {(logs ?? []).length === 0 ? (
                <div className="action-bar-combat-log-empty">No log entries yet.</div>
              ) : (
                [...(logs ?? [])].reverse().slice(0, 30).map((entry, i) => (
                  <div key={i} className="action-bar-combat-log-entry">{entry}</div>
                ))
              )}
            </div>
          </div>
        </>
      )}
      <ConfirmDialog {...dialogProps} />
    </>
  )
}
