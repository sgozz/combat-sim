import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { MatchSummary, User } from '../../../shared/types'
import type { GurpsCharacterSheet } from '../../../shared/rulesets/gurps/characterSheet'
import { LobbyScreen } from './LobbyScreen'

let mockNavigate = vi.fn()
let mockParams: { matchId?: string } = {}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  }
})

const gurpsChar: GurpsCharacterSheet = {
  rulesetId: 'gurps',
  id: 'gurps-1',
  name: 'Conan',
  attributes: { strength: 16, dexterity: 14, intelligence: 10, health: 15 },
  derived: { hitPoints: 18, fatiguePoints: 15, basicSpeed: 7.0, basicMove: 7, dodge: 11 },
  skills: [],
  advantages: [],
  disadvantages: [],
  equipment: [],
  pointsTotal: 150,
}

const baseMatch: MatchSummary = {
  id: 'match-1',
  code: 'ABC123',
  name: 'Test Battle',
  creatorId: 'user-1',
  playerCount: 1,
  maxPlayers: 4,
  rulesetId: 'gurps',
  status: 'waiting',
  players: [{ id: 'user-1', name: 'TestUser', isConnected: true }],
  isMyTurn: false,
  readyPlayers: [],
}

const user: User = {
  id: 'user-1',
  username: 'TestUser',
  isBot: false,
  preferredRulesetId: 'gurps',
}

const renderLobby = (matchOverrides?: Partial<MatchSummary>, overrides?: Partial<{
  myMatches: MatchSummary[]
  user: User | null
}>) => {
  const match = { ...baseMatch, ...matchOverrides }
  const myMatches = overrides?.myMatches ?? [match]
  const currentUser = overrides?.user ?? user
  const sendMessage = vi.fn()

   render(
     <MemoryRouter>
       <LobbyScreen
         myMatches={myMatches}
         user={currentUser}
         connectionState="connected"
         sendMessage={sendMessage}
         characters={[gurpsChar]}
         isSyncing={false}
         onLoadCharacters={vi.fn()}
       />
     </MemoryRouter>,
   )

  return { sendMessage, match }
}

