import { useState, useEffect } from 'react'
import type { ServerToClientMessage, MatchState, VisualEffect, PendingAction } from '../../shared/types'
import type { ScreenState } from './useGameSocket'
import { uuid } from '../utils/uuid'

const SCREEN_STATE_KEY = 'tcs.screenState'
const ACTIVE_MATCH_KEY = 'tcs.activeMatchId'

type UseMatchStateParams = {
  messageHandlers: React.MutableRefObject<Array<(msg: ServerToClientMessage) => boolean>>
}

export const useMatchState = ({
  messageHandlers,
}: UseMatchStateParams) => {
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null)
  const [matchState, setMatchState] = useState<MatchState | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [screen, setScreen] = useState<ScreenState>('welcome')
  const [visualEffects, setVisualEffects] = useState<(VisualEffect & { id: string })[]>([])
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  useEffect(() => {
    const handleMessage = (message: ServerToClientMessage): boolean => {
      switch (message.type) {
        case 'match_state':
          setMatchState(message.state)
          setLogs(message.state.log)
          if (message.state.status === 'active' || message.state.status === 'paused') {
            setScreen('match')
          }
          return true
        
        case 'visual_effect': {
          if (message.matchId !== activeMatchId) return false
          const id = uuid()
          const effect = { ...message.effect, id }
          setVisualEffects(prev => [...prev, effect])
          setTimeout(() => {
            setVisualEffects(prev => prev.filter(e => e.id !== id))
          }, 2000)
          return true
        }
        
        case 'pending_action':
          if (message.matchId === activeMatchId) {
            setPendingAction(message.action)
          }
          return true
        
        case 'error':
          setLogs(prev => [...prev, `Error: ${message.message}`])
          if (message.message.includes('Match not found') || message.message.includes('not a member')) {
            localStorage.removeItem(ACTIVE_MATCH_KEY)
            setActiveMatchId(null)
            setMatchState(null)
            setScreen('matches')
            return true
          }
          return false
        
        default:
          return false
      }
    }
    
    messageHandlers.current.push(handleMessage)
    
    return () => {
      const index = messageHandlers.current.indexOf(handleMessage)
      if (index > -1) messageHandlers.current.splice(index, 1)
    }
  }, [messageHandlers, activeMatchId])

  useEffect(() => {
    if (screen !== 'welcome') {
      localStorage.setItem(SCREEN_STATE_KEY, screen)
    }
  }, [screen])

  useEffect(() => {
    if (activeMatchId) {
      localStorage.setItem(ACTIVE_MATCH_KEY, activeMatchId)
    } else {
      localStorage.removeItem(ACTIVE_MATCH_KEY)
    }
  }, [activeMatchId])

  return {
    activeMatchId,
    setActiveMatchId,
    matchState,
    setMatchState,
    logs,
    setLogs,
    screen,
    setScreen,
    visualEffects,
    pendingAction,
    setPendingAction,
  }
}
