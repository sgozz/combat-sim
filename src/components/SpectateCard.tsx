import type { MatchSummary } from '../../shared/types'
import './LobbyCard.css'

type SpectateCardProps = {
  match: MatchSummary
  onSpectate: (matchId: string) => void
}

export const SpectateCard = ({ match, onSpectate }: SpectateCardProps) => {
  const connectedPlayers = match.players.filter(p => p.isConnected)

  return (
    <div className="lobby-card lobby-card-active">
      <div className="lobby-card-header">
        <div className="lobby-card-title">
          <span className="lobby-card-dot">👁️</span>
          <h3>{match.name}</h3>
        </div>
        <span className="lobby-card-players">
          {connectedPlayers.length}/{match.playerCount}
        </span>
      </div>

      <div className="lobby-card-meta">
        <span className="lobby-card-status">
          {match.status === 'active' ? 'In Progress' : 'Paused'}
        </span>
        <span className="lobby-card-players">
          {match.players.map(p => p.name).join(' vs ')}
        </span>
      </div>

      <div className="lobby-card-actions">
        <button 
          className="lobby-card-join" 
          onClick={() => onSpectate(match.id)}
        >
          Watch Match →
        </button>
      </div>
    </div>
  )
}
