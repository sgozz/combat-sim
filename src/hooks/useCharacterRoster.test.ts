import { createElement } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ServerToClientMessage, CharacterSheet } from '../../shared/types'
import type { GurpsCharacterSheet } from '../../shared/rulesets/gurps/characterSheet'
import type { PF2CharacterSheet } from '../../shared/rulesets/pf2/characterSheet'
import { useCharacterRoster } from './useCharacterRoster'

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
  shieldHardness: 0,
  feats: [],
  spells: null,
  spellcasters: [],
}

const Harness = ({
  sendMessage,
  messageHandlers,
}: {
  sendMessage: (payload: unknown) => void
  messageHandlers: React.MutableRefObject<Array<(msg: ServerToClientMessage) => boolean>>
}) => {
  const { characters, loadCharacters, saveCharacter, deleteCharacter, toggleFavorite } = useCharacterRoster({
    sendMessage,
    messageHandlers,
  })

  return createElement(
    'div',
    null,
    createElement('button', { type: 'button', onClick: loadCharacters }, 'Load'),
    createElement('button', { type: 'button', onClick: () => saveCharacter(gurpsChar) }, 'Save'),
    createElement('button', { type: 'button', onClick: () => deleteCharacter('gurps-1') }, 'Delete'),
    createElement('button', { type: 'button', onClick: () => toggleFavorite('gurps-1') }, 'Favorite'),
    createElement('div', { 'data-testid': 'characters' }, JSON.stringify(characters)),
  )
}

const getCharacters = (): CharacterSheet[] => {
  const text = screen.getByTestId('characters').textContent
  return JSON.parse(text || '[]') as CharacterSheet[]
}

const sendServerMessage = (
  messageHandlers: React.MutableRefObject<Array<(msg: ServerToClientMessage) => boolean>>,
  message: ServerToClientMessage,
) => {
  act(() => {
    messageHandlers.current.forEach(handler => handler(message))
  })
}

describe('useCharacterRoster', () => {
  it('registers message handler on mount', () => {
    const sendMessage = vi.fn()
    const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
    render(createElement(Harness, { sendMessage, messageHandlers }))

    expect(messageHandlers.current).toHaveLength(1)
  })

  it('handles character_list → updates characters state', () => {
    const sendMessage = vi.fn()
    const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
    render(createElement(Harness, { sendMessage, messageHandlers }))

    sendServerMessage(messageHandlers, { type: 'character_list', characters: [gurpsChar, pf2Char] })

    expect(getCharacters()).toHaveLength(2)
  })

  it('handles character_saved → triggers loadCharacters', () => {
    const sendMessage = vi.fn()
    const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
    render(createElement(Harness, { sendMessage, messageHandlers }))

    sendServerMessage(messageHandlers, { type: 'character_saved', characterId: 'gurps-1' })

    expect(sendMessage).toHaveBeenCalledWith({ type: 'list_characters' })
  })

  it('handles character_deleted → removes character from state', () => {
    const sendMessage = vi.fn()
    const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
    render(createElement(Harness, { sendMessage, messageHandlers }))

    sendServerMessage(messageHandlers, { type: 'character_list', characters: [gurpsChar, pf2Char] })
    sendServerMessage(messageHandlers, { type: 'character_deleted', characterId: 'pf2-1' })

    expect(getCharacters()).toHaveLength(1)
    expect(getCharacters()[0]?.id).toBe('gurps-1')
  })

  it('loadCharacters sends list_characters message', async () => {
    const sendMessage = vi.fn()
    const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
    const user = userEvent.setup()
    render(createElement(Harness, { sendMessage, messageHandlers }))

    await user.click(screen.getByRole('button', { name: 'Load' }))

    expect(sendMessage).toHaveBeenCalledWith({ type: 'list_characters' })
  })

  it('saveCharacter sends save_character message', async () => {
    const sendMessage = vi.fn()
    const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
    const user = userEvent.setup()
    render(createElement(Harness, { sendMessage, messageHandlers }))

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(sendMessage).toHaveBeenCalledWith({ type: 'save_character', character: gurpsChar })
  })

  it('deleteCharacter sends delete_character message', async () => {
    const sendMessage = vi.fn()
    const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
    const user = userEvent.setup()
    render(createElement(Harness, { sendMessage, messageHandlers }))

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(sendMessage).toHaveBeenCalledWith({ type: 'delete_character', characterId: 'gurps-1' })
  })

  it('toggleFavorite sends save_character with toggled isFavorite', async () => {
    const sendMessage = vi.fn()
    const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
    const user = userEvent.setup()
    render(createElement(Harness, { sendMessage, messageHandlers }))

    sendServerMessage(messageHandlers, { type: 'character_list', characters: [gurpsChar] })
    await user.click(screen.getByRole('button', { name: 'Favorite' }))

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'save_character',
      character: { ...gurpsChar, isFavorite: true },
    })
  })

  it('cleans up handler on unmount', () => {
    const sendMessage = vi.fn()
    const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
    const { unmount } = render(createElement(Harness, { sendMessage, messageHandlers }))

    expect(messageHandlers.current).toHaveLength(1)
    unmount()
    expect(messageHandlers.current).toHaveLength(0)
  })
})
