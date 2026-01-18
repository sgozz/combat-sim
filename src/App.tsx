import { useEffect, useState, useCallback, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useGameSocket } from './hooks/useGameSocket'
import { WelcomeScreen } from './components/WelcomeScreen'
import { LobbyBrowser } from './components/LobbyBrowser'
import { GameScreen } from './components/game/GameScreen'
import { CharacterEditor } from './components/ui/CharacterEditor'

import { applyAccessibilitySettings } from './components/ui/SettingsPanel'
import type { GridPosition, CharacterSheet, CombatActionPayload } from '../shared/types'
import './App.css'

function AppRoutes() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const {
    connectionState,
    player,
    lobbies,
    lobbyPlayers,
    lobbyId,
    matchState,
    logs,
    visualEffects,
    pendingAction,
    authError,
    setScreen,
    setLogs,
    setPendingAction,
    register,
    sendMessage,
    logout
  } = useGameSocket()

  const [moveTarget, setMoveTarget] = useState<GridPosition | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [showCharacterModal, setShowCharacterModal] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<CharacterSheet | null>(null)
  
  const pendingJoinLobbyIdRef = useRef<string | null>((() => {
    const params = new URLSearchParams(window.location.search)
    const joinId = params.get('join')
    if (joinId) {
      window.history.replaceState({}, '', window.location.pathname)
      return joinId
    }
    return null
  })())

  useEffect(() => {
    applyAccessibilitySettings()
  }, [])

  useEffect(() => {
    if (connectionState === 'connected' && player) {
      if (pendingJoinLobbyIdRef.current && !lobbyId) {
        sendMessage({ type: 'join_lobby', lobbyId: pendingJoinLobbyIdRef.current })
        pendingJoinLobbyIdRef.current = null
      } else if (location.pathname === '/') {
        navigate('/lobby', { replace: true })
      }
    } else if (connectionState === 'disconnected' && location.pathname !== '/') {
      navigate('/', { replace: true })
    }
  }, [connectionState, player, navigate, location.pathname, lobbyId, sendMessage])

  useEffect(() => {
    if (lobbyId && location.pathname === '/lobby') {
      navigate('/game', { replace: true })
    } else if (!lobbyId && location.pathname === '/game') {
      navigate('/lobby', { replace: true })
    }
  }, [lobbyId, navigate, location.pathname])

  const handleWelcomeComplete = (username: string) => {
    setScreen('lobby')
    register(username)
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
      const reachable = matchState.reachableHexes?.some(
        (hex) => hex.q === position.x && hex.r === position.z
      )
      if (!reachable) {
        setLogs((prev) => [...prev, 'Too far! Select a highlighted hex.'])
        return
      }
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
    logout()
    navigate('/')
  }, [logout, navigate])

  if (connectionState === 'connecting') {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: 'white',
        fontSize: '1.2em'
      }}>
        Connecting to server...
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={
        connectionState === 'connected' ? (
          <Navigate to="/lobby" replace />
        ) : (
          <WelcomeScreen onComplete={handleWelcomeComplete} authError={authError} />
        )
      } />
      
      <Route path="/lobby" element={
        !player ? (
          <Navigate to="/" replace />
        ) : (
          <LobbyBrowser
            player={player}
            lobbies={lobbies}
            onQuickMatch={handleQuickMatch}
            onJoinLobby={(id) => sendMessage({ type: 'join_lobby', lobbyId: id })}
            onRefresh={handleRefreshLobbies}
            onLogout={handleLogout}
          />
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
              onStartMatch={(botCount) => sendMessage({ type: 'start_match', botCount })}
              onOpenCharacterEditor={() => {
                setShowCharacterModal(true)
              }}
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
