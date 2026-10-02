import { useState } from 'react'

/**
 * Состояние диалога «создать/редактировать». key меняется при каждом открытии —
 * передайте его в key диалога, чтобы форма инициализировалась заново.
 */
export function useDialogState<T>() {
  const [state, setState] = useState<{ open: boolean; target: T | null; key: number }>({
    open: false,
    target: null,
    key: 0,
  })
  return {
    open: state.open,
    target: state.target,
    key: state.key,
    openWith: (target: T | null = null) => setState((s) => ({ open: true, target, key: s.key + 1 })),
    setOpen: (open: boolean) => setState((s) => ({ ...s, open })),
  }
}
