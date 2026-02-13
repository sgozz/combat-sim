import { useEffect, useState, useCallback, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useGameSocket } from './hooks/useGameSocket'
import { generateUUID } from './utils/uuid'
import { WelcomeScreen } from './components/WelcomeScreen'
import { Dashboard } from './components/Dashboard'
import { CharacterArmory } from './components/armory/CharacterArmory'
import { CharacterEditor } from './components/armory/CharacterEditor'
import { LobbyScreen } from './components/lobby/LobbyScreen'
import { GameScreen } from './components/game/GameScreen'
import { isGurpsCombatant } from '../shared/rulesets'

import type { CharacterSheet, GridPosition } from '../shared/types'
import type { PendingSpellCast } from './components/rulesets/types'
import './App.css'
import './components/action-bar/styles.css'
import './components/game/GameHeader.css'
import './components/game/GameHUD.css'
import './components/game/InitiativeTracker.css'
import './components/game/Tooltip.css'
import './components/game/TurnStepper.css'
import './components/game/MiniMap.css'
import './components/game/MovementAndWaitTrigger.css'
import './components/game/PostureControls.css'
import './components/game/GameScreenModals.css'
import './components/game/DefenseModal.css'
import './components/game/SkillsList.css'
import './components/rulesets/pf2/pf2.css'
import './components/game/ConnectionStatus.css'
import './components/ui/ConfirmDialog.css'

