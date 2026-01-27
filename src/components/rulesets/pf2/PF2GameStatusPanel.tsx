import { useState } from 'react'
import type { GameStatusPanelProps } from '../types'
import { isPF2Character } from '../../../../shared/rulesets/characterSheet'

export const PF2GameStatusPanel = ({ 
  player, 
  combatant,
  character,
  lobbyPlayers,
}: GameStatusPanelProps) => {
  const [collapsed, setCollapsed] = useState(false)
  
  if (!isPF2Character(character)) {
    return null
  }
  
  const hpMax = character.derived.hitPoints
  const hpCurrent = combatant.currentHP
  const hpPercent = Math.max(0, (hpCurrent / hpMax) * 100)
  
  let hpColor = '#4f4'
  if (hpPercent <= 20) hpColor = '#f44'
  else if (hpPercent <= 50) hpColor = '#ff4'

  const actionsRemaining = combatant.pf2?.actionsRemaining ?? combatant.attacksRemaining ?? 3
  const attacksThisTurn = combatant.pf2?.attacksThisTurn ?? 0
  
  const getMapPenalty = () => {
    if (attacksThisTurn === 0) return 0
    if (attacksThisTurn === 1) return -5
    return -10
  }

  return (
    <aside className={`panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        <span>{character.name}</span>
        <button className="panel-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? '▶' : '◀'}
        </button>
      </div>
      {!collapsed && <div className="panel-content">
        <div className="card character-status-card">
          <div className="stat-bar-row">
            <span className="stat-label">HP</span>
            <div className="stat-bar-track">
              <div className="stat-bar-fill" style={{ width: `${hpPercent}%`, backgroundColor: hpColor }} />
            </div>
            <span className="stat-value">{hpCurrent}/{hpMax}</span>
          </div>
          
          <div className="pf2-status-section">
            <div className="pf2-actions-display">
              <span className="pf2-label">Actions: </span>
              <span className="pf2-action-icons">
                {Array.from({ length: 3 }, (_, i) => (
                  <span
                    key={i}
                    className={`pf2-action-icon ${i < actionsRemaining ? 'available' : 'used'}`}
                    title={i < actionsRemaining ? 'Available' : 'Used'}
                  >
                    {i < actionsRemaining ? '●' : '○'}
                  </span>
                ))}
              </span>
            </div>
            {attacksThisTurn > 0 && (
              <div className="pf2-map-display">
                <span className="pf2-label">Next Attack: </span>
                <span 
                  className="pf2-map-value"
                  style={{ color: getMapPenalty() < -5 ? '#f44' : getMapPenalty() < 0 ? '#ff4' : '#4f4' }}
                >
                  {getMapPenalty() === 0 ? '+0' : `${getMapPenalty()}`}
                </span>
              </div>
            )}
          </div>
          
          {combatant.statusEffects.length > 0 && (
            <div className="status-effects-list">
              {combatant.statusEffects.map(effect => (
                <span key={effect} className="status-tag">{effect}</span>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Abilities</h3>
          <div className="attributes-grid pf2-abilities">
            <div className="attr-item">
              <span className="attr-label">STR</span>
              <span className="attr-value">{character.abilities.strength}</span>
            </div>
            <div className="attr-item">
              <span className="attr-label">DEX</span>
              <span className="attr-value">{character.abilities.dexterity}</span>
            </div>
            <div className="attr-item">
              <span className="attr-label">CON</span>
              <span className="attr-value">{character.abilities.constitution}</span>
            </div>
            <div className="attr-item">
              <span className="attr-label">INT</span>
              <span className="attr-value">{character.abilities.intelligence}</span>
            </div>
            <div className="attr-item">
              <span className="attr-label">WIS</span>
              <span className="attr-value">{character.abilities.wisdom ?? 10}</span>
            </div>
            <div className="attr-item">
              <span className="attr-label">CHA</span>
              <span className="attr-value">{character.abilities.charisma ?? 10}</span>
            </div>
          </div>
          <div className="derived-stats pf2-derived">
            <span>AC: {character.derived.armorClass}</span>
            <span>Speed: {character.derived.speed} ft</span>
          </div>
        </div>

        <div className="card">
          <h3>Weapons</h3>
          <div className="pf2-weapons-list">
            {character.weapons.map(weapon => (
              <div key={weapon.id} className="pf2-weapon-item">
                <span className="weapon-name">{weapon.name}</span>
                <span className="weapon-damage">{weapon.damage}</span>
              </div>
            ))}
            {character.weapons.length === 0 && (
              <div className="empty-list">Unarmed</div>
            )}
          </div>
        </div>

        {character.skills.length > 0 && (
          <div className="card">
            <h3>Skills</h3>
            <div className="skills-list">
              {character.skills.map(skill => (
                <div key={skill.id} className="skill-item">
                  <span className="skill-name">{skill.name}</span>
                  <span className="skill-level">+{skill.proficiency}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <h3>Participants</h3>
          <ul className="participants-list">
            {lobbyPlayers.length > 0 ? (
              lobbyPlayers.map((participant) => (
                <li key={participant.id}>
                  {participant.name}{participant.id === player?.id ? ' (You)' : ''}
                </li>
              ))
            ) : (
              <li>No players</li>
            )}
          </ul>
        </div>
      </div>}
    </aside>
  )
}
