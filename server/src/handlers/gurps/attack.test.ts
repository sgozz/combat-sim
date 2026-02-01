import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import { resolveDefenseChoice, handleAttackAction } from './attack';
import {
  createGurpsCombatant,
  createGurpsCharacter,
  createMatch,
  createMockSocket,
  createPlayer,
} from './__tests__/testUtils';

const mockSendMessage = vi.fn();
const mockSendToMatch = vi.fn();
const mockUpdateMatchState = vi.fn();
const mockGetCharacterById = vi.fn();
const mockCalculateHexDistance = vi.fn();
const mockGetCombatantByPlayerId = vi.fn();
const mockFindRetreatHex = vi.fn();
const mockCheckVictory = vi.fn();
const mockAdvanceTurn = vi.fn();
const mockScheduleBotTurn = vi.fn();
const mockResolveAttackRoll = vi.fn();
const mockResolveDefenseRoll = vi.fn();
const mockRollDamage = vi.fn();
const mockResolveDefense = vi.fn();
const mockGetAttackerManeuverInfo = vi.fn();
const mockApplyDamageToTarget = vi.fn();
const mockClearDefenseTimeout = vi.fn();
const mockFormatRoll = vi.fn();
const mockCheckWaitTriggers = vi.fn();
const mockExecuteWaitInterrupt = vi.fn();

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
  calculateHexDistance: (...args: unknown[]) => mockCalculateHexDistance(...args),
  getCombatantByPlayerId: (...args: unknown[]) => mockGetCombatantByPlayerId(...args),
  findRetreatHex: (...args: unknown[]) => mockFindRetreatHex(...args),
  checkVictory: (...args: unknown[]) => mockCheckVictory(...args),
  calculateFacing: () => 0,
}));

vi.mock('../../bot', () => ({
  scheduleBotTurn: (...args: unknown[]) => mockScheduleBotTurn(...args),
  chooseBotDefense: vi.fn(),
}));

vi.mock('../../rulesetHelpers', () => ({
  advanceTurn: (...args: unknown[]) => mockAdvanceTurn(...args),
}));

vi.mock('../../timers', () => ({
  clearDefenseTimeout: (...args: unknown[]) => mockClearDefenseTimeout(...args),
}));

vi.mock('../shared/damage', () => ({
  formatRoll: (...args: unknown[]) => mockFormatRoll(...args),
  applyDamageToTarget: (...args: unknown[]) => mockApplyDamageToTarget(...args),
}));

vi.mock('../pf2/attack', () => ({
  handlePF2AttackAction: vi.fn(),
}));

vi.mock('./wait-interrupt', () => ({
  executeWaitInterrupt: (...args: unknown[]) => mockExecuteWaitInterrupt(...args),
}));

vi.mock('../../../../shared/rulesets/gurps/rules', () => ({
  quickContest: vi.fn(),
  getDefenseOptions: vi.fn(),
  checkWaitTriggers: (...args: unknown[]) => mockCheckWaitTriggers(...args),
}));

vi.mock('../../../../shared/rulesets/serverAdapter', () => ({
  isPf2Match: () => false,
  getServerAdapter: () => ({
    rulesetId: 'gurps',
    gridToHex: (pos: { x: number; y: number; z: number }) => ({ q: pos.x, r: pos.y }),
    hexToGrid: (hex: { q: number; r: number }) => ({ x: hex.q, y: hex.r, z: 0 }),
    canAttackAtDistance: () => true,
    parseReach: () => ({ min: 1, max: 1 }),
    getCloseCombatAttackModifiers: () => ({ canAttack: true }),
    rollDamage: (...args: unknown[]) => mockRollDamage(...args),
    resolveAttackRoll: (...args: unknown[]) => mockResolveAttackRoll(...args),
    resolveDefenseRoll: (...args: unknown[]) => mockResolveDefenseRoll(...args),
    combat: {
      resolveDefense: (...args: unknown[]) => mockResolveDefense(...args),
      getAttackerManeuverInfo: (...args: unknown[]) => mockGetAttackerManeuverInfo(...args),
      getDefenderManeuverInfo: () => ({ canDefend: true }),
      calculateEffectiveSkill: ({ baseSkill }: { baseSkill: number }) => baseSkill,
      selectBotDefense: vi.fn(),
      applyDodgeAndDrop: (c: typeof createGurpsCombatant) => ({ ...c, posture: 'prone' as const }),
    },
    damage: {
      getLocationDR: () => 2,
      applyDamageMultiplier: (dmg: number) => dmg,
      getHitLocationWoundingMultiplier: () => 1,
      rollHTCheck: () => ({ success: true }),
    },
  }),
}));

vi.mock('../../../../shared/rulesets/defaults', () => ({
  assertRulesetId: (id: string) => id as 'gurps' | 'pf2',
}));

