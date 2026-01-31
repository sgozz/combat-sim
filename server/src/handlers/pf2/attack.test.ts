import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import { handlePF2AttackAction } from './attack';
import {
  createPF2Combatant,
  createPF2Character,
  createMatch,
  createMockSocket,
  createPlayer,
} from './__tests__/testUtils';

const mockSendMessage = vi.fn();
const mockSendToMatch = vi.fn();
const mockUpdateMatchState = vi.fn();
const mockGetCharacterById = vi.fn();
const mockCalculateGridDistance = vi.fn();
const mockGetCombatantByPlayerId = vi.fn();
const mockGetGridSystemForMatch = vi.fn();
const mockCheckVictory = vi.fn();
const mockAdvanceTurn = vi.fn();
const mockScheduleBotTurn = vi.fn();
const mockRollCheck = vi.fn();
const mockRollDamage = vi.fn();

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
  calculateGridDistance: (...args: unknown[]) => mockCalculateGridDistance(...args),
  getCombatantByPlayerId: (...args: unknown[]) => mockGetCombatantByPlayerId(...args),
  getGridSystemForMatch: (...args: unknown[]) => mockGetGridSystemForMatch(...args),
  checkVictory: (...args: unknown[]) => mockCheckVictory(...args),
}));

vi.mock('../../bot', () => ({
  scheduleBotTurn: (...args: unknown[]) => mockScheduleBotTurn(...args),
}));

vi.mock('../../rulesetHelpers', () => ({
  advanceTurn: (...args: unknown[]) => mockAdvanceTurn(...args),
}));

vi.mock('../../../../shared/rulesets/serverAdapter', () => ({
  getServerAdapter: () => ({
    pf2: {
      getAbilityModifier: (score: number) => Math.floor((score - 10) / 2),
      getProficiencyBonus: (_prof: string, level: number) => 2 + level,
      rollCheck: (...args: unknown[]) => mockRollCheck(...args),
      rollDamage: (...args: unknown[]) => mockRollDamage(...args),
    },
  }),
}));

