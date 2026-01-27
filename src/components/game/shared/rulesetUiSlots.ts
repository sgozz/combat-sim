import { Fragment, createElement } from 'react';
import type { ReactNode } from 'react';
import { assertRulesetId } from '../../../../shared/rulesets/defaults';
import type { MatchState, Player, RulesetId, CharacterSheet } from '../../../../shared/types';
import type { CombatActionPayload, ManeuverType, HitLocation, DefenseChoice, PendingDefense } from '../../../../shared/rulesets/gurps/types';
import type { CombatantState } from '../../../../shared/rulesets';
import { isPF2Combatant } from '../../../../shared/rulesets';
import HitLocationPicker from '../../rulesets/gurps/HitLocationPicker';
import DefenseModal from '../../rulesets/gurps/DefenseModal';

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
  DefenseModal?: ((props: { pendingDefense: PendingDefense; character: CharacterSheet; combatant: CombatantState; attackerName: string; inCloseCombat: boolean; onDefend: (choice: DefenseChoice) => void; rulesetId?: RulesetId }) => ReactNode) | null;
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

const PF2ActionPanelHeader = ({
  matchState,
  player,
}: Pick<RulesetUiSlotContext, 'matchState' | 'player'>) => {
  if (!matchState || !player) return null;
  
   const combatant = matchState.combatants.find(c => c.playerId === player.id);
   if (!combatant || !isPF2Combatant(combatant)) return null;
   
   const actionsRemaining = combatant.actionsRemaining;
   const attacksThisTurn = 0;
   const mapPenalty = combatant.mapPenalty;
  
  const actionDots = Array.from({ length: 3 }, (_, i) => 
    createElement('span', {
      key: i,
      className: `pf2-action-dot ${i < actionsRemaining ? 'available' : 'used'}`,
    }, i < actionsRemaining ? '◆' : '◇')
  );
  
  return createElement(
    'div',
    { className: 'pf2-action-header' },
    createElement('div', { className: 'pf2-actions' }, ...actionDots),
    attacksThisTurn > 0 && createElement(
      'div',
      { className: 'pf2-map-indicator' },
      `MAP: ${mapPenalty}`
    )
  );
};

const PF2StatusPanel = ({
  matchState,
  player,
}: Pick<RulesetUiSlotContext, 'matchState' | 'player'>) => {
  if (!matchState || !player) return null;
  
   const combatant = matchState.combatants.find(c => c.playerId === player.id);
   if (!combatant || !isPF2Combatant(combatant)) return null;
   
   const actionsRemaining = combatant.actionsRemaining;
   const attacksThisTurn = 0;
  
  const getMapPenaltyForNextAttack = () => {
    if (attacksThisTurn === 0) return 0;
    if (attacksThisTurn === 1) return -5;
    return -10;
  };
  
  const nextMap = getMapPenaltyForNextAttack();
  
  return createElement(
    'div',
    { className: 'pf2-status-section' },
    createElement('div', { className: 'pf2-actions-display' },
      createElement('span', { className: 'pf2-label' }, 'Actions: '),
      createElement('span', { className: 'pf2-action-icons' },
        ...Array.from({ length: 3 }, (_, i) => 
          createElement('span', {
            key: i,
            className: `pf2-action-icon ${i < actionsRemaining ? 'available' : 'used'}`,
            title: i < actionsRemaining ? 'Available' : 'Used',
          }, i < actionsRemaining ? '●' : '○')
        )
      )
    ),
    attacksThisTurn > 0 && createElement(
      'div',
      { className: 'pf2-map-display' },
      createElement('span', { className: 'pf2-label' }, 'Next Attack: '),
      createElement('span', { 
        className: 'pf2-map-value',
        style: { color: nextMap < -5 ? '#f44' : nextMap < 0 ? '#ff4' : '#4f4' }
      }, nextMap === 0 ? '+0' : `${nextMap}`)
    )
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
    DefenseModal: (props) =>
      createElement(DefenseModal, props),
  },
  pf2: {
    renderActionPanelHeader: (ctx) =>
      createElement(PF2ActionPanelHeader, {
        matchState: ctx.matchState,
        player: ctx.player,
      }),
    renderStatusPanel: (ctx) =>
      createElement(PF2StatusPanel, {
        matchState: ctx.matchState,
        player: ctx.player,
      }),
    DefenseModal: null,
  },
};

export const getRulesetUiSlots = (rulesetId?: RulesetId): RulesetUiSlots => {
  return rulesetUiSlots[assertRulesetId(rulesetId)] ?? rulesetUiSlots.gurps;
};
