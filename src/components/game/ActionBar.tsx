import { useState } from 'react'
import type { ManeuverType, CombatActionPayload, MatchState, GridPosition } from '../../../shared/types'

type ActionBarProps = {
  isMyTurn: boolean
  currentManeuver: ManeuverType | null
  selectedTargetId: string | null
  matchState: MatchState | null
  moveTarget: GridPosition | null
  inLobbyButNoMatch: boolean
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

export const ActionBar = ({ 
  isMyTurn, 
  currentManeuver, 
  selectedTargetId,
  matchState,
  moveTarget,
  inLobbyButNoMatch,
  onAction,
  onLeaveLobby,
  onStartMatch,
  onOpenCharacterEditor,
  onCreateLobby,
  onJoinLobby
}: ActionBarProps) => {
  const [showManeuvers, setShowManeuvers] = useState(false)

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

  const getHint = () => {
    if (!currentManeuver) return 'Select maneuver'
    if (canAttack && !selectedTargetId) return 'Tap enemy to target'
    if (canMove && !moveTarget) return 'Tap hex to move'
    return null
  }
  const hint = getHint()

  return (
    <>
      {showManeuvers && (
        <div className="action-bar-maneuvers">
          {MANEUVERS.map(m => (
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
        <button 
          className={`action-bar-btn ${!currentManeuver ? 'highlight' : ''}`}
          onClick={() => setShowManeuvers(!showManeuvers)}
        >
          <span className="action-bar-icon">{currentManeuver ? MANEUVERS.find(m => m.type === currentManeuver)?.icon ?? '📋' : '📋'}</span>
          <span className="action-bar-label">{currentManeuver ? 'Change' : 'Maneuver'}</span>
        </button>

        {hint ? (
          <div className="action-bar-hint">{hint}</div>
        ) : (
          <>
            {canAttack && selectedTargetId && (
              <button
                className="action-bar-btn primary"
                onClick={() => onAction('attack', { type: 'attack', targetId: selectedTargetId })}
              >
                <span className="action-bar-icon">⚔️</span>
                <span className="action-bar-label">Attack</span>
              </button>
            )}

            {moveTarget && (
              <button
                className="action-bar-btn primary"
                onClick={() => onAction('move_click')}
              >
                <span className="action-bar-icon">✓</span>
                <span className="action-bar-label">Move</span>
              </button>
            )}
          </>
        )}

        <button
          className="action-bar-btn"
          onClick={() => onAction('end_turn', { type: 'end_turn' })}
        >
          <span className="action-bar-icon">⌛</span>
          <span className="action-bar-label">End</span>
        </button>
      </div>
    </>
  )
}
