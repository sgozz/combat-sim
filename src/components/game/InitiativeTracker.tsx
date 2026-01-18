import { Tooltip } from '../ui/Tooltip'
import type { MatchState } from '../../../shared/types'

export const InitiativeTracker = ({ matchState }: { matchState: MatchState | null }) => {
  if (!matchState) return <div className="initiative-tracker-center" />
  
  const activeIndex = matchState.players.findIndex(p => p.id === matchState.activeTurnPlayerId)

  return (
    <div className="initiative-tracker-center">
      <div className="round-badge">R{matchState.round}</div>
      <div className="initiative-cards">
        {matchState.players.map((player, i) => {
          const combatant = matchState.combatants.find(c => c.playerId === player.id)
          const character = combatant ? matchState.characters.find(c => c.id === combatant.characterId) : null
          const isActive = i === activeIndex
          const isDead = combatant && combatant.currentHP <= 0
          
          const tooltipContent = character 
            ? `${character.name} (HP: ${combatant?.currentHP}/${character.derived.hitPoints})`
            : player.name

          return (
            <Tooltip key={player.id} content={tooltipContent} position="bottom">
              <div className={`init-card ${isActive ? 'active' : ''} ${isDead ? 'dead' : ''}`}>
                <span className="init-icon">{player.isBot ? '🤖' : '👤'}</span>
                <span className="init-name">{character?.name ?? player.name}</span>
              </div>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
