import type { ManeuverType, CombatActionPayload } from '../../../shared/types'

type ActionBarProps = {
  isMyTurn: boolean
  currentManeuver: ManeuverType | null
  selectedTargetId: string | null
  onAction: (action: string, payload?: CombatActionPayload) => void
}

const QUICK_ACTIONS = [
  { key: 'attack', label: 'Attack', icon: '⚔️', needsTarget: true },
  { key: 'defend', label: 'Defend', icon: '🛡️', needsTarget: false },
  { key: 'end_turn', label: 'End Turn', icon: '⌛', needsTarget: false },
]

export const ActionBar = ({ 
  isMyTurn, 
  currentManeuver, 
  selectedTargetId,
  onAction 
}: ActionBarProps) => {
  if (!isMyTurn) {
    return (
      <div className="action-bar">
        <div className="action-bar-waiting">Waiting for opponent...</div>
      </div>
    )
  }

  if (!currentManeuver) {
    return (
      <div className="action-bar">
        <div className="action-bar-hint">Select a maneuver above to begin</div>
      </div>
    )
  }

  return (
    <div className="action-bar">
      {QUICK_ACTIONS.map(action => {
        const disabled = action.needsTarget && !selectedTargetId
        return (
          <button
            key={action.key}
            className={`action-bar-btn ${disabled ? 'disabled' : ''}`}
            disabled={disabled}
            onClick={() => {
              if (action.key === 'attack' && selectedTargetId) {
                onAction('attack', { type: 'attack', targetId: selectedTargetId })
              } else if (action.key === 'defend') {
                onAction('defend', { type: 'defend' })
              } else if (action.key === 'end_turn') {
                onAction('end_turn', { type: 'end_turn' })
              }
            }}
          >
            <span className="action-bar-icon">{action.icon}</span>
            <span className="action-bar-label">{action.label}</span>
          </button>
        )
      })}
    </div>
  )
}
