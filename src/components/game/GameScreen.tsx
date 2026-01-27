import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { ArenaScene } from '../arena/ArenaScene'
import { TurnStepper } from './TurnStepper'

import { getRulesetComponents } from '../rulesets'

import { InitiativeTracker } from './InitiativeTracker'
import { MiniMap } from './MiniMap'
import { CombatToast } from './CombatToast'

import { getRulesetUiSlots } from './shared/rulesetUiSlots'
import type { CameraMode } from '../arena/CameraControls'
import type { MatchState, Player, GridPosition, VisualEffect, PendingAction } from '../../../shared/types'
import { isGurpsCombatant } from '../../../shared/rulesets'

type GameScreenProps = {
  matchState: MatchState | null
  player: Player | null
  lobbyPlayers: Player[]
  lobbyId: string | null
  matchCode: string | null
  logs: string[]
  visualEffects: (VisualEffect & { id: string })[]
  moveTarget: GridPosition | null
  selectedTargetId: string | null
  isPlayerTurn: boolean
  isCreator: boolean
  isSpectating?: boolean
  pendingAction: PendingAction | null
  onGridClick: (position: GridPosition) => void
  onCombatantClick: (playerId: string) => void
  onAction: (action: string, payload?: { type: string; [key: string]: unknown }) => void
  onPendingActionResponse: (response: string) => void
  onLeaveLobby: () => void
  onStartMatch: (botCount: number) => void
  onOpenCharacterEditor: () => void
  inLobbyButNoMatch: boolean
}

const MANEUVER_KEYS: Record<string, string> = {
  '1': 'move',
  '2': 'attack',
  '3': 'all_out_attack',
  '4': 'all_out_defense',
  '5': 'move_and_attack',
  '6': 'aim',
  '7': 'do_nothing',
}

