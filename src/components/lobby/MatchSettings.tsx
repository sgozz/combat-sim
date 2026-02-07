import { useState, useCallback } from 'react'
import type { MatchSummary } from '../../../shared/types'
import './MatchSettings.css'

type MatchSettingsProps = {
  match: MatchSummary
  isCreator: boolean
  onUpdateBotCount: (count: number) => void
  onToggleVisibility: () => void
  onShareInvite: () => void
  onCopyCode: () => void
  codeCopied: boolean
}

const BotIcon = () => (
  <svg className="match-settings-label-icon" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="5" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="6" cy="9" r="1" fill="currentColor"/>
    <circle cx="10" cy="9" r="1" fill="currentColor"/>
    <path d="M8 2V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="8" cy="1.5" r="1" stroke="currentColor" strokeWidth="1"/>
  </svg>
)

const EyeIcon = () => (
  <svg className="match-settings-label-icon" viewBox="0 0 16 16" fill="none">
    <path d="M1 8C1 8 4 3 8 3C12 3 15 8 15 8C15 8 12 13 8 13C4 13 1 8 1 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
)

const MAX_BOTS = 4
const MIN_BOTS = 0

const ShareIcon = () => (
  <svg className="match-settings-label-icon" viewBox="0 0 16 16" fill="none">
    <circle cx="12" cy="3" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="13" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5.7 7L10.3 4M5.7 9L10.3 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const MatchSettings = ({
  match,
  isCreator,
  onUpdateBotCount,
  onToggleVisibility,
  onShareInvite,
  onCopyCode,
  codeCopied,
}: MatchSettingsProps) => {
  const [botCount, setBotCount] = useState(0)

  const isPublic = match.isPublic ?? false

  const handleIncrementBots = useCallback(() => {
    if (botCount < MAX_BOTS) {
      const newCount = botCount + 1
      setBotCount(newCount)
      onUpdateBotCount(newCount)
    }
  }, [botCount, onUpdateBotCount])

  const handleDecrementBots = useCallback(() => {
    if (botCount > MIN_BOTS) {
      const newCount = botCount - 1
      setBotCount(newCount)
      onUpdateBotCount(newCount)
    }
  }, [botCount, onUpdateBotCount])

  return (
    <div className="match-settings">
      <section className="match-settings-section">
        <label className="match-settings-label">
          <BotIcon />
          Bot Players
        </label>
        {isCreator ? (
          <div className="match-settings-bot-controls">
            <button
              className="match-settings-bot-btn"
              onClick={handleDecrementBots}
              disabled={botCount === MIN_BOTS}
              aria-label="Remove bot"
            >
              −
            </button>
            <span className="match-settings-bot-count">{botCount}</span>
            <button
              className="match-settings-bot-btn"
              onClick={handleIncrementBots}
              disabled={botCount === MAX_BOTS}
              aria-label="Add bot"
            >
              +
            </button>
          </div>
        ) : (
          <span className="match-settings-readonly">{botCount} bots</span>
        )}
      </section>

      <div className="match-settings-divider" />

      <section className="match-settings-section">
        <label className="match-settings-label">
          <EyeIcon />
          Visibility
        </label>
        {isCreator ? (
          <button
            className="match-settings-toggle"
            onClick={onToggleVisibility}
          >
            <span className="match-settings-toggle-indicator">
              <span className={`match-settings-toggle-dot ${isPublic ? 'match-settings-toggle-dot--public' : 'match-settings-toggle-dot--private'}`} />
              {isPublic ? 'Public' : 'Private'}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {isPublic ? 'Anyone can join' : 'Invite only'}
            </span>
          </button>
        ) : (
          <span className="match-settings-readonly">
            <span className={`match-settings-toggle-dot ${isPublic ? 'match-settings-toggle-dot--public' : 'match-settings-toggle-dot--private'}`} />
            {isPublic ? 'Public' : 'Private'}
          </span>
        )}
      </section>

      <div className="match-settings-divider match-settings-invite-divider" />

      <section className="match-settings-section match-settings-invite-section">
        <label className="match-settings-label">
          <ShareIcon />
          Invite
        </label>
        <div className="match-settings-invite-row">
          <code className="match-settings-invite-code">{match.code}</code>
          {typeof navigator.share === 'function' ? (
            <button className="match-settings-share-btn" onClick={onShareInvite}>
              Share
            </button>
          ) : (
            <button
              className={`match-settings-copy-btn${codeCopied ? ' match-settings-copy-btn--copied' : ''}`}
              onClick={onCopyCode}
            >
              {codeCopied ? 'Copied!' : 'Copy Link'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
