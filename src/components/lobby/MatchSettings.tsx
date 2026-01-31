import { useState, useCallback } from 'react'
import type { MatchSummary } from '../../../shared/types'
import './MatchSettings.css'

type MatchSettingsProps = {
  match: MatchSummary
  isCreator: boolean
  onUpdateBotCount: (count: number) => void
  onToggleVisibility: () => void
}

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M11 3H4C3.44772 3 3 3.44772 3 4V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M3 8L7 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

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

const LinkIcon = () => (
  <svg className="match-settings-label-icon" viewBox="0 0 16 16" fill="none">
    <path d="M6.5 9.5L9.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M9 11L10.5 9.5C11.88 8.12 11.88 5.88 10.5 4.5C9.12 3.12 6.88 3.12 5.5 4.5L4 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M7 5L5.5 6.5C4.12 7.88 4.12 10.12 5.5 11.5C6.88 12.88 9.12 12.88 10.5 11.5L12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const MAX_BOTS = 4
const MIN_BOTS = 0

export const MatchSettings = ({
  match,
  isCreator,
  onUpdateBotCount,
  onToggleVisibility,
}: MatchSettingsProps) => {
  const [botCount, setBotCount] = useState(0)
  const [codeCopied, setCodeCopied] = useState(false)
  const [urlCopied, setUrlCopied] = useState(false)

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

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(match.code).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    })
  }, [match.code])

  const handleCopyURL = useCallback(() => {
    const url = `${window.location.origin}/?join=${match.code}`
    navigator.clipboard.writeText(url).then(() => {
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 2000)
    })
  }, [match.code])

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

      <div className="match-settings-divider" />

      <section className="match-settings-section">
        <label className="match-settings-label">
          <LinkIcon />
          Invite
        </label>
        <div className="match-settings-invite">
          <div className="match-settings-code-row">
            <code className="match-settings-code">{match.code}</code>
            <button
              className={`match-settings-copy-btn ${codeCopied ? 'match-settings-copy-btn--copied' : ''}`}
              onClick={handleCopyCode}
            >
              {codeCopied ? <CheckIcon /> : <CopyIcon />}
              {codeCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="match-settings-url-row">
            <input
              className="match-settings-url-input"
              type="text"
              value={`${window.location.origin}/?join=${match.code}`}
              readOnly
              onFocus={e => e.target.select()}
            />
            <button
              className={`match-settings-copy-btn ${urlCopied ? 'match-settings-copy-btn--copied' : ''}`}
              onClick={handleCopyURL}
            >
              {urlCopied ? <CheckIcon /> : <CopyIcon />}
              {urlCopied ? 'Copied' : 'Link'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