describe('LobbyScreen', () => {
  beforeEach(() => {
    mockNavigate = vi.fn()
    mockParams = { matchId: 'match-1' }
  })

  it('renders loading state when match not found', () => {
    renderLobby(undefined, { myMatches: [] })
    expect(screen.queryByText(/Loading match/)).not.toBeNull()
  })

  it('renders match name and ruleset badge', () => {
    renderLobby()
    expect(screen.queryByText('Test Battle')).not.toBeNull()
    expect(screen.queryAllByText('GURPS').length).toBeGreaterThan(0)
  })

  it('renders player list', () => {
    renderLobby()
    expect(screen.queryByText('TestUser')).not.toBeNull()
  })

  it('clicking Ready sends player_ready message', async () => {
    const userEventInstance = userEvent.setup()
    const { sendMessage } = renderLobby({
      playerCount: 2,
      players: [
        { id: 'user-1', name: 'TestUser', isConnected: true },
        { id: 'user-2', name: 'Player2', isConnected: true }
      ]
    })

    await userEventInstance.click(screen.getByRole('button', { name: 'Ready' }))
    expect(sendMessage).toHaveBeenCalledWith({ type: 'player_ready', matchId: 'match-1', ready: true })
  })

  it('clicking Unready sends player_ready with ready=false', async () => {
    const userEventInstance = userEvent.setup()
    const { sendMessage } = renderLobby({
      playerCount: 2,
      players: [
        { id: 'user-1', name: 'TestUser', isConnected: true },
        { id: 'user-2', name: 'Player2', isConnected: true }
      ],
      readyPlayers: ['user-1']
    })

    await userEventInstance.click(screen.getByRole('button', { name: 'Unready' }))
    expect(sendMessage).toHaveBeenCalledWith({ type: 'player_ready', matchId: 'match-1', ready: false })
  })

  it('clicking Add Bot increments bot count', async () => {
    const userEventInstance = userEvent.setup()
    renderLobby({ readyPlayers: ['user-1'] })

    const startButton = screen.getByRole('button', { name: /Start Match/ }) as HTMLButtonElement
    expect(startButton.disabled).toBe(true)

    await userEventInstance.click(screen.getByLabelText('Add bot'))
    expect(startButton.disabled).toBe(false)
  })

  it('clicking Remove Bot decrements bot count', async () => {
    const userEventInstance = userEvent.setup()
    renderLobby({ readyPlayers: ['user-1'] })

    const startButton = screen.getByRole('button', { name: /Start Match/ }) as HTMLButtonElement
    await userEventInstance.click(screen.getByLabelText('Add bot'))
    expect(startButton.disabled).toBe(false)

    await userEventInstance.click(screen.getByLabelText('Remove bot'))
    expect(startButton.disabled).toBe(true)
  })

  it('Start Match is disabled when not all ready', () => {
    renderLobby({ playerCount: 2, players: [
      { id: 'user-1', name: 'TestUser', isConnected: true },
      { id: 'user-2', name: 'Guest', isConnected: true },
    ] })

    const startButton = screen.getByRole('button', { name: /Start Match/ }) as HTMLButtonElement
    expect(startButton.disabled).toBe(true)
  })

  it('Start Match is disabled when less than 2 combatants', () => {
    renderLobby({ readyPlayers: ['user-1'] })
    const startButton = screen.getByRole('button', { name: /Start Match/ }) as HTMLButtonElement
    expect(startButton.disabled).toBe(true)
  })

  it('Start Match is enabled when all ready + 2+ combatants', () => {
    renderLobby({
      playerCount: 2,
      players: [
        { id: 'user-1', name: 'TestUser', isConnected: true },
        { id: 'user-2', name: 'Guest', isConnected: true },
      ],
      readyPlayers: ['user-1', 'user-2'],
    })

    const startButton = screen.getByRole('button', { name: /Start Match/ }) as HTMLButtonElement
    expect(startButton.disabled).toBe(false)
  })

  it('clicking Start Match shows confirmation dialog', async () => {
    const userEventInstance = userEvent.setup()
    renderLobby({
      playerCount: 2,
      players: [
        { id: 'user-1', name: 'TestUser', isConnected: true },
        { id: 'user-2', name: 'Guest', isConnected: true },
      ],
      readyPlayers: ['user-1', 'user-2'],
    })

    await userEventInstance.click(screen.getByRole('button', { name: /Start Match/ }))
    expect(screen.queryByText('Start Match?')).not.toBeNull()
  })

  it('confirming start sends start_combat with botCount', async () => {
    const userEventInstance = userEvent.setup()
    const { sendMessage } = renderLobby({ readyPlayers: ['user-1'] })

    await userEventInstance.click(screen.getByLabelText('Add bot'))
    await userEventInstance.click(screen.getByRole('button', { name: /Start Match/ }))
    const startButtons = screen.getAllByRole('button', { name: 'Start Match' })
    await userEventInstance.click(startButtons[startButtons.length - 1])

    expect(sendMessage).toHaveBeenCalledWith({ type: 'start_combat', matchId: 'match-1', botCount: 1 })
  })

  it('clicking Leave Match shows confirmation dialog', async () => {
    const userEventInstance = userEvent.setup()
    renderLobby()

    await userEventInstance.click(screen.getByRole('button', { name: 'Leave Match' }))
    expect(screen.queryByText('Leave Match?')).not.toBeNull()
  })

  it('confirming leave sends leave_match and navigates to /home', async () => {
    const userEventInstance = userEvent.setup()
    const { sendMessage } = renderLobby()

    await userEventInstance.click(screen.getByRole('button', { name: 'Leave Match' }))
    const leaveButtons = screen.getAllByRole('button', { name: 'Leave Match' })
    await userEventInstance.click(leaveButtons[leaveButtons.length - 1])

    expect(sendMessage).toHaveBeenCalledWith({ type: 'leave_match', matchId: 'match-1' })
    expect(mockNavigate).toHaveBeenCalledWith('/home')
  })

  it('clicking Back sends leave_match and navigates to /home', async () => {
    const userEventInstance = userEvent.setup()
    const { sendMessage } = renderLobby()

    await userEventInstance.click(screen.getByRole('button', { name: 'Back' }))

    expect(sendMessage).toHaveBeenCalledWith({ type: 'leave_match', matchId: 'match-1' })
    expect(mockNavigate).toHaveBeenCalledWith('/home')
  })

  it('renders CharacterPreview with characters prop', () => {
    renderLobby()
    expect(screen.queryByText('Choose your character')).not.toBeNull()
  })

  it('selecting character sends select_character message', async () => {
    const userEventInstance = userEvent.setup()
    const { sendMessage } = renderLobby()

    await userEventInstance.click(screen.getByRole('button', { name: /Conan/ }))

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'select_character',
      matchId: 'match-1',
      character: gurpsChar,
    })
  })
})
