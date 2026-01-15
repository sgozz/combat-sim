import { useEffect, useCallback } from 'react'
import type { MatchState, CombatActionPayload, ManeuverType } from '../../shared/types'

const MANEUVER_KEYS: Record<string, ManeuverType> = {
  '1': 'do_nothing',
  '2': 'move',
  '3': 'aim',
  '4': 'attack',
  '5': 'all_out_attack',
  '6': 'all_out_defense',
  '7': 'move_and_attack',
}

type UseKeyboardNavigationProps = {
  matchState: MatchState | null
  selectedTargetId: string | null
  moveTarget: unknown
  isMyTurn: boolean
  hasManeuver: boolean
  onAction: (action: string, payload?: CombatActionPayload) => void
  onCycleTarget: () => void
  onCancelMove: () => void
}

export function useKeyboardNavigation({
  matchState,
  selectedTargetId,
  moveTarget,
  isMyTurn,
  hasManeuver,
  onAction,
  onCycleTarget,
  onCancelMove,
}: UseKeyboardNavigationProps) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if typing in an input field
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    // Ignore if match is finished or not active
    if (!matchState || matchState.status === 'finished') {
      return
    }

    const key = event.key.toLowerCase()

    // ESC - Cancel move
    if (key === 'escape') {
      event.preventDefault()
      onCancelMove()
      return
    }

    // TAB - Cycle through enemies
    if (key === 'tab') {
      event.preventDefault()
      onCycleTarget()
      return
    }

    // Only allow action keys if it's player's turn
    if (!isMyTurn) return

    // Maneuver selection phase (no maneuver selected yet)
    if (!hasManeuver) {
      const maneuver = MANEUVER_KEYS[event.key]
      if (maneuver) {
        event.preventDefault()
        onAction('select_maneuver', { type: 'select_maneuver', maneuver })
      }
      return
    }

    // Action phase (maneuver already selected)
    switch (key) {
      case '1': // Attack
        event.preventDefault()
        if (selectedTargetId) {
          onAction('attack', { type: 'attack', targetId: selectedTargetId })
        }
        break

      case '2': // Defend
        event.preventDefault()
        onAction('defend', { type: 'defend' })
        break

      case 'q': // Turn Left
        event.preventDefault()
        onAction('turn_left', { type: 'turn_left' })
        break

      case 'e': // Turn Right
        event.preventDefault()
        onAction('turn_right', { type: 'turn_right' })
        break

      case '3': // Move
        event.preventDefault()
        onAction('move_click')
        break

      case '4': // End Turn
      case 'enter':
        event.preventDefault()
        onAction('end_turn', { type: 'end_turn' })
        break

      case ' ': // Space - Confirm action (move if selected, else end turn)
        event.preventDefault()
        if (moveTarget) {
          onAction('move_click')
        } else {
          onAction('end_turn', { type: 'end_turn' })
        }
        break
    }
  }, [matchState, isMyTurn, hasManeuver, selectedTargetId, moveTarget, onAction, onCycleTarget, onCancelMove])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

// Keyboard hints for UI display
export const KEYBOARD_HINTS = {
  // Maneuver selection phase
  maneuvers: {
    do_nothing: '1',
    move: '2',
    aim: '3',
    attack: '4',
    all_out_attack: '5',
    all_out_defense: '6',
    move_and_attack: '7',
  },
  // Action phase
  actions: {
    attack: '1',
    defend: '2',
    turnLeft: 'Q',
    turnRight: 'E',
    move: '3',
    endTurn: '4',
    confirm: 'Space',
    cancel: 'Esc',
    cycleTarget: 'Tab',
  },
} as const
