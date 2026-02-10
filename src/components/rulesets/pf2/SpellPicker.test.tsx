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

  it('renders spells grouped by level via tabs', () => {
    render(<SpellPicker {...defaultProps} />)

    expect(screen.getByText(/Cantrips/)).not.toBeNull()
    expect(screen.getByText(/Level 1/)).not.toBeNull()
    expect(screen.getByText(/Level 3/)).not.toBeNull()

    expect(screen.getByText('Electric Arc')).not.toBeNull()
    expect(screen.getByText('Ray of Frost')).not.toBeNull()

    fireEvent.click(screen.getByText(/Level 1/))
    expect(screen.getByText('Magic Missile')).not.toBeNull()
    expect(screen.getByText('Fear')).not.toBeNull()

    fireEvent.click(screen.getByText(/Level 3/))
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
        { level: 1, total: 3, used: 3 },
        { level: 3, total: 2, used: 0 },
      ],
    })

    render(<SpellPicker {...defaultProps} spellcaster={noSlots} />)

    fireEvent.click(screen.getByText(/Level 1/))
    const magicMissile = screen.getByText('Magic Missile').closest('button')!
    expect(magicMissile.disabled).toBe(true)

    fireEvent.click(screen.getByText(/Level 3/))
    const fireball = screen.getByText('Fireball').closest('button')!
    expect(fireball.disabled).toBe(false)
  })

  it('disables spells when insufficient actions', () => {
    render(<SpellPicker {...defaultProps} actionsRemaining={1} />)

    fireEvent.click(screen.getByText(/Level 1/))
    const magicMissile = screen.getByText('Magic Missile').closest('button')!
    expect(magicMissile.disabled).toBe(true)

    fireEvent.click(screen.getByText(/Level 3/))
    const fireball = screen.getByText('Fireball').closest('button')!
    expect(fireball.disabled).toBe(true)
  })

  it('shows inline heighten options when spell with heighten is clicked', () => {
    render(<SpellPicker {...defaultProps} />)

    fireEvent.click(screen.getByText(/Level 3/))
    const fireball = screen.getByText('Fireball')
    fireEvent.click(fireball)

    expect(screen.getByText(/Cast Fireball at level/)).not.toBeNull()
  })

  it('calls onSelectSpell with spell name and level for non-heightenable spells', () => {
    const onSelectSpell = vi.fn()
    render(<SpellPicker {...defaultProps} onSelectSpell={onSelectSpell} />)

    fireEvent.click(screen.getByText(/Level 1/))
    const fear = screen.getByText('Fear')
    fireEvent.click(fear)

    expect(onSelectSpell).toHaveBeenCalledWith('Fear', 1)
  })

  it('calls onSelectSpell with chosen heighten level', () => {
    const onSelectSpell = vi.fn()
    render(<SpellPicker {...defaultProps} onSelectSpell={onSelectSpell} />)

    fireEvent.click(screen.getByText(/Level 3/))
    fireEvent.click(screen.getByText('Fireball'))

    const lv3Btn = screen.getByText('Lv 3').closest('button')!
    fireEvent.click(lv3Btn)

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

    const electricArc = screen.getByText('Electric Arc').closest('button')!
    expect(electricArc.innerHTML).toContain('↑')

    fireEvent.click(screen.getByText(/Level 1/))
    const fear = screen.getByText('Fear').closest('button')!
    expect(fear.innerHTML).not.toContain('↑')

    fireEvent.click(screen.getByText(/Level 3/))
    const fireball = screen.getByText('Fireball').closest('button')!
    expect(fireball.innerHTML).toContain('↑')
  })

  it('collapses heighten options when clicking the spell again', () => {
    render(<SpellPicker {...defaultProps} />)

    fireEvent.click(screen.getByText(/Level 3/))
    fireEvent.click(screen.getByText('Fireball'))
    expect(screen.getByText(/Cast Fireball at level/)).not.toBeNull()

    fireEvent.click(screen.getByText('Fireball'))
    expect(screen.queryByText(/Cast Fireball at level/)).toBeNull()
  })
})
