import { Tooltip } from '../ui/Tooltip'
import type { MatchState } from '../../../shared/types'

type InitiativeTrackerProps = {
  matchState: MatchState | null
  currentPlayerId?: string | null
  selectedTargetId?: string | null
  onCombatantClick?: (playerId: string) => void
}

export const InitiativeTracker = ({ matchState, currentPlayerId, selectedTargetId, onCombatantClick }: InitiativeTrackerProps) => {
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
          const isSelf = player.id === currentPlayerId
          const isSelected = player.id === selectedTargetId
          const isTappable = !isSelf && onCombatantClick && !isDead
          
          const tooltipContent = character 
            ? `${character.name} (HP: ${combatant?.currentHP}/${character.derived.hitPoints})`
            : player.name

          return (
            <Tooltip key={player.id} content={tooltipContent} position="bottom">
              <div 
                className={`init-card ${isActive ? 'active' : ''} ${isDead ? 'dead' : ''} ${isSelected ? 'selected-target' : ''} ${isTappable ? 'tappable' : ''}`}
                onClick={isTappable ? () => onCombatantClick(player.id) : undefined}
                role={isTappable ? 'button' : undefined}
                tabIndex={isTappable ? 0 : undefined}
              >
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
