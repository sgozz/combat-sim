import { Tooltip } from '../../ui/Tooltip'
import type { ManeuverDef } from './useGameActions'

export type ManeuverButtonProps = {
  maneuver: ManeuverDef
  selected?: boolean
  disabled?: boolean
  onClick: () => void
  variant?: 'desktop' | 'mobile'
  className?: string
}

export const ManeuverButton = ({
  maneuver,
  selected = false,
  disabled = false,
  onClick,
  variant = 'desktop',
  className = '',
}: ManeuverButtonProps) => {
  if (variant === 'mobile') {
    return (
      <button
        className={`action-bar-maneuver-btn ${selected ? 'active' : ''} ${className}`}
        onClick={onClick}
        disabled={disabled}
      >
        <span className="action-bar-icon">{maneuver.icon}</span>
        <span className="action-bar-label">{maneuver.shortLabel}</span>
      </button>
    )
  }

  return (
    <Tooltip content={maneuver.desc} position="top">
      <button
        className={`maneuver-btn ${selected ? 'active' : ''} ${className}`}
        onClick={onClick}
        disabled={disabled}
      >
        <span className="maneuver-icon">{maneuver.icon}</span>
        <span className="maneuver-label">{maneuver.label}</span>
        <span className="key-hint">{maneuver.key}</span>
      </button>
    </Tooltip>
  )
}

export type ManeuverGridProps = {
  maneuvers: ManeuverDef[]
  selectedType?: string | null
  onSelect: (maneuver: ManeuverDef) => void
  variant?: 'desktop' | 'mobile'
  className?: string
}

export const ManeuverGrid = ({
  maneuvers,
  selectedType,
  onSelect,
  variant = 'desktop',
  className = '',
}: ManeuverGridProps) => {
  if (variant === 'mobile') {
    return (
      <div className={`action-bar-maneuvers ${className}`}>
        {maneuvers.map(m => (
          <ManeuverButton
            key={m.type}
            maneuver={m}
            selected={selectedType === m.type}
            onClick={() => onSelect(m)}
            variant="mobile"
          />
        ))}
      </div>
    )
  }

  return (
    <div className={`maneuver-grid ${className}`}>
      {maneuvers.map(m => (
        <ManeuverButton
          key={m.type}
          maneuver={m}
          selected={selectedType === m.type}
          onClick={() => onSelect(m)}
          variant="desktop"
        />
      ))}
    </div>
  )
}
