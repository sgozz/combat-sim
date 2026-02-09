import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import { handlePF2Interact } from './interact';
import { createPF2Combatant, createMatch, createMockSocket, createPlayer, createPF2Character } from './__tests__/testUtils';

const mockSendMessage = vi.fn();
const mockSendToMatch = vi.fn();
const mockUpdateMatchState = vi.fn();
const mockGetCharacterById = vi.fn();
const mockAdvanceTurn = vi.fn((m) => ({ ...m, activeTurnPlayerId: 'player2' }));
const mockScheduleBotTurn = vi.fn();

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

vi.mock('../../rulesetHelpers', () => ({
  advanceTurn: (...args: unknown[]) => mockAdvanceTurn(...args),
}));

vi.mock('../../bot', () => ({
  scheduleBotTurn: (...args: unknown[]) => mockScheduleBotTurn(...args),
}));

describe('handlePF2Interact', () => {
  let socket: WebSocket;
  const matchId = 'match1';

  beforeEach(() => {
    vi.clearAllMocks();
    socket = createMockSocket() as unknown as WebSocket;
  });

  describe('draw', () => {
    it('should draw weapon to right_hand with ready=true and cost 1 action', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        equipped: [],
      });
      const character = createPF2Character({
        id: 'char1',
        name: 'Fighter',
        weapons: [{
          id: 'w1',
          name: 'Longsword',
          damage: '1d8',
          damageType: 'slashing',
          proficiencyCategory: 'martial',
          traits: [],
          potencyRune: 0,
          strikingRune: null,
        }],
      });
      const match = createMatch({
        combatants: [combatant],
        players: [player],
        characters: [character],
      });

      mockGetCharacterById.mockReturnValue(character);

      await handlePF2Interact(socket, matchId, match, player, combatant, {
        type: 'pf2_interact',
        action: 'draw',
        itemId: 'w1',
        targetSlot: 'right_hand',
      });

      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, expect.objectContaining({
        type: 'match_state',
      }));

      const sentState = mockSendToMatch.mock.calls[0][1].state;
      const updatedCombatant = sentState.combatants[0];
      expect(updatedCombatant.actionsRemaining).toBe(2);
      expect(updatedCombatant.equipped).toEqual([
        { equipmentId: 'w1', slot: 'right_hand', ready: true },
      ]);
      expect(sentState.log).toContain('Fighter draws Longsword.');
    });

    it('should draw weapon to left_hand when specified', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        equipped: [],
      });
      const character = createPF2Character({ id: 'char1' });
      const match = createMatch({
        combatants: [combatant],
        players: [player],
        characters: [character],
      });

      mockGetCharacterById.mockReturnValue(character);

      await handlePF2Interact(socket, matchId, match, player, combatant, {
        type: 'pf2_interact',
        action: 'draw',
        itemId: 'w1',
        targetSlot: 'left_hand',
      });

      const sentState = mockSendToMatch.mock.calls[0][1].state;
      const updatedCombatant = sentState.combatants[0];
      expect(updatedCombatant.equipped).toEqual([
        { equipmentId: 'w1', slot: 'left_hand', ready: true },
      ]);
    });

    it('should default to right_hand when no targetSlot specified', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        equipped: [],
      });
      const character = createPF2Character({ id: 'char1' });
      const match = createMatch({
        combatants: [combatant],
        players: [player],
        characters: [character],
      });

      mockGetCharacterById.mockReturnValue(character);

      await handlePF2Interact(socket, matchId, match, player, combatant, {
        type: 'pf2_interact',
        action: 'draw',
        itemId: 'w1',
      });

      const sentState = mockSendToMatch.mock.calls[0][1].state;
      const updatedCombatant = sentState.combatants[0];
      expect(updatedCombatant.equipped).toEqual([
        { equipmentId: 'w1', slot: 'right_hand', ready: true },
      ]);
    });

    it('should return error when hands full', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        equipped: [
          { equipmentId: 'w1', slot: 'right_hand', ready: true },
        ],
      });
      const character = createPF2Character({
        id: 'char1',
        weapons: [
          { id: 'w1', name: 'Longsword', damage: '1d8', damageType: 'slashing', proficiencyCategory: 'martial', traits: [], potencyRune: 0, strikingRune: null },
          { id: 'w2', name: 'Dagger', damage: '1d4', damageType: 'piercing', proficiencyCategory: 'simple', traits: ['agile', 'finesse'], potencyRune: 0, strikingRune: null },
        ],
      });
      const match = createMatch({
        combatants: [combatant],
        players: [player],
        characters: [character],
      });

      mockGetCharacterById.mockReturnValue(character);

      await handlePF2Interact(socket, matchId, match, player, combatant, {
        type: 'pf2_interact',
        action: 'draw',
        itemId: 'w2',
        targetSlot: 'right_hand',
      });

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'right_hand is occupied. Sheathe current item first.',
      });
      expect(mockSendToMatch).not.toHaveBeenCalled();
    });

    it('should return error when 0 actions remaining', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 0,
        equipped: [],
      });
      const character = createPF2Character({ id: 'char1' });
      const match = createMatch({
        combatants: [combatant],
        players: [player],
        characters: [character],
      });

      await handlePF2Interact(socket, matchId, match, player, combatant, {
        type: 'pf2_interact',
        action: 'draw',
        itemId: 'w1',
      });

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'No actions remaining.',
      });
      expect(mockSendToMatch).not.toHaveBeenCalled();
    });

    it('should return error when weapon already drawn', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        equipped: [
          { equipmentId: 'w1', slot: 'right_hand', ready: true },
        ],
      });
      const character = createPF2Character({ id: 'char1' });
      const match = createMatch({
        combatants: [combatant],
        players: [player],
        characters: [character],
      });

      mockGetCharacterById.mockReturnValue(character);

      await handlePF2Interact(socket, matchId, match, player, combatant, {
        type: 'pf2_interact',
        action: 'draw',
        itemId: 'w1',
      });

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'Weapon already drawn.',
      });
      expect(mockSendToMatch).not.toHaveBeenCalled();
    });

    it('should return error when weapon not found in inventory', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        equipped: [],
      });
      const character = createPF2Character({ id: 'char1' });
      const match = createMatch({
        combatants: [combatant],
        players: [player],
        characters: [character],
      });

      mockGetCharacterById.mockReturnValue(character);

      await handlePF2Interact(socket, matchId, match, player, combatant, {
        type: 'pf2_interact',
        action: 'draw',
        itemId: 'nonexistent',
      });

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'Weapon not found in inventory.',
      });
      expect(mockSendToMatch).not.toHaveBeenCalled();
    });
  });

  describe('sheathe', () => {
    it('should sheathe weapon from hand to belt with ready=false and cost 1 action', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        equipped: [
          { equipmentId: 'w1', slot: 'right_hand', ready: true },
        ],
      });
      const character = createPF2Character({
        id: 'char1',
        name: 'Fighter',
      });
      const match = createMatch({
        combatants: [combatant],
        players: [player],
        characters: [character],
      });

      mockGetCharacterById.mockReturnValue(character);

      await handlePF2Interact(socket, matchId, match, player, combatant, {
        type: 'pf2_interact',
        action: 'sheathe',
        itemId: 'w1',
      });

      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, expect.objectContaining({
        type: 'match_state',
      }));

      const sentState = mockSendToMatch.mock.calls[0][1].state;
      const updatedCombatant = sentState.combatants[0];
      expect(updatedCombatant.actionsRemaining).toBe(2);
      expect(updatedCombatant.equipped).toEqual([
        { equipmentId: 'w1', slot: 'belt', ready: false },
      ]);
      expect(sentState.log).toContain('Fighter sheathes Longsword.');
    });

    it('should return error when weapon not in hand', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        equipped: [],
      });
      const character = createPF2Character({ id: 'char1' });
      const match = createMatch({
        combatants: [combatant],
        players: [player],
        characters: [character],
      });

      mockGetCharacterById.mockReturnValue(character);

      await handlePF2Interact(socket, matchId, match, player, combatant, {
        type: 'pf2_interact',
        action: 'sheathe',
        itemId: 'w1',
      });

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'Weapon not in hand.',
      });
      expect(mockSendToMatch).not.toHaveBeenCalled();
    });

    it('should return error when weapon is equipped but not ready', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        equipped: [
          { equipmentId: 'w1', slot: 'belt', ready: false },
        ],
      });
      const character = createPF2Character({ id: 'char1' });
      const match = createMatch({
        combatants: [combatant],
        players: [player],
        characters: [character],
      });

      mockGetCharacterById.mockReturnValue(character);

      await handlePF2Interact(socket, matchId, match, player, combatant, {
        type: 'pf2_interact',
        action: 'sheathe',
        itemId: 'w1',
      });

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'Weapon not in hand.',
      });
      expect(mockSendToMatch).not.toHaveBeenCalled();
    });
  });

  describe('turn advancement', () => {
    it('should advance turn when 0 actions remain after interact', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 1,
        equipped: [],
      });
      const character = createPF2Character({ id: 'char1' });
      const match = createMatch({
        combatants: [combatant],
        players: [player],
        characters: [character],
      });

      mockGetCharacterById.mockReturnValue(character);

      await handlePF2Interact(socket, matchId, match, player, combatant, {
        type: 'pf2_interact',
        action: 'draw',
        itemId: 'w1',
      });

      expect(mockAdvanceTurn).toHaveBeenCalled();
      expect(mockScheduleBotTurn).toHaveBeenCalled();
    });

    it('should NOT advance turn when actions remain after interact', async () => {
      const player = createPlayer({ id: 'player1' });
      const combatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 2,
        equipped: [],
      });
      const character = createPF2Character({ id: 'char1' });
      const match = createMatch({
        combatants: [combatant],
        players: [player],
        characters: [character],
      });

      mockGetCharacterById.mockReturnValue(character);

      await handlePF2Interact(socket, matchId, match, player, combatant, {
        type: 'pf2_interact',
        action: 'draw',
        itemId: 'w1',
      });

      expect(mockAdvanceTurn).not.toHaveBeenCalled();
      expect(mockScheduleBotTurn).not.toHaveBeenCalled();
    });
  });
});
