import type { GurpsCombatantState, Posture, Equipment, EquipmentType, DamageType, Reach } from '../../../../../shared/rulesets/gurps/types';
import type { GurpsCharacterSheet } from '../../../../../shared/rulesets/gurps/characterSheet';
import type { MatchState, Player } from '../../../../../shared/types';
import { vi } from 'vitest';

/**
 * Default equipment for test characters
 */
const defaultEquipment: Equipment[] = [
  {
    id: 'sword1',
    name: 'Broadsword',
    type: 'melee' as EquipmentType,
    damage: '1d6+1',
    damageType: 'cutting' as DamageType,
    reach: '1' as Reach,
    parry: 0,
    weight: 3,
  },
  {
    id: 'shield1',
    name: 'Medium Shield',
    type: 'shield' as EquipmentType,
    block: 2,
    weight: 15,
  },
];

/**
 * Creates a GURPS combatant with sensible defaults.
 * All fields can be overridden via the overrides parameter.
 */
export const createGurpsCombatant = (overrides: Partial<GurpsCombatantState> = {}): GurpsCombatantState => ({
  // BaseCombatantState fields
  rulesetId: 'gurps',
  playerId: 'player1',
  characterId: 'char1',
  position: { x: 0, y: 0, z: 0 },
  facing: 0,
  currentHP: 12,
  statusEffects: [],
  usedReaction: false,
  // GurpsCombatantState fields
  posture: 'standing' as Posture,
  maneuver: null,
  aoaVariant: null,
  aodVariant: null,
  currentFP: 10,
  aimTurns: 0,
  aimTargetId: null,
  evaluateBonus: 0,
  evaluateTargetId: null,
  equipped: [
    { equipmentId: 'sword1', slot: 'right_hand', ready: true },
  ],
  inCloseCombatWith: null,
  closeCombatPosition: null,
  grapple: null,
  shockPenalty: 0,
  attacksRemaining: 1,
  retreatedThisTurn: false,
  defensesThisTurn: 0,
  parryWeaponsUsedThisTurn: [],
  waitTrigger: null,
  ...overrides,
});

/**
 * Creates a GURPS character sheet with sensible defaults.
 * All fields can be overridden via the overrides parameter.
 */
export const createGurpsCharacter = (overrides: Partial<GurpsCharacterSheet> = {}): GurpsCharacterSheet => ({
  id: 'char1',
  name: 'Knight',
  rulesetId: 'gurps',
  attributes: {
    strength: 12,
    dexterity: 12,
    intelligence: 10,
    health: 11,
  },
  derived: {
    hitPoints: 12,
    fatiguePoints: 10,
    basicSpeed: 5.75,
    basicMove: 5,
    dodge: 8,
  },
  skills: [
    { id: 'skill1', name: 'Broadsword', level: 14 },
    { id: 'skill2', name: 'Shield', level: 12 },
    { id: 'skill3', name: 'Brawling', level: 12 },
  ],
  advantages: [],
  disadvantages: [],
  equipment: defaultEquipment,
  pointsTotal: 150,
  isFavorite: false,
  ...overrides,
});

/**
 * Creates a match state with sensible defaults for GURPS.
 * Includes two default combatants and characters.
 * All fields can be overridden via the overrides parameter.
 */
export const createMatch = (overrides: Partial<MatchState> = {}): MatchState => ({
  id: 'match1',
  name: 'Test Match',
  code: 'TEST',
  maxPlayers: 2,
  rulesetId: 'gurps',
  players: [
    { id: 'player1', name: 'Attacker', isBot: false, characterId: 'char1' },
    { id: 'player2', name: 'Defender', isBot: false, characterId: 'char2' },
  ],
  characters: [
    createGurpsCharacter({ id: 'char1', name: 'Attacker' }),
    createGurpsCharacter({ 
      id: 'char2', 
      name: 'Defender',
      attributes: { strength: 11, dexterity: 12, intelligence: 10, health: 11 },
      derived: { hitPoints: 11, fatiguePoints: 10, basicSpeed: 5.5, basicMove: 5, dodge: 8 },
    }),
  ],
  combatants: [
    createGurpsCombatant({ 
      playerId: 'player1', 
      characterId: 'char1', 
      position: { x: 0, y: 0, z: 0 },
      currentHP: 12,
    }),
    createGurpsCombatant({ 
      playerId: 'player2', 
      characterId: 'char2', 
      position: { x: 1, y: 0, z: 0 },
      currentHP: 11,
      facing: 3,
    }),
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
