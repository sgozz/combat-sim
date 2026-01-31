import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import { handlePF2CastSpell } from './spell';
import { createPF2Combatant, createPF2Character, createMatch, createMockSocket, createPlayer } from './__tests__/testUtils';
import type { SpellCaster } from '../../../../shared/rulesets/pf2/types';
import type { DamageRoll, D20RollResult } from '../../../../shared/rulesets/pf2/rules';

const mockSendMessage = vi.fn();
const mockSendToMatch = vi.fn();
const mockUpdateMatchState = vi.fn();
const mockGetCharacterById = vi.fn();
const mockGetCombatantByPlayerId = vi.fn();
const mockCanCastSpell = vi.fn();
const mockCalculateSpellAttack = vi.fn();
const mockCalculateSpellDC = vi.fn();
const mockRollCheck = vi.fn();
const mockRollDamage = vi.fn();
const mockApplyHealing = vi.fn();
const mockGetAbilityModifier = vi.fn();
const mockGetSpell = vi.fn();

vi.mock('../../state', () => ({ state: { matches: new Map() } }));
vi.mock('../../db', () => ({ updateMatchState: (...args: unknown[]) => mockUpdateMatchState(...args) }));
vi.mock('../../helpers', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  sendToMatch: (...args: unknown[]) => mockSendToMatch(...args),
  getCombatantByPlayerId: (...args: unknown[]) => mockGetCombatantByPlayerId(...args),
  getCharacterById: (...args: unknown[]) => mockGetCharacterById(...args),
}));

vi.mock('../../../../shared/rulesets/pf2/rules', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/rulesets/pf2/rules')>();
  return {
    ...actual,
    canCastSpell: (...args: unknown[]) => mockCanCastSpell(...args),
    calculateSpellAttack: (...args: unknown[]) => mockCalculateSpellAttack(...args),
    calculateSpellDC: (...args: unknown[]) => mockCalculateSpellDC(...args),
    rollCheck: (...args: unknown[]) => mockRollCheck(...args),
    rollDamage: (...args: unknown[]) => mockRollDamage(...args),
    applyHealing: (...args: unknown[]) => mockApplyHealing(...args),
    getAbilityModifier: (...args: unknown[]) => mockGetAbilityModifier(...args),
  };
});

vi.mock('../../../../shared/rulesets/pf2/spellData', () => ({
  getSpell: (...args: unknown[]) => mockGetSpell(...args),
}));

