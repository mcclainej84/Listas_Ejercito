import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'

interface UnsavedChangesDialogProps {
  saving?: boolean
  onSaveAndLeave: () => void
  onDiscardAndLeave: () => void
  onKeepEditing: () => void
}

/**
 * Diálogo de 3 vías cuando se intenta salir de una ficha con cambios sin
 * guardar (navegación interna vía useBlocker, ver UnitDetailPage). Distinto
 * de ConfirmDialog (2 vías) porque aquí "salir" tiene dos variantes propias.
 */
export function UnsavedChangesDialog({
  saving,
  onSaveAndLeave,
  onDiscardAndLeave,
  onKeepEditing,
}: UnsavedChangesDialogProps) {
  return (
    <Modal
      title="Cambios sin guardar"
      onClose={onKeepEditing}
      footer={
        <>
          <Button variant="ghost" onClick={onKeepEditing} disabled={saving}>
            Seguir editando
          </Button>
          <Button variant="danger" onClick={onDiscardAndLeave} disabled={saving}>
            Descartar y salir
          </Button>
          <Button variant="primary" onClick={onSaveAndLeave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar y salir'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">
        Esta ficha tiene cambios que todavía no se han guardado. ¿Qué quieres hacer?
      </p>
    </Modal>
  )
}
