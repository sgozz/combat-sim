import { describe, it, expect } from 'vitest';
import { hasFeat, getFeatEffect, FEAT_EFFECTS } from './feats';
import type { PF2CharacterSheet } from './characterSheet';

const createPF2Character = (overrides: Partial<PF2CharacterSheet> = {}): PF2CharacterSheet => ({
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
  weapons: [],
  armor: null,
  shieldBonus: 0,
  shieldHardness: 0,
  feats: [],
  spells: null,
  spellcasters: [],
  ...overrides,
});

describe('hasFeat', () => {
  it('returns true when character has feat', () => {
    const character = createPF2Character({
      feats: [{ id: '1', name: 'Attack of Opportunity', type: 'class', level: 1 }],
    });
    
    expect(hasFeat(character, 'Attack of Opportunity')).toBe(true);
  });

  it('returns false when character lacks feat', () => {
    const character = createPF2Character({
      feats: [{ id: '1', name: 'Shield Block', type: 'class', level: 1 }],
    });
    
    expect(hasFeat(character, 'Attack of Opportunity')).toBe(false);
  });

  it('returns false when character has no feats', () => {
    const character = createPF2Character({ feats: [] });
    
    expect(hasFeat(character, 'Attack of Opportunity')).toBe(false);
  });

  it('is case-sensitive', () => {
    const character = createPF2Character({
      feats: [{ id: '1', name: 'Attack of Opportunity', type: 'class', level: 1 }],
    });
    
    expect(hasFeat(character, 'attack of opportunity')).toBe(false);
  });

  it('returns true when character has multiple feats including target', () => {
    const character = createPF2Character({
      feats: [
        { id: '1', name: 'Shield Block', type: 'class', level: 1 },
        { id: '2', name: 'Attack of Opportunity', type: 'class', level: 1 },
        { id: '3', name: 'Power Attack', type: 'class', level: 2 },
      ],
    });
    
    expect(hasFeat(character, 'Attack of Opportunity')).toBe(true);
  });
});

describe('getFeatEffect', () => {
  it('returns effect config for Attack of Opportunity', () => {
    const effect = getFeatEffect('Attack of Opportunity');
    
    expect(effect).toBeDefined();
    expect(effect?.type).toBe('reaction');
    expect(effect?.handler).toBe('handleAoO');
  });

  it('returns undefined for unknown feat', () => {
    const effect = getFeatEffect('Nonexistent Feat');
    
    expect(effect).toBeUndefined();
  });

  it('returns effect config for Shield Block', () => {
    const effect = getFeatEffect('Shield Block');
    
    expect(effect).toBeDefined();
    expect(effect?.type).toBe('reaction');
    expect(effect?.handler).toBe('handleShieldBlock');
  });

  it('returns effect config for Power Attack', () => {
    const effect = getFeatEffect('Power Attack');
    
    expect(effect).toBeDefined();
    expect(effect?.type).toBe('action');
    expect(effect?.handler).toBe('handlePowerAttack');
  });
});

describe('FEAT_EFFECTS registry', () => {
  it('contains Attack of Opportunity', () => {
    expect(FEAT_EFFECTS.has('Attack of Opportunity')).toBe(true);
  });

  it('contains Shield Block', () => {
    expect(FEAT_EFFECTS.has('Shield Block')).toBe(true);
  });

  it('contains Power Attack', () => {
    expect(FEAT_EFFECTS.has('Power Attack')).toBe(true);
  });

  it('Attack of Opportunity has correct structure', () => {
    const effect = FEAT_EFFECTS.get('Attack of Opportunity');
    
    expect(effect).toMatchObject({
      type: 'reaction',
      handler: 'handleAoO',
      description: expect.any(String),
    });
  });

  it('all registered feats have required fields', () => {
    FEAT_EFFECTS.forEach((effect, name) => {
      expect(name).toBeTruthy();
      expect(effect.type).toMatch(/^(reaction|action|modifier)$/);
      expect(effect.handler).toBeTruthy();
    });
  });
});