function ConnectionBanner({ state }: { state: 'disconnected' | 'connecting' | 'connected' }) {
  if (state === 'connected') return null
  return (
    <div className={`connection-banner connection-banner--${state}`}>
      <span className="connection-banner-dot" />
      {state === 'connecting' ? 'Reconnecting…' : 'Disconnected — actions won\'t work'}
    </div>
  )
}

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
    isSyncing,
    setLogs,
    setActiveMatchId,
    setPendingAction,
    register,
    sendMessage,
    logout,
    refreshMyMatches,
    fetchPublicMatches,
    stopSpectating,
    characters: rosterCharacters,
    loadCharacters,
    saveCharacter,
    deleteCharacter,
    toggleFavorite,
    setPreferredRuleset,
  } = useGameSocket()



  const handleDuplicateCharacter = useCallback((character: CharacterSheet) => {
    const duplicate = {
      ...character,
      id: generateUUID(),
      name: `${character.name} (Copy)`,
      isFavorite: false,
    }
    saveCharacter(duplicate)
  }, [saveCharacter])

  const [moveTarget, setMoveTarget] = useState<GridPosition | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [pendingSpellCast, setPendingSpellCast] = useState<PendingSpellCast | null>(null)
  
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
      }
    } else if (connectionState === 'disconnected' && !user && location.pathname !== '/') {
      navigate('/', { replace: true })
    }
  }, [connectionState, user, navigate, location.pathname, activeMatchId, sendMessage, refreshMyMatches])

  // When activeMatchId is set for an active/paused match but we have no matchState,
  // send rejoin_match to the server to request it. This covers:
  // - Clicking a match card in the Dashboard
  // - Reconnecting after page reload (localStorage has the matchId)
  // - Switching devices (server returns activeMatches in auth_ok)
  const rejoinSentRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activeMatchId || connectionState !== 'connected') {
      rejoinSentRef.current = null
      return
    }
    if (matchState?.id === activeMatchId) return
    if (rejoinSentRef.current === activeMatchId) return

    const match = myMatches.find(m => m.id === activeMatchId)
    if (match && (match.status === 'active' || match.status === 'paused')) {
      rejoinSentRef.current = activeMatchId
      sendMessage({ type: 'rejoin_match', matchId: activeMatchId })
    }
  }, [activeMatchId, matchState, myMatches, connectionState, sendMessage])

  useEffect(() => {
    if (activeMatchId) {
      // Don't redirect away from armory (user may be creating a character mid-lobby)
      if (location.pathname.startsWith('/armory')) return
      const match = myMatches.find(m => m.id === activeMatchId)
      if (match) {
        if (match.status === 'waiting') {
          navigate(`/lobby/${activeMatchId}`, { replace: true })
        } else if (match.status === 'active' || match.status === 'paused' || match.status === 'finished') {
          navigate(`/game/${activeMatchId}`, { replace: true })
        }
      }
    }
  }, [activeMatchId, myMatches, navigate, location.pathname])



  const handleCreateMatch = (name: string, maxPlayers: number, isPublic: boolean, scenarioBiome?: string) => {
    sendMessage({
      type: 'create_match',
      name,
      maxPlayers,
      isPublic,
      ...(scenarioBiome ? { scenarioBiome: scenarioBiome as 'dungeon' | 'wilderness' } : {}),
    })
  }

  const handleJoinByCode = (code: string) => {
    sendMessage({ type: 'join_match', code })
  }

  const handleSelectMatch = (matchId: string) => {
    setActiveMatchId(matchId)
  }

  const handleDismissMatch = useCallback((matchId: string) => {
    sendMessage({ type: 'leave_match', matchId })
  }, [sendMessage])

  const handleGameAction = useCallback((_action: string, payload?: { type: string; [key: string]: unknown }) => {
    if (payload && activeMatchId) {
      sendMessage({ type: 'action', matchId: activeMatchId, action: payload.type, payload })
    }
  }, [sendMessage, activeMatchId])

  // Cancel spell targeting on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pendingSpellCast) {
        setPendingSpellCast(null)
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [pendingSpellCast])

  const handleGridClick = useCallback((position: GridPosition) => {
    if (!matchState || !user || matchState.activeTurnPlayerId !== user.id) return
    if (matchState.status === 'finished') return

    // Intercept click for area spell targeting
    if (pendingSpellCast) {
      sendMessage({
        type: 'action',
        matchId: activeMatchId!,
        action: 'pf2_cast_spell',
        payload: {
          type: 'pf2_cast_spell',
          casterIndex: pendingSpellCast.casterIndex,
          spellName: pendingSpellCast.spellName,
          spellLevel: pendingSpellCast.castLevel,
          targetHex: { q: position.x, r: position.z }
        }
      })
      setPendingSpellCast(null)
      return
    }

    const currentCombatant = matchState.combatants.find((c) => c.playerId === user.id)
    if (!currentCombatant) return
    
     if (isGurpsCombatant(currentCombatant) && currentCombatant.inCloseCombatWith) {
       setLogs((prev) => [...prev, 'Error: Cannot move while in close combat. Use Exit Close Combat first.'])
       return
     }
    
    if (matchState.turnMovement?.phase === 'moving') {
      const reachable = matchState.reachableHexes?.some(
        (hex) => hex.q === position.x && hex.r === position.z
      )
      if (!reachable) {
        setLogs((prev) => [...prev, 'Error: Too far! Select a highlighted hex.'])
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
        setLogs((prev) => [...prev, 'Error: Too far! Select a highlighted hex.'])
        return
      }
      const payload: { type: string; to: { q: number; r: number } } = { type: 'pf2_stride', to: { q: position.x, r: position.z } }
      sendMessage({ type: 'action', matchId: activeMatchId!, action: payload.type, payload })
      setMoveTarget(null)
      return
    }
    
    setMoveTarget(position)
  }, [matchState, user, sendMessage, setLogs, activeMatchId, pendingSpellCast])

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
      const isFinished = matchState?.status === 'finished'
        || myMatches.find(m => m.id === activeMatchId)?.status === 'finished'
      if (!isFinished) {
        sendMessage({ type: 'leave_match', matchId: activeMatchId })
      }
    }
    setActiveMatchId(null)
    setTimeout(() => navigate('/matches'), 0)
  }, [sendMessage, activeMatchId, matchState, myMatches, navigate, setActiveMatchId])

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
    <>
    <ConnectionBanner state={connectionState} />
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
              publicMatches={publicMatches}
              refreshMyMatches={refreshMyMatches}
              fetchPublicMatches={fetchPublicMatches}
              onLogout={handleLogout}
              onCreateMatch={handleCreateMatch}
              onJoinByCode={handleJoinByCode}
               onSelectMatch={handleSelectMatch}
               onDismissMatch={handleDismissMatch}
               setPreferredRuleset={setPreferredRuleset}
            />
         ) : (
           <Navigate to="/" replace />
         )
       } />
      
      <Route path="/armory" element={
        user ? (
          <CharacterArmory
            characters={rosterCharacters}
            onLoadCharacters={loadCharacters}
            onDeleteCharacter={deleteCharacter}
            onToggleFavorite={toggleFavorite}
            onDuplicateCharacter={handleDuplicateCharacter}
          />
        ) : <Navigate to="/" replace />
      } />
      
       <Route path="/armory/new" element={
         user ? (
           <CharacterEditor
             characters={rosterCharacters}
             onSaveCharacter={saveCharacter}
             preferredRulesetId={user.preferredRulesetId}
           />
         ) : <Navigate to="/" replace />
       } />
       
       <Route path="/armory/:id" element={
         user ? (
           <CharacterEditor
             characters={rosterCharacters}
             onSaveCharacter={saveCharacter}
             preferredRulesetId={user.preferredRulesetId}
           />
         ) : <Navigate to="/" replace />
       } />
      
      <Route path="/lobby/:matchId" element={
        user ? (
          <LobbyScreen
            myMatches={myMatches}
            user={user}
            connectionState={connectionState}
            sendMessage={sendMessage}
            characters={rosterCharacters}
            isSyncing={isSyncing}
            onLoadCharacters={loadCharacters}
          />
        ) : <Navigate to="/" replace />
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
              pendingSpellCast={pendingSpellCast}
              onGridClick={handleGridClick}
              onCombatantClick={handleCombatantClick}
              onAction={handleGameAction}
              onSetPendingSpellCast={setPendingSpellCast}
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
      
       <Route path="*" element={<Navigate to={user ? "/home" : "/"} replace />} />
    </Routes>
    </>
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
