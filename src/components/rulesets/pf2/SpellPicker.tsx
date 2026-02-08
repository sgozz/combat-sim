import { useState } from 'react';
import type { SpellCaster } from '../../../../shared/rulesets/pf2/types';
import { SPELL_DATABASE, getHeightenedDamage } from '../../../../shared/rulesets/pf2/spellData';

interface SpellPickerProps {
  spellcaster: SpellCaster;
  onSelectSpell: (spellName: string, castLevel: number) => void;
  onClose: () => void;
  actionsRemaining: number;
}

export const SpellPicker = ({ spellcaster, onSelectSpell, onClose, actionsRemaining }: SpellPickerProps) => {
  const [selectedSpell, setSelectedSpell] = useState<string | null>(null);

  // Group spells by level
  const spellsByLevel = spellcaster.knownSpells.reduce((acc, group) => {
    acc[group.level] = group.spells;
    return acc;
  }, {} as Record<number, string[]>);

  // Get available slots for each level
  const getAvailableSlots = (level: number) => {
    const slot = spellcaster.slots.find(s => s.level === level);
    if (!slot) return { available: 0, total: 0 };
    return { available: slot.total - slot.used, total: slot.total };
  };

  // Check if spell can be cast
  const canCastSpell = (spellName: string, level: number) => {
    const spell = SPELL_DATABASE[spellName];
    if (!spell) return false;

    const slots = getAvailableSlots(level);
    if (slots.available <= 0) return false;

    if (spell.castActions > actionsRemaining) return false;

    return true;
  };

  // Get heighten options for a spell
  const getHeightenOptions = (spellName: string) => {
    const spell = SPELL_DATABASE[spellName];
    if (!spell || !spell.heighten) return [];

    const baseLevel = spell.level;
    const options: number[] = [];

    // Add all levels from base to max available
    for (let level = baseLevel; level <= 9; level++) {
      const slots = getAvailableSlots(level);
      if (slots.available > 0) {
        options.push(level);
      }
    }

    return options;
  };

  const handleSpellClick = (spellName: string, baseLevel: number) => {
    const spell = SPELL_DATABASE[spellName];
    if (!spell) return;

    if (spell.heighten) {
      // Show heighten options
      setSelectedSpell(spellName);
    } else {
      // Cast at base level
      onSelectSpell(spellName, baseLevel);
      onClose();
    }
  };

  const handleHeightenSelect = (spellName: string, castLevel: number) => {
    onSelectSpell(spellName, castLevel);
    onClose();
  };

  return (
    <div className="pf2-spell-picker-mobile">
      <div className="pf2-spell-picker-header">
        <div className="pf2-spell-picker-title">{spellcaster.name} - {spellcaster.tradition}</div>
        <button 
          onClick={onClose}
          className="pf2-spell-picker-close"
        >
          ✕
        </button>
      </div>

      {selectedSpell ? (
        // Heighten options view
        <div>
          <button
            onClick={() => setSelectedSpell(null)}
            className="pf2-spell-heighten-back"
          >
            ← Back to spell list
          </button>
          <div className="pf2-spell-heighten-title">
            Cast {selectedSpell} at level:
          </div>
          {getHeightenOptions(selectedSpell).map(level => {
            const spell = SPELL_DATABASE[selectedSpell];
            const heightenedDamage = spell ? getHeightenedDamage(spell, level) : '';
            const slots = getAvailableSlots(level);
            
            return (
              <button
                key={level}
                className="pf2-spell-btn"
                onClick={() => handleHeightenSelect(selectedSpell, level)}
                disabled={!canCastSpell(selectedSpell, level)}
              >
                <span className="pf2-spell-actions">✨</span>
                <span className="pf2-spell-name">
                  Level {level} ({slots.available}/{slots.total} slots)
                  {heightenedDamage && <div style={{ fontSize: '0.8em', opacity: 0.8 }}>{heightenedDamage}</div>}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        // Spell list view
        <>
          {Object.entries(spellsByLevel)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([levelStr, spells]) => {
              const level = Number(levelStr);
              const slots = getAvailableSlots(level);
              const levelLabel = level === 0 ? 'Cantrips (∞)' : `Level ${level} (${slots.available}/${slots.total})`;

              return (
                <div key={level}>
                  <div className="pf2-spell-level-header">
                    {levelLabel}
                  </div>
                  {spells.map(spellName => {
                    const spell = SPELL_DATABASE[spellName];
                    const canCast = canCastSpell(spellName, level);
                    
                    return (
                      <button
                        key={spellName}
                        className="pf2-spell-btn"
                        onClick={() => handleSpellClick(spellName, level)}
                        disabled={!canCast}
                      >
                        <span className="pf2-spell-actions">
                          {spell?.castActions === 1 ? '⚡' : spell?.castActions === 2 ? '⚡⚡' : '⚡⚡⚡'}
                        </span>
                        <span className="pf2-spell-name">
                          {spellName}
                          {spell?.heighten && <span className="pf2-spell-heighten">↑</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
        </>
      )}
    </div>
  );
};
