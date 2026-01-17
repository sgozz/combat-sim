import { describe, it, expect } from 'vitest'
import { 
  skillCheck, 
  rollDamage, 
  resolveAttack, 
  calculateDerivedStats,
  calculateParry,
  calculateBlock,
  getDefenseOptions,
  getRangePenalty,
  advanceTurn,
  getDamageMultiplier,
  applyDamageMultiplier,
  getPostureModifiers,
  rollHTCheck,
  parseReach,
  canAttackAtDistance,
  getCloseCombatAttackModifiers,
  getCloseCombatDefenseModifiers,
  getCloseCombatPositionModifier,
  canDefendFromPosition,
  quickContest,
  resolveGrappleAttempt,
  resolveBreakFree,
  resolveGrappleTechnique,
  getRotationCost,
  getRelativeDirection,
  getMovementCostToAdjacent,
  getReachableHexes,
  canMoveTo,
  executeMove,
  executeRotation,
  getHexNeighbor,
  hexDistance,
  HIT_LOCATION_DATA,
  getHitLocationPenalty,
  getHitLocationWoundingMultiplier,
  rollRandomHitLocation,
  getRetreatBonus,
  resolveAttackRoll,
  resolveDefenseRoll,
  calculateDefenseValue,
  type HexPosition,
  type MovementState,
} from './rules'
import type { CharacterSheet, MatchState, CombatantState, Player, Equipment } from './types'

