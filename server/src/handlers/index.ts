export { applyDamageToTarget, formatRoll } from './shared/damage';
export type { ApplyDamageResult } from './shared/damage';

export { 
  handleMoveStep, 
  handleRotate, 
  handleUndoMovement, 
  handleConfirmMovement, 
  handleSkipMovement,
  handleEnterCloseCombat, 
  handleExitCloseCombat, 
  handleGrapple, 
  handleBreakFree,
  handleReadyAction,
  handleAttackAction, 
  resolveDefenseChoice,
} from './gurps';

export { handleGurpsAction } from './gurps/router';

export { 
  handlePF2Action,
  handlePF2AttackAction,
} from './pf2';
