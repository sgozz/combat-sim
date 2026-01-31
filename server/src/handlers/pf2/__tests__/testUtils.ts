import type { PF2CombatantState } from '../../../../../shared/rulesets/pf2/types';
import type { PF2CharacterSheet } from '../../../../../shared/rulesets/pf2/characterSheet';
import type { MatchState, Player, Id } from '../../../../../shared/types';
import { vi } from 'vitest';

/**
 * Creates a PF2 combatant with sensible defaults.
 * All fields can be overridden via the overrides parameter.
 */
export const createPF2Combatant = (overrides: Partial<PF2CombatantState> = {}): PF2CombatantState => ({
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
  ...overrides,
});

/**
 * Creates a PF2 character sheet with sensible defaults.
 * All fields can be overridden via the overrides parameter.
 */
export const createPF2Character = (overrides: Partial<PF2CharacterSheet> = {}): PF2CharacterSheet => ({
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
  feats: [],
  spells: null,
  spellcasters: [],
  ...overrides,
});

/**
 * Creates a match state with sensible defaults.
 * Includes two default combatants and characters.
 * All fields can be overridden via the overrides parameter.
 */
export const createMatch = (overrides: Partial<MatchState> = {}): MatchState => ({
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
    createPF2Character({ id: 'char1', name: 'Fighter' }),
    createPF2Character({ id: 'char2', name: 'Rogue' }),
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

/**
 * Creates a mock WebSocket with readyState set to OPEN (1).
 * The send method is a Vitest mock function for tracking calls.
 */
export const createMockSocket = () => ({
  readyState: 1, // WebSocket.OPEN
  send: vi.fn(),
});

/**
 * Creates a player with sensible defaults.
 * All fields can be overridden via the overrides parameter.
 */
export const createPlayer = (overrides: Partial<Player> = {}): Player => ({
  id: 'player1',
  name: 'Test Player',
  isBot: false,
  characterId: 'char1',
  ...overrides,
});
