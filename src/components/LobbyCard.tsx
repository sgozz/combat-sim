import type { LobbySummary } from '../../shared/types'
import './LobbyCard.css'

type LobbyCardProps = {
  lobby: LobbySummary
  onJoin: (lobbyId: string) => void
}

export const LobbyCard = ({ lobby, onJoin }: LobbyCardProps) => {
  const getStatusDot = () => {
    if (lobby.status === 'open') return '🟢'
    if (lobby.status === 'in_match') return '🔴'
    return '🟡'
  }

  const getStatusText = () => {
    if (lobby.status === 'open') return 'Waiting for players'
    if (lobby.status === 'in_match') return 'Match in progress'
    return 'Starting soon'
  }

  const canJoin = lobby.status === 'open' && lobby.playerCount < lobby.maxPlayers
  const isFull = lobby.playerCount >= lobby.maxPlayers && lobby.status === 'open'

  return (
    <div className={`lobby-card lobby-card-${lobby.status}`}>
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
        {isFull && (
          <span className="lobby-card-full">Full</span>
        )}
        {lobby.status === 'in_match' && (
          <button className="lobby-card-spectate" disabled>
            Spectate (Soon)
          </button>
        )}
      </div>
    </div>
  )
}
