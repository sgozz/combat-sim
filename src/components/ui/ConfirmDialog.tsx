import type { ConfirmDialogProps } from '../../hooks/useConfirmDialog'

export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant,
  showCancel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  if (!open) return null

  const confirmClass =
    variant === 'danger'
      ? 'confirm-dialog-btn confirm-dialog-btn--danger'
      : 'confirm-dialog-btn confirm-dialog-btn--confirm'

  return (
    <div className="modal-overlay confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-dialog-title">{title}</h3>
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          {showCancel && (
            <button
              className="confirm-dialog-btn confirm-dialog-btn--cancel"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
          )}
          <button className={confirmClass} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
