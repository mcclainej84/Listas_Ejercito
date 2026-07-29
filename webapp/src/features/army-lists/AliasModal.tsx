// ============================================================================
// Ponerle nombre propio a una miniatura de la lista.
//
// El alias NO sustituye al nombre de la unidad, se suma: la lista muestra
// "Jules el Bretón (Paladín Bretoniano)". El tipo tiene que seguir viéndose
// porque es lo que dice qué reglas y qué perfil se aplican — un nombre propio
// es sabor, no una unidad distinta.
//
// Vive en la lista y no en la ficha de la unidad: "Jules" es esta miniatura en
// esta lista, no todos los paladines bretonianos del catálogo.
// ============================================================================
import { useState } from 'react'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import type { ArmyListEntry } from '@/domain/types'

export function AliasModal({
  entry,
  onClose,
  onSave,
}: {
  entry: ArmyListEntry
  onClose: () => void
  /** `null` = quitar el nombre y volver a enseñar solo el tipo. */
  onSave: (alias: string | null) => void
}) {
  const [value, setValue] = useState(entry.alias ?? '')

  function save() {
    const trimmed = value.trim()
    onSave(trimmed === '' ? null : trimmed)
  }

  return (
    <Modal
      title={`Nombre propio · ${entry.unit.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          {entry.alias && (
            <Button variant="danger" onClick={() => onSave(null)}>
              Quitar nombre
            </Button>
          )}
          <Button variant="primary" onClick={save}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextField
          label="Nombre"
          value={value}
          autoFocus
          placeholder="Jules el Bretón"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
          }}
        />
        <p className="text-xs text-ink-soft">
          En la lista se verá{' '}
          <b className="text-ink">
            {value.trim() === '' ? entry.unit.name : `${value.trim()} (${entry.unit.name})`}
          </b>
          . El tipo no se pierde: es lo que dice qué reglas se aplican.
        </p>
        <p className="text-mini text-ink-soft">
          El nombre es de esta miniatura en esta lista, no de la unidad del catálogo. Se guarda con el ejército.
        </p>
      </div>
    </Modal>
  )
}
