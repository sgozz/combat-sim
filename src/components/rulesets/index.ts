import type { RulesetId } from '../../../shared/types'
import type { CharacterEditorProps, GameStatusPanelProps, GameActionPanelProps, ActionBarProps, TutorialStep } from './types'
import { GurpsCharacterEditor, GurpsGameStatusPanel, GurpsGameActionPanel, GurpsActionBar } from './gurps'
import { PF2CharacterEditor, PF2GameStatusPanel, PF2GameActionPanel, PF2ActionBar } from './pf2'

const GURPS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Welcome to Tactical Combat!",
    description: "This simulator lets you experience tactical turn-based combat. You'll control a character on a hex grid, managing movement, attacks, and defenses.",
  },
  {
    title: "Choose Your Maneuver",
    description: "At the start of your turn, you must choose a maneuver (e.g., Move, Attack, All-Out Defense). This determines what you can do during your turn.",
  },
  {
    title: "Movement & Attacks",
    description: "Click on the hex grid to move your character. To attack, select an enemy within range and choose your attack type. Facing and distance matter!",
  },
  {
    title: "Combat Resolution",
    description: "Attacks are resolved by rolling 3d6 against your skill. If you hit, the defender rolls for active defense (Dodge, Parry, or Block). Damage is applied if the defense fails.",
  },
  {
    title: "Victory!",
    description: "The goal is to defeat your opponents by reducing their HP to 0 or below. Watch your fatigue and keep an eye on the initiative tracker!",
  }
]

const PF2_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Welcome to Pathfinder 2e Combat!",
    description: "This simulator uses the Pathfinder 2e rules. You'll control a character on a hex grid using the 3-action economy system.",
  },
  {
    title: "Three Actions Per Turn",
    description: "Each turn you have 3 actions (◆◆◆). Actions include Strike (attack), Stride (move), Raise Shield, Interact, and more. Use them wisely!",
  },
  {
    title: "Strike & Movement",
    description: "Click an enemy to Strike, or click Stride to move. Multiple Strikes in one turn suffer a Multiple Attack Penalty (MAP): -5 on the 2nd, -10 on the 3rd.",
  },
  {
    title: "Combat Resolution",
    description: "Attacks roll d20 + modifiers against the target's AC. Rolling 10+ over AC is a Critical Hit (double damage). Rolling 10+ under is a Critical Miss.",
  },
  {
    title: "Victory!",
    description: "Defeat your opponents by reducing their HP to 0. Keep track of your actions and use positioning to your advantage!",
  }
]

type RulesetComponentRegistry = {
  CharacterEditor: React.ComponentType<CharacterEditorProps>
  GameStatusPanel: React.ComponentType<GameStatusPanelProps>
  GameActionPanel: React.ComponentType<GameActionPanelProps>
  ActionBar: React.ComponentType<ActionBarProps>
  tutorialSteps: TutorialStep[]
}

const rulesetComponents: Record<RulesetId, RulesetComponentRegistry> = {
  gurps: {
    CharacterEditor: GurpsCharacterEditor,
    GameStatusPanel: GurpsGameStatusPanel,
    GameActionPanel: GurpsGameActionPanel,
    ActionBar: GurpsActionBar,
    tutorialSteps: GURPS_TUTORIAL_STEPS,
  },
  pf2: {
    CharacterEditor: PF2CharacterEditor,
    GameStatusPanel: PF2GameStatusPanel,
    GameActionPanel: PF2GameActionPanel,
    ActionBar: PF2ActionBar,
    tutorialSteps: PF2_TUTORIAL_STEPS,
  },
}

export const getRulesetComponents = (rulesetId: RulesetId): RulesetComponentRegistry => {
  return rulesetComponents[rulesetId] ?? rulesetComponents.gurps
}

export { GurpsCharacterEditor, GurpsGameStatusPanel, GurpsGameActionPanel, GurpsActionBar } from './gurps'
export { PF2CharacterEditor, PF2GameStatusPanel, PF2GameActionPanel, PF2ActionBar } from './pf2'
export type { CharacterEditorProps, GameStatusPanelProps, GameActionPanelProps, ActionBarProps, TutorialStep } from './types'
