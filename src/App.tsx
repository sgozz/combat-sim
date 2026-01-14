import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { useEffect, useMemo, useState } from 'react'
import type { LobbySummary, MatchState, Player, ServerToClientMessage } from '../shared/types'
import './App.css'

const ArenaScene = () => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      
      <Grid 
        infiniteGrid 
        fadeDistance={50} 
        sectionSize={1} 
        sectionColor="#444" 
        cellColor="#222" 
      />
      
      <mesh position={[0, 1, 0]}>
        <capsuleGeometry args={[0.5, 1, 4, 8]} />
        <meshStandardMaterial color="#646cff" />
      </mesh>
      
      <OrbitControls makeDefault />
      
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#9d4b4b', '#2f7f4f', '#3b5b9d']} labelColor="white" />
      </GizmoHelper>
      
      <Environment preset="city" />
    </>
  )
}

function App() {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [lobbies, setLobbies] = useState<LobbySummary[]>([])
  const [lobbyPlayers, setLobbyPlayers] = useState<Player[]>([])
  const [lobbyId, setLobbyId] = useState<string | null>(null)
  const [matchState, setMatchState] = useState<MatchState | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [selectedLobbyId, setSelectedLobbyId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'open' | 'in_match' | 'all'>('open')

  useEffect(() => {
    const ws = new WebSocket('ws://127.0.0.1:8080')
    setSocket(ws)

    ws.onopen = () => {
      setLogs((prev) => [...prev, 'Connected to server.'])
      const storedName = window.localStorage.getItem('gurps.nickname')?.trim()
      const name = storedName && storedName.length > 0
        ? storedName
        : (window.prompt('Enter your nickname')?.trim() || `Player-${Math.floor(Math.random() * 1000)}`)
      window.localStorage.setItem('gurps.nickname', name)
      ws.send(JSON.stringify({ type: 'auth', name }))
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data as string) as ServerToClientMessage
      if (message.type === 'auth_ok') {
        setPlayer(message.player)
        return
      }
      if (message.type === 'lobbies') {
        setLobbies(message.lobbies)
        return
      }
      if (message.type === 'lobby_joined') {
        setLobbyPlayers(message.players)
        setLobbyId(message.lobbyId)
        setLogs((prev) => [...prev, `Joined lobby ${message.lobbyId}.`])
        return
      }
      if (message.type === 'match_state') {
        setMatchState(message.state)
        setLobbyPlayers(message.state.players)
        setLogs(message.state.log)
        return
      }
      if (message.type === 'error') {
        setLogs((prev) => [...prev, `Error: ${message.message}`])
      }
    }

    ws.onerror = () => {
      setLogs((prev) => [...prev, 'Connection error.'])
    }

    ws.onclose = () => {
      setLogs((prev) => [...prev, 'Disconnected from server.'])
      setSocket(null)
      setLobbyId(null)
      setMatchState(null)
      setLobbyPlayers([])
    }

    return () => {
      ws.close()
    }
  }, [])

  const activeCombatant = useMemo(() => {
    if (!matchState || !player) return null
    return matchState.combatants.find((combatant) => combatant.playerId === player.id) ?? null
  }, [matchState, player])

  const sendMessage = (payload: unknown) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setLogs((prev) => [...prev, 'Error: Not connected.'])
      return
    }
    socket.send(JSON.stringify(payload))
  }

  const createLobby = () => {
    if (!player) return
    const name = window.prompt('Lobby name')?.trim() || `${player.name}'s Lobby`
    const maxPlayers = Number(window.prompt('Max players (2-4)', '4') ?? '4')
    sendMessage({ type: 'create_lobby', name, maxPlayers: Number.isNaN(maxPlayers) ? 4 : maxPlayers })
  }

  const joinLobby = () => {
    setSelectedLobbyId(null)
    setShowJoinModal(true)
  }

  const confirmJoin = () => {
    if (!selectedLobbyId) return
    const lobby = lobbies.find((candidate) => candidate.id === selectedLobbyId)
    if (!lobby) return
    
    sendMessage({ type: 'join_lobby', lobbyId: lobby.id })
    setLogs((prev) => [...prev, `Joining lobby ${lobby.id}.`])
    setShowJoinModal(false)
  }

  const startMatch = () => {
    sendMessage({ type: 'start_match' })
  }

  const endTurn = () => {
    sendMessage({ type: 'action', action: 'end_turn' })
  }

  const actionButtons = matchState
    ? [
        { label: 'Attack', onClick: () => sendMessage({ type: 'action', action: 'attack' }) },
        { label: 'Defend', onClick: () => sendMessage({ type: 'action', action: 'defend' }) },
        { label: 'Move', onClick: () => sendMessage({ type: 'action', action: 'move' }) },
        { label: 'End Turn', onClick: endTurn },
      ]
    : lobbyId
      ? [
          { label: 'Start Match', onClick: startMatch },
          { label: 'Leave Lobby', onClick: () => sendMessage({ type: 'leave_lobby' }) },
        ]
      : [
          { label: 'Create Lobby', onClick: createLobby },
          { label: 'Join Lobby', onClick: joinLobby },
        ]

  return (
    <div className="app-container">
      <aside className="panel">
        <div className="panel-header">Lobby / Status</div>
        <div className="panel-content">
          <div className="card">
            <h3>Active Character</h3>
            <div>Name: {matchState?.characters.find((c) => c.id === activeCombatant?.characterId)?.name ?? 'Unassigned'}</div>
            <div>HP: {activeCombatant?.currentHP ?? '-'}</div>
            <div>FP: {activeCombatant?.currentFP ?? '-'}</div>
            <div>Status: <span style={{color: '#4f4'}}>OK</span></div>
          </div>
          
          <div className="card">
            <h3>Participants</h3>
            <ul>
              {lobbyPlayers.length > 0 ? (
                lobbyPlayers.map((participant) => (
                  <li key={participant.id}>{participant.name}{participant.id === player?.id ? ' (You)' : ''}</li>
                ))
              ) : (
                lobbies.map((lobby) => (
                  <li key={lobby.id}>{lobby.name} ({lobby.playerCount}/{lobby.maxPlayers}) - {lobby.id}</li>
                ))
              )}
            </ul>
            <div>Lobby: {lobbyId ?? 'Not joined'}</div>
          </div>
        </div>
      </aside>

      <main className="canvas-container">
        <div className="overlay-ui">
          Current Turn: {matchState?.players.find((p) => p.id === matchState.activeTurnPlayerId)?.name ?? 'Waiting'}
        </div>
        <Canvas
          camera={{ position: [5, 5, 5], fov: 50 }}
          shadows
        >
          <color attach="background" args={['#111']} />
          <ArenaScene />
        </Canvas>
      </main>

      <aside className="panel panel-right">
        <div className="panel-header">Actions & Log</div>
        <div className="panel-content">
          <div className="card">
            <h3>Actions</h3>
            {actionButtons.map((action) => (
              <button key={action.label} className="action-btn" onClick={action.onClick}>{action.label}</button>
            ))}
          </div>

          <div className="card" style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
            <h3>Combat Log</h3>
            <div style={{flex: 1, overflowY: 'auto', minHeight: '100px'}}>
              {logs.map((log, i) => (
                <div key={i} className="log-entry">{log}</div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {showJoinModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Join Lobby</h2>
            
            <div className="filter-controls">
              <div className="filter-group">
                <button 
                  className={`filter-btn ${filterType === 'open' ? 'active' : ''}`}
                  onClick={() => setFilterType('open')}
                >
                  Open
                </button>
                <button 
                  className={`filter-btn ${filterType === 'in_match' ? 'active' : ''}`}
                  onClick={() => setFilterType('in_match')}
                >
                  In Match
                </button>
                <button 
                  className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterType('all')}
                >
                  All
                </button>
              </div>
            </div>

            <div className="lobby-list">
              {lobbies.filter(l => filterType === 'all' || l.status === filterType).length === 0 ? (
                <div className="empty-state">No lobbies found</div>
              ) : (
                lobbies
                  .filter(l => filterType === 'all' || l.status === filterType)
                  .map((lobby) => (
                  <div
                    key={lobby.id}
                    className={`lobby-item ${selectedLobbyId === lobby.id ? 'selected' : ''}`}
                    onClick={() => setSelectedLobbyId(lobby.id)}
                  >
                    <div className="lobby-name">{lobby.name}</div>
                    <div className="lobby-meta">
                      <span className="lobby-status">{lobby.status}</span>
                      <span className="lobby-count">
                        {lobby.playerCount}/{lobby.maxPlayers}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowJoinModal(false)}>Cancel</button>
              <button
                disabled={!selectedLobbyId}
                onClick={confirmJoin}
                className="primary"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
