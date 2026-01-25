import { describe, it, expect } from 'vitest'
import { assertRulesetId, getRulesetIdOrThrow } from './defaults'
import type { RulesetId } from '../types'

describe('Ruleset ID assertion helpers', () => {
  describe('assertRulesetId', () => {
    it('returns the ID when defined', () => {
      const gurps: RulesetId = 'gurps'
      const pf2: RulesetId = 'pf2'
      
      expect(assertRulesetId(gurps)).toBe('gurps')
      expect(assertRulesetId(pf2)).toBe('pf2')
    })

    it('throws when ID is undefined', () => {
      const undefinedId: RulesetId | undefined = undefined
      
      expect(() => assertRulesetId(undefinedId)).toThrow('Ruleset ID is required but was undefined')
    })
  })

  describe('getRulesetIdOrThrow', () => {
    it('returns the ID when defined', () => {
      const gurps: RulesetId = 'gurps'
      const pf2: RulesetId = 'pf2'
      
      expect(getRulesetIdOrThrow(gurps, 'test context')).toBe('gurps')
      expect(getRulesetIdOrThrow(pf2, 'another context')).toBe('pf2')
    })

    it('throws with context when ID is undefined', () => {
      const undefinedId: RulesetId | undefined = undefined
      
      expect(() => getRulesetIdOrThrow(undefinedId, 'match creation'))
        .toThrow('Ruleset ID is required for match creation')
      
      expect(() => getRulesetIdOrThrow(undefinedId, 'combat resolution'))
        .toThrow('Ruleset ID is required for combat resolution')
    })

    it('includes context in error message', () => {
      const undefinedId: RulesetId | undefined = undefined
      const context = 'specific operation XYZ'
      
      try {
        getRulesetIdOrThrow(undefinedId, context)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain(context)
      }
    })
  })
})
