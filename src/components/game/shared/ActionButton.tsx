import type { ReactNode } from 'react'

export type ActionButtonVariant = 'primary' | 'danger' | 'warning' | 'default' | 'highlight'
export type ActionButtonSize = 'small' | 'normal'

export type ActionButtonProps = {
  icon?: ReactNode
  label?: string
  variant?: ActionButtonVariant
  size?: ActionButtonSize
  disabled?: boolean
  onClick: () => void
  title?: string
  uiVariant?: 'desktop' | 'mobile'
  className?: string
  children?: ReactNode
}

export const ActionButton = ({
  icon,
  label,
  variant = 'default',
  size = 'normal',
  disabled = false,
  onClick,
  title,
  uiVariant = 'desktop',
  className = '',
  children,
}: ActionButtonProps) => {
  if (uiVariant === 'mobile') {
    const variantClass = variant !== 'default' ? variant : ''
    const sizeClass = size === 'small' ? 'small' : ''
    
    return (
      <button
        className={`action-bar-btn ${variantClass} ${sizeClass} ${disabled ? 'disabled' : ''} ${className}`}
        onClick={onClick}
        disabled={disabled}
        title={title}
      >
        {icon && <span className="action-bar-icon">{icon}</span>}
        {label && <span className="action-bar-label">{label}</span>}
        {children}
      </button>
    )
  }

  const variantClass = variant !== 'default' ? variant : ''
  const sizeClass = size === 'small' ? 'small' : ''

  return (
    <button
      className={`action-btn ${variantClass} ${sizeClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      {label || children}
    </button>
  )
}

export type ActionButtonGroupProps = {
  children: ReactNode
  className?: string
  direction?: 'row' | 'column'
}

export const ActionButtonGroup = ({
  children,
  className = '',
  direction = 'column',
}: ActionButtonGroupProps) => {
  const style = direction === 'row' 
    ? { display: 'flex', flexDirection: 'row' as const, gap: '0.5rem' }
    : undefined

  return (
    <div className={`action-buttons ${className}`} style={style}>
      {children}
    </div>
  )
}
