import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { GurpsCharacterSheet } from '../../../shared/rulesets/gurps/characterSheet'
import type { PF2CharacterSheet } from '../../../shared/rulesets/pf2/characterSheet'
import { CharacterEditor } from './CharacterEditor'

let mockNavigate = vi.fn()
let mockParams: { id?: string } = {}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
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

const renderEditor = (characters: Array<GurpsCharacterSheet | PF2CharacterSheet>) => {
  const onSaveCharacter = vi.fn()
  render(
    <MemoryRouter>
      <CharacterEditor characters={characters} onSaveCharacter={onSaveCharacter} />
    </MemoryRouter>,
  )
  return { onSaveCharacter }
}

describe('CharacterEditor', () => {
  beforeEach(() => {
    mockNavigate = vi.fn()
    mockParams = { id: 'new' }
    window.history.pushState({}, '', '/armory/new')
  })

  describe('new character', () => {
    it('creates new GURPS character from ?ruleset=gurps', async () => {
      window.history.pushState({}, '', '/armory/new?ruleset=gurps')
      renderEditor([])

      await screen.findByDisplayValue('New Character')
      expect(screen.queryByText('GURPS')).not.toBeNull()
    })

    it('creates new PF2 character from ?ruleset=pf2', async () => {
      window.history.pushState({}, '', '/armory/new?ruleset=pf2')
      renderEditor([])

      await screen.findByDisplayValue('New Character')
      expect(screen.queryByText('PF2')).not.toBeNull()
    })

    it('shows Loading... initially then renders editor', async () => {
      renderEditor([])
      const loadingOrEditor = screen.queryByText('Loading...') ?? screen.queryByDisplayValue('New Character')
      expect(loadingOrEditor).not.toBeNull()
      await screen.findByDisplayValue('New Character')
    })

    it('Save button calls onSaveCharacter and navigates to /armory', async () => {
      const user = userEvent.setup()
      const { onSaveCharacter } = renderEditor([])

      await screen.findByDisplayValue('New Character')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(onSaveCharacter).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith('/armory')
    })

    it('Cancel button navigates to /armory', async () => {
      const user = userEvent.setup()
      renderEditor([])

      await screen.findByDisplayValue('New Character')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(mockNavigate).toHaveBeenCalledWith('/armory')
    })
  })

  describe('edit existing character', () => {
    it('shows Loading... when characters array is empty (not yet loaded)', () => {
      mockParams = { id: 'gurps-1' }
      renderEditor([])
      expect(screen.queryByText('Loading...')).not.toBeNull()
    })

    it('loads character when characters become available', async () => {
      mockParams = { id: 'gurps-1' }
      const onSaveCharacter = vi.fn()
      const { rerender } = render(
        <MemoryRouter>
          <CharacterEditor characters={[]} onSaveCharacter={onSaveCharacter} />
        </MemoryRouter>,
      )

      expect(screen.queryByText('Loading...')).not.toBeNull()

      rerender(
        <MemoryRouter>
          <CharacterEditor characters={[gurpsChar]} onSaveCharacter={onSaveCharacter} />
        </MemoryRouter>,
      )

      await screen.findByDisplayValue('Conan')
    })

    it('does NOT redirect when characters is empty (race condition fix)', () => {
      mockParams = { id: 'gurps-1' }
      renderEditor([])
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('redirects to /armory if character not found after characters loaded', async () => {
      mockParams = { id: 'missing' }
      renderEditor([gurpsChar])

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/armory')
      })
    })

    it('editing name updates character state', async () => {
      mockParams = { id: 'gurps-1' }
      const user = userEvent.setup()
      renderEditor([gurpsChar])

      const input = await screen.findByDisplayValue('Conan')
      await user.clear(input)
      await user.type(input, 'Conan Updated')

      expect((input as HTMLInputElement).value).toBe('Conan Updated')
    })
  })
})
