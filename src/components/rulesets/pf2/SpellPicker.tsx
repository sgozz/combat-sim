import { useState, useMemo } from 'react';
import type { SpellCaster } from '../../../../shared/rulesets/pf2/types';
import { SPELL_DATABASE, getHeightenedDamage } from '../../../../shared/rulesets/pf2/spellData';

interface SpellPickerProps {
  spellcaster: SpellCaster;
  onSelectSpell: (spellName: string, castLevel: number) => void;
  onClose: () => void;
  actionsRemaining: number;
}

export const SpellPicker = ({ spellcaster, onSelectSpell, onClose, actionsRemaining }: SpellPickerProps) => {
  const levels = useMemo(() =>
    spellcaster.knownSpells
      .map(g => g.level)
      .sort((a, b) => a - b),
    [spellcaster.knownSpells]
  );

  const [activeLevel, setActiveLevel] = useState<number>(levels[0] ?? 0);
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);

  // Group spells by level
  const spellsByLevel = useMemo(() =>
    spellcaster.knownSpells.reduce((acc, group) => {
      acc[group.level] = group.spells;
      return acc;
    }, {} as Record<number, string[]>),
    [spellcaster.knownSpells]
  );

  // Get available slots for each level
  const getAvailableSlots = (level: number) => {
    const slot = spellcaster.slots.find(s => s.level === level);
    if (!slot) return { available: 0, total: 0 };
    return { available: slot.total - slot.used, total: slot.total };
  };

  // Check if spell can be cast
  const canCastSpell = (spellName: string, level: number) => {
    if (level > 0) {
      const slots = getAvailableSlots(level);
      if (slots.available <= 0) return false;
    }
    const spell = SPELL_DATABASE[spellName];
    const castActions = spell?.castActions ?? 2;
    if (typeof castActions === 'number' && castActions > actionsRemaining) return false;
    return true;
  };

  const isKnownSpell = (spellName: string) => !!SPELL_DATABASE[spellName];

  // Get heighten options for a spell
  const getHeightenOptions = (spellName: string) => {
    const spell = SPELL_DATABASE[spellName];
    if (!spell || !spell.heighten) return [];

    const baseLevel = spell.level;
    const options: number[] = [];
    for (let level = baseLevel; level <= 9; level++) {
      const slots = getAvailableSlots(level);
      if (level === 0 || slots.available > 0) {
        options.push(level);
      }
    }
    return options;
  };

  const handleSpellClick = (spellName: string, baseLevel: number) => {
    const spell = SPELL_DATABASE[spellName];

    if (!spell) {
      onSelectSpell(spellName, baseLevel);
      onClose();
      return;
    }

    if (spell.heighten) {
      setExpandedSpell(prev => prev === spellName ? null : spellName);
    } else {
      onSelectSpell(spellName, baseLevel);
      onClose();
    }
  };

  const handleHeightenSelect = (spellName: string, castLevel: number) => {
    onSelectSpell(spellName, castLevel);
    onClose();
  };

  const activeSpells = spellsByLevel[activeLevel] ?? [];

  const getTabLabel = (level: number) => {
    if (level === 0) return 'Cantrips (∞)';
    const slots = getAvailableSlots(level);
    return `Level ${level} (${slots.available}/${slots.total})`;
  };

  const isTabDepleted = (level: number) => {
    if (level === 0) return false;
    const slots = getAvailableSlots(level);
    return slots.available <= 0;
  };

  return (
    <div className="modal-overlay spell-modal-overlay" onClick={onClose}>
      <div className="modal spell-modal" onClick={e => e.stopPropagation()}>
        <div className="spell-modal-header">
          <div className="spell-modal-title">{spellcaster.name} - {spellcaster.tradition}</div>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <div className="spell-modal-tabs" role="tablist">
          {levels.map(level => (
            <button
              key={level}
              role="tab"
              aria-selected={activeLevel === level}
              className={`spell-modal-tab${activeLevel === level ? ' active' : ''}${isTabDepleted(level) ? ' depleted' : ''}`}
              onClick={() => {
                setActiveLevel(level);
                setExpandedSpell(null);
              }}
            >
              {getTabLabel(level)}
            </button>
          ))}
        </div>

        <div className="spell-modal-body" role="tabpanel">
          {activeSpells.map(spellName => {
            const spell = SPELL_DATABASE[spellName];
            const known = isKnownSpell(spellName);
            const canCast = canCastSpell(spellName, activeLevel);
            const isExpanded = expandedSpell === spellName;
            const heightenOptions = spell?.heighten ? getHeightenOptions(spellName) : [];

            return (
              <div key={spellName} className={`spell-item${isExpanded ? ' expanded' : ''}`}>
                <button
                  className={`spell-btn${!known ? ' spell-btn-manual' : ''}${isExpanded ? ' spell-btn-active' : ''}`}
                  onClick={() => handleSpellClick(spellName, activeLevel)}
                  disabled={!canCast}
                >
                  <span className="spell-btn-actions">
                    {spell?.castActions === 'free' ? '🆓' : spell?.castActions === 'reaction' ? '↩️' : spell?.castActions === 1 ? '⚡' : spell?.castActions === 2 ? '⚡⚡' : '⚡⚡⚡'}
                  </span>
                  <span className="spell-btn-name">
                    {spellName}
                    {spell?.heighten && <span className="spell-btn-heighten">↑</span>}
                    {!known && <span className="spell-btn-manual-label">manual</span>}
                  </span>
                </button>

                {isExpanded && heightenOptions.length > 0 && (
                  <div className="spell-heighten-inline">
                    <div className="spell-heighten-label">Cast {spellName} at level:</div>
                    <div className="spell-heighten-options">
                      {heightenOptions.map(level => {
                        const heightenedDamage = spell ? getHeightenedDamage(spell, level) : '';
                        const slots = getAvailableSlots(level);
                        return (
                          <button
                            key={level}
                            className="spell-heighten-btn"
                            onClick={() => handleHeightenSelect(spellName, level)}
                            disabled={!canCastSpell(spellName, level)}
                          >
                            <span className="spell-heighten-level">Lv {level}</span>
                            {level > 0 && <span className="spell-heighten-slots">{slots.available}/{slots.total}</span>}
                            {heightenedDamage && <span className="spell-heighten-damage">{heightenedDamage}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
