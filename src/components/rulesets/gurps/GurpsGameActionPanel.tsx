import { 
  Sword, Shield, Footprints, Crosshair, Eye, Brain, Hourglass, 
  Hand, User, Moon, Zap, Target, AlertTriangle, Flag, LogOut,
  RotateCcw, RotateCw, Check, SkipForward, Undo2, ChevronLeft, ChevronRight,
  ArrowLeft 
} from 'lucide-react'
import { useState, useCallback } from 'react'
import { Tooltip } from '../../ui/Tooltip'
import { useConfirmDialog } from '../../../hooks/useConfirmDialog'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { CombatLog } from '../../game/CombatLog'
import { WaitTriggerPicker } from './WaitTriggerPicker'
import { ReadyPanel } from './ReadyPanel'
import { getHitProbability } from '../../game/shared/useGameActions'
import { getRulesetUiSlots } from '../../game/shared/rulesetUiSlots'
import type { GameActionPanelProps } from '../types'
import type { ManeuverType, HitLocation, ReadyAction, EquipmentSlot, WaitTrigger, AOAVariant, AODVariant } from '../../../../shared/rulesets/gurps/types'
import { hexDistance } from '../../../utils/hex'
import { getRangePenalty, getHitLocationPenalty } from '../../../../shared/rulesets/gurps/rules'
import { rulesets } from '../../../../shared/rulesets'
import { isGurpsCharacter } from '../../../../shared/rulesets/characterSheet'
import { isGurpsCombatant } from '../../../../shared/rulesets'

