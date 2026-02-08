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
    <div className="action-bar-maneuvers" style={{ 
      flexDirection: 'column', 
      height: 'auto', 
      maxHeight: '70vh', 
      overflowY: 'auto', 
      alignItems: 'stretch',
      padding: '8px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px',
        padding: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.2)'
      }}>
        <div className="variant-header">{spellcaster.name} - {spellcaster.tradition}</div>
        <button 
          onClick={onClose}
          style={{ 
            background: 'rgba(255,255,255,0.1)', 
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '4px',
            padding: '4px 12px',
            cursor: 'pointer',
            color: 'white'
          }}
        >
          ✕
        </button>
      </div>

      {selectedSpell ? (
        // Heighten options view
        <div>
          <button
            onClick={() => setSelectedSpell(null)}
            style={{
              width: '100%',
              marginBottom: '8px',
              padding: '8px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              cursor: 'pointer',
              color: 'white'
            }}
          >
            ← Back to spell list
          </button>
          <div className="variant-header" style={{ marginBottom: '8px' }}>
            Cast {selectedSpell} at level:
          </div>
          {getHeightenOptions(selectedSpell).map(level => {
            const spell = SPELL_DATABASE[selectedSpell];
            const heightenedDamage = spell ? getHeightenedDamage(spell, level) : '';
            const slots = getAvailableSlots(level);
            
            return (
              <button
                key={level}
                className="action-bar-maneuver-btn"
                onClick={() => handleHeightenSelect(selectedSpell, level)}
                disabled={!canCastSpell(selectedSpell, level)}
                style={{
                  opacity: canCastSpell(selectedSpell, level) ? 1 : 0.5,
                  cursor: canCastSpell(selectedSpell, level) ? 'pointer' : 'not-allowed',
                  marginBottom: '4px',
                  minHeight: '44px'
                }}
              >
                <span className="action-bar-icon">✨</span>
                <span className="action-bar-label">
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
                <div key={level} style={{ marginBottom: '12px' }}>
                  <div className="variant-header" style={{ marginBottom: '4px' }}>
                    {levelLabel}
                  </div>
                  {spells.map(spellName => {
                    const spell = SPELL_DATABASE[spellName];
                    const known = isKnownSpell(spellName);
                    const canCast = canCastSpell(spellName, level);
                    
                    return (
                      <button
                        key={spellName}
                        className="action-bar-maneuver-btn"
                        onClick={() => handleSpellClick(spellName, level)}
                        disabled={!canCast}
                        style={{
                          opacity: canCast ? (known ? 1 : 0.85) : 0.5,
                          cursor: canCast ? 'pointer' : 'not-allowed',
                          marginBottom: '4px',
                          minHeight: '44px',
                          borderLeft: known ? undefined : '3px solid rgba(255, 165, 0, 0.5)',
                        }}
                      >
                        <span className="action-bar-icon">
                          {spell?.castActions === 1 ? '⚡' : '⚡⚡'}
                        </span>
                        <span className="action-bar-label">
                          {spellName}
                          {spell?.heighten && <span style={{ marginLeft: '4px', fontSize: '0.8em' }}>↑</span>}
                          {!known && <span style={{ marginLeft: '4px', fontSize: '0.75em', color: 'orange' }}>manual</span>}
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
