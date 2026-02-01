import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { MatchSummary, User, ClientToServerMessage, CharacterSheet } from '../../../shared/types'
import { PlayerList } from './PlayerList'
import { MatchSettings } from './MatchSettings'
import { CharacterPreview } from './CharacterPreview'
import './LobbyScreen.css'

type LobbyScreenProps = {
  myMatches: MatchSummary[]
  user: User | null
  connectionState: 'connecting' | 'connected' | 'disconnected'
  sendMessage: (message: ClientToServerMessage) => void
  characters: CharacterSheet[]
  isSyncing: boolean
  onLoadCharacters: () => void
}

export const LobbyScreen = ({
  myMatches,
  user,
  connectionState,
  sendMessage,
  characters,
  isSyncing,
  onLoadCharacters,
}: LobbyScreenProps) => {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const [codeCopied, setCodeCopied] = useState(false)
  const [botCount, setBotCount] = useState(0)
  const [showStartConfirm, setShowStartConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)

  const match = myMatches.find(m => m.id === matchId)

  useEffect(() => {
    onLoadCharacters()
  }, [onLoadCharacters])

  useEffect(() => {
    if (!match && matchId && myMatches.length > 0) {
      navigate('/home', { replace: true })
    }
  }, [match, matchId, navigate, myMatches.length])

   useEffect(() => {
     if (match?.status === 'active' && matchId) {
       queueMicrotask(() => setIsStarting(false))
       navigate(`/game/${matchId}`, { replace: true })
     }
   }, [match?.status, matchId, navigate])

  const handleToggleReady = useCallback(() => {
    if (!match) return
    const isReady = match.readyPlayers?.includes(user?.id ?? '') ?? false
    sendMessage({ type: 'player_ready', matchId: match.id, ready: !isReady })
  }, [match, user, sendMessage])

  const isCreator = user?.id === match?.creatorId

  const handleUpdateBotCount = useCallback((count: number) => {
    setBotCount(count)
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
    if (!match) return
    sendMessage({ type: 'leave_match', matchId: match.id })
    navigate('/home')
  }, [match, sendMessage, navigate])

  const playerCount = match?.playerCount ?? 0
  const allPlayersReady = playerCount === 1 || (match?.players.every(p => match.readyPlayers?.includes(p.id)) ?? false)
  const totalCombatants = playerCount + botCount
  const canStart = isCreator && allPlayersReady && totalCombatants >= 2

  const getStartButtonTooltip = (): string => {
    if (playerCount > 1 && !allPlayersReady) return 'Waiting for all players to ready'
    if (totalCombatants < 2) return 'Need at least 2 combatants'
    return ''
  }

  const handleStartClick = useCallback(() => {
    setShowStartConfirm(true)
  }, [])

  const handleConfirmStart = useCallback(() => {
    if (!match) return
    setIsStarting(true)
    setShowStartConfirm(false)
    sendMessage({ type: 'start_combat', matchId: match.id, botCount: botCount > 0 ? botCount : undefined })
  }, [match, botCount, sendMessage])

  const handleCancelStart = useCallback(() => {
    setShowStartConfirm(false)
  }, [])

  const handleLeaveClick = useCallback(() => {
    setShowLeaveConfirm(true)
  }, [])

  const handleConfirmLeave = useCallback(() => {
    if (!match) return
    sendMessage({ type: 'leave_match', matchId: match.id })
    setShowLeaveConfirm(false)
    navigate('/home')
  }, [match, sendMessage, navigate])

  const handleCancelLeave = useCallback(() => {
    setShowLeaveConfirm(false)
  }, [])

  const handleSelectCharacter = useCallback((characterId: string) => {
    if (!match) return
    const character = characters.find(c => c.id === characterId)
    if (!character) return
    
    setSelectedCharacterId(characterId)
    sendMessage({ type: 'select_character', matchId: match.id, character })
  }, [match, characters, sendMessage])

  const handleNavigateToArmory = useCallback(() => {
    if (match) {
      navigate(`/armory/new?ruleset=${match.rulesetId}`)
    } else {
      navigate('/armory')
    }
  }, [navigate, match])

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
  const startTooltip = getStartButtonTooltip()

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
              isSyncing={isSyncing}
            />
          </div>
        </aside>

        <section className="lobby-panel lobby-panel-preview">
          <div className="lobby-panel-header">
            <h3 className="lobby-panel-title">Your Character</h3>
          </div>
          <div className="lobby-panel-body">
            <CharacterPreview
              characters={characters}
              selectedCharacterId={selectedCharacterId}
              rulesetId={match.rulesetId}
              currentUserId={user?.id ?? ''}
              onSelectCharacter={handleSelectCharacter}
              onNavigateToArmory={handleNavigateToArmory}
            />
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
          <div className="lobby-footer-left">
            <button
              className="lobby-leave-btn"
              onClick={handleLeaveClick}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 2H3C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M10.5 11.5L14 8L10.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Leave Match
            </button>
          </div>

          <div className="lobby-footer-center">
            <div className="lobby-invite-section">
              <span className="lobby-invite-label">Invite Link</span>
              <code className="lobby-invite-code" title={`${window.location.origin}?join=${match.code}`}>
                {match.code}
              </code>
            </div>
            <button
              className={`lobby-copy-btn ${codeCopied ? 'lobby-copy-btn--copied' : ''}`}
              onClick={handleCopyCode}
              title="Copy invite link to clipboard"
            >
              {codeCopied ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8L7 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Link Copied!
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

          {isCreator && (
            <div className="lobby-footer-right">
              <div className="lobby-start-wrapper" title={startTooltip || undefined}>
                <button
                  className={`lobby-start-btn ${isStarting ? 'lobby-start-btn--loading' : ''}`}
                  onClick={handleStartClick}
                  disabled={!canStart || isStarting}
                >
                  {isStarting ? (
                    <>
                      <span className="lobby-start-spinner" />
                      Starting…
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M4 2.5V15.5L15.5 9L4 2.5Z" fill="currentColor"/>
                      </svg>
                      Start Match
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </footer>

      {showStartConfirm && (
        <div className="lobby-dialog-overlay" onClick={handleCancelStart}>
          <div className="lobby-dialog" onClick={e => e.stopPropagation()}>
            <div className="lobby-dialog-icon lobby-dialog-icon--start">
              <svg width="28" height="28" viewBox="0 0 18 18" fill="none">
                <path d="M4 2.5V15.5L15.5 9L4 2.5Z" fill="currentColor"/>
              </svg>
            </div>
            <h3 className="lobby-dialog-title">Start Match?</h3>
            <p className="lobby-dialog-text">
              Start match with <strong>{match.playerCount} player{match.playerCount !== 1 ? 's' : ''}</strong>
              {botCount > 0 && <> and <strong>{botCount} bot{botCount !== 1 ? 's' : ''}</strong></>}?
            </p>
            <div className="lobby-dialog-actions">
              <button className="lobby-dialog-btn lobby-dialog-btn--cancel" onClick={handleCancelStart}>
                Cancel
              </button>
              <button className="lobby-dialog-btn lobby-dialog-btn--confirm" onClick={handleConfirmStart}>
                Start Match
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaveConfirm && (
        <div className="lobby-dialog-overlay" onClick={handleCancelLeave}>
          <div className="lobby-dialog" onClick={e => e.stopPropagation()}>
            <div className="lobby-dialog-icon lobby-dialog-icon--leave">
              <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
                <path d="M6 2H3C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M10.5 11.5L14 8L10.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 className="lobby-dialog-title">Leave Match?</h3>
            <p className="lobby-dialog-text">
              You will be removed from this match. You can rejoin later using the invite code.
            </p>
            <div className="lobby-dialog-actions">
              <button className="lobby-dialog-btn lobby-dialog-btn--cancel" onClick={handleCancelLeave}>
                Stay
              </button>
              <button className="lobby-dialog-btn lobby-dialog-btn--danger" onClick={handleConfirmLeave}>
                Leave Match
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
