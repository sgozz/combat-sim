import { useState, useCallback, useEffect, useRef } from 'react'
import type { ServerToClientMessage, Player, LobbySummary, MatchState, VisualEffect } from '../../shared/types'

export type ScreenState = 'welcome' | 'lobby' | 'waiting' | 'match'

export const useGameSocket = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [lobbies, setLobbies] = useState<LobbySummary[]>([])
  const [lobbyPlayers, setLobbyPlayers] = useState<Player[]>([])
  const [lobbyId, setLobbyId] = useState<string | null>(null)
  const [matchState, setMatchState] = useState<MatchState | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [screen, setScreen] = useState<ScreenState>('welcome')
  const [visualEffects, setVisualEffects] = useState<(VisualEffect & { id: string })[]>([])
  const connectingRef = useRef(false)

  const initializeConnection = useCallback((name: string) => {
    if (connectingRef.current) {
      return
    }
    connectingRef.current = true
    const ws = new WebSocket('ws://127.0.0.1:8080')
    setSocket(ws)

    ws.onopen = () => {
      setLogs((prev) => [...prev, 'Connected to server.'])
      ws.send(JSON.stringify({ type: 'auth', name }))
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data as string) as ServerToClientMessage
      
      switch (message.type) {
        case 'auth_ok':
          setPlayer(message.player)
          break
        case 'lobbies':
          setLobbies(message.lobbies)
          break
        case 'lobby_joined':
          setLobbyPlayers(message.players)
          setLobbyId(message.lobbyId)
          setLogs((prev) => [...prev, `Joined lobby ${message.lobbyId}.`])
          setScreen('waiting')
          break
        case 'lobby_left':
          setLobbyId(null)
          setMatchState(null)
          setLobbyPlayers([])
          setLogs((prev) => [...prev, 'Left lobby.'])
          setScreen('lobby')
          break
        case 'match_state':
          setMatchState(message.state)
          setLobbyPlayers(message.state.players)
          setLogs(message.state.log)
          setScreen('match')
          break
        case 'visual_effect': {
          const id = crypto.randomUUID()
          const effect = { ...message.effect, id }
          setVisualEffects(prev => [...prev, effect])
          setTimeout(() => {
            setVisualEffects(prev => prev.filter(e => e.id !== id))
          }, 2000)
          break
        }
        case 'error':
          setLogs((prev) => [...prev, `Error: ${message.message}`])
          break
      }
    }

    ws.onerror = () => {
      setLogs((prev) => [...prev, 'Connection error.'])
    }

    ws.onclose = () => {
      setLogs((prev) => [...prev, 'Disconnected from server.'])
      setSocket(null)
      setLobbyId(null)
      setMatchState(null)
      setLobbyPlayers([])
      connectingRef.current = false
    }
  }, [])

  const sendMessage = useCallback((payload: unknown) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setLogs((prev) => [...prev, 'Error: Not connected.'])
      return
    }
    socket.send(JSON.stringify(payload))
  }, [socket])

  useEffect(() => {
    return () => {
      socket?.close()
    }
  }, [socket])

  return {
    socket,
    player,
    lobbies,
    lobbyPlayers,
    lobbyId,
    matchState,
    logs,
    screen,
    visualEffects,
    setScreen,
    setLogs,
    initializeConnection,
    sendMessage
  }
}
