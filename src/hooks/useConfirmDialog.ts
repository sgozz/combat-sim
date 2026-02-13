import { useState, useCallback } from 'react'

type DialogOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  showCancel?: boolean
}

type DialogState = DialogOptions & {
  resolve: (value: boolean) => void
}

export type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  variant: 'danger' | 'warning' | 'default'
  showCancel: boolean
  onConfirm: () => void
  onCancel: () => void
}

const CLOSED_PROPS: ConfirmDialogProps = {
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'default',
  showCancel: true,
  onConfirm: () => {},
  onCancel: () => {},
}

export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<DialogState | null>(null)

  const confirm = useCallback((options: DialogOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setDialogState({ ...options, resolve })
    })
  }, [])

  const dialogProps: ConfirmDialogProps = dialogState
    ? {
        open: true,
        title: dialogState.title,
        message: dialogState.message,
        confirmLabel: dialogState.confirmLabel ?? 'Confirm',
        cancelLabel: dialogState.cancelLabel ?? 'Cancel',
        variant: dialogState.variant ?? 'default',
        showCancel: dialogState.showCancel ?? true,
        onConfirm: () => {
          dialogState.resolve(true)
          setDialogState(null)
        },
        onCancel: () => {
          dialogState.resolve(false)
          setDialogState(null)
        },
      }
    : CLOSED_PROPS

  return { confirm, dialogProps }
}
