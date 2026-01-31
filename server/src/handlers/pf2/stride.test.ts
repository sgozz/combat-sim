import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import { handlePF2RequestMove, handlePF2Stride } from './stride';
import { createPF2Combatant, createMatch, createMockSocket, createPlayer, createPF2Character } from './__tests__/testUtils';

const mockSendMessage = vi.fn();
const mockSendToMatch = vi.fn();
const mockUpdateMatchState = vi.fn();
const mockGetCharacterById = vi.fn();
const mockGetReachableSquares = vi.fn();
const mockGridToHex = vi.fn();
const mockGetAoOReactors = vi.fn();
const mockExecuteAoOStrike = vi.fn();

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
    getReachableSquares: (...args: unknown[]) => mockGetReachableSquares(...args),
    gridToHex: (...args: unknown[]) => mockGridToHex(...args),
  };
});

vi.mock('./reaction', () => ({
  getAoOReactors: (...args: unknown[]) => mockGetAoOReactors(...args),
  executeAoOStrike: (...args: unknown[]) => mockExecuteAoOStrike(...args),
}));

describe('handlePF2RequestMove', () => {
  let socket: WebSocket;
  const matchId = 'match1';

  beforeEach(() => {
    vi.clearAllMocks();
    socket = createMockSocket() as unknown as WebSocket;
  });

  it('should set reachableHexes on match state based on speed', async () => {
    const player = createPlayer({ id: 'player1' });
    const actorCombatant = createPF2Combatant({
      playerId: 'player1',
      characterId: 'char1',
      position: { x: 0, y: 0, z: 0 },
      actionsRemaining: 3,
    });
    const character = createPF2Character({
      id: 'char1',
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
    const match = createMatch({
      combatants: [actorCombatant],
      players: [player],
    });

    mockGetCharacterById.mockReturnValue(character);
    mockGridToHex.mockReturnValue({ q: 0, r: 0 });

    const reachableMap = new Map([
      ['1,0', { position: { q: 1, r: 0 }, cost: 5 }],
      ['0,1', { position: { q: 0, r: 1 }, cost: 5 }],
    ]);
    mockGetReachableSquares.mockReturnValue(reachableMap);

    await handlePF2RequestMove(socket, matchId, match, player, actorCombatant, { mode: 'stride' });

    expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
      type: 'match_state',
      state: expect.objectContaining({
        reachableHexes: expect.arrayContaining([
          expect.objectContaining({ q: 1, r: 0, cost: 5 }),
          expect.objectContaining({ q: 0, r: 1, cost: 5 }),
        ]),
      }),
    });
    expect(mockUpdateMatchState).toHaveBeenCalled();
  });

  it('should send error if no actions remaining', async () => {
    const player = createPlayer({ id: 'player1' });
    const actorCombatant = createPF2Combatant({
      playerId: 'player1',
      actionsRemaining: 0,
    });
    const match = createMatch({ combatants: [actorCombatant] });

    await handlePF2RequestMove(socket, matchId, match, player, actorCombatant, { mode: 'stride' });

    expect(mockSendMessage).toHaveBeenCalledWith(socket, {
      type: 'error',
      message: 'No actions remaining.',
    });
    expect(mockUpdateMatchState).not.toHaveBeenCalled();
  });
});

