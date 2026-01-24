import type { Posture, CombatActionPayload } from '../../../../shared/rulesets/gurps/types'
import { getPostureModifiers, canChangePostureFree, getValidPostureChanges } from '../../../../shared/rulesets/gurps/rules'

type PostureControlsProps = {
  currentPosture: Posture
  basicMove: number
  basicDodge: number
  isMyTurn: boolean
  onChangePosture: (payload: CombatActionPayload) => void
}

const POSTURE_ICONS: Record<Posture, string> = {
  standing: '🧍',
  crouching: '🏃',
  kneeling: '🧎',
  prone: '🛌'
}

const POSTURE_LABELS: Record<Posture, string> = {
  standing: 'Standing',
  crouching: 'Crouching',
  kneeling: 'Kneeling',
  prone: 'Prone'
}

export const PostureControls = ({
  currentPosture,
  basicMove,
  basicDodge,
  isMyTurn,
  onChangePosture
}: PostureControlsProps) => {
  const mods = getPostureModifiers(currentPosture)
  const effectiveMove = Math.floor(basicMove * mods.moveMultiplier)
  const effectiveDodge = basicDodge + mods.defenseVsMelee
  
  const changes = getValidPostureChanges(currentPosture)
  
  const handleChange = (newPosture: Posture) => {
    const isFree = canChangePostureFree(currentPosture, newPosture)
    if (!isFree && !isMyTurn) return
    
    onChangePosture({ type: 'change_posture', posture: newPosture })
  }
  
  return (
    <div className="posture-controls">
      <div className="posture-current">
        <span className="posture-icon">{POSTURE_ICONS[currentPosture]}</span>
        <span className="posture-label">{POSTURE_LABELS[currentPosture]}</span>
      </div>
      
      <div className="posture-stats">
        <span className="posture-stat">
          <span className="stat-name">Move</span>
          <span className="stat-value">{effectiveMove}</span>
        </span>
        <span className="posture-stat">
          <span className="stat-name">Dodge</span>
          <span className="stat-value">{effectiveDodge >= 0 ? effectiveDodge : effectiveDodge}</span>
        </span>
      </div>
      
      {mods.toHitMelee !== 0 && (
        <div className="posture-penalty">
          Melee: {mods.toHitMelee > 0 ? '+' : ''}{mods.toHitMelee} to hit
        </div>
      )}
      
       <div className="posture-options">
         {changes.map((change: typeof changes[number]) => (
          <button
            key={change.to}
            className={`posture-btn ${change.isFree ? 'free' : 'maneuver'}`}
            onClick={() => handleChange(change.to)}
            disabled={!change.isFree && !isMyTurn}
            title={change.description}
          >
            <span className="btn-icon">{POSTURE_ICONS[change.to]}</span>
            <span className="btn-label">{POSTURE_LABELS[change.to]}</span>
            {change.isFree && <span className="free-badge">Free</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
