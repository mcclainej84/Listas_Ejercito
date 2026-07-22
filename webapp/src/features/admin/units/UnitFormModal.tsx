import { useEffect, useState } from 'react'
import { UnitRepository, type UnitSummary } from '@/data/repositories/unitRepository'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { Select } from '@/shared/ui/Select'
import { Spinner } from '@/shared/ui/Spinner'
import type { Faction, UnitCategory, UnitType } from '@/domain/types'

interface UnitFormModalProps {
  factionId: number
  categories: UnitCategory[]
  /** Para el desplegable de "Crear desde": permite partir de una unidad de cualquier facción. */
  factions: Faction[]
  /** Categoría preseleccionada (p.ej. la que estaba abierta en el acordeón al pulsar "+ Nueva unidad"). */
  defaultCategoryId?: number | null
  onClose: () => void
  onCreated: (unitId: number) => void
}

/**
 * Alta de una unidad. Dos caminos:
 *
 * - **En blanco**: solo pide lo mínimo (nombre, tipo, categoría) para poder
 *   navegar a su ficha de detalle y completar el resto (perfil, equipo,
 *   reglas…) ahí.
 * - **Crear desde**: parte de una unidad ya existente —de esta facción o de
 *   cualquier otra— y la copia entera (perfil, equipo, reglas, opciones,
 *   monturas y grupo de mando), quedándose con el nombre y la categoría que
 *   se indiquen aquí. Ahorra rehacer a mano una unidad casi idéntica, que es
 *   lo más común entre facciones parecidas.
 */
export function UnitFormModal({
  factionId,
  categories,
  factions,
  defaultCategoryId,
  onClose,
  onCreated,
}: UnitFormModalProps) {
  const [name, setName] = useState('')
  const [unitType, setUnitType] = useState<UnitType>('tropa')
  const [categoryId, setCategoryId] = useState<number | null>(defaultCategoryId ?? categories[0]?.id ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ---- "Crear desde" ----
  const [sourceEnabled, setSourceEnabled] = useState(false)
  // Arranca en la facción actual, que es de la que se copia casi siempre.
  const [sourceFactionId, setSourceFactionId] = useState<number>(factionId)
  const [sourceUnits, setSourceUnits] = useState<UnitSummary[] | null>(null)
  const [sourceUnitId, setSourceUnitId] = useState<number | null>(null)

  // Las unidades se piden al elegir facción (y no todas de golpe al abrir):
  // el desplegable solo enseña las de una facción cada vez.
  useEffect(() => {
    if (!sourceEnabled) return
    let cancelled = false
    setSourceUnits(null)
    void UnitRepository.listByFaction(sourceFactionId).then((list) => {
      if (cancelled) return
      setSourceUnits(list)
      setSourceUnitId(list[0]?.id ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [sourceEnabled, sourceFactionId])

  async function handleSubmit() {
    if (!name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    if (categoryId == null) {
      setError('La categoría es obligatoria.')
      return
    }
    if (sourceEnabled && sourceUnitId == null) {
      setError('Elige la unidad de la que quieres partir.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const unitId =
        sourceEnabled && sourceUnitId != null
          ? await UnitRepository.duplicate(sourceUnitId, { factionId, name, categoryId })
          : await UnitRepository.create({ factionId, name, unitType, categoryId })
      onCreated(unitId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Nueva unidad"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creando…' : 'Crear y editar ficha'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        {/* El tipo lo decide la unidad de origen cuando se copia: cambiarlo
            aquí dejaría, p.ej., un "personaje" con tamaño de regimiento. */}
        {!sourceEnabled && (
          <Select label="Tipo" value={unitType} onChange={(e) => setUnitType(e.target.value as UnitType)}>
            <option value="tropa">Tropa</option>
            <option value="personaje">Personaje</option>
          </Select>
        )}

        <Select
          label="Categoría"
          value={categoryId ?? ''}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <div className="rounded-sm border border-rule-dark/40 bg-parchment/60 p-3">
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-0.5 accent-maroon"
              checked={sourceEnabled}
              onChange={(e) => setSourceEnabled(e.target.checked)}
            />
            <span>
              Crear desde otra unidad
              <span className="mt-0.5 block text-[10.5px] text-ink-soft">
                Copia su ficha entera (perfil, equipo, reglas, opciones, monturas y mando) con el nombre y la categoría
                de arriba. Puede ser de cualquier facción.
              </span>
            </span>
          </label>

          {sourceEnabled && (
            <div className="mt-3 space-y-3">
              <Select
                label="Facción de origen"
                value={sourceFactionId}
                onChange={(e) => setSourceFactionId(Number(e.target.value))}
              >
                {factions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>

              {sourceUnits === null ? (
                <Spinner />
              ) : sourceUnits.length === 0 ? (
                <p className="text-xs text-ink-soft italic">Esta facción todavía no tiene unidades.</p>
              ) : (
                <Select
                  label="Unidad de origen"
                  value={sourceUnitId ?? ''}
                  onChange={(e) => setSourceUnitId(e.target.value ? Number(e.target.value) : null)}
                >
                  {sourceUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.categoryName ? ` — ${u.categoryName}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          )}
        </div>

        {!sourceEnabled && (
          <p className="text-xs text-ink-soft">
            El resto de la ficha (perfil de atributos, equipo, reglas especiales, grupo de mando…) se completa en la
            propia unidad después de crearla.
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
