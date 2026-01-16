import { useState } from 'react'
import { Tutorial } from './ui/Tutorial'
import './WelcomeScreen.css'

type WelcomeScreenProps = {
  onComplete: (nickname: string) => void
}

export const WelcomeScreen = ({ onComplete }: WelcomeScreenProps) => {
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [showTutorial, setShowTutorial] = useState(false)

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
    
    onComplete(trimmed)
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <h1 className="welcome-title">🎲 GURPS Combat Simulator</h1>
        <p className="welcome-subtitle">Turn-Based Tactical Combat</p>
        
        <form onSubmit={handleSubmit} className="welcome-form">
          <div className="welcome-input-group">
            <label htmlFor="nickname" className="welcome-label">
              Welcome, fighter!
            </label>
            <input
              id="nickname"
              type="text"
              className="welcome-input"
              placeholder="Enter your name"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value)
                setError('')
              }}
              autoFocus
              maxLength={16}
            />
            {error && <div className="welcome-error">{error}</div>}
          </div>
          
          <div className="welcome-actions">
            <button type="submit" className="welcome-button">
              Enter Arena →
            </button>
            <button 
              type="button" 
              className="welcome-button secondary"
              onClick={() => setShowTutorial(true)}
            >
              How to Play
            </button>
          </div>
        </form>
      </div>
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
    </div>
  )
}
