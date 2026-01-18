export type StatBarProps = {
  label: string
  current: number
  max: number
  color?: string
  className?: string
  variant?: 'desktop' | 'mobile'
}

export const StatBar = ({
  label,
  current,
  max,
  color,
  className = '',
  variant = 'desktop',
}: StatBarProps) => {
  const percent = max > 0 ? Math.max(0, (current / max) * 100) : 0
  const defaultColor = percent > 50 ? '#4f4' : percent > 25 ? '#ff4' : '#f44'
  const fillColor = color ?? defaultColor

  if (variant === 'mobile') {
    return (
      <div className={`action-bar-status ${className}`}>
        <div className="action-bar-hp-bar">
          <div 
            className="action-bar-hp-fill" 
            style={{ width: `${percent}%`, background: fillColor }}
          />
        </div>
        <span className="action-bar-hp-text">{current}/{max}</span>
      </div>
    )
  }

  return (
    <div className={`stat-bar-row ${className}`}>
      <span className="stat-label">{label}</span>
      <div className="stat-bar-track">
        <div 
          className={`stat-bar-fill ${label === 'FP' ? 'fp' : ''}`} 
          style={{ width: `${percent}%`, backgroundColor: label === 'FP' ? undefined : fillColor }}
        />
      </div>
      <span className="stat-value">{current}/{max}</span>
    </div>
  )
}

export type StatBarGroupProps = {
  hp: { current: number; max: number }
  fp: { current: number; max: number }
  className?: string
  variant?: 'desktop' | 'mobile'
}

export const StatBarGroup = ({ hp, fp, className = '', variant = 'desktop' }: StatBarGroupProps) => {
  if (variant === 'mobile') {
    return (
      <StatBar 
        label="HP"
        current={hp.current}
        max={hp.max}
        variant="mobile"
        className={className}
      />
    )
  }

  return (
    <div className={className}>
      <StatBar label="HP" current={hp.current} max={hp.max} variant="desktop" />
      <StatBar label="FP" current={fp.current} max={fp.max} variant="desktop" />
    </div>
  )
}
