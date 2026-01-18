export { applyDamageToTarget, formatRoll } from './damage';
export type { ApplyDamageResult } from './damage';

export { 
  handleMoveStep, 
  handleRotate, 
  handleUndoMovement, 
  handleConfirmMovement, 
  handleSkipMovement 
} from './movement';

export { 
  handleEnterCloseCombat, 
  handleExitCloseCombat, 
  handleGrapple, 
  handleBreakFree 
} from './close-combat';

export { handleReadyAction } from './ready';

export { handleAttackAction, resolveDefenseChoice } from './attack';
