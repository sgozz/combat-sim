import { useState, useEffect, useMemo } from 'react'
import type { ManeuverType, CombatActionPayload, MatchState, DefenseType, DefenseChoice } from '../../../shared/types'
import { getDefenseOptions, calculateDefenseValue, getPostureModifiers } from '../../../shared/rules'

type ActionBarProps = {
  isMyTurn: boolean
  currentManeuver: ManeuverType | null
  selectedTargetId: string | null
  matchState: MatchState | null
  inLobbyButNoMatch: boolean
  playerId: string | null
  onAction: (action: string, payload?: CombatActionPayload) => void
  onDefend: (choice: DefenseChoice) => void
  onLeaveLobby: () => void
  onStartMatch: () => void
  onOpenCharacterEditor: () => void
  onCreateLobby: () => void
  onJoinLobby: () => void
}

const MANEUVERS: { type: ManeuverType; label: string; icon: string }[] = [
  { type: 'move', label: 'Move', icon: '🏃' },
  { type: 'attack', label: 'Attack', icon: '⚔️' },
  { type: 'all_out_attack', label: 'All-Out', icon: '😡' },
  { type: 'all_out_defense', label: 'Defend', icon: '🛡️' },
  { type: 'move_and_attack', label: 'M&A', icon: '🤸' },
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
  onAction,
  onDefend,
  onLeaveLobby,
  onStartMatch,
  onOpenCharacterEditor,
  onCreateLobby,
  onJoinLobby
}: ActionBarProps) => {
  const [showManeuvers, setShowManeuvers] = useState(false)
  const [retreat, setRetreat] = useState(false)
  const [dodgeAndDrop, setDodgeAndDrop] = useState(false)
  const [defenseTimeLeft, setDefenseTimeLeft] = useState(0)
  
  const playerCombatant = playerId && matchState 
    ? matchState.combatants.find(c => c.playerId === playerId) 
    : null
  const playerCharacter = playerCombatant && matchState
    ? matchState.characters.find(c => c.id === playerCombatant.characterId)
    : null
    
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

  const DEFENSE_TIMEOUT_MS = 15000
  
  useEffect(() => {
    if (!pendingDefense) {
      setDefenseTimeLeft(0)
      setRetreat(false)
      setDodgeAndDrop(false)
      return
    }
    const expiresAt = pendingDefense.timestamp + DEFENSE_TIMEOUT_MS
    const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
    setDefenseTimeLeft(remaining)
    const timer = setInterval(() => {
      setDefenseTimeLeft(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
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
      return (
        <div className="action-bar">
          <button className="action-bar-btn" onClick={onOpenCharacterEditor}>
            <span className="action-bar-icon">👤</span>
            <span className="action-bar-label">Character</span>
          </button>
          <button className="action-bar-btn primary" onClick={onStartMatch}>
            <span className="action-bar-icon">▶️</span>
            <span className="action-bar-label">Start</span>
          </button>
          <button className="action-bar-btn danger" onClick={onLeaveLobby}>
            <span className="action-bar-icon">🚪</span>
            <span className="action-bar-label">Leave</span>
          </button>
        </div>
      )
    }
    return (
      <div className="action-bar">
        <button className="action-bar-btn" onClick={onOpenCharacterEditor}>
          <span className="action-bar-icon">👤</span>
          <span className="action-bar-label">Character</span>
        </button>
        <button className="action-bar-btn primary" onClick={onCreateLobby}>
          <span className="action-bar-icon">➕</span>
          <span className="action-bar-label">Create</span>
        </button>
        <button className="action-bar-btn" onClick={onJoinLobby}>
          <span className="action-bar-icon">🔗</span>
          <span className="action-bar-label">Join</span>
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

          <div className="defense-timer-mobile">
            <span className={`timer-value ${defenseTimeLeft <= 5 ? 'urgent' : ''}`}>{defenseTimeLeft}s</span>
          </div>

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
      {showManeuvers && (
        <div className="action-bar-maneuvers">
          {availableManeuvers.map(m => (
            <button
              key={m.type}
              className={`action-bar-maneuver-btn ${currentManeuver === m.type ? 'active' : ''}`}
              onClick={() => {
                onAction('select_maneuver', { type: 'select_maneuver', maneuver: m.type })
                setShowManeuvers(false)
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
