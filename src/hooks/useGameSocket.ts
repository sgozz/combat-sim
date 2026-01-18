import { useState, useCallback, useEffect, useRef } from 'react'
import type { ServerToClientMessage, User, MatchSummary, MatchState, VisualEffect, PendingAction } from '../../shared/types'
import { uuid } from '../utils/uuid'

export type ScreenState = 'welcome' | 'matches' | 'waiting' | 'match'
export type ConnectionState = 'disconnected' | 'connecting' | 'connected'

const SESSION_TOKEN_KEY = 'tcs.sessionToken'

export const useGameSocket = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [user, setUser] = useState<User | null>(null)
  const [myMatches, setMyMatches] = useState<MatchSummary[]>([])
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null)
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
        setUser(message.user)
        localStorage.setItem(SESSION_TOKEN_KEY, message.sessionToken)
        setConnectionState('connected')
        setScreen('matches')
        break
      case 'session_invalid':
        localStorage.removeItem(SESSION_TOKEN_KEY)
        setConnectionState('disconnected')
        setScreen('welcome')
        break
      case 'my_matches':
        setMyMatches(message.matches)
        break
      case 'match_created':
        setMyMatches(prev => [message.match, ...prev])
        setActiveMatchId(message.match.id)
        setMatchState(null)
        setLogs(['Joined match.'])
        setScreen('waiting')
        break
      case 'match_joined':
        setActiveMatchId(message.matchId)
        setMatchState(null)
        setLogs(['Joined match.'])
        setScreen('waiting')
        break
      case 'match_left':
        if (message.matchId === activeMatchId) {
          setActiveMatchId(null)
          setMatchState(null)
          setLogs(prev => [...prev, 'Left match.'])
          setScreen('matches')
        }
        setMyMatches(prev => prev.filter(m => m.id !== message.matchId))
        break
      case 'match_state':
        setMatchState(message.state)
        setLogs(message.state.log)
        if (message.state.status === 'active' || message.state.status === 'paused') {
          setScreen('match')
        }
        break
      case 'match_updated':
        setMyMatches(prev => prev.map(m => m.id === message.match.id ? message.match : m))
        break
      case 'player_joined':
        setMyMatches(prev => prev.map(m => {
          if (m.id === message.matchId) {
            const newPlayer = { id: message.player.id, name: message.player.name, isConnected: true }
            return { ...m, players: [...m.players, newPlayer], playerCount: m.playerCount + 1 }
          }
          return m
        }))
        if (message.matchId === activeMatchId) {
          setLogs(prev => [...prev, `${message.player.name} joined.`])
        }
        break
      case 'player_left':
        setMyMatches(prev => prev.map(m => {
          if (m.id === message.matchId) {
            return { ...m, players: m.players.filter(p => p.id !== message.playerId), playerCount: m.playerCount - 1 }
          }
          return m
        }))
        if (message.matchId === activeMatchId) {
          setLogs(prev => [...prev, `${message.playerName} left.`])
        }
        break
      case 'player_disconnected':
        setMyMatches(prev => prev.map(m => {
          if (m.id === message.matchId) {
            return { ...m, players: m.players.map(p => p.id === message.playerId ? { ...p, isConnected: false } : p) }
          }
          return m
        }))
        if (message.matchId === activeMatchId) {
          setLogs(prev => [...prev, `${message.playerName} disconnected.`])
        }
        break
      case 'player_reconnected':
        setMyMatches(prev => prev.map(m => {
          if (m.id === message.matchId) {
            return { ...m, players: m.players.map(p => p.id === message.playerId ? { ...p, isConnected: true } : p) }
          }
          return m
        }))
        if (message.matchId === activeMatchId) {
          setLogs(prev => [...prev, `${message.playerName} reconnected.`])
        }
        break
      case 'visual_effect': {
        if (message.matchId !== activeMatchId) break
        const id = uuid()
        const effect = { ...message.effect, id }
        setVisualEffects(prev => [...prev, effect])
        setTimeout(() => {
          setVisualEffects(prev => prev.filter(e => e.id !== id))
        }, 2000)
        break
      }
      case 'pending_action':
        if (message.matchId === activeMatchId) {
          setPendingAction(message.action)
        }
        break
      case 'error':
        setLogs(prev => [...prev, `Error: ${message.message}`])
        if (connectingRef.current) {
          setAuthError(message.message)
          setConnectionState('disconnected')
          connectingRef.current = false
        }
        break
    }
  }, [activeMatchId])

  const createWebSocket = useCallback((onOpen: (ws: WebSocket) => void) => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8080'
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      setLogs(prev => [...prev, 'Connected to server.'])
      onOpen(ws)
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data as string) as ServerToClientMessage
      handleMessage(message)
    }

    ws.onerror = () => {
      setLogs(prev => [...prev, 'Connection error.'])
    }

    ws.onclose = () => {
      setLogs(prev => [...prev, 'Disconnected from server.'])
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
      setLogs(prev => [...prev, 'Error: Not connected.'])
      return
    }
    socket.send(JSON.stringify(payload))
  }, [socket])

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_TOKEN_KEY)
    socket?.close()
    setUser(null)
    setActiveMatchId(null)
    setMatchState(null)
    setMyMatches([])
    setScreen('welcome')
    setConnectionState('disconnected')
  }, [socket])

  const refreshMyMatches = useCallback(() => {
    sendMessage({ type: 'list_my_matches' })
  }, [sendMessage])

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
    user,
    myMatches,
    activeMatchId,
    matchState,
    logs,
    screen,
    visualEffects,
    pendingAction,
    authError,
    setScreen,
    setLogs,
    setActiveMatchId,
    setPendingAction,
    register,
    tryReconnect,
    sendMessage,
    logout,
    refreshMyMatches,
  }
}
