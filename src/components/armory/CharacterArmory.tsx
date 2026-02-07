import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CharacterSheet } from '../../../shared/types'
import { isGurpsCharacter, isPF2Character } from '../../../shared/rulesets/characterSheet'
import './CharacterArmory.css'

type CharacterArmoryProps = {
  characters: CharacterSheet[]
  onLoadCharacters: () => void
  onDeleteCharacter: (characterId: string) => void
  onToggleFavorite: (characterId: string) => void
  onDuplicateCharacter: (character: CharacterSheet) => void
  onSyncCharacterFromPathbuilder?: (characterId: string, pathbuilderId: string) => void
}

type SortBy = 'name' | 'date' | 'favorite'

export const CharacterArmory = ({
  characters,
  onLoadCharacters,
  onDeleteCharacter,
  onToggleFavorite,
  onDuplicateCharacter,
  onSyncCharacterFromPathbuilder,
}: CharacterArmoryProps) => {
  const navigate = useNavigate()
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [syncConfirm, setSyncConfirm] = useState<string | null>(null)

  useEffect(() => {
    onLoadCharacters()
  }, [onLoadCharacters])

  const filteredCharacters = characters
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'favorite') {
        const aFav = a.isFavorite ? 1 : 0
        const bFav = b.isFavorite ? 1 : 0
        return bFav - aFav
      }
      return b.id.localeCompare(a.id)
    })

  const handleDelete = (characterId: string) => {
    if (deleteConfirm === characterId) {
      onDeleteCharacter(characterId)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm(characterId)
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  const handleSync = (character: CharacterSheet) => {
    if (isPF2Character(character) && character.pathbuilderId) {
      if (syncConfirm === character.id) {
        if (onSyncCharacterFromPathbuilder) {
          onSyncCharacterFromPathbuilder(character.id, character.pathbuilderId)
        }
        setSyncConfirm(null)
      } else {
        setSyncConfirm(character.id)
        setTimeout(() => setSyncConfirm(null), 3000)
      }
    }
  }

  return (
    <div className="character-armory">
      <header className="armory-header">
        <div className="armory-header-content">
          <button onClick={() => navigate('/home')} className="armory-btn-back">
            ← Back
          </button>
          <h1 className="armory-title">Armory</h1>
          <button 
            onClick={() => navigate('/armory/new')} 
            className="armory-btn-new"
          >
            + New Character
          </button>
        </div>
      </header>

      <main className="armory-main">
        <div className="armory-container">
          <div className="armory-filter-bar">
            <div className="armory-filter-group">
              <span className="armory-filter-label">Sort</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="armory-filter-select"
              >
                <option value="date">Date Created</option>
                <option value="name">Name</option>
                <option value="favorite">Favorites First</option>
              </select>
            </div>

            <div className="armory-filter-spacer" />
            <span className="armory-char-count">
              {filteredCharacters.length} character{filteredCharacters.length !== 1 ? 's' : ''}
            </span>
          </div>

          {filteredCharacters.length === 0 && (
            <div className="armory-empty-state">
              <span className="armory-empty-icon">⚔️</span>
              <p className="armory-empty-text">
                {characters.length === 0
                  ? 'No characters yet. Create your first!'
                  : 'No characters match your filters.'}
              </p>
              {characters.length === 0 && (
                <button onClick={() => navigate('/armory/new')} className="armory-empty-cta">
                  Create Character
                </button>
              )}
            </div>
          )}

          {filteredCharacters.length > 0 && (
            <div className="armory-character-grid">
              {filteredCharacters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  isDeleteConfirm={deleteConfirm === character.id}
                  isSyncConfirm={syncConfirm === character.id}
                  onEdit={() => navigate(`/armory/${character.id}`)}
                  onToggleFavorite={() => onToggleFavorite(character.id)}
                  onDuplicate={() => onDuplicateCharacter(character)}
                  onDelete={() => handleDelete(character.id)}
                  onSync={() => handleSync(character)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <button
        onClick={() => navigate('/armory/new')}
        className="armory-fab"
        aria-label="New Character"
      >
        +
      </button>
    </div>
  )
}

type CharacterCardProps = {
  character: CharacterSheet
  isDeleteConfirm: boolean
  isSyncConfirm: boolean
  onEdit: () => void
  onToggleFavorite: () => void
  onDuplicate: () => void
  onDelete: () => void
  onSync?: () => void
}

const CharacterCard = ({
  character,
  isDeleteConfirm,
  isSyncConfirm,
  onEdit,
  onToggleFavorite,
  onDuplicate,
  onDelete,
  onSync,
}: CharacterCardProps) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [menuOpen, closeMenu])

  return (
    <div className="armory-character-card">
      <div className="armory-card-header">
        <div className="armory-card-title-row">
          <h3 className="armory-card-name">{character.name}</h3>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite()
            }}
            className="armory-btn-favorite"
            aria-label="Toggle favorite"
          >
            {character.isFavorite ? '★' : '☆'}
          </button>
        </div>
        <span className={`armory-ruleset-badge ruleset-${isGurpsCharacter(character) ? 'gurps' : 'pf2'}`}>
          {isGurpsCharacter(character) ? 'GURPS 4e' : 'Pathfinder 2e'}
        </span>
      </div>

      <div className="armory-card-body" onClick={onEdit}>
        {isGurpsCharacter(character) && (
          <>
            <div className="armory-card-stat">
              <span className="armory-stat-label">HP</span>
              <span className="armory-stat-value">{character.derived.hitPoints}</span>
            </div>
            <div className="armory-card-stat">
              <span className="armory-stat-label">ST</span>
              <span className="armory-stat-value">{character.attributes.strength}</span>
            </div>
            <div className="armory-card-stat">
              <span className="armory-stat-label">DX</span>
              <span className="armory-stat-value">{character.attributes.dexterity}</span>
            </div>
            <div className="armory-card-stat">
              <span className="armory-stat-label">HT</span>
              <span className="armory-stat-value">{character.attributes.health}</span>
            </div>
          </>
        )}
        {isPF2Character(character) && (
          <>
            <div className="armory-card-stat">
              <span className="armory-stat-label">HP</span>
              <span className="armory-stat-value">{character.derived.hitPoints}</span>
            </div>
            <div className="armory-card-stat">
              <span className="armory-stat-label">Level</span>
              <span className="armory-stat-value">{character.level}</span>
            </div>
            <div className="armory-card-stat">
              <span className="armory-stat-label">Class</span>
              <span className="armory-stat-value">{character.class || 'N/A'}</span>
            </div>
          </>
        )}
      </div>

      <div className="armory-card-actions">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="armory-btn-action btn-edit"
        >
          Edit
        </button>
        {isPF2Character(character) && character.pathbuilderId && onSync && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSync()
            }}
            className={`armory-btn-action btn-sync ${isSyncConfirm ? 'confirm' : ''}`}
            title="Sync from Pathbuilder"
          >
            {isSyncConfirm ? 'Confirm?' : '🔄'}
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate()
          }}
          className="armory-btn-action armory-btn-action--secondary"
        >
          Duplicate
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className={`armory-btn-action btn-delete armory-btn-action--secondary ${isDeleteConfirm ? 'confirm' : ''}`}
        >
          {isDeleteConfirm ? 'Confirm?' : 'Delete'}
        </button>

        <div className="armory-card-overflow" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen(!menuOpen)
            }}
            className="armory-btn-action armory-btn-overflow"
            aria-label="More actions"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="armory-overflow-menu">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDuplicate()
                  closeMenu()
                }}
                className="armory-overflow-item"
              >
                Duplicate
              </button>
              {isPF2Character(character) && character.pathbuilderId && onSync && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onSync()
                    closeMenu()
                  }}
                  className={`armory-overflow-item ${isSyncConfirm ? 'confirm' : ''}`}
                >
                  {isSyncConfirm ? 'Confirm Sync?' : 'Sync from Pathbuilder'}
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                  if (isDeleteConfirm) closeMenu()
                }}
                className={`armory-overflow-item armory-overflow-item--danger ${isDeleteConfirm ? 'confirm' : ''}`}
              >
                {isDeleteConfirm ? 'Confirm Delete?' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
