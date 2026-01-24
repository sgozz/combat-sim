import type { RulesetUIAdapter, RulesetManeuver, ManeuverInstruction } from '../Ruleset';
import type { ManeuverType } from '../../types';

const PF2_ACTIONS: RulesetManeuver[] = [
  { type: 'move', label: 'Stride', shortLabel: 'Stride', icon: '🏃', desc: 'Move up to your Speed.', key: '1' },
  { type: 'attack', label: 'Strike', shortLabel: 'Strike', icon: '⚔️', desc: 'Attack with a weapon or unarmed.', key: '2' },
  { type: 'ready', label: 'Interact', shortLabel: 'Interact', icon: '✋', desc: 'Grab, draw, or manipulate an object.', key: '3' },
  { type: 'all_out_defense', label: 'Raise Shield', shortLabel: 'Shield', icon: '🛡️', desc: '+2 AC until next turn.', key: '4' },
  { type: 'aim', label: 'Take Cover', shortLabel: 'Cover', icon: '🪨', desc: 'Gain cover bonus to AC.', key: '5' },
  { type: 'change_posture', label: 'Stand/Drop', shortLabel: 'Posture', icon: '🧎', desc: 'Stand up or drop prone.', key: '6' },
  { type: 'evaluate', label: 'Seek', shortLabel: 'Seek', icon: '👁️', desc: 'Search for hidden creatures.', key: '7' },
  { type: 'wait', label: 'Ready', shortLabel: 'Ready', icon: '⏳', desc: 'Prepare action with trigger.', key: '8' },
  { type: 'do_nothing', label: 'Delay', shortLabel: 'Delay', icon: '⏸️', desc: 'Wait to act later in round.', key: '9' },
];

const PF2_SKILL_ACTIONS: RulesetManeuver[] = [
  { type: 'move_and_attack', label: 'Tumble Through', shortLabel: 'Tumble', icon: '🤸', desc: 'Move through enemy space.', key: '-' },
];

const CLOSE_COMBAT_ACTIONS: ManeuverType[] = ['attack', 'all_out_attack'];

const getManeuverInstructions = (maneuver: ManeuverType | null): ManeuverInstruction | null => {
  switch (maneuver) {
    case 'move':
      return { text: 'Click a hex to Stride. Costs 1 action.', canAttack: false, canMove: true, isStep: false };
    case 'attack':
      return { text: 'Click enemy to Strike. MAP applies after first attack.', canAttack: true, canMove: false, isStep: false };
    case 'all_out_defense':
      return { text: 'Shield raised. +2 AC until your next turn.', canAttack: false, canMove: false, isStep: false };
    case 'aim':
      return { text: 'Taking cover. Gain cover bonus.', canAttack: false, canMove: false, isStep: false };
    case 'evaluate':
      return { text: 'Seeking hidden creatures.', canAttack: false, canMove: false, isStep: false, canEvaluate: true };
    case 'ready':
      return { text: 'Set a trigger for your readied action.', canAttack: false, canMove: false, isStep: false, canReady: true };
    case 'wait':
      return { text: 'Delaying. Choose when to act.', canAttack: false, canMove: false, isStep: false };
    case 'change_posture':
      return { text: 'Stand up (1 action) or Drop prone (free).', canAttack: false, canMove: false, isStep: false };
    case 'do_nothing':
      return { text: 'Delaying your turn.', canAttack: false, canMove: false, isStep: false };
    default:
      return { text: 'Select an action.', canAttack: false, canMove: false, isStep: false };
  }
};

export const pf2UiAdapter: RulesetUIAdapter = {
  getActionLayout: () => [],
  getActionLabels: () => ({}),
  getActionTooltips: () => ({}),
  getManeuvers: () => [...PF2_ACTIONS, ...PF2_SKILL_ACTIONS],
  getCloseCombatManeuvers: () => [...CLOSE_COMBAT_ACTIONS],
  getAoaVariants: () => [],
  getAodVariants: () => [],
  getManeuverInstructions,
};
