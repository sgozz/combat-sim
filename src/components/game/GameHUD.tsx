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

const MANEUVERS: { type: ManeuverType; label: string }[] = [
  { type: 'do_nothing', label: 'Do Nothing' },
  { type: 'move', label: 'Move' },
  { type: 'aim', label: 'Aim' },
  { type: 'attack', label: 'Attack' },
  { type: 'all_out_attack', label: 'All-Out Attack' },
  { type: 'all_out_defense', label: 'All-Out Defense' },
  { type: 'move_and_attack', label: 'Move & Attack' },
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
        return [
          { label: 'Edit Character', onClick: onOpenCharacterEditor },
          { label: 'Start Match', onClick: onStartMatch },
          { label: 'Leave Lobby', onClick: onLeaveLobby },
        ]
      }
      return [
        { label: 'Edit Character', onClick: onOpenCharacterEditor },
        { label: 'Create Lobby', onClick: onCreateLobby },
        { label: 'Join Lobby', onClick: onJoinLobby },
      ]
    }

    if (isMyTurn && !currentManeuver) {
      return MANEUVERS.map(m => ({
        label: m.label,
        onClick: () => onAction('select_maneuver', { type: 'select_maneuver', maneuver: m.type })
      }))
    }

    // Standard actions if maneuver selected or not my turn (view only?)
    // If not my turn, maybe show nothing or just Leave.
    // Assuming we show actions but they might fail or be disabled.
    // Better to hide if not my turn? Current logic showed them.
    // Let's keep showing them but maybe disable?
    
    return [
        {
          label: selectedTargetId ? `Attack ${selectedTargetName}` : 'Attack (select target)',
          disabled: !isMyTurn,
          onClick: () => {
            if (!selectedTargetId) return
            onAction('attack', { type: 'attack', targetId: selectedTargetId })
          },
        },
        {
          label: 'Defend',
          disabled: !isMyTurn,
          onClick: () => onAction('defend', { type: 'defend' }),
        },
        {
          label: moveTarget ? 'Confirm Move' : 'Move (click grid)',
          disabled: !isMyTurn,
          onClick: () => onAction('move_click'),
        },
        ...(moveTarget ? [{ label: 'Cancel Move', onClick: () => onAction('cancel_move') }] : []),
        { label: 'End Turn', disabled: !isMyTurn, onClick: () => onAction('end_turn', { type: 'end_turn' }) },
        { label: 'Leave Match', onClick: onLeaveLobby },
      ]
  }

  const buttons = renderContent()

  return (
    <aside className="panel panel-right">
      <div className="panel-header">Actions & Log</div>
      <div className="panel-content">
        <div className="card">
          <h3>{isMyTurn && !currentManeuver && matchState ? 'Choose Maneuver' : 'Actions'}</h3>
          {buttons.map((btn) => (
            <button 
              key={btn.label} 
              className="action-btn" 
              onClick={btn.onClick}
              disabled={btn.disabled}
            >
              {btn.label}
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

