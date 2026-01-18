import { useState, useEffect, useMemo } from 'react'
import type { ManeuverType, CombatActionPayload, MatchState, DefenseType, DefenseChoice, AOAVariant, AODVariant, WaitTrigger } from '../../../shared/types'
import { getDefenseOptions, calculateDefenseValue, getPostureModifiers, calculateEncumbrance } from '../../../shared/rules'
import { WaitTriggerPicker } from '../ui/WaitTriggerPicker'

type ActionBarProps = {
  isMyTurn: boolean
  currentManeuver: ManeuverType | null
  selectedTargetId: string | null
  matchState: MatchState | null
  inLobbyButNoMatch: boolean
  playerId: string | null
  lobbyPlayerCount: number
  onAction: (action: string, payload?: CombatActionPayload) => void
  onDefend: (choice: DefenseChoice) => void
  onLeaveLobby: () => void
  onStartMatch: (botCount: number) => void
  onOpenCharacterEditor: () => void
}

const MANEUVERS: { type: ManeuverType; label: string; icon: string }[] = [
  { type: 'move', label: 'Move', icon: '🏃' },
  { type: 'attack', label: 'Attack', icon: '⚔️' },
  { type: 'all_out_attack', label: 'All-Out', icon: '😡' },
  { type: 'all_out_defense', label: 'Defend', icon: '🛡️' },
  { type: 'move_and_attack', label: 'M&A', icon: '🤸' },
  { type: 'evaluate', label: 'Eval', icon: '🔍' },
  { type: 'wait', label: 'Wait', icon: '⏳' },
  { type: 'ready', label: 'Ready', icon: '🗡️' },
  { type: 'change_posture', label: 'Posture', icon: '🧎' },
]

const CLOSE_COMBAT_MANEUVERS: ManeuverType[] = ['attack', 'all_out_attack', 'all_out_defense']

// 3d6 probability of rolling <= N
const SUCCESS_CHANCE: Record<number, number> = {
  3: 0.5, 4: 1.9, 5: 4.6, 6: 9.3, 7: 16.2, 8: 25.9,
  9: 37.5, 10: 50.0, 11: 62.5, 12: 74.1, 13: 83.8,
  14: 90.7, 15: 95.4, 16: 98.1
}

const getSuccessChance = (target: number): number => {
  if (target < 3) return 0
  if (target >= 16) return 98.1
  return SUCCESS_CHANCE[target] || 0
}

