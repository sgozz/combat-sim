import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateMatchDialog } from './CreateMatchDialog'

describe('CreateMatchDialog', () => {
  const defaultProps = {
    username: 'TestUser',
    preferredRulesetId: 'gurps' as const,
    onClose: vi.fn(),
    onCreateMatch: vi.fn(),
  }

  it('renders match name input with default value', () => {
    render(<CreateMatchDialog {...defaultProps} />)
    const input = screen.getByDisplayValue("TestUser's Battle") as HTMLInputElement
    expect(input).not.toBeNull()
  })

  it('shows GURPS badge when preferredRulesetId is gurps', () => {
    render(<CreateMatchDialog {...defaultProps} preferredRulesetId="gurps" />)
    expect(screen.getByText('GURPS 4e')).not.toBeNull()
  })

  it('shows PF2 badge when preferredRulesetId is pf2', () => {
    render(<CreateMatchDialog {...defaultProps} preferredRulesetId="pf2" />)
    expect(screen.getByText('Pathfinder 2e')).not.toBeNull()
  })

  it('GURPS badge has correct CSS class', () => {
    render(<CreateMatchDialog {...defaultProps} preferredRulesetId="gurps" />)
    const badge = screen.getByText('GURPS 4e')
    expect(badge.className).toContain('ruleset-gurps')
  })

  it('PF2 badge has correct CSS class', () => {
    render(<CreateMatchDialog {...defaultProps} preferredRulesetId="pf2" />)
    const badge = screen.getByText('Pathfinder 2e')
    expect(badge.className).toContain('ruleset-pf2')
  })

  it('shows hint text for GURPS', () => {
    render(<CreateMatchDialog {...defaultProps} preferredRulesetId="gurps" />)
    expect(screen.getByText('This match will use GURPS 4e')).not.toBeNull()
  })

  it('shows hint text for PF2', () => {
    render(<CreateMatchDialog {...defaultProps} preferredRulesetId="pf2" />)
    expect(screen.getByText('This match will use Pathfinder 2e')).not.toBeNull()
  })

  it('does not render toggle buttons for ruleset selection', () => {
    render(<CreateMatchDialog {...defaultProps} />)
    
    const toggleButtons = screen.queryAllByRole('button').filter(btn => 
      btn.textContent === 'GURPS' || btn.textContent === 'Pathfinder 2e'
    )
    expect(toggleButtons.length).toBe(0)
  })

  it('max players slider defaults to 4', () => {
    render(<CreateMatchDialog {...defaultProps} />)
    expect(screen.getByText('Max Players:')).not.toBeNull()
    expect(screen.getByText('4', { selector: '.cmd-label-value' })).not.toBeNull()
  })

  it('changing max players updates display', () => {
    render(<CreateMatchDialog {...defaultProps} />)

    const slider = screen.getByRole('slider') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '6' } })

    expect(screen.getByText('6', { selector: '.cmd-label-value' })).not.toBeNull()
  })

  it('visibility defaults to Private', () => {
    render(<CreateMatchDialog {...defaultProps} />)
    const privateButton = screen.getByRole('button', { name: 'Private' })
    expect(privateButton.className).toContain('cmd-toggle-active')
  })

  it('switching to Public updates visibility', async () => {
    const user = userEvent.setup()
    render(<CreateMatchDialog {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'Public' }))

    const publicButton = screen.getByRole('button', { name: 'Public' })
    expect(publicButton.className).toContain('cmd-toggle-active')
  })

  it('clicking Cancel calls onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<CreateMatchDialog {...defaultProps} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('clicking Create Match calls onCreateMatch without rulesetId', async () => {
    const user = userEvent.setup()
    const onCreateMatch = vi.fn()
    render(<CreateMatchDialog {...defaultProps} onCreateMatch={onCreateMatch} />)

    await user.click(screen.getByRole('button', { name: 'Create Match' }))

    expect(onCreateMatch).toHaveBeenCalledWith("TestUser's Battle", 4, false, undefined)
    expect(onCreateMatch).toHaveBeenCalledTimes(1)
  })

  it('submitting with custom name and settings', async () => {
    const user = userEvent.setup()
    const onCreateMatch = vi.fn()
    render(<CreateMatchDialog {...defaultProps} onCreateMatch={onCreateMatch} />)

    const input = screen.getByLabelText('Match Name')
    await user.clear(input)
    await user.type(input, 'Epic Battle')

    const slider = screen.getByRole('slider') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '5' } })

    await user.click(screen.getByRole('button', { name: 'Public' }))
    await user.click(screen.getByRole('button', { name: 'Create Match' }))

    expect(onCreateMatch).toHaveBeenCalledWith('Epic Battle', 5, true, undefined)
  })

  it('Create Match button is disabled when name is empty', async () => {
    const user = userEvent.setup()
    render(<CreateMatchDialog {...defaultProps} />)

    const input = screen.getByLabelText('Match Name')
    await user.clear(input)

    const createButton = screen.getByRole('button', { name: 'Create Match' }) as HTMLButtonElement
    expect(createButton.disabled).toBe(true)
  })

  it('pressing Escape closes dialog', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<CreateMatchDialog {...defaultProps} onClose={onClose} />)

    await user.keyboard('[Escape]')

    expect(onClose).toHaveBeenCalled()
  })

  it('shows creating state after submit', async () => {
    const user = userEvent.setup()
    const onCreateMatch = vi.fn()
    render(<CreateMatchDialog {...defaultProps} onCreateMatch={onCreateMatch} />)

    await user.click(screen.getByRole('button', { name: 'Create Match' }))

    expect(screen.getByText('Creating…')).not.toBeNull()
  })
})