describe('handlePF2CastSpell', () => {
  let socket: WebSocket;
  const matchId = 'match1';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCharacterById.mockReset();
    socket = createMockSocket() as unknown as WebSocket;
  });

  const createWizardCaster = (): SpellCaster => ({
    name: 'Arcane Prepared Spells',
    tradition: 'arcane',
    type: 'prepared',
    proficiency: 2,
    slots: [
      { level: 0, total: 5, used: 0 },
      { level: 1, total: 2, used: 0 },
    ],
    focusPool: { max: 1, current: 1 },
    knownSpells: [
      { level: 0, spells: ['Electric Arc'] },
      { level: 1, spells: ['Magic Missile', 'Fear'] },
    ],
  });

  const createClericCaster = (): SpellCaster => ({
    name: 'Divine Prepared Spells',
    tradition: 'divine',
    type: 'prepared',
    proficiency: 2,
    slots: [
      { level: 0, total: 5, used: 0 },
      { level: 1, total: 3, used: 0 },
    ],
    focusPool: { max: 1, current: 1 },
    knownSpells: [
      { level: 0, spells: ['Guidance'] },
      { level: 1, spells: ['Heal'] },
    ],
  });

  describe('Save + Damage spell (Electric Arc)', () => {
    it('should apply damage based on save degree and cost 2 actions', async () => {
      const wizardCaster = createWizardCaster();
      const actorChar = createPF2Character({
        id: 'char1',
        name: 'Wizard',
        spellcasters: [wizardCaster],
        abilities: { strength: 10, dexterity: 14, constitution: 12, intelligence: 18, wisdom: 10, charisma: 10 },
        derived: {
          hitPoints: 20,
          armorClass: 15,
          speed: 25,
          fortitudeSave: 3,
          reflexSave: 5,
          willSave: 4,
          perception: 2,
        },
      });
      const targetChar = createPF2Character({
        id: 'char2',
        name: 'Enemy',
        derived: {
          hitPoints: 30,
          armorClass: 18,
          speed: 25,
          fortitudeSave: 5,
          reflexSave: 3,
          willSave: 2,
          perception: 3,
        },
      });
      const actorCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
      });
      const targetCombatant = createPF2Combatant({
        playerId: 'player2',
        characterId: 'char2',
        currentHP: 30,
      });
      const player = createPlayer({ id: 'player1' });
      const match = createMatch({
        combatants: [actorCombatant, targetCombatant],
        characters: [actorChar, targetChar],
      });

      mockGetCombatantByPlayerId.mockReturnValue(actorCombatant);
      mockGetCharacterById
        .mockReturnValueOnce(actorChar)
        .mockReturnValueOnce(targetChar)
        .mockReturnValueOnce(targetChar);
      mockCanCastSpell.mockReturnValue({ success: true, isCantrip: true, spellLevel: 0 });
      mockCalculateSpellAttack.mockReturnValue(7);
      mockCalculateSpellDC.mockReturnValue(17);
      mockGetAbilityModifier.mockReturnValue(4);
      mockGetSpell.mockReturnValue({
        name: 'Electric Arc',
        level: 0,
        tradition: 'arcane',
        castActions: 2,
        targetType: 'single',
        save: 'reflex',
        damageFormula: '1d4+{mod}',
        damageType: 'electricity',
      });
      mockRollDamage.mockReturnValue({ total: 6, rolls: [2], damageType: 'electricity' } as DamageRoll);
      mockRollCheck.mockReturnValue({
        roll: 8,
        modifier: 3,
        total: 11,
        dc: 17,
        degree: 'failure',
        natural20: false,
        natural1: false,
      } as D20RollResult);

      await handlePF2CastSpell(socket, matchId, match, player, actorCombatant, {
        type: 'pf2_cast_spell',
        casterIndex: 0,
        spellName: 'Electric Arc',
        spellLevel: 0,
        targetId: 'player2',
      });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player1',
              actionsRemaining: 1,
            }),
            expect.objectContaining({
              playerId: 'player2',
              currentHP: 24,
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('Electric Arc')]),
        }),
      });
      expect(mockUpdateMatchState).toHaveBeenCalled();
    });
  });

  describe('No-save + Damage spell (Magic Missile)', () => {
    it('should apply flat damage without save roll', async () => {
      const wizardCaster = createWizardCaster();
      const actorChar = createPF2Character({
        id: 'char1',
        name: 'Wizard',
        spellcasters: [wizardCaster],
        abilities: { strength: 10, dexterity: 14, constitution: 12, intelligence: 18, wisdom: 10, charisma: 10 },
        derived: {
          hitPoints: 20,
          armorClass: 15,
          speed: 25,
          fortitudeSave: 3,
          reflexSave: 5,
          willSave: 4,
          perception: 2,
        },
      });
      const targetChar = createPF2Character({
        id: 'char2',
        name: 'Enemy',
        derived: {
          hitPoints: 30,
          armorClass: 18,
          speed: 25,
          fortitudeSave: 5,
          reflexSave: 3,
          willSave: 2,
          perception: 3,
        },
      });
      const actorCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
      });
      const targetCombatant = createPF2Combatant({
        playerId: 'player2',
        characterId: 'char2',
        currentHP: 30,
      });
      const player = createPlayer({ id: 'player1' });
      const match = createMatch({
        combatants: [actorCombatant, targetCombatant],
        characters: [actorChar, targetChar],
      });

      mockGetCombatantByPlayerId.mockReturnValue(actorCombatant);
      mockGetCharacterById.mockImplementation((_match, charId) => {
        if (charId === 'char1') return actorChar;
        if (charId === 'char2') return targetChar;
        return undefined;
      });
      mockCanCastSpell.mockReturnValue({ success: true, spellLevel: 1 });
      mockCalculateSpellAttack.mockReturnValue(7);
      mockCalculateSpellDC.mockReturnValue(17);
      mockGetAbilityModifier.mockReturnValue(4);
      mockGetSpell.mockReturnValue({
        name: 'Magic Missile',
        level: 1,
        tradition: 'arcane',
        castActions: 2,
        targetType: 'single',
        damageFormula: '1d4+1',
        damageType: 'force',
      });
      mockRollDamage.mockReturnValue({ total: 4, rolls: [3], damageType: 'force' } as DamageRoll);

      await handlePF2CastSpell(socket, matchId, match, player, actorCombatant, {
        type: 'pf2_cast_spell',
        casterIndex: 0,
        spellName: 'Magic Missile',
        spellLevel: 1,
        targetId: 'player2',
      });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player2',
              currentHP: 26,
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('dealing 4 force damage')]),
        }),
      });
      expect(mockRollCheck).not.toHaveBeenCalled();
    });
  });

  describe('Heal spell', () => {
    it('should heal target and handle dying → wounded', async () => {
      const clericCaster = createClericCaster();
      const actorChar = createPF2Character({
        id: 'char1',
        name: 'Cleric',
        spellcasters: [clericCaster],
        abilities: { strength: 10, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 18, charisma: 14 },
        derived: {
          hitPoints: 22,
          armorClass: 16,
          speed: 25,
          fortitudeSave: 5,
          reflexSave: 3,
          willSave: 6,
          perception: 4,
        },
      });
      const targetChar = createPF2Character({
        id: 'char2',
        name: 'Wounded Fighter',
      });
      const actorCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
      });
      const targetCombatant = createPF2Combatant({
        playerId: 'player2',
        characterId: 'char2',
        currentHP: 0,
        dying: 2,
        conditions: [{ condition: 'unconscious' }],
        statusEffects: ['unconscious'],
      });
      const player = createPlayer({ id: 'player1' });
      const match = createMatch({
        combatants: [actorCombatant, targetCombatant],
        characters: [actorChar, targetChar],
      });

      mockGetCombatantByPlayerId.mockReturnValue(actorCombatant);
      mockGetCharacterById.mockImplementation((_match, charId) => {
        if (charId === 'char1') return actorChar;
        if (charId === 'char2') return {
          ...targetChar,
          derived: {
            ...targetChar.derived,
            hitPoints: 30,
            armorClass: 18,
            speed: 25,
            fortitudeSave: 5,
            reflexSave: 3,
            willSave: 2,
            perception: 3,
          },
        };
        return undefined;
      });
      mockCanCastSpell.mockReturnValue({ success: true, spellLevel: 1 });
      mockCalculateSpellAttack.mockReturnValue(8);
      mockCalculateSpellDC.mockReturnValue(18);
      mockGetSpell.mockReturnValue({
        name: 'Heal',
        level: 1,
        tradition: 'divine',
        castActions: 2,
        targetType: 'single',
        healFormula: '1d8',
      });
      mockRollDamage.mockReturnValue({ total: 6, rolls: [6], damageType: 'positive' } as DamageRoll);
      mockApplyHealing.mockReturnValue({
        ...targetCombatant,
        currentHP: 6,
        dying: 0,
        wounded: 1,
        conditions: [],
        statusEffects: [],
      });

      await handlePF2CastSpell(socket, matchId, match, player, actorCombatant, {
        type: 'pf2_cast_spell',
        casterIndex: 0,
        spellName: 'Heal',
        spellLevel: 1,
        targetId: 'player2',
      });

      expect(mockApplyHealing).toHaveBeenCalledWith(
        expect.objectContaining({ playerId: 'player2' }),
        6,
        30
      );
      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          log: expect.arrayContaining([expect.stringContaining('healing')]),
        }),
      });
    });
  });

  describe('Condition spell (Fear)', () => {
    it('should apply condition on failed save', async () => {
      const wizardCaster = createWizardCaster();
      const actorChar = createPF2Character({
        id: 'char1',
        name: 'Wizard',
        spellcasters: [wizardCaster],
        abilities: { strength: 10, dexterity: 14, constitution: 12, intelligence: 18, wisdom: 10, charisma: 10 },
        derived: {
          hitPoints: 20,
          armorClass: 15,
          speed: 25,
          fortitudeSave: 3,
          reflexSave: 5,
          willSave: 4,
          perception: 2,
        },
      });
      const targetChar = createPF2Character({
        id: 'char2',
        name: 'Enemy',
        derived: {
          hitPoints: 30,
          armorClass: 18,
          speed: 25,
          fortitudeSave: 5,
          reflexSave: 3,
          willSave: 2,
          perception: 3,
        },
      });
      const actorCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
      });
      const targetCombatant = createPF2Combatant({
        playerId: 'player2',
        characterId: 'char2',
      });
      const player = createPlayer({ id: 'player1' });
      const match = createMatch({
        combatants: [actorCombatant, targetCombatant],
        characters: [actorChar, targetChar],
      });

      mockGetCombatantByPlayerId.mockReturnValue(actorCombatant);
      mockGetCharacterById
        .mockReturnValueOnce(actorChar)
        .mockReturnValueOnce(targetChar)
        .mockReturnValueOnce(targetChar);
      mockCanCastSpell.mockReturnValue({ success: true, spellLevel: 1 });
      mockCalculateSpellAttack.mockReturnValue(7);
      mockCalculateSpellDC.mockReturnValue(17);
      mockGetSpell.mockReturnValue({
        name: 'Fear',
        level: 1,
        tradition: 'arcane',
        castActions: 2,
        targetType: 'single',
        save: 'will',
        conditions: [{ condition: 'frightened', value: 1 }],
        duration: 'varies',
      });
      mockRollCheck.mockReturnValue({
        roll: 10,
        modifier: 2,
        total: 12,
        dc: 17,
        degree: 'failure',
        natural20: false,
        natural1: false,
      } as D20RollResult);

      await handlePF2CastSpell(socket, matchId, match, player, actorCombatant, {
        type: 'pf2_cast_spell',
        casterIndex: 0,
        spellName: 'Fear',
        spellLevel: 1,
        targetId: 'player2',
      });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player2',
              conditions: expect.arrayContaining([{ condition: 'frightened', value: 1 }]),
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('frightened')]),
        }),
      });
    });
  });

  describe('Resource consumption - Cantrip', () => {
    it('should not consume spell slot for cantrip', async () => {
      const wizardCaster = createWizardCaster();
      const actorChar = createPF2Character({
        id: 'char1',
        name: 'Wizard',
        spellcasters: [wizardCaster],
        abilities: { strength: 10, dexterity: 14, constitution: 12, intelligence: 18, wisdom: 10, charisma: 10 },
        derived: {
          hitPoints: 20,
          armorClass: 15,
          speed: 25,
          fortitudeSave: 3,
          reflexSave: 5,
          willSave: 4,
          perception: 2,
        },
      });
      const actorCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        spellSlotUsage: [],
      });
      const player = createPlayer({ id: 'player1' });
      const match = createMatch({
        combatants: [actorCombatant],
        characters: [actorChar],
      });

      mockGetCombatantByPlayerId.mockReturnValue(actorCombatant);
      mockGetCharacterById.mockImplementation((_match, charId) => {
        if (charId === 'char1') return actorChar;
        return undefined;
      });
      mockCanCastSpell.mockReturnValue({ success: true, isCantrip: true, spellLevel: 0 });
      mockCalculateSpellAttack.mockReturnValue(7);
      mockCalculateSpellDC.mockReturnValue(17);
      mockGetSpell.mockReturnValue({
        name: 'Electric Arc',
        level: 0,
        tradition: 'arcane',
        castActions: 2,
        targetType: 'single',
        save: 'reflex',
        damageFormula: '1d4+{mod}',
        damageType: 'electricity',
      });

      await handlePF2CastSpell(socket, matchId, match, player, actorCombatant, {
        type: 'pf2_cast_spell',
        casterIndex: 0,
        spellName: 'Electric Arc',
        spellLevel: 0,
      });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player1',
              actionsRemaining: 1,
              spellSlotUsage: [],
              focusPointsUsed: 0,
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('(cantrip)')]),
        }),
      });
    });
  });

  describe('Resource consumption - Leveled spell', () => {
    it('should consume spell slot for leveled spell', async () => {
      const wizardCaster = createWizardCaster();
      const actorChar = createPF2Character({
        id: 'char1',
        name: 'Wizard',
        spellcasters: [wizardCaster],
        abilities: { strength: 10, dexterity: 14, constitution: 12, intelligence: 18, wisdom: 10, charisma: 10 },
        derived: {
          hitPoints: 20,
          armorClass: 15,
          speed: 25,
          fortitudeSave: 3,
          reflexSave: 5,
          willSave: 4,
          perception: 2,
        },
      });
      const actorCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        spellSlotUsage: [],
      });
      const player = createPlayer({ id: 'player1' });
      const match = createMatch({
        combatants: [actorCombatant],
        characters: [actorChar],
      });

      mockGetCombatantByPlayerId.mockReturnValue(actorCombatant);
      mockGetCharacterById.mockImplementation((_match, charId) => {
        if (charId === 'char1') return actorChar;
        return undefined;
      });
      mockCanCastSpell.mockReturnValue({ success: true, spellLevel: 1 });
      mockCalculateSpellAttack.mockReturnValue(7);
      mockCalculateSpellDC.mockReturnValue(17);
      mockGetSpell.mockReturnValue({
        name: 'Magic Missile',
        level: 1,
        tradition: 'arcane',
        castActions: 2,
        targetType: 'single',
        damageFormula: '1d4+1',
        damageType: 'force',
      });

      await handlePF2CastSpell(socket, matchId, match, player, actorCombatant, {
        type: 'pf2_cast_spell',
        casterIndex: 0,
        spellName: 'Magic Missile',
        spellLevel: 1,
      });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player1',
              spellSlotUsage: [{ casterIndex: 0, level: 1, used: 1 }],
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('(level 1)')]),
        }),
      });
    });
  });

  describe('Resource consumption - Focus spell', () => {
    it('should consume focus point for focus spell', async () => {
      const wizardCaster = createWizardCaster();
      const actorChar = createPF2Character({
        id: 'char1',
        name: 'Wizard',
        spellcasters: [wizardCaster],
        abilities: { strength: 10, dexterity: 14, constitution: 12, intelligence: 18, wisdom: 10, charisma: 10 },
        derived: {
          hitPoints: 20,
          armorClass: 15,
          speed: 25,
          fortitudeSave: 3,
          reflexSave: 5,
          willSave: 4,
          perception: 2,
        },
      });
      const actorCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
        focusPointsUsed: 0,
      });
      const player = createPlayer({ id: 'player1' });
      const match = createMatch({
        combatants: [actorCombatant],
        characters: [actorChar],
      });

      mockGetCombatantByPlayerId.mockReturnValue(actorCombatant);
      mockGetCharacterById.mockImplementation((_match, charId) => {
        if (charId === 'char1') return actorChar;
        return undefined;
      });
      mockCanCastSpell.mockReturnValue({ success: true, isFocus: true, spellLevel: 1 });
      mockCalculateSpellAttack.mockReturnValue(7);
      mockCalculateSpellDC.mockReturnValue(17);
      mockGetSpell.mockReturnValue({
        name: 'Force Bolt',
        level: 1,
        tradition: 'arcane',
        castActions: 2,
        targetType: 'single',
        damageFormula: '1d4+1',
        damageType: 'force',
      });

      await handlePF2CastSpell(socket, matchId, match, player, actorCombatant, {
        type: 'pf2_cast_spell',
        casterIndex: 0,
        spellName: 'Force Bolt',
        spellLevel: 1,
      });

      expect(mockSendToMatch).toHaveBeenCalledWith(matchId, {
        type: 'match_state',
        state: expect.objectContaining({
          combatants: expect.arrayContaining([
            expect.objectContaining({
              playerId: 'player1',
              focusPointsUsed: 1,
            }),
          ]),
          log: expect.arrayContaining([expect.stringContaining('(focus)')]),
        }),
      });
    });
  });

  describe('Error: not enough actions', () => {
    it('should return error when actions < 2', async () => {
      const wizardCaster = createWizardCaster();
      const actorChar = createPF2Character({ 
        id: 'char1',
        spellcasters: [wizardCaster],
      });
      const actorCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 1,
      });
      const player = createPlayer({ id: 'player1' });
      const match = createMatch({ combatants: [actorCombatant], characters: [actorChar] });

      mockGetCombatantByPlayerId.mockReturnValue(actorCombatant);
      mockGetCharacterById.mockReturnValue(actorChar);

      await handlePF2CastSpell(socket, matchId, match, player, actorCombatant, {
        type: 'pf2_cast_spell',
        casterIndex: 0,
        spellName: 'Magic Missile',
        spellLevel: 1,
      });

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'Casting a spell requires 2 actions.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });
  });

  describe('Error: no spell slots', () => {
    it('should return error when canCastSpell fails', async () => {
      const wizardCaster = createWizardCaster();
      const actorChar = createPF2Character({
        id: 'char1',
        name: 'Wizard',
        spellcasters: [wizardCaster],
      });
      const actorCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
      });
      const player = createPlayer({ id: 'player1' });
      const match = createMatch({ combatants: [actorCombatant], characters: [actorChar] });

      mockGetCombatantByPlayerId.mockReturnValue(actorCombatant);
      mockGetCharacterById.mockReturnValue(actorChar);
      mockCanCastSpell.mockReturnValue({ success: false, error: 'No spell slots remaining.' });

      await handlePF2CastSpell(socket, matchId, match, player, actorCombatant, {
        type: 'pf2_cast_spell',
        casterIndex: 0,
        spellName: 'Magic Missile',
        spellLevel: 1,
      });

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'No spell slots remaining.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });
  });

  describe('Error: spell not found', () => {
    it('should return error when spell not in database', async () => {
      const wizardCaster = createWizardCaster();
      const actorChar = createPF2Character({
        id: 'char1',
        name: 'Wizard',
        spellcasters: [wizardCaster],
      });
      const actorCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
      });
      const player = createPlayer({ id: 'player1' });
      const match = createMatch({ combatants: [actorCombatant], characters: [actorChar] });

      mockGetCombatantByPlayerId.mockReturnValue(actorCombatant);
      mockGetCharacterById.mockReturnValue(actorChar);
      mockCanCastSpell.mockReturnValue({ success: true, spellLevel: 1 });
      mockCalculateSpellAttack.mockReturnValue(7);
      mockCalculateSpellDC.mockReturnValue(17);
      mockGetSpell.mockReturnValue(null);

      await handlePF2CastSpell(socket, matchId, match, player, actorCombatant, {
        type: 'pf2_cast_spell',
        casterIndex: 0,
        spellName: 'Nonexistent Spell',
        spellLevel: 1,
      });

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'Spell "Nonexistent Spell" not found in database.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });
  });

  describe('Error: no spellcaster', () => {
    it('should return error when no spellcaster at index', async () => {
      const actorChar = createPF2Character({
        id: 'char1',
        name: 'Fighter',
        spellcasters: [],
      });
      const actorCombatant = createPF2Combatant({
        playerId: 'player1',
        characterId: 'char1',
        actionsRemaining: 3,
      });
      const player = createPlayer({ id: 'player1' });
      const match = createMatch({ combatants: [actorCombatant], characters: [actorChar] });

      mockGetCombatantByPlayerId.mockReturnValue(actorCombatant);
      mockGetCharacterById.mockReturnValue(actorChar);

      await handlePF2CastSpell(socket, matchId, match, player, actorCombatant, {
        type: 'pf2_cast_spell',
        casterIndex: 0,
        spellName: 'Magic Missile',
        spellLevel: 1,
      });

      expect(mockSendMessage).toHaveBeenCalledWith(socket, {
        type: 'error',
        message: 'No spellcaster at that index.',
      });
      expect(mockUpdateMatchState).not.toHaveBeenCalled();
    });
  });
});
