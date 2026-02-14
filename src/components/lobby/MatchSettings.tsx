import { useCallback, useMemo } from 'react'
import { getTemplatesForRuleset } from '../../../shared/rulesets/templates'
import type { RulesetId, MatchSummary } from '../../../shared/types'
import './MatchSettings.css'

type MatchSettingsProps = {
  match: MatchSummary
  isCreator: boolean
  botSlots: (string | undefined)[]
  onAddBot: () => void
  onRemoveBot: () => void
  onSetBotTemplate: (index: number, templateId: string | undefined) => void
  rulesetId: RulesetId
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
  botSlots,
  onAddBot,
  onRemoveBot,
  onSetBotTemplate,
  rulesetId,
  onToggleVisibility,
  onShareInvite,
  onCopyCode,
  codeCopied,
}: MatchSettingsProps) => {
  const isPublic = match.isPublic ?? false

  const templates = useMemo(() => getTemplatesForRuleset(rulesetId), [rulesetId])
  const heroes = useMemo(() => templates.filter(t => t.category === 'hero'), [templates])
  const monsters = useMemo(() => templates.filter(t => t.category === 'monster'), [templates])

  const handleTemplateChange = useCallback((index: number, value: string) => {
    onSetBotTemplate(index, value || undefined)
  }, [onSetBotTemplate])

  return (
    <div className="match-settings">
      <section className="match-settings-section">
        <label className="match-settings-label">
          <BotIcon />
          Bot Players
        </label>
        {isCreator ? (
          <div className="match-settings-bot-section">
            <div className="match-settings-bot-controls">
              <button
                className="match-settings-bot-btn"
                onClick={onRemoveBot}
                disabled={botSlots.length === 0}
                aria-label="Remove bot"
              >
                −
              </button>
              <span className="match-settings-bot-count">{botSlots.length}</span>
              <button
                className="match-settings-bot-btn"
                onClick={onAddBot}
                disabled={botSlots.length >= MAX_BOTS}
                aria-label="Add bot"
              >
                +
              </button>
            </div>
            {botSlots.length > 0 && (
              <div className="match-settings-bot-slots">
                {botSlots.map((templateId, i) => (
                  <div key={i} className="match-settings-bot-slot">
                    <span className="match-settings-bot-slot-label">Bot {i + 1}</span>
                    <select
                      className="match-settings-bot-template-select"
                      value={templateId ?? ''}
                      onChange={(e) => handleTemplateChange(i, e.target.value)}
                    >
                      <option value="">Random Monster</option>
                      {heroes.length > 0 && (
                        <optgroup label="Heroes">
                          {heroes.map(t => (
                            <option key={t.id} value={t.id}>{t.label}</option>
                          ))}
                        </optgroup>
                      )}
                      {monsters.length > 0 && (
                        <optgroup label="Monsters">
                          {monsters.map(t => (
                            <option key={t.id} value={t.id}>{t.label}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span className="match-settings-readonly">{botSlots.length} bots</span>
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
