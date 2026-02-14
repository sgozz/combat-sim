import type { UserMatchStats } from '../../../shared/types'
import './StatsBar.css'

type StatsBarProps = {
  stats: UserMatchStats | null
}

export const StatsBar = ({ stats }: StatsBarProps) => {
  const totalMatches = stats?.totalMatches ?? 0
  const wins = stats?.wins ?? 0
  const losses = stats?.losses ?? 0

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
    <div className={`stats-bar${totalMatches === 0 ? ' stats-bar--empty' : ''}`}>
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
