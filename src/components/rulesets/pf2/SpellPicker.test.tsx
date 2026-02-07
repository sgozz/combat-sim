import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SpellPicker } from './SpellPicker'
import type { SpellCaster } from '../../../../shared/rulesets/pf2/types'

const makeSpellcaster = (overrides?: Partial<SpellCaster>): SpellCaster => ({
  name: 'Arcane Prepared Spells',
  tradition: 'arcane',
  type: 'prepared',
  proficiency: 4,
  slots: [
    { level: 0, total: 5, used: 0 },
    { level: 1, total: 3, used: 0 },
    { level: 3, total: 2, used: 0 },
  ],
  focusPool: { max: 0, current: 0 },
  knownSpells: [
    { level: 0, spells: ['Electric Arc', 'Ray of Frost'] },
    { level: 1, spells: ['Magic Missile', 'Fear'] },
    { level: 3, spells: ['Fireball'] },
  ],
  ...overrides,
})

describe('SpellPicker', () => {
  const defaultProps = {
    spellcaster: makeSpellcaster(),
    onSelectSpell: vi.fn(),
    onClose: vi.fn(),
    actionsRemaining: 3,
  }

  it('renders spells grouped by level', () => {
    render(<SpellPicker {...defaultProps} />)

    expect(screen.getByText(/Cantrips/)).not.toBeNull()
    expect(screen.getByText(/Level 1/)).not.toBeNull()
    expect(screen.getByText(/Level 3/)).not.toBeNull()

    expect(screen.getByText('Electric Arc')).not.toBeNull()
    expect(screen.getByText('Ray of Frost')).not.toBeNull()
    expect(screen.getByText('Magic Missile')).not.toBeNull()
    expect(screen.getByText('Fear')).not.toBeNull()
    expect(screen.getByText('Fireball')).not.toBeNull()
  })

  it('shows slot count per level', () => {
    render(<SpellPicker {...defaultProps} />)

    // Cantrips show ∞
    expect(screen.getByText(/Cantrips \(∞\)/)).not.toBeNull()
    // Level 1 shows 3/3
    expect(screen.getByText(/Level 1 \(3\/3\)/)).not.toBeNull()
    // Level 3 shows 2/2
    expect(screen.getByText(/Level 3 \(2\/2\)/)).not.toBeNull()
  })

  it('disables spells when no slots available', () => {
    const noSlots = makeSpellcaster({
      slots: [
        { level: 0, total: 5, used: 0 },
        { level: 1, total: 3, used: 3 }, // all used
        { level: 3, total: 2, used: 0 },
      ],
    })

    render(<SpellPicker {...defaultProps} spellcaster={noSlots} />)

    // Magic Missile is level 1, slots exhausted → disabled
    const magicMissile = screen.getByText('Magic Missile').closest('button')!
    expect(magicMissile.disabled).toBe(true)

    // Fireball is level 3, slots available → enabled
    const fireball = screen.getByText('Fireball').closest('button')!
    expect(fireball.disabled).toBe(false)
  })

  it('disables spells when insufficient actions', () => {
    // Most spells cost 2 actions
    render(<SpellPicker {...defaultProps} actionsRemaining={1} />)

    // All spells cost 2 actions in SPELL_DATABASE, so all should be disabled
    const magicMissile = screen.getByText('Magic Missile').closest('button')!
    expect(magicMissile.disabled).toBe(true)

    const fireball = screen.getByText('Fireball').closest('button')!
    expect(fireball.disabled).toBe(true)
  })

  it('shows heighten options when spell with heighten is clicked', () => {
    render(<SpellPicker {...defaultProps} />)

    // Fireball has heighten data
    const fireball = screen.getByText('Fireball')
    fireEvent.click(fireball)

    // Should show heighten level selection
    expect(screen.getByText(/Cast Fireball at level/)).not.toBeNull()
    // Back button
    expect(screen.getByText(/Back to spell list/)).not.toBeNull()
  })

  it('calls onSelectSpell with spell name and level for non-heightenable spells', () => {
    const onSelectSpell = vi.fn()
    render(<SpellPicker {...defaultProps} onSelectSpell={onSelectSpell} />)

    // Fear has no heighten, so clicking should immediately call onSelectSpell
    const fear = screen.getByText('Fear')
    fireEvent.click(fear)

    expect(onSelectSpell).toHaveBeenCalledWith('Fear', 1)
  })

  it('calls onSelectSpell with chosen heighten level', () => {
    const onSelectSpell = vi.fn()
    render(<SpellPicker {...defaultProps} onSelectSpell={onSelectSpell} />)

    // Click Fireball to open heighten options
    fireEvent.click(screen.getByText('Fireball'))

    // Select level 3
    const level3Btn = screen.getByText(/Level 3/).closest('button')!
    fireEvent.click(level3Btn)

    expect(onSelectSpell).toHaveBeenCalledWith('Fireball', 3)
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<SpellPicker {...defaultProps} onClose={onClose} />)

    const closeBtn = screen.getByText('✕')
    fireEvent.click(closeBtn)

    expect(onClose).toHaveBeenCalled()
  })

  it('displays caster name and tradition in header', () => {
    render(<SpellPicker {...defaultProps} />)

    expect(screen.getByText(/Arcane Prepared Spells - arcane/)).not.toBeNull()
  })

  it('shows heighten indicator (↑) for heightenable spells', () => {
    render(<SpellPicker {...defaultProps} />)

    // Fireball and Electric Arc have heighten, Fear does not
    const fireball = screen.getByText('Fireball').closest('button')!
    expect(fireball.innerHTML).toContain('↑')

    // Fear should not have the heighten indicator
    const fear = screen.getByText('Fear').closest('button')!
    expect(fear.innerHTML).not.toContain('↑')
  })

  it('returns to spell list from heighten view via back button', () => {
    render(<SpellPicker {...defaultProps} />)

    // Open heighten view for Fireball
    fireEvent.click(screen.getByText('Fireball'))
    expect(screen.getByText(/Cast Fireball at level/)).not.toBeNull()

    // Click back
    fireEvent.click(screen.getByText(/Back to spell list/))

    // Should be back to spell list
    expect(screen.getByText('Magic Missile')).not.toBeNull()
    expect(screen.queryByText(/Cast Fireball at level/)).toBeNull()
  })
})
