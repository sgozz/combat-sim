import { Canvas } from '@react-three/fiber'
import { ArenaScene } from '../arena/ArenaScene'
import { GameStatusPanel, GameActionPanel } from './GameHUD'
import type { MatchState, Player, GridPosition, CombatActionPayload } from '../../../shared/types'

type GameScreenProps = {
  matchState: MatchState | null
  player: Player | null
  lobbyPlayers: Player[]
  lobbyId: string | null
  logs: string[]
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

export const GameScreen = ({
  matchState,
  player,
  lobbyPlayers,
  lobbyId,
  logs,
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
  return (
    <div className="app-container">
      <GameStatusPanel
        matchState={matchState}
        player={player}
        lobbyPlayers={lobbyPlayers}
        lobbyId={lobbyId}
      />

      <main className="canvas-container">
        <div className="overlay-ui">
          Current Turn: {matchState?.players.find((p) => p.id === matchState.activeTurnPlayerId)?.name ?? 'Waiting'}
        </div>
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
        onAction={onAction}
        onLeaveLobby={onLeaveLobby}
        onStartMatch={onStartMatch}
        onOpenCharacterEditor={onOpenCharacterEditor}
        onCreateLobby={onCreateLobby}
        onJoinLobby={onJoinLobby}
        inLobbyButNoMatch={inLobbyButNoMatch}
      />
    </div>
  )
}
