import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { useEffect, useMemo, useState, useCallback } from 'react'
import type { CombatActionPayload, CombatantState, GridPosition, LobbySummary, MatchState, Player, ServerToClientMessage, CharacterSheet, Attributes, Skill, Equipment } from '../shared/types'
import { calculateDerivedStats } from '../shared/rules'
import { WelcomeScreen } from './components/WelcomeScreen'
import { LobbyBrowser } from './components/LobbyBrowser'
import './App.css'

type ArenaSceneProps = {
  combatants: CombatantState[]
  characters: CharacterSheet[]
  playerId: string | null
  moveTarget: GridPosition | null
  selectedTargetId: string | null
  isPlayerTurn: boolean
  playerMoveRange: number
  onGridClick: (position: GridPosition) => void
  onCombatantClick: (playerId: string) => void
}

const HEX_SIZE = 1

const hexToWorld = (q: number, r: number): [number, number] => {
  const x = HEX_SIZE * (Math.sqrt(3) * (q + r / 2))
  const z = HEX_SIZE * (1.5 * r)
  return [x, z]
}

const hexDistance = (q1: number, r1: number, q2: number, r2: number) => {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2
}

type HexGridProps = {
  radius: number
  playerPosition: GridPosition | null
  moveRange: number
  enemyPositions: GridPosition[]
  selectedTargetPosition: GridPosition | null
  moveTargetPosition: GridPosition | null
  onHexClick: (q: number, r: number) => void
}

const getHexColor = (
  q: number,
  r: number,
  playerPosition: GridPosition | null,
  moveRange: number,
  enemyPositions: GridPosition[],
  selectedTargetPosition: GridPosition | null,
  moveTargetPosition: GridPosition | null,
  isAlternate: boolean,
  isHovered: boolean
): string => {
  if (moveTargetPosition && moveTargetPosition.x === q && moveTargetPosition.z === r) {
    return '#00ff00'
  }
  
  if (selectedTargetPosition && selectedTargetPosition.x === q && selectedTargetPosition.z === r) {
    return '#ffcc00'
  }
  
  const isEnemy = enemyPositions.some(pos => pos.x === q && pos.z === r)
  if (isEnemy) {
    return isHovered ? '#cc4444' : '#aa2222'
  }
  
  if (playerPosition) {
    const distance = hexDistance(q, r, playerPosition.x, playerPosition.z)
    if (distance <= moveRange && distance > 0) {
      return isHovered ? '#448844' : '#224422'
    }
  }

  if (isHovered) {
    return '#444444'
  }
  
  return isAlternate ? '#1a1a1a' : '#252525'
}

