import type { ReactNode } from 'react'
import './styles.css'

export type ActionBarProps = {
  children: ReactNode
  className?: string
  defenseMode?: boolean
}

export const ActionBar = ({ 
  children, 
  className = '',
  defenseMode = false 
}: ActionBarProps) => {
  return (
    <div className={`action-bar ${defenseMode ? 'defense-mode' : ''} ${className}`}>
      {children}
    </div>
  )
}

export type ActionBarButtonProps = {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'danger' | 'warning' | 'highlight'
  size?: 'default' | 'small'
  disabled?: boolean
  className?: string
  title?: string
}

export const ActionBarButton = ({
  children,
  onClick,
  variant = 'default',
  size = 'default',
  disabled = false,
  className = '',
  title
}: ActionBarButtonProps) => {
  const variantClass = variant === 'default' ? '' : variant
  const sizeClass = size === 'small' ? 'small' : ''
  
  return (
    <button
      className={`action-bar-btn ${variantClass} ${sizeClass} ${disabled ? 'disabled' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      type="button"
    >
      {children}
    </button>
  )
}

export type ActionBarIconProps = {
  children: ReactNode
}

export const ActionBarIcon = ({ children }: ActionBarIconProps) => {
  return <span className="action-bar-icon">{children}</span>
}

export type ActionBarLabelProps = {
  children: ReactNode
}

export const ActionBarLabel = ({ children }: ActionBarLabelProps) => {
  return <span className="action-bar-label">{children}</span>
}

export type ActionBarManeuversProps = {
  children: ReactNode
  className?: string
}

export const ActionBarManeuvers = ({ children, className = '' }: ActionBarManeuversProps) => {
  return <div className={`action-bar-maneuvers ${className}`}>{children}</div>
}

export type ActionBarManeuverButtonProps = {
  children: ReactNode
  onClick?: () => void
  active?: boolean
  close?: boolean
  className?: string
}

export const ActionBarManeuverButton = ({
  children,
  onClick,
  active = false,
  close = false,
  className = ''
}: ActionBarManeuverButtonProps) => {
  return (
    <button
      className={`action-bar-maneuver-btn ${active ? 'active' : ''} ${close ? 'close' : ''} ${className}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

export type ActionBarBackdropProps = {
  onClick?: () => void
}

export const ActionBarBackdrop = ({ onClick }: ActionBarBackdropProps) => {
  return <div className="action-bar-backdrop" onClick={onClick} role="presentation" />
}

export type ActionBarConfigSlotProps = {
  children: ReactNode
}

export const ActionBarConfigSlot = ({ children }: ActionBarConfigSlotProps) => {
  return <div className="action-bar-config-slot">{children}</div>
}

export type ActionBarHintProps = {
  children: ReactNode
}

export const ActionBarHint = ({ children }: ActionBarHintProps) => {
  return <div className="action-bar-hint">{children}</div>
}

export type ActionBarWaitingProps = {
  message?: string
}

export const ActionBarWaiting = ({ message = 'Waiting for opponent...' }: ActionBarWaitingProps) => {
  return <div className="action-bar-waiting">{message}</div>
}

export type ActionBarMovementControlsProps = {
  onUndo: () => void
  onSkip: () => void
  onConfirm: () => void
}

export const ActionBarMovementControls = ({
  onUndo,
  onSkip,
  onConfirm
}: ActionBarMovementControlsProps) => {
  return (
    <div className="action-bar-movement-controls">
      <ActionBarButton size="small" onClick={onUndo} title="Undo Movement">
        <ActionBarIcon>↩</ActionBarIcon>
      </ActionBarButton>
      <ActionBarButton size="small" onClick={onSkip} title="Skip Movement">
        <ActionBarIcon>⏭</ActionBarIcon>
      </ActionBarButton>
      <ActionBarButton size="small" variant="primary" onClick={onConfirm} title="Confirm Movement">
        <ActionBarIcon>✓</ActionBarIcon>
      </ActionBarButton>
    </div>
  )
}

export type ActionBarFacingControlsProps = {
  onTurnLeft: () => void
  onTurnRight: () => void
}

export const ActionBarFacingControls = ({
  onTurnLeft,
  onTurnRight
}: ActionBarFacingControlsProps) => {
  return (
    <div className="action-bar-facing">
      <ActionBarButton size="small" onClick={onTurnLeft} title="Turn Left">
        <ActionBarIcon>↶</ActionBarIcon>
      </ActionBarButton>
      <ActionBarButton size="small" onClick={onTurnRight} title="Turn Right">
        <ActionBarIcon>↷</ActionBarIcon>
      </ActionBarButton>
    </div>
  )
}
