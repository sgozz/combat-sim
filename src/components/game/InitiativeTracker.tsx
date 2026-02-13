import { Tooltip } from '../ui/Tooltip'
import { useGameContext } from '../../contexts/GameContext'

export const InitiativeTracker = () => {
  const { matchState, player, selectedTargetId, onCombatantClick } = useGameContext()
  const currentPlayerId = player?.id
  if (!matchState) return <div className="initiative-tracker-center" />
  
  const activeIndex = matchState.players.findIndex(p => p.id === matchState.activeTurnPlayerId)

  return (
    <div className="initiative-tracker-center">
      <div className="round-badge">R{matchState.round}</div>
      <div className="initiative-cards">
        {matchState.players.map((p, i) => {
          const combatant = matchState.combatants.find(c => c.playerId === p.id)
          const character = combatant ? matchState.characters.find(c => c.id === combatant.characterId) : null
          const isActive = i === activeIndex
          const isDead = combatant && combatant.currentHP <= 0
          const isSelf = p.id === currentPlayerId
          const isSelected = p.id === selectedTargetId
          const isTappable = !isSelf && !isDead
          
          const tooltipContent = character 
            ? `${character.name} (HP: ${combatant?.currentHP}/${character.derived.hitPoints})`
            : p.name

          return (
            <Tooltip key={p.id} content={tooltipContent} position="bottom">
              <div 
                className={`init-card ${isActive ? 'active' : ''} ${isDead ? 'dead' : ''} ${isSelected ? 'selected-target' : ''} ${isTappable ? 'tappable' : ''}`}
                onClick={isTappable ? () => onCombatantClick(p.id) : undefined}
                role={isTappable ? 'button' : undefined}
                tabIndex={isTappable ? 0 : undefined}
              >
                <span className="init-icon">{p.isBot ? '🤖' : '👤'}</span>
                <span className="init-name">{character?.name ?? p.name}</span>
              </div>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
