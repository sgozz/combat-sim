import { useEffect, useCallback, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ArenaScene } from '../arena/ArenaScene'
import { TurnBanner } from './TurnBanner'
import { GameStatusPanel, GameActionPanel } from './GameHUD'
import { InitiativeTracker } from './InitiativeTracker'
import { MiniMap } from './MiniMap'
import { SettingsPanel } from '../ui/SettingsPanel'
import type { MatchState, Player, GridPosition, CombatActionPayload, VisualEffect, ManeuverType } from '../../../shared/types'

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
  onGridClick: (position: GridPosition) => void
  onCombatantClick: (playerId: string) => void
  onAction: (action: string, payload?: CombatActionPayload) => void
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
  onGridClick,
  onCombatantClick,
  onAction,
  onLeaveLobby,
  onStartMatch,
  onOpenCharacterEditor,
  onCreateLobby,
  onJoinLobby,
  inLobbyButNoMatch
}: GameScreenProps) => {
  const [showSettings, setShowSettings] = useState(false)
  const currentCombatant = matchState?.combatants.find(c => c.playerId === player?.id)
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
        <MiniMap matchState={matchState} playerId={player?.id ?? null} />
        <button 
          className="settings-btn" 
          onClick={() => setShowSettings(true)}
          title="Accessibility Settings"
        >
          ⚙️
        </button>
        <Canvas camera={{ position: [5, 5, 5], fov: 50 }} shadows>
          <color attach="background" args={['#111']} />
          <ArenaScene
            combatants={matchState?.combatants ?? []}
            characters={matchState?.characters ?? []}
            playerId={player?.id ?? null}
            moveTarget={moveTarget}
            selectedTargetId={selectedTargetId}
            isPlayerTurn={isPlayerTurn}
            playerMoveRange={playerMoveRange}
            visualEffects={visualEffects}
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
    </div>
  )
}
