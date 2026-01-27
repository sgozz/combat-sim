import { useState } from 'react'
import { PostureControls } from './PostureControls'
import { calculateEncumbrance } from '../../../../shared/rulesets/gurps/rules'
import { isGurpsCharacter } from '../../../../shared/rulesets/characterSheet'
import { isGurpsCombatant } from '../../../../shared/rulesets'
import type { GameStatusPanelProps } from '../types'

export const GurpsGameStatusPanel = ({ 
  player, 
  combatant,
  character,
  lobbyPlayers,
  isMyTurn,
  onAction
}: GameStatusPanelProps) => {
  const [collapsed, setCollapsed] = useState(false)
  
  if (!isGurpsCharacter(character) || !isGurpsCombatant(combatant)) {
    return null
  }
  
  const encumbrance = calculateEncumbrance(character.attributes.strength, character.equipment)
  
  const hpMax = character.derived.hitPoints
  const fpMax = character.derived.fatiguePoints
  const hpCurrent = combatant.currentHP
  const fpCurrent = combatant.currentFP
  const hpPercent = Math.max(0, (hpCurrent / hpMax) * 100)
  const fpPercent = Math.max(0, (fpCurrent / fpMax) * 100)
  
  let hpColor = '#4f4'
  if (hpPercent <= 20) hpColor = '#f44'
  else if (hpPercent <= 50) hpColor = '#ff4'

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
          <div className="stat-bar-row">
            <span className="stat-label">FP</span>
            <div className="stat-bar-track">
              <div className="stat-bar-fill fp" style={{ width: `${fpPercent}%` }} />
            </div>
            <span className="stat-value">{fpCurrent}/{fpMax}</span>
          </div>
          
          {combatant.statusEffects.length > 0 && (
            <div className="status-effects-list">
              {combatant.statusEffects.map(effect => (
                <span key={effect} className="status-tag">{effect}</span>
              ))}
            </div>
          )}
          
          {combatant.shockPenalty > 0 && (
            <div className="shock-indicator">
              <span className="shock-icon">⚡</span>
              <span className="shock-value">-{combatant.shockPenalty}</span>
              <span className="shock-label">Shock</span>
            </div>
          )}
          
          {encumbrance && encumbrance.level > 0 && (
            <div className="encumbrance-indicator">
              <span>Enc: <span style={{ color: encumbrance.level === 1 ? '#ff4' : encumbrance.level === 2 ? '#f80' : '#f44', fontWeight: 'bold' }}>{encumbrance.name}</span></span>
              <span className="encumbrance-effects">{encumbrance.movePenalty} Move, {encumbrance.dodgePenalty} Dodge</span>
            </div>
          )}
          
          <PostureControls
            currentPosture={combatant.posture}
            basicMove={character.derived.basicMove}
            basicDodge={character.derived.dodge}
            isMyTurn={isMyTurn}
            onChangePosture={(payload) => onAction('action', payload)}
          />
        </div>

        <div className="card">
          <h3>Attributes</h3>
          <div className="attributes-grid">
            <div className="attr-item">
              <span className="attr-label">ST</span>
              <span className="attr-value">{character.attributes.strength}</span>
            </div>
            <div className="attr-item">
              <span className="attr-label">DX</span>
              <span className="attr-value">{character.attributes.dexterity}</span>
            </div>
            <div className="attr-item">
              <span className="attr-label">IQ</span>
              <span className="attr-value">{character.attributes.intelligence}</span>
            </div>
            <div className="attr-item">
              <span className="attr-label">HT</span>
              <span className="attr-value">{character.attributes.health}</span>
            </div>
          </div>
          <div className="derived-stats">
            <span>Speed: {character.derived.basicSpeed}</span>
            <span>Move: {character.derived.basicMove}</span>
            <span>Dodge: {character.derived.dodge}</span>
          </div>
        </div>

        <div className="card">
          <h3>Equipment</h3>
          <div className="equipment-slots-grid">
            {(['right_hand', 'left_hand', 'back', 'belt', 'quiver'] as const).map(slot => {
              const item = combatant.equipped.find(e => e.slot === slot)
              const eq = item ? character.equipment.find(e => e.id === item.equipmentId) : null
              
              return (
                <div key={slot} className={`equipment-slot-container ${item ? 'filled' : ''}`}>
                  <span className="equipment-slot-label">{slot.replace('_', ' ')}</span>
                  {item && eq ? (
                    <div className="equipment-slot-content">
                      <div className="equipment-slot-name">
                        <span>{eq.type === 'melee' ? '🗡️' : eq.type === 'ranged' ? '🏹' : eq.type === 'shield' ? '🛡️' : '📦'}</span>
                        <span>{eq.name}</span>
                      </div>
                      <div className="equipment-slot-details">
                         <span className={`equipment-ready ${item.ready ? 'ready' : 'unready'}`} style={{ marginRight: '4px' }}>
                           {item.ready ? 'Ready' : 'Unready'}
                         </span>
                         {eq.damage && <span>{eq.damage}</span>}
                         {eq.block && <span>Block: {eq.block}</span>}
                      </div>
                    </div>
                  ) : (
                    <span className="equipment-slot-empty">Empty</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {character.skills.length > 0 && (
          <div className="card">
            <h3>Skills</h3>
            <div className="skills-list">
              {character.skills.map(skill => (
                <div key={skill.id} className="skill-item">
                  <span className="skill-name">{skill.name}</span>
                  <span className="skill-level">{skill.level}</span>
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
