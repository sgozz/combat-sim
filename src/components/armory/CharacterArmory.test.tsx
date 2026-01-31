import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { GurpsCharacterSheet } from '../../../shared/rulesets/gurps/characterSheet'
import type { PF2CharacterSheet } from '../../../shared/rulesets/pf2/characterSheet'
import { CharacterArmory } from './CharacterArmory'

let mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const gurpsChar: GurpsCharacterSheet = {
  rulesetId: 'gurps',
  id: 'gurps-1',
  name: 'Conan',
  attributes: { strength: 16, dexterity: 14, intelligence: 10, health: 15 },
  derived: { hitPoints: 18, fatiguePoints: 15, basicSpeed: 7.0, basicMove: 7, dodge: 11 },
  skills: [],
  advantages: [],
  disadvantages: [],
  equipment: [],
  pointsTotal: 150,
}

const pf2Char: PF2CharacterSheet = {
  rulesetId: 'pf2',
  id: 'pf2-1',
  name: 'Elara',
  level: 5,
  class: 'Fighter',
  ancestry: 'Human',
  heritage: 'Versatile Heritage',
  background: 'Soldier',
  abilities: { strength: 16, dexterity: 14, constitution: 15, intelligence: 10, wisdom: 12, charisma: 11 },
  derived: { hitPoints: 45, armorClass: 18, speed: 25, fortitudeSave: 6, reflexSave: 5, willSave: 4, perception: 3 },
  classHP: 10,
  saveProficiencies: { fortitude: 'trained', reflex: 'untrained', will: 'untrained' },
  perceptionProficiency: 'untrained',
  armorProficiency: 'trained',
  skills: [],
  weapons: [],
  armor: null,
  shieldBonus: 0,
  feats: [],
  spells: null,
  spellcasters: [],
}

const renderArmory = (characters: Array<GurpsCharacterSheet | PF2CharacterSheet>, overrides?: Partial<{
  onLoadCharacters: () => void
  onDeleteCharacter: (id: string) => void
  onToggleFavorite: (id: string) => void
  onDuplicateCharacter: (char: GurpsCharacterSheet | PF2CharacterSheet) => void
}>) => {
  const onLoadCharacters = overrides?.onLoadCharacters ?? vi.fn()
  const onDeleteCharacter = overrides?.onDeleteCharacter ?? vi.fn()
  const onToggleFavorite = overrides?.onToggleFavorite ?? vi.fn()
  const onDuplicateCharacter = overrides?.onDuplicateCharacter ?? vi.fn()

  render(
    <MemoryRouter>
      <CharacterArmory
        characters={characters}
        onLoadCharacters={onLoadCharacters}
        onDeleteCharacter={onDeleteCharacter}
        onToggleFavorite={onToggleFavorite}
        onDuplicateCharacter={onDuplicateCharacter}
      />
    </MemoryRouter>,
  )

  return { onLoadCharacters, onDeleteCharacter, onToggleFavorite, onDuplicateCharacter }
}

describe('CharacterArmory', () => {
  beforeEach(() => {
    mockNavigate = vi.fn()
  })

  it('renders empty state when no characters', () => {
    renderArmory([])
    expect(screen.queryByText('No characters yet. Create your first!')).not.toBeNull()
  })

  it('calls onLoadCharacters on mount', () => {
    const onLoadCharacters = vi.fn()
    renderArmory([], { onLoadCharacters })
    expect(onLoadCharacters).toHaveBeenCalledTimes(1)
  })

  it('renders character cards when characters provided', () => {
    renderArmory([gurpsChar, pf2Char])
    expect(screen.queryByText('Conan')).not.toBeNull()
    expect(screen.queryByText('Elara')).not.toBeNull()
  })

  it('clicking card body navigates to /armory/:id (edit)', async () => {
    const user = userEvent.setup()
    renderArmory([gurpsChar])

    const card = screen.getByText('Conan').closest('.armory-character-card')
    const body = card?.querySelector('.armory-card-body')
    if (!body) throw new Error('Card body not found')

    await user.click(body)
    expect(mockNavigate).toHaveBeenCalledWith('/armory/gurps-1')
  })

  it('clicking "+ New Character" navigates to /armory/new', async () => {
    const user = userEvent.setup()
    renderArmory([])

    await user.click(screen.getByRole('button', { name: '+ New Character' }))

    expect(mockNavigate).toHaveBeenCalledWith('/armory/new')
  })

  it('clicking "← Back" navigates to /home', async () => {
    const user = userEvent.setup()
    renderArmory([])

    await user.click(screen.getByRole('button', { name: '← Back' }))
    expect(mockNavigate).toHaveBeenCalledWith('/home')
  })

  it('clicking Duplicate calls onDuplicateCharacter', async () => {
    const user = userEvent.setup()
    const onDuplicateCharacter = vi.fn()
    renderArmory([gurpsChar], { onDuplicateCharacter })

    await user.click(screen.getByRole('button', { name: 'Duplicate' }))
    expect(onDuplicateCharacter).toHaveBeenCalledWith(gurpsChar)
  })

  it('clicking Delete first time shows "Confirm?"', async () => {
    const user = userEvent.setup()
    renderArmory([gurpsChar])

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.queryByText('Confirm?')).not.toBeNull()
  })

  it('clicking Delete twice calls onDeleteCharacter', async () => {
    const user = userEvent.setup()
    const onDeleteCharacter = vi.fn()
    renderArmory([gurpsChar], { onDeleteCharacter })

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm?' }))

    expect(onDeleteCharacter).toHaveBeenCalledWith('gurps-1')
  })

  it('clicking favorite star calls onToggleFavorite', async () => {
    const user = userEvent.setup()
    const onToggleFavorite = vi.fn()
    renderArmory([gurpsChar], { onToggleFavorite })

    await user.click(screen.getByLabelText('Toggle favorite'))
    expect(onToggleFavorite).toHaveBeenCalledWith('gurps-1')
  })

  it('clicking explicit Edit button navigates to /armory/:id', async () => {
    const user = userEvent.setup()
    renderArmory([gurpsChar])

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(mockNavigate).toHaveBeenCalledWith('/armory/gurps-1')
  })

  it('GURPS character shows GURPS 4e badge, not Pathfinder', () => {
    renderArmory([gurpsChar])
    expect(screen.getByText('GURPS 4e')).not.toBeNull()
    expect(screen.queryByText('Pathfinder 2e')).toBeNull()
  })

  it('PF2 character shows Pathfinder 2e badge, not GURPS', () => {
    renderArmory([pf2Char])
    expect(screen.getByText('Pathfinder 2e')).not.toBeNull()
    expect(screen.queryByText('GURPS 4e')).toBeNull()
  })

  it('mixed characters show correct badges for each', () => {
    renderArmory([gurpsChar, pf2Char])
    expect(screen.getByText('GURPS 4e')).not.toBeNull()
    expect(screen.getByText('Pathfinder 2e')).not.toBeNull()
  })
})
