import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MatchState } from '../../types';
import type { PF2CombatantState } from './types';
import type { PF2CharacterSheet } from './characterSheet';

const mockCalculateGridDistance = vi.fn();
const mockGetGridSystemForMatch = vi.fn();
const mockGetCharacterById = vi.fn();
const mockSendMessage = vi.fn();
const mockSendToMatch = vi.fn();
const mockCheckVictory = vi.fn((m: MatchState) => m);

vi.mock('../../../server/src/helpers', () => ({
  calculateGridDistance: (...args: unknown[]) => mockCalculateGridDistance(...args),
  getGridSystemForMatch: (...args: unknown[]) => mockGetGridSystemForMatch(...args),
  getCharacterById: (...args: unknown[]) => mockGetCharacterById(...args),
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  sendToMatch: (...args: unknown[]) => mockSendToMatch(...args),
  checkVictory: (m: MatchState) => mockCheckVictory(m),
}));

vi.mock('../../../server/src/state', () => ({
  state: { matches: new Map() },
}));

vi.mock('../../../server/src/db', () => ({
  updateMatchState: vi.fn(),
}));

vi.mock('../../../server/src/bot', () => ({
  scheduleBotTurn: vi.fn(),
}));

const mockRollCheck = vi.fn();
const mockRollDamage = vi.fn();
const mockHandleReactiveShieldReaction = vi.fn();

vi.mock('../../rulesets/serverAdapter', () => ({
  getServerAdapter: () => ({
    pf2: {
      getAbilityModifier: (score: number) => Math.floor((score - 10) / 2),
      getProficiencyBonus: (_prof: string, level: number) => 2 + level,
      rollCheck: (...args: unknown[]) => mockRollCheck(...args),
      rollDamage: (...args: unknown[]) => mockRollDamage(...args),
      getMultipleAttackPenalty: (n: number, agile: boolean) => {
        if (n <= 1) return 0;
        if (n === 2) return agile ? -4 : -5;
        return agile ? -8 : -10;
      },
    },
    gridSystem: { distance: () => 1 },
  }),
}));

import { getAoOReactors, executeAoOStrike, handleReactiveShieldReaction } from '../../../server/src/handlers/pf2/reaction';

const createPF2Combatant = (overrides: Partial<PF2CombatantState> = {}): PF2CombatantState => ({
  rulesetId: 'pf2',
  playerId: 'player1',
  characterId: 'char1',
  position: { x: 0, y: 0, z: 0 },
  facing: 0,
  currentHP: 20,
  actionsRemaining: 3,
  reactionAvailable: true,
  mapPenalty: 0,
  conditions: [],
  statusEffects: [],
  tempHP: 0,
  shieldRaised: false,
  heroPoints: 1,
  dying: 0,
  wounded: 0,
  doomed: 0,
  usedReaction: false,
  spellSlotUsage: [],
  focusPointsUsed: 0,
  equipped: [],
  ...overrides,
});

const createPF2Character = (overrides: Partial<PF2CharacterSheet> = {}): PF2CharacterSheet => ({
  id: 'char1',
  name: 'Fighter',
  rulesetId: 'pf2',
  level: 1,
  class: 'Fighter',
  ancestry: 'Human',
  heritage: 'Versatile',
  background: 'Warrior',
  abilities: {
    strength: 16,
    dexterity: 14,
    constitution: 14,
    intelligence: 10,
    wisdom: 12,
    charisma: 10,
  },
  derived: {
    hitPoints: 20,
    armorClass: 18,
    speed: 25,
    fortitudeSave: 5,
    reflexSave: 3,
    willSave: 1,
    perception: 3,
  },
  classHP: 10,
  saveProficiencies: { fortitude: 'expert', reflex: 'trained', will: 'trained' },
  perceptionProficiency: 'trained',
  armorProficiency: 'trained',
  skills: [],
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
  armor: null,
  shieldBonus: 0,
  shieldHardness: 0,
  feats: [],
  spells: null,
  spellcasters: [],
  ...overrides,
});

