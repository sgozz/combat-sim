import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WebSocket } from 'ws';
import {
  handlePF2Grapple,
  handlePF2Trip,
  handlePF2Disarm,
  handlePF2Feint,
  handlePF2Demoralize,
} from './skill-actions';
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
const mockRollCheck = vi.fn();

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

vi.mock('../../../../shared/rulesets/pf2/rules', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/rulesets/pf2/rules')>();
  return {
    ...actual,
    rollCheck: (...args: unknown[]) => mockRollCheck(...args),
  };
});

describe('PF2 Skill Actions Handlers', () => {
  const matchId = 'match1';
  let socket: WebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    socket = createMockSocket() as unknown as WebSocket;
  });

  describe('handlePF2Grapple', () => {
    it('success applies grabbed condition and uses 1 action with MAP -5', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const athleticsSkill = { id: 's1', name: 'Athletics', ability: 'strength' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [athleticsSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 12,
        modifier: 6,
        total: 18,
        dc: 15,
        degree: 'success',
      });

      await handlePF2Grapple(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockRollCheck).toHaveBeenCalledWith(6, 15);
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player1',
              actionsRemaining: 2,
              mapPenalty: -5,
            }),
            expect.objectContaining({
              playerId: 'player2',
              conditions: expect.arrayContaining([{ condition: 'grabbed' }]),
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('Grapple')]),
        }),
      });
    });

    it('critical success applies grabbed and restrained conditions', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const athleticsSkill = { id: 's1', name: 'Athletics', ability: 'strength' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [athleticsSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 20,
        modifier: 6,
        total: 26,
        dc: 15,
        degree: 'critical_success',
      });

      await handlePF2Grapple(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player2',
              conditions: expect.arrayContaining([
                { condition: 'grabbed' },
                { condition: 'restrained' },
              ]),
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('restrained')]),
        }),
      });
    });

    it('failure costs action and MAP but applies no conditions', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const athleticsSkill = { id: 's1', name: 'Athletics', ability: 'strength' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [athleticsSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 8,
        modifier: 6,
        total: 14,
        dc: 15,
        degree: 'failure',
      });

      await handlePF2Grapple(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player1',
              actionsRemaining: 2,
              mapPenalty: -5,
            }),
            expect.objectContaining({
              playerId: 'player2',
              conditions: [],
            }),
          ]),
        }),
      });
    });

    it('critical failure applies flat_footed to attacker', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const athleticsSkill = { id: 's1', name: 'Athletics', ability: 'strength' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [athleticsSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 1,
        modifier: 6,
        total: 7,
        dc: 15,
        degree: 'critical_failure',
      });

      await handlePF2Grapple(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player1',
              actionsRemaining: 2,
              mapPenalty: -5,
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('fails')]),
        }),
      });
    });

    it('returns error when no actions remaining', async () => {
      const player = createPlayer();
      const match = createMatch({
        combatants: [createPF2Combatant({ playerId: 'player1', actionsRemaining: 0 })],
      });
      const actor = match.combatants[0];

      await handlePF2Grapple(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'No actions remaining.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });

    it('returns error when target is invalid', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      await handlePF2Grapple(socket, matchId, match, player, actor, { targetId: 'invalid' });

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'Invalid target.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });

    it('uses fortitude DC not reflex DC', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const athleticsSkill = { id: 's1', name: 'Athletics', ability: 'strength' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [athleticsSkill] });
      const targetChar = createPF2Character({
        id: 'char2',
        derived: {
          hitPoints: 20,
          armorClass: 18,
          speed: 25,
          fortitudeSave: 5,
          reflexSave: 3,
          willSave: 1,
          perception: 3,
        },
      });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 12,
        modifier: 6,
        total: 18,
        dc: 15,
        degree: 'success',
      });

      await handlePF2Grapple(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockRollCheck).toHaveBeenCalledWith(6, 15);
    });
  });

  describe('handlePF2Trip', () => {
    it('success applies prone and flat_footed conditions', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const athleticsSkill = { id: 's1', name: 'Athletics', ability: 'strength' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [athleticsSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 12,
        modifier: 6,
        total: 18,
        dc: 13,
        degree: 'success',
      });

      await handlePF2Trip(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player2',
              conditions: expect.arrayContaining([
                { condition: 'prone' },
                { condition: 'flat_footed' },
              ]),
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('prone')]),
        }),
      });
    });

    it('critical success also applies prone and flat_footed', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const athleticsSkill = { id: 's1', name: 'Athletics', ability: 'strength' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [athleticsSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 20,
        modifier: 6,
        total: 26,
        dc: 13,
        degree: 'critical_success',
      });

      await handlePF2Trip(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player2',
              conditions: expect.arrayContaining([
                { condition: 'prone' },
                { condition: 'flat_footed' },
              ]),
            }),
          ]),
        }),
      });
    });

    it('critical failure makes attacker prone', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const athleticsSkill = { id: 's1', name: 'Athletics', ability: 'strength' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [athleticsSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 1,
        modifier: 6,
        total: 7,
        dc: 13,
        degree: 'critical_failure',
      });

      await handlePF2Trip(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player1',
              conditions: expect.arrayContaining([{ condition: 'prone' }]),
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('falls prone')]),
        }),
      });
    });

    it('uses reflex DC and applies MAP -5', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const athleticsSkill = { id: 's1', name: 'Athletics', ability: 'strength' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [athleticsSkill] });
      const targetChar = createPF2Character({
        id: 'char2',
        derived: {
          hitPoints: 20,
          armorClass: 18,
          speed: 25,
          fortitudeSave: 5,
          reflexSave: 3,
          willSave: 1,
          perception: 3,
        },
      });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 12,
        modifier: 6,
        total: 18,
        dc: 13,
        degree: 'success',
      });

      await handlePF2Trip(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockRollCheck).toHaveBeenCalledWith(6, 13);
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player1',
              mapPenalty: -5,
            }),
          ]),
        }),
      });
    });

    it('returns error when no actions remaining', async () => {
      const player = createPlayer();
      const match = createMatch({
        combatants: [createPF2Combatant({ playerId: 'player1', actionsRemaining: 0 })],
      });
      const actor = match.combatants[0];

      await handlePF2Trip(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'No actions remaining.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });
  });

  describe('handlePF2Disarm', () => {
    it('success logs -2 attack penalty', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const athleticsSkill = { id: 's1', name: 'Athletics', ability: 'strength' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [athleticsSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 12,
        modifier: 6,
        total: 18,
        dc: 13,
        degree: 'success',
      });

      await handlePF2Disarm(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          log: expect.arrayContaining([expect.stringContaining('takes -2 to attacks')]),
        }),
      });
    });

    it('critical success logs weapon drop', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const athleticsSkill = { id: 's1', name: 'Athletics', ability: 'strength' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [athleticsSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 20,
        modifier: 6,
        total: 26,
        dc: 13,
        degree: 'critical_success',
      });

      await handlePF2Disarm(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          log: expect.arrayContaining([expect.stringContaining('drops their weapon')]),
        }),
      });
    });

    it('critical failure logs attacker weapon drop', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const athleticsSkill = { id: 's1', name: 'Athletics', ability: 'strength' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [athleticsSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 1,
        modifier: 6,
        total: 7,
        dc: 13,
        degree: 'critical_failure',
      });

      await handlePF2Disarm(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          log: expect.arrayContaining([expect.stringContaining('drops their weapon')]),
        }),
      });
    });

    it('applies MAP -5 and uses 1 action', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const athleticsSkill = { id: 's1', name: 'Athletics', ability: 'strength' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [athleticsSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 8,
        modifier: 6,
        total: 14,
        dc: 13,
        degree: 'failure',
      });

      await handlePF2Disarm(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player1',
              actionsRemaining: 2,
              mapPenalty: -5,
            }),
          ]),
        }),
      });
    });
  });

  describe('handlePF2Feint', () => {
    it('success applies flat_footed to target', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const deceptionSkill = { id: 's2', name: 'Deception', ability: 'charisma' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [deceptionSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 12,
        modifier: 3,
        total: 15,
        dc: 13,
        degree: 'success',
      });

      await handlePF2Feint(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player2',
              conditions: expect.arrayContaining([{ condition: 'flat_footed' }]),
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('next attack')]),
        }),
      });
    });

    it('critical success applies flat_footed to all attacks', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const deceptionSkill = { id: 's2', name: 'Deception', ability: 'charisma' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [deceptionSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 20,
        modifier: 3,
        total: 23,
        dc: 13,
        degree: 'critical_success',
      });

      await handlePF2Feint(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player2',
              conditions: expect.arrayContaining([{ condition: 'flat_footed' }]),
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('all attacks')]),
        }),
      });
    });

    it('does NOT apply MAP and uses 1 action', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const deceptionSkill = { id: 's2', name: 'Deception', ability: 'charisma' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [deceptionSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 12,
        modifier: 3,
        total: 15,
        dc: 13,
        degree: 'success',
      });

      await handlePF2Feint(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player1',
              actionsRemaining: 2,
              mapPenalty: 0,
            }),
          ]),
        }),
      });
    });

    it('uses perception DC not reflex DC', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const deceptionSkill = { id: 's2', name: 'Deception', ability: 'charisma' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [deceptionSkill] });
      const targetChar = createPF2Character({
        id: 'char2',
        derived: {
          hitPoints: 20,
          armorClass: 18,
          speed: 25,
          fortitudeSave: 5,
          reflexSave: 3,
          willSave: 1,
          perception: 3,
        },
      });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 12,
        modifier: 3,
        total: 15,
        dc: 13,
        degree: 'success',
      });

      await handlePF2Feint(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockRollCheck).toHaveBeenCalledWith(3, 13);
    });

    it('returns error when no actions remaining', async () => {
      const player = createPlayer();
      const match = createMatch({
        combatants: [createPF2Combatant({ playerId: 'player1', actionsRemaining: 0 })],
      });
      const actor = match.combatants[0];

      await handlePF2Feint(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'No actions remaining.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });
  });

  describe('handlePF2Demoralize', () => {
    it('success applies frightened 1', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const intimidationSkill = { id: 's3', name: 'Intimidation', ability: 'charisma' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [intimidationSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 12,
        modifier: 3,
        total: 15,
        dc: 11,
        degree: 'success',
      });

      await handlePF2Demoralize(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player2',
              conditions: expect.arrayContaining([{ condition: 'frightened', value: 1 }]),
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('frightened 1')]),
        }),
      });
    });

    it('critical success applies frightened 2', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const intimidationSkill = { id: 's3', name: 'Intimidation', ability: 'charisma' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [intimidationSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 20,
        modifier: 3,
        total: 23,
        dc: 11,
        degree: 'critical_success',
      });

      await handlePF2Demoralize(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player2',
              conditions: expect.arrayContaining([{ condition: 'frightened', value: 2 }]),
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('frightened 2')]),
        }),
      });
    });

    it('failure applies no condition', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const intimidationSkill = { id: 's3', name: 'Intimidation', ability: 'charisma' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [intimidationSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 8,
        modifier: 3,
        total: 11,
        dc: 11,
        degree: 'failure',
      });

      await handlePF2Demoralize(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player2',
              conditions: [],
            }),
          ]),
        }),
      });
    });

    it('does NOT apply MAP and uses 1 action', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const intimidationSkill = { id: 's3', name: 'Intimidation', ability: 'charisma' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [intimidationSkill] });
      const targetChar = createPF2Character({ id: 'char2' });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 12,
        modifier: 3,
        total: 15,
        dc: 11,
        degree: 'success',
      });

      await handlePF2Demoralize(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player1',
              actionsRemaining: 2,
              mapPenalty: 0,
            }),
          ]),
        }),
      });
    });

    it('uses will DC', async () => {
      const player = createPlayer();
      const match = createMatch();
      const actor = match.combatants[0];

      const intimidationSkill = { id: 's3', name: 'Intimidation', ability: 'charisma' as const, proficiency: 'trained' as const };
      const actorChar = createPF2Character({ id: 'char1', skills: [intimidationSkill] });
      const targetChar = createPF2Character({
        id: 'char2',
        derived: {
          hitPoints: 20,
          armorClass: 18,
          speed: 25,
          fortitudeSave: 5,
          reflexSave: 3,
          willSave: 1,
          perception: 3,
        },
      });

      mockGetCharacterById.mockReturnValueOnce(actorChar).mockReturnValueOnce(targetChar);
      mockRollCheck.mockReturnValue({
        roll: 12,
        modifier: 3,
        total: 15,
        dc: 11,
        degree: 'success',
      });

      await handlePF2Demoralize(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockRollCheck).toHaveBeenCalledWith(3, 11);
    });

    it('returns error when no actions remaining', async () => {
      const player = createPlayer();
      const match = createMatch({
        combatants: [createPF2Combatant({ playerId: 'player1', actionsRemaining: 0 })],
      });
      const actor = match.combatants[0];

      await handlePF2Demoralize(socket, matchId, match, player, actor, { targetId: 'player2' });

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'No actions remaining.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });
  });
});
