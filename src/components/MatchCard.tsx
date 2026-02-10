import type { MatchSummary } from '../../shared/types'
import './LobbyCard.css'

type MatchCardProps = {
  match: MatchSummary
  currentUserId: string
  onSelect: (matchId: string) => void
  onDismiss?: (matchId: string) => void
}

export const MatchCard = ({ match, currentUserId, onSelect, onDismiss }: MatchCardProps) => {
  const getStatusDot = () => {
    if (match.status === 'finished') return '🏁'
    if (match.status === 'paused') return '⏸️'
    if (match.status === 'waiting') return '🟢'
    if (match.status === 'active') return '🔴'
    return '🟡'
  }

  const getStatusText = () => {
    if (match.status === 'finished') return `Finished${match.winnerName ? ` - ${match.winnerName} wins!` : ''}`
    if (match.status === 'paused') return 'Paused - waiting for player'
    if (match.status === 'waiting') return 'Waiting for players'
    if (match.status === 'active') return match.isMyTurn ? 'Your turn!' : 'Match in progress'
    return 'Starting soon'
  }

  const getActionText = () => {
    if (match.status === 'finished') return 'View Result'
    if (match.status === 'waiting') return 'Continue Setup'
    if (match.status === 'active' || match.status === 'paused') return match.isMyTurn ? 'Play Now!' : 'View'
    return 'Open'
  }
  
  const connectedPlayers = match.players.filter(p => p.isConnected)
  const myPlayer = match.players.find(p => p.id === currentUserId)
  const amIConnected = myPlayer?.isConnected ?? false

  return (
    <div
      className={`lobby-card lobby-card-${match.status}${match.isMyTurn ? ' my-turn' : ''}`}
      onClick={() => onSelect(match.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(match.id) }}
    >
      <div className="lobby-card-header">
        <div className="lobby-card-title">
          <span className="lobby-card-dot">{getStatusDot()}</span>
          <h3>{match.name}</h3>
        </div>
        <span className="lobby-card-code" title="Match code">{match.code}</span>
      </div>

      <div className="lobby-card-meta">
        <span className="lobby-card-status">{getStatusText()}</span>
        <span className="lobby-card-players">
          {connectedPlayers.length}/{match.playerCount} online · {match.playerCount}/{match.maxPlayers} joined
        </span>
      </div>

      <div className="lobby-card-actions">
        <span className={`lobby-card-action-label${match.isMyTurn ? ' pulse' : ''}`}>
          {getActionText()} →
        </span>
        {!amIConnected && match.status !== 'finished' && (
          <span className="lobby-card-reconnect-hint">Reconnect required</span>
        )}
        {match.status === 'finished' && onDismiss && (
          <button
            className="lobby-card-dismiss"
            onClick={(e) => { e.stopPropagation(); onDismiss(match.id) }}
            title="Remove from list"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