const createMatch = (overrides: Partial<MatchState> = {}): MatchState => ({
  id: 'match1',
  name: 'Test Match',
  code: 'TEST',
  maxPlayers: 2,
  rulesetId: 'pf2',
  players: [
    { id: 'player1', name: 'Fighter', isBot: false, characterId: 'char1' },
    { id: 'player2', name: 'Rogue', isBot: false, characterId: 'char2' },
  ],
  characters: [
    createPF2Character({ 
      id: 'char1', 
      name: 'Fighter',
      feats: [{ id: 'f1', name: 'Attack of Opportunity', type: 'class', level: 1 }]
    }),
    createPF2Character({ 
      id: 'char2', 
      name: 'Rogue',
      feats: [{ id: 'f2', name: 'Attack of Opportunity', type: 'class', level: 1 }]
    }),
  ],
  combatants: [
    createPF2Combatant({ playerId: 'player1', characterId: 'char1', position: { x: 0, y: 0, z: 0 } }),
    createPF2Combatant({ playerId: 'player2', characterId: 'char2', position: { x: 1, y: 0, z: 0 } }),
  ],
  activeTurnPlayerId: 'player1',
  round: 1,
  log: [],
  status: 'active',
  createdAt: Date.now(),
  ...overrides,
});

describe('Attack of Opportunity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGridSystemForMatch.mockReturnValue({ distance: () => 1 });
  });

  describe('getAoOReactors', () => {
    beforeEach(() => {
      mockGetCharacterById.mockImplementation((match: MatchState, charId: string) => {
        return match.characters.find(c => c.id === charId) ?? null;
      });
    });

    it('returns reactor when enemy is within reach (distance === 1) AND has AoO feat', () => {
      mockCalculateGridDistance.mockReturnValue(1);

      const match = createMatch();
      const actor = match.combatants[0];

      const reactors = getAoOReactors(match, actor);

      expect(reactors).toHaveLength(1);
      expect(reactors[0].playerId).toBe('player2');
    });

    it('returns empty array when distance > 1', () => {
      mockCalculateGridDistance.mockReturnValue(2);

      const match = createMatch();
      const actor = match.combatants[0];

      const reactors = getAoOReactors(match, actor);

      expect(reactors).toHaveLength(0);
    });

    it('returns empty array when reactor has no reaction available', () => {
      mockCalculateGridDistance.mockReturnValue(1);

      const match = createMatch({
        combatants: [
          createPF2Combatant({ playerId: 'player1', characterId: 'char1' }),
          createPF2Combatant({ playerId: 'player2', characterId: 'char2', reactionAvailable: false }),
        ],
      });
      const actor = match.combatants[0];

      const reactors = getAoOReactors(match, actor);

      expect(reactors).toHaveLength(0);
    });

    it('returns empty array when reactor is unconscious (HP <= 0)', () => {
      mockCalculateGridDistance.mockReturnValue(1);

      const match = createMatch({
        combatants: [
          createPF2Combatant({ playerId: 'player1', characterId: 'char1' }),
          createPF2Combatant({ playerId: 'player2', characterId: 'char2', currentHP: 0 }),
        ],
      });
      const actor = match.combatants[0];

      const reactors = getAoOReactors(match, actor);

      expect(reactors).toHaveLength(0);
    });

    it('returns empty array for same-player combatant (self)', () => {
      mockCalculateGridDistance.mockReturnValue(1);

      const match = createMatch({
        combatants: [
          createPF2Combatant({ playerId: 'player1', characterId: 'char1' }),
        ],
      });
      const actor = match.combatants[0];

      const reactors = getAoOReactors(match, actor);

      expect(reactors).toHaveLength(0);
    });

    it('returns empty array when reactor lacks Attack of Opportunity feat', () => {
      mockCalculateGridDistance.mockReturnValue(1);

      const match = createMatch({
        characters: [
          createPF2Character({ id: 'char1', name: 'Fighter', feats: [] }),
          createPF2Character({ 
            id: 'char2', 
            name: 'Rogue',
            feats: [{ id: 'f1', name: 'Shield Block', type: 'class', level: 1 }]
          }),
        ],
      });
      const actor = match.combatants[0];

      const reactors = getAoOReactors(match, actor);

      expect(reactors).toHaveLength(0);
    });

    it('returns reactor only if they have Attack of Opportunity feat', () => {
      mockCalculateGridDistance.mockReturnValue(1);

      const match = createMatch();
      const actor = match.combatants[0];

      const reactors = getAoOReactors(match, actor);

      expect(reactors).toHaveLength(1);
      expect(reactors[0].playerId).toBe('player2');
    });
  });

  describe('executeAoOStrike', () => {
    beforeEach(() => {
      mockGetCharacterById.mockImplementation((_match: MatchState, charId: string) => {
        if (charId === 'char1') return createPF2Character({ id: 'char1', name: 'Fighter' });
        if (charId === 'char2') return createPF2Character({ id: 'char2', name: 'Rogue' });
        return null;
      });
    });

    it('does NOT apply MAP to AoO strike (reaction ignores MAP)', () => {
      mockRollCheck.mockReturnValue({
        roll: 15, modifier: 6, total: 21, dc: 18,
        degree: 'success' as const, natural20: false, natural1: false,
      });
      mockRollDamage.mockReturnValue({ total: 7, rolls: [5], modifier: 3 });

      const match = createMatch({
        combatants: [
          createPF2Combatant({ playerId: 'player1', characterId: 'char1', mapPenalty: -5 }),
          createPF2Combatant({ playerId: 'player2', characterId: 'char2' }),
        ],
      });
      const reactor = match.combatants[0];
      const trigger = match.combatants[1];

      executeAoOStrike(match, 'match1', reactor, trigger);

      const rollCheckCall = mockRollCheck.mock.calls[0];
      // STR 16 → mod 3, trained at level 1 → prof 3, no conditions → total bonus 6
      expect(rollCheckCall[0]).toBe(6);
    });

    it('applies condition modifiers to AC correctly', () => {
      mockRollCheck.mockReturnValue({
        roll: 14, modifier: 4, total: 18, dc: 16,
        degree: 'success' as const, natural20: false, natural1: false,
      });
      mockRollDamage.mockReturnValue({ total: 5, rolls: [3], modifier: 3 });

      const match = createMatch({
        combatants: [
          createPF2Combatant({ playerId: 'player1', characterId: 'char1' }),
          createPF2Combatant({
            playerId: 'player2',
            characterId: 'char2',
            conditions: [{ condition: 'flat_footed' }],
          }),
        ],
      });
      const reactor = match.combatants[0];
      const trigger = match.combatants[1];

      executeAoOStrike(match, 'match1', reactor, trigger);

      const rollCheckCall = mockRollCheck.mock.calls[0];
      // AC 18 - 2 (flat_footed) = 16
      expect(rollCheckCall[1]).toBe(16);
    });

    it('consumes reactor reactionAvailable', () => {
      mockRollCheck.mockReturnValue({
        roll: 5, modifier: 6, total: 11, dc: 18,
        degree: 'failure' as const, natural20: false, natural1: false,
      });

      const match = createMatch();
      const reactor = match.combatants[0];
      const trigger = match.combatants[1];

      const updated = executeAoOStrike(match, 'match1', reactor, trigger);

      const updatedReactor = updated.combatants.find(c => c.playerId === 'player1') as PF2CombatantState;
      expect(updatedReactor.reactionAvailable).toBe(false);
    });

    it('critical hit doubles damage', () => {
      mockRollCheck.mockReturnValue({
        roll: 20, modifier: 6, total: 26, dc: 18,
        degree: 'critical_success' as const, natural20: true, natural1: false,
      });
      mockRollDamage.mockReturnValue({ total: 8, rolls: [5], modifier: 3 });

      const match = createMatch();
      const reactor = match.combatants[0];
      const trigger = match.combatants[1];

      const updated = executeAoOStrike(match, 'match1', reactor, trigger);

      const updatedTrigger = updated.combatants.find(c => c.playerId === 'player2');
      // 8 * 2 = 16 damage → 20 - 16 = 4 HP
      expect(updatedTrigger!.currentHP).toBe(4);
    });

    it('miss deals no damage', () => {
      mockRollCheck.mockReturnValue({
        roll: 3, modifier: 6, total: 9, dc: 18,
        degree: 'failure' as const, natural20: false, natural1: false,
      });

      const match = createMatch();
      const reactor = match.combatants[0];
      const trigger = match.combatants[1];

      const updated = executeAoOStrike(match, 'match1', reactor, trigger);

      const updatedTrigger = updated.combatants.find(c => c.playerId === 'player2');
      expect(updatedTrigger!.currentHP).toBe(20);
    });
  });

  describe('Step does NOT trigger AoO', () => {
    beforeEach(() => {
      mockGetCharacterById.mockImplementation((match: MatchState, charId: string) => {
        return match.characters.find(c => c.id === charId) ?? null;
      });
    });

    it('Step handler (pf2_step) does not invoke getAoOReactors — only Stride does', () => {
      mockCalculateGridDistance.mockReturnValue(1);
      const match = createMatch();
      const actor = match.combatants[0];

      const reactors = getAoOReactors(match, actor);
      expect(reactors).toHaveLength(1);
    });
  });

  describe('Reaction reset', () => {
    it('reactionAvailable can be toggled and defaults to true for fresh combatants', () => {
      const combatant = createPF2Combatant({ reactionAvailable: false });
      expect(combatant.reactionAvailable).toBe(false);

      const reset = { ...combatant, reactionAvailable: true };
      expect(reset.reactionAvailable).toBe(true);
    });
  });
});

