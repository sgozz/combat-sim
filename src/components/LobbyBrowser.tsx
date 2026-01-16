import { useEffect } from 'react'
import type { LobbySummary, Player } from '../../shared/types'
import { LobbyCard } from './LobbyCard'
import './LobbyBrowser.css'

type LobbyBrowserProps = {
  player: Player
  lobbies: LobbySummary[]
  onQuickMatch: () => void
  onJoinLobby: (lobbyId: string) => void
  onRefresh: () => void
  onLogout?: () => void
}

export const LobbyBrowser = ({ player, lobbies, onQuickMatch, onJoinLobby, onRefresh, onLogout }: LobbyBrowserProps) => {
  useEffect(() => {
    const interval = setInterval(() => {
      onRefresh()
    }, 3000)

    return () => clearInterval(interval)
  }, [onRefresh])

  return (
    <div className="lobby-browser">
      <header className="lobby-browser-header">
        <div className="lobby-browser-title">
          <h1>GURPS Combat</h1>
          <span className="lobby-browser-subtitle">Battle Lobbies</span>
        </div>
        <div className="lobby-browser-user">
          <span className="lobby-browser-username">{player.name}</span>
          {onLogout && (
            <button className="logout-button" onClick={onLogout} title="Logout">
              ↩
            </button>
          )}
        </div>
      </header>

      <main className="lobby-browser-main">
        <div className="lobby-browser-cta">
          <button className="quick-match-button" onClick={onQuickMatch}>
            <span className="quick-match-icon">⚔</span>
            <div className="quick-match-text">
              <div className="quick-match-title">Quick Match</div>
              <div className="quick-match-subtitle">Create and join a new battle room</div>
            </div>
          </button>
        </div>

        <div className="lobby-browser-list-header">
          <h2>Active Battles ({lobbies.length})</h2>
          <button className="refresh-button" onClick={onRefresh}>
            Refresh
          </button>
        </div>

        <div className="lobby-browser-list">
          {lobbies.length === 0 ? (
            <div className="lobby-browser-empty">
              <div className="lobby-browser-empty-icon">⚔</div>
              <h3>No active battles right now</h3>
              <p>Be the first to start one!</p>
              <button className="lobby-browser-empty-button" onClick={onQuickMatch}>
                Create Your Battle Room
              </button>
            </div>
          ) : (
            lobbies.map((lobby) => (
              <LobbyCard
                key={lobby.id}
                lobby={lobby}
                onJoin={onJoinLobby}
              />
            ))
          )}
        </div>
      </main>
    </div>
  )
}
