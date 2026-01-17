import { useState } from 'react'
import type { ManeuverType, CombatActionPayload, MatchState, GridPosition } from '../../../shared/types'

type ActionBarProps = {
  isMyTurn: boolean
  currentManeuver: ManeuverType | null
  selectedTargetId: string | null
  matchState: MatchState | null
  moveTarget: GridPosition | null
  inLobbyButNoMatch: boolean
  playerId: string | null
  onAction: (action: string, payload?: CombatActionPayload) => void
  onLeaveLobby: () => void
  onStartMatch: () => void
  onOpenCharacterEditor: () => void
  onCreateLobby: () => void
  onJoinLobby: () => void
}

const MANEUVERS: { type: ManeuverType; label: string; icon: string }[] = [
  { type: 'move', label: 'Move', icon: '🏃' },
  { type: 'attack', label: 'Attack', icon: '⚔️' },
  { type: 'all_out_attack', label: 'All-Out', icon: '😡' },
  { type: 'all_out_defense', label: 'Defend', icon: '🛡️' },
  { type: 'move_and_attack', label: 'M&A', icon: '🤸' },
]

const CLOSE_COMBAT_MANEUVERS: ManeuverType[] = ['attack', 'all_out_attack', 'all_out_defense']

export const ActionBar = ({ 
  isMyTurn, 
  currentManeuver, 
  selectedTargetId,
  matchState,
  moveTarget,
  inLobbyButNoMatch,
  playerId,
  onAction,
  onLeaveLobby,
  onStartMatch,
  onOpenCharacterEditor,
  onCreateLobby,
  onJoinLobby
}: ActionBarProps) => {
  const [showManeuvers, setShowManeuvers] = useState(false)
  
  const playerCombatant = playerId && matchState 
    ? matchState.combatants.find(c => c.playerId === playerId) 
    : null
  const playerCharacter = playerCombatant && matchState
    ? matchState.characters.find(c => c.id === playerCombatant.characterId)
    : null
    
  const maxHP = playerCharacter?.derived.hitPoints ?? 0
  const currentHP = playerCombatant?.currentHP ?? 0
  const hpPercent = maxHP > 0 ? Math.max(0, (currentHP / maxHP) * 100) : 0
  const hpColor = hpPercent > 50 ? '#4f4' : hpPercent > 25 ? '#ff0' : '#f44'
  const inCloseCombat = !!playerCombatant?.inCloseCombatWith
  const availableManeuvers = inCloseCombat 
    ? MANEUVERS.filter(m => CLOSE_COMBAT_MANEUVERS.includes(m.type))
    : MANEUVERS

  if (!matchState) {
    if (inLobbyButNoMatch) {
      return (
        <div className="action-bar">
          <button className="action-bar-btn" onClick={onOpenCharacterEditor}>
            <span className="action-bar-icon">👤</span>
            <span className="action-bar-label">Character</span>
          </button>
          <button className="action-bar-btn primary" onClick={onStartMatch}>
            <span className="action-bar-icon">▶️</span>
            <span className="action-bar-label">Start</span>
          </button>
          <button className="action-bar-btn danger" onClick={onLeaveLobby}>
            <span className="action-bar-icon">🚪</span>
            <span className="action-bar-label">Leave</span>
          </button>
        </div>
      )
    }
    return (
      <div className="action-bar">
        <button className="action-bar-btn" onClick={onOpenCharacterEditor}>
          <span className="action-bar-icon">👤</span>
          <span className="action-bar-label">Character</span>
        </button>
        <button className="action-bar-btn primary" onClick={onCreateLobby}>
          <span className="action-bar-icon">➕</span>
          <span className="action-bar-label">Create</span>
        </button>
        <button className="action-bar-btn" onClick={onJoinLobby}>
          <span className="action-bar-icon">🔗</span>
          <span className="action-bar-label">Join</span>
        </button>
      </div>
    )
  }

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

  if (!isMyTurn) {
    return (
      <div className="action-bar">
        <div className="action-bar-waiting">Waiting for opponent...</div>
      </div>
    )
  }

  const canAttack = currentManeuver === 'attack' || currentManeuver === 'all_out_attack' || currentManeuver === 'move_and_attack'
  const canMove = currentManeuver === 'move' || currentManeuver === 'attack' || currentManeuver === 'move_and_attack'

  const closeCombatTargetId = inCloseCombat ? playerCombatant?.inCloseCombatWith : null
  const effectiveTargetId = closeCombatTargetId ?? selectedTargetId
  
  const targetCombatant = effectiveTargetId ? matchState.combatants.find(c => c.playerId === effectiveTargetId) : null
  const targetName = targetCombatant 
    ? matchState.characters.find(c => c.id === targetCombatant.characterId)?.name ?? 'Enemy'
    : null

  const getHint = () => {
    if (!currentManeuver) return 'Select maneuver ↓'
    if (inCloseCombat && canAttack) return null
    if (canAttack && !effectiveTargetId) return 'Tap enemy to target'
    if (canMove && !moveTarget && !effectiveTargetId) return 'Tap hex to move'
    return null
  }
  const hint = getHint()
  
  const canShowAttackBtn = canAttack && effectiveTargetId
  const canShowMoveBtn = moveTarget !== null

  return (
    <>
      {showManeuvers && (
        <div className="action-bar-maneuvers">
          {availableManeuvers.map(m => (
            <button
              key={m.type}
              className={`action-bar-maneuver-btn ${currentManeuver === m.type ? 'active' : ''}`}
              onClick={() => {
                onAction('select_maneuver', { type: 'select_maneuver', maneuver: m.type })
                setShowManeuvers(false)
              }}
            >
              <span className="action-bar-icon">{m.icon}</span>
              <span className="action-bar-label">{m.label}</span>
            </button>
          ))}
          <button className="action-bar-maneuver-btn close" onClick={() => setShowManeuvers(false)}>
            <span className="action-bar-icon">✕</span>
            <span className="action-bar-label">Close</span>
          </button>
        </div>
      )}
      <div className="action-bar">
        {playerCombatant && (
          <div className="action-bar-status">
            <div className="action-bar-hp-bar">
              <div 
                className="action-bar-hp-fill" 
                style={{ width: `${hpPercent}%`, background: hpColor }}
              />
            </div>
            <span className="action-bar-hp-text">{currentHP}/{maxHP}</span>
          </div>
        )}
        
        {inCloseCombat && (
          <div className="action-bar-cc-indicator">⚔️ CC</div>
        )}
        
        <button 
          className={`action-bar-btn ${!currentManeuver ? 'highlight' : ''}`}
          onClick={() => setShowManeuvers(!showManeuvers)}
        >
          <span className="action-bar-icon">{currentManeuver ? MANEUVERS.find(m => m.type === currentManeuver)?.icon ?? '📋' : '📋'}</span>
          <span className="action-bar-label">{currentManeuver ? 'Change' : 'Maneuver'}</span>
        </button>

        {hint && (
          <div className="action-bar-hint">{hint}</div>
        )}
        
        {canShowAttackBtn && effectiveTargetId && (
          <button
            className="action-bar-btn primary"
            onClick={() => onAction('attack', { type: 'attack', targetId: effectiveTargetId })}
          >
            <span className="action-bar-icon">⚔️</span>
            <span className="action-bar-label">{targetName}</span>
          </button>
        )}

        {canShowMoveBtn && !inCloseCombat && (
          <button
            className="action-bar-btn primary"
            onClick={() => onAction('move_click')}
          >
            <span className="action-bar-icon">✓</span>
            <span className="action-bar-label">Move</span>
          </button>
        )}

        {inCloseCombat && (
          <>
            <button
              className="action-bar-btn"
              onClick={() => onAction('grapple', { type: 'grapple', targetId: playerCombatant!.inCloseCombatWith!, action: 'grab' })}
            >
              <span className="action-bar-icon">🤼</span>
              <span className="action-bar-label">Grapple</span>
            </button>
            <button
              className="action-bar-btn warning"
              onClick={() => onAction('exit_close_combat', { type: 'exit_close_combat' })}
            >
              <span className="action-bar-icon">🚪</span>
              <span className="action-bar-label">Exit</span>
            </button>
          </>
        )}

        {!inCloseCombat && (
          <div className="action-bar-facing">
            <button
              className="action-bar-btn small"
              onClick={() => onAction('turn_left', { type: 'turn_left' })}
              title="Turn Left"
            >
              <span className="action-bar-icon">↶</span>
            </button>
            <button
              className="action-bar-btn small"
              onClick={() => onAction('turn_right', { type: 'turn_right' })}
              title="Turn Right"
            >
              <span className="action-bar-icon">↷</span>
            </button>
          </div>
        )}

        <button
          className="action-bar-btn"
          onClick={() => onAction('end_turn', { type: 'end_turn' })}
        >
          <span className="action-bar-icon">⌛</span>
          <span className="action-bar-label">End</span>
        </button>

        <button
          className="action-bar-btn danger"
          onClick={() => {
            if (confirm('Surrender and end the match?')) {
              onAction('surrender', { type: 'surrender' })
            }
          }}
        >
          <span className="action-bar-icon">🏳️</span>
          <span className="action-bar-label">Give Up</span>
        </button>
      </div>
    </>
  )
}
