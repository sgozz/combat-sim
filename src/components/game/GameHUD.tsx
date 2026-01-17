import { useState } from 'react'
import { Tooltip } from '../ui/Tooltip'
import { CombatLog } from './CombatLog'
import HitLocationPicker from '../ui/HitLocationPicker'
import { WaitTriggerPicker } from '../ui/WaitTriggerPicker'
import { ReadyPanel } from '../ui/ReadyPanel'
import { PostureControls } from '../ui/PostureControls'
import type { MatchState, Player, CombatActionPayload, ManeuverType, HitLocation, AOAVariant, AODVariant, ReadyAction, EquipmentSlot, WaitTrigger } from '../../../shared/types'
import { hexDistance } from '../../utils/hex'
import { getRangePenalty, getHitLocationPenalty, calculateEncumbrance } from '../../../shared/rules'

const PROBABILITY_TABLE: Record<number, number> = {
  3: 0.5, 4: 1.9, 5: 4.6, 6: 9.3, 7: 16.2, 8: 25.9, 9: 37.5,
  10: 50.0, 11: 62.5, 12: 74.1, 13: 83.8, 14: 90.7, 15: 95.4, 16: 98.1
}

const getHitProbability = (skill: number): number => {
  if (skill <= 3) return 0.5
  if (skill >= 17) return 99
  return PROBABILITY_TABLE[skill] ?? 50
}

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
  onStartMatch: () => void
  onOpenCharacterEditor: () => void
  onCreateLobby: () => void
  onJoinLobby: () => void
  inLobbyButNoMatch: boolean
}

const MANEUVERS: { type: ManeuverType; label: string; icon: string; desc: string; key: string }[] = [
  { type: 'move', label: 'Move', icon: '🏃', desc: 'Full move. No attack. Active defense allowed.', key: '1' },
  { type: 'attack', label: 'Attack', icon: '⚔️', desc: 'Standard attack. Step allowed. Active defense allowed.', key: '2' },
  { type: 'all_out_attack', label: 'All-Out Attack', icon: '😡', desc: 'Bonus to hit or damage. Half move. NO DEFENSE.', key: '3' },
  { type: 'all_out_defense', label: 'All-Out Defense', icon: '🛡️', desc: 'Bonus to defense (+2). Step allowed. No attack.', key: '4' },
  { type: 'move_and_attack', label: 'Move & Attack', icon: '🤸', desc: 'Full move and attack. -4 skill (max 9). No Parry/Block.', key: '5' },
  { type: 'aim', label: 'Aim', icon: '🎯', desc: 'Accumulate Accuracy bonus. Step allowed.', key: '6' },
  { type: 'evaluate', label: 'Evaluate', icon: '🔍', desc: 'Study target. +1 to hit (max +3). Step allowed.', key: '7' },
  { type: 'wait', label: 'Wait', icon: '⏳', desc: 'Prepare to react when triggered.', key: '8' },
  { type: 'ready', label: 'Ready', icon: '🗡️', desc: 'Draw, sheathe, or prepare a weapon. Step allowed.', key: '9' },
  { type: 'change_posture', label: 'Change Posture', icon: '🧎', desc: 'Rise from kneeling/prone. Use for non-free posture changes.', key: '-' },
  { type: 'do_nothing', label: 'Do Nothing', icon: '💤', desc: 'Recover from stun or wait. No move.', key: '0' },
]

