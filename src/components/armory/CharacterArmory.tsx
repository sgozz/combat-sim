import { useEffect, useState } from 'react'
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
}

type FilterRuleset = 'all' | 'gurps' | 'pf2'
type SortBy = 'name' | 'date' | 'favorite'

export const CharacterArmory = ({
  characters,
  onLoadCharacters,
  onDeleteCharacter,
  onToggleFavorite,
  onDuplicateCharacter,
}: CharacterArmoryProps) => {
  const navigate = useNavigate()
  const [filterRuleset, setFilterRuleset] = useState<FilterRuleset>('all')
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    onLoadCharacters()
  }, [onLoadCharacters])

  const filteredCharacters = characters
    .filter((char) => {
      if (filterRuleset === 'all') return true
      if (filterRuleset === 'gurps') return isGurpsCharacter(char)
      if (filterRuleset === 'pf2') return isPF2Character(char)
      return true
    })
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

  return (
    <div className="character-armory">
      <header className="armory-header">
        <div className="armory-header-content">
          <button onClick={() => navigate('/home')} className="armory-btn-back">
            ← Back
          </button>
          <h1 className="armory-title">Armory</h1>
          <button onClick={() => navigate('/armory/new')} className="armory-btn-new">
            + New Character
          </button>
        </div>
      </header>

      <main className="armory-main">
        <div className="armory-container">
          <div className="armory-filter-bar">
            <div className="armory-filter-group">
              <span className="armory-filter-label">Ruleset</span>
              <div className="armory-filter-buttons">
                {(['all', 'gurps', 'pf2'] as const).map((value) => (
                  <button
                    key={value}
                    className={`armory-filter-btn ${filterRuleset === value ? 'active' : ''}`}
                    onClick={() => setFilterRuleset(value)}
                  >
                    {value === 'all' ? 'All' : value === 'gurps' ? 'GURPS' : 'PF2'}
                  </button>
                ))}
              </div>
            </div>

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
                  onEdit={() => navigate(`/armory/${character.id}`)}
                  onToggleFavorite={() => onToggleFavorite(character.id)}
                  onDuplicate={() => onDuplicateCharacter(character)}
                  onDelete={() => handleDelete(character.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

type CharacterCardProps = {
  character: CharacterSheet
  isDeleteConfirm: boolean
  onEdit: () => void
  onToggleFavorite: () => void
  onDuplicate: () => void
  onDelete: () => void
}

const CharacterCard = ({
  character,
  isDeleteConfirm,
  onEdit,
  onToggleFavorite,
  onDuplicate,
  onDelete,
}: CharacterCardProps) => {
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
        <span className={`armory-ruleset-badge ruleset-${character.rulesetId}`}>
          {character.rulesetId === 'gurps' ? 'GURPS 4e' : 'Pathfinder 2e'}
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
            onDuplicate()
          }}
          className="armory-btn-action"
        >
          Duplicate
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className={`armory-btn-action btn-delete ${isDeleteConfirm ? 'confirm' : ''}`}
        >
          {isDeleteConfirm ? 'Confirm?' : 'Delete'}
        </button>
      </div>
    </div>
  )
}
