import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MatchEndOverlay } from './MatchEndOverlay'

describe('MatchEndOverlay', () => {
  it('shows nothing when match is not finished', () => {
    const { container } = render(
      <MatchEndOverlay
        matchStatus="active"
        winnerName={undefined}
        currentPlayerName="Alice"
        onReturnToDashboard={() => {}}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows victory message when player wins', () => {
    render(
      <MatchEndOverlay
        matchStatus="finished"
        winnerName="Alice"
        currentPlayerName="Alice"
        onReturnToDashboard={() => {}}
      />
    )
    expect(screen.getByText('VICTORY!')).toBeInTheDocument()
    expect(screen.getByText(/You won/)).toBeInTheDocument()
  })

  it('shows defeat message when player loses', () => {
    render(
      <MatchEndOverlay
        matchStatus="finished"
        winnerName="Bob"
        currentPlayerName="Alice"
        onReturnToDashboard={() => {}}
      />
    )
    expect(screen.getByText('DEFEAT')).toBeInTheDocument()
    expect(screen.getByText(/Bob won/)).toBeInTheDocument()
  })

  it('shows draw message when no winner', () => {
    render(
      <MatchEndOverlay
        matchStatus="finished"
        winnerName={undefined}
        currentPlayerName="Alice"
        onReturnToDashboard={() => {}}
      />
    )
    expect(screen.getByText('MATCH ENDED')).toBeInTheDocument()
    expect(screen.getByText(/Draw/)).toBeInTheDocument()
  })

  it('calls onReturnToDashboard when button clicked', () => {
    const mockReturn = vi.fn()
    render(
      <MatchEndOverlay
        matchStatus="finished"
        winnerName="Alice"
        currentPlayerName="Alice"
        onReturnToDashboard={mockReturn}
      />
    )
    fireEvent.click(screen.getByText('Return to Dashboard'))
    expect(mockReturn).toHaveBeenCalledOnce()
  })
})