export const GurpsGameActionPanel = ({ 
  matchState, 
  player,
  combatant: activeCombatant,
  character: activeCharacter,
  logs, 
  selectedTargetId,
  currentManeuver,
  isMyTurn,
  onAction,
  onLeaveLobby,
}: GameActionPanelProps) => {
  const [collapsed, setCollapsed] = useState(false)
  const [selectedHitLocation, setSelectedHitLocation] = useState<HitLocation>('torso')
  const [deceptiveLevel, setDeceptiveLevel] = useState<0 | 1 | 2>(0)
  const [rapidStrike, setRapidStrike] = useState(false)
  const [showAOAVariantPicker, setShowAOAVariantPicker] = useState(false)
  const [showAODVariantPicker, setShowAODVariantPicker] = useState(false)
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
    }
  }, [confirmSurrender, onAction])

  // Type guard: ensure activeCharacter is GURPS
  if (!activeCharacter || !isGurpsCharacter(activeCharacter) || !isGurpsCombatant(activeCombatant)) {
    return null
  }

  const MANEUVER_ICONS: Record<string, React.ReactNode> = {
    move: <Footprints size={24} />,
    attack: <Sword size={24} />,
    all_out_attack: <Target size={24} />,
    all_out_defense: <Shield size={24} />,
    move_and_attack: <Zap size={24} />,
    aim: <Crosshair size={24} />,
    evaluate: <Eye size={24} />,
    concentrate: <Brain size={24} />,
    wait: <Hourglass size={24} />,
    ready: <Hand size={24} />,
    change_posture: <User size={24} />,
    do_nothing: <Moon size={24} />,
  }
  
  const adapter = rulesets.gurps.ui
  const slots = getRulesetUiSlots('gurps')
  const selectedTarget = matchState.combatants.find(c => c.playerId === selectedTargetId)
  const selectedTargetName = selectedTarget 
    ? matchState.characters.find(c => c.id === selectedTarget.characterId)?.name ?? 'Unknown'
    : null

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
    
    let color = 'var(--accent-danger)'
    if (prob >= 70) color = 'var(--accent-success)'
    else if (prob >= 40) color = 'var(--accent-warning)'

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
    if (matchState.status === 'finished') {
      return (
        <div className="action-grid">
          <button className="action-btn danger" onClick={onLeaveLobby}>
            <LogOut size={18} /> Leave Match
          </button>
        </div>
      )
    }

    if (isMyTurn && !currentManeuver) {
      if (showAOAVariantPicker) {
        return (
          <>
            <div className="aoa-variant-header">
              <button className="action-btn small" onClick={() => setShowAOAVariantPicker(false)}>
                <ArrowLeft size={16} /> Back
              </button>
              <span className="aoa-variant-title">All-Out Attack Variant</span>
            </div>
            <div className="aoa-variant-grid">
              {adapter.getAoaVariants().map(v => (
                <Tooltip key={v.variant} content={v.desc} position="top">
                  <button 
                    className="aoa-variant-btn"
                    onClick={() => {
                      setShowAOAVariantPicker(false)
                      onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'all_out_attack', aoaVariant: v.variant as AOAVariant })
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
                <ArrowLeft size={16} /> Back
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
                      onAction('select_maneuver', { type: 'select_maneuver', maneuver: 'all_out_defense', aodVariant: v.variant as AODVariant })
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
                      onAction('select_maneuver', { type: 'select_maneuver', maneuver: m.type as ManeuverType })
                    }
                  }}
                >
                  <span className="maneuver-icon">{MANEUVER_ICONS[m.type] ?? <AlertTriangle size={24} />}</span>
                  <span className="maneuver-label">{m.label}</span>
                  <span className="key-hint">{m.key}</span>
                </button>
              </Tooltip>
            ))}
          </div>
          <button 
            className="action-btn danger"
            style={{ marginTop: '1rem' }}
            onClick={handleSurrender}
          >
            <span className="btn-icon"><Flag size={18} /></span> Give Up
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
            onClick={handleSurrender}
          >
            <span className="btn-icon"><Flag size={18} /></span> Give Up
          </button>
        </div>
      )
    }

    const maneuverLabel = currentManeuver ? adapter.getManeuvers().find(m => m.type === currentManeuver) : null
    const instructions = adapter.getManeuverInstructions(currentManeuver)
    const turnMovement = matchState.turnMovement
    const inMovementPhase = turnMovement?.phase === 'moving'
    const movePointsRemaining = turnMovement?.movePointsRemaining ?? 0
    const freeRotationUsed = turnMovement?.freeRotationUsed ?? false
    const rotationCost = freeRotationUsed ? 1 : 0

    const movementSkipped = turnMovement?.phase === 'completed' &&
      turnMovement.startPosition.q === turnMovement.currentPosition.q &&
      turnMovement.startPosition.r === turnMovement.currentPosition.r

    const instructionText = movementSkipped && instructions?.isStep
      ? 'Movement skipped.'
      : (instructions?.text ?? '')

    return (
      <div className="action-section">
        {currentManeuver && maneuverLabel && (
          <>
            <div className="current-maneuver-banner">
              <span className="maneuver-icon-small">{MANEUVER_ICONS[currentManeuver] ?? <AlertTriangle size={20} />}</span>
              <span className="maneuver-name">{maneuverLabel.label}</span>
            </div>
            {!inMovementPhase && (
              <div className="maneuver-instructions">{instructionText}</div>
            )}
          </>
        )}

        {inMovementPhase && (
          <div className="movement-phase-panel">
            <div className="movement-points">
              <Footprints size={20} className="mp-icon" />
              <span className="mp-value">{movePointsRemaining}</span>
              <span className="mp-label">MP</span>
            </div>
            <div className="movement-buttons">
              <button 
                className="action-btn"
                onClick={() => onAction('undo_movement', { type: 'undo_movement' })}
              >
                <Undo2 size={18} /> Undo
              </button>
              <button 
                className="action-btn"
                onClick={() => onAction('skip_movement', { type: 'skip_movement' })}
              >
                <SkipForward size={18} /> Skip
              </button>
              <button 
                className="action-btn primary"
                onClick={() => onAction('confirm_movement', { type: 'confirm_movement' })}
              >
                <Check size={18} /> Confirm
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
              enemies={matchState.combatants
                .filter(c => c.playerId !== matchState.activeTurnPlayerId)
                .map(c => {
                  const char = matchState.characters.find(ch => ch.id === c.characterId)
                  return { id: c.playerId, name: char?.name ?? 'Unknown' }
                })
              }
              onSetTrigger={(trigger: WaitTrigger) => {
                onAction('set_wait_trigger', { type: 'set_wait_trigger', trigger })
              }}
            />
          </div>
        )}

        {slots.renderActionConfiguration?.({
          matchState,
          player,
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
              <span className="btn-icon"><Sword size={18} /></span>
              {selectedTargetId ? `Attack ${selectedTargetName} [${selectedHitLocation.replace('_', ' ')}]` : 'Select a target on map'}
            </button>
          )}

          {currentManeuver === 'evaluate' && (
            <button 
              className="action-btn primary"
              disabled={!selectedTargetId}
              onClick={() => selectedTargetId && onAction('evaluate_target', { type: 'evaluate_target', targetId: selectedTargetId })}
            >
              <span className="btn-icon"><Eye size={18} /></span>
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
                  <RotateCcw size={18} />
                </button>
              </Tooltip>
              <span className="facing-label">Facing</span>
              <Tooltip content={inMovementPhase ? `Turn Right (${rotationCost} MP)` : 'Turn Right'} position="top">
                <button 
                  className="action-btn small"
                  onClick={() => onAction('turn_right', { type: 'turn_right' })}
                >
                  <RotateCw size={18} />
                </button>
              </Tooltip>
            </div>
          )}

          <button 
            className="action-btn end-turn"
            onClick={() => onAction('end_turn', { type: 'end_turn' })}
          >
            <span className="btn-icon"><Hourglass size={18} /></span> End Turn
          </button>

          <button 
            className="action-btn danger"
            onClick={handleSurrender}
          >
            <span className="btn-icon"><Flag size={18} /></span> Give Up
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <aside className={`panel panel-right ${collapsed ? 'collapsed' : ''}`}>
        <div className="panel-header">
          <span>{isMyTurn && !currentManeuver ? 'Choose Maneuver' : 'Actions'}</span>
          <button className="panel-toggle" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
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
      <ConfirmDialog {...surrenderDialogProps} />
    </>
  )
}