export const ActionBar = ({ 
  isMyTurn, 
  currentManeuver, 
  selectedTargetId,
  matchState,
  inLobbyButNoMatch,
  playerId,
  lobbyPlayerCount,
  onAction,
  onDefend,
  onLeaveLobby,
  onStartMatch,
  onOpenCharacterEditor,
}: ActionBarProps) => {
  const [showManeuvers, setShowManeuvers] = useState(false)
  const [showWaitPicker, setShowWaitPicker] = useState(false)
  const [showAOAVariants, setShowAOAVariants] = useState(false)
  const [showAODVariants, setShowAODVariants] = useState(false)
  const [showCharacterSheet, setShowCharacterSheet] = useState(false)
  const [retreat, setRetreat] = useState(false)
  const [dodgeAndDrop, setDodgeAndDrop] = useState(false)
  const [botCount, setBotCount] = useState(1)
  
  const playerCombatant = playerId && matchState 
    ? matchState.combatants.find(c => c.playerId === playerId) 
    : null
  const playerCharacter = playerCombatant && matchState
    ? matchState.characters.find(c => c.id === playerCombatant.characterId)
    : null
  
  const encumbrance = playerCharacter ? calculateEncumbrance(playerCharacter.attributes.strength, playerCharacter.equipment) : null
    
  const maxHP = playerCharacter?.derived.hitPoints ?? 0
  const currentHP = playerCombatant?.currentHP ?? 0
  const hpPercent = maxHP > 0 ? Math.max(0, (currentHP / maxHP) * 100) : 0
  const hpColor = hpPercent > 50 ? '#4f4' : hpPercent > 25 ? '#ff0' : '#f44'
  const inCloseCombat = !!playerCombatant?.inCloseCombatWith
  const availableManeuvers = inCloseCombat 
    ? MANEUVERS.filter(m => CLOSE_COMBAT_MANEUVERS.includes(m.type))
    : MANEUVERS

  const pendingDefense = matchState?.pendingDefense
  const isDefending = pendingDefense?.defenderId === playerId

  useEffect(() => {
    if (!pendingDefense) {
      queueMicrotask(() => {
        setRetreat(false)
        setDodgeAndDrop(false)
      })
    }
  }, [pendingDefense])

  const defenseOptions = useMemo(() => {
    if (!playerCharacter || !playerCombatant || !pendingDefense) return null
    const derivedDodge = playerCharacter.derived.dodge
    const baseOpts = getDefenseOptions(playerCharacter, derivedDodge)
    const postureMods = getPostureModifiers(playerCombatant.posture)
    
    type ActiveDefenseType = 'dodge' | 'parry' | 'block'
    const getFinalValue = (type: ActiveDefenseType, base: number) => {
      return calculateDefenseValue(base, {
        retreat,
        dodgeAndDrop: type === 'dodge' ? dodgeAndDrop : false,
        inCloseCombat,
        defensesThisTurn: playerCombatant.defensesThisTurn,
        deceptivePenalty: pendingDefense.deceptivePenalty,
        postureModifier: postureMods.defenseVsMelee,
        defenseType: type
      })
    }

    return {
      dodge: getFinalValue('dodge', baseOpts.dodge),
      parry: baseOpts.parry ? getFinalValue('parry', baseOpts.parry.value) : null,
      block: baseOpts.block ? getFinalValue('block', baseOpts.block.value) : null,
      canRetreat: !playerCombatant.retreatedThisTurn
    }
  }, [playerCharacter, playerCombatant, pendingDefense, retreat, dodgeAndDrop, inCloseCombat])

  const handleDefense = (type: DefenseType | 'none') => {
    onDefend({
      type,
      retreat,
      dodgeAndDrop: type === 'dodge' ? dodgeAndDrop : false
    })
    setRetreat(false)
    setDodgeAndDrop(false)
  }

  if (!matchState) {
    if (inLobbyButNoMatch) {
      const maxBots = 4 - lobbyPlayerCount
      const totalPlayers = lobbyPlayerCount + botCount
      return (
        <div className="action-bar">
          <button className="action-bar-btn" onClick={onOpenCharacterEditor}>
            <span className="action-bar-icon">👤</span>
          </button>
          <div className="action-bar-bot-selector">
            <button 
              className="action-bar-btn small"
              onClick={() => setBotCount(Math.max(0, botCount - 1))}
              disabled={botCount <= 0}
            >−</button>
            <span className="bot-label">🤖 {botCount}</span>
            <button 
              className="action-bar-btn small"
              onClick={() => setBotCount(Math.min(maxBots, botCount + 1))}
              disabled={botCount >= maxBots}
            >+</button>
          </div>
          <button 
            className="action-bar-btn primary" 
            onClick={() => onStartMatch(botCount)}
            disabled={totalPlayers < 2}
          >
            <span className="action-bar-icon">▶️</span>
            <span className="action-bar-label">Start ({totalPlayers})</span>
          </button>
          <button className="action-bar-btn danger" onClick={onLeaveLobby}>
            <span className="action-bar-icon">🚪</span>
          </button>
        </div>
      )
    }
    return (
      <div className="action-bar">
        <span className="action-bar-label" style={{ color: '#888' }}>Loading...</span>
        <button className="action-bar-btn danger" onClick={onLeaveLobby}>
          <span className="action-bar-icon">🚪</span>
          <span className="action-bar-label">Back</span>
        </button>
      </div>
    )
  }

  if (matchState.status === 'finished') {
    return (
      <div className="action-bar">
        <button className="action-bar-btn danger" onClick={onLeaveLobby}>
          <span className="action-bar-icon">🚪</span>
          <span className="action-bar-label">Leave</span>
        </button>
      </div>
    )
  }

  if (isDefending && defenseOptions) {
    const attackerCombatant = matchState.combatants.find(c => c.playerId === pendingDefense?.attackerId)
    const attackerName = attackerCombatant 
      ? matchState.characters.find(c => c.id === attackerCombatant.characterId)?.name ?? 'Enemy'
      : 'Enemy'

    return (
      <>
        <div className="action-bar-defense-overlay">
          <div className="defense-alert">
            <span className="defense-alert-icon">⚠️</span>
            <span>{attackerName} attacks!</span>
          </div>
          
          <div className="defense-options-row">
            <label className="defense-option-toggle">
              <input 
                type="checkbox" 
                checked={retreat} 
                onChange={e => setRetreat(e.target.checked)}
                disabled={!defenseOptions.canRetreat}
              />
              <span>Retreat</span>
            </label>
            <label className="defense-option-toggle">
              <input 
                type="checkbox" 
                checked={dodgeAndDrop} 
                onChange={e => setDodgeAndDrop(e.target.checked)}
              />
              <span>Drop</span>
            </label>
          </div>
        </div>

        <div className="action-bar defense-mode">
          <button 
            className="action-bar-btn defense-btn dodge"
            onClick={() => handleDefense('dodge')}
          >
            <span className="action-bar-icon">🏃</span>
            <span className="action-bar-label">Dodge</span>
            <span className="defense-value">{defenseOptions.dodge}</span>
            <span className="defense-chance">{getSuccessChance(defenseOptions.dodge).toFixed(0)}%</span>
          </button>

          <button 
            className={`action-bar-btn defense-btn parry ${!defenseOptions.parry ? 'disabled' : ''}`}
            onClick={() => defenseOptions.parry && handleDefense('parry')}
            disabled={!defenseOptions.parry}
          >
            <span className="action-bar-icon">🗡️</span>
            <span className="action-bar-label">Parry</span>
            {defenseOptions.parry ? (
              <>
                <span className="defense-value">{defenseOptions.parry}</span>
                <span className="defense-chance">{getSuccessChance(defenseOptions.parry).toFixed(0)}%</span>
              </>
            ) : (
              <span className="defense-value">N/A</span>
            )}
          </button>

          <button 
            className={`action-bar-btn defense-btn block ${!defenseOptions.block ? 'disabled' : ''}`}
            onClick={() => defenseOptions.block && handleDefense('block')}
            disabled={!defenseOptions.block}
          >
            <span className="action-bar-icon">🛡️</span>
            <span className="action-bar-label">Block</span>
            {defenseOptions.block ? (
              <>
                <span className="defense-value">{defenseOptions.block}</span>
                <span className="defense-chance">{getSuccessChance(defenseOptions.block).toFixed(0)}%</span>
              </>
            ) : (
              <span className="defense-value">N/A</span>
            )}
          </button>

          <button 
            className="action-bar-btn danger defense-btn none"
            onClick={() => handleDefense('none')}
          >
            <span className="action-bar-icon">🚫</span>
            <span className="action-bar-label">None</span>
          </button>
        </div>
      </>
    )
  }

  if (!isMyTurn) {
    return (
      <div className="action-bar">
        <div className="action-bar-waiting">Waiting for opponent...</div>
      </div>
    )
  }

  const canAttack = currentManeuver === 'attack' || currentManeuver === 'all_out_attack' || currentManeuver === 'move_and_attack'

  const closeCombatTargetId = inCloseCombat ? playerCombatant?.inCloseCombatWith : null
  const effectiveTargetId = closeCombatTargetId ?? selectedTargetId
  
  const turnMovement = matchState?.turnMovement
  const inMovementPhase = turnMovement?.phase === 'moving'
  const movePointsRemaining = turnMovement?.movePointsRemaining ?? 0
  
  const targetCombatant = effectiveTargetId ? matchState.combatants.find(c => c.playerId === effectiveTargetId) : null
  const targetName = targetCombatant 
    ? matchState.characters.find(c => c.id === targetCombatant.characterId)?.name ?? 'Enemy'
    : null

  const getHint = () => {
    if (!currentManeuver) return 'Select maneuver ↓'
    if (inMovementPhase && movePointsRemaining > 0) return `${movePointsRemaining} MP - Tap hex`
    if (inCloseCombat && canAttack) return null
    if (canAttack && !effectiveTargetId) return 'Tap enemy to target'
    return null
  }
  const hint = getHint()
  
  const canShowAttackBtn = canAttack && effectiveTargetId && !inMovementPhase

  return (
    <>
      {showAOAVariants && (
        <div className="action-bar-maneuvers">
          <div className="variant-header">All-Out Attack Variant</div>
          {([
            { variant: 'determined' as AOAVariant, label: 'Determined', desc: '+4 to hit' },
            { variant: 'strong' as AOAVariant, label: 'Strong', desc: '+2 damage' },
            { variant: 'double' as AOAVariant, label: 'Double', desc: '2 attacks' },
          ]).map(v => (
            <button
              key={v.variant}
              className="action-bar-maneuver-btn"
              onClick={() => {
                onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'all_out_attack', aoaVariant: v.variant })
                setShowAOAVariants(false)
              }}
            >
              <span className="action-bar-icon">😡</span>
              <span className="action-bar-label">{v.label}</span>
            </button>
          ))}
          <button className="action-bar-maneuver-btn close" onClick={() => setShowAOAVariants(false)}>
            <span className="action-bar-icon">←</span>
            <span className="action-bar-label">Back</span>
          </button>
        </div>
      )}
      {showAODVariants && (
        <div className="action-bar-maneuvers">
          <div className="variant-header">All-Out Defense Variant</div>
          {([
            { variant: 'increased_dodge' as AODVariant, label: '+2 Dodge', desc: '+2 to Dodge' },
            { variant: 'increased_parry' as AODVariant, label: '+2 Parry', desc: '+2 to Parry' },
            { variant: 'increased_block' as AODVariant, label: '+2 Block', desc: '+2 to Block' },
          ]).map(v => (
            <button
              key={v.variant}
              className="action-bar-maneuver-btn"
              onClick={() => {
                onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'all_out_defense', aodVariant: v.variant })
                setShowAODVariants(false)
              }}
            >
              <span className="action-bar-icon">🛡️</span>
              <span className="action-bar-label">{v.label}</span>
            </button>
          ))}
          <button className="action-bar-maneuver-btn close" onClick={() => setShowAODVariants(false)}>
            <span className="action-bar-icon">←</span>
            <span className="action-bar-label">Back</span>
          </button>
        </div>
      )}
      {showWaitPicker && (
        <div className="action-bar-maneuvers" style={{ flexDirection: 'column', height: 'auto', maxHeight: '60vh', overflowY: 'auto', alignItems: 'stretch' }}>
          <WaitTriggerPicker
            enemies={matchState?.combatants
              .filter(c => c.playerId !== playerId)
              .map(c => {
                const char = matchState?.characters.find(ch => ch.id === c.characterId)
                return { id: c.playerId, name: char?.name ?? 'Unknown' }
              }) ?? []
            }
            onSetTrigger={(trigger: WaitTrigger) => {
              onAction('set_wait_trigger', { type: 'set_wait_trigger', trigger })
              setShowWaitPicker(false)
            }}
            onCancel={() => setShowWaitPicker(false)}
          />
        </div>
      )}
      {showCharacterSheet && playerCharacter && playerCombatant && (
        <div className="action-bar-maneuvers" style={{ flexDirection: 'column', height: 'auto', maxHeight: '70vh', overflowY: 'auto', alignItems: 'stretch', padding: '1rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '1.1rem' }}>{playerCharacter.name}</h3>
          
          <div className="card" style={{ marginBottom: '0.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#aaa', fontSize: '0.9rem' }}>Attributes</h4>
            <div className="attributes-grid">
              <div className="attr-item">
                <span className="attr-label">ST</span>
                <span className="attr-value">{playerCharacter.attributes.strength}</span>
              </div>
              <div className="attr-item">
                <span className="attr-label">DX</span>
                <span className="attr-value">{playerCharacter.attributes.dexterity}</span>
              </div>
              <div className="attr-item">
                <span className="attr-label">IQ</span>
                <span className="attr-value">{playerCharacter.attributes.intelligence}</span>
              </div>
              <div className="attr-item">
                <span className="attr-label">HT</span>
                <span className="attr-value">{playerCharacter.attributes.health}</span>
              </div>
            </div>
            <div className="derived-stats">
              <span>Speed: {playerCharacter.derived.basicSpeed}</span>
              <span>Move: {playerCharacter.derived.basicMove}</span>
              <span>Dodge: {playerCharacter.derived.dodge}</span>
            </div>
            {encumbrance && encumbrance.level > 0 && (
              <div className="encumbrance-indicator" style={{ marginTop: '0.5rem' }}>
                <span>Enc: <span style={{ color: encumbrance.level === 1 ? '#ff4' : encumbrance.level === 2 ? '#f80' : '#f44', fontWeight: 'bold' }}>{encumbrance.name}</span></span>
                <span className="encumbrance-effects" style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#888' }}>{encumbrance.movePenalty} Move, {encumbrance.dodgePenalty} Dodge</span>
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: '0.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#aaa', fontSize: '0.9rem' }}>Equipment</h4>
            <div className="equipment-list">
              {playerCombatant.equipped.length > 0 ? (
                playerCombatant.equipped.map(item => {
                  const eq = playerCharacter.equipment.find(e => e.id === item.equipmentId)
                  if (!eq) return null
                  const skill = eq.skillUsed ? playerCharacter.skills.find(s => s.name === eq.skillUsed) : null
                  return (
                    <div key={item.equipmentId} className="equipment-item">
                      <div className="equipment-header">
                        <span className="equipment-icon">
                          {eq.type === 'melee' ? '🗡️' : eq.type === 'ranged' ? '🏹' : eq.type === 'shield' ? '🛡️' : '📦'}
                        </span>
                        <span className="equipment-name">{eq.name}</span>
                        <span className={`equipment-ready ${item.ready ? 'ready' : 'unready'}`}>
                          {item.ready ? 'Ready' : 'Unready'}
                        </span>
                      </div>
                      <div className="equipment-details">
                        <span className="equipment-slot">{item.slot.replace('_', ' ')}</span>
                        {eq.damage && <span>Dmg: {eq.damage} {eq.damageType}</span>}
                        {eq.reach && <span>Reach: {eq.reach}</span>}
                        {eq.block && <span>Block: {eq.block}</span>}
                        {skill && <span>Skill: {skill.level}</span>}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="equipment-empty">No items equipped</div>
              )}
            </div>
          </div>

          {playerCharacter.skills.length > 0 && (
            <div className="card">
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#aaa', fontSize: '0.9rem' }}>Skills</h4>
              <div className="skills-list">
                {playerCharacter.skills.map(skill => (
                  <div key={skill.id} className="skill-item">
                    <span className="skill-name">{skill.name}</span>
                    <span className="skill-level">{skill.level}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="action-bar-maneuver-btn close" onClick={() => setShowCharacterSheet(false)} style={{ marginTop: '1rem' }}>
            <span className="action-bar-icon">✕</span>
            <span className="action-bar-label">Close</span>
          </button>
        </div>
      )}
      {showManeuvers && (
        <div className="action-bar-maneuvers">
          {availableManeuvers.map(m => (
            <button
              key={m.type}
              className={`action-bar-maneuver-btn ${currentManeuver === m.type ? 'active' : ''}`}
              onClick={() => {
                if (m.type === 'all_out_attack') {
                  setShowManeuvers(false)
                  setShowAOAVariants(true)
                } else if (m.type === 'all_out_defense') {
                  setShowManeuvers(false)
                  setShowAODVariants(true)
                } else if (m.type === 'wait') {
                  setShowManeuvers(false)
                  setShowWaitPicker(true)
                  onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'wait' })
                } else {
                  onAction('select_maneuver', { type: 'select_maneuver', maneuver: m.type })
                  setShowManeuvers(false)
                }
              }}
            >
              <span className="action-bar-icon">{m.icon}</span>
              <span className="action-bar-label">{m.label}</span>
            </button>
          ))}
          <button className="action-bar-maneuver-btn close" onClick={() => setShowManeuvers(false)}>
            <span className="action-bar-icon">✕</span>
            <span className="action-bar-label">Close</span>
          </button>
        </div>
      )}
      <div className="action-bar">
        <button 
          className={`action-bar-btn ${showCharacterSheet ? 'active' : ''}`}
          onClick={() => setShowCharacterSheet(!showCharacterSheet)}
        >
          <span className="action-bar-icon">👤</span>
          <span className="action-bar-label">Char</span>
        </button>

        {playerCombatant && (
          <div className="action-bar-status">
            <div className="action-bar-hp-bar">
              <div 
                className="action-bar-hp-fill" 
                style={{ width: `${hpPercent}%`, background: hpColor }}
              />
            </div>
            <span className="action-bar-hp-text">{currentHP}/{maxHP}</span>
          </div>
        )}
        
        {inCloseCombat && (
          <div className="action-bar-cc-indicator">⚔️ CC</div>
        )}
        
        <button 
          className={`action-bar-btn ${!currentManeuver ? 'highlight' : ''}`}
          onClick={() => setShowManeuvers(!showManeuvers)}
        >
          <span className="action-bar-icon">{currentManeuver ? MANEUVERS.find(m => m.type === currentManeuver)?.icon ?? '📋' : '📋'}</span>
          <span className="action-bar-label">{currentManeuver ? 'Change' : 'Maneuver'}</span>
        </button>

        {hint && (
          <div className="action-bar-hint">{hint}</div>
        )}
        
        {canShowAttackBtn && effectiveTargetId && (
          <button
            className="action-bar-btn primary"
            onClick={() => onAction('attack', { type: 'attack', targetId: effectiveTargetId })}
          >
            <span className="action-bar-icon">⚔️</span>
            <span className="action-bar-label">{targetName}</span>
          </button>
        )}

        {inMovementPhase && !inCloseCombat && (
          <>
            <button
              className="action-bar-btn small"
              onClick={() => onAction('undo_movement', { type: 'undo_movement' })}
              title="Undo Movement"
            >
              <span className="action-bar-icon">↩</span>
            </button>
            <button
              className="action-bar-btn small"
              onClick={() => onAction('skip_movement', { type: 'skip_movement' })}
              title="Skip Movement"
            >
              <span className="action-bar-icon">⏭</span>
            </button>
            <button
              className="action-bar-btn primary small"
              onClick={() => onAction('confirm_movement', { type: 'confirm_movement' })}
              title="Confirm Movement"
            >
              <span className="action-bar-icon">✓</span>
            </button>
          </>
        )}

        {inCloseCombat && (
          <>
            <button
              className="action-bar-btn"
              onClick={() => onAction('grapple', { type: 'grapple', targetId: playerCombatant!.inCloseCombatWith!, action: 'grab' })}
            >
              <span className="action-bar-icon">🤼</span>
              <span className="action-bar-label">Grapple</span>
            </button>
            <button
              className="action-bar-btn warning"
              onClick={() => onAction('exit_close_combat', { type: 'exit_close_combat' })}
            >
              <span className="action-bar-icon">🚪</span>
              <span className="action-bar-label">Exit</span>
            </button>
          </>
        )}

        {!inCloseCombat && (
          <div className="action-bar-facing">
            <button
              className="action-bar-btn small"
              onClick={() => onAction('turn_left', { type: 'turn_left' })}
              title="Turn Left"
            >
              <span className="action-bar-icon">↶</span>
            </button>
            <button
              className="action-bar-btn small"
              onClick={() => onAction('turn_right', { type: 'turn_right' })}
              title="Turn Right"
            >
              <span className="action-bar-icon">↷</span>
            </button>
          </div>
        )}

        <button
          className="action-bar-btn"
          onClick={() => onAction('end_turn', { type: 'end_turn' })}
        >
          <span className="action-bar-icon">⌛</span>
          <span className="action-bar-label">End</span>
        </button>

        <button
          className="action-bar-btn danger"
          onClick={() => {
            if (confirm('Surrender and end the match?')) {
              onAction('surrender', { type: 'surrender' })
            }
          }}
        >
          <span className="action-bar-icon">🏳️</span>
          <span className="action-bar-label">Give Up</span>
        </button>
      </div>
    </>
  )
}
