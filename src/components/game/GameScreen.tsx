import { useEffect, useCallback, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ArenaScene } from '../arena/ArenaScene'
import { TurnBanner } from './TurnBanner'
import { TurnStepper } from './TurnStepper'

import { ActionBar } from './ActionBar'
import { GameStatusPanel, GameActionPanel } from './GameHUD'
import { InitiativeTracker } from './InitiativeTracker'
import { MiniMap } from './MiniMap'
import { CombatToast } from './CombatToast'
import { SettingsPanel } from '../ui/SettingsPanel'
import type { CameraMode } from '../arena/CameraControls'
import type { MatchState, Player, GridPosition, CombatActionPayload, VisualEffect, ManeuverType, PendingAction } from '../../../shared/types'

type GameScreenProps = {
  matchState: MatchState | null
  player: Player | null
  lobbyPlayers: Player[]
  lobbyId: string | null
  logs: string[]
  visualEffects: (VisualEffect & { id: string })[]
  moveTarget: GridPosition | null
  selectedTargetId: string | null
  isPlayerTurn: boolean
  playerMoveRange: number
  pendingAction: PendingAction | null
  onGridClick: (position: GridPosition) => void
  onCombatantClick: (playerId: string) => void
  onAction: (action: string, payload?: CombatActionPayload) => void
  onPendingActionResponse: (response: string) => void
  onLeaveLobby: () => void
  onStartMatch: () => void
  onOpenCharacterEditor: () => void
  onCreateLobby: () => void
  onJoinLobby: () => void
  inLobbyButNoMatch: boolean
}

const MANEUVER_KEYS: Record<string, ManeuverType> = {
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
  lobbyId,
  logs,
  visualEffects,
  moveTarget,
  selectedTargetId,
  isPlayerTurn,
  playerMoveRange,
  pendingAction,
  onGridClick,
  onCombatantClick,
  onAction,
  onPendingActionResponse,
  onLeaveLobby,
  onStartMatch,
  onOpenCharacterEditor,
  onCreateLobby,
  onJoinLobby,
  inLobbyButNoMatch
}: GameScreenProps) => {
  const [showSettings, setShowSettings] = useState(false)
  const [cameraMode, setCameraMode] = useState<CameraMode>('follow')
  const currentCombatant = matchState?.combatants.find(c => c.playerId === player?.id) ?? null
  const currentManeuver = currentCombatant?.maneuver ?? null

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isPlayerTurn) return
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    
    const maneuver = MANEUVER_KEYS[e.key]
    if (maneuver) {
      e.preventDefault()
      onAction('select_maneuver', { type: 'select_maneuver', maneuver })
      return
    }
    
    if (e.key.toLowerCase() === 'e') {
      e.preventDefault()
      onAction('end_turn', { type: 'end_turn' })
      return
    }
  }, [isPlayerTurn, onAction])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="app-container">
      <GameStatusPanel
        matchState={matchState}
        player={player}
        lobbyPlayers={lobbyPlayers}
        lobbyId={lobbyId}
      />

      <main className="canvas-container">
        <InitiativeTracker matchState={matchState} />
        <TurnBanner 
          activeTurnPlayerId={matchState?.activeTurnPlayerId}
          players={matchState?.players ?? []}
          currentPlayerId={player?.id}
        />
        {matchState && matchState.status === 'active' && (
          <TurnStepper
            isMyTurn={isPlayerTurn}
            currentManeuver={currentManeuver}
          />
        )}
        <MiniMap matchState={matchState} playerId={player?.id ?? null} />
        <CombatToast logs={logs} />
        <button 
          className="settings-btn" 
          onClick={() => setShowSettings(true)}
          title="Accessibility Settings"
        >
          ⚙️
        </button>
        <div className="camera-controls-compact">
          <button 
            className={`camera-btn-compact ${cameraMode === 'follow' ? 'active' : ''}`}
            onClick={() => setCameraMode('follow')}
            title="Follow Active"
          >👁</button>
          <button 
            className={`camera-btn-compact ${cameraMode === 'top' ? 'active' : ''}`}
            onClick={() => setCameraMode('top')}
            title="Top-Down"
          >⬇</button>
          <button 
            className={`camera-btn-compact ${cameraMode === 'isometric' ? 'active' : ''}`}
            onClick={() => setCameraMode('isometric')}
            title="Isometric"
          >◇</button>
          <button 
            className={`camera-btn-compact ${cameraMode === 'free' ? 'active' : ''}`}
            onClick={() => setCameraMode('free')}
            title="Free Camera"
          >⟲</button>
        </div>
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
            playerMoveRange={playerMoveRange}
            visualEffects={visualEffects}
            cameraMode={cameraMode}
            onGridClick={onGridClick}
            onCombatantClick={onCombatantClick}
          />
        </Canvas>
      </main>

      <GameActionPanel
        matchState={matchState}
        logs={logs}
        moveTarget={moveTarget}
        selectedTargetId={selectedTargetId}
        currentManeuver={currentManeuver}
        isMyTurn={isPlayerTurn}
        onAction={onAction}
        onLeaveLobby={onLeaveLobby}
        onStartMatch={onStartMatch}
        onOpenCharacterEditor={onOpenCharacterEditor}
        onCreateLobby={onCreateLobby}
        onJoinLobby={onJoinLobby}
        inLobbyButNoMatch={inLobbyButNoMatch}
      />

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

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

      <ActionBar
        isMyTurn={isPlayerTurn}
        currentManeuver={currentManeuver}
        selectedTargetId={selectedTargetId}
        onAction={onAction}
      />
    </div>
  )
}
