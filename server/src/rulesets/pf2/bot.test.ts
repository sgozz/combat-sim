import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MatchState, GridPosition } from '../../../../shared/types';
import type { PF2CombatantState } from '../../../../shared/rulesets/pf2/types';
import type { PF2CharacterSheet } from '../../../../shared/rulesets/pf2/characterSheet';

vi.mock('../../helpers', () => {
  const squareGrid8 = {
    distance: (a: { q: number; r: number }, b: { q: number; r: number }) =>
      Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r)),
    neighbors: (pos: { q: number; r: number }) => {
      const dirs = [
        { q: 1, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 1 }, { q: 0, r: -1 },
        { q: 1, r: 1 }, { q: -1, r: -1 }, { q: 1, r: -1 }, { q: -1, r: 1 },
      ];
      return dirs.map(d => ({ q: pos.q + d.q, r: pos.r + d.r }));
    },
    getNeighborInDirection: (pos: { q: number; r: number }, dir: number) => {
      const dirs = [
        { q: 1, r: 0 }, { q: 1, r: 1 }, { q: 0, r: 1 },
        { q: -1, r: 0 }, { q: -1, r: -1 }, { q: 0, r: -1 },
        { q: 1, r: -1 }, { q: -1, r: 1 },
      ];
      const d = dirs[dir % dirs.length];
      return { q: pos.q + d.q, r: pos.r + d.r };
    },
  };

  return {
    getGridSystemForMatch: () => squareGrid8,
    calculateGridDistance: (from: GridPosition, to: GridPosition) =>
      Math.max(Math.abs(from.x - to.x), Math.abs(from.z - to.z)),
    isDefeated: (c: { currentHP: number; statusEffects: string[] }) =>
      c.currentHP <= 0 || c.statusEffects.includes('unconscious'),
    computeGridMoveToward: (from: GridPosition, to: GridPosition, maxMove: number) => {
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const stepX = dx === 0 ? 0 : Math.sign(dx);
      const stepZ = dz === 0 ? 0 : Math.sign(dz);
      const steps = Math.min(maxMove, Math.max(Math.abs(dx), Math.abs(dz)));
      return {
        x: from.x + stepX * steps,
        y: from.y,
        z: from.z + stepZ * steps,
      };
    },
    calculateFacing: () => 0,
    getCharacterById: vi.fn(),
    sendToMatch: vi.fn(),
    getCombatantByPlayerId: vi.fn(),
    checkVictory: vi.fn((m: MatchState) => m),
  };
});

vi.mock('../../state', () => ({
  state: {
    matches: new Map(),
    users: new Map(),
    botTimers: new Map(),
    botCount: 0,
    connections: new Map(),
    characters: new Map(),
    getUserSockets: () => [],
    getSpectators: () => [],
  },
}));

vi.mock('../../db', () => ({
  getMatchMembers: vi.fn().mockResolvedValue([]),
  updateMatchState: vi.fn(),
  createUser: vi.fn(),
  addMatchMember: vi.fn(),
  upsertCharacter: vi.fn(),
}));

vi.mock('../../../../shared/rulesets/characterSheet', () => ({
  isPF2Character: (c: { rulesetId?: string }) => c?.rulesetId === 'pf2',
}));

import { decidePF2BotAction, executeBotStrike, executeBotStride } from './bot';
import { getCharacterById } from '../../helpers';

const mockGetCharacterById = vi.mocked(getCharacterById);

const createPF2Combatant = (overrides: Partial<PF2CombatantState> = {}): PF2CombatantState => ({
  rulesetId: 'pf2',
  playerId: 'bot1',
  characterId: 'char-bot1',
  position: { x: 0, y: 0, z: 0 },
  facing: 0,
  currentHP: 20,
  usedReaction: false,
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
  spellSlotUsage: [],
  focusPointsUsed: 0,
  equipped: [],
  ...overrides,
});

const createEnemy = (overrides: Partial<PF2CombatantState> = {}): PF2CombatantState =>
  createPF2Combatant({
    playerId: 'enemy1',
    characterId: 'char-enemy1',
    position: { x: 1, y: 0, z: 0 },
    ...overrides,
  });

