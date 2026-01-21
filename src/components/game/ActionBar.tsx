import { useState, useEffect, useMemo, useCallback } from 'react'
import type { ManeuverType, CombatActionPayload, MatchState, DefenseType, DefenseChoice, AOAVariant, AODVariant, WaitTrigger, HitLocation } from '../../../shared/types'
import { getDefenseOptions, calculateDefenseValue, getPostureModifiers, calculateEncumbrance } from '../../../shared/rules'
import { WaitTriggerPicker } from '../ui/WaitTriggerPicker'
import { getSuccessChance } from './shared/useGameActions'
import type { RulesetUIAdapter } from '../../../shared/rulesets/Ruleset'
import { rulesets } from '../../../shared/rulesets'
import { getRulesetUiSlots } from './shared/rulesetUiSlots'

type ActionBarProps = {
  isMyTurn: boolean
  currentManeuver: ManeuverType | null
  selectedTargetId: string | null
  matchState: MatchState | null
  playerId: string | null
  onAction: (action: string, payload?: CombatActionPayload) => void
  onDefend: (choice: DefenseChoice) => void
  onLeaveLobby: () => void
  uiAdapter?: RulesetUIAdapter
}

export const ActionBar = ({ 
  isMyTurn, 
  currentManeuver, 
  selectedTargetId,
  matchState,
  playerId,
  onAction,
  onDefend,
  onLeaveLobby,
  uiAdapter,
}: ActionBarProps) => {
  const [showManeuvers, setShowManeuvers] = useState(false)
  const [showWaitPicker, setShowWaitPicker] = useState(false)
  const [showAOAVariants, setShowAOAVariants] = useState(false)
  const [showAODVariants, setShowAODVariants] = useState(false)
  const [showCharacterSheet, setShowCharacterSheet] = useState(false)
  const [retreat, setRetreat] = useState(false)
  const [dodgeAndDrop, setDodgeAndDrop] = useState(false)
  const [hitLocation, setHitLocation] = useState<HitLocation>('torso')
  const [deceptiveLevel, setDeceptiveLevel] = useState<0 | 1 | 2>(0)
  const [rapidStrike, setRapidStrike] = useState(false)
  
  const closeAllPanels = useCallback(() => {
    setShowManeuvers(false)
    setShowCharacterSheet(false)
    setShowAOAVariants(false)
    setShowAODVariants(false)
    setShowWaitPicker(false)
  }, [])
  
  const hasOpenPanel = showManeuvers || showCharacterSheet || showAOAVariants || showAODVariants || showWaitPicker
  
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
  const adapter = uiAdapter ?? rulesets[matchState?.rulesetId ?? 'gurps']?.ui ?? rulesets.gurps.ui
  const inCloseCombat = !!playerCombatant?.inCloseCombatWith
  const availableManeuvers = inCloseCombat 
    ? adapter.getManeuvers().filter(m => adapter.getCloseCombatManeuvers().includes(m.type))
    : adapter.getManeuvers()

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
    return null
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
      {hasOpenPanel && (
        <div 
          className="action-bar-backdrop" 
          onClick={closeAllPanels}
        />
      )}
       {showAOAVariants && (
         <div className="action-bar-maneuvers">
           <div className="variant-header">All-Out Attack Variant</div>
           {adapter.getAoaVariants().map(v => (
             <button
               key={v.variant}
               className="action-bar-maneuver-btn"
               onClick={() => {
                 if (v.variant === 'feint') return
                 onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'all_out_attack', aoaVariant: v.variant as AOAVariant })
                 setShowAOAVariants(false)
               }}
             >
               <span className="action-bar-icon">😡</span>
               <span className="action-bar-label">{v.label}</span>
             </button>
           ))}
         </div>
       )}
       {showAODVariants && (
         <div className="action-bar-maneuvers">
           <div className="variant-header">All-Out Defense Variant</div>
           {adapter.getAodVariants().map(v => (
             <button
               key={v.variant}
               className="action-bar-maneuver-btn"
               onClick={() => {
                 if (v.variant === 'double') return
                 onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'all_out_defense', aodVariant: v.variant as AODVariant })
                 setShowAODVariants(false)
               }}
             >
               <span className="action-bar-icon">🛡️</span>
               <span className="action-bar-label">{v.label}</span>
             </button>
           ))}
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
       {isMyTurn && currentManeuver && (
         <div className="action-bar-config-slot">
           {getRulesetUiSlots(matchState?.rulesetId).renderActionConfiguration?.({
             matchState,
             player: playerId && matchState ? matchState.players.find(p => p.id === playerId) ?? null : null,
             selectedTargetId,
             currentManeuver,
             isMyTurn,
             onAction,
             attackOptions: {
               hitLocation,
               setHitLocation,
               deceptiveLevel,
               setDeceptiveLevel,
               rapidStrike,
               setRapidStrike,
             },
           })}
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
            <div className="equipment-belt">
              {(['right_hand', 'left_hand', 'back', 'belt', 'quiver'] as const).map(slot => {
                const item = playerCombatant.equipped.find(e => e.slot === slot)
                const eq = item ? playerCharacter.equipment.find(e => e.id === item.equipmentId) : null
                
                return (
                  <div key={slot} className="equipment-belt-slot">
                    <span className="equipment-slot-label">{slot.replace('_', ' ')}</span>
                    {item && eq ? (
                      <div className="equipment-slot-content">
                        <div className="equipment-slot-name" style={{ fontSize: '0.8rem' }}>
                          <span>{eq.type === 'melee' ? '🗡️' : eq.type === 'ranged' ? '🏹' : eq.type === 'shield' ? '🛡️' : '📦'}</span>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eq.name}</span>
                        </div>
                        <div className="equipment-slot-details">
                          <span className={`equipment-ready ${item.ready ? 'ready' : 'unready'}`} style={{ fontSize: '0.65rem' }}>
                            {item.ready ? 'Ready' : 'Unready'}
                          </span>
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

          <button 
            className="action-bar-maneuver-btn" 
            style={{ marginTop: '1rem', background: '#4a2a2a', borderColor: '#f44', width: '100%' }}
            onClick={() => {
              if (confirm('Surrender and end the match?')) {
                onAction('surrender', { type: 'surrender' })
                onLeaveLobby()
              }
            }}
          >
            <span className="action-bar-icon">🏳️</span>
            <span className="action-bar-label">Give Up</span>
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
              <span className="action-bar-label">{m.shortLabel}</span>
            </button>
          ))}
        </div>
      )}
      <div className="action-bar">
        <button 
          className={`action-bar-btn char-btn ${showCharacterSheet ? 'active' : ''}`}
          onClick={() => {
            if (!showCharacterSheet) {
              setShowManeuvers(false)
              setShowAOAVariants(false)
              setShowAODVariants(false)
              setShowWaitPicker(false)
            }
            setShowCharacterSheet(!showCharacterSheet)
          }}
        >
          <span className="action-bar-icon">👤</span>
          {playerCombatant ? (
            <div className="char-btn-hp">
              <div className="char-btn-hp-bar">
                <div 
                  className="char-btn-hp-fill" 
                  style={{ width: `${hpPercent}%`, background: hpColor }}
                />
              </div>
              <span className="char-btn-hp-text">{currentHP}/{maxHP}</span>
            </div>
          ) : (
            <span className="action-bar-label">Char</span>
          )}
        </button>
        
        {inCloseCombat && (
          <div className="action-bar-cc-indicator">⚔️ CC</div>
        )}
        
        {!inMovementPhase && (
          <button 
            className={`action-bar-btn ${!currentManeuver ? 'highlight' : ''}`}
            onClick={() => {
              if (!showManeuvers) {
                setShowCharacterSheet(false)
                setShowAOAVariants(false)
                setShowAODVariants(false)
                setShowWaitPicker(false)
              }
              setShowManeuvers(!showManeuvers)
            }}
          >
            <span className="action-bar-icon">{currentManeuver ? availableManeuvers.find(m => m.type === currentManeuver)?.icon ?? '📋' : '📋'}</span>
            <span className="action-bar-label">{currentManeuver ? 'Change' : 'Maneuver'}</span>
          </button>
        )}

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
          <div className="action-bar-movement-controls">
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
          </div>
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

        {(() => {
          const maneuversAllowingStep: ManeuverType[] = ['move', 'attack', 'all_out_attack', 'all_out_defense', 'move_and_attack', 'aim', 'evaluate', 'ready']
          const canRotate = isMyTurn 
            && !inCloseCombat 
            && currentManeuver 
            && maneuversAllowingStep.includes(currentManeuver)
            && (!inMovementPhase || movePointsRemaining > 0)
          
          return canRotate ? (
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
          ) : null
        })()}

        {currentManeuver && (
          <button
            className="action-bar-btn"
            onClick={() => onAction('end_turn', { type: 'end_turn' })}
          >
            <span className="action-bar-icon">⌛</span>
            <span className="action-bar-label">End</span>
          </button>
        )}

      </div>
    </>
  )
}
