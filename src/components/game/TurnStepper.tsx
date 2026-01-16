import type { ManeuverType } from '../../../shared/types'

type TurnStepperProps = {
  isMyTurn: boolean
  currentManeuver: ManeuverType | null
}

const MANEUVER_LABELS: Record<ManeuverType, string> = {
  'move': 'Move',
  'attack': 'Attack',
  'all_out_attack': 'All-Out',
  'all_out_defense': 'Defend',
  'move_and_attack': 'Rush',
  'aim': 'Aim',
  'do_nothing': 'Wait',
}

export const TurnStepper = ({ isMyTurn, currentManeuver }: TurnStepperProps) => {
  if (!isMyTurn) {
    return (
      <div className="turn-stepper compact waiting">
        <span className="stepper-dot"></span>
        <span>Opponent's turn...</span>
      </div>
    )
  }

  if (!currentManeuver) {
    return (
      <div className="turn-stepper compact phase-plan">
        <span className="stepper-dot active"></span>
        <span className="phase-label">STEP 1:</span>
        <span>Choose a maneuver →</span>
      </div>
    )
  }

  return (
    <div className="turn-stepper compact phase-act">
      <span className="stepper-dot done"></span>
      <span className="phase-label">STEP 2:</span>
      <span className="maneuver-badge">{MANEUVER_LABELS[currentManeuver]}</span>
      <span>→ Execute action or End Turn</span>
    </div>
  )
}
