import { useState, useCallback, useEffect } from 'react'
import type { ServerToClientMessage, MatchSummary, MatchState } from '../../shared/types'
import type { ScreenState } from './useGameSocket'

type UseMatchesParams = {
  sendMessage: (payload: unknown) => void
  messageHandlers: React.MutableRefObject<Array<(msg: ServerToClientMessage) => boolean>>
  activeMatchId: string | null
  setActiveMatchId: React.Dispatch<React.SetStateAction<string | null>>
  setMatchState: React.Dispatch<React.SetStateAction<MatchState | null>>
  setLogs: React.Dispatch<React.SetStateAction<string[]>>
  setScreen: React.Dispatch<React.SetStateAction<ScreenState>>
}

export const useMatches = ({
  sendMessage,
  messageHandlers,
  activeMatchId,
  setActiveMatchId,
  setMatchState,
  setLogs,
  setScreen,
}: UseMatchesParams) => {
  const [myMatches, setMyMatches] = useState<MatchSummary[]>([])
  const [publicMatches, setPublicMatches] = useState<MatchSummary[]>([])
  const [spectatingMatchId, setSpectatingMatchId] = useState<string | null>(null)

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
    setScreen('matches')
  }, [sendMessage, setActiveMatchId, setMatchState, setScreen])

  useEffect(() => {
    const handleMessage = (message: ServerToClientMessage): boolean => {
      switch (message.type) {
        case 'my_matches':
          setMyMatches(message.matches)
          return true
        
        case 'match_created':
          setMyMatches(prev => [message.match, ...prev])
          setActiveMatchId(message.match.id)
          setMatchState(null)
          setLogs(['Joined match.'])
          setScreen('waiting')
          return true
        
        case 'match_joined':
          setActiveMatchId(message.matchId)
          setMatchState(null)
          setLogs(['Joined match.'])
          setScreen('waiting')
          return true
        
        case 'match_left':
          if (message.matchId === activeMatchId) {
            setActiveMatchId(null)
            setMatchState(null)
            setLogs(prev => [...prev, 'Left match.'])
            setScreen('matches')
          }
          setMyMatches(prev => prev.filter(m => m.id !== message.matchId))
          return true
        
        case 'match_updated':
          setMyMatches(prev => prev.map(m => m.id === message.match.id ? message.match : m))
          return true
        
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
        
        case 'public_matches':
          setPublicMatches(message.matches)
          return true
        
        case 'spectating':
          setSpectatingMatchId(message.matchId)
          setActiveMatchId(message.matchId)
          setScreen('match')
          return true
        
        case 'stopped_spectating':
          setSpectatingMatchId(null)
          setActiveMatchId(null)
          setMatchState(null)
          setScreen('matches')
          return true
        
        default:
          return false
      }
    }
    
    messageHandlers.current.push(handleMessage)
    
    return () => {
      const index = messageHandlers.current.indexOf(handleMessage)
      if (index > -1) messageHandlers.current.splice(index, 1)
    }
  }, [messageHandlers, activeMatchId, setActiveMatchId, setMatchState, setLogs, setScreen])

  return {
    myMatches,
    publicMatches,
    spectatingMatchId,
    refreshMyMatches,
    fetchPublicMatches,
    spectateMatch,
    stopSpectating,
  }
}
