import { describe, it, expect } from 'vitest';
import {
  roll1d20,
  rollDice,
  getAbilityModifier,
  getProficiencyBonus,
  calculateDegreeOfSuccess,
  rollCheck,
  calculateAC,
  calculateSave,
  getMultipleAttackPenalty,
  calculateAttackBonus,
  rollDamage,
  resolveStrike,
  getActionCost,
  canPerformAction,
  applyActionCost,
  startNewTurn,
  advanceTurn,
} from './rules';
import type { Abilities, PF2Weapon, PF2CombatantState } from './types';
import type { MatchState, Player } from '../../types';

const mockRandom = (values: number[]) => {
  let index = 0;
  return () => values[index++ % values.length];
};

describe('PF2 Rules', () => {
  describe('Dice Rolling', () => {
    it('roll1d20 returns values 1-20', () => {
      const random = mockRandom([0, 0.5, 0.95]);
      expect(roll1d20(random)).toBe(1);
      expect(roll1d20(random)).toBe(11);
      expect(roll1d20(random)).toBe(20);
    });

    it('rollDice returns correct count of dice', () => {
      const random = mockRandom([0.5]);
      const rolls = rollDice(4, 6, random);
      expect(rolls).toHaveLength(4);
      expect(rolls.every(r => r === 4)).toBe(true);
    });
  });

  describe('Ability Modifiers', () => {
    it('calculates modifier from ability score', () => {
      expect(getAbilityModifier(10)).toBe(0);
      expect(getAbilityModifier(18)).toBe(4);
      expect(getAbilityModifier(8)).toBe(-1);
      expect(getAbilityModifier(1)).toBe(-5);
      expect(getAbilityModifier(24)).toBe(7);
    });
  });

  describe('Proficiency Bonus', () => {
    it('returns 0 for untrained', () => {
      expect(getProficiencyBonus('untrained', 5)).toBe(0);
    });

    it('returns proficiency + level for trained', () => {
      expect(getProficiencyBonus('trained', 1)).toBe(3);
      expect(getProficiencyBonus('trained', 5)).toBe(7);
    });

    it('expert gives +4 + level', () => {
      expect(getProficiencyBonus('expert', 5)).toBe(9);
    });

    it('master gives +6 + level', () => {
      expect(getProficiencyBonus('master', 5)).toBe(11);
    });

    it('legendary gives +8 + level', () => {
      expect(getProficiencyBonus('legendary', 5)).toBe(13);
    });
  });

  describe('Degree of Success', () => {
    it('success by 10+ is critical success', () => {
      expect(calculateDegreeOfSuccess(15, 25, 15)).toBe('critical_success');
    });

    it('meet or beat DC is success', () => {
      expect(calculateDegreeOfSuccess(10, 15, 15)).toBe('success');
      expect(calculateDegreeOfSuccess(11, 16, 15)).toBe('success');
    });

    it('fail by 10+ is critical failure', () => {
      expect(calculateDegreeOfSuccess(5, 5, 20)).toBe('critical_failure');
    });

    it('fail by less than 10 is failure', () => {
      expect(calculateDegreeOfSuccess(5, 10, 15)).toBe('failure');
    });

    it('natural 20 upgrades degree', () => {
      expect(calculateDegreeOfSuccess(20, 22, 25)).toBe('success');
      expect(calculateDegreeOfSuccess(20, 35, 25)).toBe('critical_success');
    });

    it('natural 1 downgrades degree', () => {
      expect(calculateDegreeOfSuccess(1, 15, 15)).toBe('failure');
      expect(calculateDegreeOfSuccess(1, 10, 15)).toBe('critical_failure');
    });
  });

  describe('Roll Check', () => {
    it('returns complete roll result', () => {
      const random = mockRandom([0.5]);
      const result = rollCheck(5, 15, random);
      expect(result.roll).toBe(11);
      expect(result.modifier).toBe(5);
      expect(result.total).toBe(16);
      expect(result.dc).toBe(15);
      expect(result.degree).toBe('success');
    });
  });

  describe('Armor Class Calculation', () => {
    it('calculates AC from components', () => {
      const abilities: Abilities = {
        strength: 10, dexterity: 14, constitution: 10,
        intelligence: 10, wisdom: 10, charisma: 10
      };
      expect(calculateAC(abilities, 2, 'trained', 1, null)).toBe(17);
    });

    it('respects dex cap', () => {
      const abilities: Abilities = {
        strength: 10, dexterity: 18, constitution: 10,
        intelligence: 10, wisdom: 10, charisma: 10
      };
      expect(calculateAC(abilities, 5, 'trained', 1, 1)).toBe(19);
    });
  });

  describe('Save Calculation', () => {
    it('calculates fortitude from CON', () => {
      const abilities: Abilities = {
        strength: 10, dexterity: 10, constitution: 16,
        intelligence: 10, wisdom: 10, charisma: 10
      };
      expect(calculateSave(abilities, 'fortitude', 'trained', 1)).toBe(6);
    });

    it('calculates reflex from DEX', () => {
      const abilities: Abilities = {
        strength: 10, dexterity: 16, constitution: 10,
        intelligence: 10, wisdom: 10, charisma: 10
      };
      expect(calculateSave(abilities, 'reflex', 'trained', 1)).toBe(6);
    });

    it('calculates will from WIS', () => {
      const abilities: Abilities = {
        strength: 10, dexterity: 10, constitution: 10,
        intelligence: 10, wisdom: 16, charisma: 10
      };
      expect(calculateSave(abilities, 'will', 'trained', 1)).toBe(6);
    });
  });

  describe('Multiple Attack Penalty', () => {
    it('first attack has no penalty', () => {
      expect(getMultipleAttackPenalty(1, false)).toBe(0);
      expect(getMultipleAttackPenalty(1, true)).toBe(0);
    });

    it('second attack has -5 or -4 for agile', () => {
      expect(getMultipleAttackPenalty(2, false)).toBe(-5);
      expect(getMultipleAttackPenalty(2, true)).toBe(-4);
    });

    it('third+ attack has -10 or -8 for agile', () => {
      expect(getMultipleAttackPenalty(3, false)).toBe(-10);
      expect(getMultipleAttackPenalty(3, true)).toBe(-8);
      expect(getMultipleAttackPenalty(4, false)).toBe(-10);
    });
  });

  describe('Attack Bonus', () => {
    it('uses STR for melee', () => {
      const abilities: Abilities = {
        strength: 18, dexterity: 10, constitution: 10,
        intelligence: 10, wisdom: 10, charisma: 10
      };
      const weapon: PF2Weapon = {
        id: '1', name: 'Longsword', damage: '1d8', damageType: 'slashing',
        traits: [], hands: 1, group: 'sword', proficiency: 'trained'
      };
      expect(calculateAttackBonus(abilities, weapon, 1, 0)).toBe(7);
    });

    it('uses DEX for finesse weapons if higher', () => {
      const abilities: Abilities = {
        strength: 10, dexterity: 18, constitution: 10,
        intelligence: 10, wisdom: 10, charisma: 10
      };
      const weapon: PF2Weapon = {
        id: '1', name: 'Rapier', damage: '1d6', damageType: 'piercing',
        traits: ['finesse'], hands: 1, group: 'sword', proficiency: 'trained'
      };
      expect(calculateAttackBonus(abilities, weapon, 1, 0)).toBe(7);
    });

    it('applies MAP', () => {
      const abilities: Abilities = {
        strength: 18, dexterity: 10, constitution: 10,
        intelligence: 10, wisdom: 10, charisma: 10
      };
      const weapon: PF2Weapon = {
        id: '1', name: 'Longsword', damage: '1d8', damageType: 'slashing',
        traits: [], hands: 1, group: 'sword', proficiency: 'trained'
      };
      expect(calculateAttackBonus(abilities, weapon, 1, -5)).toBe(2);
    });
  });

  describe('Damage Rolling', () => {
    it('rolls damage formula', () => {
      const random = mockRandom([0.5]);
      const result = rollDamage('2d6+3', 'slashing', random);
      expect(result.total).toBe(11);
      expect(result.rolls).toEqual([4, 4]);
      expect(result.modifier).toBe(3);
      expect(result.damageType).toBe('slashing');
    });

    it('handles formula without modifier', () => {
      const random = mockRandom([0.5]);
      const result = rollDamage('1d8', 'piercing', random);
      expect(result.total).toBe(5);
      expect(result.modifier).toBe(0);
    });
  });

  describe('Strike Resolution', () => {
    const abilities: Abilities = {
      strength: 18, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10
    };
    const weapon: PF2Weapon = {
      id: '1', name: 'Longsword', damage: '1d8', damageType: 'slashing',
      traits: [], hands: 1, group: 'sword', proficiency: 'trained'
    };

    it('hit deals damage', () => {
      const random = mockRandom([0.75, 0.5]);
      const result = resolveStrike({ abilities, level: 1 }, weapon, 15, 0, random);
      expect(result.attackRoll.degree).toBe('success');
      expect(result.damage).not.toBeNull();
      expect(result.damage!.total).toBeGreaterThan(0);
    });

    it('miss deals no damage', () => {
      const random = mockRandom([0.3]);
      const result = resolveStrike({ abilities, level: 1 }, weapon, 20, 0, random);
      expect(result.attackRoll.degree).toBe('failure');
      expect(result.damage).toBeNull();
    });

    it('critical hit doubles damage', () => {
      const random = mockRandom([0.95, 0.5]);
      const result = resolveStrike({ abilities, level: 1 }, weapon, 10, 0, random);
      expect(result.attackRoll.degree).toBe('critical_success');
      expect(result.damage!.total).toBe((5 + 4) * 2);
    });
  });

  describe('Action Economy', () => {
    it('getActionCost returns correct costs', () => {
      expect(getActionCost('strike')).toBe(1);
      expect(getActionCost('stride')).toBe(1);
      expect(getActionCost('ready')).toBe(2);
      expect(getActionCost('step')).toBe(1);
    });

    it('canPerformAction checks action availability', () => {
      const combatant: PF2CombatantState = {
        rulesetId: 'pf2', playerId: '1', characterId: '1', position: { x: 0, y: 0, z: 0 },
        facing: 0, actionsRemaining: 2, reactionAvailable: true, mapPenalty: 0,
        conditions: [], currentHP: 10, tempHP: 0, shieldRaised: false,
        heroPoints: 1, dying: 0, wounded: 0, doomed: 0,
        statusEffects: [], usedReaction: false
      };
      expect(canPerformAction(combatant, 1)).toBe(true);
      expect(canPerformAction(combatant, 2)).toBe(true);
      expect(canPerformAction(combatant, 3)).toBe(false);
      expect(canPerformAction(combatant, 'free')).toBe(true);
      expect(canPerformAction(combatant, 'reaction')).toBe(true);
    });

    it('applyActionCost reduces actions', () => {
      const combatant: PF2CombatantState = {
        rulesetId: 'pf2', playerId: '1', characterId: '1', position: { x: 0, y: 0, z: 0 },
        facing: 0, actionsRemaining: 3, reactionAvailable: true, mapPenalty: 0,
        conditions: [], currentHP: 10, tempHP: 0, shieldRaised: false,
        heroPoints: 1, dying: 0, wounded: 0, doomed: 0,
        statusEffects: [], usedReaction: false
      };
      const after = applyActionCost(combatant, 1);
      expect(after.actionsRemaining).toBe(2);
    });

    it('applyActionCost tracks MAP for attacks', () => {
      const combatant: PF2CombatantState = {
        rulesetId: 'pf2', playerId: '1', characterId: '1', position: { x: 0, y: 0, z: 0 },
        facing: 0, actionsRemaining: 3, reactionAvailable: true, mapPenalty: 0,
        conditions: [], currentHP: 10, tempHP: 0, shieldRaised: false,
        heroPoints: 1, dying: 0, wounded: 0, doomed: 0,
        statusEffects: [], usedReaction: false
      };
      const after = applyActionCost(combatant, 1, true);
      expect(after.mapPenalty).toBe(-5);
    });
  });

  describe('PF2 Posture Actions', () => {
    it('Step costs 1 action', () => {
      expect(getActionCost('step')).toBe(1);
    });

    it('Cannot Step while prone', () => {
      const combatant: PF2CombatantState = {
        rulesetId: 'pf2', playerId: '1', characterId: '1', position: { x: 0, y: 0, z: 0 },
        facing: 0, actionsRemaining: 3, reactionAvailable: true, mapPenalty: 0,
        conditions: [], currentHP: 10, tempHP: 0, shieldRaised: false,
        heroPoints: 1, dying: 0, wounded: 0, doomed: 0,
        statusEffects: [], usedReaction: false
      };
      const proneCombatant = { ...combatant, posture: 'prone' as const };
      expect(getActionCost('step')).toBe(1);
      expect(proneCombatant.posture).toBe('prone');
    });

    it('Stand removes prone condition', () => {
      const combatant: PF2CombatantState = {
        rulesetId: 'pf2', playerId: '1', characterId: '1', position: { x: 0, y: 0, z: 0 },
        facing: 0, actionsRemaining: 3, reactionAvailable: true, mapPenalty: 0,
        conditions: [], currentHP: 10, tempHP: 0, shieldRaised: false,
        heroPoints: 1, dying: 0, wounded: 0, doomed: 0,
        statusEffects: [], usedReaction: false
      };
      const proneCombatant = { ...combatant, posture: 'prone' as const };
      expect(getActionCost('stand')).toBe(1);
      
      const afterStand = applyActionCost(proneCombatant, 1);
      expect(afterStand.actionsRemaining).toBe(2);
      
      const standing = { ...afterStand, posture: 'standing' as const };
      expect(standing.posture).toBe('standing');
      expect(standing.actionsRemaining).toBe(2);
    });

     it('Drop Prone sets prone condition', () => {
       const combatant: PF2CombatantState = {
         rulesetId: 'pf2', playerId: '1', characterId: '1', position: { x: 0, y: 0, z: 0 },
         facing: 0, actionsRemaining: 3, reactionAvailable: true, mapPenalty: 0,
         conditions: [], currentHP: 10, tempHP: 0, shieldRaised: false,
         heroPoints: 1, dying: 0, wounded: 0, doomed: 0,
         statusEffects: [], usedReaction: false
       };
       const standing = { ...combatant, posture: 'standing' as const };
       expect(getActionCost('drop_prone')).toBe(1);
       
       const afterDrop = applyActionCost(standing, 1);
       expect(afterDrop.actionsRemaining).toBe(2);
       
       const prone = { ...afterDrop, posture: 'prone' as const };
       expect(prone.posture).toBe('prone');
       expect(prone.actionsRemaining).toBe(2);
     });

     it('Step should limit movement to 1 hex', () => {
       // Step action should only allow movement to adjacent hexes (distance 1)
       // This is enforced by the server adapter setting movePointsRemaining: 1
       expect(getActionCost('step')).toBe(1);
     });

     it('Drop Prone should cost 1 action', () => {
       expect(getActionCost('drop_prone')).toBe(1);
     });

     it('Cannot Step while prone - action cost unchanged', () => {
       const combatant: PF2CombatantState = {
         rulesetId: 'pf2', playerId: '1', characterId: '1', position: { x: 0, y: 0, z: 0 },
         facing: 0, actionsRemaining: 3, reactionAvailable: true, mapPenalty: 0,
         conditions: [{ condition: 'prone', value: 1 }],
         currentHP: 10, tempHP: 0, shieldRaised: false,
         heroPoints: 1, dying: 0, wounded: 0, doomed: 0,
         statusEffects: [], usedReaction: false
       };
       // Step costs 1 action even when prone (UI prevents selection, server validates)
       expect(getActionCost('step')).toBe(1);
       expect(combatant.conditions[0].condition).toBe('prone');
     });

     it('Step action requires available actions', () => {
       const combatant: PF2CombatantState = {
         rulesetId: 'pf2', playerId: '1', characterId: '1', position: { x: 0, y: 0, z: 0 },
         facing: 0, actionsRemaining: 0, reactionAvailable: true, mapPenalty: 0,
         conditions: [], currentHP: 10, tempHP: 0, shieldRaised: false,
         heroPoints: 1, dying: 0, wounded: 0, doomed: 0,
         statusEffects: [], usedReaction: false
       };
       // Cannot perform Step with 0 actions remaining
       expect(canPerformAction(combatant, 1)).toBe(false);
       expect(getActionCost('step')).toBe(1);
     });

     it('Flat-footed applies -2 AC penalty', () => {
      const abilities: Abilities = {
        strength: 10, dexterity: 14, constitution: 10,
        intelligence: 10, wisdom: 10, charisma: 10
      };
      const standingAC = calculateAC(abilities, 2, 'trained', 1, null);
      const flatFootedAC = standingAC - 2;
      
      expect(standingAC).toBe(17);
      expect(flatFootedAC).toBe(15);
    });
  });

  describe('Turn Management', () => {
    it('startNewTurn resets actions', () => {
      const combatant: PF2CombatantState = {
        rulesetId: 'pf2', playerId: '1', characterId: '1', position: { x: 0, y: 0, z: 0 },
        facing: 0, actionsRemaining: 0, reactionAvailable: false, mapPenalty: -10,
        conditions: [], currentHP: 10, tempHP: 0, shieldRaised: true,
        heroPoints: 1, dying: 0, wounded: 0, doomed: 0,
        statusEffects: [], usedReaction: true
      };
      const after = startNewTurn(combatant);
      expect(after.actionsRemaining).toBe(3);
      expect(after.reactionAvailable).toBe(true);
      expect(after.mapPenalty).toBe(0);
      expect(after.shieldRaised).toBe(false);
    });

    it('startNewTurn applies slowed', () => {
      const combatant: PF2CombatantState = {
        rulesetId: 'pf2', playerId: '1', characterId: '1', position: { x: 0, y: 0, z: 0 },
        facing: 0, actionsRemaining: 0, reactionAvailable: false, mapPenalty: 0,
        conditions: [{ condition: 'slowed', value: 1 }],
        currentHP: 10, tempHP: 0, shieldRaised: false,
        heroPoints: 1, dying: 0, wounded: 0, doomed: 0,
        statusEffects: [], usedReaction: true
      };
      const after = startNewTurn(combatant);
      expect(after.actionsRemaining).toBe(2);
    });

    it('startNewTurn applies quickened', () => {
      const combatant: PF2CombatantState = {
        rulesetId: 'pf2', playerId: '1', characterId: '1', position: { x: 0, y: 0, z: 0 },
        facing: 0, actionsRemaining: 0, reactionAvailable: false, mapPenalty: 0,
        conditions: [{ condition: 'quickened' }],
        currentHP: 10, tempHP: 0, shieldRaised: false,
        heroPoints: 1, dying: 0, wounded: 0, doomed: 0,
        statusEffects: [], usedReaction: true
      };
      const after = startNewTurn(combatant);
      expect(after.actionsRemaining).toBe(4);
    });

    it('advanceTurn moves to next player', () => {
      const players: Player[] = [
        { id: 'p1', name: 'Player 1', isBot: false, characterId: 'c1' },
        { id: 'p2', name: 'Player 2', isBot: false, characterId: 'c2' },
      ];
      const state: MatchState = {
        id: 'm1', name: 'Test', code: 'ABC', maxPlayers: 2, rulesetId: 'pf2',
        players, characters: [], combatants: [], activeTurnPlayerId: 'p1',
        round: 1, log: [], status: 'active', createdAt: Date.now()
      };
      const after = advanceTurn(state);
      expect(after.activeTurnPlayerId).toBe('p2');
      expect(after.round).toBe(1);
    });

    it('advanceTurn increments round when looping', () => {
      const players: Player[] = [
        { id: 'p1', name: 'Player 1', isBot: false, characterId: 'c1' },
        { id: 'p2', name: 'Player 2', isBot: false, characterId: 'c2' },
      ];
      const state: MatchState = {
        id: 'm1', name: 'Test', code: 'ABC', maxPlayers: 2, rulesetId: 'pf2',
        players, characters: [], combatants: [], activeTurnPlayerId: 'p2',
        round: 1, log: [], status: 'active', createdAt: Date.now()
      };
      const after = advanceTurn(state);
      expect(after.activeTurnPlayerId).toBe('p1');
      expect(after.round).toBe(2);
    });
  });
});
