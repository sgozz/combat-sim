import { useEffect, useState, useRef } from 'react'
import type { Player } from '../../../shared/types'

type TurnBannerProps = {
  activeTurnPlayerId: string | undefined
  players: Player[]
  currentPlayerId: string | undefined
}

export const TurnBanner = ({ activeTurnPlayerId, players, currentPlayerId }: TurnBannerProps) => {
  const [visible, setVisible] = useState(false)
  const [content, setContent] = useState({ text: '', type: '' })
  const lastTurnPlayerIdRef = useRef<string | undefined>(undefined)
  
  useEffect(() => {
    if (!activeTurnPlayerId) {
      setVisible(false)
      return
    }
    
    if (activeTurnPlayerId === lastTurnPlayerIdRef.current) {
      return
    }
    
    lastTurnPlayerIdRef.current = activeTurnPlayerId
    
    const isMyTurn = activeTurnPlayerId === currentPlayerId
    const activePlayer = players.find(p => p.id === activeTurnPlayerId)
    
    if (!activePlayer) return

    setContent({
        text: isMyTurn ? "YOUR TURN" : `${activePlayer.name}'s Turn`,
        type: isMyTurn ? 'my-turn' : 'opponent-turn'
    })
    
    setVisible(true)
    
    const timer = setTimeout(() => setVisible(false), 2500)
    return () => clearTimeout(timer)
  }, [activeTurnPlayerId, currentPlayerId, players])

  if (!visible) return null

  return (
    <div 
      key={activeTurnPlayerId}
      className={`turn-banner ${content.type}`}
    >
       {content.text}
    </div>
  )
}
