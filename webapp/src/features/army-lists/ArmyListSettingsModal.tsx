import { useState } from 'react'
import { ArmyListRepository } from '@/data/repositories/armyListRepository'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import type { ArmyListDetail } from '@/domain/types'

interface ArmyListSettingsModalProps {
  list: ArmyListDetail
  onClose: () => void
  /** Devuelve los valores ya persistidos para que la página actualice su estado local SIN recargar (una recarga descartaría el borrador de entradas sin guardar). */
  onSaved: (values: { name: string; pointsLimit: number | null }) => void
}

/** Renombrar la lista y/o cambiar su límite de puntos. La facción no se puede cambiar (las entradas dependen de ella). */
export function ArmyListSettingsModal({ list, onClose, onSaved }: ArmyListSettingsModalProps) {
  const [name, setName] = useState(list.name)
  const [pointsLimit, setPointsLimit] = useState(list.pointsLimit != null ? String(list.pointsLimit) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!name.trim()) {
      setError('El nombre de la lista es obligatorio.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const nextName = name.trim()
      const nextPointsLimit = pointsLimit.trim() ? Number(pointsLimit) : null
      await ArmyListRepository.rename(list.id, nextName)
      await ArmyListRepository.setPointsLimit(list.id, nextPointsLimit)
      onSaved({ name: nextName, pointsLimit: nextPointsLimit })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Editar lista"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Nombre de la lista" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <TextField
          label="Límite de puntos (opcional)"
          type="number"
          placeholder="Sin límite"
          value={pointsLimit}
          onChange={(e) => setPointsLimit(e.target.value)}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