const HexTile = ({ q, r, color, onClick, onHover, onUnhover }: { 
  q: number; 
  r: number; 
  color: string; 
  onClick: () => void;
  onHover: () => void;
  onUnhover: () => void;
}) => {
  const [x, z] = hexToWorld(q, r)
  return (
    <mesh 
      position={[x, -0.05, z]} 
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onPointerOver={(e) => { e.stopPropagation(); onHover() }}
      onPointerOut={(e) => { e.stopPropagation(); onUnhover() }}
    >
      <cylinderGeometry args={[HEX_SIZE, HEX_SIZE, 0.1, 6]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

const HexGrid = ({ radius, playerPosition, moveRange, enemyPositions, selectedTargetPosition, moveTargetPosition, onHexClick }: HexGridProps) => {
  const [hoveredHex, setHoveredHex] = useState<{q: number, r: number} | null>(null)

  const tiles = useMemo(() => {
    const result: { q: number; r: number }[] = []
    for (let q = -radius; q <= radius; q += 1) {
      for (let r = -radius; r <= radius; r += 1) {
        if (Math.abs(q + r) > radius) continue
        result.push({ q, r })
      }
    }
    return result
  }, [radius])

  return (
    <group>
      {tiles.map(({ q, r }) => {
        const isAlternate = (q + r) % 2 === 0
        const isHovered = hoveredHex?.q === q && hoveredHex?.r === r
        const color = getHexColor(q, r, playerPosition, moveRange, enemyPositions, selectedTargetPosition, moveTargetPosition, isAlternate, isHovered)
        return (
          <HexTile 
            key={`${q},${r}`} 
            q={q} 
            r={r} 
            color={color} 
            onClick={() => onHexClick(q, r)}
            onHover={() => setHoveredHex({ q, r })}
            onUnhover={() => setHoveredHex(null)}
          />
        )
      })}
    </group>
  )
}

const MoveMarker = ({ position }: { position: GridPosition }) => {
  const [x, z] = hexToWorld(position.x, position.z)
  return (
    <mesh position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.5, 0.7, 6]} />
      <meshBasicMaterial color="#4f4" transparent opacity={0.8} />
    </mesh>
  )
}

type CombatantProps = {
  combatant: CombatantState
  character: CharacterSheet | undefined
  isPlayer: boolean
  isSelected: boolean
  onClick: () => void
}

const Combatant = ({ combatant, character, isPlayer, isSelected, onClick }: CombatantProps) => {
  const color = isPlayer ? '#646cff' : '#ff4444'
  const emissive = isSelected ? '#ffff00' : '#000000'
  const [x, z] = hexToWorld(combatant.position.x, combatant.position.z)
  
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1, 0]} onClick={onClick}>
        <capsuleGeometry args={[0.4, 0.8, 4, 8]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.5} />
      </mesh>
      {isSelected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.65, 6]} />
          <meshBasicMaterial color="#ff0" transparent opacity={0.8} />
        </mesh>
      )}
      <mesh position={[0, 1.9, 0]}>
        <planeGeometry args={[1, 0.15]} />
        <meshBasicMaterial color="#333" />
      </mesh>
      {character && (
        <mesh position={[-(1 - combatant.currentHP / character.derived.hitPoints) / 2, 1.9, 0.01]}>
          <planeGeometry args={[Math.max(0.01, combatant.currentHP / character.derived.hitPoints), 0.12]} />
          <meshBasicMaterial color={combatant.currentHP > character.derived.hitPoints / 3 ? '#4f4' : '#f44'} />
        </mesh>
      )}
    </group>
  )
}

const ArenaScene = ({ combatants, characters, playerId, moveTarget, selectedTargetId, isPlayerTurn, playerMoveRange, onGridClick, onCombatantClick }: ArenaSceneProps) => {
  const playerCombatant = combatants.find(c => c.playerId === playerId)
  const playerPosition = playerCombatant?.position ?? null
  
  const enemyPositions = combatants
    .filter(c => c.playerId !== playerId)
    .map(c => c.position)
  
  const selectedTarget = combatants.find(c => c.playerId === selectedTargetId)
  const selectedTargetPosition = selectedTarget?.position ?? null

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      
      <HexGrid 
        radius={10} 
        playerPosition={isPlayerTurn ? playerPosition : null}
        moveRange={isPlayerTurn ? playerMoveRange : 0}
        enemyPositions={enemyPositions}
        selectedTargetPosition={selectedTargetPosition}
        moveTargetPosition={moveTarget}
        onHexClick={(q, r) => onGridClick({ x: q, y: 0, z: r })}
      />
      
      {combatants.map((combatant) => (
        <Combatant
          key={combatant.playerId}
          combatant={combatant}
          character={characters.find(c => c.id === combatant.characterId)}
          isPlayer={combatant.playerId === playerId}
          isSelected={combatant.playerId === selectedTargetId}
          onClick={() => onCombatantClick(combatant.playerId)}
        />
      ))}

      {moveTarget && <MoveMarker position={moveTarget} />}

      <OrbitControls makeDefault />
      
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#9d4b4b', '#2f7f4f', '#3b5b9d']} labelColor="white" />
      </GizmoHelper>
      
      <Environment preset="city" />
    </>
  )
}

