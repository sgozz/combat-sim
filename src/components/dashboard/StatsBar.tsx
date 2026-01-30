import type { MatchSummary } from '../../../shared/types'
import './StatsBar.css'

type StatsBarProps = {
  myMatches: MatchSummary[]
  currentUserId: string
}

export const StatsBar = ({ myMatches, currentUserId }: StatsBarProps) => {
  const finishedMatches = myMatches.filter(m => m.status === 'finished')
  const totalMatches = finishedMatches.length

  const wins = finishedMatches.filter(m => m.winnerId === currentUserId).length
  const losses = finishedMatches.filter(
    m => m.winnerId && m.winnerId !== currentUserId
  ).length

  const winRate = totalMatches > 0
    ? (wins / totalMatches * 100).toFixed(1)
    : null

  const getWinRateColor = () => {
    if (!winRate) return ''
    const rate = parseFloat(winRate)
    if (rate > 50) return 'win-rate-high'
    if (rate >= 40) return 'win-rate-medium'
    return 'win-rate-low'
  }

  return (
    <div className="stats-bar">
      <div className="stat-card">
        <div className="stat-label">Total Matches</div>
        <div className="stat-value">{totalMatches > 0 ? totalMatches : '--'}</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Wins</div>
        <div className="stat-value">{totalMatches > 0 ? wins : '--'}</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Losses</div>
        <div className="stat-value">{totalMatches > 0 ? losses : '--'}</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Win Rate</div>
        <div className={`stat-value ${getWinRateColor()}`}>
          {winRate ? `${winRate}%` : '--'}
        </div>
      </div>
    </div>
  )
}
