type MatchEndOverlayProps = {
  matchStatus: 'waiting' | 'active' | 'paused' | 'finished'
  winnerName: string | undefined
  currentPlayerName: string | undefined
  onReturnToDashboard: () => void
}

export const MatchEndOverlay = ({
  matchStatus,
  winnerName,
  currentPlayerName,
  onReturnToDashboard,
}: MatchEndOverlayProps) => {
  if (matchStatus !== 'finished') return null

  const isVictory = winnerName && winnerName === currentPlayerName
  const isDefeat = winnerName && winnerName !== currentPlayerName

  let title: string
  let message: string
  let className: string

  if (isVictory) {
    title = 'VICTORY!'
    message = `You won the match!`
    className = 'victory'
  } else if (isDefeat) {
    title = 'DEFEAT'
    message = `${winnerName} won the match.`
    className = 'defeat'
  } else {
    title = 'MATCH ENDED'
    message = 'Draw'
    className = 'draw'
  }

  return (
    <div className={`match-end-overlay ${className}`}>
      <div className="match-end-card">
        <h1 className="match-end-title">{title}</h1>
        <p className="match-end-message">{message}</p>
        <button
          className="btn-primary match-end-btn"
          onClick={onReturnToDashboard}
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  )
}