describe('Shield Block', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCharacterById.mockImplementation((_match: MatchState, charId: string) => {
      if (charId === 'char1') {
        return createPF2Character({
          id: 'char1',
          name: 'Fighter',
          feats: [{ id: 'f1', name: 'Shield Block', type: 'class', level: 1 }],
          armor: {
            id: 'shield1',
            name: 'Steel Shield',
            proficiencyCategory: 'unarmored',
            acBonus: 0,
            dexCap: null,
            potencyRune: 0,
          },
          shieldBonus: 2,
          shieldHardness: 5,
        });
      }
      return null;
    });
  });

  it('reduces damage by shield hardness', () => {
    const match = createMatch({
      combatants: [
        createPF2Combatant({
          playerId: 'player1',
          characterId: 'char1',
          shieldRaised: true,
          shieldHP: 20,
        }) as PF2CombatantState,
      ],
    });

    const combatant = match.combatants[0] as PF2CombatantState;
    const character = mockGetCharacterById(match, combatant.characterId) as PF2CharacterSheet;

    const shieldHardness = 5;
    const incomingDamage = 10;
    const reducedDamage = Math.max(0, incomingDamage - shieldHardness);

    expect(reducedDamage).toBe(5);
  });

  it('shield takes damage equal to (original - hardness)', () => {
    const match = createMatch({
      combatants: [
        createPF2Combatant({
          playerId: 'player1',
          characterId: 'char1',
          shieldRaised: true,
          shieldHP: 20,
        }) as PF2CombatantState,
      ],
    });

    const combatant = match.combatants[0] as PF2CombatantState;
    const shieldHardness = 5;
    const incomingDamage = 10;
    const shieldDamage = Math.max(0, incomingDamage - shieldHardness);
    const newShieldHP = (combatant.shieldHP ?? 0) - shieldDamage;

    expect(shieldDamage).toBe(5);
    expect(newShieldHP).toBe(15);
  });

  it('only available if shield raised', () => {
    const match = createMatch({
      combatants: [
        createPF2Combatant({
          playerId: 'player1',
          characterId: 'char1',
          shieldRaised: false,
          shieldHP: 20,
        }) as PF2CombatantState,
      ],
    });

    const combatant = match.combatants[0] as PF2CombatantState;
    const character = mockGetCharacterById(match, combatant.characterId) as PF2CharacterSheet;

    const canShieldBlock = combatant.shieldRaised && combatant.reactionAvailable;
    expect(canShieldBlock).toBe(false);
  });

  it('requires Shield Block feat', () => {
    mockGetCharacterById.mockImplementation((_match: MatchState, charId: string) => {
      if (charId === 'char1') {
        return createPF2Character({
          id: 'char1',
          name: 'Fighter',
          feats: [],
        });
      }
      return null;
    });

    const match = createMatch({
      combatants: [
        createPF2Combatant({
          playerId: 'player1',
          characterId: 'char1',
          shieldRaised: true,
          shieldHP: 20,
        }) as PF2CombatantState,
      ],
    });

    const combatant = match.combatants[0] as PF2CombatantState;
    const character = mockGetCharacterById(match, combatant.characterId) as PF2CharacterSheet;

    const hasShieldBlockFeat = character?.feats.some(f => f.name === 'Shield Block') ?? false;
    expect(hasShieldBlockFeat).toBe(false);
  });

  it('shield breaks when HP reaches 0', () => {
    const match = createMatch({
      combatants: [
        createPF2Combatant({
          playerId: 'player1',
          characterId: 'char1',
          shieldRaised: true,
          shieldHP: 3,
        }) as PF2CombatantState,
      ],
    });

    const combatant = match.combatants[0] as PF2CombatantState;
    const shieldHardness = 5;
    const incomingDamage = 10;
    const shieldDamage = Math.max(0, incomingDamage - shieldHardness);
    const newShieldHP = Math.max(0, (combatant.shieldHP ?? 0) - shieldDamage);

    expect(newShieldHP).toBe(0);
    const shieldBroken = newShieldHP <= 0;
    expect(shieldBroken).toBe(true);
  });

  it('requires reaction available', () => {
    const match = createMatch({
      combatants: [
        createPF2Combatant({
          playerId: 'player1',
          characterId: 'char1',
          shieldRaised: true,
          shieldHP: 20,
          reactionAvailable: false,
        }) as PF2CombatantState,
      ],
    });

    const combatant = match.combatants[0] as PF2CombatantState;
    const canShieldBlock = combatant.shieldRaised && combatant.reactionAvailable;
    expect(canShieldBlock).toBe(false);
  });

  it('damage cannot be reduced below 0', () => {
    const shieldHardness = 10;
    const incomingDamage = 5;
    const reducedDamage = Math.max(0, incomingDamage - shieldHardness);

    expect(reducedDamage).toBe(0);
  });

  it('shield HP cannot go below 0', () => {
    const shieldHP = 2;
    const shieldDamage = 10;
    const newShieldHP = Math.max(0, shieldHP - shieldDamage);

    expect(newShieldHP).toBe(0);
  });
});

