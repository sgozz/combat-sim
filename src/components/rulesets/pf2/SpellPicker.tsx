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

  // Check if spell can be cast (supports both known and unknown spells)
  const canCastSpell = (spellName: string, level: number) => {
    // Cantrips (level 0) don't consume slots
    if (level > 0) {
      const slots = getAvailableSlots(level);
      if (slots.available <= 0) return false;
    }

    const spell = SPELL_DATABASE[spellName];
    const castActions = spell?.castActions ?? 2; // Default 2 actions for unknown spells
    if (castActions > actionsRemaining) return false;

    return true;
  };

  const isKnownSpell = (spellName: string) => !!SPELL_DATABASE[spellName];

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
    
    if (!spell) {
      // Unknown spell — cast generically at shown level
      onSelectSpell(spellName, baseLevel);
      onClose();
      return;
    }

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
    <div className="modal-overlay spell-modal-overlay" onClick={onClose}>
      <div className="modal spell-modal" onClick={e => e.stopPropagation()}>
        <div className="spell-modal-header">
          <div className="spell-modal-title">{spellcaster.name} - {spellcaster.tradition}</div>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <div className="spell-modal-body">
          {selectedSpell ? (
            <div>
              <button
                onClick={() => setSelectedSpell(null)}
                className="spell-heighten-back"
              >
                ← Back to spell list
              </button>
              <div className="spell-heighten-title">
                Cast {selectedSpell} at level:
              </div>
              {getHeightenOptions(selectedSpell).map(level => {
                const spell = SPELL_DATABASE[selectedSpell];
                const heightenedDamage = spell ? getHeightenedDamage(spell, level) : '';
                const slots = getAvailableSlots(level);
                
                return (
                  <button
                    key={level}
                    className="spell-btn"
                    onClick={() => handleHeightenSelect(selectedSpell, level)}
                    disabled={!canCastSpell(selectedSpell, level)}
                  >
                    <span className="spell-btn-actions">✨</span>
                    <span className="spell-btn-name">
                      Level {level} ({slots.available}/{slots.total} slots)
                      {heightenedDamage && <div style={{ fontSize: '0.8em', opacity: 0.8 }}>{heightenedDamage}</div>}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {Object.entries(spellsByLevel)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([levelStr, spells]) => {
                  const level = Number(levelStr);
                  const slots = getAvailableSlots(level);
                  const levelLabel = level === 0 ? 'Cantrips (∞)' : `Level ${level} (${slots.available}/${slots.total})`;

                  return (
                    <div key={level}>
                      <div className="spell-level-header">
                        {levelLabel}
                      </div>
                      {spells.map(spellName => {
                        const spell = SPELL_DATABASE[spellName];
                        const known = isKnownSpell(spellName);
                        const canCast = canCastSpell(spellName, level);
                        
                        return (
                          <button
                            key={spellName}
                            className={`spell-btn${!known ? ' spell-btn-manual' : ''}`}
                            onClick={() => handleSpellClick(spellName, level)}
                            disabled={!canCast}
                          >
                            <span className="spell-btn-actions">
                              {spell?.castActions === 1 ? '⚡' : spell?.castActions === 2 ? '⚡⚡' : '⚡⚡⚡'}
                            </span>
                            <span className="spell-btn-name">
                              {spellName}
                              {spell?.heighten && <span className="spell-btn-heighten">↑</span>}
                              {!known && <span className="spell-btn-manual-label">manual</span>}
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
      </div>
    </div>
  );
};
