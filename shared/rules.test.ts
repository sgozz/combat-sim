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
} from './rules'
import type { CharacterSheet, MatchState, CombatantState, Player } from './types'

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
        { playerId: 'p1', characterId: 'c1', position: { x: 0, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: 'attack', currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null },
        { playerId: 'p2', characterId: 'c2', position: { x: 1, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: null, currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null },
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
        { playerId: 'p1', characterId: 'c1', position: { x: 0, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: null, currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null },
        { playerId: 'p2', characterId: 'c2', position: { x: 1, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: 'attack', currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null },
      ]
      
      const match = createTestMatch(players, combatants)
      match.activeTurnPlayerId = 'p2'
      
      const next = advanceTurn(match)
      
      expect(next.activeTurnPlayerId).toBe('p1')
      expect(next.round).toBe(2)
    })

    it('clears shock and defending status on new turn', () => {
      const players: Player[] = [
        { id: 'p1', name: 'Player 1', isBot: false, characterId: 'c1' },
        { id: 'p2', name: 'Player 2', isBot: false, characterId: 'c2' },
      ]
      const combatants: CombatantState[] = [
        { playerId: 'p1', characterId: 'c1', position: { x: 0, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: 'attack', currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null },
        { playerId: 'p2', characterId: 'c2', position: { x: 1, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: null, currentHP: 10, currentFP: 10, statusEffects: ['shock', 'defending', 'stunned'], aimTurns: 0, aimTargetId: null },
      ]
      
      const match = createTestMatch(players, combatants)
      const next = advanceTurn(match)
      
      const p2Combatant = next.combatants.find(c => c.playerId === 'p2')
      expect(p2Combatant?.statusEffects).not.toContain('shock')
      expect(p2Combatant?.statusEffects).not.toContain('defending')
      expect(p2Combatant?.statusEffects).toContain('stunned')
    })

    it('resets maneuver for incoming player', () => {
      const players: Player[] = [
        { id: 'p1', name: 'Player 1', isBot: false, characterId: 'c1' },
        { id: 'p2', name: 'Player 2', isBot: false, characterId: 'c2' },
      ]
      const combatants: CombatantState[] = [
        { playerId: 'p1', characterId: 'c1', position: { x: 0, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: 'attack', currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null },
        { playerId: 'p2', characterId: 'c2', position: { x: 1, y: 0, z: 0 }, facing: 0, posture: 'standing', maneuver: 'all_out_defense', currentHP: 10, currentFP: 10, statusEffects: [], aimTurns: 0, aimTargetId: null },
      ]
      
      const match = createTestMatch(players, combatants)
      const next = advanceTurn(match)
      
      const p2Combatant = next.combatants.find(c => c.playerId === 'p2')
      expect(p2Combatant?.maneuver).toBeNull()
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
})
