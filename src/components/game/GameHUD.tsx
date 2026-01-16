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
  const activeCombatant = matchState?.combatants.find((combatant) => combatant.playerId === player?.id) ?? null

  return (
    <aside className="panel">
      <div className="panel-header">Lobby / Status</div>
      <div className="panel-content">
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
      </div>
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
                <div className="maneuver-icon">{m.icon}</div>
                <div className="maneuver-label"><span className="key-hint">[{m.key}]</span> {m.label}</div>
              </button>
            </Tooltip>
          ))}
        </div>
      )
    }

    const actions = [
        {
          label: selectedTargetId ? `Attack ${selectedTargetName}` : 'Attack (select target)',
          icon: '⚔️',
          disabled: !isMyTurn,
          onClick: () => {
            if (!selectedTargetId) return
            onAction('attack', { type: 'attack', targetId: selectedTargetId })
          },
        },
        {
          label: 'Defend',
          icon: '🛡️',
          disabled: !isMyTurn,
          onClick: () => onAction('defend', { type: 'defend' }),
        },
        {
          label: 'Turn Left',
          icon: '↺',
          disabled: !isMyTurn,
          onClick: () => onAction('turn_left', { type: 'turn_left' }),
        },
        {
          label: 'Turn Right',
          icon: '↻',
          disabled: !isMyTurn,
          onClick: () => onAction('turn_right', { type: 'turn_right' }),
        },
        {
          label: moveTarget ? 'Confirm Move' : 'Move (click grid)',
          icon: '🦶',
          disabled: !isMyTurn,
          onClick: () => onAction('move_click'),
        },
        ...(moveTarget ? [{ label: 'Cancel Move', icon: '❌', onClick: () => onAction('cancel_move') }] : []),
        { label: 'End Turn', icon: '⌛', disabled: !isMyTurn, onClick: () => onAction('end_turn', { type: 'end_turn' }) },
        { label: 'Leave Match', icon: '🚪', onClick: onLeaveLobby },
      ]

    return (
      <div className="action-grid">
        {hitChanceInfo && (
          <div className="hit-chance-preview" style={{ 
            gridColumn: '1 / -1', 
            padding: '10px', 
            background: 'rgba(0,0,0,0.3)', 
            borderRadius: '4px',
            marginBottom: '10px',
            borderLeft: `4px solid ${hitChanceInfo.color}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <strong style={{ color: '#fff' }}>Target: {selectedTargetName}</strong>
              <span style={{ color: '#aaa' }}>{hitChanceInfo.dist} hexes</span>
            </div>
            <div style={{ fontSize: '0.9em', color: '#ccc' }}>
              <Tooltip content="Base skill level before modifiers" position="top">
                <span style={{ borderBottom: '1px dotted #888', cursor: 'help' }}>{hitChanceInfo.skillName}</span>
              </Tooltip>: {hitChanceInfo.baseSkillLevel} {hitChanceInfo.rangeMod < 0 ? `(${hitChanceInfo.rangeMod} range)` : ''} 
              {' '}→ <strong>{hitChanceInfo.effectiveSkill}</strong>
            </div>
            <div style={{ 
              fontSize: '1.2em', 
              fontWeight: 'bold', 
              color: hitChanceInfo.color,
              marginTop: '4px' 
            }}>
              Hit Chance: {hitChanceInfo.prob}%
            </div>
          </div>
        )}
        {actions.map((btn) => (
          <button 
            key={btn.label} 
            className={`action-btn ${btn.label.includes('Cancel') ? 'danger' : ''}`}
            onClick={btn.onClick}
            disabled={btn.disabled}
          >
            {btn.icon && <span className="btn-icon">{btn.icon}</span>}
            {btn.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <aside className="panel panel-right">
      <div className="panel-header">Actions & Log</div>
      <div className="panel-content">
        <div className="card">
          <h3>{matchState?.status === 'finished' ? 'Match Over' : isMyTurn && !currentManeuver && matchState ? 'Choose Maneuver' : 'Actions'}</h3>
          {renderContent()}
        </div>

        <CombatLog logs={logs} />
      </div>
    </aside>
  )
}

