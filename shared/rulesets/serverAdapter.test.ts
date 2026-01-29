import { describe, it, expect } from 'vitest'
import { getServerAdapter, isGurpsMatch } from './serverAdapter'
import type { MatchState } from '../types'

describe('Server Adapter Registry', () => {
  describe('getServerAdapter', () => {
    it('returns GURPS adapter with required methods', () => {
      const adapter = getServerAdapter('gurps')
      
      expect(adapter).toBeDefined()
      expect(adapter.combat).toBeDefined()
      expect(adapter.damage).toBeDefined()
      expect(adapter.closeCombat).toBeDefined()
      expect(adapter.gridSystem).toBeDefined()
      
      expect(typeof adapter.advanceTurn).toBe('function')
      expect(typeof adapter.initializeTurnMovement).toBe('function')
    })

    it('returns PF2 adapter with required methods', () => {
      const adapter = getServerAdapter('pf2')
      
      expect(adapter).toBeDefined()
      expect(adapter.combat).toBeDefined()
      expect(adapter.damage).toBeDefined()
      expect(adapter.pf2).toBeDefined()
      expect(adapter.gridSystem).toBeDefined()
      
      expect(typeof adapter.advanceTurn).toBe('function')
      expect(typeof adapter.initializeTurnMovement).toBe('function')
    })

    it('GURPS adapter uses hex grid system', () => {
      const adapter = getServerAdapter('gurps')
      
      expect(adapter.gridSystem.type).toBe('hex')
    })

    it('PF2 adapter uses square grid system', () => {
      const adapter = getServerAdapter('pf2')
      
      expect(adapter.gridSystem.type).toBe('square')
    })

    it('returns different adapters for different rulesets', () => {
      const gurpsAdapter = getServerAdapter('gurps')
      const pf2Adapter = getServerAdapter('pf2')
      
      expect(gurpsAdapter).not.toBe(pf2Adapter)
      expect(gurpsAdapter.gridSystem.type).not.toBe(pf2Adapter.gridSystem.type)
    })

    it('Unknown ruleset throws error', () => {
      expect(() => getServerAdapter('unknown' as any)).toThrow('Unknown ruleset: unknown')
    })
  })

  describe('isGurpsMatch', () => {
    const baseMatch = {
      id: 'test',
      name: 'Test Match',
      code: 'TEST',
      maxPlayers: 4,
      players: [],
      characters: [],
      combatants: [],
      activeTurnPlayerId: 'p1',
      round: 1,
      log: [],
      status: 'active' as const,
      createdAt: Date.now(),
    }

    it('returns true for GURPS match', () => {
      const match: MatchState = {
        ...baseMatch,
        rulesetId: 'gurps',
      }
      expect(isGurpsMatch(match)).toBe(true)
    })

    it('returns false for PF2 match', () => {
      const match: MatchState = {
        ...baseMatch,
        rulesetId: 'pf2',
      }
      expect(isGurpsMatch(match)).toBe(false)
    })

    it('returns false when rulesetId is undefined', () => {
      const match = {
        ...baseMatch,
        rulesetId: undefined,
      } as unknown as MatchState
      expect(isGurpsMatch(match)).toBe(false)
    })
  })
})
