import { useState, useEffect, useRef } from 'react'

type ToastType = 'attack' | 'defend' | 'damage' | 'death' | 'info' | 'my-turn' | 'opponent-turn'

type Toast = {
  id: string
  message: string
  type: ToastType
}

type CombatToastProps = {
  logs: string[]
  activeTurnPlayerId?: string
  currentPlayerId?: string
  players?: { id: string; name: string; isBot?: boolean }[]
}

const getToastType = (message: string): ToastType => {
  if (message.includes('killed') || message.includes('dies') || message.includes('unconscious')) return 'death'
  if (message.includes('Parry') || message.includes('Block') || message.includes('Dodge')) return 'defend'
  if (message.includes('Hit for') || message.includes('damage')) return 'damage'
  if (message.includes('Miss')) return 'info'
  if (message.includes('attacks') || message.includes('shoots')) return 'attack'
  return 'info'
}

const getToastIcon = (type: ToastType): string => {
  switch (type) {
    case 'attack': return '⚔️'
    case 'defend': return '🛡️'
    case 'damage': return '💥'
    case 'death': return '💀'
    case 'my-turn': return '🎯'
    case 'opponent-turn': return '⏳'
    default: return '📢'
  }
}

export const CombatToast = ({ logs, activeTurnPlayerId, currentPlayerId, players }: CombatToastProps) => {
  const [toasts, setToasts] = useState<Toast[]>([])
  const initialLogCount = useRef(logs.length)
  const lastLogCount = useRef(logs.length)
  const lastTurnPlayerIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (logs.length > lastLogCount.current && logs.length > initialLogCount.current) {
      const newLogs = logs.slice(lastLogCount.current)
      const importantLogs = newLogs.filter(log => 
        log.includes('attacks') || 
        log.includes('hits') || 
        log.includes('Hit for') ||
        log.includes('damage') ||
        log.includes('parries') ||
        log.includes('blocks') ||
        log.includes('dodges') ||
        log.includes('Dodge') ||
        log.includes('Parry') ||
        log.includes('Block') ||
        log.includes('killed') ||
        log.includes('dies') ||
        log.includes('unconscious') ||
        log.includes('Miss') ||
        log.includes('Critical')
      )
      
      const newToasts = importantLogs.map((message, i) => ({
        id: `${Date.now()}-${i}`,
        message,
        type: getToastType(message)
      }))
      
      if (newToasts.length > 0) {
        setToasts(prev => [...newToasts.reverse(), ...prev])
      }
    }
    lastLogCount.current = logs.length
  }, [logs])

  useEffect(() => {
    if (!activeTurnPlayerId || activeTurnPlayerId === lastTurnPlayerIdRef.current) return
    
    lastTurnPlayerIdRef.current = activeTurnPlayerId
    
    const isMyTurn = activeTurnPlayerId === currentPlayerId
    const activePlayer = players?.find(p => p.id === activeTurnPlayerId)
    
    if (!activePlayer) return
    if (activePlayer.isBot) return

    const turnToast: Toast = {
      id: `turn-${Date.now()}`,
      message: isMyTurn ? "YOUR TURN" : `${activePlayer.name}'s Turn`,
      type: isMyTurn ? 'my-turn' : 'opponent-turn'
    }
    
    queueMicrotask(() => setToasts(prev => [turnToast, ...prev]))
  }, [activeTurnPlayerId, currentPlayerId, players])

  useEffect(() => {
    if (toasts.length === 0) return
    
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(0, -1))
    }, 3000)
    
    return () => clearTimeout(timer)
  }, [toasts])

  if (toasts.length === 0) return null

  return (
    <div className="combat-toast-container">
      {toasts.slice(0, 3).map((toast, index) => (
        <div 
          key={toast.id} 
          className={`combat-toast combat-toast-${toast.type}`}
          style={{ opacity: 1 - (index * 0.2) }}
        >
          <span className="toast-icon">{getToastIcon(toast.type)}</span>
          <span className="toast-message">{toast.message}</span>
        </div>
      ))}
    </div>
  )
}
