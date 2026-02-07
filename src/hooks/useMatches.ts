import { useState, useCallback, useEffect, useRef } from 'react'
import type { ServerToClientMessage, MatchSummary, MatchState } from '../../shared/types'

type UseMatchesParams = {
  sendMessage: (payload: unknown) => void
  messageHandlers: React.MutableRefObject<Array<(msg: ServerToClientMessage) => boolean>>
  activeMatchId: string | null
  setActiveMatchId: React.Dispatch<React.SetStateAction<string | null>>
  setMatchState: React.Dispatch<React.SetStateAction<MatchState | null>>
  setLogs: React.Dispatch<React.SetStateAction<string[]>>
}

export const useMatches = ({
  sendMessage,
  messageHandlers,
  activeMatchId,
  setActiveMatchId,
  setMatchState,
  setLogs,
}: UseMatchesParams) => {
  const [myMatches, setMyMatches] = useState<MatchSummary[]>([])
  const [publicMatches, setPublicMatches] = useState<MatchSummary[]>([])
  const [spectatingMatchId, setSpectatingMatchId] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isSyncing) {
      syncTimeoutRef.current = setTimeout(() => {
        setIsSyncing(false)
      }, 5000)
    }
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
      }
    }
  }, [isSyncing])

  const refreshMyMatches = useCallback(() => {
    sendMessage({ type: 'list_my_matches' })
  }, [sendMessage])

  const fetchPublicMatches = useCallback(() => {
    sendMessage({ type: 'list_public_matches' })
  }, [sendMessage])

  const spectateMatch = useCallback((matchId: string) => {
    sendMessage({ type: 'spectate_match', matchId })
  }, [sendMessage])

  const stopSpectating = useCallback((matchId: string) => {
    sendMessage({ type: 'stop_spectating', matchId })
    setSpectatingMatchId(null)
    setActiveMatchId(null)
    setMatchState(null)
  }, [sendMessage, setActiveMatchId, setMatchState])

  useEffect(() => {
    const handleMessage = (message: ServerToClientMessage): boolean => {
      switch (message.type) {
        case 'my_matches':
          setMyMatches(message.matches)
          return true
        
        case 'match_created':
          setMyMatches(prev => {
            const exists = prev.some(m => m.id === message.match.id);
            if (exists) {
              return prev.map(m => m.id === message.match.id ? message.match : m);
            }
            return [message.match, ...prev];
          });
          setActiveMatchId(message.match.id)
          setMatchState(null)
          setIsSyncing(false)
          setLogs(['Joined match.'])
          return true
        
        case 'match_joined':
          setActiveMatchId(message.matchId)
          setMatchState(null)
          setLogs(['Joined match.'])
          setIsSyncing(true)
          return true
        
        case 'match_left':
          if (message.matchId === activeMatchId) {
            setActiveMatchId(null)
            setMatchState(null)
            setLogs(prev => [...prev, 'Left match.'])
          }
          setMyMatches(prev => prev.filter(m => m.id !== message.matchId))
          return true
        
        case 'match_state':
          setMyMatches(prev => prev.map(m => {
            if (m.id !== message.state.id) return m
            const winnerPlayer = message.state.winnerId
              ? message.state.players.find(p => p.id === message.state.winnerId)
              : undefined
            return {
              ...m,
              status: message.state.status,
              winnerId: message.state.winnerId,
              winnerName: winnerPlayer?.name,
              isMyTurn: false,
            }
          }))
          return true
        
    case 'match_updated':
      setMyMatches(prev => prev.map(m => m.id === message.match.id ? message.match : m))
      if (message.match.id === activeMatchId) {
        setIsSyncing(false)
      }
      return true
        
        case 'player_joined':
          setMyMatches(prev => prev.map(m => {
            if (m.id === message.matchId) {
              const newPlayer = { id: message.player.id, name: message.player.name, isConnected: true }
              const updatedMatch = { ...m, players: [...m.players, newPlayer], playerCount: m.playerCount + 1 }
              const allPlayersJoined = message.matchId === activeMatchId && updatedMatch.playerCount >= updatedMatch.maxPlayers
              if (allPlayersJoined) {
                setIsSyncing(false)
              }
              return updatedMatch
            }
            return m
          }))
          if (message.matchId === activeMatchId) {
            setLogs(prev => [...prev, `${message.player.name} joined.`])
          }
          return true
        
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
          return true
        
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
          return true
        
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
          return true
        
        case 'player_ready_update':
          setMyMatches(prev => prev.map(m => {
            if (m.id === message.matchId) {
              const currentReady = m.readyPlayers ?? []
              const readyPlayers = message.ready
                ? [...currentReady.filter(id => id !== message.playerId), message.playerId]
                : currentReady.filter(id => id !== message.playerId)
              return { ...m, readyPlayers }
            }
            return m
          }))
          return true
        
        case 'all_players_ready':
          return true
        
        case 'public_matches':
          setPublicMatches(message.matches)
          return true
        
        case 'spectating':
          setSpectatingMatchId(message.matchId)
          setActiveMatchId(message.matchId)
          return true
        
        case 'stopped_spectating':
          setSpectatingMatchId(null)
          setActiveMatchId(null)
          setMatchState(null)
          return true
        
        default:
          return false
      }
    }
    
    const handlers = messageHandlers.current
    handlers.push(handleMessage)
    
    return () => {
      const index = handlers.indexOf(handleMessage)
      if (index > -1) handlers.splice(index, 1)
    }
  }, [messageHandlers, activeMatchId, setActiveMatchId, setMatchState, setLogs])

  return {
    myMatches,
    publicMatches,
    spectatingMatchId,
    isSyncing,
    refreshMyMatches,
    fetchPublicMatches,
    spectateMatch,
    stopSpectating,
  }
}
