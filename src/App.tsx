import { useEffect, useState, useCallback, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useGameSocket } from './hooks/useGameSocket'
import { WelcomeScreen } from './components/WelcomeScreen'
import { MatchBrowser } from './components/MatchBrowser'
import { GameScreen } from './components/game/GameScreen'
import { getRulesetComponents } from './components/rulesets'
import { assertRulesetId } from '../shared/rulesets/defaults'
import { rulesets, isGurpsCombatant } from '../shared/rulesets'

import type { GridPosition, CharacterSheet, RulesetId } from '../shared/types'
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
    setScreen,
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
  const [showCharacterModal, setShowCharacterModal] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<CharacterSheet | null>(null)
  
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
      if (pendingJoinCodeRef.current && !activeMatchId) {
        sendMessage({ type: 'join_match', code: pendingJoinCodeRef.current })
        pendingJoinCodeRef.current = null
      } else if (location.pathname === '/') {
        navigate('/matches', { replace: true })
      }
    } else if (connectionState === 'disconnected' && location.pathname !== '/') {
      navigate('/', { replace: true })
    }
  }, [connectionState, user, navigate, location.pathname, activeMatchId, sendMessage, refreshMyMatches])

  useEffect(() => {
    if (activeMatchId && location.pathname === '/matches') {
      navigate('/game', { replace: true })
    } else if (!activeMatchId && location.pathname === '/game') {
      navigate('/matches', { replace: true })
    }
  }, [activeMatchId, navigate, location.pathname])

  const handleWelcomeComplete = (username: string) => {
    setScreen('matches')
    register(username)
  }

  const handleCreateMatch = (name: string, rulesetId: RulesetId) => {
    sendMessage({ type: 'create_match', name, maxPlayers: 4, rulesetId })
  }

  const handleJoinByCode = (code: string) => {
    sendMessage({ type: 'join_match', code })
  }

  const handleSelectMatch = (matchId: string) => {
    setActiveMatchId(matchId)
    const match = myMatches.find(m => m.id === matchId)
    if (match && match.status !== 'waiting') {
      navigate('/game')
    }
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
          <Navigate to="/matches" replace />
        ) : (
          <WelcomeScreen onComplete={handleWelcomeComplete} authError={authError} />
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
      
      <Route path="/game" element={
        !user ? (
          <Navigate to="/" replace />
        ) : (
          <>
            <GameScreen
              matchState={matchState}
              player={user ? { id: user.id, name: user.username, isBot: user.isBot, characterId: '' } : null}
              lobbyPlayers={lobbyPlayers}
              lobbyId={activeMatchId}
              matchCode={currentMatch?.code ?? matchState?.code ?? null}
              logs={logs}
              visualEffects={visualEffects}
              moveTarget={moveTarget}
              selectedTargetId={selectedTargetId}
              isPlayerTurn={isPlayerTurn}
              isCreator={currentMatch?.creatorId === user?.id}
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
              onStartMatch={(botCount) => {
                if (activeMatchId) {
                  sendMessage({ type: 'start_combat', matchId: activeMatchId, botCount })
                }
              }}
               onOpenCharacterEditor={() => {
                   const rulesetId = assertRulesetId(matchState?.rulesetId ?? currentMatch?.rulesetId)
                   setEditingCharacter(rulesets[rulesetId].ruleset.createCharacter(user?.username ?? 'New Character'))
                   setShowCharacterModal(true)
                 }}
              inLobbyButNoMatch={!matchState && !!activeMatchId && currentMatch?.status === 'waiting'}
            />
            
             {showCharacterModal && (() => {
                const rulesetId = assertRulesetId(matchState?.rulesetId ?? currentMatch?.rulesetId)
                const { CharacterEditor } = getRulesetComponents(rulesetId)
                return (
                  <CharacterEditor 
                    character={editingCharacter || rulesets[rulesetId].ruleset.createCharacter(user?.username ?? 'New Character')}
                    setCharacter={setEditingCharacter}
                   onSave={() => {
                     if (editingCharacter && activeMatchId) {
                       sendMessage({ type: 'select_character', matchId: activeMatchId, character: editingCharacter })
                       setShowCharacterModal(false)
                       setEditingCharacter(null)
                     }
                   }}
                   onCancel={() => {
                     setShowCharacterModal(false)
                     setEditingCharacter(null)
                   }}
                 />
               )
             })()}
          </>
        )
      } />
      
      <Route path="/lobby" element={<Navigate to="/matches" replace />} />
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
