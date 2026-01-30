import { useState, useCallback } from 'react'
import type { CharacterSheet } from '../../shared/types'

export const useCharacterRoster = () => {
  const [characters] = useState<CharacterSheet[]>([])

  const loadCharacters = useCallback(() => {
    // Will be implemented in Phase 3
  }, [])

  const saveCharacter = useCallback((_character: CharacterSheet) => {
    // Will be implemented in Phase 3
  }, [])

  const deleteCharacter = useCallback((_characterId: string) => {
    // Will be implemented in Phase 3
  }, [])

  const toggleFavorite = useCallback((_characterId: string) => {
    // Will be implemented in Phase 3
  }, [])

  return {
    characters,
    loadCharacters,
    saveCharacter,
    deleteCharacter,
    toggleFavorite,
  }
}
