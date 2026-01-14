import type { MatchState } from '../../../shared/types'

export const InitiativeTracker = ({ matchState }: { matchState: MatchState | null }) => {
  if (!matchState) return null
  
  const activeIndex = matchState.players.findIndex(p => p.id === matchState.activeTurnPlayerId)
  if (activeIndex === -1) return null

  return (
    <div className="initiative-tracker">
      <div className="initiative-list">
        {matchState.players.map((player, i) => (
          <div 
            key={player.id} 
            className={`initiative-card ${i === activeIndex ? 'active' : ''}`}
          >
            <div className="initiative-avatar">
              {player.isBot ? '🤖' : '👤'}
            </div>
            <div className="initiative-name">{player.name}</div>
            {i === activeIndex && <div className="initiative-indicator">Current Turn</div>}
          </div>
        ))}
      </div>
      <div className="round-counter">
        Round {matchState.round}
      </div>
    </div>
  )
}