describe('PF2 Attack Handler', () => {
  let socket: WebSocket;
  let matchId: string;

  beforeEach(() => {
    vi.clearAllMocks();
    socket = createMockSocket() as unknown as WebSocket;
    matchId = 'match1';
    mockGetGridSystemForMatch.mockReturnValue('square');
    mockCheckVictory.mockImplementation((state) => state);
    mockAdvanceTurn.mockImplementation((state) => ({
      ...state,
      activeTurnPlayerId: 'player2',
    }));
  });

  describe('handlePF2AttackAction', () => {
    it('should deal damage, reduce HP, cost 1 action, and apply MAP on hit', async () => {
      const attacker = createPlayer({ id: 'player1', name: 'Fighter' });
      const attackerChar = createPF2Character({
        id: 'char1',
        name: 'Fighter',
        abilities: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 10 },
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
      const targetChar = createPF2Character({
        id: 'char2',
        name: 'Goblin',
        derived: { ...createPF2Character().derived, armorClass: 15 },
      });
      const attackerCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        mapPenalty: 0,
        position: { x: 0, y: 0, z: 0 },
      });
      const targetCombatant = createPF2Combatant({
        playerId: 'player2',
        characterId: 'char2',
        currentHP: 20,
        position: { x: 1, y: 0, z: 0 },
      });
      const match = createMatch({
        id: matchId,
        combatants: [attackerCombatant, targetCombatant],
        characters: [attackerChar, targetChar],
      });

      mockGetCharacterById.mockImplementation((match, id) => {
        if (id === 'char1') return attackerChar;
        if (id === 'char2') return targetChar;
        return null;
      });
      mockCalculateGridDistance.mockReturnValue(1);
      mockRollCheck.mockReturnValue({
        roll: 15,
        modifier: 6,
        total: 21,
        dc: 15,
        degree: 'success',
      });
      mockRollDamage.mockReturnValue({
        rolls: [5],
        modifier: 3,
        total: 8,
        damageType: 'slashing',
      });

      const payload = { type: 'attack' as const, targetId: 'player2' };
      await handlePF2AttackAction(socket, matchId, match, attacker, attackerCombatant, payload);

      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockUpdateMatchState).toHaveBeenCalledWith(matchId, expect.any(Object));
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player2',
              currentHP: 12,
            }),
            expect.objectContaining({
              playerId: 'player1',
              actionsRemaining: 2,
              mapPenalty: -5,
            }),
          ]),
          log: expect.arrayContaining([
            expect.stringContaining('attacks'),
            expect.stringContaining('Goblin'),
            expect.stringContaining('Longsword'),
            expect.stringContaining('Hit'),
            expect.stringContaining('8'),
            expect.stringContaining('slashing'),
          ]),
        }),
      });
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'visual_effect',
        matchId,
        effect: expect.objectContaining({
          type: 'damage',
          attackerId: 'player1',
          targetId: 'player2',
          value: 8,
        }),
      });
    });

    it('should double damage on critical hit', async () => {
      const attacker = createPlayer({ id: 'player1', name: 'Fighter' });
      const attackerChar = createPF2Character({ id: 'char1', name: 'Fighter' });
      const targetChar = createPF2Character({ id: 'char2', name: 'Goblin' });
      const attackerCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        position: { x: 0, y: 0, z: 0 },
      });
      const targetCombatant = createPF2Combatant({
        playerId: 'player2',
        characterId: 'char2',
        currentHP: 20,
        position: { x: 1, y: 0, z: 0 },
      });
      const match = createMatch({
        combatants: [attackerCombatant, targetCombatant],
        characters: [attackerChar, targetChar],
      });

      mockGetCharacterById.mockImplementation((match, id) => {
        if (id === 'char1') return attackerChar;
        if (id === 'char2') return targetChar;
        return null;
      });
      mockCalculateGridDistance.mockReturnValue(1);
      mockRollCheck.mockReturnValue({
        roll: 20,
        modifier: 6,
        total: 26,
        dc: 15,
        degree: 'critical_success',
      });
      mockRollDamage.mockReturnValue({
        rolls: [5],
        modifier: 3,
        total: 8,
        damageType: 'slashing',
      });

      const payload = { type: 'attack' as const, targetId: 'player2' };
      await handlePF2AttackAction(socket, matchId, match, attacker, attackerCombatant, payload);

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player2',
              currentHP: 4,
            }),
          ]),
          log: expect.arrayContaining([
            expect.stringContaining('Critical Hit'),
            expect.stringContaining('16'),
            expect.stringContaining('doubled'),
          ]),
        }),
      });
    });

    it('should not deal damage on miss but still cost action and apply MAP', async () => {
      const attacker = createPlayer({ id: 'player1', name: 'Fighter' });
      const attackerChar = createPF2Character({ id: 'char1', name: 'Fighter' });
      const targetChar = createPF2Character({ id: 'char2', name: 'Goblin' });
      const attackerCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        position: { x: 0, y: 0, z: 0 },
      });
      const targetCombatant = createPF2Combatant({
        playerId: 'player2',
        characterId: 'char2',
        currentHP: 20,
        position: { x: 1, y: 0, z: 0 },
      });
      const match = createMatch({
        combatants: [attackerCombatant, targetCombatant],
        characters: [attackerChar, targetChar],
      });

      mockGetCharacterById.mockImplementation((match, id) => {
        if (id === 'char1') return attackerChar;
        if (id === 'char2') return targetChar;
        return null;
      });
      mockCalculateGridDistance.mockReturnValue(1);
      mockRollCheck.mockReturnValue({
        roll: 5,
        modifier: 6,
        total: 11,
        dc: 15,
        degree: 'failure',
      });

      const payload = { type: 'attack' as const, targetId: 'player2' };
      await handlePF2AttackAction(socket, matchId, match, attacker, attackerCombatant, payload);

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player2',
              currentHP: 20,
            }),
            expect.objectContaining({
              playerId: 'player1',
              actionsRemaining: 2,
              mapPenalty: -5,
            }),
          ]),
          log: expect.arrayContaining([
            expect.stringContaining('Miss'),
          ]),
        }),
      });
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'visual_effect',
        matchId,
        effect: expect.objectContaining({
          type: 'miss',
        }),
      });
    });

    it('should set dying and unconscious status when target HP reaches 0', async () => {
      const attacker = createPlayer({ id: 'player1', name: 'Fighter' });
      const attackerChar = createPF2Character({ id: 'char1', name: 'Fighter' });
      const targetChar = createPF2Character({ id: 'char2', name: 'Goblin' });
      const attackerCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        position: { x: 0, y: 0, z: 0 },
      });
      const targetCombatant = createPF2Combatant({
        playerId: 'player2',
        characterId: 'char2',
        currentHP: 8,
        dying: 0,
        wounded: 0,
        doomed: 0,
        position: { x: 1, y: 0, z: 0 },
      });
      const match = createMatch({
        combatants: [attackerCombatant, targetCombatant],
        characters: [attackerChar, targetChar],
      });

      mockGetCharacterById.mockImplementation((match, id) => {
        if (id === 'char1') return attackerChar;
        if (id === 'char2') return targetChar;
        return null;
      });
      mockCalculateGridDistance.mockReturnValue(1);
      mockRollCheck.mockReturnValue({
        roll: 15,
        modifier: 6,
        total: 21,
        dc: 15,
        degree: 'success',
      });
      mockRollDamage.mockReturnValue({
        rolls: [5],
        modifier: 3,
        total: 8,
        damageType: 'slashing',
      });

      const payload = { type: 'attack' as const, targetId: 'player2' };
      await handlePF2AttackAction(socket, matchId, match, attacker, attackerCombatant, payload);

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player2',
              currentHP: 0,
              dying: 1,
              conditions: expect.arrayContaining([
                expect.objectContaining({ condition: 'unconscious' }),
              ]),
            }),
          ]),
          log: expect.arrayContaining([
            expect.stringContaining('falls unconscious'),
          ]),
        }),
      });
    });

    it('should send error when target is out of melee range', async () => {
      const attacker = createPlayer({ id: 'player1', name: 'Fighter' });
      const attackerCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        position: { x: 0, y: 0, z: 0 },
      });
      const targetCombatant = createPF2Combatant({
        playerId: 'player2',
        characterId: 'char2',
        position: { x: 5, y: 0, z: 0 },
      });
      const match = createMatch({
        combatants: [attackerCombatant, targetCombatant],
      });

      mockGetCharacterById.mockReturnValue(createPF2Character());
      mockCalculateGridDistance.mockReturnValue(5);

      const payload = { type: 'attack' as const, targetId: 'player2' };
      await handlePF2AttackAction(socket, matchId, match, attacker, attackerCombatant, payload);

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'Target out of melee range.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });

    it('should send error when no actions remaining', async () => {
      const attacker = createPlayer({ id: 'player1', name: 'Fighter' });
      const attackerCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 0,
        position: { x: 0, y: 0, z: 0 },
      });
      const targetCombatant = createPF2Combatant({
        playerId: 'player2',
        characterId: 'char2',
        position: { x: 1, y: 0, z: 0 },
      });
      const match = createMatch({
        combatants: [attackerCombatant, targetCombatant],
      });

      mockGetCharacterById.mockReturnValue(createPF2Character());
      mockCalculateGridDistance.mockReturnValue(1);

      const payload = { type: 'attack' as const, targetId: 'player2' };
      await handlePF2AttackAction(socket, matchId, match, attacker, attackerCombatant, payload);

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'No actions remaining.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });

    it('should apply shield bonus to target AC', async () => {
      const attacker = createPlayer({ id: 'player1', name: 'Fighter' });
      const attackerChar = createPF2Character({ id: 'char1', name: 'Fighter' });
      const targetChar = createPF2Character({
        id: 'char2',
        name: 'Paladin',
        derived: { ...createPF2Character().derived, armorClass: 18 },
      });
      const attackerCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        position: { x: 0, y: 0, z: 0 },
      });
      const targetCombatant = createPF2Combatant({
        playerId: 'player2',
        characterId: 'char2',
        shieldRaised: true,
        position: { x: 1, y: 0, z: 0 },
      });
      const match = createMatch({
        combatants: [attackerCombatant, targetCombatant],
        characters: [attackerChar, targetChar],
      });

      mockGetCharacterById.mockImplementation((match, id) => {
        if (id === 'char1') return attackerChar;
        if (id === 'char2') return targetChar;
        return null;
      });
      mockCalculateGridDistance.mockReturnValue(1);
      mockRollCheck.mockReturnValue({
        roll: 15,
        modifier: 6,
        total: 21,
        dc: 20,
        degree: 'success',
      });
      mockRollDamage.mockReturnValue({
        rolls: [5],
        modifier: 3,
        total: 8,
        damageType: 'slashing',
      });

      const payload = { type: 'attack' as const, targetId: 'player2' };
      await handlePF2AttackAction(socket, matchId, match, attacker, attackerCombatant, payload);

      expect(mockRollCheck).toHaveBeenCalledWith(
        expect.any(Number),
        20
      );
    });

    it('should apply condition modifiers (flat_footed on target, prone on attacker)', async () => {
      const attacker = createPlayer({ id: 'player1', name: 'Fighter' });
      const attackerChar = createPF2Character({ id: 'char1', name: 'Fighter' });
      const targetChar = createPF2Character({
        id: 'char2',
        name: 'Goblin',
        derived: { ...createPF2Character().derived, armorClass: 15 },
      });
      const attackerCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        conditions: [{ condition: 'prone' }],
        position: { x: 0, y: 0, z: 0 },
      });
      const targetCombatant = createPF2Combatant({
        playerId: 'player2',
        characterId: 'char2',
        conditions: [{ condition: 'flat_footed' }],
        position: { x: 1, y: 0, z: 0 },
      });
      const match = createMatch({
        combatants: [attackerCombatant, targetCombatant],
        characters: [attackerChar, targetChar],
      });

      mockGetCharacterById.mockImplementation((match, id) => {
        if (id === 'char1') return attackerChar;
        if (id === 'char2') return targetChar;
        return null;
      });
      mockCalculateGridDistance.mockReturnValue(1);
      mockRollCheck.mockReturnValue({
        roll: 15,
        modifier: 4,
        total: 19,
        dc: 13,
        degree: 'success',
      });
      mockRollDamage.mockReturnValue({
        rolls: [5],
        modifier: 3,
        total: 8,
        damageType: 'slashing',
      });

      const payload = { type: 'attack' as const, targetId: 'player2' };
      await handlePF2AttackAction(socket, matchId, match, attacker, attackerCombatant, payload);

      expect(mockRollCheck).toHaveBeenCalledWith(
        4,
        13
      );
    });

    it('should apply agile weapon MAP (-4/-8 instead of -5/-10)', async () => {
      const attacker = createPlayer({ id: 'player1', name: 'Rogue' });
      const attackerChar = createPF2Character({
        id: 'char1',
        name: 'Rogue',
        weapons: [{
          id: 'w1',
          name: 'Shortsword',
          damage: '1d6',
          damageType: 'piercing',
          proficiencyCategory: 'martial',
          traits: ['agile', 'finesse'],
          potencyRune: 0,
          strikingRune: null,
        }],
      });
      const targetChar = createPF2Character({ id: 'char2', name: 'Goblin' });
      const attackerCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        mapPenalty: 0,
        position: { x: 0, y: 0, z: 0 },
      });
      const targetCombatant = createPF2Combatant({
        playerId: 'player2',
        characterId: 'char2',
        currentHP: 20,
        position: { x: 1, y: 0, z: 0 },
      });
      const match = createMatch({
        combatants: [attackerCombatant, targetCombatant],
        characters: [attackerChar, targetChar],
      });

      mockGetCharacterById.mockImplementation((match, id) => {
        if (id === 'char1') return attackerChar;
        if (id === 'char2') return targetChar;
        return null;
      });
      mockCalculateGridDistance.mockReturnValue(1);
      mockRollCheck.mockReturnValue({
        roll: 15,
        modifier: 6,
        total: 21,
        dc: 15,
        degree: 'success',
      });
      mockRollDamage.mockReturnValue({
        rolls: [4],
        modifier: 3,
        total: 7,
        damageType: 'piercing',
      });

      const payload = { type: 'attack' as const, targetId: 'player2' };
      await handlePF2AttackAction(socket, matchId, match, attacker, attackerCombatant, payload);

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player1',
              actionsRemaining: 2,
              mapPenalty: -4,
            }),
          ]),
        }),
      });
    });

    it('should auto-advance turn when 0 actions remaining after attack', async () => {
      const attacker = createPlayer({ id: 'player1', name: 'Fighter' });
      const attackerChar = createPF2Character({ id: 'char1', name: 'Fighter' });
      const targetChar = createPF2Character({ id: 'char2', name: 'Goblin' });
      const attackerCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 1,
        position: { x: 0, y: 0, z: 0 },
      });
      const targetCombatant = createPF2Combatant({
        playerId: 'player2',
        characterId: 'char2',
        currentHP: 20,
        position: { x: 1, y: 0, z: 0 },
      });
      const match = createMatch({
        combatants: [attackerCombatant, targetCombatant],
        characters: [attackerChar, targetChar],
        activeTurnPlayerId: 'player1',
      });

      mockGetCharacterById.mockImplementation((match, id) => {
        if (id === 'char1') return attackerChar;
        if (id === 'char2') return targetChar;
        return null;
      });
      mockCalculateGridDistance.mockReturnValue(1);
      mockRollCheck.mockReturnValue({
        roll: 15,
        modifier: 6,
        total: 21,
        dc: 15,
        degree: 'success',
      });
      mockRollDamage.mockReturnValue({
        rolls: [5],
        modifier: 3,
        total: 8,
        damageType: 'slashing',
      });

      const payload = { type: 'attack' as const, targetId: 'player2' };
      await handlePF2AttackAction(socket, matchId, match, attacker, attackerCombatant, payload);

      expect(mockAdvanceTurn).toHaveBeenCalled();
      expect(mockScheduleBotTurn).toHaveBeenCalled();
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          activeTurnPlayerId: 'player2',
        }),
      });
    });

    it('should use Fist weapon when no weapons equipped', async () => {
      const attacker = createPlayer({ id: 'player1', name: 'Monk' });
      const attackerChar = createPF2Character({
        id: 'char1',
        name: 'Monk',
        weapons: [],
      });
      const targetChar = createPF2Character({ id: 'char2', name: 'Goblin' });
      const attackerCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        position: { x: 0, y: 0, z: 0 },
      });
      const targetCombatant = createPF2Combatant({
        playerId: 'player2',
        characterId: 'char2',
        currentHP: 20,
        position: { x: 1, y: 0, z: 0 },
      });
      const match = createMatch({
        combatants: [attackerCombatant, targetCombatant],
        characters: [attackerChar, targetChar],
      });

      mockGetCharacterById.mockImplementation((match, id) => {
        if (id === 'char1') return attackerChar;
        if (id === 'char2') return targetChar;
        return null;
      });
      mockCalculateGridDistance.mockReturnValue(1);
      mockRollCheck.mockReturnValue({
        roll: 15,
        modifier: 6,
        total: 21,
        dc: 15,
        degree: 'success',
      });
      mockRollDamage.mockReturnValue({
        rolls: [3],
        modifier: 3,
        total: 6,
        damageType: 'bludgeoning',
      });

      const payload = { type: 'attack' as const, targetId: 'player2' };
      await handlePF2AttackAction(socket, matchId, match, attacker, attackerCombatant, payload);

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player1',
              actionsRemaining: 2,
              mapPenalty: -4,
            }),
          ]),
          log: expect.arrayContaining([
            expect.stringContaining('Fist'),
            expect.stringContaining('bludgeoning'),
          ]),
        }),
      });
    });
  });
});