export const GameActionPanel = ({ 
  matchState, 
  logs, 
  selectedTargetId,
  currentManeuver,
  isMyTurn,
  onAction,
  onLeaveLobby,
  onStartMatch,
  onOpenCharacterEditor,
  onCreateLobby,
  onJoinLobby,
  inLobbyButNoMatch
}: GameActionPanelProps) => {
  const [collapsed, setCollapsed] = useState(false)
  const [selectedHitLocation, setSelectedHitLocation] = useState<HitLocation>('torso')
  const [deceptiveLevel, setDeceptiveLevel] = useState<0 | 1 | 2>(0)
  const [showAOAVariantPicker, setShowAOAVariantPicker] = useState(false)
  const [showAODVariantPicker, setShowAODVariantPicker] = useState(false)
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
    const effectiveSkill = baseSkillLevel + rangeMod + hitLocMod + shockMod + deceptiveMod
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
      effectiveSkill,
      prob,
      color
    }
  }

  const renderContent = () => {
    if (!matchState) {
      if (inLobbyButNoMatch) {
        return (
          <div className="action-grid">
            <button className="action-btn" onClick={onOpenCharacterEditor}>Edit Character</button>
            <button className="action-btn primary" onClick={onStartMatch}>Start Match</button>
            <button className="action-btn danger" onClick={onLeaveLobby}>Leave Lobby</button>
          </div>
        )
      }
      return (
        <div className="action-grid">
          <button className="action-btn" onClick={onOpenCharacterEditor}>Edit Character</button>
          <button className="action-btn primary" onClick={onCreateLobby}>Create Lobby</button>
          <button className="action-btn" onClick={onJoinLobby}>Join Lobby</button>
        </div>
      )
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
        const AOA_VARIANTS: { variant: AOAVariant; label: string; desc: string }[] = [
          { variant: 'determined', label: 'Determined', desc: '+4 to hit' },
          { variant: 'strong', label: 'Strong', desc: '+2 damage' },
          { variant: 'double', label: 'Double', desc: 'Two attacks at full skill' },
          { variant: 'feint', label: 'Feint', desc: 'Attack + Feint (not implemented)' },
        ]
        return (
          <>
            <div className="aoa-variant-header">
              <button className="action-btn small" onClick={() => setShowAOAVariantPicker(false)}>
                <span className="btn-icon">←</span> Back
              </button>
              <span className="aoa-variant-title">All-Out Attack Variant</span>
            </div>
            <div className="aoa-variant-grid">
              {AOA_VARIANTS.map(v => (
                <Tooltip key={v.variant} content={v.desc} position="top">
                  <button 
                    className={`aoa-variant-btn ${v.variant === 'feint' ? 'disabled' : ''}`}
                    disabled={v.variant === 'feint'}
                    onClick={() => {
                      setShowAOAVariantPicker(false)
                      onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'all_out_attack', aoaVariant: v.variant })
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
        const AOD_VARIANTS: { variant: AODVariant; label: string; desc: string }[] = [
          { variant: 'increased_dodge', label: 'Increased Dodge', desc: '+2 to Dodge' },
          { variant: 'increased_parry', label: 'Increased Parry', desc: '+2 to Parry' },
          { variant: 'increased_block', label: 'Increased Block', desc: '+2 to Block' },
          { variant: 'double', label: 'Double Defense', desc: 'Two different defenses vs same attack' },
        ]
        return (
          <>
            <div className="aoa-variant-header">
              <button className="action-btn small" onClick={() => setShowAODVariantPicker(false)}>
                <span className="btn-icon">←</span> Back
              </button>
              <span className="aoa-variant-title">All-Out Defense Variant</span>
            </div>
            <div className="aoa-variant-grid">
              {AOD_VARIANTS.map(v => (
                <Tooltip key={v.variant} content={v.desc} position="top">
                  <button 
                    className={`aoa-variant-btn ${v.variant === 'double' ? 'disabled' : ''}`}
                    disabled={v.variant === 'double'}
                    onClick={() => {
                      setShowAODVariantPicker(false)
                      onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'all_out_defense', aodVariant: v.variant })
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
            {MANEUVERS.map(m => (
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

    const maneuverLabel = currentManeuver ? MANEUVERS.find(m => m.type === currentManeuver) : null

    const getManeuverInstructions = () => {
      switch (currentManeuver) {
        case 'move':
          return { text: 'Click a hex to move. Full movement allowed.', canAttack: false, canMove: true, isStep: false }
        case 'attack':
          return { text: 'Click enemy to attack. You can step 1 hex first.', canAttack: true, canMove: true, isStep: true }
        case 'all_out_attack':
          return { text: 'Click enemy to attack (+4 to hit). NO DEFENSE this turn!', canAttack: true, canMove: false, isStep: false }
        case 'all_out_defense':
          return { text: 'Defending. +2 to all defenses. Click End Turn.', canAttack: false, canMove: false, isStep: false }
        case 'move_and_attack':
          return { text: 'Move then attack (-4 to hit, max skill 9).', canAttack: true, canMove: true, isStep: false }
        case 'aim':
          return { text: 'Aiming. You gain +Acc bonus next turn.', canAttack: false, canMove: false, isStep: false }
        case 'evaluate':
          return { text: 'Click enemy to study. +1 to hit (max +3).', canAttack: false, canMove: false, isStep: false, canEvaluate: true }
        case 'ready':
          return { text: 'Draw, sheathe, or prepare equipment.', canAttack: false, canMove: false, isStep: true, canReady: true }
        case 'wait':
          return { text: 'Set a trigger condition to interrupt enemy turn.', canAttack: false, canMove: false, isStep: false }
        case 'change_posture':
          return { text: 'Use Posture Controls to change posture.', canAttack: false, canMove: false, isStep: false }
        case 'do_nothing':
          return { text: 'Recover from stun or pass turn.', canAttack: false, canMove: false, isStep: false }
        default:
          return { text: '', canAttack: false, canMove: false, isStep: false }
      }
    }

    const instructions = getManeuverInstructions()
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
              <div className="maneuver-instructions">{instructions.text}</div>
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
        
        {instructions.canAttack && (
          <div className="hit-location-section">
            <HitLocationPicker
              selectedLocation={selectedHitLocation}
              onSelect={setSelectedHitLocation}
              disabled={!selectedTargetId}
            />
          </div>
        )}

        {hitChanceInfo && instructions.canAttack && (
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
              {' → '}<strong>{hitChanceInfo.effectiveSkill}</strong>
            </div>
            <div className="hit-chance-value" style={{ color: hitChanceInfo.color }}>
              {hitChanceInfo.prob}% to hit
            </div>
          </div>
        )}

        {instructions.canAttack && selectedTargetId && (
          <div className="deceptive-attack-section">
            <label className="deceptive-label">Deceptive Attack:</label>
            <div className="deceptive-buttons">
              <button 
                className={`deceptive-btn ${deceptiveLevel === 0 ? 'active' : ''}`}
                onClick={() => setDeceptiveLevel(0)}
              >
                None
              </button>
              <button 
                className={`deceptive-btn ${deceptiveLevel === 1 ? 'active' : ''}`}
                onClick={() => setDeceptiveLevel(1)}
              >
                -2 hit / -1 def
              </button>
              <button 
                className={`deceptive-btn ${deceptiveLevel === 2 ? 'active' : ''}`}
                onClick={() => setDeceptiveLevel(2)}
              >
                -4 hit / -2 def
              </button>
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
          {instructions.canAttack && (
            <button 
              className="action-btn primary"
              disabled={!selectedTargetId}
              onClick={() => selectedTargetId && onAction('attack', { type: 'attack', targetId: selectedTargetId, hitLocation: selectedHitLocation, deceptiveLevel })}
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
          
          {isMyTurn && !activeCombatant?.inCloseCombatWith && selectedTargetId && hitChanceInfo && hitChanceInfo.dist <= 1 && (instructions.canAttack || instructions.canMove) && (
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

  return (
    <aside className={`panel panel-right ${collapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        <span>{isMyTurn && !currentManeuver && matchState ? 'Choose Maneuver' : 'Actions'}</span>
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

