import { useState } from 'react'
import { Tooltip } from '../../ui/Tooltip'
import { CombatLog } from '../../game/CombatLog'
import type { GameActionPanelProps } from '../types'

export const PF2GameActionPanel = ({ 
  matchState, 
  combatant,
  logs, 
  selectedTargetId,
  isMyTurn,
  onAction,
  onLeaveLobby,
}: GameActionPanelProps) => {
  const [collapsed, setCollapsed] = useState(false)
  
  const selectedTarget = matchState.combatants.find(c => c.playerId === selectedTargetId)
  const selectedTargetName = selectedTarget 
    ? matchState.characters.find(c => c.id === selectedTarget.characterId)?.name ?? 'Unknown'
    : null

  const renderContent = () => {
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

    const actionsRemaining = combatant.pf2?.actionsRemaining ?? combatant.attacksRemaining ?? 3
    const attacksThisTurn = combatant.pf2?.attacksThisTurn ?? 0
    
    const getMapPenalty = () => {
      if (attacksThisTurn === 0) return 0
      if (attacksThisTurn === 1) return -5
      return -10
    }
    const mapPenalty = getMapPenalty()
    
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
          {attacksThisTurn > 0 && (
            <div className="pf2-map-badge" style={{ color: mapPenalty < -5 ? '#f44' : '#ff4' }}>
              MAP: {mapPenalty}
            </div>
          )}
        </div>
        
        <div className="pf2-action-grid">
          <Tooltip content="Attack with a weapon. Multiple Attack Penalty applies after first Strike." position="top">
            <button 
              className={`pf2-action-btn strike ${!selectedTargetId ? 'needs-target' : ''}`}
              disabled={actionsRemaining === 0}
              onClick={() => {
                if (selectedTargetId) {
                  onAction('attack', { type: 'attack', targetId: selectedTargetId, hitLocation: 'torso' })
                } else {
                  onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'attack' })
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
              onClick={() => onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'move' })}
            >
              <span className="pf2-action-icon">🏃</span>
              <span className="pf2-action-label">Stride</span>
            </button>
          </Tooltip>

          <Tooltip content="Move 5 feet. Costs 1 action. Cannot use while prone." position="top">
            <button 
              className="pf2-action-btn step"
              disabled={actionsRemaining === 0 || combatant.posture === 'prone'}
              onClick={() => onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'pf2_step' })}
            >
              <span className="pf2-action-icon">👣</span>
              <span className="pf2-action-label">Step</span>
            </button>
          </Tooltip>

          {combatant.posture === 'prone' ? (
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
              onClick={() => onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'all_out_defense' })}
            >
              <span className="pf2-action-icon">🛡️</span>
              <span className="pf2-action-label">Raise Shield</span>
            </button>
          </Tooltip>
          
          <Tooltip content="Draw, stow, or interact with an item." position="top">
            <button 
              className="pf2-action-btn interact"
              disabled={actionsRemaining === 0}
              onClick={() => onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'ready' })}
            >
              <span className="pf2-action-icon">✋</span>
              <span className="pf2-action-label">Interact</span>
            </button>
          </Tooltip>
        </div>
        
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

  const actionsRemaining = combatant.pf2?.actionsRemaining ?? combatant.attacksRemaining ?? 3
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
