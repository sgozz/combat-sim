import type { RulesetUIAdapter } from '../Ruleset';
import { TEMPLATE_NAMES } from './templateNames';

const MANEUVERS = [
  { type: 'move', label: 'Move', shortLabel: 'Move', icon: '🏃', desc: 'Full move. No attack. Active defense allowed.', key: '1' },
  { type: 'attack', label: 'Attack', shortLabel: 'Attack', icon: '⚔️', desc: 'Standard attack. Step allowed. Active defense allowed.', key: '2' },
  { type: 'all_out_attack', label: 'All-Out Attack', shortLabel: 'All-Out', icon: '😡', desc: 'Bonus to hit or damage. Half move. NO DEFENSE.', key: '3' },
  { type: 'all_out_defense', label: 'All-Out Defense', shortLabel: 'Defend', icon: '🛡️', desc: 'Bonus to defense (+2). Step allowed. No attack.', key: '4' },
  { type: 'move_and_attack', label: 'Move & Attack', shortLabel: 'M&A', icon: '🤸', desc: 'Full move and attack. -4 skill (max 9). No Parry/Block.', key: '5' },
  { type: 'aim', label: 'Aim', shortLabel: 'Aim', icon: '🎯', desc: 'Accumulate Accuracy bonus. Step allowed.', key: '6' },
  { type: 'evaluate', label: 'Evaluate', shortLabel: 'Eval', icon: '🔍', desc: 'Study target. +1 to hit (max +3). Step allowed.', key: '7' },
  { type: 'concentrate', label: 'Concentrate', shortLabel: 'Conc', icon: '🧠', desc: 'Focus on task. Step allowed. No attack.', key: '8' },
  { type: 'wait', label: 'Wait', shortLabel: 'Wait', icon: '⏳', desc: 'Prepare to react when triggered.', key: '9' },
  { type: 'ready', label: 'Ready', shortLabel: 'Ready', icon: '🗡️', desc: 'Draw, sheathe, or prepare a weapon. Step allowed.', key: '*' },
  { type: 'change_posture', label: 'Change Posture', shortLabel: 'Posture', icon: '🧎', desc: 'Rise from kneeling/prone. Use for non-free posture changes.', key: '-' },
  { type: 'do_nothing', label: 'Do Nothing', shortLabel: 'Nothing', icon: '💤', desc: 'Recover from stun or wait. No move.', key: '0' },
] as const;

const AOA_VARIANTS = [
  { variant: 'determined', label: 'Determined', desc: '+4 to hit' },
  { variant: 'strong', label: 'Strong', desc: '+2 damage' },
  { variant: 'double', label: 'Double', desc: 'Two attacks at full skill' },
  { variant: 'feint', label: 'Feint', desc: 'Quick Contest: margin reduces defense' },
] as const;

const AOD_VARIANTS = [
  { variant: 'increased_dodge', label: 'Increased Dodge', desc: '+2 to Dodge' },
  { variant: 'increased_parry', label: 'Increased Parry', desc: '+2 to Parry' },
  { variant: 'increased_block', label: 'Increased Block', desc: '+2 to Block' },
  { variant: 'double', label: 'Double Defense', desc: 'Two different defenses vs same attack' },
] as const;

const CLOSE_COMBAT_MANEUVERS: string[] = ['attack', 'all_out_attack', 'all_out_defense'];

const getManeuverInstructions = (maneuver: string | null) => {
  switch (maneuver) {
    case 'move':
      return { text: 'Click a hex to move. Full movement allowed.', canAttack: false, canMove: true, isStep: false };
    case 'attack':
      return { text: 'Click enemy to attack. You can step 1 hex first.', canAttack: true, canMove: true, isStep: true };
    case 'all_out_attack':
      return { text: 'Click enemy to attack (+4 to hit). NO DEFENSE this turn!', canAttack: true, canMove: false, isStep: false };
    case 'all_out_defense':
      return { text: 'Defending. +2 to all defenses. Click End Turn.', canAttack: false, canMove: false, isStep: false };
    case 'move_and_attack':
      return { text: 'Move then attack (-4 to hit, max skill 9).', canAttack: true, canMove: true, isStep: false };
    case 'aim':
      return { text: 'Aiming. You gain +Acc bonus next turn.', canAttack: false, canMove: false, isStep: false };
    case 'evaluate':
      return { text: 'Click enemy to study. +1 to hit (max +3).', canAttack: false, canMove: false, isStep: false, canEvaluate: true };
    case 'concentrate':
      return { text: 'Focusing on a task. You can step 1 hex.', canAttack: false, canMove: true, isStep: true };
    case 'ready':
      return { text: 'Draw, sheathe, or prepare equipment.', canAttack: false, canMove: false, isStep: true, canReady: true };
    case 'wait':
      return { text: 'Set a trigger condition to interrupt enemy turn.', canAttack: false, canMove: false, isStep: false };
    case 'change_posture':
      return { text: 'Use Posture Controls to change posture.', canAttack: false, canMove: false, isStep: false };
    case 'do_nothing':
      return { text: 'Recover from stun or pass turn.', canAttack: false, canMove: false, isStep: false };
    default:
      return { text: '', canAttack: false, canMove: false, isStep: false };
  }
};

export const gurpsUiAdapter: RulesetUIAdapter = {
  getActionLayout: () => [],
  getActionLabels: () => ({}),
  getActionTooltips: () => ({}),
  getManeuvers: () => [...MANEUVERS],
  getCloseCombatManeuvers: () => [...CLOSE_COMBAT_MANEUVERS],
  getAoaVariants: () => [...AOA_VARIANTS],
  getAodVariants: () => [...AOD_VARIANTS],
  getManeuverInstructions,
  getTemplateNames: () => TEMPLATE_NAMES,
};
