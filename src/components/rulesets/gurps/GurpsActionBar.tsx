import { useState, useCallback, useRef } from 'react'
import { 
  Sword, Shield, Footprints, Crosshair, Eye, Brain, Hourglass, 
  Hand, User, Moon, Zap, Target, AlertTriangle, Flag, LogOut,
  RotateCcw, RotateCw, Check, SkipForward, Undo2,
  FileText, Scroll, Backpack, X, XCircle
} from 'lucide-react'
import type { ManeuverType, HitLocation, AOAVariant, AODVariant, WaitTrigger } from '../../../../shared/rulesets/gurps/types'
import { calculateEncumbrance } from '../../../../shared/rulesets/gurps/rules'
import { WaitTriggerPicker } from './WaitTriggerPicker'
import { getSuccessChance } from '../../game/shared/useGameActions'
import { getRulesetUiSlots } from '../../game/shared/rulesetUiSlots'
import { rulesets, isGurpsPendingDefense, isGurpsCombatant } from '../../../../shared/rulesets'
import { isGurpsCharacter } from '../../../../shared/rulesets/characterSheet'
import type { ActionBarProps } from '../types'
import { useDefenseOptions } from '../../../hooks/useDefenseOptions'
import { useConfirmDialog } from '../../../hooks/useConfirmDialog'
import { ConfirmDialog } from '../../ui/ConfirmDialog'

