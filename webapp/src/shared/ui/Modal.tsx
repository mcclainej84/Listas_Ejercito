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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      {/* QUIEN LIMITA LA ALTURA ES EL DIÁLOGO ENTERO, NO SU CUERPO.
          Antes el tope (`max-h-[70vh]`) estaba en el cuerpo, así que la altura
          real del diálogo era ese 70 % MÁS la cabecera MÁS el pie: en un móvil
          se pasaba de pantalla y el botón de guardar quedaba fuera, sin forma de
          alcanzarlo porque el fondo no scrollea. Ahora el tope lo lleva la caja,
          repartido por un `flex-col` donde solo el cuerpo crece y se desplaza:
          cabecera y pie se ven SIEMPRE.
          `svh` y no `vh`: en el móvil `vh` mide la ventana con las barras del
          navegador escondidas, que es precisamente el estado en el que no
          está al abrir un diálogo. */}
      <div
        className={`relative flex max-h-[92svh] w-full flex-col ${widthClassName} rounded-sm border border-rule-dark/40 bg-parchment shadow-2xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-rule-dark/30 px-4 py-3 sm:px-5 sm:py-4">
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
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-rule-dark/30 px-4 py-3 sm:px-5 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
