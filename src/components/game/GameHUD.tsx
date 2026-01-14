import { CombatLog } from './CombatLog'
import type { MatchState, Player, CombatActionPayload, ManeuverType } from '../../../shared/types'

type GamePanelProps = {
  matchState: MatchState | null
  player: Player | null
  lobbyPlayers: Player[]
  lobbyId: string | null
}

export const GameStatusPanel = ({ 
  matchState, 
  player, 
  lobbyPlayers, 
  lobbyId 
}: GamePanelProps) => {
  const activeCombatant = matchState?.combatants.find((combatant) => combatant.playerId === player?.id) ?? null

  return (
    <aside className="panel">
      <div className="panel-header">Lobby / Status</div>
      <div className="panel-content">
        <div className="card">
          <h3>Active Character</h3>
          <div>Name: {matchState?.characters.find((c) => c.id === activeCombatant?.characterId)?.name ?? 'Unassigned'}</div>
          <div>HP: {activeCombatant?.currentHP ?? '-'}</div>
          <div>FP: {activeCombatant?.currentFP ?? '-'}</div>
          <div>Status: <span style={{ color: '#4f4' }}>OK</span></div>
        </div>

        <div className="card">
          <h3>Participants</h3>
          <ul>
            {lobbyPlayers.length > 0 ? (
              lobbyPlayers.map((participant) => (
                <li key={participant.id}>
                  {participant.name}{participant.id === player?.id ? ' (You)' : ''}
                </li>
              ))
            ) : (
              <li>No players</li>
            )}
          </ul>
          <div>Lobby: {lobbyId ?? 'Not joined'}</div>
        </div>
      </div>
    </aside>
  )
}

type GameActionPanelProps = {
  matchState: MatchState | null
  logs: string[]
  moveTarget: unknown
  selectedTargetId: string | null
  currentManeuver: ManeuverType | null
  isMyTurn: boolean
  onAction: (action: string, payload?: CombatActionPayload) => void
  onLeaveLobby: () => void
  onStartMatch: () => void
  onOpenCharacterEditor: () => void
  onCreateLobby: () => void
  onJoinLobby: () => void
  inLobbyButNoMatch: boolean
}

const MANEUVERS: { type: ManeuverType; label: string; icon: string; desc: string }[] = [
  { type: 'do_nothing', label: 'Do Nothing', icon: '💤', desc: 'Recover from stun or wait. No move.' },
  { type: 'move', label: 'Move', icon: '🏃', desc: 'Full move. No attack. Active defense allowed.' },
  { type: 'aim', label: 'Aim', icon: '🎯', desc: 'Accumulate Accuracy bonus. Step allowed.' },
  { type: 'attack', label: 'Attack', icon: '⚔️', desc: 'Standard attack. Step allowed. Active defense allowed.' },
  { type: 'all_out_attack', label: 'All-Out Attack', icon: '😡', desc: 'Bonus to hit or damage. Half move. NO DEFENSE.' },
  { type: 'all_out_defense', label: 'All-Out Defense', icon: '🛡️', desc: 'Bonus to defense (+2). Step allowed. No attack.' },
  { type: 'move_and_attack', label: 'Move & Attack', icon: '🤸', desc: 'Full move and attack. -4 skill (max 9). No Parry/Block.' },
]

export const GameActionPanel = ({ 
  matchState, 
  logs, 
  moveTarget, 
  selectedTargetId,
  currentManeuver,
  isMyTurn,
  onAction,
  onLeaveLobby,
  onStartMatch,
  onOpenCharacterEditor,
  onCreateLobby,
  onJoinLobby,
  inLobbyButNoMatch
}: GameActionPanelProps) => {
  const selectedTarget = matchState?.combatants.find(c => c.playerId === selectedTargetId)
  const selectedTargetName = selectedTarget 
    ? matchState?.characters.find(c => c.id === selectedTarget.characterId)?.name ?? 'Unknown'
    : null

  const renderContent = () => {
    if (!matchState) {
      if (inLobbyButNoMatch) {
        return (
          <div className="action-grid">
            <button className="action-btn" onClick={onOpenCharacterEditor}>Edit Character</button>
            <button className="action-btn primary" onClick={onStartMatch}>Start Match</button>
            <button className="action-btn danger" onClick={onLeaveLobby}>Leave Lobby</button>
          </div>
        )
      }
      return (
        <div className="action-grid">
          <button className="action-btn" onClick={onOpenCharacterEditor}>Edit Character</button>
          <button className="action-btn primary" onClick={onCreateLobby}>Create Lobby</button>
          <button className="action-btn" onClick={onJoinLobby}>Join Lobby</button>
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

    if (isMyTurn && !currentManeuver) {
      return (
        <div className="maneuver-grid">
          {MANEUVERS.map(m => (
            <button 
              key={m.type}
              className="maneuver-btn"
              onClick={() => onAction('select_maneuver', { type: 'select_maneuver', maneuver: m.type })}
              title={m.desc}
            >
              <div className="maneuver-icon">{m.icon}</div>
              <div className="maneuver-label">{m.label}</div>
            </button>
          ))}
        </div>
      )
    }

    const actions = [
        {
          label: selectedTargetId ? `Attack ${selectedTargetName}` : 'Attack (select target)',
          icon: '⚔️',
          disabled: !isMyTurn,
          onClick: () => {
            if (!selectedTargetId) return
            onAction('attack', { type: 'attack', targetId: selectedTargetId })
          },
        },
        {
          label: 'Defend',
          icon: '🛡️',
          disabled: !isMyTurn,
          onClick: () => onAction('defend', { type: 'defend' }),
        },
        {
          label: moveTarget ? 'Confirm Move' : 'Move (click grid)',
          icon: '🦶',
          disabled: !isMyTurn,
          onClick: () => onAction('move_click'),
        },
        ...(moveTarget ? [{ label: 'Cancel Move', icon: '❌', onClick: () => onAction('cancel_move') }] : []),
        { label: 'End Turn', icon: '⌛', disabled: !isMyTurn, onClick: () => onAction('end_turn', { type: 'end_turn' }) },
        { label: 'Leave Match', icon: '🚪', onClick: onLeaveLobby },
      ]

    return (
      <div className="action-grid">
        {actions.map((btn) => (
          <button 
            key={btn.label} 
            className={`action-btn ${btn.label.includes('Cancel') ? 'danger' : ''}`}
            onClick={btn.onClick}
            disabled={btn.disabled}
          >
            {btn.icon && <span className="btn-icon">{btn.icon}</span>}
            {btn.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <aside className="panel panel-right">
      <div className="panel-header">Actions & Log</div>
      <div className="panel-content">
        <div className="card">
          <h3>{matchState?.status === 'finished' ? 'Match Over' : isMyTurn && !currentManeuver && matchState ? 'Choose Maneuver' : 'Actions'}</h3>
          {renderContent()}
        </div>

        <CombatLog logs={logs} />
      </div>
    </aside>
  )
}