export const GurpsActionBar = ({ 
  matchState,
  player,
  combatant: playerCombatant,
  character: playerCharacter,
  isMyTurn, 
  currentManeuver, 
  selectedTargetId,
  logs,
  onAction,
  onDefend,
  onLeaveLobby,
}: ActionBarProps) => {
  const [showManeuvers, setShowManeuvers] = useState(false)
  const [showWaitPicker, setShowWaitPicker] = useState(false)
  const [showAOAVariants, setShowAOAVariants] = useState(false)
  const [showAODVariants, setShowAODVariants] = useState(false)
  const [showCharacterSheet, setShowCharacterSheet] = useState(false)
  const [showCombatLog, setShowCombatLog] = useState(false)
  const [hitLocation, setHitLocation] = useState<HitLocation>('torso')
  const [deceptiveLevel, setDeceptiveLevel] = useState<0 | 1 | 2>(0)
  const [rapidStrike, setRapidStrike] = useState(false)
  const [maneuverTooltip, setManeuverTooltip] = useState<{ label: string; desc: string } | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const { confirm: confirmSurrender, dialogProps: surrenderDialogProps } = useConfirmDialog()

  const handleSurrender = useCallback(async () => {
    const confirmed = await confirmSurrender({
      title: 'Surrender?',
      message: 'Surrender and end the match?',
      confirmLabel: 'Surrender',
      variant: 'danger',
    })
    if (confirmed) {
      onAction('surrender', { type: 'surrender' })
      onLeaveLobby()
    }
  }, [confirmSurrender, onAction, onLeaveLobby])

  const closeAllPanels = useCallback(() => {
    setShowManeuvers(false)
    setShowCharacterSheet(false)
    setShowAOAVariants(false)
    setShowAODVariants(false)
    setShowWaitPicker(false)
    setShowCombatLog(false)
  }, [])

  const gurpsChar = isGurpsCharacter(playerCharacter) ? playerCharacter : null
  const gurpsCombatant = isGurpsCombatant(playerCombatant) ? playerCombatant : null
  const gurpsPendingDefense = matchState.pendingDefense && isGurpsPendingDefense(matchState.pendingDefense)
    ? matchState.pendingDefense : null
  const { options: defenseOpts, retreat, setRetreat, dodgeAndDrop, setDodgeAndDrop } = useDefenseOptions(
    gurpsChar, gurpsCombatant, gurpsPendingDefense
  )
  const defenseOptions = defenseOpts ? {
    dodge: defenseOpts.dodge,
    parry: defenseOpts.parry?.value ?? null,
    block: defenseOpts.block?.value ?? null,
    canRetreat: defenseOpts.canRetreat,
  } : null

  if (!isGurpsCombatant(playerCombatant) || !isGurpsCharacter(playerCharacter)) {
    return <div>Error: GURPS component received non-GURPS data</div>
  }
  
  const hasOpenPanel = showManeuvers || showCharacterSheet || showAOAVariants || showAODVariants || showWaitPicker
  
  const encumbrance = calculateEncumbrance(playerCharacter.attributes.strength, playerCharacter.equipment)
    
  const maxHP = playerCharacter.derived.hitPoints
  const currentHP = playerCombatant.currentHP
  const hpPercent = maxHP > 0 ? Math.max(0, (currentHP / maxHP) * 100) : 0
  const hpColor = hpPercent > 50 ? 'var(--accent-success)' : hpPercent > 25 ? 'var(--accent-warning)' : 'var(--accent-danger)'
  const maxFP = playerCharacter.derived.fatiguePoints
  const currentFP = playerCombatant.currentFP
  const fpPercent = maxFP > 0 ? Math.max(0, (currentFP / maxFP) * 100) : 0
  const fpColor = fpPercent > 50 ? 'var(--accent-primary)' : fpPercent > 25 ? 'var(--accent-warning)' : 'var(--accent-danger)'
  const adapter = rulesets.gurps.ui

  const MANEUVER_ICONS: Record<string, React.ReactNode> = {
    move: <Footprints size={20} />,
    attack: <Sword size={20} />,
    all_out_attack: <Target size={20} />,
    all_out_defense: <Shield size={20} />,
    move_and_attack: <Zap size={20} />,
    aim: <Crosshair size={20} />,
    evaluate: <Eye size={20} />,
    concentrate: <Brain size={20} />,
    wait: <Hourglass size={20} />,
    ready: <Hand size={20} />,
    change_posture: <User size={20} />,
    do_nothing: <Moon size={20} />,
  }
  const inCloseCombat = !!playerCombatant.inCloseCombatWith
  const availableManeuvers = inCloseCombat 
    ? adapter.getManeuvers().filter(m => adapter.getCloseCombatManeuvers().includes(m.type))
    : adapter.getManeuvers()

  const pendingDefense = matchState.pendingDefense
  const isDefending = pendingDefense?.defenderId === player.id

  const handleDefense = (type: 'dodge' | 'parry' | 'block' | 'none') => {
    onDefend({
      type,
      retreat,
      dodgeAndDrop: type === 'dodge' ? dodgeAndDrop : false
    })
    setRetreat(false)
    setDodgeAndDrop(false)
  }

  if (matchState.status === 'finished') {
    return (
      <div className="action-bar">
        <button className="action-bar-btn danger" onClick={onLeaveLobby}>
          <span className="action-bar-icon"><LogOut size={20} /></span>
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
            <span className="defense-alert-icon"><AlertTriangle size={24} /></span>
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
            <span className="action-bar-icon"><Footprints size={20} /></span>
            <span className="action-bar-label">Dodge</span>
            <span className="defense-value">{defenseOptions.dodge}</span>
            <span className="defense-chance">{getSuccessChance(defenseOptions.dodge).toFixed(0)}%</span>
          </button>

          <button 
            className={`action-bar-btn defense-btn parry ${!defenseOptions.parry ? 'disabled' : ''}`}
            onClick={() => defenseOptions.parry && handleDefense('parry')}
            disabled={!defenseOptions.parry}
          >
            <span className="action-bar-icon"><Sword size={20} /></span>
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
            <span className="action-bar-icon"><Shield size={20} /></span>
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
            <span className="action-bar-icon"><XCircle size={20} /></span>
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
  const closeCombatTargetId = inCloseCombat ? playerCombatant.inCloseCombatWith : null
  const effectiveTargetId = closeCombatTargetId ?? selectedTargetId
  
  const turnMovement = matchState.turnMovement
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
              <span className="action-bar-icon"><Target size={20} /></span>
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
              <span className="action-bar-icon"><Shield size={20} /></span>
              <span className="action-bar-label">{v.label}</span>
            </button>
           ))}
         </div>
       )}

       {showWaitPicker && (
         <div className="action-bar-maneuvers" style={{ flexDirection: 'column', height: 'auto', maxHeight: '60vh', overflowY: 'auto', alignItems: 'stretch' }}>
           <WaitTriggerPicker
             enemies={matchState.combatants
               .filter(c => c.playerId !== player.id)
               .map(c => {
                 const char = matchState.characters.find(ch => ch.id === c.characterId)
                 return { id: c.playerId, name: char?.name ?? 'Unknown' }
               })
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
           {getRulesetUiSlots('gurps').renderActionConfiguration?.({
             matchState,
             player,
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

      {showCharacterSheet && (
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
                <span>Enc: <span style={{ color: encumbrance.level === 1 ? 'var(--accent-warning)' : encumbrance.level === 2 ? 'var(--accent-warning)' : 'var(--accent-danger)', fontWeight: 'bold' }}>{encumbrance.name}</span></span>
                <span className="encumbrance-effects" style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{encumbrance.movePenalty} Move, {encumbrance.dodgePenalty} Dodge</span>
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
                        <div className="equipment-slot-name" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{eq.type === 'melee' ? <Sword size={14} /> : eq.type === 'ranged' ? <Crosshair size={14} /> : eq.type === 'shield' ? <Shield size={14} /> : <Backpack size={14} />}</span>
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
            style={{ marginTop: '1rem', background: 'var(--bg-elevated)', borderColor: 'var(--accent-danger)', width: '100%' }}
            onClick={handleSurrender}
            >
              <span className="action-bar-icon"><Flag size={20} /></span>
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
              title={`${m.label}: ${m.desc}`}
              onClick={() => {
                clearLongPress()
                setManeuverTooltip(null)
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
                  onAction('select_maneuver', { type: 'select_maneuver', maneuver: m.type as ManeuverType })
                  setShowManeuvers(false)
                }
              }}
              onTouchStart={() => {
                clearLongPress()
                longPressTimerRef.current = setTimeout(() => {
                  setManeuverTooltip({ label: m.label, desc: m.desc })
                }, 500)
              }}
              onTouchEnd={() => {
                clearLongPress()
              }}
              onTouchCancel={() => {
                clearLongPress()
              }}
            >
              <span className="action-bar-icon">{MANEUVER_ICONS[m.type] ?? <AlertTriangle size={20} />}</span>
              <span className="action-bar-label">{m.shortLabel}</span>
            </button>
          ))}
        </div>
      )}
      {maneuverTooltip && (
        <div className="maneuver-tooltip-overlay" onClick={() => setManeuverTooltip(null)}>
          <div className="maneuver-tooltip-card">
            <div className="maneuver-tooltip-title">{maneuverTooltip.label}</div>
            <div className="maneuver-tooltip-desc">{maneuverTooltip.desc}</div>
          </div>
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
          <span className="action-bar-icon"><User size={20} /></span>
          <div className="char-btn-hp">
            <div className="char-btn-hp-bar">
              <div 
                className="char-btn-hp-fill" 
                style={{ width: `${hpPercent}%`, background: hpColor }}
              />
            </div>
            <span className="char-btn-hp-text">{currentHP}/{maxHP}</span>
          </div>
          <div className="char-btn-hp">
            <div className="char-btn-hp-bar">
              <div 
                className="char-btn-hp-fill" 
                style={{ width: `${fpPercent}%`, background: fpColor }}
              />
            </div>
            <span className="char-btn-hp-text" style={{ color: 'var(--accent-primary)' }}>FP {currentFP}/{maxFP}</span>
          </div>
        </button>
        
        {inCloseCombat && (
          <div className="action-bar-cc-indicator"><Sword size={14} /> CC</div>
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
            <span className="action-bar-icon">{currentManeuver ? (MANEUVER_ICONS[currentManeuver] ?? <FileText size={20} />) : <FileText size={20} />}</span>
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
            <span className="action-bar-icon"><Sword size={20} /></span>
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
              <span className="action-bar-icon"><Undo2 size={16} /></span>
            </button>
            <button
              className="action-bar-btn small"
              onClick={() => onAction('skip_movement', { type: 'skip_movement' })}
              title="Skip Movement"
            >
              <span className="action-bar-icon"><SkipForward size={16} /></span>
            </button>
            <button
              className="action-bar-btn primary small"
              onClick={() => onAction('confirm_movement', { type: 'confirm_movement' })}
              title="Confirm Movement"
            >
              <span className="action-bar-icon"><Check size={16} /></span>
            </button>
          </div>
        )}

        {inCloseCombat && (
          <>
            <button
              className="action-bar-btn"
            onClick={() => onAction('grapple', { type: 'grapple', targetId: playerCombatant.inCloseCombatWith!, action: 'grab' })}
          >
            <span className="action-bar-icon"><Hand size={20} /></span>
            <span className="action-bar-label">Grapple</span>
          </button>
          <button
            className="action-bar-btn warning"
            onClick={() => onAction('exit_close_combat', { type: 'exit_close_combat' })}
          >
            <span className="action-bar-icon"><LogOut size={20} /></span>
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

          const freeRotationUsed = turnMovement?.freeRotationUsed ?? false
          const rotationCost = freeRotationUsed ? 1 : 0

          return canRotate ? (
            <div className="action-bar-facing">
              <button
                className="action-bar-btn small"
                onClick={() => onAction('turn_left', { type: 'turn_left' })}
                title={inMovementPhase ? `Turn Left (${rotationCost} MP)` : 'Turn Left'}
              >
                <span className="action-bar-icon"><RotateCcw size={16} /></span>
              </button>
              <button
                className="action-bar-btn small"
                onClick={() => onAction('turn_right', { type: 'turn_right' })}
                title={inMovementPhase ? `Turn Right (${rotationCost} MP)` : 'Turn Right'}
              >
                <span className="action-bar-icon"><RotateCw size={16} /></span>
              </button>
            </div>
          ) : null
        })()}

        {currentManeuver && (
          <button
            className="action-bar-btn"
          onClick={() => onAction('end_turn', { type: 'end_turn' })}
        >
          <span className="action-bar-icon"><Hourglass size={20} /></span>
          <span className="action-bar-label">End</span>
        </button>
        )}

        <button
          className={`action-bar-btn ${showCombatLog ? 'active' : ''}`}
          onClick={() => {
            if (!showCombatLog) {
              closeAllPanels()
            }
            setShowCombatLog(!showCombatLog)
          }}
        >
          <span className="action-bar-icon"><Scroll size={20} /></span>
          <span className="action-bar-label">Log</span>
        </button>

      </div>

      {showCombatLog && (
        <>
          <div className="action-bar-backdrop" onClick={() => setShowCombatLog(false)} />
          <div className="action-bar-combat-log">
            <div className="action-bar-combat-log-header">
              <span>Combat Log</span>
              <button className="action-bar-combat-log-close" onClick={() => setShowCombatLog(false)}><X size={16} /></button>
            </div>
            <div className="action-bar-combat-log-entries">
              {(logs ?? []).length === 0 ? (
                <div className="action-bar-combat-log-empty">No log entries yet.</div>
              ) : (
                [...(logs ?? [])].reverse().slice(0, 30).map((entry, i) => (
                  <div key={i} className="action-bar-combat-log-entry">{entry}</div>
                ))
              )}
            </div>
          </div>
        </>
      )}
      <ConfirmDialog {...surrenderDialogProps} />
    </>
  )
}
