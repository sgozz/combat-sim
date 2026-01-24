import type { 
  CharacterSheet, 
  MatchState, 
  Player, 
} from '../../../shared/types'
import type {
  CombatantState,
  CombatActionPayload, 
  ManeuverType,
  DefenseChoice,
  PendingDefense,
} from '../../../shared/rulesets/gurps/types'

export type CharacterEditorProps = {
  character: CharacterSheet
  setCharacter: (character: CharacterSheet) => void
  onSave: () => void
  onCancel: () => void
}

export type GameStatusPanelProps = {
  matchState: MatchState
  player: Player
  combatant: CombatantState
  character: CharacterSheet
  lobbyPlayers: Player[]
  isMyTurn: boolean
  onAction: (action: string, payload?: CombatActionPayload) => void
}

export type GameActionPanelProps = {
  matchState: MatchState
  player: Player
  combatant: CombatantState
  character: CharacterSheet
  logs: string[]
  selectedTargetId: string | null
  currentManeuver: ManeuverType | null
  isMyTurn: boolean
  onAction: (action: string, payload?: CombatActionPayload) => void
  onLeaveLobby: () => void
}

export type ActionBarProps = {
  matchState: MatchState
  player: Player
  combatant: CombatantState
  character: CharacterSheet
  isMyTurn: boolean
  currentManeuver: ManeuverType | null
  selectedTargetId: string | null
  onAction: (action: string, payload?: CombatActionPayload) => void
  onDefend: (choice: DefenseChoice) => void
  onLeaveLobby: () => void
}

export type DefenseModalProps = {
  pendingDefense: PendingDefense
  character: CharacterSheet
  combatant: CombatantState
  attackerName: string
  inCloseCombat: boolean
  onDefend: (choice: DefenseChoice) => void
}

export type TutorialStep = {
  title: string
  description: string
}

export type RulesetComponents = {
  CharacterEditor: React.ComponentType<CharacterEditorProps>
  GameStatusPanel: React.ComponentType<GameStatusPanelProps>
  GameActionPanel: React.ComponentType<GameActionPanelProps>
  ActionBar: React.ComponentType<ActionBarProps>
  DefenseModal: React.ComponentType<DefenseModalProps> | null
  tutorialSteps: TutorialStep[]
}
