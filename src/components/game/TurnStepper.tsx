type TurnStepperProps = {
  isMyTurn: boolean
  currentManeuver: string | null
  rulesetId: 'gurps' | 'pf2'
  actionsRemaining: number
}

const MANEUVER_LABELS: Record<string, string> = {
   'move': 'Move',
   'attack': 'Attack',
   'all_out_attack': 'All-Out',
   'all_out_defense': 'Defend',
   'move_and_attack': 'Rush',
   'aim': 'Aim',
   'evaluate': 'Evaluate',
   'ready': 'Ready',
   'wait': 'Wait',
   'change_posture': 'Posture',
   'do_nothing': 'Pass',
   'pf2_step': 'Step',
}

export const TurnStepper = ({ isMyTurn, currentManeuver, rulesetId, actionsRemaining }: TurnStepperProps) => {
  if (!isMyTurn) {
    return (
      <div className="turn-stepper compact waiting">
        <span className="stepper-dot"></span>
        <span>Opponent's turn...</span>
      </div>
    )
  }

  // PF2 mode: Show action count
  if (rulesetId === 'pf2') {
    const actionText = actionsRemaining === 1 ? '1 action remaining' : 
                       actionsRemaining === 0 ? 'No actions remaining' :
                       `${actionsRemaining} actions remaining`
    
    return (
      <div className="turn-stepper compact phase-plan">
        <span className="stepper-dot active"></span>
        <span className="phase-label">YOUR TURN:</span>
        <span>{actionText}</span>
      </div>
    )
  }

  // GURPS mode: Show maneuver workflow
  if (!currentManeuver) {
    return (
      <div className="turn-stepper compact phase-plan">
        <span className="stepper-dot active"></span>
        <span className="phase-label">STEP 1:</span>
        <span>Choose a maneuver <span className="arrow-hint">→</span></span>
      </div>
    )
  }

  return (
    <div className="turn-stepper compact phase-act">
      <span className="stepper-dot done"></span>
      <span className="phase-label">STEP 2:</span>
      <span className="maneuver-badge">{MANEUVER_LABELS[currentManeuver]}</span>
      <span><span className="arrow-hint">→</span> Execute or End Turn</span>
    </div>
  )
}
