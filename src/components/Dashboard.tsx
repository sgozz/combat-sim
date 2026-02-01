import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MatchCard } from './MatchCard'
import { StatsBar } from './dashboard/StatsBar'
import { CreateMatchDialog } from './dashboard/CreateMatchDialog'
import type { MatchSummary, User, RulesetId } from '../../shared/types'
import './Dashboard.css'

const RULESET_LABELS: Record<RulesetId, string> = {
  gurps: 'GURPS',
  pf2: 'PF2',
}

type DashboardProps = {
  user: User
  myMatches: MatchSummary[]
  refreshMyMatches: () => void
  onLogout: () => void
  onCreateMatch: (name: string, maxPlayers: number, isPublic: boolean) => void
  onJoinByCode: (code: string) => void
  onSelectMatch: (matchId: string) => void
  setPreferredRuleset: (rulesetId: RulesetId) => void
}

export const Dashboard = ({
  user,
  myMatches,
  refreshMyMatches,
  onLogout,
  onCreateMatch,
  onJoinByCode,
  onSelectMatch,
  setPreferredRuleset,
}: DashboardProps) => {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [showJoinInput, setShowJoinInput] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showRulesetDialog, setShowRulesetDialog] = useState(false)
  const [rulesetToast, setRulesetToast] = useState<string | null>(null)

  const currentRulesetId = user.preferredRulesetId
  const otherRulesetId: RulesetId = currentRulesetId === 'gurps' ? 'pf2' : 'gurps'

  const handleSwitchRuleset = useCallback(() => {
    setPreferredRuleset(otherRulesetId)
    setShowRulesetDialog(false)
    setRulesetToast(`Switched to ${RULESET_LABELS[otherRulesetId]}`)
    refreshMyMatches()
    setTimeout(() => setRulesetToast(null), 3000)
  }, [otherRulesetId, setPreferredRuleset, refreshMyMatches])

  useEffect(() => {
    const interval = setInterval(() => {
      refreshMyMatches()
    }, 5000)
    return () => clearInterval(interval)
  }, [refreshMyMatches])

  const yourTurnMatches = myMatches.filter(m => m.status === 'active' && m.isMyTurn)
  const activeMatches = myMatches.filter(
    m => (m.status === 'active' || m.status === 'paused') && !m.isMyTurn
  )
  const waitingMatches = myMatches.filter(m => m.status === 'waiting')
  const completedMatches = myMatches
    .filter(m => m.status === 'finished')
    .slice(0, 5)

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (joinCode.trim()) {
      // Extract code from URL if a full link was pasted (e.g., "http://localhost:5173?join=ABC123")
      const input = joinCode.trim()
      const match = input.match(/[?&]join=([A-Z0-9]+)/i)
      const code = match ? match[1] : input
      
      onJoinByCode(code.toUpperCase())
      setJoinCode('')
      setShowJoinInput(false)
    }
  }

  const hasMatches = myMatches.length > 0

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <h1 className="dashboard-title">Tactical Combat</h1>
          <div className="dashboard-header-actions">
            <span className="dashboard-username">{user.username}</span>
            <button
              onClick={() => setShowRulesetDialog(true)}
              className={`dashboard-ruleset-badge ruleset-${currentRulesetId}`}
              title={`Playing ${RULESET_LABELS[currentRulesetId]} — click to switch`}
            >
              {RULESET_LABELS[currentRulesetId]}
            </button>
            <button
              onClick={() => navigate('/armory')}
              className="dashboard-btn-header"
            >
              Armory
            </button>
            <button
              onClick={onLogout}
              className="dashboard-btn-header dashboard-btn-logout"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-container">
          <StatsBar myMatches={myMatches} currentUserId={user.id} />

          {/* Quick Actions */}
          <section className="dashboard-quick-actions">
            <button
              onClick={() => setShowCreateDialog(true)}
              className="dashboard-btn-primary dashboard-btn-large"
            >
              New Match
            </button>

            {!showJoinInput ? (
              <button
                onClick={() => setShowJoinInput(true)}
                className="dashboard-btn-secondary dashboard-btn-large"
              >
                Join by Code
              </button>
            ) : (
              <form onSubmit={handleJoinSubmit} className="dashboard-join-form">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Paste link or code"
                  className="dashboard-join-input"
                  autoFocus
                />
                <button type="submit" className="dashboard-btn-primary" disabled={!joinCode.trim()}>
                  Join
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowJoinInput(false)
                    setJoinCode('')
                  }}
                  className="dashboard-btn-secondary"
                >
                  Cancel
                </button>
              </form>
            )}
          </section>

          {/* Empty State */}
          {!hasMatches && (
            <div className="dashboard-empty-state">
              <div className="dashboard-empty-icon">⚔</div>
              <p className="dashboard-empty-text">
                No matches yet. Create your first match!
              </p>
            </div>
          )}

          {/* Your Turn */}
          {yourTurnMatches.length > 0 && (
            <section className="dashboard-match-section">
              <h2 className="dashboard-section-title dashboard-section-highlight">
                ⚡ Your Turn ({yourTurnMatches.length})
              </h2>
              <div className="dashboard-match-grid">
                {yourTurnMatches.map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    currentUserId={user.id}
                    onSelect={onSelectMatch}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Active Matches */}
          {activeMatches.length > 0 && (
            <section className="dashboard-match-section">
              <h2 className="dashboard-section-title">
                Active Matches ({activeMatches.length})
              </h2>
              <div className="dashboard-match-grid">
                {activeMatches.map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    currentUserId={user.id}
                    onSelect={onSelectMatch}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Waiting for Players */}
          {waitingMatches.length > 0 && (
            <section className="dashboard-match-section">
              <h2 className="dashboard-section-title">
                Waiting for Players ({waitingMatches.length})
              </h2>
              <div className="dashboard-match-grid">
                {waitingMatches.map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    currentUserId={user.id}
                    onSelect={onSelectMatch}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Recent Completed */}
          {completedMatches.length > 0 && (
            <section className="dashboard-match-section">
              <div className="dashboard-section-header">
                <h2 className="dashboard-section-title">
                  Recent Completed ({completedMatches.length})
                </h2>
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="dashboard-btn-collapse"
                >
                  {showCompleted ? 'Hide' : 'Show'}
                </button>
              </div>
              {showCompleted && (
                <div className="dashboard-match-grid">
                  {completedMatches.map(match => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      currentUserId={user.id}
                      onSelect={onSelectMatch}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {showCreateDialog && (
        <CreateMatchDialog
          username={user.username}
          preferredRulesetId={user.preferredRulesetId}
          onClose={() => setShowCreateDialog(false)}
          onCreateMatch={(name, maxPlayers, isPublic) => {
            onCreateMatch(name, maxPlayers, isPublic)
            setShowCreateDialog(false)
          }}
        />
      )}

      {showRulesetDialog && (
        <div className="dashboard-dialog-overlay" onClick={() => setShowRulesetDialog(false)}>
          <div className="dashboard-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="dashboard-dialog-title">Switch Ruleset</h3>
            <p className="dashboard-dialog-text">
              Switch to <strong>{RULESET_LABELS[otherRulesetId]}</strong>?
            </p>
            <div className="dashboard-dialog-actions">
              <button
                className="dashboard-dialog-btn dashboard-dialog-btn--cancel"
                onClick={() => setShowRulesetDialog(false)}
              >
                Cancel
              </button>
              <button
                className="dashboard-dialog-btn dashboard-dialog-btn--confirm"
                onClick={handleSwitchRuleset}
              >
                Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {rulesetToast && (
        <div className="dashboard-toast">{rulesetToast}</div>
      )}
    </div>
  )
}
