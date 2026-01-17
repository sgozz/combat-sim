import { useEffect, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useGameSocket } from './hooks/useGameSocket'
import { WelcomeScreen } from './components/WelcomeScreen'
import { LobbyBrowser } from './components/LobbyBrowser'
import { GameScreen } from './components/game/GameScreen'
import { CharacterEditor } from './components/ui/CharacterEditor'
import { JoinLobbyModal } from './components/ui/JoinLobbyModal'

import { applyAccessibilitySettings } from './components/ui/SettingsPanel'
import type { GridPosition, CharacterSheet, CombatActionPayload } from '../shared/types'
import './App.css'

function AppRoutes() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const {
    player,
    lobbies,
    lobbyPlayers,
    lobbyId,
    matchState,
    logs,
    visualEffects,
    pendingAction,
    setScreen,
    setLogs,
    setPendingAction,
    initializeConnection,
    sendMessage
  } = useGameSocket()

  const [moveTarget, setMoveTarget] = useState<GridPosition | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [showCharacterModal, setShowCharacterModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<CharacterSheet | null>(null)

  useEffect(() => {
    applyAccessibilitySettings()
  }, [])

  useEffect(() => {
    const storedName = window.localStorage.getItem('gurps.nickname')?.trim()
    if (storedName && storedName.length > 0) {
      if (!player) {
        initializeConnection(storedName)
      }
      if (location.pathname === '/') {
        navigate('/lobby', { replace: true })
      }
    } else if (location.pathname !== '/') {
      navigate('/', { replace: true })
    }
  }, [initializeConnection, navigate, location.pathname, player])

  useEffect(() => {
    if (lobbyId && location.pathname === '/lobby') {
      navigate('/game', { replace: true })
    }
  }, [lobbyId, navigate, location.pathname])

  const handleWelcomeComplete = (nickname: string) => {
    window.localStorage.setItem('gurps.nickname', nickname)
    setScreen('lobby')
    initializeConnection(nickname)
    navigate('/lobby')
  }

  const handleQuickMatch = () => {
    if (!player) return
    const name = `${player.name}'s Battle`
    sendMessage({ type: 'create_lobby', name, maxPlayers: 4 })
  }

  const handleRefreshLobbies = () => {
    sendMessage({ type: 'list_lobbies' })
  }

  const handleGameAction = useCallback((_action: string, payload?: CombatActionPayload) => {
    if (payload) {
      sendMessage({ type: 'action', action: payload.type, payload })
    }
  }, [sendMessage])

  const handleGridClick = useCallback((position: GridPosition) => {
    if (!matchState || matchState.activeTurnPlayerId !== player?.id) return
    if (matchState.status === 'finished') return
    const currentCombatant = matchState.combatants.find((c) => c.playerId === player.id)
    if (!currentCombatant) return
    
    if (currentCombatant.inCloseCombatWith) {
      setLogs((prev) => [...prev, 'Cannot move while in close combat. Use Exit Close Combat first.'])
      return
    }
    
    if (matchState.turnMovement?.phase === 'moving') {
      const payload: CombatActionPayload = { type: 'move_step', to: { q: position.x, r: position.z } }
      sendMessage({ type: 'action', action: payload.type, payload })
      setMoveTarget(null)
      return
    }
    
    setMoveTarget(position)
  }, [matchState, player, sendMessage, setLogs])

  const handleCombatantClick = useCallback((targetPlayerId: string) => {
    if (!matchState || !player) return
    if (targetPlayerId === player.id) {
      setSelectedTargetId(null)
      return
    }
    setSelectedTargetId(targetPlayerId)
  }, [matchState, player])

  const handleLeaveLobby = useCallback(() => {
    sendMessage({ type: 'leave_lobby' })
    setTimeout(() => navigate('/lobby'), 0)
  }, [sendMessage, navigate])

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem('gurps.nickname')
    window.location.href = '/'
  }, [])

  return (
    <Routes>
      <Route path="/" element={<WelcomeScreen onComplete={handleWelcomeComplete} />} />
      
      <Route path="/lobby" element={
        !player ? (
          <div style={{color: 'white', padding: '20px', textAlign: 'center'}}>Connecting to server...</div>
        ) : (
          <>
            <LobbyBrowser
              player={player}
              lobbies={lobbies}
              onQuickMatch={handleQuickMatch}
              onJoinLobby={(id) => sendMessage({ type: 'join_lobby', lobbyId: id })}
              onRefresh={handleRefreshLobbies}
              onLogout={handleLogout}
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
      } />
      
      <Route path="/game" element={
        !player ? (
          <Navigate to="/" replace />
        ) : (
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
              pendingAction={pendingAction}
              onGridClick={handleGridClick}
              onCombatantClick={handleCombatantClick}
              onAction={handleGameAction}
              onPendingActionResponse={(response) => {
                sendMessage({ type: 'action', action: 'respond_exit', payload: { type: 'respond_exit', response } })
                setPendingAction(null)
              }}
              onLeaveLobby={handleLeaveLobby}
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
      } />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
