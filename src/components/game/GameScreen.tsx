import { useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { ArenaScene } from '../arena/ArenaScene'
import { TurnStepper } from './TurnStepper'
import { MatchEndOverlay } from './MatchEndOverlay'

import { getRulesetComponents } from '../rulesets'

import { InitiativeTracker } from './InitiativeTracker'
import { MiniMap } from './MiniMap'
import { CombatToast } from './CombatToast'

import { getRulesetUiSlots } from './shared/rulesetUiSlots'

import type { MatchState, Player, GridPosition, VisualEffect, PendingAction } from '../../../shared/types'
import { isGurpsCombatant, isPF2Combatant } from '../../../shared/rulesets'

type GameScreenProps = {
  matchState: MatchState | null
  player: Player | null
  lobbyPlayers: Player[]
  logs: string[]
  visualEffects: (VisualEffect & { id: string })[]
  moveTarget: GridPosition | null
  selectedTargetId: string | null
  isPlayerTurn: boolean
  isSpectating?: boolean
  pendingAction: PendingAction | null
  onGridClick: (position: GridPosition) => void
  onCombatantClick: (playerId: string) => void
  onAction: (action: string, payload?: { type: string; [key: string]: unknown }) => void
  onPendingActionResponse: (response: string) => void
  onLeaveLobby: () => void
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
  logs,
  visualEffects,
  moveTarget,
  selectedTargetId,
  isPlayerTurn,
  isSpectating = false,
  pendingAction,
  onGridClick,
  onCombatantClick,
  onAction,
  onPendingActionResponse,
  onLeaveLobby,
}: GameScreenProps) => {
  const { matchId } = useParams<{ matchId: string }>()
  void matchId
   const currentCombatant = matchState?.combatants.find(c => c.playerId === player?.id) ?? null
   const currentManeuver = (currentCombatant && isGurpsCombatant(currentCombatant)) ? currentCombatant.maneuver : null
   const actionsRemaining = (currentCombatant && isPF2Combatant(currentCombatant)) ? currentCombatant.actionsRemaining : 0

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
   {canRenderPanels ? (
           <GameStatusPanel
             matchState={matchState}
             player={player}
             combatant={currentCombatant}
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
            rulesetId={matchState.rulesetId}
            actionsRemaining={actionsRemaining}
          />
        )}
        <MiniMap matchState={matchState} playerId={player?.id ?? null} />
        
        <Canvas camera={{ position: [5, 5, 5], fov: 50 }} shadows>
          <color attach="background" args={['#111']} />
            <ArenaScene
              combatants={matchState?.combatants ?? []}
             characters={matchState?.characters ?? []}
             playerId={player?.id ?? null}
             activeTurnPlayerId={matchState?.activeTurnPlayerId ?? null}
             moveTarget={moveTarget}
             selectedTargetId={selectedTargetId}
             isPlayerTurn={isPlayerTurn}
              reachableHexes={matchState?.reachableHexes ?? []}
              visualEffects={visualEffects}
              cameraMode="free"
              rulesetId={matchState?.rulesetId ?? 'gurps'}
              onGridClick={onGridClick}
              onCombatantClick={onCombatantClick}
            />
          <EffectComposer>
            <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={0.4} />
            <Vignette eskil={false} offset={0.1} darkness={0.8} />
          </EffectComposer>
        </Canvas>
      </main>

        {canRenderPanels ? (
           <GameActionPanel
             matchState={matchState}
             player={player}
             combatant={currentCombatant}
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



       {isDefending && pendingDefense && defenderCharacter && currentCombatant && matchState?.rulesetId === 'gurps' && (() => {
         const { DefenseModal: DefenseModalSlot } = getRulesetUiSlots(matchState?.rulesetId);
         return DefenseModalSlot ? (
            <DefenseModalSlot
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              pendingDefense={pendingDefense as any}
              character={defenderCharacter}
              combatant={currentCombatant}
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

        {canRenderPanels && (
           <ActionBar
             matchState={matchState}
             player={player}
             combatant={currentCombatant}
            character={playerCharacter}
            isMyTurn={isPlayerTurn}
            currentManeuver={currentManeuver}
            selectedTargetId={selectedTargetId}
            onAction={onAction}
            onDefend={handleDefenseChoice}
            onLeaveLobby={onLeaveLobby}
          />
        )}

        <MatchEndOverlay
          matchStatus={matchState?.status ?? 'waiting'}
          winnerName={matchState?.winnerId ? matchState.players.find(p => p.id === matchState.winnerId)?.name : undefined}
          currentPlayerName={player?.name}
          onReturnToDashboard={onLeaveLobby}
        />
    </div>
  )
}
