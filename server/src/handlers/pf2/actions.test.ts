import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import {
  handlePF2DropProne,
  handlePF2Stand,
  handlePF2Step,
  handlePF2RaiseShield,
} from './actions';
import {
  createPF2Combatant,
  createPF2Character,
  createMatch,
  createMockSocket,
  createPlayer,
} from './__tests__/testUtils';

// Mock dependencies
const mockSendMessage = vi.fn();
const mockSendToMatch = vi.fn();
const mockUpdateMatchState = vi.fn();
const mockGetCharacterById = vi.fn();

vi.mock('../../state', () => ({
  state: { matches: new Map() },
}));

vi.mock('../../db', () => ({
  updateMatchState: (...args: unknown[]) => mockUpdateMatchState(...args),
}));

vi.mock('../../helpers', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  sendToMatch: (...args: unknown[]) => mockSendToMatch(...args),
  getCharacterById: (...args: unknown[]) => mockGetCharacterById(...args),
}));

vi.mock('../../bot', () => ({
  scheduleBotTurn: vi.fn(),
}));

describe('PF2 Action Handlers', () => {
  let socket: WebSocket;
  let matchId: string;

  beforeEach(() => {
    vi.clearAllMocks();
    socket = createMockSocket() as unknown as WebSocket;
    matchId = 'match1';
  });

  describe('handlePF2DropProne', () => {
    it('should add prone condition, cost 1 action, and log message', async () => {
      const player = createPlayer({ id: 'player1', name: 'Fighter' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        actionsRemaining: 3,
        conditions: [],
      });
      const match = createMatch({
        id: matchId,
        combatants: [combatant],
      });

      await handlePF2DropProne(socket, matchId, match, player, combatant);

      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockUpdateMatchState).toHaveBeenCalledWith(matchId, expect.any(Object));
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              actionsRemaining: 2,
              conditions: [{ condition: 'prone' }],
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('drops prone')]),
        }),
      });
    });

    it('should send error when no actions remaining', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        actionsRemaining: 0,
      });
      const match = createMatch({ combatants: [combatant] });

      await handlePF2DropProne(socket, matchId, match, player, combatant);

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'No actions remaining.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });
  });

  describe('handlePF2Stand', () => {
    it('should remove prone condition, cost 1 action, and log message', async () => {
      const player = createPlayer({ id: 'player1', name: 'Fighter' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        actionsRemaining: 3,
        conditions: [{ condition: 'prone' }],
      });
      const match = createMatch({
        id: matchId,
        combatants: [combatant],
      });

      await handlePF2Stand(socket, matchId, match, player, combatant);

      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockUpdateMatchState).toHaveBeenCalledWith(matchId, expect.any(Object));
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              actionsRemaining: 2,
              conditions: [],
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('stands up')]),
        }),
      });
    });

    it('should send error when not prone', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        actionsRemaining: 3,
        conditions: [],
      });
      const match = createMatch({ combatants: [combatant] });

      await handlePF2Stand(socket, matchId, match, player, combatant);

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'Not prone.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });

    it('should send error when no actions remaining', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        actionsRemaining: 0,
        conditions: [{ condition: 'prone' }],
      });
      const match = createMatch({ combatants: [combatant] });

      await handlePF2Stand(socket, matchId, match, player, combatant);

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'No actions remaining.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });
  });

  describe('handlePF2Step', () => {
    it('should move to adjacent square, cost 1 action, and log message', async () => {
      const player = createPlayer({ id: 'player1', name: 'Fighter' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        actionsRemaining: 3,
        position: { x: 0, y: 0, z: 0 },
      });
      const match = createMatch({
        id: matchId,
        combatants: [combatant],
      });
      const payload = { to: { q: 1, r: 0 } };

      await handlePF2Step(socket, matchId, match, player, combatant, payload);

      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockUpdateMatchState).toHaveBeenCalledWith(matchId, expect.any(Object));
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              actionsRemaining: 2,
              position: { x: 1, y: 0, z: 0 },
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('steps to')]),
        }),
      });
    });

    it('should send error when distance > 1', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        actionsRemaining: 3,
        position: { x: 0, y: 0, z: 0 },
      });
      const match = createMatch({ combatants: [combatant] });
      const payload = { to: { q: 2, r: 0 } }; // Distance 2

      await handlePF2Step(socket, matchId, match, player, combatant, payload);

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'Step can only move 1 square.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });

    it('should send error when hex is occupied', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant1 = createPF2Combatant({
        playerId: 'player1',
        actionsRemaining: 3,
        position: { x: 0, y: 0, z: 0 },
      });
      const combatant2 = createPF2Combatant({
        playerId: 'player2',
        position: { x: 1, y: 0, z: 0 },
      });
      const match = createMatch({
        combatants: [combatant1, combatant2],
      });
      const payload = { to: { q: 1, r: 0 } }; // Occupied by combatant2

      await handlePF2Step(socket, matchId, match, player, combatant1, payload);

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'Hex is occupied.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });

    it('should send error when no actions remaining', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        actionsRemaining: 0,
        position: { x: 0, y: 0, z: 0 },
      });
      const match = createMatch({ combatants: [combatant] });
      const payload = { to: { q: 1, r: 0 } };

      await handlePF2Step(socket, matchId, match, player, combatant, payload);

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'No actions remaining.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });
  });

  describe('handlePF2RaiseShield', () => {
    it('should set shieldRaised to true, cost 1 action, and log message', async () => {
      const player = createPlayer({ id: 'player1', name: 'Fighter' });
      const character = createPF2Character({
        id: 'char1',
        shieldBonus: 2,
      });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        shieldRaised: false,
      });
      const match = createMatch({
        id: matchId,
        combatants: [combatant],
        characters: [character],
      });

      mockGetCharacterById.mockReturnValue(character);

      await handlePF2RaiseShield(socket, matchId, match, player, combatant);

      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockUpdateMatchState).toHaveBeenCalledWith(matchId, expect.any(Object));
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              actionsRemaining: 2,
              shieldRaised: true,
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('raises their shield')]),
        }),
      });
    });

    it('should send error when no shield equipped', async () => {
      const player = createPlayer({ id: 'player1' });
      const character = createPF2Character({
        id: 'char1',
        shieldBonus: 0, // No shield
      });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        shieldRaised: false,
      });
      const match = createMatch({
        combatants: [combatant],
        characters: [character],
      });

      mockGetCharacterById.mockReturnValue(character);

      await handlePF2RaiseShield(socket, matchId, match, player, combatant);

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'No shield equipped.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });

    it('should send error when shield already raised', async () => {
      const player = createPlayer({ id: 'player1' });
      const character = createPF2Character({
        id: 'char1',
        shieldBonus: 2,
      });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        shieldRaised: true, // Already raised
      });
      const match = createMatch({
        combatants: [combatant],
        characters: [character],
      });

      mockGetCharacterById.mockReturnValue(character);

      await handlePF2RaiseShield(socket, matchId, match, player, combatant);

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'Shield already raised.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });

    it('should send error when no actions remaining', async () => {
      const player = createPlayer({ id: 'player1' });
      const character = createPF2Character({
        id: 'char1',
        shieldBonus: 2,
      });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 0, // No actions
        shieldRaised: false,
      });
      const match = createMatch({
        combatants: [combatant],
        characters: [character],
      });

      mockGetCharacterById.mockReturnValue(character);

      await handlePF2RaiseShield(socket, matchId, match, player, combatant);

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'No actions remaining.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });
  });
});
