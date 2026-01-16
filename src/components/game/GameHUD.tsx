import { useState } from 'react'
import { Tooltip } from '../ui/Tooltip'
import { CombatLog } from './CombatLog'
import type { MatchState, Player, CombatActionPayload, ManeuverType } from '../../../shared/types'
import { hexDistance } from '../../utils/hex'
import { getRangePenalty } from '../../../shared/rules'

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
}

export const GameStatusPanel = ({ 
  matchState, 
  player, 
  lobbyPlayers, 
  lobbyId 
}: GamePanelProps) => {
  const [collapsed, setCollapsed] = useState(false)
  const activeCombatant = matchState?.combatants.find((combatant) => combatant.playerId === player?.id) ?? null

  return (
    <aside className={`panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        <span>Status</span>
        <button className="panel-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? '▶' : '◀'}
        </button>
      </div>
      {!collapsed && <div className="panel-content">
        <div className="card">
          <h3>Active Character</h3>
          <Tooltip content="The name of the currently active character" position="right">
            <div>Name: {matchState?.characters.find((c) => c.id === activeCombatant?.characterId)?.name ?? 'Unassigned'}</div>
          </Tooltip>
          <Tooltip content="Hit Points: Determine how much injury you can take. Death checks at -HP." position="right">
            <div>HP: {activeCombatant?.currentHP ?? '-'}</div>
          </Tooltip>
          <Tooltip content="Fatigue Points: Measure of endurance. Reaching 0 causes collapse." position="right">
            <div>FP: {activeCombatant?.currentFP ?? '-'}</div>
          </Tooltip>
          <Tooltip content="Current physical status affecting your ability to act." position="right">
            <div>Status: <span style={{ color: '#4f4' }}>OK</span></div>
          </Tooltip>
        </div>

        <div className="card">
          <h3>Participants</h3>
          <ul>
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
          <div>Lobby: {lobbyId ?? 'Not joined'}</div>
        </div>
      </div>}
    </aside>
  )
}

type GameActionPanelProps = {
  matchState: MatchState | null
  logs: string[]
  moveTarget: unknown
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
  { type: 'do_nothing', label: 'Do Nothing', icon: '💤', desc: 'Recover from stun or wait. No move.', key: '7' },
]

export const GameActionPanel = ({ 
  matchState, 
  logs, 
  moveTarget, 
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
    const effectiveSkill = baseSkillLevel + rangeMod
    const prob = getHitProbability(effectiveSkill)
    
    let color = '#ff4444'
    if (prob >= 70) color = '#44ff44'
    else if (prob >= 40) color = '#ffcc00'

    hitChanceInfo = {
      dist,
      baseSkillLevel,
      skillName,
      rangeMod,
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
      return (
        <div className="maneuver-grid">
          {MANEUVERS.map(m => (
            <Tooltip key={m.type} content={m.desc} position="top">
              <button 
                className="maneuver-btn"
                onClick={() => onAction('select_maneuver', { type: 'select_maneuver', maneuver: m.type })}
              >
                <span className="maneuver-icon">{m.icon}</span>
                <span className="maneuver-label">{m.label}</span>
                <span className="key-hint">{m.key}</span>
              </button>
            </Tooltip>
          ))}
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
        case 'do_nothing':
          return { text: 'Waiting. Click End Turn.', canAttack: false, canMove: false, isStep: false }
        default:
          return { text: '', canAttack: false, canMove: false, isStep: false }
      }
    }

    const instructions = getManeuverInstructions()
    const hasStepped = activeCombatant?.statusEffects.includes('has_stepped') ?? false
    const canStillMove = instructions.canMove && !(instructions.isStep && hasStepped)

    return (
      <div className="action-section">
        {currentManeuver && maneuverLabel && (
          <>
            <div className="current-maneuver-banner">
              <span className="maneuver-icon-small">{maneuverLabel.icon}</span>
              <span className="maneuver-name">{maneuverLabel.label}</span>
            </div>
            <div className="maneuver-instructions">{instructions.text}</div>
          </>
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
              {' → '}<strong>{hitChanceInfo.effectiveSkill}</strong>
            </div>
            <div className="hit-chance-value" style={{ color: hitChanceInfo.color }}>
              {hitChanceInfo.prob}% to hit
            </div>
          </div>
        )}

        <div className="action-buttons">
          {instructions.canAttack && (
            <button 
              className="action-btn primary"
              disabled={!selectedTargetId}
              onClick={() => selectedTargetId && onAction('attack', { type: 'attack', targetId: selectedTargetId })}
            >
              <span className="btn-icon">⚔️</span>
              {selectedTargetId ? `Attack ${selectedTargetName}` : 'Select a target on map'}
            </button>
          )}
          
          {canStillMove && (
            <>
              {moveTarget ? (
                <>
                  <button className="action-btn" onClick={() => onAction('move_click')}>
                    <span className="btn-icon">✓</span> {instructions.isStep ? 'Step (1 hex)' : 'Confirm Move'}
                  </button>
                  <button className="action-btn danger" onClick={() => onAction('cancel_move')}>
                    <span className="btn-icon">✕</span> Cancel
                  </button>
                </>
              ) : (
                <div className="action-hint">{instructions.isStep ? 'Click adjacent hex to step (optional)' : 'Click a hex on the map to move'}</div>
              )}
            </>
          )}

          <button 
            className="action-btn end-turn"
            onClick={() => onAction('end_turn', { type: 'end_turn' })}
          >
            <span className="btn-icon">⌛</span> End Turn
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
            <h3>{matchState?.status === 'finished' ? 'Match Over' : isMyTurn && !currentManeuver && matchState ? 'Choose Maneuver' : 'Actions'}</h3>
            {renderContent()}
          </div>

          <CombatLog logs={logs} />
        </div>
      )}
    </aside>
  )
}

