import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { GurpsCharacterSheet } from '../../../shared/rulesets/gurps/characterSheet'
import type { PF2CharacterSheet } from '../../../shared/rulesets/pf2/characterSheet'
import { CharacterPicker } from './CharacterPicker'

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

describe('CharacterPicker', () => {
  it('shows empty state for no matching characters', () => {
    render(
      <CharacterPicker
        characters={[]}
        rulesetId="gurps"
        selectedCharacterId={null}
        onSelect={() => undefined}
        onQuickCreate={() => undefined}
      />,
    )

    expect(screen.queryByText('No characters available for GURPS')).not.toBeNull()
  })

  it('filters characters by GURPS ruleset', () => {
    render(
      <CharacterPicker
        characters={[gurpsChar, pf2Char]}
        rulesetId="gurps"
        selectedCharacterId={null}
        onSelect={() => undefined}
        onQuickCreate={() => undefined}
      />,
    )

    expect(screen.queryByText('Conan')).not.toBeNull()
    expect(screen.queryByText('Elara')).toBeNull()
  })

  it('filters characters by PF2 ruleset', () => {
    render(
      <CharacterPicker
        characters={[gurpsChar, pf2Char]}
        rulesetId="pf2"
        selectedCharacterId={null}
        onSelect={() => undefined}
        onQuickCreate={() => undefined}
      />,
    )

    expect(screen.queryByText('Elara')).not.toBeNull()
    expect(screen.queryByText('Conan')).toBeNull()
  })

  it('clicking character card calls onSelect with character id', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <CharacterPicker
        characters={[gurpsChar]}
        rulesetId="gurps"
        selectedCharacterId={null}
        onSelect={onSelect}
        onQuickCreate={() => undefined}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Conan/ }))
    expect(onSelect).toHaveBeenCalledWith('gurps-1')
  })

  it('selected character shows checkmark', () => {
    render(
      <CharacterPicker
        characters={[gurpsChar]}
        rulesetId="gurps"
        selectedCharacterId="gurps-1"
        onSelect={() => undefined}
        onQuickCreate={() => undefined}
      />,
    )

    expect(screen.queryByLabelText('Selected')).not.toBeNull()
  })

  it('clicking Quick Create calls onQuickCreate', async () => {
    const user = userEvent.setup()
    const onQuickCreate = vi.fn()
    render(
      <CharacterPicker
        characters={[gurpsChar]}
        rulesetId="gurps"
        selectedCharacterId={null}
        onSelect={() => undefined}
        onQuickCreate={onQuickCreate}
      />,
    )

    await user.click(screen.getByRole('button', { name: '+ Quick Create' }))
    expect(onQuickCreate).toHaveBeenCalledTimes(1)
  })

  it('clicking Create Character (empty) calls onQuickCreate', async () => {
    const user = userEvent.setup()
    const onQuickCreate = vi.fn()
    render(
      <CharacterPicker
        characters={[]}
        rulesetId="gurps"
        selectedCharacterId={null}
        onSelect={() => undefined}
        onQuickCreate={onQuickCreate}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Create Character' }))
    expect(onQuickCreate).toHaveBeenCalledTimes(1)
  })
})