describe('handlePF2Stride', () => {
  let socket: WebSocket;
  const matchId = 'match1';

  beforeEach(() => {
    vi.clearAllMocks();
    socket = createMockSocket() as unknown as WebSocket;
  });

  it('should move to destination when reachable and no AoO', async () => {
    const player = createPlayer({ id: 'player1', name: 'Fighter' });
    const actorCombatant = createPF2Combatant({
      playerId: 'player1',
      characterId: 'char1',
      position: { x: 0, y: 0, z: 0 },
      actionsRemaining: 3,
    });
    const character = createPF2Character({ id: 'char1' });
    const match = createMatch({
      combatants: [actorCombatant],
      players: [player],
    });

    mockGetCharacterById.mockReturnValue(character);
    mockGridToHex.mockReturnValue({ q: 0, r: 0 });

    const reachableMap = new Map([
      ['2,1', { position: { q: 2, r: 1 }, cost: 10 }],
    ]);
    mockGetReachableSquares.mockReturnValue(reachableMap);
    mockGetAoOReactors.mockReturnValue([]);

    await handlePF2Stride(socket, matchId, match, player, actorCombatant, { to: { q: 2, r: 1 } });

    expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
      type: 'match_state',
      state: expect.objectContaining({
        combatants: expect.arrayContaining([
          expect.objectContaining({
            playerId: 'player1',
            position: { x: 2, y: 0, z: 1 },
            actionsRemaining: 2,
          }),
        ]),
        log: expect.arrayContaining([expect.stringContaining('strides to (2, 1)')]),
        reachableHexes: undefined,
      }),
    });
    expect(mockUpdateMatchState).toHaveBeenCalled();
  });

  it('should send error if destination not reachable', async () => {
    const player = createPlayer({ id: 'player1' });
    const actorCombatant = createPF2Combatant({
      playerId: 'player1',
      characterId: 'char1',
      actionsRemaining: 3,
    });
    const character = createPF2Character({ id: 'char1' });
    const match = createMatch({ combatants: [actorCombatant] });

    mockGetCharacterById.mockReturnValue(character);
    mockGridToHex.mockReturnValue({ q: 0, r: 0 });

    const reachableMap = new Map([
      ['1,0', { position: { q: 1, r: 0 }, cost: 5 }],
    ]);
    mockGetReachableSquares.mockReturnValue(reachableMap);

    await handlePF2Stride(socket, matchId, match, player, actorCombatant, { to: { q: 10, r: 10 } });

    expect(mockSendMessage).toHaveBeenCalledWith(socket, {
      type: 'error',
      message: 'Destination not reachable.',
    });
    expect(mockUpdateMatchState).not.toHaveBeenCalled();
  });

  it('should send error if no actions remaining', async () => {
    const player = createPlayer({ id: 'player1' });
    const actorCombatant = createPF2Combatant({
      playerId: 'player1',
      actionsRemaining: 0,
    });
    const match = createMatch({ combatants: [actorCombatant] });

    await handlePF2Stride(socket, matchId, match, player, actorCombatant, { to: { q: 1, r: 0 } });

    expect(mockSendMessage).toHaveBeenCalledWith(socket, {
      type: 'error',
      message: 'No actions remaining.',
    });
    expect(mockUpdateMatchState).not.toHaveBeenCalled();
  });

  it('should auto-execute bot AoO then complete stride if still alive', async () => {
    const player = createPlayer({ id: 'player1', name: 'Fighter' });
    const botPlayer = createPlayer({ id: 'player2', name: 'Bot', isBot: true });
    const actorCombatant = createPF2Combatant({
      playerId: 'player1',
      characterId: 'char1',
      position: { x: 0, y: 0, z: 0 },
      actionsRemaining: 3,
      currentHP: 20,
    });
    const botCombatant = createPF2Combatant({
      playerId: 'player2',
      characterId: 'char2',
      position: { x: 1, y: 0, z: 0 },
      reactionAvailable: true,
    });
    const character = createPF2Character({ id: 'char1' });
    const match = createMatch({
      combatants: [actorCombatant, botCombatant],
      players: [player, botPlayer],
    });

    mockGetCharacterById.mockReturnValue(character);
    mockGridToHex.mockReturnValue({ q: 0, r: 0 });

    const reachableMap = new Map([
      ['2,0', { position: { q: 2, r: 0 }, cost: 10 }],
    ]);
    mockGetReachableSquares.mockReturnValue(reachableMap);
    mockGetAoOReactors.mockReturnValue([botCombatant]);

    const stateAfterAoO = {
      ...match,
      combatants: [
        { ...actorCombatant, currentHP: 15, actionsRemaining: 2 },
        { ...botCombatant, reactionAvailable: false },
      ],
      log: ['Bot hits Fighter for 5 damage'],
    };
    mockExecuteAoOStrike.mockReturnValue(stateAfterAoO);

    await handlePF2Stride(socket, matchId, match, player, actorCombatant, { to: { q: 2, r: 0 } });

    expect(mockExecuteAoOStrike).toHaveBeenCalledWith(
      expect.objectContaining({
        combatants: expect.arrayContaining([
          expect.objectContaining({ playerId: 'player1', actionsRemaining: 2 }),
        ]),
      }),
      matchId,
      botCombatant,
      expect.objectContaining({ playerId: 'player1' })
    );

    expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
      type: 'match_state',
      state: expect.objectContaining({
        combatants: expect.arrayContaining([
          expect.objectContaining({
            playerId: 'player1',
            position: { x: 2, y: 0, z: 0 },
            currentHP: 15,
          }),
        ]),
        log: expect.arrayContaining([expect.stringContaining('strides to (2, 0)')]),
        reachableHexes: undefined,
      }),
    });
  });

  it('should interrupt stride if bot AoO kills the actor', async () => {
    const player = createPlayer({ id: 'player1', name: 'Fighter' });
    const botPlayer = createPlayer({ id: 'player2', name: 'Bot', isBot: true });
    const actorCombatant = createPF2Combatant({
      playerId: 'player1',
      characterId: 'char1',
      position: { x: 0, y: 0, z: 0 },
      actionsRemaining: 3,
      currentHP: 5,
    });
    const botCombatant = createPF2Combatant({
      playerId: 'player2',
      characterId: 'char2',
      position: { x: 1, y: 0, z: 0 },
      reactionAvailable: true,
    });
    const character = createPF2Character({ id: 'char1' });
    const match = createMatch({
      combatants: [actorCombatant, botCombatant],
      players: [player, botPlayer],
    });

    mockGetCharacterById.mockReturnValue(character);
    mockGridToHex.mockReturnValue({ q: 0, r: 0 });

    const reachableMap = new Map([
      ['2,0', { position: { q: 2, r: 0 }, cost: 10 }],
    ]);
    mockGetReachableSquares.mockReturnValue(reachableMap);
    mockGetAoOReactors.mockReturnValue([botCombatant]);

    const stateAfterAoO = {
      ...match,
      combatants: [
        { ...actorCombatant, currentHP: 0, actionsRemaining: 2, statusEffects: ['unconscious'] },
        { ...botCombatant, reactionAvailable: false },
      ],
      log: ['Bot kills Fighter'],
    };
    mockExecuteAoOStrike.mockReturnValue(stateAfterAoO);

    await handlePF2Stride(socket, matchId, match, player, actorCombatant, { to: { q: 2, r: 0 } });

    expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
      type: 'match_state',
      state: expect.objectContaining({
        combatants: expect.arrayContaining([
          expect.objectContaining({
            playerId: 'player1',
            position: { x: 0, y: 0, z: 0 },
            currentHP: 0,
          }),
        ]),
        log: expect.arrayContaining([expect.stringContaining('stride is interrupted')]),
        reachableHexes: undefined,
      }),
    });
  });

  it('should set pendingReaction when player reactor has AoO', async () => {
    const player = createPlayer({ id: 'player1', name: 'Fighter' });
    const humanPlayer = createPlayer({ id: 'player2', name: 'Rogue', isBot: false });
    const actorCombatant = createPF2Combatant({
      playerId: 'player1',
      characterId: 'char1',
      position: { x: 0, y: 0, z: 0 },
      actionsRemaining: 3,
    });
    const reactorCombatant = createPF2Combatant({
      playerId: 'player2',
      characterId: 'char2',
      position: { x: 1, y: 0, z: 0 },
      reactionAvailable: true,
    });
    const character = createPF2Character({ id: 'char1' });
    const match = createMatch({
      combatants: [actorCombatant, reactorCombatant],
      players: [player, humanPlayer],
    });

    mockGetCharacterById.mockReturnValue(character);
    mockGridToHex.mockReturnValue({ q: 0, r: 0 });

    const reachableMap = new Map([
      ['2,0', { position: { q: 2, r: 0 }, cost: 10 }],
    ]);
    mockGetReachableSquares.mockReturnValue(reachableMap);
    mockGetAoOReactors.mockReturnValue([reactorCombatant]);

    await handlePF2Stride(socket, matchId, match, player, actorCombatant, { to: { q: 2, r: 0 } });

    expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
      type: 'match_state',
      state: expect.objectContaining({
        combatants: expect.arrayContaining([
          expect.objectContaining({ playerId: 'player1', actionsRemaining: 2 }),
        ]),
        pendingReaction: expect.objectContaining({
          reactorId: 'player2',
          triggerId: 'player1',
          triggerAction: 'stride',
          originalPayload: { type: 'pf2_stride', to: { q: 2, r: 0 } },
        }),
        reachableHexes: undefined,
      }),
    });

    expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
      type: 'reaction_prompt',
      matchId,
      reactorId: 'player2',
      triggerAction: 'stride',
    });

    const calls = mockSendToMatch.mock.calls;
    const matchStateCalls = calls.filter((call: unknown[]) =>
      typeof call[1] === 'object' && call[1] !== null && 'type' in call[1] && call[1].type === 'match_state'
    );
    const firstStateCall = matchStateCalls[0][1] as { state: { combatants: Array<{ position: { x: number } }> } };
    expect(firstStateCall.state.combatants[0].position.x).toBe(0);
  });
});
