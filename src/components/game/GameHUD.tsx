import { useState } from 'react'
import { Tooltip } from '../ui/Tooltip'
import { CombatLog } from './CombatLog'
import { WaitTriggerPicker } from '../ui/WaitTriggerPicker'
import { ReadyPanel } from '../ui/ReadyPanel'
import { PostureControls } from '../ui/PostureControls'
import { getHitProbability } from './shared/useGameActions'
import type { MatchState, Player, CombatActionPayload, ManeuverType, HitLocation, ReadyAction, EquipmentSlot, WaitTrigger } from '../../../shared/types'
import { hexDistance } from '../../utils/hex'
import { getRangePenalty, getHitLocationPenalty, calculateEncumbrance } from '../../../shared/rules'
import type { RulesetUIAdapter } from '../../../shared/rulesets/Ruleset'
import { rulesets } from '../../../shared/rulesets'
import { getRulesetUiSlots } from './shared/rulesetUiSlots'

type GamePanelProps = {
  matchState: MatchState | null
  player: Player | null
  lobbyPlayers: Player[]
  lobbyId: string | null
  isMyTurn: boolean
  onAction: (action: string, payload?: CombatActionPayload) => void
}

export const GameStatusPanel = ({ 
  matchState, 
  player, 
  lobbyPlayers,
  isMyTurn,
  onAction
}: GamePanelProps) => {
  const [collapsed, setCollapsed] = useState(false)
  const activeCombatant = matchState?.combatants.find((combatant) => combatant.playerId === player?.id) ?? null
  const character = matchState?.characters.find((c) => c.id === activeCombatant?.characterId) ?? null
  const encumbrance = character ? calculateEncumbrance(character.attributes.strength, character.equipment) : null
  
  const hpMax = character?.derived.hitPoints ?? 10
  const fpMax = character?.derived.fatiguePoints ?? 10
  const hpCurrent = activeCombatant?.currentHP ?? hpMax
  const fpCurrent = activeCombatant?.currentFP ?? fpMax
  const hpPercent = Math.max(0, (hpCurrent / hpMax) * 100)
  const fpPercent = Math.max(0, (fpCurrent / fpMax) * 100)
  
  let hpColor = '#4f4'
  if (hpPercent <= 20) hpColor = '#f44'
  else if (hpPercent <= 50) hpColor = '#ff4'

  return (
    <aside className={`panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        <span>{character?.name ?? 'Status'}</span>
        <button className="panel-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? '▶' : '◀'}
        </button>
      </div>
      {!collapsed && <div className="panel-content">
        {activeCombatant && character && (
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
            {activeCombatant.statusEffects.length > 0 && (
              <div className="status-effects-list">
                {activeCombatant.statusEffects.map(effect => (
                  <span key={effect} className="status-tag">{effect}</span>
                ))}
              </div>
            )}
            {activeCombatant.shockPenalty > 0 && (
              <div className="shock-indicator">
                <span className="shock-icon">⚡</span>
                <span className="shock-value">-{activeCombatant.shockPenalty}</span>
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
              currentPosture={activeCombatant.posture}
              basicMove={character.derived.basicMove}
              basicDodge={character.derived.dodge}
              isMyTurn={isMyTurn}
              onChangePosture={(payload) => onAction('action', payload)}
            />
          </div>
        )}

        {character && (
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
        )}

        {character && activeCombatant && (
          <div className="card">
            <h3>Equipment</h3>
            <div className="equipment-slots-grid">
              {(['right_hand', 'left_hand', 'back', 'belt', 'quiver'] as const).map(slot => {
                const item = activeCombatant.equipped.find(e => e.slot === slot)
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
        )}

        {character && character.skills.length > 0 && (
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

type GameActionPanelProps = {
  matchState: MatchState | null
  logs: string[]
  selectedTargetId: string | null
  currentManeuver: ManeuverType | null
  isMyTurn: boolean
  onAction: (action: string, payload?: CombatActionPayload) => void
  onLeaveLobby: () => void
  uiAdapter?: RulesetUIAdapter
}


export const GameActionPanel = ({ 
  matchState, 
  logs, 
  selectedTargetId,
  currentManeuver,
  isMyTurn,
  onAction,
  onLeaveLobby,
  uiAdapter,
}: GameActionPanelProps) => {
  const [collapsed, setCollapsed] = useState(false)
  const [selectedHitLocation, setSelectedHitLocation] = useState<HitLocation>('torso')
  const [deceptiveLevel, setDeceptiveLevel] = useState<0 | 1 | 2>(0)
  const [rapidStrike, setRapidStrike] = useState(false)
  const [showAOAVariantPicker, setShowAOAVariantPicker] = useState(false)
  const [showAODVariantPicker, setShowAODVariantPicker] = useState(false)
  const adapter = uiAdapter ?? rulesets[matchState?.rulesetId ?? 'gurps']?.ui ?? rulesets.gurps.ui
  const slots = getRulesetUiSlots(matchState?.rulesetId)
  const selectedTarget = matchState?.combatants.find(c => c.playerId === selectedTargetId)
  const selectedTargetName = selectedTarget 
    ? matchState?.characters.find(c => c.id === selectedTarget.characterId)?.name ?? 'Unknown'
    : null

  // --- Attack Preview Calculation ---
  const activeCombatant = matchState?.combatants.find(c => c.playerId === matchState.activeTurnPlayerId)
  const activeCharacter = activeCombatant ? matchState?.characters.find(c => c.id === activeCombatant.characterId) : null
  
  let hitChanceInfo = null
  if (selectedTarget && activeCombatant && activeCharacter) {
    const dist = hexDistance(
      activeCombatant.position.x, activeCombatant.position.z,
      selectedTarget.position.x, selectedTarget.position.z
    )
    
    const weapon = activeCharacter.equipment.find(e => (e.type === 'melee' || e.type === 'ranged') && e.skillUsed)
    
    let baseSkillLevel = 10
    let skillName = "Basic"
    
    if (weapon && weapon.skillUsed) {
      const skill = activeCharacter.skills.find(s => s.name === weapon.skillUsed)
      if (skill) {
        baseSkillLevel = skill.level
        skillName = skill.name
      }
    } else {
       const brawling = activeCharacter.skills.find(s => s.name === 'Brawling' || s.name === 'Karate' || s.name === 'Broadsword')
       if (brawling) {
         baseSkillLevel = brawling.level
         skillName = brawling.name
       }
    }

    const rangeMod = getRangePenalty(dist)
    const hitLocMod = getHitLocationPenalty(selectedHitLocation)
    const shockMod = activeCombatant.shockPenalty > 0 ? -activeCombatant.shockPenalty : 0
    const deceptiveMod = deceptiveLevel > 0 ? -(deceptiveLevel * 2) : 0
    const rapidStrikeMod = rapidStrike ? -6 : 0
    const effectiveSkill = baseSkillLevel + rangeMod + hitLocMod + shockMod + deceptiveMod + rapidStrikeMod
    const prob = getHitProbability(effectiveSkill)
    
    let color = '#ff4444'
    if (prob >= 70) color = '#44ff44'
    else if (prob >= 40) color = '#ffcc00'

    hitChanceInfo = {
      dist,
      baseSkillLevel,
      skillName,
      rangeMod,
      hitLocMod,
      shockMod,
      deceptiveMod,
      rapidStrikeMod,
      effectiveSkill,
      prob,
      color
    }
  }

  const renderContent = () => {
    if (!matchState) {
      return null
    }

    if (matchState.status === 'finished') {
      return (
        <div className="action-grid">
          <button className="action-btn danger" onClick={onLeaveLobby}>Leave Match</button>
        </div>
      )
    }

    if (isMyTurn && !currentManeuver) {
      if (showAOAVariantPicker) {
        return (
          <>
            <div className="aoa-variant-header">
              <button className="action-btn small" onClick={() => setShowAOAVariantPicker(false)}>
                <span className="btn-icon">←</span> Back
              </button>
              <span className="aoa-variant-title">All-Out Attack Variant</span>
            </div>
            <div className="aoa-variant-grid">
              {adapter.getAoaVariants().map(v => (
                <Tooltip key={v.variant} content={v.desc} position="top">
                  <button 
                    className={`aoa-variant-btn ${v.variant === 'feint' ? 'disabled' : ''}`}
                    disabled={v.variant === 'feint'}
                    onClick={() => {
                      setShowAOAVariantPicker(false)
                      onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'all_out_attack', aoaVariant: v.variant as import('../../../shared/types').AOAVariant })
                    }}
                  >
                    <span className="aoa-variant-label">{v.label}</span>
                    <span className="aoa-variant-desc">{v.desc}</span>
                  </button>
                </Tooltip>
              ))}
            </div>
          </>
        )
      }

      if (showAODVariantPicker) {
        return (
          <>
            <div className="aoa-variant-header">
              <button className="action-btn small" onClick={() => setShowAODVariantPicker(false)}>
                <span className="btn-icon">←</span> Back
              </button>
              <span className="aoa-variant-title">All-Out Defense Variant</span>
            </div>
            <div className="aoa-variant-grid">
              {adapter.getAodVariants().map(v => (
                <Tooltip key={v.variant} content={v.desc} position="top">
                  <button 
                    className={`aoa-variant-btn ${v.variant === 'double' ? 'disabled' : ''}`}
                    disabled={v.variant === 'double'}
                    onClick={() => {
                      setShowAODVariantPicker(false)
                      onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'all_out_defense', aodVariant: v.variant as import('../../../shared/types').AODVariant })
                    }}
                  >
                    <span className="aoa-variant-label">{v.label}</span>
                    <span className="aoa-variant-desc">{v.desc}</span>
                  </button>
                </Tooltip>
              ))}
            </div>
          </>
        )
      }
      
      return (
        <>
          <div className="maneuver-grid">
            {adapter.getManeuvers().map(m => (
              <Tooltip key={m.type} content={m.desc} position="top">
                <button 
                  className="maneuver-btn"
                  onClick={() => {
                    if (m.type === 'all_out_attack') {
                      setShowAOAVariantPicker(true)
                    } else if (m.type === 'all_out_defense') {
                      setShowAODVariantPicker(true)
                    } else {
                      onAction('select_maneuver', { type: 'select_maneuver', maneuver: m.type })
                    }
                  }}
                >
                  <span className="maneuver-icon">{m.icon}</span>
                  <span className="maneuver-label">{m.label}</span>
                  <span className="key-hint">{m.key}</span>
                </button>
              </Tooltip>
            ))}
          </div>
          <button 
            className="action-btn danger"
            style={{ marginTop: '1rem' }}
            onClick={() => {
              if (confirm('Surrender and end the match?')) {
                onAction('surrender', { type: 'surrender' })
              }
            }}
          >
            <span className="btn-icon">🏳️</span> Give Up
          </button>
        </>
      )
    }
    
    if (!isMyTurn) {
      return (
        <div className="action-section">
          <div className="action-hint">Waiting for opponent...</div>
          <button 
            className="action-btn danger"
            style={{ marginTop: '1rem' }}
            onClick={() => {
              if (confirm('Surrender and end the match?')) {
                onAction('surrender', { type: 'surrender' })
              }
            }}
          >
            <span className="btn-icon">🏳️</span> Give Up
          </button>
        </div>
      )
    }

    const maneuverLabel = currentManeuver ? adapter.getManeuvers().find(m => m.type === currentManeuver) : null

    const instructions = adapter.getManeuverInstructions(currentManeuver)
    const turnMovement = matchState?.turnMovement
    const inMovementPhase = turnMovement?.phase === 'moving'
    const movePointsRemaining = turnMovement?.movePointsRemaining ?? 0
    const freeRotationUsed = turnMovement?.freeRotationUsed ?? false
    const rotationCost = freeRotationUsed ? 1 : 0

    return (
      <div className="action-section">
        {currentManeuver && maneuverLabel && (
          <>
            <div className="current-maneuver-banner">
              <span className="maneuver-icon-small">{maneuverLabel.icon}</span>
              <span className="maneuver-name">{maneuverLabel.label}</span>
            </div>
            {!inMovementPhase && (
              <div className="maneuver-instructions">{instructions?.text ?? ''}</div>
            )}
          </>
        )}

        {inMovementPhase && (
          <div className="movement-phase-panel">
            <div className="movement-points">
              <span className="mp-icon">🏃</span>
              <span className="mp-value">{movePointsRemaining}</span>
              <span className="mp-label">MP</span>
            </div>
            <div className="movement-buttons">
              <button 
                className="action-btn"
                onClick={() => onAction('undo_movement', { type: 'undo_movement' })}
              >
                <span className="btn-icon">↩</span> Undo
              </button>
              <button 
                className="action-btn"
                onClick={() => onAction('skip_movement', { type: 'skip_movement' })}
              >
                <span className="btn-icon">⏭</span> Skip
              </button>
              <button 
                className="action-btn primary"
                onClick={() => onAction('confirm_movement', { type: 'confirm_movement' })}
              >
                <span className="btn-icon">✓</span> Confirm
              </button>
            </div>
          </div>
        )}
        
        {hitChanceInfo && instructions?.canAttack && (
          <div className="hit-chance-preview">
            <div className="hit-chance-header">
              <strong>Target: {selectedTargetName}</strong>
              <span>{hitChanceInfo.dist} hex{hitChanceInfo.dist !== 1 ? 'es' : ''}</span>
            </div>
            <div className="hit-chance-calc">
              {hitChanceInfo.skillName}: {hitChanceInfo.baseSkillLevel}
              {hitChanceInfo.rangeMod < 0 && ` (${hitChanceInfo.rangeMod} range)`}
              {hitChanceInfo.hitLocMod < 0 && ` (${hitChanceInfo.hitLocMod} ${selectedHitLocation.replace('_', ' ')})`}
              {hitChanceInfo.shockMod < 0 && ` (${hitChanceInfo.shockMod} shock)`}
              {hitChanceInfo.deceptiveMod < 0 && ` (${hitChanceInfo.deceptiveMod} deceptive)`}
              {hitChanceInfo.rapidStrikeMod < 0 && ` (${hitChanceInfo.rapidStrikeMod} rapid)`}
              {' → '}<strong>{hitChanceInfo.effectiveSkill}</strong>
            </div>
            <div className="hit-chance-value" style={{ color: hitChanceInfo.color }}>
              {hitChanceInfo.prob}% to hit
            </div>
          </div>
        )}

        {currentManeuver === 'wait' && activeCombatant && (
          <div className="wait-trigger-section" style={{ marginBottom: '1rem' }}>
            <WaitTriggerPicker
              enemies={matchState?.combatants
                .filter(c => c.playerId !== matchState.activeTurnPlayerId)
                .map(c => {
                  const char = matchState.characters.find(ch => ch.id === c.characterId)
                  return { id: c.playerId, name: char?.name ?? 'Unknown' }
                }) ?? []
              }
              onSetTrigger={(trigger: WaitTrigger) => {
                onAction('set_wait_trigger', { type: 'set_wait_trigger', trigger })
              }}
            />
          </div>
        )}

        {slots.renderActionConfiguration?.({
          matchState,
          player: matchState?.players.find(p => p.id === matchState?.activeTurnPlayerId) ?? null,
          selectedTargetId,
          currentManeuver,
          isMyTurn,
          onAction,
          attackOptions: {
            hitLocation: selectedHitLocation,
            setHitLocation: setSelectedHitLocation,
            deceptiveLevel,
            setDeceptiveLevel,
            rapidStrike,
            setRapidStrike,
          },
        })}
        {currentManeuver === 'ready' && activeCombatant && activeCharacter && (
          <ReadyPanel
            equipped={activeCombatant.equipped}
            equipment={activeCharacter.equipment}
            onReadyAction={(action: ReadyAction, itemId: string, targetSlot?: EquipmentSlot) => {
              onAction('ready_action', { type: 'ready_action', action, itemId, targetSlot })
            }}
          />
        )}

        <div className="action-buttons">
        {instructions?.canAttack && (

            <button 
              className="action-btn primary"
              disabled={!selectedTargetId}
              onClick={() => selectedTargetId && onAction('attack', { type: 'attack', targetId: selectedTargetId, hitLocation: selectedHitLocation, deceptiveLevel, rapidStrike: currentManeuver === 'attack' && rapidStrike })}
            >
              <span className="btn-icon">⚔️</span>
              {selectedTargetId ? `Attack ${selectedTargetName} [${selectedHitLocation.replace('_', ' ')}]` : 'Select a target on map'}
            </button>
          )}

          {currentManeuver === 'evaluate' && (
            <button 
              className="action-btn primary"
              disabled={!selectedTargetId}
              onClick={() => selectedTargetId && onAction('evaluate_target', { type: 'evaluate_target', targetId: selectedTargetId })}
            >
              <span className="btn-icon">🔍</span>
              {selectedTargetId ? `Evaluate ${selectedTargetName}` : 'Select a target on map'}
            </button>
          )}
          
          {activeCombatant?.inCloseCombatWith && (
            <div className="close-combat-actions">
              <div className="cc-label">In Close Combat</div>
              {!activeCombatant.grapple?.grappling && !activeCombatant.grapple?.grappledBy && (
                <button 
                  className="action-btn"
                  onClick={() => onAction('grapple', { type: 'grapple', targetId: activeCombatant.inCloseCombatWith!, action: 'grab' })}
                >
                  Grapple
                </button>
              )}
              {activeCombatant.grapple?.grappling && (
                <>
                  <button 
                    className="action-btn"
                    onClick={() => onAction('grapple', { type: 'grapple', targetId: activeCombatant.grapple!.grappling!, action: 'throw' })}
                  >
                    Throw
                  </button>
                  <button 
                    className="action-btn"
                    onClick={() => onAction('grapple', { type: 'grapple', targetId: activeCombatant.grapple!.grappling!, action: 'lock' })}
                  >
                    Arm Lock
                  </button>
                  <button 
                    className="action-btn"
                    onClick={() => onAction('grapple', { type: 'grapple', targetId: activeCombatant.grapple!.grappling!, action: 'choke' })}
                  >
                    Choke
                  </button>
                  <button 
                    className="action-btn"
                    onClick={() => onAction('grapple', { type: 'grapple', targetId: activeCombatant.grapple!.grappling!, action: 'release' })}
                  >
                    Release
                  </button>
                </>
              )}
              {activeCombatant.grapple?.grappledBy && (
                <button 
                  className="action-btn warning"
                  onClick={() => onAction('break_free', { type: 'break_free' })}
                >
                  Break Free
                </button>
              )}
              <button 
                className="action-btn"
                onClick={() => onAction('exit_close_combat', { type: 'exit_close_combat' })}
              >
                Exit Close Combat
              </button>
            </div>
          )}
          
          {isMyTurn && !activeCombatant?.inCloseCombatWith && selectedTargetId && hitChanceInfo && hitChanceInfo.dist <= 1 && (instructions?.canAttack || instructions?.canMove) && (
            <button 
              className="action-btn"
              onClick={() => onAction('enter_close_combat', { type: 'enter_close_combat', targetId: selectedTargetId })}
            >
              Enter Close Combat
            </button>
          )}
          


          {!activeCombatant?.inCloseCombatWith && (
            <div className="facing-controls">
              <Tooltip content={inMovementPhase ? `Turn Left (${rotationCost} MP)` : 'Turn Left'} position="top">
                <button 
                  className="action-btn small"
                  onClick={() => onAction('turn_left', { type: 'turn_left' })}
                >
                  <span className="btn-icon">↶</span>
                </button>
              </Tooltip>
              <span className="facing-label">Facing</span>
              <Tooltip content={inMovementPhase ? `Turn Right (${rotationCost} MP)` : 'Turn Right'} position="top">
                <button 
                  className="action-btn small"
                  onClick={() => onAction('turn_right', { type: 'turn_right' })}
                >
                  <span className="btn-icon">↷</span>
                </button>
              </Tooltip>
            </div>
          )}

          <button 
            className="action-btn end-turn"
            onClick={() => onAction('end_turn', { type: 'end_turn' })}
          >
            <span className="btn-icon">⌛</span> End Turn
          </button>

          <button 
            className="action-btn danger"
            onClick={() => {
              if (confirm('Surrender and end the match?')) {
                onAction('surrender', { type: 'surrender' })
              }
            }}
          >
            <span className="btn-icon">🏳️</span> Give Up
          </button>
        </div>
      </div>
    )
  }

  const slotHeader = slots.renderActionPanelHeader?.({
    matchState,
    player: matchState?.players.find(p => p.id === matchState?.activeTurnPlayerId) ?? null,
    selectedTargetId,
    currentManeuver,
    isMyTurn,
    onAction,
  })

  return (
    <aside className={`panel panel-right ${collapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        <span>{slotHeader ?? (isMyTurn && !currentManeuver && matchState ? 'Choose Maneuver' : 'Actions')}</span>
        <button className="panel-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? '◀' : '▶'}
        </button>
      </div>
      {!collapsed && (
        <div className="panel-content">
          <div className="card">
            {renderContent()}
          </div>

          <CombatLog logs={logs} />
        </div>
      )}
    </aside>
  )
}

