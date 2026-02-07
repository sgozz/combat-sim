import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TurnStepper } from './TurnStepper'

describe('TurnStepper', () => {
  describe('GURPS mode', () => {
    it('shows waiting message when not player turn', () => {
      render(<TurnStepper isMyTurn={false} currentManeuver={null} rulesetId="gurps" actionsRemaining={0} />)
      expect(screen.getByText("Opponent's turn...")).toBeInTheDocument()
    })

    it('shows maneuver selection prompt when no maneuver chosen', () => {
      render(<TurnStepper isMyTurn={true} currentManeuver={null} rulesetId="gurps" actionsRemaining={0} />)
      expect(screen.getByText(/Choose a maneuver/)).toBeInTheDocument()
    })

    it('shows execute prompt when maneuver chosen', () => {
      render(<TurnStepper isMyTurn={true} currentManeuver="attack" rulesetId="gurps" actionsRemaining={0} />)
      expect(screen.getByText('Attack')).toBeInTheDocument()
      expect(screen.getByText(/Execute or End Turn/)).toBeInTheDocument()
    })
  })

  describe('PF2 mode', () => {
    it('shows waiting message when not player turn', () => {
      render(<TurnStepper isMyTurn={false} currentManeuver={null} rulesetId="pf2" actionsRemaining={3} />)
      expect(screen.getByText("Opponent's turn...")).toBeInTheDocument()
    })

    it('shows action count when player turn with actions remaining', () => {
      render(<TurnStepper isMyTurn={true} currentManeuver={null} rulesetId="pf2" actionsRemaining={3} />)
      expect(screen.getByText(/3 actions remaining/)).toBeInTheDocument()
    })

    it('shows action count when player turn with 1 action remaining', () => {
      render(<TurnStepper isMyTurn={true} currentManeuver={null} rulesetId="pf2" actionsRemaining={1} />)
      expect(screen.getByText(/1 action remaining/)).toBeInTheDocument()
    })

    it('shows no actions remaining when actionsRemaining is 0', () => {
      render(<TurnStepper isMyTurn={true} currentManeuver={null} rulesetId="pf2" actionsRemaining={0} />)
      expect(screen.getByText(/No actions remaining/)).toBeInTheDocument()
    })
  })
})
