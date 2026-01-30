import { useState, useCallback, useEffect, useRef } from 'react'
import type { ServerToClientMessage } from '../../shared/types'
import { useAuth } from './useAuth'
import { useMatches } from './useMatches'
import { useMatchState } from './useMatchState'
import { useCharacterRoster } from './useCharacterRoster'

export type ScreenState = 'welcome' | 'matches' | 'waiting' | 'match'
export type ConnectionState = 'disconnected' | 'connecting' | 'connected'

export const useGameSocket = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const messageHandlers = useRef<Array<(msg: ServerToClientMessage) => boolean>>([])

  const sendMessage = useCallback((payload: unknown) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return
    }
    socket.send(JSON.stringify(payload))
  }, [socket])

  useEffect(() => {
    if (!socket) return

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data as string) as ServerToClientMessage
      
      for (const handler of messageHandlers.current) {
        if (handler(message)) break
      }
    }
  }, [socket])

  const matchState = useMatchState({
    messageHandlers,
  })

  const auth = useAuth({
    socket,
    setSocket,
    messageHandlers,
    setLogs: matchState.setLogs,
    setScreen: matchState.setScreen,
    setActiveMatchId: matchState.setActiveMatchId,
  })

  const matches = useMatches({
    sendMessage,
    messageHandlers,
    activeMatchId: matchState.activeMatchId,
    setActiveMatchId: matchState.setActiveMatchId,
    setMatchState: matchState.setMatchState,
    setLogs: matchState.setLogs,
    setScreen: matchState.setScreen,
  })

  const roster = useCharacterRoster()

  return {
    socket,
    connectionState: auth.connectionState,
    user: auth.user,
    myMatches: matches.myMatches,
    publicMatches: matches.publicMatches,
    activeMatchId: matchState.activeMatchId,
    matchState: matchState.matchState,
    logs: matchState.logs,
    screen: matchState.screen,
    visualEffects: matchState.visualEffects,
    pendingAction: matchState.pendingAction,
    authError: auth.authError,
    spectatingMatchId: matches.spectatingMatchId,
    setScreen: matchState.setScreen,
    setLogs: matchState.setLogs,
    setActiveMatchId: matchState.setActiveMatchId,
    setPendingAction: matchState.setPendingAction,
    register: auth.register,
    tryReconnect: auth.tryReconnect,
    sendMessage,
    logout: auth.logout,
    refreshMyMatches: matches.refreshMyMatches,
    fetchPublicMatches: matches.fetchPublicMatches,
    spectateMatch: matches.spectateMatch,
    stopSpectating: matches.stopSpectating,
    ...roster,
  }
}
