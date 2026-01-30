import { useEffect, useState, useCallback, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useGameSocket } from './hooks/useGameSocket'
import { WelcomeScreen } from './components/WelcomeScreen'
import { Dashboard } from './components/Dashboard'
import { CharacterArmory } from './components/armory/CharacterArmory'
import { LobbyScreen } from './components/lobby/LobbyScreen'
import { MatchBrowser } from './components/MatchBrowser'
import { GameScreen } from './components/game/GameScreen'
import { isGurpsCombatant } from '../shared/rulesets'

import type { GridPosition, RulesetId } from '../shared/types'
import './App.css'

function AppRoutes() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const {
    connectionState,
    user,
    myMatches,
    publicMatches,
    activeMatchId,
    matchState,
    logs,
    visualEffects,
    pendingAction,
    authError,
    spectatingMatchId,
    setLogs,
    setActiveMatchId,
    setPendingAction,
    register,
    sendMessage,
    logout,
    refreshMyMatches,
    fetchPublicMatches,
    spectateMatch,
    stopSpectating
  } = useGameSocket()

  const [moveTarget, setMoveTarget] = useState<GridPosition | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  
  const pendingJoinCodeRef = useRef<string | null>((() => {
    const params = new URLSearchParams(window.location.search)
    const joinCode = params.get('join')
    if (joinCode) {
      window.history.replaceState({}, '', window.location.pathname)
      return joinCode.toUpperCase()
    }
    return null
  })())

  useEffect(() => {
    if (connectionState === 'connected' && user) {
      refreshMyMatches()
      
      // Handle pending join code
      if (pendingJoinCodeRef.current && !activeMatchId) {
        sendMessage({ type: 'join_match', code: pendingJoinCodeRef.current })
        pendingJoinCodeRef.current = null
      }
      // Reconnection logic: navigate to /home if on welcome screen
      else if (location.pathname === '/') {
        navigate('/home', { replace: true })
      }
    } else if (connectionState === 'disconnected' && location.pathname !== '/') {
      navigate('/', { replace: true })
    }
  }, [connectionState, user, navigate, location.pathname, activeMatchId, sendMessage, refreshMyMatches])

  useEffect(() => {
    if (activeMatchId) {
      const match = myMatches.find(m => m.id === activeMatchId)
      if (match) {
        if (match.status === 'waiting') {
          navigate(`/lobby/${activeMatchId}`, { replace: true })
        } else if (match.status === 'active' || match.status === 'paused') {
          navigate(`/game/${activeMatchId}`, { replace: true })
        }
      }
    }
  }, [activeMatchId, myMatches, navigate])



  const handleCreateMatch = (name: string, maxPlayers: number, rulesetId: RulesetId, isPublic: boolean) => {
    sendMessage({ type: 'create_match', name, maxPlayers, rulesetId, isPublic })
  }

  const handleJoinByCode = (code: string) => {
    sendMessage({ type: 'join_match', code })
  }

  const handleSelectMatch = (matchId: string) => {
    setActiveMatchId(matchId)
  }

  const handleGameAction = useCallback((_action: string, payload?: { type: string; [key: string]: unknown }) => {
    if (payload && activeMatchId) {
      sendMessage({ type: 'action', matchId: activeMatchId, action: payload.type, payload })
    }
  }, [sendMessage, activeMatchId])

  const handleGridClick = useCallback((position: GridPosition) => {
    if (!matchState || !user || matchState.activeTurnPlayerId !== user.id) return
    if (matchState.status === 'finished') return
    const currentCombatant = matchState.combatants.find((c) => c.playerId === user.id)
    if (!currentCombatant) return
    
     if (isGurpsCombatant(currentCombatant) && currentCombatant.inCloseCombatWith) {
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
      const payload: { type: string; to: { q: number; r: number } } = { type: 'move_step', to: { q: position.x, r: position.z } }
      sendMessage({ type: 'action', matchId: activeMatchId!, action: payload.type, payload })
      setMoveTarget(null)
      return
    }

    if (matchState.rulesetId === 'pf2' && matchState.reachableHexes && matchState.reachableHexes.length > 0) {
      const reachable = matchState.reachableHexes.some(
        (hex) => hex.q === position.x && hex.r === position.z
      )
      if (!reachable) {
        setLogs((prev) => [...prev, 'Too far! Select a highlighted hex.'])
        return
      }
      const payload: { type: string; to: { q: number; r: number } } = { type: 'pf2_stride', to: { q: position.x, r: position.z } }
      sendMessage({ type: 'action', matchId: activeMatchId!, action: payload.type, payload })
      setMoveTarget(null)
      return
    }
    
    setMoveTarget(position)
  }, [matchState, user, sendMessage, setLogs, activeMatchId])

  const handleCombatantClick = useCallback((targetPlayerId: string) => {
    if (!matchState || !user) return
    if (targetPlayerId === user.id) {
      setSelectedTargetId(null)
      return
    }
    setSelectedTargetId(targetPlayerId)
  }, [matchState, user])

  const handleLeaveMatch = useCallback(() => {
    if (activeMatchId) {
      sendMessage({ type: 'leave_match', matchId: activeMatchId })
    }
    setActiveMatchId(null)
    setTimeout(() => navigate('/matches'), 0)
  }, [sendMessage, activeMatchId, navigate, setActiveMatchId])

  const handleLogout = useCallback(() => {
    logout()
    navigate('/')
  }, [logout, navigate])

  const currentMatch = myMatches.find(m => m.id === activeMatchId)
  const lobbyPlayers = matchState?.players ?? currentMatch?.players?.map(p => ({ 
    id: p.id, 
    name: p.name, 
    isBot: false, 
    characterId: '' 
  })) ?? []
  const isPlayerTurn = !!matchState && !spectatingMatchId && matchState.activeTurnPlayerId === user?.id

  return (
    <Routes>
      <Route path="/" element={
        user ? (
          <Navigate to="/home" replace />
        ) : (
          <WelcomeScreen onComplete={register} authError={authError} connectionState={connectionState} />
        )
      } />
      
      <Route path="/home" element={
        user ? (
          <Dashboard
            user={user}
            myMatches={myMatches}
            refreshMyMatches={refreshMyMatches}
            onLogout={handleLogout}
            onCreateMatch={handleCreateMatch}
            onJoinByCode={handleJoinByCode}
            onSelectMatch={handleSelectMatch}
          />
        ) : (
          <Navigate to="/" replace />
        )
      } />
      
      <Route path="/armory" element={
        user ? <CharacterArmory /> : <Navigate to="/" replace />
      } />
      
      <Route path="/lobby/:matchId" element={
        user ? <LobbyScreen /> : <Navigate to="/" replace />
      } />
      
      <Route path="/game/:matchId" element={
        !user ? (
          <Navigate to="/" replace />
        ) : (
          <>
            <GameScreen
              matchState={matchState}
              player={user ? { id: user.id, name: user.username, isBot: user.isBot, characterId: '' } : null}
              lobbyPlayers={lobbyPlayers}
              logs={logs}
              visualEffects={visualEffects}
              moveTarget={moveTarget}
              selectedTargetId={selectedTargetId}
              isPlayerTurn={isPlayerTurn}
              isSpectating={!!spectatingMatchId}
              pendingAction={pendingAction}
              onGridClick={handleGridClick}
              onCombatantClick={handleCombatantClick}
              onAction={handleGameAction}
              onPendingActionResponse={(response) => {
                if (activeMatchId) {
                  sendMessage({ type: 'action', matchId: activeMatchId, action: 'respond_exit', payload: { type: 'respond_exit', response } })
                }
                setPendingAction(null)
              }}
              onLeaveLobby={spectatingMatchId ? () => stopSpectating(spectatingMatchId) : handleLeaveMatch}
            />
          </>
        )
      } />
      
      <Route path="/matches" element={
        !user ? (
          <Navigate to="/" replace />
        ) : (
          <MatchBrowser
            user={user}
            matches={myMatches}
            publicMatches={publicMatches}
            onCreateMatch={handleCreateMatch}
            onJoinByCode={handleJoinByCode}
            onSelectMatch={handleSelectMatch}
            onRefresh={refreshMyMatches}
            onFetchPublicMatches={fetchPublicMatches}
            onSpectate={spectateMatch}
            onLogout={handleLogout}
          />
        )
      } />
      
      <Route path="*" element={<Navigate to={user ? "/home" : "/"} replace />} />
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