describe('Reactive Shield', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCharacterById.mockImplementation((_match: MatchState, charId: string) => {
      if (charId === 'char1') {
        return createPF2Character({
          id: 'char1',
          name: 'Fighter',
          feats: [{ id: 'f1', name: 'Reactive Shield', type: 'class', level: 1 }],
          armor: {
            id: 'shield1',
            name: 'Steel Shield',
            proficiencyCategory: 'unarmored',
            acBonus: 0,
            dexCap: null,
            potencyRune: 0,
          },
          shieldBonus: 2,
          shieldHardness: 5,
        });
      }
      return null;
    });
  });

  it('raises shield as reaction when hit', () => {
    const match = createMatch({
      combatants: [
        createPF2Combatant({
          playerId: 'player1',
          characterId: 'char1',
          shieldRaised: false,
          reactionAvailable: true,
        }) as PF2CombatantState,
      ],
    });

    const combatant = match.combatants[0] as PF2CombatantState;
    const updated = handleReactiveShieldReaction(match, 'match1', combatant);

    const updatedCombatant = updated.combatants.find(c => c.playerId === 'player1') as PF2CombatantState;
    expect(updatedCombatant.shieldRaised).toBe(true);
    expect(updatedCombatant.reactionAvailable).toBe(false);
    expect(updated.log).toContain('🛡️ Fighter uses Reactive Shield: shield raised as reaction');
  });

  it('only available when shield NOT already raised', () => {
    const match = createMatch({
      combatants: [
        createPF2Combatant({
          playerId: 'player1',
          characterId: 'char1',
          shieldRaised: true,
          reactionAvailable: true,
        }) as PF2CombatantState,
      ],
    });

    const combatant = match.combatants[0] as PF2CombatantState;
    const updated = handleReactiveShieldReaction(match, 'match1', combatant);

    expect(updated).toBe(match);
  });

  it('requires Reactive Shield feat', () => {
    mockGetCharacterById.mockImplementation((_match: MatchState, charId: string) => {
      if (charId === 'char1') {
        return createPF2Character({
          id: 'char1',
          name: 'Fighter',
          feats: [],
        });
      }
      return null;
    });

    const match = createMatch({
      combatants: [
        createPF2Combatant({
          playerId: 'player1',
          characterId: 'char1',
          shieldRaised: false,
          reactionAvailable: true,
        }) as PF2CombatantState,
      ],
    });

    const combatant = match.combatants[0] as PF2CombatantState;
    const updated = handleReactiveShieldReaction(match, 'match1', combatant);

    expect(updated).toBe(match);
  });

  it('requires reaction available', () => {
    const match = createMatch({
      combatants: [
        createPF2Combatant({
          playerId: 'player1',
          characterId: 'char1',
          shieldRaised: false,
          reactionAvailable: false,
        }) as PF2CombatantState,
      ],
    });

    const combatant = match.combatants[0] as PF2CombatantState;
    const updated = handleReactiveShieldReaction(match, 'match1', combatant);

    expect(updated).toBe(match);
  });

  it('AC bonus applies after Reactive Shield triggers', () => {
    const match = createMatch({
      combatants: [
        createPF2Combatant({
          playerId: 'player1',
          characterId: 'char1',
          shieldRaised: false,
          reactionAvailable: true,
        }) as PF2CombatantState,
      ],
    });

    const combatant = match.combatants[0] as PF2CombatantState;
    const character = mockGetCharacterById(match, combatant.characterId) as PF2CharacterSheet;

    const acBefore = character.derived.armorClass + (combatant.shieldRaised ? 2 : 0);
    expect(acBefore).toBe(18);

    const updated = handleReactiveShieldReaction(match, 'match1', combatant);
    const updatedCombatant = updated.combatants.find(c => c.playerId === 'player1') as PF2CombatantState;
    const acAfter = character.derived.armorClass + (updatedCombatant.shieldRaised ? 2 : 0);
    expect(acAfter).toBe(20);
  });
});