describe('GURPS Attack Handler', () => {
  let socket: WebSocket;
  let matchId: string;

  beforeEach(() => {
    vi.clearAllMocks();
    socket = createMockSocket() as unknown as WebSocket;
    matchId = 'match1';
    mockCheckVictory.mockImplementation((state) => state);
    mockAdvanceTurn.mockImplementation((state) => ({
      ...state,
      activeTurnPlayerId: 'player2',
    }));
    mockFormatRoll.mockImplementation((roll, label) => `(${label} ${roll.target} vs ${roll.roll}: ${roll.success ? 'Success' : 'Failed'} by ${Math.abs(roll.margin)})`);
    mockCheckWaitTriggers.mockReturnValue(null);
    mockExecuteWaitInterrupt.mockImplementation((match) => match);
  });

  describe('resolveDefenseChoice', () => {
    it('should successfully defend with dodge and prevent damage', async () => {
      const attackerChar = createGurpsCharacter({ id: 'char1', name: 'Attacker' });
      const defenderChar = createGurpsCharacter({ id: 'char2', name: 'Defender' });
      
      const attackerCombatant = createGurpsCombatant({
        playerId: 'player1',
        characterId: 'char1',
        position: { x: 0, y: 0, z: 0 },
        attacksRemaining: 1,
      });
      
      const defenderCombatant = createGurpsCombatant({
        playerId: 'player2',
        characterId: 'char2',
        position: { x: 1, y: 0, z: 0 },
        currentHP: 11,
        defensesThisTurn: 0,
      });

      const match = createMatch({
        id: matchId,
        combatants: [attackerCombatant, defenderCombatant],
        characters: [attackerChar, defenderChar],
        pendingDefense: {
          attackerId: 'player1',
          defenderId: 'player2',
          attackRoll: 10,
          attackMargin: 4,
          hitLocation: 'torso',
          weapon: 'Broadsword',
          damage: '1d6+1',
          damageType: 'cutting',
          deceptivePenalty: 0,
          timestamp: Date.now(),
        },
      });

      mockResolveDefense.mockReturnValue({
        defenseLabel: 'Dodge',
        finalDefenseValue: 8,
        canRetreat: true,
        parryWeaponName: null,
      });

      mockResolveDefenseRoll.mockReturnValue({
        defended: true,
        roll: { target: 8, roll: 6, success: true, margin: 2, dice: [6] },
      });

      mockFindRetreatHex.mockReturnValue({ x: 2, y: 0, z: 0 });

      const choice = {
        type: 'defend' as const,
        defenseType: 'dodge' as const,
        retreat: true,
        dodgeAndDrop: false,
      };

      await resolveDefenseChoice(matchId, match, choice);

      expect(mockClearDefenseTimeout).toHaveBeenCalledWith(matchId);
      expect(mockResolveDefense).toHaveBeenCalled();
      expect(mockResolveDefenseRoll).toHaveBeenCalledWith(8);
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'visual_effect',
        matchId,
        effect: expect.objectContaining({
          type: 'defend',
          attackerId: 'player1',
          targetId: 'player2',
        }),
      });
      expect(mockUpdateMatchState).toHaveBeenCalled();
    });

    it('should take full damage when defense fails', async () => {
      const attackerChar = createGurpsCharacter({ id: 'char1', name: 'Attacker' });
      const defenderChar = createGurpsCharacter({ id: 'char2', name: 'Defender' });
      
      const attackerCombatant = createGurpsCombatant({
        playerId: 'player1',
        characterId: 'char1',
        position: { x: 0, y: 0, z: 0 },
        attacksRemaining: 1,
      });
      
      const defenderCombatant = createGurpsCombatant({
        playerId: 'player2',
        characterId: 'char2',
        position: { x: 1, y: 0, z: 0 },
        currentHP: 11,
        defensesThisTurn: 0,
      });

      const match = createMatch({
        id: matchId,
        combatants: [attackerCombatant, defenderCombatant],
        characters: [attackerChar, defenderChar],
        pendingDefense: {
          attackerId: 'player1',
          defenderId: 'player2',
          attackRoll: 10,
          attackMargin: 4,
          hitLocation: 'torso',
          weapon: 'Broadsword',
          damage: '1d6+1',
          damageType: 'cutting',
          deceptivePenalty: 0,
          timestamp: Date.now(),
        },
      });

      mockResolveDefense.mockReturnValue({
        defenseLabel: 'Dodge',
        finalDefenseValue: 8,
        canRetreat: true,
        parryWeaponName: null,
      });

      mockResolveDefenseRoll.mockReturnValue({
        defended: false,
        roll: { target: 8, roll: 12, success: false, margin: -4, dice: [12] },
      });

      mockRollDamage.mockReturnValue({
        total: 5,
        rolls: [4],
        modifier: 1,
      });

      mockApplyDamageToTarget.mockReturnValue({
        updatedCombatants: [
          attackerCombatant,
          { ...defenderCombatant, currentHP: 6 },
        ],
        finalDamage: 5,
        logEntry: '(1d6+1: [4]+1 - 2 DR cutting torso = 5)',
        fellUnconscious: false,
        majorWound: false,
        majorWoundStunned: false,
      });

      const choice = {
        type: 'defend' as const,
        defenseType: 'dodge' as const,
        retreat: false,
        dodgeAndDrop: false,
      };

      await resolveDefenseChoice(matchId, match, choice);

      expect(mockApplyDamageToTarget).toHaveBeenCalled();
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'visual_effect',
        matchId,
        effect: expect.objectContaining({
          type: 'damage',
          value: 5,
        }),
      });
    });

    it('should apply full damage when defender chooses no defense', async () => {
      const attackerChar = createGurpsCharacter({ id: 'char1', name: 'Attacker' });
      const defenderChar = createGurpsCharacter({ id: 'char2', name: 'Defender' });
      
      const attackerCombatant = createGurpsCombatant({
        playerId: 'player1',
        characterId: 'char1',
        position: { x: 0, y: 0, z: 0 },
        attacksRemaining: 1,
      });
      
      const defenderCombatant = createGurpsCombatant({
        playerId: 'player2',
        characterId: 'char2',
        position: { x: 1, y: 0, z: 0 },
        currentHP: 11,
      });

      const match = createMatch({
        id: matchId,
        combatants: [attackerCombatant, defenderCombatant],
        characters: [attackerChar, defenderChar],
        pendingDefense: {
          attackerId: 'player1',
          defenderId: 'player2',
          attackRoll: 10,
          attackMargin: 4,
          hitLocation: 'torso',
          weapon: 'Broadsword',
          damage: '1d6+1',
          damageType: 'cutting',
          deceptivePenalty: 0,
          timestamp: Date.now(),
        },
      });

      mockRollDamage.mockReturnValue({
        total: 6,
        rolls: [5],
        modifier: 1,
      });

      mockApplyDamageToTarget.mockReturnValue({
        updatedCombatants: [
          attackerCombatant,
          { ...defenderCombatant, currentHP: 5 },
        ],
        finalDamage: 6,
        logEntry: '(1d6+1: [5]+1 - 2 DR cutting torso = 6)',
        fellUnconscious: false,
        majorWound: false,
        majorWoundStunned: false,
      });

      const choice = {
        type: 'defend' as const,
        defenseType: 'none' as const,
        retreat: false,
        dodgeAndDrop: false,
      };

      await resolveDefenseChoice(matchId, match, choice);

      expect(mockRollDamage).toHaveBeenCalledWith('1d6+1');
      expect(mockApplyDamageToTarget).toHaveBeenCalled();
      expect(mockUpdateMatchState).toHaveBeenCalled();
    });
  });

  describe('handleAttackAction', () => {
    it('should hit target and deal damage on successful attack roll', async () => {
      const attacker = createPlayer({ id: 'player1', name: 'Attacker' });
      const attackerChar = createGurpsCharacter({
        id: 'char1',
        name: 'Attacker',
        attributes: { strength: 12, dexterity: 12, intelligence: 10, health: 11 },
      });
      const targetChar = createGurpsCharacter({
        id: 'char2',
        name: 'Defender',
        attributes: { strength: 11, dexterity: 12, intelligence: 10, health: 11 },
      });
      
      const attackerCombatant = createGurpsCombatant({
        playerId: 'player1',
        characterId: 'char1',
        position: { x: 0, y: 0, z: 0 },
        maneuver: 'attack',
        attacksRemaining: 1,
        equipped: [{ equipmentId: 'sword1', slot: 'right_hand', ready: true }],
      });
      
      const targetCombatant = createGurpsCombatant({
        playerId: 'player2',
        characterId: 'char2',
        position: { x: 1, y: 0, z: 0 },
        currentHP: 11,
        facing: 0,
      });

      const match = createMatch({
        id: matchId,
        combatants: [attackerCombatant, targetCombatant],
        characters: [attackerChar, targetChar],
      });

      mockGetCombatantByPlayerId.mockReturnValue(attackerCombatant);
      mockGetCharacterById.mockImplementation((_, id) => {
        if (id === 'char1') return attackerChar;
        if (id === 'char2') return targetChar;
        return null;
      });
      mockCalculateHexDistance.mockReturnValue(1);
      mockResolveAttackRoll.mockReturnValue({
        hit: true,
        critical: false,
        criticalMiss: false,
        roll: { target: 14, roll: 10, success: true, margin: 4, dice: [10] },
      });

      const payload = { type: 'attack' as const, targetId: 'player2' };
      await handleAttackAction(socket, matchId, match, attacker, attackerCombatant, payload);

      expect(mockResolveAttackRoll).toHaveBeenCalledWith(14);
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          pendingDefense: expect.objectContaining({
            attackerId: 'player1',
            defenderId: 'player2',
            weapon: 'Broadsword',
            damage: '1d6+1',
          }),
          log: expect.arrayContaining([
            expect.stringContaining('attacks'),
            expect.stringContaining('Defender'),
            expect.stringContaining('awaiting defense'),
          ]),
        }),
      });
    });

    it('should miss target on failed attack roll', async () => {
      const attacker = createPlayer({ id: 'player1', name: 'Attacker' });
      const attackerChar = createGurpsCharacter({ id: 'char1', name: 'Attacker' });
      const targetChar = createGurpsCharacter({ id: 'char2', name: 'Defender' });
      
      const attackerCombatant = createGurpsCombatant({
        playerId: 'player1',
        characterId: 'char1',
        position: { x: 0, y: 0, z: 0 },
        maneuver: 'attack',
        attacksRemaining: 1,
        equipped: [{ equipmentId: 'sword1', slot: 'right_hand', ready: true }],
      });
      
      const targetCombatant = createGurpsCombatant({
        playerId: 'player2',
        characterId: 'char2',
        position: { x: 1, y: 0, z: 0 },
        currentHP: 11,
      });

      const match = createMatch({
        id: matchId,
        combatants: [attackerCombatant, targetCombatant],
        characters: [attackerChar, targetChar],
      });

      mockGetCombatantByPlayerId.mockReturnValue(attackerCombatant);
      mockGetCharacterById.mockImplementation((_, id) => {
        if (id === 'char1') return attackerChar;
        if (id === 'char2') return targetChar;
        return null;
      });
      mockCalculateHexDistance.mockReturnValue(1);
      mockResolveAttackRoll.mockReturnValue({
        hit: false,
        critical: false,
        criticalMiss: false,
        roll: { target: 14, roll: 16, success: false, margin: -2, dice: [16] },
      });

      const payload = { type: 'attack' as const, targetId: 'player2' };
      await handleAttackAction(socket, matchId, match, attacker, attackerCombatant, payload);

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'visual_effect',
        matchId,
        effect: expect.objectContaining({
          type: 'miss',
        }),
      });
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          log: expect.arrayContaining([
            expect.stringContaining('Miss'),
          ]),
        }),
      });
    });

    it('should apply damage bonus for All-Out Attack (Strong)', async () => {
      const attacker = createPlayer({ id: 'player1', name: 'Attacker' });
      const attackerChar = createGurpsCharacter({ id: 'char1', name: 'Attacker' });
      const targetChar = createGurpsCharacter({ id: 'char2', name: 'Defender' });
      
      const attackerCombatant = createGurpsCombatant({
        playerId: 'player1',
        characterId: 'char1',
        position: { x: 0, y: 0, z: 0 },
        maneuver: 'all_out_attack',
        aoaVariant: 'strong',
        attacksRemaining: 1,
        equipped: [{ equipmentId: 'sword1', slot: 'right_hand', ready: true }],
      });
      
      const targetCombatant = createGurpsCombatant({
        playerId: 'player2',
        characterId: 'char2',
        position: { x: 1, y: 0, z: 0 },
        currentHP: 11,
        facing: 0,
      });

      const match = createMatch({
        id: matchId,
        combatants: [attackerCombatant, targetCombatant],
        characters: [attackerChar, targetChar],
      });

      mockGetCombatantByPlayerId.mockReturnValue(attackerCombatant);
      mockGetCharacterById.mockImplementation((_, id) => {
        if (id === 'char1') return attackerChar;
        if (id === 'char2') return targetChar;
        return null;
      });
      mockCalculateHexDistance.mockReturnValue(1);
      mockResolveAttackRoll.mockReturnValue({
        hit: true,
        critical: false,
        criticalMiss: false,
        roll: { target: 14, roll: 10, success: true, margin: 4, dice: [10] },
      });
      mockGetAttackerManeuverInfo.mockReturnValue({
        canRapidStrike: false,
        isMultiAttack: false,
        aoaDamageBonus: 2,
      });

      const payload = { type: 'attack' as const, targetId: 'player2' };
      await handleAttackAction(socket, matchId, match, attacker, attackerCombatant, payload);

      expect(mockGetAttackerManeuverInfo).toHaveBeenCalledWith(attackerCombatant);
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          pendingDefense: expect.objectContaining({
            attackerId: 'player1',
          }),
        }),
      });
    });
  });
});
