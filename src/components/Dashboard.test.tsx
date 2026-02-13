import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { User, MatchSummary } from '../../shared/types'
import { Dashboard } from './Dashboard'

let mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const gurpsUser: User = {
  id: 'user-1',
  username: 'TestUser',
  isBot: false,
  preferredRulesetId: 'gurps',
}

const pf2User: User = {
  id: 'user-2',
  username: 'PF2User',
  isBot: false,
  preferredRulesetId: 'pf2',
}

const renderDashboard = (user: User = gurpsUser, myMatches: MatchSummary[] = []) => {
  const onLogout = vi.fn()
  const onCreateMatch = vi.fn()
  const onJoinByCode = vi.fn()
  const onSelectMatch = vi.fn()
  const onDismissMatch = vi.fn()
  const setPreferredRuleset = vi.fn()
  const refreshMyMatches = vi.fn()
  const fetchPublicMatches = vi.fn()

  render(
    <MemoryRouter>
      <Dashboard
        user={user}
        myMatches={myMatches}
        publicMatches={[]}
        refreshMyMatches={refreshMyMatches}
        fetchPublicMatches={fetchPublicMatches}
        onLogout={onLogout}
        onCreateMatch={onCreateMatch}
        onJoinByCode={onJoinByCode}
        onSelectMatch={onSelectMatch}
        onDismissMatch={onDismissMatch}
        setPreferredRuleset={setPreferredRuleset}
      />
    </MemoryRouter>,
  )

  return { onLogout, onCreateMatch, onJoinByCode, onSelectMatch, setPreferredRuleset, refreshMyMatches, fetchPublicMatches }
}

describe('Dashboard', () => {
  beforeEach(() => {
    mockNavigate = vi.fn()
  })

  it('renders username', () => {
    renderDashboard()
    expect(screen.getByText('TestUser')).not.toBeNull()
  })

  it('renders GURPS badge for GURPS user', () => {
    renderDashboard(gurpsUser)
    const badge = screen.getByText('GURPS')
    expect(badge).not.toBeNull()
    expect(badge.className).toContain('ruleset-gurps')
  })

  it('renders PF2 badge for PF2 user', () => {
    renderDashboard(pf2User)
    const badge = screen.getByText('PF2')
    expect(badge).not.toBeNull()
    expect(badge.className).toContain('ruleset-pf2')
  })

  it('clicking ruleset badge directly switches and shows toast', async () => {
    const user = userEvent.setup()
    const { setPreferredRuleset, refreshMyMatches } = renderDashboard(gurpsUser)

    await user.click(screen.getByText('GURPS'))

    expect(setPreferredRuleset).toHaveBeenCalledWith('pf2')
    expect(refreshMyMatches).toHaveBeenCalled()
    expect(screen.getByText('Switched to PF2')).not.toBeNull()
  })

  it('PF2 user clicking badge switches to GURPS', async () => {
    const user = userEvent.setup()
    const { setPreferredRuleset } = renderDashboard(pf2User)

    await user.click(screen.getByText('PF2'))

    expect(setPreferredRuleset).toHaveBeenCalledWith('gurps')
    expect(screen.getByText('Switched to GURPS')).not.toBeNull()
  })

  it('clicking Armory navigates to /armory', async () => {
    const user = userEvent.setup()
    renderDashboard()

    await user.click(screen.getByRole('button', { name: 'Armory' }))

    expect(mockNavigate).toHaveBeenCalledWith('/armory')
  })

  it('clicking Logout calls onLogout', async () => {
    const user = userEvent.setup()
    const { onLogout } = renderDashboard()

    await user.click(screen.getByRole('button', { name: 'Logout' }))

    expect(onLogout).toHaveBeenCalled()
  })

  it('clicking New Match opens CreateMatchDialog', async () => {
    const user = userEvent.setup()
    renderDashboard()

    await user.click(screen.getByRole('button', { name: 'New Match' }))

    expect(screen.getByText('Create New Match')).not.toBeNull()
  })

  it('shows empty state when no matches', () => {
    renderDashboard(gurpsUser, [])
    expect(screen.getByText('No matches yet. Create your first match!')).not.toBeNull()
  })
})
