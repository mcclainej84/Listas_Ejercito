import { useState } from 'react'
import { EquipmentRepository } from '@/data/repositories/lookupRepositories'
import { useAsync } from '@/shared/hooks/useAsync'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { Select } from '@/shared/ui/Select'
import { RelationEditor } from '@/shared/ui/RelationEditor'
import type { EquipmentOption } from '@/domain/types'

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Sin categoría' },
  { value: 'armadura', label: 'Armadura' },
  { value: 'escudo', label: 'Escudo' },
  { value: 'arma_cac', label: 'Arma cuerpo a cuerpo' },
  { value: 'arma_dist', label: 'Arma a distancia' },
]

interface EquipmentFormModalProps {
  equipment: EquipmentOption | null
  onClose: () => void
  onSaved: () => void
}

/** Alta o edición de una pieza de equipo del catálogo (descripción, coste y hueco/categoría). */
export function EquipmentFormModal({ equipment, onClose, onSaved }: EquipmentFormModalProps) {
  const [name, setName] = useState(equipment?.name ?? '')
  const [cost, setCost] = useState(equipment ? String(equipment.cost) : '0')
  const [category, setCategory] = useState<string>(equipment?.category ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Incompatibilidades: qué otras piezas de equipo no se pueden llevar a la vez
  // que ésta. El constructor de listas las respeta deshabilitando la opción.
  const { data: allEquipment } = useAsync(() => EquipmentRepository.listAll())
  const { data: currentIncompat } = useAsync(
    () => (equipment ? EquipmentRepository.listIncompatibleWith(equipment.id) : Promise.resolve([])),
    [equipment?.id],
  )
  const [incompatIds, setIncompatIds] = useState<Set<number> | null>(null)
  const selectedIncompat = incompatIds ?? new Set(currentIncompat ?? [])
  const [mutualGroup, setMutualGroup] = useState(false)

  async function handleSubmit() {
    if (!name.trim()) {
      setError('La descripción es obligatoria.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const input = {
        name: name.trim(),
        cost: Number(cost) || 0,
        category: (category || null) as EquipmentOption['category'],
      }
      const id = equipment ? (await EquipmentRepository.update(equipment.id, input), equipment.id) : await EquipmentRepository.create(input)
      await EquipmentRepository.setIncompatibilities(id, [...selectedIncompat])
      // Ver la nota equivalente en UpgradeFormModal: enlaza también las
      // seleccionadas entre sí, no solo contra ésta.
      if (mutualGroup && selectedIncompat.size > 1) {
        await EquipmentRepository.setExclusiveGroup(
          [id, ...selectedIncompat],
          `Solo se puede llevar una opción de este grupo (${name.trim()})`,
        )
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title={equipment ? 'Editar opción de equipo' : 'Nueva opción de equipo'}
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
        <TextField label="Descripción" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="flex gap-4">
          <div className="w-24">
            <TextField label="Coste (pts)" type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="flex-1">
            <Select label="Categoría (hueco)" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <p className="text-xs text-ink-soft">
          La categoría indica el "hueco" (armadura, escudo, arma…): dos piezas del mismo hueco son alternativas
          excluyentes en el constructor de listas, salvo excepción.
        </p>

        <div className="border-t border-rule-dark/20 pt-4">
          <p className="mb-1 text-xs font-medium text-ink-soft">Incompatible con</p>
          <p className="mb-2 text-mini text-ink-soft">
            Al montar un ejército, marcar esta pieza deshabilitará las que elijas aquí (y al revés).
          </p>
          <RelationEditor
            allItems={(allEquipment ?? [])
              .filter((e) => e.id !== equipment?.id)
              .map((e) => ({ id: e.id, name: e.name, cost: e.cost }))}
            selectedIds={selectedIncompat}
            onToggle={(id, enabled) => {
              const next = new Set(selectedIncompat)
              if (enabled) next.add(id)
              else next.delete(id)
              setIncompatIds(next)
            }}
            onToggleMany={(ids, enabled) => {
              const next = new Set(selectedIncompat)
              for (const id of ids) {
                if (enabled) next.add(id)
                else next.delete(id)
              }
              setIncompatIds(next)
            }}
            multiSelect
            addLabel="Añadir incompatibilidad"
          />
          <label className="mt-3 flex items-start gap-2 text-xs text-ink">
            <input
              type="checkbox"
              className="mt-0.5 accent-maroon"
              checked={mutualGroup}
              onChange={(e) => setMutualGroup(e.target.checked)}
            />
            <span>
              Excluyentes entre sí
              <span className="block text-mini text-ink-soft">
                Además de contra ésta, las seleccionadas quedan incompatibles unas con otras (grupo excluyente).
              </span>
            </span>
          </label>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
