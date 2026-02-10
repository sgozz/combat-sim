import { useState, useCallback } from 'react'
import { Tooltip } from '../../ui/Tooltip'
import { CombatLog } from '../../game/CombatLog'
import { isPF2Combatant } from '../../../../shared/rulesets'
import { isPF2Character } from '../../../../shared/rulesets/characterSheet'
import { SpellPicker } from './SpellPicker'
import { PF2ReadyPanel } from './PF2ReadyPanel'
import { getSpell } from '../../../../shared/rulesets/pf2/spellData'
import type { GameActionPanelProps } from '../types'
import type { EquipmentSlot } from '../../../../shared/rulesets/gurps/types'

export const PF2GameActionPanel = ({ 
  matchState, 
  combatant,
  character,
  logs, 
  selectedTargetId,
  isMyTurn,
  pendingSpellCast,
  onAction,
  onSetPendingSpellCast,
  onLeaveLobby,
}: GameActionPanelProps) => {
   const [collapsed, setCollapsed] = useState(false)
   const [showSpellPicker, setShowSpellPicker] = useState(false)
   const [showReadyPanel, setShowReadyPanel] = useState(false)
  
  const selectedTarget = matchState.combatants.find(c => c.playerId === selectedTargetId)
  const selectedTargetName = selectedTarget 
    ? matchState.characters.find(c => c.id === selectedTarget.characterId)?.name ?? 'Unknown'
    : null

  const pf2Character = isPF2Character(character) ? character : null
  const hasSpells = pf2Character?.spellcasters && pf2Character.spellcasters.length > 0

  const handleSpellSelect = useCallback((spellName: string, castLevel: number) => {
    const spellDef = getSpell(spellName)

    // Unknown spells: send generic cast (with target if selected)
    if (!spellDef) {
      onAction('pf2_cast_spell', {
        type: 'pf2_cast_spell',
        casterIndex: 0,
        spellName,
        spellLevel: castLevel,
        targetId: selectedTargetId ?? undefined
      })
      setShowSpellPicker(false)
      return
    }

    // Known spells: use full automation
    if (spellDef.targetType === 'single' && !selectedTargetId) {
      alert('Please select a target first')
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
  }, [selectedTargetId, onAction])

  const renderContent = () => {
    if (pendingSpellCast) {
      return (
        <div className="pf2-targeting-banner">
          <div className="pf2-targeting-info">
            <span className="pf2-targeting-icon">🎯</span>
            <span>Click a hex to cast <strong>{pendingSpellCast.spellName}</strong></span>
          </div>
          <button 
            className="action-btn danger"
            onClick={() => onSetPendingSpellCast(null)}
          >
            Cancel (Esc)
          </button>
        </div>
      )
    }

    if (matchState.status === 'finished') {
      return (
        <div className="action-grid">
          <button className="action-btn danger" onClick={onLeaveLobby}>Leave Match</button>
        </div>
      )
    }

    if (!isMyTurn) {
      return (
        <div className="action-section">
          <div className="action-hint">Waiting for opponent...</div>
          <button 
            className="action-btn danger"
            style={{ marginTop: '1rem' }}
            onClick={() => {
              if (confirm('Surrender and end the match?')) {
                onAction('surrender', { type: 'surrender' })
              }
            }}
          >
            <span className="btn-icon">🏳️</span> Give Up
          </button>
        </div>
      )
    }

    const actionsRemaining = isPF2Combatant(combatant) ? combatant.actionsRemaining : 3
    const mapPenalty = isPF2Combatant(combatant) ? (combatant.mapPenalty || 0) : 0
    
    return (
      <div className="pf2-action-panel">
        <div className="pf2-action-header">
          <div className="pf2-actions-remaining">
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} className={`pf2-action-pip ${i < actionsRemaining ? 'available' : 'used'}`}>
                {i < actionsRemaining ? '◆' : '◇'}
              </span>
            ))}
          </div>
          {mapPenalty < 0 && (
            <div className="pf2-map-badge" style={{ color: mapPenalty < -5 ? '#f44' : '#ff4' }}>
              MAP: {mapPenalty}
            </div>
          )}
        </div>
        
        <div className="pf2-action-grid">
          <Tooltip content="Attack with a weapon. Multiple Attack Penalty applies after first Strike. Click an enemy to target." position="top">
            <button 
              className={`pf2-action-btn strike ${!selectedTargetId ? 'needs-target' : ''}`}
              disabled={actionsRemaining === 0 || !selectedTargetId}
              onClick={() => {
                if (selectedTargetId) {
                  onAction('attack', { type: 'attack', targetId: selectedTargetId, hitLocation: 'torso' })
                }
              }}
            >
              <span className="pf2-action-icon">⚔️</span>
              <span className="pf2-action-label">Strike</span>
              {selectedTargetId && selectedTargetName && (
                <span className="pf2-action-target">→ {selectedTargetName}</span>
              )}
            </button>
          </Tooltip>
          
          <Tooltip content="Move up to your Speed (25 ft). Click hexes to move." position="top">
            <button 
              className="pf2-action-btn stride"
              disabled={actionsRemaining === 0}
              onClick={() => onAction('pf2_request_move', { type: 'pf2_request_move', mode: 'stride' })}
            >
              <span className="pf2-action-icon">🏃</span>
              <span className="pf2-action-label">Stride</span>
            </button>
          </Tooltip>

          <Tooltip content="Move 5 feet. Costs 1 action. Cannot use while prone. (Not yet implemented - use Stride)" position="top">
            <button 
              className="pf2-action-btn step"
              disabled={true}
              onClick={() => {}}
            >
              <span className="pf2-action-icon">👣</span>
              <span className="pf2-action-label">Step</span>
            </button>
          </Tooltip>

          {isPF2Combatant(combatant) && combatant.conditions.some(c => c.condition === 'prone') ? (
            <Tooltip content="Stand up from prone. Costs 1 action." position="top">
              <button 
                className="pf2-action-btn stand"
                disabled={actionsRemaining === 0}
                onClick={() => onAction('pf2_stand', { type: 'pf2_stand' })}
              >
                <span className="pf2-action-icon">🧍</span>
                <span className="pf2-action-label">Stand</span>
              </button>
            </Tooltip>
          ) : (
            <Tooltip content="Drop to the ground. Costs 1 action." position="top">
              <button 
                className="pf2-action-btn drop-prone"
                onClick={() => onAction('pf2_drop_prone', { type: 'pf2_drop_prone' })}
                disabled={actionsRemaining === 0}
              >
                <span className="pf2-action-icon">🔻</span>
                <span className="pf2-action-label">Drop Prone</span>
              </button>
            </Tooltip>
          )}
          
          <Tooltip content="Raise your shield for +2 AC until your next turn." position="top">
            <button 
              className="pf2-action-btn raise-shield"
              disabled={actionsRemaining === 0}
              onClick={() => onAction('pf2_raise_shield', { type: 'pf2_raise_shield' })}
            >
              <span className="pf2-action-icon">🛡️</span>
              <span className="pf2-action-label">Raise Shield</span>
            </button>
          </Tooltip>
          
          <Tooltip content="Draw, stow, or interact with an item. (Not yet implemented)" position="top">
            <button 
              className="pf2-action-btn interact"
              disabled={true}
              onClick={() => {}}
            >
              <span className="pf2-action-icon">✋</span>
              <span className="pf2-action-label">Interact</span>
            </button>
          </Tooltip>

          <Tooltip content="Grapple: Athletics vs Fortitude DC. Success = grabbed, Crit = restrained. Has attack trait (MAP applies)." position="top">
            <button 
              className={`pf2-action-btn grapple ${!selectedTargetId ? 'needs-target' : ''}`}
              disabled={actionsRemaining === 0 || !selectedTargetId}
              onClick={() => {
                if (selectedTargetId) {
                  onAction('pf2_grapple', { type: 'pf2_grapple', targetId: selectedTargetId })
                }
              }}
            >
              <span className="pf2-action-icon">🤼</span>
              <span className="pf2-action-label">Grapple</span>
            </button>
          </Tooltip>

          <Tooltip content="Trip: Athletics vs Reflex DC. Success = prone + flat-footed. Has attack trait (MAP applies)." position="top">
            <button 
              className={`pf2-action-btn trip ${!selectedTargetId ? 'needs-target' : ''}`}
              disabled={actionsRemaining === 0 || !selectedTargetId}
              onClick={() => {
                if (selectedTargetId) {
                  onAction('pf2_trip', { type: 'pf2_trip', targetId: selectedTargetId })
                }
              }}
            >
              <span className="pf2-action-icon">🦵</span>
              <span className="pf2-action-label">Trip</span>
            </button>
          </Tooltip>

          <Tooltip content="Disarm: Athletics vs Reflex DC. Success = -2 attacks, Crit = drop weapon. Has attack trait (MAP applies)." position="top">
            <button 
              className={`pf2-action-btn disarm ${!selectedTargetId ? 'needs-target' : ''}`}
              disabled={actionsRemaining === 0 || !selectedTargetId}
              onClick={() => {
                if (selectedTargetId) {
                  onAction('pf2_disarm', { type: 'pf2_disarm', targetId: selectedTargetId })
                }
              }}
            >
              <span className="pf2-action-icon">🗡️</span>
              <span className="pf2-action-label">Disarm</span>
            </button>
          </Tooltip>

          <Tooltip content="Feint: Deception vs Perception DC. Success = flat-footed to next attack. NO attack trait (no MAP)." position="top">
            <button 
              className={`pf2-action-btn feint ${!selectedTargetId ? 'needs-target' : ''}`}
              disabled={actionsRemaining === 0 || !selectedTargetId}
              onClick={() => {
                if (selectedTargetId) {
                  onAction('pf2_feint', { type: 'pf2_feint', targetId: selectedTargetId })
                }
              }}
            >
              <span className="pf2-action-icon">🎭</span>
              <span className="pf2-action-label">Feint</span>
            </button>
          </Tooltip>

          <Tooltip content="Demoralize: Intimidation vs Will DC. Success = frightened 1, Crit = frightened 2. NO attack trait (no MAP)." position="top">
            <button 
              className={`pf2-action-btn demoralize ${!selectedTargetId ? 'needs-target' : ''}`}
              disabled={actionsRemaining === 0 || !selectedTargetId}
              onClick={() => {
                if (selectedTargetId) {
                  onAction('pf2_demoralize', { type: 'pf2_demoralize', targetId: selectedTargetId })
                }
              }}
            >
              <span className="pf2-action-icon">😱</span>
              <span className="pf2-action-label">Demoralize</span>
            </button>
          </Tooltip>

          <Tooltip content="Interact: Draw or sheathe a weapon (1 action)" position="top">
            <button 
              className={`pf2-action-btn interact ${showReadyPanel ? 'active' : ''}`}
              disabled={actionsRemaining < 1}
              onClick={() => {
                setShowSpellPicker(false)
                setShowReadyPanel(!showReadyPanel)
              }}
            >
              <span className="pf2-action-icon">⚔️</span>
              <span className="pf2-action-label">Interact</span>
            </button>
          </Tooltip>

          {hasSpells && pf2Character && (
            <Tooltip content="Cast a spell from your spellbook. Most spells cost 2 actions." position="top">
              <button 
                className={`pf2-action-btn cast-spell ${showSpellPicker ? 'active' : ''}`}
                disabled={actionsRemaining < 2}
                onClick={() => {
                  setShowReadyPanel(false)
                  setShowSpellPicker(!showSpellPicker)
                }}
              >
                <span className="pf2-action-icon">✨</span>
                <span className="pf2-action-label">Cast Spell</span>
              </button>
            </Tooltip>
          )}
        </div>

        {showReadyPanel && isPF2Combatant(combatant) && pf2Character && (
          <div className="pf2-ready-panel-desktop">
            <PF2ReadyPanel
              equipped={combatant.equipped}
              weapons={pf2Character.weapons}
              onInteract={(action: 'draw' | 'sheathe', itemId: string, targetSlot?: EquipmentSlot) => {
                onAction('pf2_interact', { type: 'pf2_interact', action, itemId, targetSlot })
                setShowReadyPanel(false)
              }}
              onClose={() => setShowReadyPanel(false)}
              actionsRemaining={actionsRemaining}
              isMyTurn={isMyTurn}
            />
          </div>
        )}

        {showSpellPicker && hasSpells && pf2Character && (
          <SpellPicker
            spellcaster={pf2Character.spellcasters[0]}
            onSelectSpell={handleSpellSelect}
            onClose={() => setShowSpellPicker(false)}
            actionsRemaining={actionsRemaining}
          />
        )}
        
        <div className="pf2-turn-controls">
          <button 
            className="action-btn primary"
            onClick={() => onAction('end_turn', { type: 'end_turn' })}
          >
            End Turn {actionsRemaining > 0 ? `(${actionsRemaining} unused)` : ''}
          </button>
          <button 
            className="action-btn danger"
            onClick={() => {
              if (confirm('Surrender and end the match?')) {
                onAction('surrender', { type: 'surrender' })
              }
            }}
          >
            <span className="btn-icon">🏳️</span> Give Up
          </button>
        </div>
      </div>
    )
  }

  const actionsRemaining = isPF2Combatant(combatant) ? combatant.actionsRemaining : 3
  const headerText = isMyTurn 
    ? `Your Turn (${actionsRemaining} actions)`
    : 'Actions'

  return (
    <aside className={`panel panel-right ${collapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        <span>{headerText}</span>
        <button className="panel-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? '◀' : '▶'}
        </button>
      </div>
      {!collapsed && (
        <div className="panel-content">
          <div className="card">
            {renderContent()}
          </div>

          <CombatLog logs={logs} />
        </div>
      )}
    </aside>
  )
}
