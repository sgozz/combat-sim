import { useState, useCallback, useEffect, useRef } from 'react'
import type { ServerToClientMessage, Player, LobbySummary, MatchState, VisualEffect, PendingAction } from '../../shared/types'

export type ScreenState = 'welcome' | 'lobby' | 'waiting' | 'match'
export type ConnectionState = 'disconnected' | 'connecting' | 'connected'

const SESSION_TOKEN_KEY = 'gurps.sessionToken'

export const useGameSocket = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [player, setPlayer] = useState<Player | null>(null)
  const [lobbies, setLobbies] = useState<LobbySummary[]>([])
  const [lobbyPlayers, setLobbyPlayers] = useState<Player[]>([])
  const [lobbyId, setLobbyId] = useState<string | null>(null)
  const [matchState, setMatchState] = useState<MatchState | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [screen, setScreen] = useState<ScreenState>('welcome')
  const [visualEffects, setVisualEffects] = useState<(VisualEffect & { id: string })[]>([])
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const connectingRef = useRef(false)
  const reconnectAttemptRef = useRef(false)

  const handleMessage = useCallback((message: ServerToClientMessage) => {
    switch (message.type) {
      case 'auth_ok':
        setPlayer(message.player)
        localStorage.setItem(SESSION_TOKEN_KEY, message.sessionToken)
        setConnectionState('connected')
        setScreen('lobby')
        break
      case 'session_invalid':
        localStorage.removeItem(SESSION_TOKEN_KEY)
        setConnectionState('disconnected')
        setScreen('welcome')
        break
      case 'lobbies':
        setLobbies(message.lobbies)
        break
      case 'lobby_joined':
        setLobbyPlayers(message.players)
        setLobbyId(message.lobbyId)
        setLogs((prev) => [...prev, `Joined lobby.`])
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
        if (message.state.status !== 'finished') {
          setScreen('match')
        }
        break
      case 'match_paused':
        setLogs((prev) => [...prev, `Match paused: waiting for ${message.playerName} to reconnect...`])
        break
      case 'match_resumed':
        setLogs((prev) => [...prev, `${message.playerName} reconnected. Match resumed!`])
        break
      case 'player_disconnected':
        setLogs((prev) => [...prev, `${message.playerName} disconnected.`])
        break
      case 'player_reconnected':
        setLogs((prev) => [...prev, `${message.playerName} reconnected.`])
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
      case 'pending_action':
        setPendingAction(message.action)
        break
      case 'error':
        setLogs((prev) => [...prev, `Error: ${message.message}`])
        if (connectingRef.current) {
          setAuthError(message.message)
          setConnectionState('disconnected')
          connectingRef.current = false
        }
        break
    }
  }, [])

  const createWebSocket = useCallback((onOpen: (ws: WebSocket) => void) => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8080'
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      setLogs((prev) => [...prev, 'Connected to server.'])
      onOpen(ws)
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data as string) as ServerToClientMessage
      handleMessage(message)
    }

    ws.onerror = () => {
      setLogs((prev) => [...prev, 'Connection error.'])
    }

    ws.onclose = () => {
      setLogs((prev) => [...prev, 'Disconnected from server.'])
      setSocket(null)
      setConnectionState('disconnected')
      connectingRef.current = false
    }

    setSocket(ws)
    return ws
  }, [handleMessage])

  const register = useCallback((username: string) => {
    if (connectingRef.current) return
    connectingRef.current = true
    setAuthError(null)
    setConnectionState('connecting')
    
    createWebSocket((ws) => {
      ws.send(JSON.stringify({ type: 'register', username }))
    })
  }, [createWebSocket])

  const tryReconnect = useCallback(() => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY)
    if (!token || connectingRef.current || reconnectAttemptRef.current) return false
    
    reconnectAttemptRef.current = true
    connectingRef.current = true
    setConnectionState('connecting')
    
    createWebSocket((ws) => {
      ws.send(JSON.stringify({ type: 'auth', sessionToken: token }))
      reconnectAttemptRef.current = false
    })
    
    return true
  }, [createWebSocket])

  const sendMessage = useCallback((payload: unknown) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setLogs((prev) => [...prev, 'Error: Not connected.'])
      return
    }
    socket.send(JSON.stringify(payload))
  }, [socket])

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_TOKEN_KEY)
    socket?.close()
    setPlayer(null)
    setLobbyId(null)
    setMatchState(null)
    setLobbyPlayers([])
    setScreen('welcome')
    setConnectionState('disconnected')
  }, [socket])

  useEffect(() => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY)
    if (token && !connectingRef.current) {
      queueMicrotask(() => tryReconnect())
    }
  }, [tryReconnect])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && connectionState === 'disconnected') {
        const token = localStorage.getItem(SESSION_TOKEN_KEY)
        if (token) {
          tryReconnect()
        }
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [connectionState, tryReconnect])

  useEffect(() => {
    return () => {
      socket?.close()
    }
  }, [socket])

  return {
    socket,
    connectionState,
    player,
    lobbies,
    lobbyPlayers,
    lobbyId,
    matchState,
    logs,
    screen,
    visualEffects,
    pendingAction,
    authError,
    setScreen,
    setLogs,
    setPendingAction,
    register,
    tryReconnect,
    sendMessage,
    logout,
  }
}
