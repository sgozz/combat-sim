import type { MatchState, Player, CombatActionPayload } from '../../../shared/types'

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
  onAction: (action: string, payload?: CombatActionPayload) => void
  onLeaveLobby: () => void
  onStartMatch: () => void
  onOpenCharacterEditor: () => void
  onCreateLobby: () => void
  onJoinLobby: () => void
  inLobbyButNoMatch: boolean
}

export const GameActionPanel = ({ 
  matchState, 
  logs, 
  moveTarget, 
  selectedTargetId,
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

  const actionButtons = matchState
    ? [
        {
          label: selectedTargetId ? `Attack ${selectedTargetName}` : 'Attack (select target)',
          onClick: () => {
            if (!selectedTargetId) {
              return
            }
            onAction('attack', { type: 'attack', targetId: selectedTargetId })
          },
        },
        {
          label: 'Defend',
          onClick: () => onAction('defend', { type: 'defend' }),
        },
        {
          label: moveTarget ? 'Confirm Move' : 'Move (click grid)',
          onClick: () => {
             onAction('move_click')
          },
        },
        ...(moveTarget ? [{ label: 'Cancel Move', onClick: () => onAction('cancel_move') }] : []),
        { label: 'End Turn', onClick: () => onAction('end_turn', { type: 'end_turn' }) },
        { label: 'Leave Match', onClick: onLeaveLobby },
      ]
    : inLobbyButNoMatch
      ? [
          { label: 'Edit Character', onClick: onOpenCharacterEditor },
          { label: 'Start Match', onClick: onStartMatch },
          { label: 'Leave Lobby', onClick: onLeaveLobby },
        ]
      : [
          { label: 'Edit Character', onClick: onOpenCharacterEditor },
          { label: 'Create Lobby', onClick: onCreateLobby },
          { label: 'Join Lobby', onClick: onJoinLobby },
        ]

  return (
    <aside className="panel panel-right">
      <div className="panel-header">Actions & Log</div>
      <div className="panel-content">
        <div className="card">
          <h3>Actions</h3>
          {actionButtons.map((action) => (
            <button key={action.label} className="action-btn" onClick={action.onClick}>
              {action.label}
            </button>
          ))}
        </div>

        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h3>Combat Log</h3>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: '100px' }}>
            {logs.map((log, i) => (
              <div key={i} className="log-entry">{log}</div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}

