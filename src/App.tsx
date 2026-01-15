import { useEffect, useState, useMemo, useCallback } from 'react'
import { useGameSocket } from './hooks/useGameSocket'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'
import { WelcomeScreen } from './components/WelcomeScreen'
import { LobbyBrowser } from './components/LobbyBrowser'
import { GameScreen } from './components/game/GameScreen'
import { CharacterEditor } from './components/ui/CharacterEditor'
import { JoinLobbyModal } from './components/ui/JoinLobbyModal'
import type { GridPosition, CharacterSheet, CombatActionPayload } from '../shared/types'
import { hexDistance } from './utils/hex'
import './App.css'

function App() {
  const {
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
  } = useGameSocket()

  const [moveTarget, setMoveTarget] = useState<GridPosition | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [showCharacterModal, setShowCharacterModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<CharacterSheet | null>(null)

  useEffect(() => {
    const storedName = window.localStorage.getItem('gurps.nickname')?.trim()
    if (storedName && storedName.length > 0) {
      setScreen('lobby')
      initializeConnection(storedName)
    }
  }, [initializeConnection, setScreen])

  const activeCombatant = useMemo(() => {
    if (!matchState || !player) return null
    return matchState.combatants.find((combatant) => combatant.playerId === player.id) ?? null
  }, [matchState, player])

  const handleWelcomeComplete = (nickname: string) => {
    window.localStorage.setItem('gurps.nickname', nickname)
    setScreen('lobby')
    initializeConnection(nickname)
  }

  const handleQuickMatch = () => {
    if (!player) return
    const name = `${player.name}'s Battle`
    sendMessage({ type: 'create_lobby', name, maxPlayers: 4 })
  }

  const handleRefreshLobbies = () => {
    sendMessage({ type: 'list_lobbies' })
  }

  const handleGameAction = useCallback((action: string, payload?: CombatActionPayload) => {
    if (action === 'move_click') {
      if (!moveTarget) {
        setLogs((prev) => [...prev, 'Click on the grid to select destination.'])
      } else {
        const movePayload: CombatActionPayload = { type: 'move', position: moveTarget }
        sendMessage({ type: 'action', action: movePayload.type, payload: movePayload })
        setMoveTarget(null)
      }
      return
    }
    
    if (action === 'cancel_move') {
      setMoveTarget(null)
      return
    }

    if (payload) {
      sendMessage({ type: 'action', action: payload.type, payload })
      if (payload.type === 'attack') {
        setSelectedTargetId(null)
      }
    }
  }, [moveTarget, sendMessage, setLogs])

  const handleGridClick = useCallback((position: GridPosition) => {
    if (!matchState || matchState.activeTurnPlayerId !== player?.id) return
    if (matchState.status === 'finished') return
    const currentCombatant = matchState.combatants.find((c) => c.playerId === player.id)
    if (!currentCombatant) return
    const character = matchState.characters.find((c) => c.id === currentCombatant.characterId)
    const maxMove = character?.derived.basicMove ?? 5
    const distance = hexDistance(position.x, position.z, currentCombatant.position.x, currentCombatant.position.z)
    
    if (distance > maxMove) {
      setLogs((prev) => [...prev, `Too far! Max move: ${maxMove}, distance: ${distance} hexes.`])
      return
    }
    
    if (moveTarget && moveTarget.x === position.x && moveTarget.z === position.z) {
      const payload: CombatActionPayload = { type: 'move', position }
      sendMessage({ type: 'action', action: payload.type, payload })
      setMoveTarget(null)
      return
    }
    setMoveTarget(position)
  }, [matchState, player, moveTarget, sendMessage, setLogs])

  const handleCombatantClick = useCallback((targetPlayerId: string) => {
    if (!matchState || !player) return
    if (targetPlayerId === player.id) {
      setSelectedTargetId(null)
      return
    }
    setSelectedTargetId(targetPlayerId)
  }, [matchState, player])

  // Cycle through enemy targets with Tab
  const handleCycleTarget = useCallback(() => {
    if (!matchState || !player) return
    const enemies = matchState.combatants.filter(c => c.playerId !== player.id)
    if (enemies.length === 0) return

    const currentIndex = enemies.findIndex(c => c.playerId === selectedTargetId)
    const nextIndex = (currentIndex + 1) % enemies.length
    setSelectedTargetId(enemies[nextIndex].playerId)
  }, [matchState, player, selectedTargetId])

  // Determine if player has already selected a maneuver this turn
  const hasManeuver = useMemo(() => {
    if (!matchState || !player) return false
    const combatant = matchState.combatants.find(c => c.playerId === player.id)
    return !!combatant?.maneuver
  }, [matchState, player])

  // Keyboard navigation hook
  useKeyboardNavigation({
    matchState,
    selectedTargetId,
    moveTarget,
    isMyTurn: matchState?.activeTurnPlayerId === player?.id,
    hasManeuver,
    onAction: handleGameAction,
    onCycleTarget: handleCycleTarget,
    onCancelMove: () => setMoveTarget(null),
  })

  if (screen === 'welcome') {
    return <WelcomeScreen onComplete={handleWelcomeComplete} />
  }

  if (screen === 'lobby' && !player) {
    return <div style={{color: 'white', padding: '20px', textAlign: 'center'}}>Connecting to server...</div>
  }

  if (screen === 'lobby' && player) {
    return (
      <>
        <LobbyBrowser
          player={player}
          lobbies={lobbies}
          onQuickMatch={handleQuickMatch}
          onJoinLobby={(id) => sendMessage({ type: 'join_lobby', lobbyId: id })}
          onRefresh={handleRefreshLobbies}
        />
        {showJoinModal && (
          <JoinLobbyModal 
            lobbies={lobbies}
            onJoin={(id) => {
              sendMessage({ type: 'join_lobby', lobbyId: id })
              setShowJoinModal(false)
            }}
            onDelete={(id) => sendMessage({ type: 'delete_lobby', lobbyId: id })}
            onCancel={() => setShowJoinModal(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <GameScreen
        matchState={matchState}
        player={player}
        lobbyPlayers={lobbyPlayers}
        lobbyId={lobbyId}
        logs={logs}
        visualEffects={visualEffects}
        moveTarget={moveTarget}
        selectedTargetId={selectedTargetId}
        isPlayerTurn={matchState?.activeTurnPlayerId === player?.id}
        playerMoveRange={activeCombatant ? (matchState?.characters.find(c => c.id === activeCombatant.characterId)?.derived.basicMove ?? 5) : 5}
        onGridClick={handleGridClick}
        onCombatantClick={handleCombatantClick}
        onAction={handleGameAction}
        onLeaveLobby={() => sendMessage({ type: 'leave_lobby' })}
        onStartMatch={() => sendMessage({ type: 'start_match' })}
        onOpenCharacterEditor={() => {
          setShowCharacterModal(true)
        }}
        onCreateLobby={() => {
           const name = window.prompt('Lobby name')?.trim() || `${player?.name}'s Lobby`
           sendMessage({ type: 'create_lobby', name, maxPlayers: 4 })
        }}
        onJoinLobby={() => setShowJoinModal(true)}
        inLobbyButNoMatch={!matchState && !!lobbyId}
      />
      
      {showCharacterModal && (
        <CharacterEditor 
          character={editingCharacter || {
             id: crypto.randomUUID(),
             name: player?.name ?? 'New Character',
             attributes: { strength: 10, dexterity: 10, intelligence: 10, health: 10 },
             derived: { hitPoints: 10, fatiguePoints: 10, basicSpeed: 5, basicMove: 5, dodge: 8 },
             skills: [],
             advantages: [],
             disadvantages: [],
             equipment: [],
             pointsTotal: 100
          }}
          setCharacter={setEditingCharacter}
          onSave={() => {
            if (editingCharacter) {
              sendMessage({ type: 'select_character', character: editingCharacter })
              setShowCharacterModal(false)
              setEditingCharacter(null)
            }
          }}
          onCancel={() => {
            setShowCharacterModal(false)
            setEditingCharacter(null)
          }}
        />
      )}
    </>
  )
}

export default App
