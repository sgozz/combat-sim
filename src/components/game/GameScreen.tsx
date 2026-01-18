import { useEffect, useCallback, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ArenaScene } from '../arena/ArenaScene'
import { TurnStepper } from './TurnStepper'

import { ActionBar } from './ActionBar'
import { GameStatusPanel, GameActionPanel } from './GameHUD'
import { InitiativeTracker } from './InitiativeTracker'
import { MiniMap } from './MiniMap'
import { CombatToast } from './CombatToast'
import { SettingsPanel } from '../ui/SettingsPanel'
import DefenseModal from '../ui/DefenseModal'
import type { CameraMode } from '../arena/CameraControls'
import type { MatchState, Player, GridPosition, CombatActionPayload, VisualEffect, ManeuverType, PendingAction, DefenseType } from '../../../shared/types'

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
  pendingAction: PendingAction | null
  onGridClick: (position: GridPosition) => void
  onCombatantClick: (playerId: string) => void
  onAction: (action: string, payload?: CombatActionPayload) => void
  onPendingActionResponse: (response: string) => void
  onLeaveLobby: () => void
  onStartMatch: (botCount: number) => void
  onOpenCharacterEditor: () => void
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
  matchCode,
  logs,
  visualEffects,
  moveTarget,
  selectedTargetId,
  isPlayerTurn,
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
  const [showSettings, setShowSettings] = useState(false)
  const [cameraMode, setCameraMode] = useState<CameraMode>('follow')
  const currentCombatant = matchState?.combatants.find(c => c.playerId === player?.id) ?? null
  const currentManeuver = currentCombatant?.maneuver ?? null

  const pendingDefense = matchState?.pendingDefense
  const isDefending = pendingDefense?.defenderId === player?.id
  const attackerPlayer = matchState?.players.find(p => p.id === pendingDefense?.attackerId)
  const defenderCharacter = matchState?.characters.find(c => c.id === currentCombatant?.characterId)
  const inCloseCombat = currentCombatant?.inCloseCombatWith !== null

  const handleDefenseChoice = useCallback((choice: { type: DefenseType; retreat: boolean; dodgeAndDrop: boolean }) => {
    onAction('defend', { type: 'defend', defenseType: choice.type, retreat: choice.retreat, dodgeAndDrop: choice.dodgeAndDrop })
  }, [onAction])

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
        isMyTurn={isPlayerTurn}
        onAction={onAction}
      />

      <main className="canvas-container">
        <InitiativeTracker matchState={matchState} />
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
        <div className="top-buttons">
          <button 
            className="back-btn" 
            onClick={() => {
              if (!matchState || matchState.status === 'finished' || confirm('Leave the current game?')) {
                onLeaveLobby()
              }
            }}
            title="Back to Lobby List"
          >
            ← Lobbies
          </button>
          <button 
            className="settings-btn" 
            onClick={() => setShowSettings(true)}
            title="Accessibility Settings"
          >
            ⚙️
          </button>
        </div>
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
            reachableHexes={matchState?.reachableHexes ?? []}
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
        selectedTargetId={selectedTargetId}
        currentManeuver={currentManeuver}
        isMyTurn={isPlayerTurn}
        matchCode={matchCode}
        lobbyPlayerCount={lobbyPlayers.length}
        onAction={onAction}
        onLeaveLobby={onLeaveLobby}
        onStartMatch={onStartMatch}
        onOpenCharacterEditor={onOpenCharacterEditor}
        inLobbyButNoMatch={inLobbyButNoMatch}
      />

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {isDefending && pendingDefense && defenderCharacter && currentCombatant && (
        <DefenseModal
          pendingDefense={pendingDefense}
          character={defenderCharacter}
          combatant={currentCombatant}
          attackerName={attackerPlayer?.name ?? 'Unknown'}
          inCloseCombat={inCloseCombat}
          onDefend={handleDefenseChoice}
        />
      )}

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

      <ActionBar
        isMyTurn={isPlayerTurn}
        currentManeuver={currentManeuver}
        selectedTargetId={selectedTargetId}
        matchState={matchState}
        inLobbyButNoMatch={inLobbyButNoMatch}
        playerId={player?.id ?? null}
        lobbyPlayerCount={lobbyPlayers.length}
        onAction={onAction}
        onDefend={handleDefenseChoice}
        onLeaveLobby={onLeaveLobby}
        onStartMatch={onStartMatch}
        onOpenCharacterEditor={onOpenCharacterEditor}
      />
    </div>
  )
}
