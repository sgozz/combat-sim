import { useEffect, useState } from 'react'
import type { MatchSummary, User } from '../../shared/types'
import { MatchCard } from './MatchCard'
import './LobbyBrowser.css'

type MatchBrowserProps = {
  user: User
  matches: MatchSummary[]
  onCreateMatch: (name: string) => void
  onJoinByCode: (code: string) => void
  onSelectMatch: (matchId: string) => void
  onRefresh: () => void
  onLogout?: () => void
}

export const MatchBrowser = ({ 
  user, 
  matches, 
  onCreateMatch, 
  onJoinByCode, 
  onSelectMatch, 
  onRefresh, 
  onLogout 
}: MatchBrowserProps) => {
  const [joinCode, setJoinCode] = useState('')
  const [showJoinInput, setShowJoinInput] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      onRefresh()
    }, 5000)
    return () => clearInterval(interval)
  }, [onRefresh])

  const activeMatches = matches.filter(m => m.status === 'active' || m.status === 'paused')
  const waitingMatches = matches.filter(m => m.status === 'waiting')
  const finishedMatches = matches.filter(m => m.status === 'finished')
  
  const myTurnMatches = activeMatches.filter(m => m.isMyTurn)

  const handleJoinByCode = () => {
    if (joinCode.trim()) {
      onJoinByCode(joinCode.trim().toUpperCase())
      setJoinCode('')
      setShowJoinInput(false)
    }
  }

  return (
    <div className="lobby-browser">
      <header className="lobby-browser-header">
        <div className="lobby-browser-title">
          <h1>Tactical Combat</h1>
          <span className="lobby-browser-subtitle">My Matches</span>
        </div>
        <div className="lobby-browser-user">
          <span className="lobby-browser-username">{user.username}</span>
          {onLogout && (
            <button className="logout-button" onClick={onLogout} title="Logout">
              ↩
            </button>
          )}
        </div>
      </header>

      <main className="lobby-browser-main">
        <div className="lobby-browser-cta">
          <button className="quick-match-button" onClick={() => onCreateMatch(`${user.username}'s Battle`)}>
            <span className="quick-match-icon">⚔</span>
            <div className="quick-match-text">
              <div className="quick-match-title">New Match</div>
              <div className="quick-match-subtitle">Create a new battle room</div>
            </div>
          </button>
          
          {showJoinInput ? (
            <div className="join-code-input-group">
              <input
                type="text"
                placeholder="Enter code (e.g. ABC123)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
                maxLength={6}
                autoFocus
              />
              <button onClick={handleJoinByCode} disabled={!joinCode.trim()}>Join</button>
              <button onClick={() => { setShowJoinInput(false); setJoinCode('') }}>Cancel</button>
            </div>
          ) : (
            <button className="join-code-button" onClick={() => setShowJoinInput(true)}>
              <span className="join-code-icon">🔗</span>
              <div className="join-code-text">
                <div className="join-code-title">Join by Code</div>
                <div className="join-code-subtitle">Enter an invite code</div>
              </div>
            </button>
          )}
        </div>

        {myTurnMatches.length > 0 && (
          <>
            <div className="lobby-browser-list-header">
              <h2>⚡ Your Turn! ({myTurnMatches.length})</h2>
            </div>
            <div className="lobby-browser-list">
              {myTurnMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  currentUserId={user.id}
                  onSelect={onSelectMatch}
                />
              ))}
            </div>
          </>
        )}

        {activeMatches.filter(m => !m.isMyTurn).length > 0 && (
          <>
            <div className="lobby-browser-list-header">
              <h2>Active Matches ({activeMatches.filter(m => !m.isMyTurn).length})</h2>
            </div>
            <div className="lobby-browser-list">
              {activeMatches.filter(m => !m.isMyTurn).map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  currentUserId={user.id}
                  onSelect={onSelectMatch}
                />
              ))}
            </div>
          </>
        )}

        {waitingMatches.length > 0 && (
          <>
            <div className="lobby-browser-list-header">
              <h2>Waiting for Players ({waitingMatches.length})</h2>
            </div>
            <div className="lobby-browser-list">
              {waitingMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  currentUserId={user.id}
                  onSelect={onSelectMatch}
                />
              ))}
            </div>
          </>
        )}

        {finishedMatches.length > 0 && (
          <>
            <div className="lobby-browser-list-header">
              <h2>Completed ({finishedMatches.length})</h2>
            </div>
            <div className="lobby-browser-list">
              {finishedMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  currentUserId={user.id}
                  onSelect={onSelectMatch}
                />
              ))}
            </div>
          </>
        )}

        {matches.length === 0 && (
          <div className="lobby-browser-empty">
            <div className="lobby-browser-empty-icon">⚔</div>
            <h3>No matches yet</h3>
            <p>Create a new match or join one with a code!</p>
            <button className="lobby-browser-empty-button" onClick={() => onCreateMatch(`${user.username}'s Battle`)}>
              Create Your First Match
            </button>
          </div>
        )}

        <div className="lobby-browser-list-header" style={{ marginTop: '2rem' }}>
          <button className="refresh-button" onClick={onRefresh}>
            Refresh Matches
          </button>
        </div>
      </main>
    </div>
  )
}