export const GameScreen = ({
  matchState,
  player,
  lobbyPlayers,
  lobbyId: _lobbyId,
  matchCode,
  logs,
  visualEffects,
  moveTarget,
  selectedTargetId,
  isPlayerTurn,
  isCreator,
  isSpectating = false,
  pendingAction,
  onGridClick,
  onCombatantClick,
  onAction,
  onPendingActionResponse,
  onLeaveLobby,
  onStartMatch,
  onOpenCharacterEditor,
  inLobbyButNoMatch
}: GameScreenProps) => {
  void _lobbyId
  const [cameraMode, setCameraMode] = useState<CameraMode>('overview')
  const hasSeenMatchStart = useRef(false)
   const currentCombatant = matchState?.combatants.find(c => c.playerId === player?.id) ?? null
   const currentManeuver = (currentCombatant && isGurpsCombatant(currentCombatant)) ? currentCombatant.maneuver : null

  useEffect(() => {
    if (matchState?.status === 'active' && !hasSeenMatchStart.current) {
      hasSeenMatchStart.current = true
      setCameraMode('overview')
      
      const timer = setTimeout(() => {
        setCameraMode('follow')
      }, 3000)
      
      return () => clearTimeout(timer)
    }
    
    if (!matchState || matchState.status === 'finished') {
      hasSeenMatchStart.current = false
    }
  }, [matchState?.status, matchState])

  useEffect(() => {
    if (hasSeenMatchStart.current && isPlayerTurn && cameraMode === 'overview') {
      setCameraMode('follow')
    }
  }, [isPlayerTurn, cameraMode])

  const pendingDefense = matchState?.pendingDefense
  const isDefending = pendingDefense?.defenderId === player?.id
  const attackerPlayer = matchState?.players.find(p => p.id === pendingDefense?.attackerId)
  const defenderCharacter = matchState?.characters.find(c => c.id === currentCombatant?.characterId)
   const inCloseCombat = (currentCombatant && isGurpsCombatant(currentCombatant)) ? currentCombatant.inCloseCombatWith !== null : false

  const handleDefenseChoice = useCallback((choice: { type: string; retreat: boolean; dodgeAndDrop: boolean }) => {
    onAction('defend', { type: 'defend', defenseType: choice.type, retreat: choice.retreat, dodgeAndDrop: choice.dodgeAndDrop })
  }, [onAction])

  const inMovementPhase = matchState?.turnMovement?.phase === 'moving'
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isPlayerTurn) return
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    
    const maneuver = MANEUVER_KEYS[e.key]
    if (maneuver && !inMovementPhase) {
      e.preventDefault()
      onAction('select_maneuver', { type: 'select_maneuver', maneuver })
      return
    }
    
    if (e.key.toLowerCase() === 'e') {
      e.preventDefault()
      onAction('end_turn', { type: 'end_turn' })
      return
    }
  }, [isPlayerTurn, inMovementPhase, onAction])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const rulesetId = matchState?.rulesetId ?? 'gurps'
  const { GameStatusPanel, GameActionPanel, ActionBar } = useMemo(
    () => getRulesetComponents(rulesetId),
    [rulesetId]
  )

  const playerCharacter = matchState?.characters.find(c => c.id === currentCombatant?.characterId)
  const canRenderPanels = matchState && player && currentCombatant && playerCharacter

  return (
    <div className="app-container">
       {canRenderPanels && matchState?.rulesetId === 'gurps' ? (
         <GameStatusPanel
           matchState={matchState}
           player={player}
           combatant={currentCombatant as any}
           character={playerCharacter}
           lobbyPlayers={lobbyPlayers}
           isMyTurn={isPlayerTurn}
           onAction={onAction}
         />
      ) : (
        <aside className="panel">
          <div className="panel-header">
            <span>Status</span>
          </div>
          <div className="panel-content">
            <div className="card">
              <p>Loading...</p>
            </div>
          </div>
        </aside>
      )}

      <main className="canvas-container">
        <header className="game-header">
          <div className="game-header-left">
            <button 
              className="header-btn back-btn" 
              onClick={() => {
                if (!matchState || matchState.status === 'finished' || confirm('Leave the current game?')) {
                  onLeaveLobby()
                }
              }}
              title="Back to Lobby List"
            >
              <span className="btn-icon">←</span>
              <span className="btn-label">{isSpectating ? 'Stop' : 'Back'}</span>
            </button>
          </div>
          
          <InitiativeTracker matchState={matchState} />
          
          <div className="game-header-right">
            <div className="camera-controls">
              <button 
                className={`header-btn camera-btn ${cameraMode === 'follow' ? 'active' : ''}`}
                onClick={() => setCameraMode('follow')}
                title="Follow Active"
              >👁</button>
              <button 
                className={`header-btn camera-btn ${cameraMode === 'top' ? 'active' : ''}`}
                onClick={() => setCameraMode('top')}
                title="Top-Down"
              >⬇</button>
              <button 
                className={`header-btn camera-btn ${cameraMode === 'isometric' ? 'active' : ''}`}
                onClick={() => setCameraMode('isometric')}
                title="Isometric"
              >◇</button>
              <button 
                className={`header-btn camera-btn ${cameraMode === 'overview' ? 'active' : ''}`}
                onClick={() => setCameraMode('overview')}
                title="Overview"
              >◎</button>
              <button 
                className={`header-btn camera-btn ${cameraMode === 'free' ? 'active' : ''}`}
                onClick={() => setCameraMode('free')}
                title="Free Camera"
              >⟲</button>
            </div>
          </div>
        </header>

        <CombatToast 
          logs={logs} 
          activeTurnPlayerId={matchState?.activeTurnPlayerId}
          currentPlayerId={player?.id}
          players={matchState?.players}
        />
        {matchState && matchState.status === 'active' && (
          <TurnStepper
            isMyTurn={isPlayerTurn}
            currentManeuver={currentManeuver}
          />
        )}
        <MiniMap matchState={matchState} playerId={player?.id ?? null} />
        
        <Canvas camera={{ position: [5, 5, 5], fov: 50 }} shadows>
          <color attach="background" args={['#111']} />
           <ArenaScene
             combatants={(matchState?.combatants ?? []) as any}
             characters={matchState?.characters ?? []}
             playerId={player?.id ?? null}
             activeTurnPlayerId={matchState?.activeTurnPlayerId ?? null}
             moveTarget={moveTarget}
             selectedTargetId={selectedTargetId}
             isPlayerTurn={isPlayerTurn}
             reachableHexes={matchState?.reachableHexes ?? []}
             visualEffects={visualEffects}
             cameraMode={cameraMode}
             rulesetId={matchState?.rulesetId ?? 'gurps'}
             onGridClick={onGridClick}
             onCombatantClick={onCombatantClick}
           />
        </Canvas>
      </main>

       {canRenderPanels && matchState?.rulesetId === 'gurps' ? (
         <GameActionPanel
           matchState={matchState}
           player={player}
           combatant={currentCombatant as any}
           character={playerCharacter}
           logs={logs}
           selectedTargetId={selectedTargetId}
           currentManeuver={currentManeuver}
           isMyTurn={isPlayerTurn}
           onAction={onAction}
           onLeaveLobby={onLeaveLobby}
         />
      ) : (
        <aside className="panel panel-right">
          <div className="panel-header">
            <span>Actions</span>
          </div>
          <div className="panel-content">
            <div className="card">
              <p>Waiting for match...</p>
            </div>
          </div>
        </aside>
      )}

      {inLobbyButNoMatch && (
        <div className="lobby-setup-overlay">
          <div className="lobby-setup-modal">
            <h2>Match Setup</h2>
            
            <div className="setup-section">
              <label>Players ({lobbyPlayers.length}/4)</label>
              <div className="setup-players-list">
                {lobbyPlayers.map(p => (
                  <div key={p.id} className="setup-player-item">
                    <span className="setup-player-icon">{p.id === player?.id ? '👤' : '🎮'}</span>
                    <span className="setup-player-name">{p.name}</span>
                    {p.id === player?.id && <span className="setup-player-you">(you)</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="setup-section">
              <label>Invite Link</label>
              <div className="setup-invite-row">
                <input 
                  type="text" 
                  readOnly 
                  value={`${window.location.origin}?join=${matchCode ?? ''}`}
                  className="setup-invite-input"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button 
                  className="setup-copy-btn"
                  onClick={() => {
                    if (matchCode) {
                      navigator.clipboard.writeText(`${window.location.origin}?join=${matchCode}`)
                    }
                  }}
                  disabled={!matchCode}
                >
                  📋
                </button>
              </div>
            </div>

            <div className="setup-section">
              <label>Your Character</label>
              <button className="setup-btn" onClick={onOpenCharacterEditor}>
                ✏️ Edit Character
              </button>
            </div>

            {isCreator && (
              <div className="setup-section">
                <label>AI Opponents</label>
                <div className="setup-bot-row">
                  <button 
                    className="setup-bot-btn"
                    onClick={() => {
                      const input = document.querySelector('.bot-count-display') as HTMLElement
                      const currentBots = parseInt(input?.dataset.count ?? '1')
                      const newCount = Math.max(0, currentBots - 1)
                      if (input) {
                        input.dataset.count = String(newCount)
                        input.textContent = String(newCount)
                      }
                    }}
                  >−</button>
                  <span className="bot-count-display" data-count="1">1</span>
                  <button 
                    className="setup-bot-btn"
                    onClick={() => {
                      const current = lobbyPlayers.length
                      const maxBots = 4 - current
                      const input = document.querySelector('.bot-count-display') as HTMLElement
                      const currentBots = parseInt(input?.dataset.count ?? '1')
                      const newCount = Math.min(maxBots, currentBots + 1)
                      if (input) {
                        input.dataset.count = String(newCount)
                        input.textContent = String(newCount)
                      }
                    }}
                  >+</button>
                </div>
              </div>
            )}

            <div className="setup-actions">
              <button 
                className="setup-btn primary"
                onClick={() => {
                  const input = document.querySelector('.bot-count-display') as HTMLElement
                  const botCount = parseInt(input?.dataset.count ?? '1')
                  onStartMatch(botCount)
                }}
                disabled={lobbyPlayers.length < 1}
              >
                ▶️ Start Match
              </button>
              <button className="setup-btn danger" onClick={onLeaveLobby}>
                🚪 Leave
              </button>
            </div>
          </div>
        </div>
      )}

       {isDefending && pendingDefense && defenderCharacter && currentCombatant && matchState?.rulesetId === 'gurps' && (() => {
         const { DefenseModal: DefenseModalSlot } = getRulesetUiSlots(matchState?.rulesetId);
         return DefenseModalSlot ? (
           <DefenseModalSlot
             pendingDefense={pendingDefense as any}
             character={defenderCharacter}
             combatant={currentCombatant as any}
             attackerName={attackerPlayer?.name ?? 'Unknown'}
             inCloseCombat={inCloseCombat}
             onDefend={handleDefenseChoice}
             rulesetId={matchState?.rulesetId}
           />
         ) : null;
       })()}

      {pendingAction?.type === 'exit_close_combat_request' && pendingAction.targetId === player?.id && (
        <div className="modal-overlay">
          <div className="pending-action-modal">
            <h3>Opponent Exiting Close Combat</h3>
            <p>{matchState?.players.find(p => p.id === pendingAction.exitingId)?.name} is trying to exit close combat.</p>
            <div className="pending-action-buttons">
              <button onClick={() => onPendingActionResponse('let_go')}>Let Go</button>
              <button onClick={() => onPendingActionResponse('follow')}>Follow</button>
              <button onClick={() => onPendingActionResponse('attack')}>Free Attack</button>
            </div>
          </div>
        </div>
      )}

      {matchState?.status === 'paused' && (
        <div className="modal-overlay pause-overlay">
          <div className="pause-modal">
            <div className="pause-icon">⏸</div>
            <h2>Match Paused</h2>
            <p>
              Waiting for <strong>{matchState.players.find(p => p.id === matchState.pausedForPlayerId)?.name ?? 'player'}</strong> to reconnect...
            </p>
            <div className="pause-spinner"></div>
            <button 
              className="action-btn secondary pause-leave-btn"
              onClick={onLeaveLobby}
            >
              ← Back to Lobby
            </button>
          </div>
        </div>
      )}

       {canRenderPanels && matchState?.rulesetId === 'gurps' && (
         <ActionBar
           matchState={matchState}
           player={player}
           combatant={currentCombatant as any}
           character={playerCharacter}
           isMyTurn={isPlayerTurn}
           currentManeuver={currentManeuver}
           selectedTargetId={selectedTargetId}
           onAction={onAction}
           onDefend={handleDefenseChoice}
           onLeaveLobby={onLeaveLobby}
         />
       )}
    </div>
  )
}