describe('GURPS Rules', () => {
  describe('Skill Check', () => {
    it('success when rolling under or equal to target', () => {
      // Mock math.random to return predictable values
      // roll3d6 uses math.floor(random * 6) + 1
      // to roll 3, 3, 3 = 9. random needs to be ~0.4
      const random = () => 0.4 
      const result = skillCheck(10, random)
      expect(result.roll).toBe(9) // 3+3+3
      expect(result.success).toBe(true)
      expect(result.margin).toBe(1)
    })

    it('failure when rolling over target', () => {
      // roll 4, 4, 4 = 12. random ~0.6
      const random = () => 0.6
      const result = skillCheck(10, random)
      expect(result.roll).toBe(12)
      expect(result.success).toBe(false)
      expect(result.margin).toBe(-2)
    })

    it('critical success on 3 or 4', () => {
      // roll 1, 1, 1 = 3. random 0
      const random = () => 0
      const result = skillCheck(10, random)
      expect(result.roll).toBe(3)
      expect(result.critical).toBe(true)
      expect(result.success).toBe(true)
    })

    it('critical failure on 18', () => {
      // roll 6, 6, 6 = 18. random 0.99
      const random = () => 0.99
      const result = skillCheck(10, random)
      expect(result.roll).toBe(18)
      expect(result.critical).toBe(true)
      expect(result.success).toBe(false)
    })
  })

  describe('Derived Stats', () => {
    it('calculates stats correctly', () => {
      const attrs = { strength: 12, dexterity: 14, intelligence: 10, health: 12 }
      const derived = calculateDerivedStats(attrs)
      
      expect(derived.hitPoints).toBe(12) // ST
      expect(derived.fatiguePoints).toBe(12) // HT
      // Basic Speed = (DX + HT) / 4 = (14 + 12) / 4 = 6.5
      expect(derived.basicSpeed).toBe(6.5)
      // Basic Move = floor(Basic Speed) = 6
      expect(derived.basicMove).toBe(6)
      // Dodge = floor(Basic Speed) + 3 = 6 + 3 = 9
      expect(derived.dodge).toBe(9)
    })
  })

  describe('Damage Roll', () => {
    it('parses formula correctly', () => {
      // 2d+2. roll 3, 3 = 6. Total = 8
      const random = () => 0.4
      const result = rollDamage('2d+2', random)
      expect(result.total).toBe(8)
      expect(result.rolls).toEqual([3, 3])
      expect(result.modifier).toBe(2)
    })
  })

  describe('Attack Resolution', () => {
    it('handles miss', () => {
      const random = () => 0.6
      const result = resolveAttack({ skill: 10, damage: '1d', random })
      expect(result.outcome).toBe('miss')
    })

    it('handles hit', () => {
      const random = () => 0.4
      const result = resolveAttack({ skill: 10, damage: '1d', random })
      expect(result.outcome).toBe('hit')
      expect(result.damage?.total).toBe(3)
    })
  })

  describe('Parry/Block Calculations', () => {
    it('calculates parry as skill/2 + 3', () => {
      expect(calculateParry(12)).toBe(9)
      expect(calculateParry(10)).toBe(8)
      expect(calculateParry(14, 1)).toBe(11)
    })

    it('calculates block as skill/2 + 3', () => {
      expect(calculateBlock(12)).toBe(9)
      expect(calculateBlock(10, 2)).toBe(10)
    })

    it('getDefenseOptions returns all available defenses', () => {
      const character: CharacterSheet = {
        id: 'test',
        name: 'Test',
        attributes: { strength: 10, dexterity: 12, intelligence: 10, health: 10 },
        derived: { hitPoints: 10, fatiguePoints: 10, basicSpeed: 5.5, basicMove: 5, dodge: 8 },
        skills: [
          { id: 's1', name: 'Sword', level: 14 },
          { id: 's2', name: 'Shield', level: 12 },
        ],
        advantages: [],
        disadvantages: [],
        equipment: [
          { id: 'e1', name: 'Broadsword', type: 'melee', damage: '2d', parry: 0, skillUsed: 'Sword' },
          { id: 'e2', name: 'Medium Shield', type: 'shield', block: 0 },
        ],
        pointsTotal: 100,
      }
      
      const options = getDefenseOptions(character, 8)
      expect(options.dodge).toBe(8)
      expect(options.parry?.value).toBe(10)
      expect(options.parry?.weapon).toBe('Broadsword')
      expect(options.block?.value).toBe(9)
      expect(options.block?.shield).toBe('Medium Shield')
    })
  })

  describe('Range Penalties', () => {
    it('returns correct penalties for distance', () => {
      expect(getRangePenalty(1)).toBe(0)
      expect(getRangePenalty(2)).toBe(0)
      expect(getRangePenalty(3)).toBe(-1)
      expect(getRangePenalty(5)).toBe(-2)
      expect(getRangePenalty(7)).toBe(-3)
      expect(getRangePenalty(10)).toBe(-4)
      expect(getRangePenalty(15)).toBe(-5)
      expect(getRangePenalty(20)).toBe(-6)
      expect(getRangePenalty(50)).toBe(-8)
      expect(getRangePenalty(100)).toBe(-10)
    })
  })

  describe('Turn Advancement', () => {
    const createTestMatch = (players: Player[], combatants: CombatantState[]): MatchState => ({
      id: 'test-match',
      players,
      characters: [],
      combatants,
      activeTurnPlayerId: players[0]?.id ?? '',
      round: 1,
      log: [],
      status: 'active',
    })

    it('advances to next player', () => {
      const players: Player[] = [
        { id: 'p1', name: 'Player 1', isBot: false, characterId: 'c1' },
        { id: 'p2', name: 'Player 2', isBot: false, characterId: 'c2' },
      ]
      const combatants: CombatantState[] = [
        { playerId: 'p1', characterId: 'c1', position: { x: 0, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: 'attack', currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null, inCloseCombatWith: null, closeCombatPosition: null, grapple: null, usedReaction: false, shockPenalty: 0, aoaVariant: null, attacksRemaining: 1, retreatedThisTurn: false, defensesThisTurn: 0 },
        { playerId: 'p2', characterId: 'c2', position: { x: 1, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: null, currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null, inCloseCombatWith: null, closeCombatPosition: null, grapple: null, usedReaction: false, shockPenalty: 0, aoaVariant: null, attacksRemaining: 1, retreatedThisTurn: false, defensesThisTurn: 0 },
      ]
      
      const match = createTestMatch(players, combatants)
      const next = advanceTurn(match)
      
      expect(next.activeTurnPlayerId).toBe('p2')
      expect(next.round).toBe(1)
    })

    it('increments round when wrapping', () => {
      const players: Player[] = [
        { id: 'p1', name: 'Player 1', isBot: false, characterId: 'c1' },
        { id: 'p2', name: 'Player 2', isBot: false, characterId: 'c2' },
      ]
      const combatants: CombatantState[] = [
        { playerId: 'p1', characterId: 'c1', position: { x: 0, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: null, currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null, inCloseCombatWith: null, closeCombatPosition: null, grapple: null, usedReaction: false, shockPenalty: 0, aoaVariant: null, attacksRemaining: 1, retreatedThisTurn: false, defensesThisTurn: 0 },
        { playerId: 'p2', characterId: 'c2', position: { x: 1, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: 'attack', currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null, inCloseCombatWith: null, closeCombatPosition: null, grapple: null, usedReaction: false, shockPenalty: 0, aoaVariant: null, attacksRemaining: 1, retreatedThisTurn: false, defensesThisTurn: 0 },
      ]
      
      const match = createTestMatch(players, combatants)
      match.activeTurnPlayerId = 'p2'
      
      const next = advanceTurn(match)
      
      expect(next.activeTurnPlayerId).toBe('p1')
      expect(next.round).toBe(2)
    })

    it('clears shockPenalty and defending status on new turn', () => {
      const players: Player[] = [
        { id: 'p1', name: 'Player 1', isBot: false, characterId: 'c1' },
        { id: 'p2', name: 'Player 2', isBot: false, characterId: 'c2' },
      ]
      const combatants: CombatantState[] = [
        { playerId: 'p1', characterId: 'c1', position: { x: 0, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: 'attack', currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null, inCloseCombatWith: null, closeCombatPosition: null, grapple: null, usedReaction: false, shockPenalty: 0, aoaVariant: null, attacksRemaining: 1, retreatedThisTurn: false, defensesThisTurn: 0 },
        { playerId: 'p2', characterId: 'c2', position: { x: 1, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: null, currentHP: 10, currentFP: 10, statusEffects: ['defending', 'stunned'], aimTurns: 0, aimTargetId: null, inCloseCombatWith: null, closeCombatPosition: null, grapple: null, usedReaction: false, shockPenalty: 3, aoaVariant: null, attacksRemaining: 1, retreatedThisTurn: false, defensesThisTurn: 0 },
      ]
      
      const match = createTestMatch(players, combatants)
      const next = advanceTurn(match)
      
      const p2Combatant = next.combatants.find(c => c.playerId === 'p2')
      expect(p2Combatant?.shockPenalty).toBe(0)
      expect(p2Combatant?.statusEffects).not.toContain('defending')
      expect(p2Combatant?.statusEffects).toContain('stunned')
    })

    it('resets maneuver for incoming player', () => {
      const players: Player[] = [
        { id: 'p1', name: 'Player 1', isBot: false, characterId: 'c1' },
        { id: 'p2', name: 'Player 2', isBot: false, characterId: 'c2' },
      ]
      const combatants: CombatantState[] = [
        { playerId: 'p1', characterId: 'c1', position: { x: 0, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: 'attack', currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null, inCloseCombatWith: null, closeCombatPosition: null, grapple: null, usedReaction: false, shockPenalty: 0, aoaVariant: null, attacksRemaining: 1, retreatedThisTurn: false, defensesThisTurn: 0 },
        { playerId: 'p2', characterId: 'c2', position: { x: 1, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: 'all_out_defense', currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null, inCloseCombatWith: null, closeCombatPosition: null, grapple: null, usedReaction: false, shockPenalty: 0, aoaVariant: null, attacksRemaining: 1, retreatedThisTurn: false, defensesThisTurn: 0 },
      ]
      
      const match = createTestMatch(players, combatants)
      const next = advanceTurn(match)
      
      const p2Combatant = next.combatants.find(c => c.playerId === 'p2')
      expect(p2Combatant?.maneuver).toBeNull()
    })

    it('shockPenalty is capped at 4', () => {
      const players: Player[] = [
        { id: 'p1', name: 'Player 1', isBot: false, characterId: 'c1' },
        { id: 'p2', name: 'Player 2', isBot: false, characterId: 'c2' },
      ]
      const combatants: CombatantState[] = [
        { playerId: 'p1', characterId: 'c1', position: { x: 0, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: 'attack', currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null, inCloseCombatWith: null, closeCombatPosition: null, grapple: null, usedReaction: false, shockPenalty: 3, aoaVariant: null, attacksRemaining: 1, retreatedThisTurn: false, defensesThisTurn: 0 },
        { playerId: 'p2', characterId: 'c2', position: { x: 1, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: null, currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null, inCloseCombatWith: null, closeCombatPosition: null, grapple: null, usedReaction: false, shockPenalty: 0, aoaVariant: null, attacksRemaining: 1, retreatedThisTurn: false, defensesThisTurn: 0 },
      ]
      
      const match = createTestMatch(players, combatants)
      const p1 = match.combatants.find(c => c.playerId === 'p1')!
      
      const newShock = Math.min(4, p1.shockPenalty + 5)
      expect(newShock).toBe(4)
    })

    it('shockPenalty accumulates within turn up to cap', () => {
      const players: Player[] = [
        { id: 'p1', name: 'Player 1', isBot: false, characterId: 'c1' },
        { id: 'p2', name: 'Player 2', isBot: false, characterId: 'c2' },
      ]
      const combatants: CombatantState[] = [
        { playerId: 'p1', characterId: 'c1', position: { x: 0, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: 'attack', currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null, inCloseCombatWith: null, closeCombatPosition: null, grapple: null, usedReaction: false, shockPenalty: 2, aoaVariant: null, attacksRemaining: 1, retreatedThisTurn: false, defensesThisTurn: 0 },
        { playerId: 'p2', characterId: 'c2', position: { x: 1, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: null, currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null, inCloseCombatWith: null, closeCombatPosition: null, grapple: null, usedReaction: false, shockPenalty: 0, aoaVariant: null, attacksRemaining: 1, retreatedThisTurn: false, defensesThisTurn: 0 },
      ]
      
      const match = createTestMatch(players, combatants)
      const p1 = match.combatants.find(c => c.playerId === 'p1')!
      
      const newShock = Math.min(4, p1.shockPenalty + 1)
      expect(newShock).toBe(3)
    })

    it('shockPenalty clears on advanceTurn', () => {
      const players: Player[] = [
        { id: 'p1', name: 'Player 1', isBot: false, characterId: 'c1' },
        { id: 'p2', name: 'Player 2', isBot: false, characterId: 'c2' },
      ]
      const combatants: CombatantState[] = [
        { playerId: 'p1', characterId: 'c1', position: { x: 0, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: 'attack', currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null, inCloseCombatWith: null, closeCombatPosition: null, grapple: null, usedReaction: false, shockPenalty: 0, aoaVariant: null, attacksRemaining: 1, retreatedThisTurn: false, defensesThisTurn: 0 },
        { playerId: 'p2', characterId: 'c2', position: { x: 1, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: null, currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null, inCloseCombatWith: null, closeCombatPosition: null, grapple: null, usedReaction: false, shockPenalty: 4, aoaVariant: null, attacksRemaining: 1, retreatedThisTurn: false, defensesThisTurn: 0 },
      ]
      
      const match = createTestMatch(players, combatants)
      const next = advanceTurn(match)
      
      const p2Combatant = next.combatants.find(c => c.playerId === 'p2')
      expect(p2Combatant?.shockPenalty).toBe(0)
    })
  })

  describe('Damage Type Multipliers', () => {
    it('crushing damage has x1 multiplier', () => {
      expect(getDamageMultiplier('crushing')).toBe(1)
      expect(applyDamageMultiplier(10, 'crushing')).toBe(10)
    })

    it('cutting damage has x1.5 multiplier (rounds down)', () => {
      expect(getDamageMultiplier('cutting')).toBe(1.5)
      expect(applyDamageMultiplier(10, 'cutting')).toBe(15)
      expect(applyDamageMultiplier(7, 'cutting')).toBe(10)
      expect(applyDamageMultiplier(3, 'cutting')).toBe(4)
    })

    it('impaling damage has x2 multiplier', () => {
      expect(getDamageMultiplier('impaling')).toBe(2)
      expect(applyDamageMultiplier(10, 'impaling')).toBe(20)
      expect(applyDamageMultiplier(5, 'impaling')).toBe(10)
    })

    it('piercing damage has x1 multiplier', () => {
      expect(getDamageMultiplier('piercing')).toBe(1)
      expect(applyDamageMultiplier(10, 'piercing')).toBe(10)
    })

    it('defaults to crushing when not specified', () => {
      expect(applyDamageMultiplier(10)).toBe(10)
    })
  })

  describe('Posture Modifiers', () => {
    it('standing has no modifiers', () => {
      const mods = getPostureModifiers('standing')
      expect(mods.toHitMelee).toBe(0)
      expect(mods.toHitRanged).toBe(0)
      expect(mods.defenseVsMelee).toBe(0)
      expect(mods.defenseVsRanged).toBe(0)
      expect(mods.moveMultiplier).toBe(1)
    })

    it('crouching gives defense bonus vs ranged, penalty vs melee', () => {
      const mods = getPostureModifiers('crouching')
      expect(mods.defenseVsRanged).toBe(2)
      expect(mods.defenseVsMelee).toBe(-2)
      expect(mods.moveMultiplier).toBeCloseTo(2/3)
    })

    it('kneeling gives ranged defense bonus, melee attack penalty', () => {
      const mods = getPostureModifiers('kneeling')
      expect(mods.toHitMelee).toBe(-2)
      expect(mods.defenseVsRanged).toBe(2)
      expect(mods.moveMultiplier).toBeCloseTo(1/3)
    })

    it('prone gives best ranged defense but worst melee', () => {
      const mods = getPostureModifiers('prone')
      expect(mods.toHitMelee).toBe(-4)
      expect(mods.toHitRanged).toBe(-2)
      expect(mods.defenseVsRanged).toBe(4)
      expect(mods.defenseVsMelee).toBe(-3)
      expect(mods.moveMultiplier).toBe(0)
    })
  })

  describe('HT Check for Unconsciousness', () => {
    it('succeeds when rolling under HT', () => {
      const random = () => 0.4
      const result = rollHTCheck(10, -2, 10, random)
      expect(result.roll).toBe(9)
      expect(result.target).toBe(10)
      expect(result.success).toBe(true)
    })

    it('fails when rolling over HT', () => {
      const random = () => 0.6
      const result = rollHTCheck(10, -2, 10, random)
      expect(result.roll).toBe(12)
      expect(result.success).toBe(false)
    })

    it('applies penalty at -HP threshold', () => {
      const random = () => 0.4
      const result = rollHTCheck(10, -10, 10, random)
      expect(result.target).toBe(9)
    })

    it('applies penalty at -2xHP threshold', () => {
      const random = () => 0.4
      const result = rollHTCheck(10, -20, 10, random)
      expect(result.target).toBe(8)
    })

    it('no penalty when HP just below 0', () => {
      const random = () => 0.4
      const result = rollHTCheck(10, -5, 10, random)
      expect(result.target).toBe(10)
    })
  })

  describe('Close Combat - Reach Parsing', () => {
    it('parses reach C as close combat only', () => {
      const result = parseReach('C')
      expect(result).toEqual({ min: 0, max: 0, hasC: true })
    })

    it('parses reach 1 as standard melee', () => {
      const result = parseReach('1')
      expect(result).toEqual({ min: 1, max: 1, hasC: false })
    })

    it('parses reach 2 as polearm-like', () => {
      const result = parseReach('2')
      expect(result).toEqual({ min: 2, max: 2, hasC: false })
    })

    it('parses reach C,1 as dagger-like', () => {
      const result = parseReach('C,1')
      expect(result).toEqual({ min: 0, max: 1, hasC: true })
    })

    it('parses reach 1,2 as flexible weapon', () => {
      const result = parseReach('1,2')
      expect(result).toEqual({ min: 1, max: 2, hasC: false })
    })

    it('parses reach 2,3 as long polearm', () => {
      const result = parseReach('2,3')
      expect(result).toEqual({ min: 2, max: 3, hasC: false })
    })
  })

  describe('Close Combat - Can Attack at Distance', () => {
    it('C weapons can attack at distance 0 only', () => {
      expect(canAttackAtDistance('C', 0)).toBe(true)
      expect(canAttackAtDistance('C', 1)).toBe(false)
    })

    it('reach 1 weapons can attack at distance 0 (with penalty) and 1', () => {
      expect(canAttackAtDistance('1', 0)).toBe(true)
      expect(canAttackAtDistance('1', 1)).toBe(true)
      expect(canAttackAtDistance('1', 2)).toBe(false)
    })

    it('reach 2 weapons cannot attack at distance 0', () => {
      expect(canAttackAtDistance('2', 0)).toBe(false)
      expect(canAttackAtDistance('2', 1)).toBe(false)
      expect(canAttackAtDistance('2', 2)).toBe(true)
    })

    it('C,1 weapons can attack at 0 and 1', () => {
      expect(canAttackAtDistance('C,1', 0)).toBe(true)
      expect(canAttackAtDistance('C,1', 1)).toBe(true)
      expect(canAttackAtDistance('C,1', 2)).toBe(false)
    })

    it('1,2 weapons can attack at 0, 1, and 2', () => {
      expect(canAttackAtDistance('1,2', 0)).toBe(true)
      expect(canAttackAtDistance('1,2', 1)).toBe(true)
      expect(canAttackAtDistance('1,2', 2)).toBe(true)
      expect(canAttackAtDistance('1,2', 3)).toBe(false)
    })
  })

  describe('Close Combat - Attack Modifiers', () => {
    const knife: Equipment = { id: '1', name: 'Knife', type: 'melee', damage: '1d-2', damageType: 'cutting', reach: 'C', parry: -1 }
    const sword: Equipment = { id: '2', name: 'Sword', type: 'melee', damage: '2d', damageType: 'cutting', reach: '1', parry: 0 }
    const spear: Equipment = { id: '3', name: 'Spear', type: 'melee', damage: '1d+2', damageType: 'impaling', reach: '2', parry: 0 }

    it('C weapons have no penalty in close combat', () => {
      const result = getCloseCombatAttackModifiers(knife, 0)
      expect(result.canAttack).toBe(true)
      expect(result.toHit).toBe(0)
    })

    it('reach 1 weapons have -2 penalty in close combat', () => {
      const result = getCloseCombatAttackModifiers(sword, 0)
      expect(result.canAttack).toBe(true)
      expect(result.toHit).toBe(-2)
    })

    it('reach 2+ weapons cannot attack in close combat', () => {
      const result = getCloseCombatAttackModifiers(spear, 0)
      expect(result.canAttack).toBe(false)
    })

    it('all weapons have no penalty at normal range', () => {
      expect(getCloseCombatAttackModifiers(knife, 1).toHit).toBe(0)
      expect(getCloseCombatAttackModifiers(sword, 1).toHit).toBe(0)
      expect(getCloseCombatAttackModifiers(spear, 2).toHit).toBe(0)
    })
  })

  describe('Close Combat - Defense Modifiers', () => {
    it('not in close combat has normal defenses', () => {
      const result = getCloseCombatDefenseModifiers('1', undefined, false)
      expect(result.parry).toBe(0)
      expect(result.block).toBe(0)
      expect(result.retreatBonus).toBe(3)
      expect(result.canParry).toBe(true)
    })

    it('C weapons have no parry penalty in close combat', () => {
      const result = getCloseCombatDefenseModifiers('C', undefined, true)
      expect(result.parry).toBe(0)
      expect(result.canParry).toBe(true)
    })

    it('reach 1 weapons have -2 parry in close combat', () => {
      const result = getCloseCombatDefenseModifiers('1', undefined, true)
      expect(result.parry).toBe(-2)
      expect(result.canParry).toBe(true)
    })

    it('reach 2+ weapons cannot parry in close combat', () => {
      const result = getCloseCombatDefenseModifiers('2', undefined, true)
      expect(result.canParry).toBe(false)
    })

    it('medium/large shields have -2 block in close combat', () => {
      expect(getCloseCombatDefenseModifiers('1', 'medium', true).block).toBe(-2)
      expect(getCloseCombatDefenseModifiers('1', 'large', true).block).toBe(-2)
    })

    it('small shields have no block penalty in close combat', () => {
      expect(getCloseCombatDefenseModifiers('1', 'small', true).block).toBe(0)
    })

    it('retreat bonus is reduced to +1 in close combat', () => {
      const result = getCloseCombatDefenseModifiers('1', undefined, true)
      expect(result.retreatBonus).toBe(1)
    })
  })

  describe('Retreat Bonus (B377)', () => {
    it('normal retreat gives +3 Dodge, +1 Parry/Block', () => {
      const result = getRetreatBonus(false)
      expect(result.dodge).toBe(3)
      expect(result.parry).toBe(1)
      expect(result.block).toBe(1)
    })

    it('close combat retreat gives +1 to all defenses', () => {
      const result = getRetreatBonus(true)
      expect(result.dodge).toBe(1)
      expect(result.parry).toBe(1)
      expect(result.block).toBe(1)
    })
  })

  describe('Two-Phase Defense System', () => {
    describe('resolveAttackRoll', () => {
      it('returns hit=true when roll succeeds', () => {
        const random = () => 0.4
        const result = resolveAttackRoll(12, random)
        expect(result.hit).toBe(true)
        expect(result.roll.success).toBe(true)
      })

      it('returns hit=false when roll fails', () => {
        const random = () => 0.9
        const result = resolveAttackRoll(8, random)
        expect(result.hit).toBe(false)
      })

      it('returns critical=true and autoDefenseFails=true on critical hit', () => {
        const random = () => 0.001
        const result = resolveAttackRoll(14, random)
        expect(result.critical).toBe(true)
        expect(result.autoDefenseFails).toBe(true)
      })
    })

    describe('resolveDefenseRoll', () => {
      it('returns defended=true when roll succeeds', () => {
        const random = () => 0.4
        const result = resolveDefenseRoll(10, random)
        expect(result.defended).toBe(true)
      })

      it('returns defended=false when roll fails', () => {
        const random = () => 0.95
        const result = resolveDefenseRoll(10, random)
        expect(result.defended).toBe(false)
      })

      it('returns defended=false on critical failure even if roll would succeed', () => {
        const random = () => 0.999
        const result = resolveDefenseRoll(10, random)
        expect(result.criticalFailure).toBe(true)
        expect(result.defended).toBe(false)
      })
    })

    describe('calculateDefenseValue', () => {
      it('applies retreat bonus correctly for dodge', () => {
        const value = calculateDefenseValue(10, {
          retreat: true,
          dodgeAndDrop: false,
          inCloseCombat: false,
          defensesThisTurn: 0,
          deceptivePenalty: 0,
          postureModifier: 0,
          defenseType: 'dodge',
        })
        expect(value).toBe(13)
      })

      it('applies retreat bonus correctly for parry', () => {
        const value = calculateDefenseValue(10, {
          retreat: true,
          dodgeAndDrop: false,
          inCloseCombat: false,
          defensesThisTurn: 0,
          deceptivePenalty: 0,
          postureModifier: 0,
          defenseType: 'parry',
        })
        expect(value).toBe(11)
      })

      it('applies dodge and drop bonus (+3)', () => {
        const value = calculateDefenseValue(8, {
          retreat: false,
          dodgeAndDrop: true,
          inCloseCombat: false,
          defensesThisTurn: 0,
          deceptivePenalty: 0,
          postureModifier: 0,
          defenseType: 'dodge',
        })
        expect(value).toBe(11)
      })

      it('applies multiple defense penalty', () => {
        const value = calculateDefenseValue(10, {
          retreat: false,
          dodgeAndDrop: false,
          inCloseCombat: false,
          defensesThisTurn: 2,
          deceptivePenalty: 0,
          postureModifier: 0,
          defenseType: 'dodge',
        })
        expect(value).toBe(8)
      })

      it('applies deceptive attack penalty', () => {
        const value = calculateDefenseValue(10, {
          retreat: false,
          dodgeAndDrop: false,
          inCloseCombat: false,
          defensesThisTurn: 0,
          deceptivePenalty: 2,
          postureModifier: 0,
          defenseType: 'dodge',
        })
        expect(value).toBe(8)
      })

      it('never returns less than 3', () => {
        const value = calculateDefenseValue(5, {
          retreat: false,
          dodgeAndDrop: false,
          inCloseCombat: false,
          defensesThisTurn: 5,
          deceptivePenalty: 3,
          postureModifier: -2,
          defenseType: 'dodge',
        })
        expect(value).toBe(3)
      })

      it('close combat retreat gives reduced bonus', () => {
        const value = calculateDefenseValue(10, {
          retreat: true,
          dodgeAndDrop: false,
          inCloseCombat: true,
          defensesThisTurn: 0,
          deceptivePenalty: 0,
          postureModifier: 0,
          defenseType: 'dodge',
        })
        expect(value).toBe(11)
      })
    })
  })

  describe('Close Combat - Position Modifiers', () => {
    it('front position has no penalty', () => {
      expect(getCloseCombatPositionModifier('front')).toBe(0)
      expect(getCloseCombatPositionModifier(null)).toBe(0)
    })

    it('side position has -2 defense', () => {
      expect(getCloseCombatPositionModifier('side')).toBe(-2)
    })

    it('back position has -4 defense', () => {
      expect(getCloseCombatPositionModifier('back')).toBe(-4)
    })

    it('can defend from front and side', () => {
      expect(canDefendFromPosition('front')).toBe(true)
      expect(canDefendFromPosition('side')).toBe(true)
      expect(canDefendFromPosition(null)).toBe(true)
    })

    it('cannot defend from back', () => {
      expect(canDefendFromPosition('back')).toBe(false)
    })
  })

  describe('Quick Contest', () => {
    it('attacker wins when only attacker succeeds', () => {
      const lowRoll = () => 0.2
      const highRoll = () => 0.8
      let callCount = 0
      const random = () => {
        callCount++
        return callCount <= 3 ? lowRoll() : highRoll()
      }
      const result = quickContest(12, 10, random)
      expect(result.attacker.success).toBe(true)
      expect(result.defender.success).toBe(false)
      expect(result.attackerWins).toBe(true)
    })

    it('defender wins when only defender succeeds', () => {
      const lowRoll = () => 0.2
      const highRoll = () => 0.8
      let callCount = 0
      const random = () => {
        callCount++
        return callCount <= 3 ? highRoll() : lowRoll()
      }
      const result = quickContest(12, 10, random)
      expect(result.attacker.success).toBe(false)
      expect(result.defender.success).toBe(true)
      expect(result.attackerWins).toBe(false)
    })

    it('higher margin wins when both succeed', () => {
      const random = () => 0.3
      const result = quickContest(15, 10, random)
      expect(result.attacker.success).toBe(true)
      expect(result.defender.success).toBe(true)
      expect(result.attackerWins).toBe(true)
      expect(result.margin).toBeGreaterThan(0)
    })
  })

  describe('Grappling', () => {
    it('grapple attempt fails on missed attack', () => {
      const highRoll = () => 0.9
      const result = resolveGrappleAttempt(10, 12, 10, true, highRoll)
      expect(result.success).toBe(false)
      expect(result.controlPoints).toBe(0)
    })

    it('grapple succeeds and gains CP on successful attack vs undefended', () => {
      const lowRoll = () => 0.2
      const result = resolveGrappleAttempt(10, 12, 10, false, lowRoll)
      expect(result.success).toBe(true)
      expect(result.controlPoints).toBeGreaterThan(0)
    })

    it('grapple fails if defender successfully defends', () => {
      const lowRoll = () => 0.2
      const result = resolveGrappleAttempt(10, 12, 12, true, lowRoll)
      expect(result.attack.success).toBe(true)
      expect(result.defense?.success).toBe(true)
      expect(result.success).toBe(false)
    })

    it('break free succeeds with high ST vs low CP', () => {
      const lowRoll = () => 0.2
      const result = resolveBreakFree(14, 10, 2, lowRoll)
      expect(result.success).toBe(true)
    })

    it('break free fails with penalty from high CP', () => {
      const medRoll = () => 0.5
      const result = resolveBreakFree(10, 10, 8, medRoll)
      expect(result.success).toBe(false)
    })
  })

  describe('Grapple Techniques', () => {
    it('throw deals damage based on ST', () => {
      const lowRoll = () => 0.2
      const result = resolveGrappleTechnique('throw', 14, 12, 4, lowRoll)
      expect(result.success).toBe(true)
      expect(result.damage).toBeDefined()
      expect(result.effect).toContain('thrown')
    })

    it('lock deals 1d-1 damage', () => {
      const lowRoll = () => 0.2
      const result = resolveGrappleTechnique('lock', 14, 12, 4, lowRoll)
      expect(result.success).toBe(true)
      expect(result.damage).toBeDefined()
      expect(result.effect).toContain('lock')
    })

    it('choke causes FP loss', () => {
      const lowRoll = () => 0.2
      const result = resolveGrappleTechnique('choke', 14, 12, 4, lowRoll)
      expect(result.success).toBe(true)
      expect(result.effect).toContain('chok')
    })

    it('pin immobilizes target', () => {
      const lowRoll = () => 0.2
      const result = resolveGrappleTechnique('pin', 14, 12, 4, lowRoll)
      expect(result.success).toBe(true)
      expect(result.effect).toContain('pin')
    })

    it('techniques fail on bad roll', () => {
      const highRoll = () => 0.9
      const result = resolveGrappleTechnique('throw', 10, 12, 0, highRoll)
      expect(result.success).toBe(false)
      expect(result.effect).toBe('failed')
    })

    it('CP bonus improves technique skill', () => {
      const medRoll = () => 0.5
      const withoutCP = resolveGrappleTechnique('throw', 10, 12, 0, medRoll)
      const withCP = resolveGrappleTechnique('throw', 10, 12, 8, medRoll)
      expect(withCP.success).toBe(true)
      expect(withoutCP.success).toBe(false)
    })
  })

  describe('Hex Movement', () => {
    describe('hexDistance', () => {
      it('returns 0 for same hex', () => {
        expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0)
      })

      it('returns 1 for adjacent hexes', () => {
        expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1)
        expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 1 })).toBe(1)
        expect(hexDistance({ q: 0, r: 0 }, { q: -1, r: 1 })).toBe(1)
      })

      it('returns correct distance for far hexes', () => {
        expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3)
        expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: 2 })).toBe(4)
      })
    })

    describe('getHexNeighbor', () => {
      it('returns correct neighbor for each direction', () => {
        const center: HexPosition = { q: 0, r: 0 }
        expect(getHexNeighbor(center, 0)).toEqual({ q: 1, r: 0 })
        expect(getHexNeighbor(center, 1)).toEqual({ q: 1, r: -1 })
        expect(getHexNeighbor(center, 2)).toEqual({ q: 0, r: -1 })
        expect(getHexNeighbor(center, 3)).toEqual({ q: -1, r: 0 })
        expect(getHexNeighbor(center, 4)).toEqual({ q: -1, r: 1 })
        expect(getHexNeighbor(center, 5)).toEqual({ q: 0, r: 1 })
      })
    })

    describe('getRotationCost', () => {
      it('no cost to stay in same facing', () => {
        expect(getRotationCost(0, 0, false)).toBe(0)
        expect(getRotationCost(0, 0, true)).toBe(0)
      })

      it('first 60° rotation is free', () => {
        expect(getRotationCost(0, 1, false)).toBe(0)
        expect(getRotationCost(0, 5, false)).toBe(0)
      })

      it('subsequent rotations cost 1 each', () => {
        expect(getRotationCost(0, 2, false)).toBe(1)
        expect(getRotationCost(0, 3, false)).toBe(2)
      })

      it('after free rotation used, all rotations cost', () => {
        expect(getRotationCost(0, 1, true)).toBe(1)
        expect(getRotationCost(0, 2, true)).toBe(2)
      })

      it('takes shortest path for rotation', () => {
        expect(getRotationCost(0, 4, false)).toBe(1)
        expect(getRotationCost(0, 5, false)).toBe(0)
      })
    })

    describe('getRelativeDirection', () => {
      it('identifies front direction', () => {
        expect(getRelativeDirection(0, 0)).toBe('front')
      })

      it('identifies front-side directions', () => {
        expect(getRelativeDirection(0, 1)).toBe('front-side')
        expect(getRelativeDirection(0, 5)).toBe('front-side')
      })

      it('identifies rear-side directions', () => {
        expect(getRelativeDirection(0, 2)).toBe('rear-side')
        expect(getRelativeDirection(0, 4)).toBe('rear-side')
      })

      it('identifies rear direction', () => {
        expect(getRelativeDirection(0, 3)).toBe('rear')
      })
    })

    describe('getMovementCostToAdjacent', () => {
      it('costs 1 to move forward', () => {
        const from: HexPosition = { q: 0, r: 0 }
        const to = getHexNeighbor(from, 0)
        const result = getMovementCostToAdjacent(from, to, 0)
        expect(result.cost).toBe(1)
        expect(result.isBackward).toBe(false)
      })

      it('costs 1 to move to sides', () => {
        const from: HexPosition = { q: 0, r: 0 }
        const toLeft = getHexNeighbor(from, 1)
        const toRight = getHexNeighbor(from, 5)
        expect(getMovementCostToAdjacent(from, toLeft, 0).cost).toBe(1)
        expect(getMovementCostToAdjacent(from, toRight, 0).cost).toBe(1)
      })

      it('costs 2 to move backward', () => {
        const from: HexPosition = { q: 0, r: 0 }
        const to = getHexNeighbor(from, 3)
        const result = getMovementCostToAdjacent(from, to, 0)
        expect(result.cost).toBe(2)
        expect(result.isBackward).toBe(true)
      })
    })

    describe('getReachableHexes', () => {
      it('with Move 1, can reach 6 adjacent hexes', () => {
        const start: HexPosition = { q: 0, r: 0 }
        const reachable = getReachableHexes(start, 0, 1, false, [])
        expect(reachable.size).toBe(6)
      })

      it('backward hex reachable with Move 1 via free rotation', () => {
        const start: HexPosition = { q: 0, r: 0 }
        const reachable = getReachableHexes(start, 0, 1, false, [])
        const backward = getHexNeighbor(start, 3)
        const backwardKey = `${backward.q},${backward.r}`
        expect(reachable.has(backwardKey)).toBe(true)
        expect(reachable.get(backwardKey)!.cost).toBe(1)
      })

      it('far backward hex not reachable with Move 1', () => {
        const start: HexPosition = { q: 0, r: 0 }
        const reachable = getReachableHexes(start, 0, 1, false, [])
        const farBackward: HexPosition = { q: -2, r: 0 }
        const backwardKey = `${farBackward.q},${farBackward.r}`
        expect(reachable.has(backwardKey)).toBe(false)
      })

      it('backward hex reachable with Move 2 via rotation', () => {
        const start: HexPosition = { q: 0, r: 0 }
        const reachable = getReachableHexes(start, 0, 2, false, [])
        const backward = getHexNeighbor(start, 3)
        const backwardKey = `${backward.q},${backward.r}`
        expect(reachable.has(backwardKey)).toBe(true)
        expect(reachable.get(backwardKey)!.cost).toBe(1)
        expect(reachable.get(backwardKey)!.requiresBackwardMove).toBe(false)
      })

      it('respects occupied hexes', () => {
        const start: HexPosition = { q: 0, r: 0 }
        const blocked = getHexNeighbor(start, 0)
        const reachable = getReachableHexes(start, 0, 5, false, [blocked])
        const blockedKey = `${blocked.q},${blocked.r}`
        expect(reachable.has(blockedKey)).toBe(false)
      })

      it('with Move 5, can reach many hexes', () => {
        const start: HexPosition = { q: 0, r: 0 }
        const reachable = getReachableHexes(start, 0, 5, false, [])
        expect(reachable.size).toBeGreaterThan(20)
      })
    })

    describe('canMoveTo', () => {
      it('returns true for reachable hex', () => {
        const from: HexPosition = { q: 0, r: 0 }
        const to = getHexNeighbor(from, 0)
        expect(canMoveTo(from, to, 0, 5, false, [])).toBe(true)
      })

      it('returns false for hex too far', () => {
        const from: HexPosition = { q: 0, r: 0 }
        const to: HexPosition = { q: 10, r: 0 }
        expect(canMoveTo(from, to, 0, 5, false, [])).toBe(false)
      })

      it('returns false for occupied hex', () => {
        const from: HexPosition = { q: 0, r: 0 }
        const to = getHexNeighbor(from, 0)
        expect(canMoveTo(from, to, 0, 5, false, [to])).toBe(false)
      })
    })

    describe('executeMove', () => {
      it('updates position and reduces move points', () => {
        const state: MovementState = {
          position: { q: 0, r: 0 },
          facing: 0,
          movePointsRemaining: 5,
          freeRotationUsed: false,
          movedBackward: false,
        }
        const to = getHexNeighbor(state.position, 0)
        const result = executeMove(state, to, [])
        expect(result).not.toBeNull()
        expect(result!.position).toEqual(to)
        expect(result!.movePointsRemaining).toBe(4)
      })

      it('returns null if not enough move points', () => {
        const state: MovementState = {
          position: { q: 0, r: 0 },
          facing: 0,
          movePointsRemaining: 1,
          freeRotationUsed: false,
          movedBackward: false,
        }
        const far: HexPosition = { q: 5, r: 0 }
        const result = executeMove(state, far, [])
        expect(result).toBeNull()
      })

      it('uses optimal path via rotation instead of backward move', () => {
        const state: MovementState = {
          position: { q: 0, r: 0 },
          facing: 0,
          movePointsRemaining: 5,
          freeRotationUsed: false,
          movedBackward: false,
        }
        const backward = getHexNeighbor(state.position, 3)
        const result = executeMove(state, backward, [])
        expect(result).not.toBeNull()
        expect(result!.movedBackward).toBe(false)
        expect(result!.movePointsRemaining).toBe(4)
      })

      it('marks backward movement when rotation already used', () => {
        const state: MovementState = {
          position: { q: 0, r: 0 },
          facing: 0,
          movePointsRemaining: 5,
          freeRotationUsed: true,
          movedBackward: false,
        }
        const backward = getHexNeighbor(state.position, 3)
        const result = executeMove(state, backward, [])
        expect(result).not.toBeNull()
        expect(result!.movePointsRemaining).toBe(3)
      })
    })

    describe('executeRotation', () => {
      it('first rotation is free', () => {
        const state: MovementState = {
          position: { q: 0, r: 0 },
          facing: 0,
          movePointsRemaining: 5,
          freeRotationUsed: false,
          movedBackward: false,
        }
        const result = executeRotation(state, 1)
        expect(result).not.toBeNull()
        expect(result!.facing).toBe(1)
        expect(result!.movePointsRemaining).toBe(5)
      })

      it('subsequent rotations cost move points', () => {
        const state: MovementState = {
          position: { q: 0, r: 0 },
          facing: 0,
          movePointsRemaining: 5,
          freeRotationUsed: true,
          movedBackward: false,
        }
        const result = executeRotation(state, 2)
        expect(result).not.toBeNull()
        expect(result!.facing).toBe(2)
        expect(result!.movePointsRemaining).toBe(3)
      })

      it('returns null if not enough move points', () => {
        const state: MovementState = {
          position: { q: 0, r: 0 },
          facing: 0,
          movePointsRemaining: 1,
          freeRotationUsed: true,
          movedBackward: false,
        }
        const result = executeRotation(state, 3)
        expect(result).toBeNull()
      })
    })
  })

  describe('Hit Location System', () => {
    describe('HIT_LOCATION_DATA', () => {
      it('has correct penalty for torso (no penalty)', () => {
        expect(HIT_LOCATION_DATA.torso.penalty).toBe(0)
      })

      it('has correct penalty for skull (-7)', () => {
        expect(HIT_LOCATION_DATA.skull.penalty).toBe(-7)
      })

      it('has correct penalty for eye (-9)', () => {
        expect(HIT_LOCATION_DATA.eye.penalty).toBe(-9)
      })

      it('has correct penalty for vitals (-3)', () => {
        expect(HIT_LOCATION_DATA.vitals.penalty).toBe(-3)
      })

      it('has correct penalty for arm (-2)', () => {
        expect(HIT_LOCATION_DATA.arm_right.penalty).toBe(-2)
        expect(HIT_LOCATION_DATA.arm_left.penalty).toBe(-2)
      })

      it('has correct penalty for hand (-4)', () => {
        expect(HIT_LOCATION_DATA.hand_right.penalty).toBe(-4)
        expect(HIT_LOCATION_DATA.hand_left.penalty).toBe(-4)
      })

      it('skull has x4 damage multiplier', () => {
        expect(HIT_LOCATION_DATA.skull.damageMultiplier).toBe(4)
      })

      it('vitals has x3 damage multiplier for impaling', () => {
        expect(HIT_LOCATION_DATA.vitals.damageMultiplier).toBe(3)
        expect(HIT_LOCATION_DATA.vitals.woundingMultiplierTypes).toContain('impaling')
      })

      it('limbs have crippling thresholds', () => {
        expect(HIT_LOCATION_DATA.arm_right.cripplingThreshold).toBe(0.5)
        expect(HIT_LOCATION_DATA.hand_right.cripplingThreshold).toBe(0.33)
        expect(HIT_LOCATION_DATA.leg_right.cripplingThreshold).toBe(0.5)
        expect(HIT_LOCATION_DATA.foot_right.cripplingThreshold).toBe(0.33)
      })
    })

    describe('getHitLocationPenalty', () => {
      it('returns correct penalties', () => {
        expect(getHitLocationPenalty('torso')).toBe(0)
        expect(getHitLocationPenalty('skull')).toBe(-7)
        expect(getHitLocationPenalty('eye')).toBe(-9)
        expect(getHitLocationPenalty('vitals')).toBe(-3)
        expect(getHitLocationPenalty('neck')).toBe(-5)
        expect(getHitLocationPenalty('face')).toBe(-5)
        expect(getHitLocationPenalty('groin')).toBe(-3)
      })
    })

    describe('getHitLocationWoundingMultiplier', () => {
      it('returns x4 for skull with any damage type', () => {
        expect(getHitLocationWoundingMultiplier('skull', 'crushing')).toBe(4)
        expect(getHitLocationWoundingMultiplier('skull', 'cutting')).toBe(4)
        expect(getHitLocationWoundingMultiplier('skull', 'impaling')).toBe(4)
      })

      it('returns x3 for vitals with impaling', () => {
        expect(getHitLocationWoundingMultiplier('vitals', 'impaling')).toBe(3)
      })

      it('returns x1 for vitals with crushing', () => {
        expect(getHitLocationWoundingMultiplier('vitals', 'crushing')).toBe(1)
      })

      it('returns x2 for neck with cutting', () => {
        expect(getHitLocationWoundingMultiplier('neck', 'cutting')).toBe(2)
      })

      it('returns x1 for neck with crushing', () => {
        expect(getHitLocationWoundingMultiplier('neck', 'crushing')).toBe(1)
      })

      it('returns x1 for torso with any damage type', () => {
        expect(getHitLocationWoundingMultiplier('torso', 'crushing')).toBe(1)
        expect(getHitLocationWoundingMultiplier('torso', 'cutting')).toBe(1)
        expect(getHitLocationWoundingMultiplier('torso', 'impaling')).toBe(1)
      })

      it('returns x4 for eye with impaling', () => {
        expect(getHitLocationWoundingMultiplier('eye', 'impaling')).toBe(4)
      })
    })

    describe('rollRandomHitLocation', () => {
      it('returns skull for roll of 3 or 4', () => {
        const rollThree = () => 0
        expect(rollRandomHitLocation(rollThree)).toBe('skull')
      })

      it('returns face for roll of 5', () => {
        let call = 0
        const rollFive = () => {
          call++
          if (call === 1) return 0
          if (call === 2) return 0
          return 0.4
        }
        expect(rollRandomHitLocation(rollFive)).toBe('face')
      })

      it('returns torso for roll of 9-11', () => {
        const rollNine = () => 0.4
        expect(rollRandomHitLocation(rollNine)).toBe('torso')
      })

      it('returns groin for roll of 12', () => {
        const rollTwelve = () => 0.6
        expect(rollRandomHitLocation(rollTwelve)).toBe('groin')
      })
    })
  })
})
