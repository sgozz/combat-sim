import { useState, useEffect, useCallback } from 'react'
import type { RulesetId } from '../../../shared/types'
import './CreateMatchDialog.css'

type CreateMatchDialogProps = {
  username: string
  onClose: () => void
  onCreateMatch: (name: string, maxPlayers: number, rulesetId: RulesetId, isPublic: boolean) => void
}

export const CreateMatchDialog = ({ username, onClose, onCreateMatch }: CreateMatchDialogProps) => {
  const [matchName, setMatchName] = useState(`${username}'s Battle`)
  const [rulesetId, setRulesetId] = useState<RulesetId>('gurps')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [isPublic, setIsPublic] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = useCallback(() => {
    if (!isCreating) onClose()
  }, [isCreating, onClose])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [handleClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!matchName.trim() || isCreating) return

    setError(null)
    setIsCreating(true)

    try {
      onCreateMatch(matchName.trim(), maxPlayers, rulesetId, isPublic)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create match')
      setIsCreating(false)
    }
  }

  return (
    <div className="cmd-overlay" onClick={handleClose}>
      <div className="cmd-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="cmd-title">Create New Match</h2>

        <form onSubmit={handleSubmit} className="cmd-form">
          <div className="cmd-field">
            <label htmlFor="cmd-match-name" className="cmd-label">Match Name</label>
            <input
              id="cmd-match-name"
              type="text"
              value={matchName}
              onChange={(e) => setMatchName(e.target.value)}
              className="cmd-input"
              disabled={isCreating}
              maxLength={50}
              required
              autoFocus
            />
          </div>

          <div className="cmd-field">
            <label className="cmd-label">Ruleset</label>
            <div className="cmd-toggle-group">
              <button
                type="button"
                className={`cmd-toggle-btn ${rulesetId === 'gurps' ? 'cmd-toggle-active' : ''}`}
                onClick={() => setRulesetId('gurps')}
                disabled={isCreating}
              >
                GURPS 4e
              </button>
              <button
                type="button"
                className={`cmd-toggle-btn ${rulesetId === 'pf2' ? 'cmd-toggle-active' : ''}`}
                onClick={() => setRulesetId('pf2')}
                disabled={isCreating}
              >
                Pathfinder 2e
              </button>
            </div>
          </div>

          <div className="cmd-field">
            <label htmlFor="cmd-max-players" className="cmd-label">
              Max Players: <span className="cmd-label-value">{maxPlayers}</span>
            </label>
            <input
              id="cmd-max-players"
              type="range"
              min="2"
              max="6"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
              className="cmd-range"
              disabled={isCreating}
            />
            <div className="cmd-range-labels">
              {[2, 3, 4, 5, 6].map(n => (
                <span key={n} className={maxPlayers === n ? 'cmd-range-active' : ''}>{n}</span>
              ))}
            </div>
          </div>

          <div className="cmd-field">
            <label className="cmd-label">Visibility</label>
            <div className="cmd-toggle-group">
              <button
                type="button"
                className={`cmd-toggle-btn ${!isPublic ? 'cmd-toggle-active' : ''}`}
                onClick={() => setIsPublic(false)}
                disabled={isCreating}
              >
                Private
              </button>
              <button
                type="button"
                className={`cmd-toggle-btn ${isPublic ? 'cmd-toggle-active' : ''}`}
                onClick={() => setIsPublic(true)}
                disabled={isCreating}
              >
                Public
              </button>
            </div>
            <p className="cmd-hint">
              {isPublic
                ? 'Anyone can join this match from the public lobby'
                : 'Only players with the match code can join'}
            </p>
          </div>

          {error && (
            <div className="cmd-error">{error}</div>
          )}

          <div className="cmd-actions">
            <button
              type="button"
              onClick={handleClose}
              className="cmd-btn-cancel"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cmd-btn-create"
              disabled={isCreating || !matchName.trim()}
            >
              {isCreating ? (
                <>
                  <span className="cmd-spinner" />
                  <span>Creating…</span>
                </>
              ) : (
                'Create Match'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
