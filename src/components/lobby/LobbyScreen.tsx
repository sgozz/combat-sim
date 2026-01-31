import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { MatchSummary, User, ClientToServerMessage } from '../../../shared/types'
import { PlayerList } from './PlayerList'
import { MatchSettings } from './MatchSettings'
import './LobbyScreen.css'

type LobbyScreenProps = {
  myMatches: MatchSummary[]
  user: User | null
  connectionState: 'connecting' | 'connected' | 'disconnected'
  sendMessage: (message: ClientToServerMessage) => void
}

export const LobbyScreen = ({
  myMatches,
  user,
  connectionState,
  sendMessage,
}: LobbyScreenProps) => {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const [codeCopied, setCodeCopied] = useState(false)

  const match = myMatches.find(m => m.id === matchId)

  useEffect(() => {
    if (!match && matchId && myMatches.length > 0) {
      navigate('/home', { replace: true })
    }
  }, [match, matchId, navigate, myMatches.length])

  const handleToggleReady = useCallback(() => {
    if (!match) return
    const isReady = match.readyPlayers?.includes(user?.id ?? '') ?? false
    sendMessage({ type: 'player_ready', matchId: match.id, ready: !isReady })
  }, [match, user, sendMessage])

  const isCreator = user?.id === match?.creatorId

  const handleUpdateBotCount = useCallback((_count: number) => {
  }, [])

  const handleToggleVisibility = useCallback(() => {
    if (!match) return
    sendMessage({ type: 'update_match_settings', matchId: match.id, settings: { isPublic: !(match.isPublic ?? false) } })
  }, [match, sendMessage])

  const handleCopyCode = useCallback(() => {
    if (!match) return
    const inviteUrl = `${window.location.origin}?join=${match.code}`
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    })
  }, [match])

  const handleBack = useCallback(() => {
    navigate('/home')
  }, [navigate])

  if (!match) {
    return (
      <div className="lobby-screen">
        <div className="lobby-loading">
          <div className="lobby-loading-spinner" />
          <span>Loading match…</span>
        </div>
      </div>
    )
  }

  const rulesetLabel = match.rulesetId === 'gurps' ? 'GURPS' : 'PF2'

  return (
    <div className="lobby-screen">
      {connectionState === 'connecting' && (
        <div className="lobby-reconnecting">
          <span className="lobby-reconnecting-spinner" />
          <span>Reconnecting…</span>
        </div>
      )}

      <header className="lobby-header">
        <button className="lobby-back-btn" onClick={handleBack}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>

        <div className="lobby-header-center">
          <h1 className="lobby-match-name">{match.name}</h1>
          <span className={`lobby-ruleset-badge lobby-ruleset-badge--${match.rulesetId}`}>
            {rulesetLabel}
          </span>
        </div>

        <div className="lobby-header-right">
          <span className="lobby-player-count">
            {match.playerCount}/{match.maxPlayers} players
          </span>
        </div>
      </header>

      <main className="lobby-main">
        <aside className="lobby-panel lobby-panel-players">
          <div className="lobby-panel-body">
            <PlayerList
              match={match}
              currentUserId={user?.id ?? ''}
              onToggleReady={handleToggleReady}
            />
          </div>
        </aside>

        <section className="lobby-panel lobby-panel-preview">
          <div className="lobby-panel-header">
            <h3 className="lobby-panel-title">Character Preview</h3>
          </div>
          <div className="lobby-panel-body">
            <p className="lobby-placeholder-text">Character preview coming soon…</p>
            <p className="lobby-placeholder-subtext">Task 19</p>
          </div>
        </section>

        <aside className="lobby-panel lobby-panel-settings">
          <MatchSettings
            match={match}
            isCreator={isCreator ?? false}
            onUpdateBotCount={handleUpdateBotCount}
            onToggleVisibility={handleToggleVisibility}
          />
        </aside>
      </main>

      <footer className="lobby-footer">
        <div className="lobby-footer-inner">
          <div className="lobby-invite-section">
            <span className="lobby-invite-label">Invite Code</span>
            <code className="lobby-invite-code">{match.code}</code>
          </div>
          <button
            className={`lobby-copy-btn ${codeCopied ? 'lobby-copy-btn--copied' : ''}`}
            onClick={handleCopyCode}
          >
            {codeCopied ? (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8L7 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M11 3H4C3.44772 3 3 3.44772 3 4V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Copy Link
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  )
}
