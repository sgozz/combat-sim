import { Fragment, createElement } from 'react';
import type { ReactNode } from 'react';
import type { MatchState, Player, CombatActionPayload, ManeuverType, RulesetId, HitLocation } from '../../../../shared/types';
import type { DefenseChoice, PendingDefense, CharacterSheet, CombatantState } from '../../../../shared/types';
import HitLocationPicker from '../../ui/HitLocationPicker';

export type AttackUiOptions = {
  hitLocation: HitLocation;
  setHitLocation: (loc: HitLocation) => void;
  deceptiveLevel: 0 | 1 | 2;
  setDeceptiveLevel: (level: 0 | 1 | 2) => void;
  rapidStrike: boolean;
  setRapidStrike: (value: boolean) => void;
};

export type RulesetUiSlotContext = {
  matchState: MatchState | null;
  player: Player | null;
  selectedTargetId: string | null;
  currentManeuver: ManeuverType | null;
  isMyTurn: boolean;
  onAction: (action: string, payload?: CombatActionPayload) => void;
  attackOptions?: AttackUiOptions;
};

export type RulesetDefenseSlotContext = {
  pendingDefense: PendingDefense;
  character: CharacterSheet;
  combatant: CombatantState;
  attackerName: string;
  inCloseCombat: boolean;
  onDefend: (choice: DefenseChoice) => void;
};

export type RulesetUiSlots = {
  renderStatusPanel?: (ctx: RulesetUiSlotContext) => ReactNode;
  renderActionPanelHeader?: (ctx: RulesetUiSlotContext) => ReactNode;
  renderActionConfiguration?: (ctx: RulesetUiSlotContext) => ReactNode;
  renderDefenseOptions?: (ctx: RulesetDefenseSlotContext) => ReactNode;
};

const GurpsActionConfiguration = ({
  selectedTargetId,
  currentManeuver,
  attackOptions,
}: Pick<RulesetUiSlotContext, 'selectedTargetId' | 'currentManeuver' | 'attackOptions'>) => {
  if (!attackOptions) return null;
  const {
    hitLocation,
    setHitLocation,
    deceptiveLevel,
    setDeceptiveLevel,
    rapidStrike,
    setRapidStrike,
  } = attackOptions;

  return createElement(
    Fragment,
    null,
    createElement(
      'div',
      { className: 'hit-location-section' },
      createElement(HitLocationPicker, {
        selectedLocation: hitLocation,
        onSelect: setHitLocation,
        disabled: !selectedTargetId,
      })
    ),
    selectedTargetId
      ? createElement(
          'div',
          { className: 'deceptive-attack-section' },
          createElement('label', { className: 'deceptive-label' }, 'Deceptive Attack:'),
          createElement(
            'div',
            { className: 'deceptive-buttons' },
            createElement(
              'button',
              {
                className: `deceptive-btn ${deceptiveLevel === 0 ? 'active' : ''}`,
                onClick: () => setDeceptiveLevel(0),
              },
              'None'
            ),
            createElement(
              'button',
              {
                className: `deceptive-btn ${deceptiveLevel === 1 ? 'active' : ''}`,
                onClick: () => setDeceptiveLevel(1),
              },
              '-2 hit / -1 def'
            ),
            createElement(
              'button',
              {
                className: `deceptive-btn ${deceptiveLevel === 2 ? 'active' : ''}`,
                onClick: () => setDeceptiveLevel(2),
              },
              '-4 hit / -2 def'
            )
          )
        )
      : null,
    currentManeuver === 'attack' && selectedTargetId
      ? createElement(
          'div',
          { className: 'rapid-strike-section' },
          createElement(
            'label',
            { className: 'rapid-strike-label' },
            createElement('input', {
              type: 'checkbox',
              checked: rapidStrike,
              onChange: (event) => setRapidStrike(event.target.checked),
            }),
            'Rapid Strike (-6 for two attacks)'
          )
        )
      : null
  );
};

const rulesetUiSlots: Record<RulesetId, RulesetUiSlots> = {
  gurps: {
    renderActionConfiguration: (ctx) =>
      createElement(GurpsActionConfiguration, {
        selectedTargetId: ctx.selectedTargetId,
        currentManeuver: ctx.currentManeuver,
        attackOptions: ctx.attackOptions,
      }),
  },
  pf2: {},
};

export const getRulesetUiSlots = (rulesetId?: RulesetId): RulesetUiSlots => {
  return rulesetUiSlots[rulesetId ?? 'gurps'] ?? rulesetUiSlots.gurps;
};
