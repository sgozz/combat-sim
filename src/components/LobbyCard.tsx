import type { LobbySummary } from '../../shared/types'
import './LobbyCard.css'

type LobbyCardProps = {
  lobby: LobbySummary
  onJoin: (lobbyId: string) => void
}

export const LobbyCard = ({ lobby, onJoin }: LobbyCardProps) => {
  const getStatusDot = () => {
    if (lobby.matchFinished) return '🏁'
    if (lobby.matchPaused) return '⏸️'
    if (lobby.status === 'open') return '🟢'
    if (lobby.status === 'in_match') return '🔴'
    return '🟡'
  }

  const getStatusText = () => {
    if (lobby.matchFinished) return `Finished - ${lobby.winnerName ?? 'Unknown'} wins!`
    if (lobby.matchPaused) return `Paused - waiting for ${lobby.pausedForPlayerName ?? 'player'}`
    if (lobby.status === 'open') return 'Waiting for players'
    if (lobby.status === 'in_match') return 'Match in progress'
    return 'Starting soon'
  }

  const canJoin = lobby.status === 'open' && lobby.playerCount < lobby.maxPlayers
  const canRejoin = lobby.matchPaused
  const canViewResult = lobby.matchFinished
  const isFull = lobby.playerCount >= lobby.maxPlayers && lobby.status === 'open'

  const cardClass = lobby.matchFinished ? 'finished' : lobby.matchPaused ? 'paused' : lobby.status;
  
  return (
    <div className={`lobby-card lobby-card-${cardClass}`}>
      <div className="lobby-card-header">
        <div className="lobby-card-title">
          <span className="lobby-card-dot">{getStatusDot()}</span>
          <h3>{lobby.name}</h3>
        </div>
        <span className="lobby-card-players">
          {lobby.playerCount}/{lobby.maxPlayers}
        </span>
      </div>

      <div className="lobby-card-meta">
        <span className="lobby-card-status">{getStatusText()}</span>
      </div>

      <div className="lobby-card-actions">
        {canJoin && (
          <button className="lobby-card-join" onClick={() => onJoin(lobby.id)}>
            Join →
          </button>
        )}
        {canRejoin && (
          <button className="lobby-card-rejoin" onClick={() => onJoin(lobby.id)}>
            Rejoin →
          </button>
        )}
        {canViewResult && (
          <button className="lobby-card-result" onClick={() => onJoin(lobby.id)}>
            View Result →
          </button>
        )}
        {isFull && (
          <span className="lobby-card-full">Full</span>
        )}
        {lobby.status === 'in_match' && !lobby.matchPaused && !lobby.matchFinished && (
          <button className="lobby-card-spectate" disabled>
            Spectate (Soon)
          </button>
        )}
      </div>
    </div>
  )
}
