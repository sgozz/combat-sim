import { useState } from 'react'
import type { LobbySummary } from '../../../shared/types'

type JoinLobbyModalProps = {
  lobbies: LobbySummary[]
  onJoin: (lobbyId: string) => void
  onDelete: (lobbyId: string) => void
  onCancel: () => void
}

export const JoinLobbyModal = ({ lobbies, onJoin, onDelete, onCancel }: JoinLobbyModalProps) => {
  const [selectedLobbyId, setSelectedLobbyId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'open' | 'in_match' | 'all'>('open')

  return (
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
          <button onClick={onCancel}>Cancel</button>
          <button
            disabled={!selectedLobbyId}
            onClick={() => {
              if (!selectedLobbyId) return
              onDelete(selectedLobbyId)
              setSelectedLobbyId(null)
            }}
            className="danger"
          >
            Delete
          </button>
          <button
            disabled={!selectedLobbyId}
            onClick={() => {
              if (!selectedLobbyId) return
              onJoin(selectedLobbyId)
            }}
            className="primary"
          >
            Join
          </button>
        </div>
      </div>
    </div>
  )
}