function App() {
  const [screen, setScreen] = useState<'welcome' | 'lobby' | 'waiting' | 'match'>('welcome')
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [lobbies, setLobbies] = useState<LobbySummary[]>([])
  const [lobbyPlayers, setLobbyPlayers] = useState<Player[]>([])
  const [lobbyId, setLobbyId] = useState<string | null>(null)
  const [matchState, setMatchState] = useState<MatchState | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [moveTarget, setMoveTarget] = useState<GridPosition | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [showCharacterModal, setShowCharacterModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [selectedLobbyId, setSelectedLobbyId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'open' | 'in_match' | 'all'>('open')
  const [editingCharacter, setEditingCharacter] = useState<CharacterSheet | null>(null)

  function initializeConnection(name: string) {
    const ws = new WebSocket('ws://127.0.0.1:8080')
    setSocket(ws)

    ws.onopen = () => {
      setLogs((prev) => [...prev, 'Connected to server.'])
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
        setScreen('waiting')
        return
      }
      if (message.type === 'lobby_left') {
        setLobbyId(null)
        setMatchState(null)
        setLobbyPlayers([])
        setSelectedTargetId(null)
        setMoveTarget(null)
        setLogs((prev) => [...prev, 'Left lobby.'])
        setScreen('lobby')
        return
      }
      if (message.type === 'match_state') {
        setMatchState(message.state)
        setLobbyPlayers(message.state.players)
        setLogs(message.state.log)
        setScreen('match')
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
  }

  useEffect(() => {
    const storedName = window.localStorage.getItem('gurps.nickname')?.trim()
    if (storedName && storedName.length > 0) {
      setScreen('lobby')
      initializeConnection(storedName)
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

  const handleJoinLobby = (lobbyId: string) => {
    sendMessage({ type: 'join_lobby', lobbyId })
  }

  const handleRefreshLobbies = () => {
    sendMessage({ type: 'list_lobbies' })
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
    const payload: CombatActionPayload = { type: 'end_turn' }
    sendMessage({ type: 'action', action: payload.type, payload })
  }

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
  }, [matchState, player, moveTarget, sendMessage])

  const confirmMove = () => {
    if (!moveTarget) return
    const payload: CombatActionPayload = { type: 'move', position: moveTarget }
    sendMessage({ type: 'action', action: payload.type, payload })
    setMoveTarget(null)
  }

  const cancelMove = () => {
    setMoveTarget(null)
  }

  const handleCombatantClick = useCallback((targetPlayerId: string) => {
    if (!matchState || !player) return
    if (targetPlayerId === player.id) {
      setSelectedTargetId(null)
      return
    }
    setSelectedTargetId(targetPlayerId)
  }, [matchState, player])

  const openCharacterEditor = () => {
    const defaultAttributes: Attributes = { strength: 10, dexterity: 10, intelligence: 10, health: 10 }
    const newCharacter: CharacterSheet = {
      id: crypto.randomUUID(),
      name: player?.name ?? 'New Character',
      attributes: defaultAttributes,
      derived: calculateDerivedStats(defaultAttributes),
      skills: [],
      advantages: [],
      disadvantages: [],
      equipment: [],
      pointsTotal: 100,
    }
    setEditingCharacter(newCharacter)
    setShowCharacterModal(true)
  }

  const saveCharacter = () => {
    if (!editingCharacter) return
    const updated = {
      ...editingCharacter,
      derived: calculateDerivedStats(editingCharacter.attributes),
    }
    sendMessage({ type: 'select_character', character: updated })
    setShowCharacterModal(false)
    setEditingCharacter(null)
    setLogs((prev) => [...prev, `Character "${updated.name}" saved.`])
  }

  const updateAttribute = (attr: keyof Attributes, delta: number) => {
    if (!editingCharacter) return
    const current = editingCharacter.attributes[attr]
    const newValue = Math.max(7, Math.min(20, current + delta))
    setEditingCharacter({
      ...editingCharacter,
      attributes: { ...editingCharacter.attributes, [attr]: newValue },
      derived: calculateDerivedStats({ ...editingCharacter.attributes, [attr]: newValue }),
    })
  }

  const addSkill = () => {
    if (!editingCharacter) return
    const name = window.prompt('Skill name (e.g., Brawling, Sword)')?.trim()
    if (!name) return
    const levelStr = window.prompt('Skill level (10-18)', '12')
    const level = Math.max(10, Math.min(18, Number(levelStr) || 12))
    const newSkill: Skill = { id: crypto.randomUUID(), name, level }
    setEditingCharacter({
      ...editingCharacter,
      skills: [...editingCharacter.skills, newSkill],
    })
  }

  const removeSkill = (skillId: string) => {
    if (!editingCharacter) return
    setEditingCharacter({
      ...editingCharacter,
      skills: editingCharacter.skills.filter(s => s.id !== skillId),
    })
  }

  const addEquipment = () => {
    if (!editingCharacter) return
    const name = window.prompt('Weapon name (e.g., Sword, Club)')?.trim()
    if (!name) return
    const damage = window.prompt('Damage formula (e.g., 1d+2, 2d)', '1d+1')?.trim() || '1d'
    const newEquip: Equipment = { id: crypto.randomUUID(), name, damage }
    setEditingCharacter({
      ...editingCharacter,
      equipment: [...editingCharacter.equipment, newEquip],
    })
  }

  const removeEquipment = (equipId: string) => {
    if (!editingCharacter) return
    setEditingCharacter({
      ...editingCharacter,
      equipment: editingCharacter.equipment.filter(e => e.id !== equipId),
    })
  }

  const selectedTarget = matchState?.combatants.find(c => c.playerId === selectedTargetId)
  const selectedTargetName = selectedTarget 
    ? matchState?.characters.find(c => c.id === selectedTarget.characterId)?.name ?? 'Unknown'
    : null

  const actionButtons = matchState
    ? [
        {
          label: selectedTargetId ? `Attack ${selectedTargetName}` : 'Attack (select target)',
          onClick: () => {
            if (!selectedTargetId) {
              setLogs((prev) => [...prev, 'Click on an enemy to select a target first.'])
              return
            }
            const payload: CombatActionPayload = { type: 'attack', targetId: selectedTargetId }
            sendMessage({ type: 'action', action: payload.type, payload })
            setSelectedTargetId(null)
          },
        },
        {
          label: 'Defend',
          onClick: () => {
            const payload: CombatActionPayload = { type: 'defend' }
            sendMessage({ type: 'action', action: payload.type, payload })
          },
        },
        {
          label: moveTarget ? 'Confirm Move' : 'Move (click grid)',
          onClick: moveTarget ? confirmMove : () => setLogs((prev) => [...prev, 'Click on the grid to select destination.']),
        },
        ...(moveTarget ? [{ label: 'Cancel Move', onClick: cancelMove }] : []),
        { label: 'End Turn', onClick: endTurn },
        { label: 'Leave Match', onClick: () => sendMessage({ type: 'leave_lobby' }) },
      ]
    : lobbyId
      ? [
          { label: 'Edit Character', onClick: openCharacterEditor },
          { label: 'Start Match', onClick: startMatch },
          { label: 'Leave Lobby', onClick: () => sendMessage({ type: 'leave_lobby' }) },
        ]
      : [
          { label: 'Edit Character', onClick: openCharacterEditor },
          { label: 'Create Lobby', onClick: createLobby },
          { label: 'Join Lobby', onClick: joinLobby },
        ]

  if (screen === 'welcome') {
    return <WelcomeScreen onComplete={handleWelcomeComplete} />
  }

  if (screen === 'lobby' && player) {
    return (
      <>
        <LobbyBrowser
          player={player}
          lobbies={lobbies}
          onQuickMatch={handleQuickMatch}
          onJoinLobby={handleJoinLobby}
          onRefresh={handleRefreshLobbies}
        />
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
                onClick={() => {
                  if (!selectedLobbyId) return
                  sendMessage({ type: 'delete_lobby', lobbyId: selectedLobbyId })
                  setSelectedLobbyId(null)
                }}
                className="danger"
              >
                Delete
              </button>
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

      {showCharacterModal && editingCharacter && (
        <div className="modal-overlay">
          <div className="modal-content character-modal">
            <h2>Character Builder</h2>
            
            <div className="char-section">
              <label className="char-label">Name</label>
              <input
                type="text"
                className="char-input"
                value={editingCharacter.name}
                onChange={(e) => setEditingCharacter({ ...editingCharacter, name: e.target.value })}
              />
            </div>

            <div className="char-section">
              <label className="char-label">Attributes</label>
              <div className="attr-grid">
                {(['strength', 'dexterity', 'intelligence', 'health'] as const).map((attr) => (
                  <div key={attr} className="attr-row">
                    <span className="attr-name">{attr.slice(0, 2).toUpperCase()}</span>
                    <button className="attr-btn" onClick={() => updateAttribute(attr, -1)}>-</button>
                    <span className="attr-value">{editingCharacter.attributes[attr]}</span>
                    <button className="attr-btn" onClick={() => updateAttribute(attr, 1)}>+</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="char-section">
              <label className="char-label">Derived Stats</label>
              <div className="derived-grid">
                <div className="derived-item">HP: {editingCharacter.derived.hitPoints}</div>
                <div className="derived-item">FP: {editingCharacter.derived.fatiguePoints}</div>
                <div className="derived-item">Speed: {editingCharacter.derived.basicSpeed}</div>
                <div className="derived-item">Move: {editingCharacter.derived.basicMove}</div>
                <div className="derived-item">Dodge: {editingCharacter.derived.dodge}</div>
              </div>
            </div>

            <div className="char-section">
              <label className="char-label">
                Skills
                <button className="add-btn" onClick={addSkill}>+ Add</button>
              </label>
              <div className="list-items">
                {editingCharacter.skills.length === 0 ? (
                  <div className="empty-list">No skills added</div>
                ) : (
                  editingCharacter.skills.map((skill) => (
                    <div key={skill.id} className="list-item">
                      <span>{skill.name} ({skill.level})</span>
                      <button className="remove-btn" onClick={() => removeSkill(skill.id)}>x</button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="char-section">
              <label className="char-label">
                Equipment
                <button className="add-btn" onClick={addEquipment}>+ Add</button>
              </label>
              <div className="list-items">
                {editingCharacter.equipment.length === 0 ? (
                  <div className="empty-list">No equipment added</div>
                ) : (
                  editingCharacter.equipment.map((equip) => (
                    <div key={equip.id} className="list-item">
                      <span>{equip.name} ({equip.damage})</span>
                      <button className="remove-btn" onClick={() => removeEquipment(equip.id)}>x</button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => { setShowCharacterModal(false); setEditingCharacter(null) }}>Cancel</button>
              <button className="primary" onClick={saveCharacter}>Save Character</button>
            </div>
          </div>
        </div>
      )}
      </>
    )
  }

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
            <div>Status: <span style={{ color: '#4f4' }}>OK</span></div>
          </div>

          <div className="card">
            <h3>Participants</h3>
            <ul>
              {lobbyPlayers.length > 0 ? (
                lobbyPlayers.map((participant) => (
                  <li key={participant.id}>
                    {participant.name}{participant.id === player?.id ? ' (You)' : ''}
                  </li>
                ))
              ) : (
                <li>No players</li>
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
        <Canvas camera={{ position: [5, 5, 5], fov: 50 }} shadows>
          <color attach="background" args={['#111']} />
          <ArenaScene
            combatants={matchState?.combatants ?? []}
            characters={matchState?.characters ?? []}
            playerId={player?.id ?? null}
            moveTarget={moveTarget}
            selectedTargetId={selectedTargetId}
            isPlayerTurn={matchState?.activeTurnPlayerId === player?.id}
            playerMoveRange={activeCombatant ? (matchState?.characters.find(c => c.id === activeCombatant.characterId)?.derived.basicMove ?? 5) : 5}
            onGridClick={handleGridClick}
            onCombatantClick={handleCombatantClick}
          />
        </Canvas>
      </main>

      <aside className="panel panel-right">
        <div className="panel-header">Actions & Log</div>
        <div className="panel-content">
          <div className="card">
            <h3>Actions</h3>
            {actionButtons.map((action) => (
              <button key={action.label} className="action-btn" onClick={action.onClick}>
                {action.label}
              </button>
            ))}
          </div>

          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3>Combat Log</h3>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: '100px' }}>
              {logs.map((log, i) => (
                <div key={i} className="log-entry">{log}</div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

export default App
