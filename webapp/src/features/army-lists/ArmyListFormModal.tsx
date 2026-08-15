import { useState } from 'react'
import type { ArmyListCreateInput } from '@/data/repositories/armyListRepository'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { Select } from '@/shared/ui/Select'
import type { Faction } from '@/domain/types'

interface ArmyListFormModalProps {
  factions: Faction[]
  defaultFactionId?: number | null
  onClose: () => void
  /** El dueño (userId) lo añade la página a partir de la sesión, no este formulario. */
  onCreate: (input: Omit<ArmyListCreateInput, 'userId'>) => Promise<void>
}

/** Alta de una lista nueva: facción, nombre y límite de puntos (opcional — el original no tenía ninguno). */
export function ArmyListFormModal({ factions, defaultFactionId, onClose, onCreate }: ArmyListFormModalProps) {
  const [factionId, setFactionId] = useState<number | ''>(defaultFactionId ?? factions[0]?.id ?? '')
  const [name, setName] = useState('')
  const [pointsLimit, setPointsLimit] = useState<string>('2000')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!factionId) {
      setError('Elige una facción.')
      return
    }
    if (!name.trim()) {
      setError('El nombre de la lista es obligatorio.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onCreate({
        factionId: Number(factionId),
        name: name.trim(),
        pointsLimit: pointsLimit.trim() ? Number(pointsLimit) : null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Nueva lista de ejército"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creando…' : 'Crear lista'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Select
            label="Facción principal"
            value={factionId}
            onChange={(e) => setFactionId(e.target.value ? Number(e.target.value) : '')}
          >
            {factions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-ink-soft">
            Solo para el nombre y la cabecera del PDF — luego podrás añadir unidades de cualquier facción a la lista.
          </p>
        </div>
        <TextField
          label="Nombre de la lista"
          placeholder="p.ej. Torneo de verano"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <TextField
          label="Límite de puntos (opcional)"
          type="number"
          placeholder="p.ej. 2000"
          value={pointsLimit}
          onChange={(e) => setPointsLimit(e.target.value)}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
