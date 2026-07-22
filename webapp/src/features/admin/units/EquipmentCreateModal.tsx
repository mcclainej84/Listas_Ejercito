import { useState } from 'react'
import { EquipmentRepository } from '@/data/repositories/lookupRepositories'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { Select } from '@/shared/ui/Select'
import type { EquipmentOption } from '@/domain/types'

const CATEGORY_OPTIONS: { value: EquipmentOption['category']; label: string }[] = [
  { value: null, label: 'Sin categoría (siempre combinable)' },
  { value: 'armadura', label: 'Armadura' },
  { value: 'escudo', label: 'Escudo' },
  { value: 'arma_cac', label: 'Arma cuerpo a cuerpo' },
  { value: 'arma_dist', label: 'Arma a distancia' },
]

interface EquipmentCreateModalProps {
  initialName: string
  onClose: () => void
  onCreated: (newId: number) => void
}

/**
 * Alta rápida de una pieza de equipo que todavía no existe en el catálogo,
 * lanzada desde el buscador de "Opciones de equipo" de una unidad (ver
 * RelationEditor#onCreateNew). Una vez creada, el llamador se encarga de
 * asignarla a la unidad.
 */
export function EquipmentCreateModal({ initialName, onClose, onCreated }: EquipmentCreateModalProps) {
  const [name, setName] = useState(initialName)
  const [cost, setCost] = useState(0)
  const [category, setCategory] = useState<EquipmentOption['category']>(null)
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
      const newId = await EquipmentRepository.create({ name: name.trim(), cost, category })
      onCreated(newId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Nueva opción de equipo"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creando…' : 'Crear y asignar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <TextField label="Coste (pts)" type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
        <Select
          label="Categoría (hueco de equipo)"
          value={category ?? ''}
          onChange={(e) => setCategory((e.target.value || null) as EquipmentOption['category'])}
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value ?? ''}>
              {opt.label}
            </option>
          ))}
        </Select>
        <p className="text-xs text-ink-soft">
          La categoría decide con qué otras opciones del mismo hueco será excluyente (p. ej. dos armaduras distintas).
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
