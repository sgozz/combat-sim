import { createContext, useContext } from 'react'
import type { MatchState, Player } from '../../shared/types'

export type GameContextValue = {
  matchState: MatchState | null
  player: Player | null
  isPlayerTurn: boolean
  selectedTargetId: string | null
  logs: string[]
  onAction: (action: string, payload?: { type: string; [key: string]: unknown }) => void
  onLeaveLobby: () => void
  onCombatantClick: (playerId: string) => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children, value }: { children: React.ReactNode; value: GameContextValue }) {
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- Context hook must coexist with Provider
export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGameContext must be used within GameProvider')
  return ctx
}
