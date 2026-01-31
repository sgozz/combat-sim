import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WelcomeScreen } from './WelcomeScreen'

describe('WelcomeScreen', () => {
  const defaultProps = {
    onComplete: vi.fn(),
    authError: null,
    connectionState: 'connected' as const,
  }

  it('renders username input', () => {
    render(<WelcomeScreen {...defaultProps} />)
    expect(screen.getByLabelText('Choose your name')).not.toBeNull()
  })

  it('renders GURPS and PF2 ruleset cards', () => {
    render(<WelcomeScreen {...defaultProps} />)
    expect(screen.getByText('GURPS 4e')).not.toBeNull()
    expect(screen.getByText('Pathfinder 2e')).not.toBeNull()
  })

  it('Enter Arena button is disabled when no ruleset selected', () => {
    render(<WelcomeScreen {...defaultProps} />)
    const button = screen.getByRole('button', { name: 'Enter Arena' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('Enter Arena button is disabled when username is too short', async () => {
    const user = userEvent.setup()
    render(<WelcomeScreen {...defaultProps} />)

    await user.type(screen.getByLabelText('Choose your name'), 'ab')
    await user.click(screen.getByText('GURPS 4e'))

    const button = screen.getByRole('button', { name: 'Enter Arena' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('selecting GURPS highlights the card', async () => {
    const user = userEvent.setup()
    render(<WelcomeScreen {...defaultProps} />)

    const gurpsCard = screen.getByText('GURPS 4e').closest('button')
    expect(gurpsCard?.className).not.toContain('selected')

    await user.click(screen.getByText('GURPS 4e'))

    expect(gurpsCard?.className).toContain('selected')
  })

  it('selecting PF2 highlights the card', async () => {
    const user = userEvent.setup()
    render(<WelcomeScreen {...defaultProps} />)

    const pf2Card = screen.getByText('Pathfinder 2e').closest('button')
    expect(pf2Card?.className).not.toContain('selected')

    await user.click(screen.getByText('Pathfinder 2e'))

    expect(pf2Card?.className).toContain('selected')
  })

  it('switching rulesets updates selection', async () => {
    const user = userEvent.setup()
    render(<WelcomeScreen {...defaultProps} />)

    await user.click(screen.getByText('GURPS 4e'))
    const gurpsCard = screen.getByText('GURPS 4e').closest('button')
    const pf2Card = screen.getByText('Pathfinder 2e').closest('button')

    expect(gurpsCard?.className).toContain('selected')
    expect(pf2Card?.className).not.toContain('selected')

    await user.click(screen.getByText('Pathfinder 2e'))

    expect(gurpsCard?.className).not.toContain('selected')
    expect(pf2Card?.className).toContain('selected')
  })

  it('Enter Arena button enabled when username and ruleset selected', async () => {
    const user = userEvent.setup()
    render(<WelcomeScreen {...defaultProps} />)

    await user.type(screen.getByLabelText('Choose your name'), 'TestUser')
    await user.click(screen.getByText('GURPS 4e'))

    const button = screen.getByRole('button', { name: 'Enter Arena' }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
  })

  it('submitting form calls onComplete with username and ruleset (GURPS)', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<WelcomeScreen {...defaultProps} onComplete={onComplete} />)

    await user.type(screen.getByLabelText('Choose your name'), 'TestUser')
    await user.click(screen.getByText('GURPS 4e'))
    await user.click(screen.getByRole('button', { name: 'Enter Arena' }))

    expect(onComplete).toHaveBeenCalledWith('TestUser', 'gurps')
  })

  it('submitting form calls onComplete with username and ruleset (PF2)', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<WelcomeScreen {...defaultProps} onComplete={onComplete} />)

    await user.type(screen.getByLabelText('Choose your name'), 'TestUser')
    await user.click(screen.getByText('Pathfinder 2e'))
    await user.click(screen.getByRole('button', { name: 'Enter Arena' }))

    expect(onComplete).toHaveBeenCalledWith('TestUser', 'pf2')
  })

  it('validation prevents submission with username less than 3 characters', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<WelcomeScreen {...defaultProps} onComplete={onComplete} />)

    await user.type(screen.getByLabelText('Choose your name'), 'ab')
    await user.click(screen.getByText('GURPS 4e'))

    const button = screen.getByRole('button', { name: 'Enter Arena' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('validation prevents submission when no ruleset selected', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<WelcomeScreen {...defaultProps} onComplete={onComplete} />)

    await user.type(screen.getByLabelText('Choose your name'), 'TestUser')

    const button = screen.getByRole('button', { name: 'Enter Arena' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('displays authError when provided', () => {
    render(<WelcomeScreen {...defaultProps} authError="Connection failed" />)
    expect(screen.getByText('Connection failed')).not.toBeNull()
  })

  it('shows connecting state', () => {
    render(<WelcomeScreen {...defaultProps} connectionState="connecting" />)
    expect(screen.getAllByText('Connecting...').length).toBeGreaterThan(0)
  })

  it('disables form when connecting', () => {
    render(<WelcomeScreen {...defaultProps} connectionState="connecting" />)

    const input = screen.getByLabelText('Choose your name') as HTMLInputElement
    const gurpsCard = screen.getByText('GURPS 4e').closest('button') as HTMLButtonElement
    const pf2Card = screen.getByText('Pathfinder 2e').closest('button') as HTMLButtonElement

    expect(input.disabled).toBe(true)
    expect(gurpsCard.disabled).toBe(true)
    expect(pf2Card.disabled).toBe(true)
  })

  it('shows How to Play button', () => {
    render(<WelcomeScreen {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'How to Play' })).not.toBeNull()
  })
})
