import { Tooltip } from '../ui/Tooltip'
import type { MatchState } from '../../../shared/types'

export const InitiativeTracker = ({ matchState }: { matchState: MatchState | null }) => {
  if (!matchState) return null
  
  const activeIndex = matchState.players.findIndex(p => p.id === matchState.activeTurnPlayerId)
  if (activeIndex === -1) return null

  return (
    <div className="initiative-tracker">
      <div className="initiative-list">
        {matchState.players.map((player, i) => {
          const combatant = matchState.combatants.find(c => c.playerId === player.id)
          const character = combatant ? matchState.characters.find(c => c.id === combatant.characterId) : null
          
          const tooltipContent = character 
            ? `${character.name} (HP: ${combatant?.currentHP}/${character.derived.hitPoints}, FP: ${combatant?.currentFP}/${character.derived.fatiguePoints})`
            : player.name

          return (
            <Tooltip key={player.id} content={tooltipContent} position="bottom">
              <div 
                className={`initiative-card ${i === activeIndex ? 'active' : ''}`}
              >
                <div className="initiative-avatar">
                  {player.isBot ? '🤖' : '👤'}
                </div>
                <div className="initiative-name">{player.name}</div>
                {i === activeIndex && <div className="initiative-indicator">Current Turn</div>}
              </div>
            </Tooltip>
          )
        })}
      </div>
      <div className="round-counter">
        Round {matchState.round}
      </div>
    </div>
  )
}
