import { useState, useCallback, useEffect, type MutableRefObject } from 'react'
import type { CharacterSheet, ServerToClientMessage } from '../../shared/types'

type UseCharacterRosterOptions = {
  sendMessage: (payload: unknown) => void
  messageHandlers: MutableRefObject<Array<(msg: ServerToClientMessage) => boolean>>
}

export const useCharacterRoster = ({ sendMessage, messageHandlers }: UseCharacterRosterOptions) => {
  const [characters, setCharacters] = useState<CharacterSheet[]>([])

  const loadCharacters = useCallback(() => {
    sendMessage({ type: 'list_characters' })
  }, [sendMessage])

  useEffect(() => {
    const handler = (msg: ServerToClientMessage): boolean => {
      switch (msg.type) {
        case 'character_list':
          setCharacters(msg.characters)
          return true
        case 'character_saved': {
          loadCharacters()
          return true
        }
        case 'character_deleted': {
          setCharacters(prev => prev.filter(c => c.id !== msg.characterId))
          return true
        }
        case 'character_synced_from_pathbuilder': {
          // Replace the synced character in the list
          setCharacters(prev => prev.map(c => 
            c.id === msg.character.id ? msg.character : c
          ))
          return true
        }
        default:
          return false
      }
    }

    messageHandlers.current.push(handler)
    return () => {
      messageHandlers.current = messageHandlers.current.filter(h => h !== handler)
    }
  }, [messageHandlers, sendMessage, loadCharacters])

  const saveCharacter = useCallback((character: CharacterSheet) => {
    sendMessage({ type: 'save_character', character })
  }, [sendMessage])

  const deleteCharacter = useCallback((characterId: string) => {
    sendMessage({ type: 'delete_character', characterId })
  }, [sendMessage])

  const toggleFavorite = useCallback((characterId: string) => {
    const character = characters.find(c => c.id === characterId)
    if (!character) return
    const updated = { ...character, isFavorite: !character.isFavorite }
    sendMessage({ type: 'save_character', character: updated })
  }, [characters, sendMessage])

  return {
    characters,
    loadCharacters,
    saveCharacter,
    deleteCharacter,
    toggleFavorite,
  }
}
