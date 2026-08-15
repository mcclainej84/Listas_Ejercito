import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from '@/shared/ui/icons'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  widthClassName?: string
}

export function Modal({ title, onClose, children, footer, widthClassName = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full ${widthClassName} rounded-sm border border-rule-dark/40 bg-parchment shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-rule-dark/30 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-sm p-1.5 text-ink-soft transition-colors hover:bg-parchment-dark hover:text-ink"
            aria-label="Cerrar"
            title="Cerrar"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-rule-dark/30 px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
