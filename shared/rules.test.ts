import { describe, it, expect } from 'vitest'
import { skillCheck, rollDamage, resolveAttack, calculateDerivedStats } from './rules'

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
      // Skill 10. Roll 12 (fail).
      const random = () => 0.6
      const result = resolveAttack({ skill: 10, damage: '1d', random })
      expect(result.outcome).toBe('miss')
    })

    it('handles hit', () => {
      // Skill 10. Roll 9 (success). Defense undefined.
      const random = () => 0.4
      const result = resolveAttack({ skill: 10, damage: '1d', random })
      expect(result.outcome).toBe('hit')
      expect(result.damage?.total).toBe(3) // 1d rolled 3
    })
  })
})
