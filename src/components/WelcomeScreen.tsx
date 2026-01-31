import { useState, useEffect, useRef } from 'react'
import type { RulesetId } from '../../shared/types'
import { Tutorial } from './ui/Tutorial'
import './WelcomeScreen.css'

type WelcomeScreenProps = {
  onComplete: (username: string, preferredRulesetId: RulesetId) => void
  authError?: string | null
  connectionState: 'disconnected' | 'connecting' | 'connected'
}

const RULESET_INFO: { id: RulesetId; name: string; description: string }[] = [
  {
    id: 'gurps',
    name: 'GURPS 4e',
    description: 'Hex-based tactical combat with detailed hit locations, posture, and maneuver selection.',
  },
  {
    id: 'pf2',
    name: 'Pathfinder 2e',
    description: 'Three-action economy on a square grid with attacks of opportunity and multiple attack penalty.',
  },
]

export const WelcomeScreen = ({ onComplete, authError, connectionState }: WelcomeScreenProps) => {
  const [nickname, setNickname] = useState('')
  const [selectedRuleset, setSelectedRuleset] = useState<RulesetId | null>(null)
  const [error, setError] = useState('')
  const [showTutorial, setShowTutorial] = useState(false)
  const [connectionTimeout, setConnectionTimeout] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Connection timeout: 10 seconds
  useEffect(() => {
    if (connectionState === 'connecting') {
      timeoutRef.current = setTimeout(() => {
        setConnectionTimeout(true)
      }, 10000)
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setConnectionTimeout(false)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [connectionState])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = nickname.trim()

    if (trimmed.length < 3) {
      setError('Name must be at least 3 characters')
      return
    }

    if (trimmed.length > 16) {
      setError('Name must be less than 16 characters')
      return
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setError('Name can only contain letters, numbers, - and _')
      return
    }

    if (!selectedRuleset) {
      setError('Please select a ruleset')
      return
    }

    onComplete(trimmed, selectedRuleset)
  }

  const isConnecting = connectionState === 'connecting'
  const canSubmit = nickname.trim().length >= 3 && !!selectedRuleset && !isConnecting
  const displayError = connectionTimeout
    ? 'Server unreachable. Please try again.'
    : authError || error

  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <h1 className="welcome-title">Tactical Combat Simulator</h1>
        <p className="welcome-subtitle">Enter the arena and test your tactical prowess</p>

        <div className="connection-status">
          <span className={`status-dot status-${connectionState}`} />
          <span className="status-text">
            {connectionState === 'connected' && 'Connected to server'}
            {connectionState === 'connecting' && 'Connecting...'}
            {connectionState === 'disconnected' && 'Offline'}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="welcome-form">
          <div className="form-group">
            <label htmlFor="nickname" className="form-label">
              Choose your name
            </label>
            <input
              id="nickname"
              type="text"
              className="form-input"
              placeholder="Enter username"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value)
                setError('')
              }}
              disabled={isConnecting}
              autoFocus
              maxLength={16}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Choose your ruleset</label>
            <div className="ruleset-cards">
              {RULESET_INFO.map((ruleset) => (
                <button
                  key={ruleset.id}
                  type="button"
                  className={`ruleset-card ruleset-${ruleset.id}${selectedRuleset === ruleset.id ? ' selected' : ''}`}
                  onClick={() => {
                    setSelectedRuleset(ruleset.id)
                    setError('')
                  }}
                  disabled={isConnecting}
                >
                  <span className="ruleset-card-name">{ruleset.name}</span>
                  <span className="ruleset-card-desc">{ruleset.description}</span>
                </button>
              ))}
            </div>
          </div>

          {displayError && (
            <div className="error-message">
              {displayError}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={!canSubmit}
          >
            {isConnecting ? (
              <>
                <span className="spinner" />
                <span>Connecting...</span>
              </>
            ) : (
              'Enter Arena'
            )}
          </button>
        </form>

        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowTutorial(true)}
          disabled={isConnecting}
        >
          How to Play
        </button>
      </div>
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
    </div>
  )
}
