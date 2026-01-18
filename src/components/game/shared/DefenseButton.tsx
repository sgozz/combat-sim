import type { DefenseType } from '../../../../shared/types'

export type DefenseButtonProps = {
  type: DefenseType | 'none'
  value: number | null
  chance?: number
  disabled?: boolean
  onClick: () => void
  variant?: 'desktop' | 'mobile'
  className?: string
}

const DEFENSE_ICONS: Record<DefenseType | 'none', string> = {
  dodge: '🏃',
  parry: '🗡️',
  block: '🛡️',
  none: '🚫',
}

const DEFENSE_LABELS: Record<DefenseType | 'none', string> = {
  dodge: 'Dodge',
  parry: 'Parry',
  block: 'Block',
  none: 'None',
}

export const DefenseButton = ({
  type,
  value,
  chance,
  disabled = false,
  onClick,
  variant = 'desktop',
  className = '',
}: DefenseButtonProps) => {
  const icon = DEFENSE_ICONS[type]
  const label = DEFENSE_LABELS[type]
  const isNone = type === 'none'
  const isUnavailable = !isNone && value === null

  if (variant === 'mobile') {
    return (
      <button
        className={`action-bar-btn defense-btn ${type} ${isUnavailable ? 'disabled' : ''} ${isNone ? 'danger' : ''} ${className}`}
        onClick={onClick}
        disabled={disabled || isUnavailable}
      >
        <span className="action-bar-icon">{icon}</span>
        <span className="action-bar-label">{label}</span>
        {!isNone && value !== null && (
          <>
            <span className="defense-value">{value}</span>
            {chance !== undefined && (
              <span className="defense-chance">{chance.toFixed(0)}%</span>
            )}
          </>
        )}
        {isUnavailable && <span className="defense-value">N/A</span>}
      </button>
    )
  }

  return (
    <button
      className={`action-btn ${isNone ? 'danger' : ''} ${isUnavailable ? 'disabled' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled || isUnavailable}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className="btn-icon">{icon}</span>
        <span>{label}</span>
      </span>
      {!isNone && value !== null && (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 'bold' }}>{value}</span>
          {chance !== undefined && (
            <span style={{ color: '#888', fontSize: '0.85rem' }}>({chance.toFixed(0)}%)</span>
          )}
        </span>
      )}
      {isUnavailable && <span style={{ color: '#666' }}>N/A</span>}
    </button>
  )
}

export type DefenseOptionsProps = {
  dodge: number
  parry: number | null
  block: number | null
  getChance: (value: number) => number
  onDefend: (type: DefenseType | 'none') => void
  variant?: 'desktop' | 'mobile'
  className?: string
}

export const DefenseOptions = ({
  dodge,
  parry,
  block,
  getChance,
  onDefend,
  variant = 'desktop',
  className = '',
}: DefenseOptionsProps) => {
  const containerClass = variant === 'mobile' 
    ? `action-bar defense-mode ${className}` 
    : `action-buttons ${className}`

  return (
    <div className={containerClass}>
      <DefenseButton
        type="dodge"
        value={dodge}
        chance={getChance(dodge)}
        onClick={() => onDefend('dodge')}
        variant={variant}
      />
      <DefenseButton
        type="parry"
        value={parry}
        chance={parry !== null ? getChance(parry) : undefined}
        onClick={() => onDefend('parry')}
        variant={variant}
      />
      <DefenseButton
        type="block"
        value={block}
        chance={block !== null ? getChance(block) : undefined}
        onClick={() => onDefend('block')}
        variant={variant}
      />
      <DefenseButton
        type="none"
        value={null}
        onClick={() => onDefend('none')}
        variant={variant}
      />
    </div>
  )
}
