import type { MatchSummary } from '../../../shared/types'
import './PlayerList.css'

type PlayerListProps = {
  match: MatchSummary
  currentUserId: string
  onToggleReady: () => void
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const isReady = (match: MatchSummary, playerId: string): boolean =>
  match.readyPlayers?.includes(playerId) ?? false

export const PlayerList = ({ match, currentUserId, onToggleReady }: PlayerListProps) => {
  const readyCount = match.readyPlayers?.length ?? 0
  const emptySlots = match.maxPlayers - match.playerCount

  return (
    <div className="player-list">
      <h3 className="player-list-title">
        Players ({match.playerCount}/{match.maxPlayers})
      </h3>

      <ul className="player-list-items">
        {match.players.map(player => {
          const isCurrent = player.id === currentUserId
          const ready = isReady(match, player.id)
          const isCreator = player.id === match.creatorId

          const itemClasses = [
            'player-list-item',
            isCurrent && 'player-list-item--current',
            !player.isConnected && 'player-list-item--disconnected',
          ].filter(Boolean).join(' ')

          return (
            <li key={player.id} className={itemClasses}>
              <div className="player-list-avatar">
                {getInitials(player.name)}
                <span
                  className={`player-list-connection-dot player-list-connection-dot--${
                    player.isConnected ? 'connected' : 'disconnected'
                  }`}
                />
              </div>

              <div className="player-list-info">
                <span className="player-list-name">
                  {player.name}
                  {isCreator && <span className="player-list-badge-creator">👑</span>}
                </span>
                <span
                  className={`player-list-status player-list-status--${
                    player.isConnected ? 'connected' : 'disconnected'
                  }`}
                >
                  {player.isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              <span
                className={`player-list-ready-icon player-list-ready-icon--${
                  ready ? 'ready' : 'waiting'
                }`}
              >
                {ready ? '✓' : '⏳'}
              </span>

              {isCurrent && (
                <button
                  className={`player-list-ready-btn player-list-ready-btn--${
                    ready ? 'ready' : 'not-ready'
                  }`}
                  onClick={onToggleReady}
                >
                  {ready ? 'Unready' : 'Ready'}
                </button>
              )}
            </li>
          )
        })}

        {Array.from({ length: emptySlots }).map((_, i) => (
          <li key={`empty-${i}`} className="player-list-item player-list-item--empty">
            <div className="player-list-avatar player-list-avatar--empty" />
            <div className="player-list-info">
              <span className="player-list-name player-list-name--muted">
                Waiting for player…
              </span>
              <span className="player-list-empty-hint">Share the invite code</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="player-list-summary">
        <span className="player-list-summary-count">{readyCount}</span> / {match.playerCount} ready
      </div>
    </div>
  )
}