const createPF2Character = (name: string): PF2CharacterSheet => ({
  id: `char-${name}`,
  name,
  rulesetId: 'pf2',
  level: 1,
  class: 'Fighter',
  ancestry: 'Human',
  heritage: 'Versatile',
  background: 'Warrior',
  abilities: {
    strength: 14,
    dexterity: 12,
    constitution: 14,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  },
  derived: {
    hitPoints: 20,
    armorClass: 14,
    speed: 25,
    fortitudeSave: 5,
    reflexSave: 4,
    willSave: 3,
    perception: 3,
  },
  classHP: 10,
  saveProficiencies: { fortitude: 'trained', reflex: 'trained', will: 'trained' },
  perceptionProficiency: 'trained',
  armorProficiency: 'trained',
  skills: [],
  weapons: [{
    id: 'longsword',
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
});

const createMatch = (combatants: PF2CombatantState[]): MatchState => ({
  id: 'match1',
  name: 'Test Match',
  code: 'TEST',
  maxPlayers: 2,
  rulesetId: 'pf2',
  players: combatants.map(c => ({
    id: c.playerId,
    name: c.playerId,
    isBot: true,
    characterId: c.characterId,
  })),
  characters: [],
  combatants,
  activeTurnPlayerId: combatants[0]?.playerId ?? '',
  round: 1,
  log: [],
  status: 'active',
  createdAt: Date.now(),
});

describe('PF2 Bot AI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('decidePF2BotAction', () => {
    it('returns null when no actions remaining', () => {
      const bot = createPF2Combatant({ actionsRemaining: 0 });
      const match = createMatch([bot, createEnemy()]);
      const char = createPF2Character('bot1');

      expect(decidePF2BotAction(match, bot, char)).toBeNull();
    });

    it('returns null when no enemies alive', () => {
      const bot = createPF2Combatant();
      const deadEnemy = createEnemy({ currentHP: 0 });
      const match = createMatch([bot, deadEnemy]);
      const char = createPF2Character('bot1');

      expect(decidePF2BotAction(match, bot, char)).toBeNull();
    });

    it('returns strike when adjacent to enemy', () => {
      const bot = createPF2Combatant({ position: { x: 0, y: 0, z: 0 } });
      const enemy = createEnemy({ position: { x: 1, y: 0, z: 0 } });
      const match = createMatch([bot, enemy]);
      const char = createPF2Character('bot1');

      const action = decidePF2BotAction(match, bot, char);
      expect(action).toEqual({ type: 'strike', targetId: 'enemy1' });
    });

    it('returns stride when not adjacent to enemy', () => {
      const bot = createPF2Combatant({ position: { x: 0, y: 0, z: 0 } });
      const enemy = createEnemy({ position: { x: 5, y: 0, z: 0 } });
      const match = createMatch([bot, enemy]);
      const char = createPF2Character('bot1');

      mockGetCharacterById.mockReturnValue(char);

      const action = decidePF2BotAction(match, bot, char);
      expect(action).not.toBeNull();
      expect(action!.type).toBe('stride');
    });

    it('returns null when MAP is at -10 and adjacent', () => {
      const bot = createPF2Combatant({
        position: { x: 0, y: 0, z: 0 },
        mapPenalty: -10,
      });
      const enemy = createEnemy({ position: { x: 1, y: 0, z: 0 } });
      const match = createMatch([bot, enemy]);
      const char = createPF2Character('bot1');

      expect(decidePF2BotAction(match, bot, char)).toBeNull();
    });

    it('allows strike when MAP is -5 (not maxed)', () => {
      const bot = createPF2Combatant({
        position: { x: 0, y: 0, z: 0 },
        mapPenalty: -5,
      });
      const enemy = createEnemy({ position: { x: 1, y: 0, z: 0 } });
      const match = createMatch([bot, enemy]);
      const char = createPF2Character('bot1');

      const action = decidePF2BotAction(match, bot, char);
      expect(action).toEqual({ type: 'strike', targetId: 'enemy1' });
    });

    it('finds nearest enemy when multiple exist', () => {
      const bot = createPF2Combatant({ position: { x: 0, y: 0, z: 0 } });
      const farEnemy = createEnemy({
        playerId: 'far',
        characterId: 'char-far',
        position: { x: 5, y: 0, z: 5 },
      });
      const nearEnemy = createEnemy({
        playerId: 'near',
        characterId: 'char-near',
        position: { x: 1, y: 0, z: 0 },
      });
      const match = createMatch([bot, farEnemy, nearEnemy]);
      const char = createPF2Character('bot1');

      const action = decidePF2BotAction(match, bot, char);
      expect(action).toEqual({ type: 'strike', targetId: 'near' });
    });

    it('ignores unconscious enemies', () => {
      const bot = createPF2Combatant({ position: { x: 0, y: 0, z: 0 } });
      const deadNear = createEnemy({
        playerId: 'dead',
        characterId: 'char-dead',
        position: { x: 1, y: 0, z: 0 },
        currentHP: 0,
        statusEffects: ['unconscious'],
      });
      const aliveEnemy = createEnemy({
        playerId: 'alive',
        characterId: 'char-alive',
        position: { x: 3, y: 0, z: 0 },
      });
      const match = createMatch([bot, deadNear, aliveEnemy]);
      const char = createPF2Character('bot1');

      mockGetCharacterById.mockReturnValue(char);

      const action = decidePF2BotAction(match, bot, char);
      expect(action).not.toBeNull();
      expect(action!.type).toBe('stride');
    });
  });

  describe('executeBotStrike', () => {
    it('decrements actionsRemaining after strike', () => {
      const bot = createPF2Combatant({
        position: { x: 0, y: 0, z: 0 },
        actionsRemaining: 3,
      });
      const enemy = createEnemy({ position: { x: 1, y: 0, z: 0 } });
      const match = createMatch([bot, enemy]);
      match.characters = [createPF2Character('bot1'), createPF2Character('enemy1')];
      match.characters[0].id = 'char-bot1';
      match.characters[1].id = 'char-enemy1';

      mockGetCharacterById.mockImplementation((_, charId) => {
        return match.characters.find(c => c.id === charId) ?? null;
      });

      const result = executeBotStrike('match1', match, bot, 'enemy1', { id: 'bot1', name: 'Bot 1' });
      const updatedBot = result.combatants.find(c => c.playerId === 'bot1') as PF2CombatantState;
      expect(updatedBot.actionsRemaining).toBe(2);
    });

    it('updates mapPenalty after strike with non-agile weapon', () => {
      const bot = createPF2Combatant({
        position: { x: 0, y: 0, z: 0 },
        actionsRemaining: 3,
        mapPenalty: 0,
      });
      const enemy = createEnemy({ position: { x: 1, y: 0, z: 0 } });
      const match = createMatch([bot, enemy]);
      const botChar = createPF2Character('bot1');
      botChar.id = 'char-bot1';
      const enemyChar = createPF2Character('enemy1');
      enemyChar.id = 'char-enemy1';
      match.characters = [botChar, enemyChar];

      mockGetCharacterById.mockImplementation((_, charId) => {
        return match.characters.find(c => c.id === charId) ?? null;
      });

      const result = executeBotStrike('match1', match, bot, 'enemy1', { id: 'bot1', name: 'Bot 1' });
      const updatedBot = result.combatants.find(c => c.playerId === 'bot1') as PF2CombatantState;
      expect(updatedBot.mapPenalty).toBe(-5);
    });

    it('caps mapPenalty at -10 for non-agile weapon', () => {
      const bot = createPF2Combatant({
        position: { x: 0, y: 0, z: 0 },
        actionsRemaining: 3,
        mapPenalty: -5,
      });
      const enemy = createEnemy({ position: { x: 1, y: 0, z: 0 } });
      const match = createMatch([bot, enemy]);
      const botChar = createPF2Character('bot1');
      botChar.id = 'char-bot1';
      const enemyChar = createPF2Character('enemy1');
      enemyChar.id = 'char-enemy1';
      match.characters = [botChar, enemyChar];

      mockGetCharacterById.mockImplementation((_, charId) => {
        return match.characters.find(c => c.id === charId) ?? null;
      });

      const result = executeBotStrike('match1', match, bot, 'enemy1', { id: 'bot1', name: 'Bot 1' });
      const updatedBot = result.combatants.find(c => c.playerId === 'bot1') as PF2CombatantState;
      expect(updatedBot.mapPenalty).toBe(-10);
    });

    it('uses agile MAP progression for agile weapons', () => {
      const bot = createPF2Combatant({
        position: { x: 0, y: 0, z: 0 },
        actionsRemaining: 3,
        mapPenalty: 0,
      });
      const enemy = createEnemy({ position: { x: 1, y: 0, z: 0 } });
      const match = createMatch([bot, enemy]);
      const botChar = createPF2Character('bot1');
      botChar.id = 'char-bot1';
      botChar.weapons = [{
        id: 'dagger',
        name: 'Dagger',
        damage: '1d4',
        damageType: 'piercing',
        proficiencyCategory: 'simple',
        traits: ['agile', 'finesse'],
        potencyRune: 0,
        strikingRune: null,
      }];
      const enemyChar = createPF2Character('enemy1');
      enemyChar.id = 'char-enemy1';
      match.characters = [botChar, enemyChar];

      mockGetCharacterById.mockImplementation((_, charId) => {
        return match.characters.find(c => c.id === charId) ?? null;
      });

      const result = executeBotStrike('match1', match, bot, 'enemy1', { id: 'bot1', name: 'Bot 1' });
      const updatedBot = result.combatants.find(c => c.playerId === 'bot1') as PF2CombatantState;
      expect(updatedBot.mapPenalty).toBe(-4);
    });
  });

  describe('executeBotStride', () => {
    it('decrements actionsRemaining after stride', () => {
      const bot = createPF2Combatant({
        position: { x: 0, y: 0, z: 0 },
        actionsRemaining: 3,
      });
      const match = createMatch([bot, createEnemy()]);

      const result = executeBotStride(match, bot, { q: 2, r: 0 }, { id: 'bot1', name: 'Bot 1' });
      const updatedBot = result.combatants.find(c => c.playerId === 'bot1') as PF2CombatantState;
      expect(updatedBot.actionsRemaining).toBe(2);
    });

    it('updates position to target', () => {
      const bot = createPF2Combatant({
        position: { x: 0, y: 0, z: 0 },
        actionsRemaining: 3,
      });
      const match = createMatch([bot, createEnemy()]);

      const result = executeBotStride(match, bot, { q: 3, r: 2 }, { id: 'bot1', name: 'Bot 1' });
      const updatedBot = result.combatants.find(c => c.playerId === 'bot1');
      expect(updatedBot?.position).toEqual({ x: 3, y: 0, z: 2 });
    });

    it('logs stride action', () => {
      const bot = createPF2Combatant({
        position: { x: 0, y: 0, z: 0 },
        actionsRemaining: 3,
      });
      const match = createMatch([bot, createEnemy()]);

      const result = executeBotStride(match, bot, { q: 3, r: 2 }, { id: 'bot1', name: 'Bot 1' });
      expect(result.log).toContainEqual(expect.stringContaining('strides to (3, 2)'));
    });
  });

  describe('multi-action loop simulation', () => {
    it('bot uses all 3 actions when adjacent (2 strikes + stride or 3 strikes max)', () => {
      const bot = createPF2Combatant({
        position: { x: 0, y: 0, z: 0 },
        actionsRemaining: 3,
        mapPenalty: 0,
      });
      const enemy = createEnemy({ position: { x: 1, y: 0, z: 0 } });
      const match = createMatch([bot, enemy]);
      const char = createPF2Character('bot1');

      const actions: string[] = [];
      let iterations = 0;
      while (iterations < 10) {
        iterations++;
        const currentBot = match.combatants.find(c => c.playerId === 'bot1') as PF2CombatantState;
        if (!currentBot || currentBot.actionsRemaining <= 0) break;

        const action = decidePF2BotAction(match, currentBot, char);
        if (!action) break;
        actions.push(action.type);
      }

      expect(actions.length).toBeGreaterThanOrEqual(2);
      expect(actions.every(a => a === 'strike')).toBe(true);
    });

    it('bot stops striking when MAP reaches -10', () => {
      const bot = createPF2Combatant({
        position: { x: 0, y: 0, z: 0 },
        actionsRemaining: 3,
        mapPenalty: -10,
      });
      const enemy = createEnemy({ position: { x: 1, y: 0, z: 0 } });
      const match = createMatch([bot, enemy]);
      const char = createPF2Character('bot1');

      const action = decidePF2BotAction(match, bot, char);
      expect(action).toBeNull();
    });

    it('bot strides then strikes when initially far from enemy', () => {
      const bot = createPF2Combatant({
        position: { x: 0, y: 0, z: 0 },
        actionsRemaining: 3,
      });
      const enemy = createEnemy({ position: { x: 3, y: 0, z: 0 } });
      let match = createMatch([bot, enemy]);
      const char = createPF2Character('bot1');

      mockGetCharacterById.mockReturnValue(char);

      const action1 = decidePF2BotAction(match, bot, char);
      expect(action1).not.toBeNull();
      expect(action1!.type).toBe('stride');

      if (action1 && action1.type === 'stride') {
        match = executeBotStride(match, bot, action1.to, { id: 'bot1', name: 'Bot 1' });

        const updatedBot = match.combatants.find(c => c.playerId === 'bot1') as PF2CombatantState;
        expect(updatedBot.actionsRemaining).toBe(2);
      }
    });
  });
});
