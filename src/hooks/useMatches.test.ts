import { createElement, useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ServerToClientMessage, MatchSummary, MatchState } from '../../shared/types'
import type { CombatantState } from '../../shared/rulesets'
import { useMatches } from './useMatches'

const matchSummary: MatchSummary = {
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

const createMatchState = (status: MatchState['status']): MatchState => ({
  id: 'match-1',
  name: 'Test Battle',
  code: 'ABC123',
  maxPlayers: 4,
  rulesetId: 'gurps',
  players: [],
  characters: [],
  combatants: [] as CombatantState[],
  activeTurnPlayerId: 'user-1',
  round: 1,
  log: [],
  status,
  createdAt: Date.now(),
})

const Harness = ({
  sendMessage,
  messageHandlers,
  initialActiveMatchId = null,
}: {
  sendMessage: (payload: unknown) => void
  messageHandlers: React.MutableRefObject<Array<(msg: ServerToClientMessage) => boolean>>
  initialActiveMatchId?: string | null
}) => {
  const [activeMatchId, setActiveMatchId] = useState<string | null>(initialActiveMatchId)
  const [matchState, setMatchState] = useState<MatchState | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const { myMatches, publicMatches, refreshMyMatches, fetchPublicMatches } = useMatches({
    sendMessage,
    messageHandlers,
    activeMatchId,
    setActiveMatchId,
    setMatchState,
    setLogs,
  })

  return createElement(
    'div',
    null,
    createElement('button', { type: 'button', onClick: refreshMyMatches }, 'Refresh'),
    createElement('button', { type: 'button', onClick: fetchPublicMatches }, 'Public'),
    createElement('div', { 'data-testid': 'activeMatchId' }, activeMatchId ?? ''),
    createElement('div', { 'data-testid': 'myMatches' }, JSON.stringify(myMatches)),
    createElement('div', { 'data-testid': 'publicMatches' }, JSON.stringify(publicMatches)),
    createElement('div', { 'data-testid': 'logs' }, JSON.stringify(logs)),
    createElement('div', { 'data-testid': 'matchState' }, matchState?.status ?? ''),
  )
}

const getParsed = <T,>(testId: string): T => {
  const text = screen.getByTestId(testId).textContent
  return JSON.parse(text || 'null') as T
}

const sendServerMessage = (
  messageHandlers: React.MutableRefObject<Array<(msg: ServerToClientMessage) => boolean>>,
  message: ServerToClientMessage,
) => {
  act(() => {
    messageHandlers.current.forEach(handler => handler(message))
  })
}

describe('useMatches', () => {
  describe('message handlers', () => {
    it('handles my_matches → sets matches list', () => {
      const sendMessage = vi.fn()
      const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
      render(createElement(Harness, { sendMessage, messageHandlers }))

      sendServerMessage(messageHandlers, { type: 'my_matches', matches: [matchSummary] })

      const matches = getParsed<MatchSummary[]>('myMatches')
      expect(matches).toHaveLength(1)
      expect(matches[0]?.id).toBe('match-1')
    })

    it('handles match_created → adds match, sets activeMatchId', () => {
      const sendMessage = vi.fn()
      const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
      render(createElement(Harness, { sendMessage, messageHandlers }))

      sendServerMessage(messageHandlers, { type: 'match_created', match: matchSummary })

      const matches = getParsed<MatchSummary[]>('myMatches')
      expect(matches[0]?.id).toBe('match-1')
      expect(screen.getByTestId('activeMatchId').textContent).toBe('match-1')
    })

    it('handles match_joined → sets activeMatchId', () => {
      const sendMessage = vi.fn()
      const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
      render(createElement(Harness, { sendMessage, messageHandlers }))

      sendServerMessage(messageHandlers, { type: 'match_joined', matchId: 'match-1' })

      expect(screen.getByTestId('activeMatchId').textContent).toBe('match-1')
    })

    it('handles match_left → clears match from list', () => {
      const sendMessage = vi.fn()
      const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
      render(createElement(Harness, { sendMessage, messageHandlers, initialActiveMatchId: 'match-1' }))

      sendServerMessage(messageHandlers, { type: 'my_matches', matches: [matchSummary] })
      sendServerMessage(messageHandlers, { type: 'match_left', matchId: 'match-1' })

      const matches = getParsed<MatchSummary[]>('myMatches')
      expect(matches).toHaveLength(0)
      expect(screen.getByTestId('activeMatchId').textContent).toBe('')
    })

    it('handles match_updated → updates match in list', () => {
      const sendMessage = vi.fn()
      const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
      render(createElement(Harness, { sendMessage, messageHandlers }))

      sendServerMessage(messageHandlers, { type: 'my_matches', matches: [matchSummary] })
      sendServerMessage(messageHandlers, { type: 'match_updated', match: { ...matchSummary, name: 'Updated' } })

      const matches = getParsed<MatchSummary[]>('myMatches')
      expect(matches[0]?.name).toBe('Updated')
    })

    it('handles player_joined → adds player to match', () => {
      const sendMessage = vi.fn()
      const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
      render(createElement(Harness, { sendMessage, messageHandlers }))

      sendServerMessage(messageHandlers, { type: 'my_matches', matches: [matchSummary] })
      sendServerMessage(messageHandlers, {
        type: 'player_joined',
        matchId: 'match-1',
        player: { id: 'user-2', name: 'Guest', isBot: false, characterId: 'c1' },
      })

      const matches = getParsed<MatchSummary[]>('myMatches')
      expect(matches[0]?.players).toHaveLength(2)
      expect(matches[0]?.playerCount).toBe(2)
    })

    it('handles player_left → removes player from match', () => {
      const sendMessage = vi.fn()
      const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
      const withTwoPlayers: MatchSummary = {
        ...matchSummary,
        playerCount: 2,
        players: [
          ...matchSummary.players,
          { id: 'user-2', name: 'Guest', isConnected: true },
        ],
      }
      render(createElement(Harness, { sendMessage, messageHandlers }))

      sendServerMessage(messageHandlers, { type: 'my_matches', matches: [withTwoPlayers] })
      sendServerMessage(messageHandlers, {
        type: 'player_left',
        matchId: 'match-1',
        playerId: 'user-2',
        playerName: 'Guest',
      })

      const matches = getParsed<MatchSummary[]>('myMatches')
      expect(matches[0]?.players).toHaveLength(1)
      expect(matches[0]?.playerCount).toBe(1)
    })

    it('handles player_disconnected → marks player disconnected', () => {
      const sendMessage = vi.fn()
      const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
      render(createElement(Harness, { sendMessage, messageHandlers }))

      sendServerMessage(messageHandlers, { type: 'my_matches', matches: [matchSummary] })
      sendServerMessage(messageHandlers, {
        type: 'player_disconnected',
        matchId: 'match-1',
        playerId: 'user-1',
        playerName: 'TestUser',
      })

      const matches = getParsed<MatchSummary[]>('myMatches')
      expect(matches[0]?.players[0]?.isConnected).toBe(false)
    })

    it('handles player_reconnected → marks player connected', () => {
      const sendMessage = vi.fn()
      const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
      const disconnected: MatchSummary = {
        ...matchSummary,
        players: [{ id: 'user-1', name: 'TestUser', isConnected: false }],
      }
      render(createElement(Harness, { sendMessage, messageHandlers }))

      sendServerMessage(messageHandlers, { type: 'my_matches', matches: [disconnected] })
      sendServerMessage(messageHandlers, {
        type: 'player_reconnected',
        matchId: 'match-1',
        playerId: 'user-1',
        playerName: 'TestUser',
      })

      const matches = getParsed<MatchSummary[]>('myMatches')
      expect(matches[0]?.players[0]?.isConnected).toBe(true)
    })

    it('handles player_ready_update → adds player to readyPlayers', () => {
      const sendMessage = vi.fn()
      const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
      render(createElement(Harness, { sendMessage, messageHandlers }))

      sendServerMessage(messageHandlers, { type: 'my_matches', matches: [matchSummary] })
      sendServerMessage(messageHandlers, {
        type: 'player_ready_update',
        matchId: 'match-1',
        playerId: 'user-1',
        ready: true,
      })

      const matches = getParsed<MatchSummary[]>('myMatches')
      expect(matches[0]?.readyPlayers).toEqual(['user-1'])
    })

    it('handles player_ready_update unready → removes from readyPlayers', () => {
      const sendMessage = vi.fn()
      const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
      const ready: MatchSummary = { ...matchSummary, readyPlayers: ['user-1'] }
      render(createElement(Harness, { sendMessage, messageHandlers }))

      sendServerMessage(messageHandlers, { type: 'my_matches', matches: [ready] })
      sendServerMessage(messageHandlers, {
        type: 'player_ready_update',
        matchId: 'match-1',
        playerId: 'user-1',
        ready: false,
      })

      const matches = getParsed<MatchSummary[]>('myMatches')
      expect(matches[0]?.readyPlayers).toEqual([])
    })

    it('handles match_state → updates match status in myMatches', () => {
      const sendMessage = vi.fn()
      const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
      render(createElement(Harness, { sendMessage, messageHandlers }))

      sendServerMessage(messageHandlers, { type: 'my_matches', matches: [matchSummary] })
      sendServerMessage(messageHandlers, { type: 'match_state', state: createMatchState('active') })

      const matches = getParsed<MatchSummary[]>('myMatches')
      expect(matches[0]?.status).toBe('active')
    })

    it('handles all_players_ready → returns true (consumed)', () => {
      const sendMessage = vi.fn()
      const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
      render(createElement(Harness, { sendMessage, messageHandlers }))

      const handler = messageHandlers.current[0]
      const result = handler({ type: 'all_players_ready', matchId: 'match-1' })
      expect(result).toBe(true)
    })

    it('handles public_matches → sets public matches', () => {
      const sendMessage = vi.fn()
      const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
      render(createElement(Harness, { sendMessage, messageHandlers }))

      sendServerMessage(messageHandlers, { type: 'public_matches', matches: [matchSummary] })

      const matches = getParsed<MatchSummary[]>('publicMatches')
      expect(matches).toHaveLength(1)
    })
  })

  describe('actions', () => {
    it('refreshMyMatches sends list_my_matches', async () => {
      const sendMessage = vi.fn()
      const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
      const user = userEvent.setup()
      render(createElement(Harness, { sendMessage, messageHandlers }))

      await user.click(screen.getByRole('button', { name: 'Refresh' }))

      expect(sendMessage).toHaveBeenCalledWith({ type: 'list_my_matches' })
    })

    it('fetchPublicMatches sends list_public_waiting', async () => {
      const sendMessage = vi.fn()
      const messageHandlers = { current: [] as Array<(msg: ServerToClientMessage) => boolean> }
      const user = userEvent.setup()
      render(createElement(Harness, { sendMessage, messageHandlers }))

      await user.click(screen.getByRole('button', { name: 'Public' }))

      expect(sendMessage).toHaveBeenCalledWith({ type: 'list_public_waiting' })
    })
  })
})
