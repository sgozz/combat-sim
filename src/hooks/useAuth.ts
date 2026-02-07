import { useState, useCallback, useEffect, useRef } from 'react'
import type { ServerToClientMessage, User, RulesetId } from '../../shared/types'
import type { ConnectionState } from './useGameSocket'

const SESSION_TOKEN_KEY = 'tcs.sessionToken'
const ACTIVE_MATCH_KEY = 'tcs.activeMatchId'
const SAVED_USERNAME_KEY = 'tcs.savedUsername'
const SAVED_RULESET_KEY = 'tcs.savedRuleset'

type UseAuthParams = {
  socket: WebSocket | null
  setSocket: (ws: WebSocket | null) => void
  messageHandlers: React.MutableRefObject<Array<(msg: ServerToClientMessage) => boolean>>
  setLogs: React.Dispatch<React.SetStateAction<string[]>>
  setActiveMatchId: React.Dispatch<React.SetStateAction<string | null>>
}

export const useAuth = ({
  socket,
  setSocket,
  messageHandlers,
  setLogs,
  setActiveMatchId,
}: UseAuthParams) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [user, setUser] = useState<User | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  
  const connectingRef = useRef(false)
  const reconnectAttemptRef = useRef(false)
  const pendingRejoinRef = useRef<string | null>(null)
  const reconnectDelayRef = useRef(1000)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const createWebSocket = useCallback((onOpen: (ws: WebSocket) => void) => {
    const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:8080`
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      setLogs(prev => [...prev, 'Connected to server.'])
      onOpen(ws)
    }

    ws.onerror = () => {
      setLogs(prev => [...prev, 'Connection error.'])
    }

    ws.onclose = () => {
      setSocket(null)
      setConnectionState('disconnected')
      connectingRef.current = false
      reconnectAttemptRef.current = false
    }

    setSocket(ws)
    return ws
  }, [setLogs, setSocket])

  const tryReconnect = useCallback(() => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY)
    if (!token || connectingRef.current || reconnectAttemptRef.current) return false
    
    reconnectAttemptRef.current = true
    connectingRef.current = true
    setConnectionState('connecting')
    
    createWebSocket((ws: WebSocket) => {
      ws.send(JSON.stringify({ type: 'auth', sessionToken: token }))
      reconnectAttemptRef.current = false
    })
    
    return true
  }, [createWebSocket])

  const register = useCallback((username: string, preferredRulesetId?: RulesetId) => {
    if (connectingRef.current) return
    connectingRef.current = true
    setAuthError(null)
    setConnectionState('connecting')
    localStorage.removeItem(SESSION_TOKEN_KEY)
    
    createWebSocket((ws: WebSocket) => {
      ws.send(JSON.stringify({ type: 'register', username, preferredRulesetId }))
    })
  }, [createWebSocket])

   const logout = useCallback(() => {
     localStorage.removeItem(SESSION_TOKEN_KEY)
     socket?.close()
     setUser(null)
     setConnectionState('disconnected')
   }, [socket])

   const setPreferredRuleset = useCallback((rulesetId: RulesetId) => {
     if (!socket || socket.readyState !== WebSocket.OPEN) return
     socket.send(JSON.stringify({ type: 'set_preferred_ruleset', rulesetId }))
   }, [socket])

  // Register message handler
  useEffect(() => {
    const handlers = messageHandlers.current
    
    const handleMessage = (message: ServerToClientMessage): boolean => {
      switch (message.type) {
        case 'auth_ok': {
          setUser(message.user)
          localStorage.setItem(SESSION_TOKEN_KEY, message.sessionToken)
          localStorage.setItem(SAVED_USERNAME_KEY, message.user.username)
          if (message.user.preferredRulesetId) {
            localStorage.setItem(SAVED_RULESET_KEY, message.user.preferredRulesetId)
          }
          setConnectionState('connected')
          connectingRef.current = false
          reconnectDelayRef.current = 1000
          
          const savedMatchId = localStorage.getItem(ACTIVE_MATCH_KEY)
          
          if (savedMatchId) {
            setActiveMatchId(savedMatchId)
            pendingRejoinRef.current = savedMatchId
          }
          return true
        }
        
        case 'session_invalid':
          localStorage.removeItem(SESSION_TOKEN_KEY)
          setConnectionState('disconnected')
          connectingRef.current = false
          return true
        
         case 'error':
           if (connectingRef.current) {
             setAuthError(message.message)
             setConnectionState('disconnected')
             connectingRef.current = false
             return true
           }
           return false
          
         default:
           return false
      }
    }
    
    handlers.push(handleMessage)
    
    return () => {
      const index = handlers.indexOf(handleMessage)
      if (index > -1) handlers.splice(index, 1)
    }
  }, [messageHandlers, setActiveMatchId])

  // Initial reconnect attempt
  useEffect(() => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY)
    if (token && !connectingRef.current) {
      tryReconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // Reconnection with exponential backoff
  useEffect(() => {
    if (connectionState !== 'disconnected') {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      return
    }
    
    const token = localStorage.getItem(SESSION_TOKEN_KEY)
    if (!token) return
    
    setLogs(prev => [...prev, `Disconnected. Reconnecting in ${reconnectDelayRef.current / 1000}s...`])
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null
      if (tryReconnect()) {
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000)
      }
    }, reconnectDelayRef.current)
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [connectionState, tryReconnect, setLogs])

  // Visibility change handler
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

  // Socket cleanup
  useEffect(() => {
    return () => {
      socket?.close()
    }
  }, [socket])

  // Pending rejoin
  useEffect(() => {
    if (socket && socket.readyState === WebSocket.OPEN && pendingRejoinRef.current) {
      const matchId = pendingRejoinRef.current
      pendingRejoinRef.current = null
      socket.send(JSON.stringify({ type: 'rejoin_match', matchId }))
    }
  }, [socket, connectionState])

   return {
     connectionState,
     user,
     authError,
     register,
     tryReconnect,
     logout,
     setPreferredRuleset,
     preferredRulesetId: user?.preferredRulesetId ?? null,
   }
}

export const getSavedUsername = (): string | null => {
  return localStorage.getItem(SAVED_USERNAME_KEY)
}

export const getSavedRuleset = (): RulesetId | null => {
  const saved = localStorage.getItem(SAVED_RULESET_KEY)
  return saved as RulesetId | null
}
