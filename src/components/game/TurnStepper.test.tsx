import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TurnStepper } from './TurnStepper'
import { GameProvider } from '../../contexts/GameContext'
import type { MatchState, Player } from '../../../shared/types'

const mockPlayer: Player = { id: 'p1', name: 'Test', isBot: false, characterId: 'c1' }

function makeMatchState(overrides: Partial<MatchState> & { rulesetId: MatchState['rulesetId'] }): MatchState {
  return {
    id: 'm1',
    players: [mockPlayer],
    characters: [],
    combatants: [],
    activeTurnPlayerId: 'p1',
    round: 1,
    log: [],
    status: 'active',
    reachableHexes: [],
    ...overrides,
  } as MatchState
}

function renderWithContext(opts: {
  isPlayerTurn: boolean
  matchState: MatchState | null
}) {
  const value = {
    matchState: opts.matchState,
    player: mockPlayer,
    isPlayerTurn: opts.isPlayerTurn,
    selectedTargetId: null,
    logs: [],
    onAction: vi.fn(),
    onLeaveLobby: vi.fn(),
    onCombatantClick: vi.fn(),
  }
  return render(
    <GameProvider value={value}>
      <TurnStepper />
    </GameProvider>
  )
}

describe('TurnStepper', () => {
  describe('GURPS mode', () => {
    it('shows waiting message when not player turn', () => {
      renderWithContext({
        isPlayerTurn: false,
        matchState: makeMatchState({
          rulesetId: 'gurps',
          combatants: [{ playerId: 'p1', characterId: 'c1', currentHP: 10, position: { x: 0, z: 0 }, facing: 0, rulesetId: 'gurps', maneuver: null, inCloseCombatWith: null }] as MatchState['combatants'],
        }),
      })
      expect(screen.getByText("Opponent's turn...")).toBeInTheDocument()
    })

    it('shows maneuver selection prompt when no maneuver chosen', () => {
      renderWithContext({
        isPlayerTurn: true,
        matchState: makeMatchState({
          rulesetId: 'gurps',
          combatants: [{ playerId: 'p1', characterId: 'c1', currentHP: 10, position: { x: 0, z: 0 }, facing: 0, rulesetId: 'gurps', maneuver: null, inCloseCombatWith: null }] as MatchState['combatants'],
        }),
      })
      expect(screen.getByText(/Choose a maneuver/)).toBeInTheDocument()
    })

    it('shows execute prompt when maneuver chosen', () => {
      renderWithContext({
        isPlayerTurn: true,
        matchState: makeMatchState({
          rulesetId: 'gurps',
          combatants: [{ playerId: 'p1', characterId: 'c1', currentHP: 10, position: { x: 0, z: 0 }, facing: 0, rulesetId: 'gurps', maneuver: 'attack', inCloseCombatWith: null }] as MatchState['combatants'],
        }),
      })
      expect(screen.getByText('Attack')).toBeInTheDocument()
      expect(screen.getByText(/Execute or End Turn/)).toBeInTheDocument()
    })
  })

  describe('PF2 mode', () => {
    it('shows waiting message when not player turn', () => {
      renderWithContext({
        isPlayerTurn: false,
        matchState: makeMatchState({
          rulesetId: 'pf2',
          combatants: [{ playerId: 'p1', characterId: 'c1', currentHP: 10, position: { x: 0, z: 0 }, facing: 0, rulesetId: 'pf2', actionsRemaining: 3 }] as MatchState['combatants'],
        }),
      })
      expect(screen.getByText("Opponent's turn...")).toBeInTheDocument()
    })

    it('shows action count when player turn with actions remaining', () => {
      renderWithContext({
        isPlayerTurn: true,
        matchState: makeMatchState({
          rulesetId: 'pf2',
          combatants: [{ playerId: 'p1', characterId: 'c1', currentHP: 10, position: { x: 0, z: 0 }, facing: 0, rulesetId: 'pf2', actionsRemaining: 3 }] as MatchState['combatants'],
        }),
      })
      expect(screen.getByText(/3 actions remaining/)).toBeInTheDocument()
    })

    it('shows action count when player turn with 1 action remaining', () => {
      renderWithContext({
        isPlayerTurn: true,
        matchState: makeMatchState({
          rulesetId: 'pf2',
          combatants: [{ playerId: 'p1', characterId: 'c1', currentHP: 10, position: { x: 0, z: 0 }, facing: 0, rulesetId: 'pf2', actionsRemaining: 1 }] as MatchState['combatants'],
        }),
      })
      expect(screen.getByText(/1 action remaining/)).toBeInTheDocument()
    })

    it('shows no actions remaining when actionsRemaining is 0', () => {
      renderWithContext({
        isPlayerTurn: true,
        matchState: makeMatchState({
          rulesetId: 'pf2',
          combatants: [{ playerId: 'p1', characterId: 'c1', currentHP: 10, position: { x: 0, z: 0 }, facing: 0, rulesetId: 'pf2', actionsRemaining: 0 }] as MatchState['combatants'],
        }),
      })
      expect(screen.getByText(/No actions remaining/)).toBeInTheDocument()
    })
  })
})
