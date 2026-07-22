import { useRef, useState } from 'react'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  /** Puede ser asíncrono: el diálogo se queda abierto y bloqueado hasta que termine. */
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

/**
 * Confirmación de una acción destructiva.
 *
 * Se protege de la DOBLE CONFIRMACIÓN, que no era teórica: el borrado real es
 * una petición de red y el diálogo seguía en pantalla mientras iba y venía, así
 * que dos clics seguidos disparaban dos borrados. El segundo no borraba nada
 * (la fila ya no estaba), pero sí dejaba su rastro — así se descubrió, al
 * aparecer dos veces "Borró la regla especial «Carga ligera»" en el Log.
 *
 * El guardián es un `ref` y no solo el estado: `setState` no es inmediato, y
 * entre dos clics rápidos el componente puede no haberse vuelto a pintar
 * todavía. El `ref` cambia en el acto y corta el segundo clic de raíz.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const running = useRef(false)

  async function handleConfirm() {
    if (running.current) return
    running.current = true
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      // No se levanta `running`: si la acción falló, el diálogo lo sigue
      // mostrando bloqueado en vez de invitar a reintentar a ciegas. Quien
      // llama decide cerrarlo.
      setBusy(false)
    }
  }

  return (
    <Modal
      title={title}
      // Mientras se ejecuta no se puede cerrar (ni con Escape, ni pinchando
      // fuera): cerrar a medias dejaría al usuario sin saber si se hizo o no.
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={handleConfirm} disabled={busy}>
            {busy ? 'Un momento…' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">{message}</p>
    </Modal>
  )
}
