// ============================================================================
// Alta rápida de una opción de unidad que todavía no existe en el catálogo,
// lanzada desde el buscador de "Opciones de unidad" de una ficha (ver
// RelationEditor#onCreateNew). Gemelo de EquipmentCreateModal: mismo gesto,
// mismo sitio, mismo resultado — el usuario no debería tener que salir a otra
// pantalla solo porque la opción que busca aún no está dada de alta.
//
// Más simple que el de equipo a propósito: una opción de unidad no tiene
// "hueco" (categoría) ni incompatibilidades por hueco, así que solo pide
// nombre y coste. El perfil propio y las reglas especiales, si los lleva, se
// añaden luego desde Editor → Equipo y opciones.
// ============================================================================
import { useState } from 'react'
import { UpgradeRepository } from '@/data/repositories/lookupRepositories'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'

interface UpgradeCreateModalProps {
  initialName: string
  onClose: () => void
  onCreated: (newId: number) => void
}

export function UpgradeCreateModal({ initialName, onClose, onCreated }: UpgradeCreateModalProps) {
  const [name, setName] = useState(initialName)
  const [cost, setCost] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      onCreated(await UpgradeRepository.create({ name: name.trim(), cost }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Nueva opción de unidad"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creando…' : 'Crear y añadir'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextField
          label="Nombre"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit()
          }}
        />
        <TextField
          label="Coste en puntos"
          type="number"
          value={String(cost)}
          onChange={(e) => setCost(Number(e.target.value) || 0)}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
