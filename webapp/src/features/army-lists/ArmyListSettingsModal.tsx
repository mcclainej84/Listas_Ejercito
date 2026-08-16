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
  onSaved: (values: { name: string; pointsLimit: number | null; showSpecialCharacters: boolean }) => void
}

/** Renombrar la lista y/o cambiar su límite de puntos. La facción no se puede cambiar (las entradas dependen de ella). */
export function ArmyListSettingsModal({ list, onClose, onSaved }: ArmyListSettingsModalProps) {
  const [name, setName] = useState(list.name)
  const [pointsLimit, setPointsLimit] = useState(list.pointsLimit != null ? String(list.pointsLimit) : '')
  const [mostrarRenombre, setMostrarRenombre] = useState(list.showSpecialCharacters)
  // Los Personajes de Renombre que la lista YA lleva. Apagar la casilla no los
  // quita —tirar entradas que alguien montó sin preguntar sería mucho peor—,
  // pero sí deja de ofrecerlos, así que se avisa: si no, uno los ve en su lista
  // y no entiende por qué no puede añadir otro ni volver a poner el que borre.
  const yaMetidos = list.entries.filter((e) => e.unit.isSpecialCharacter)
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
      // ORDEN A PROPÓSITO: primero la que puede no existir todavía en la base.
      // `show_special_characters` es de una migración reciente, y si el Worker
      // no está desplegado este UPDATE falla con "no such column". Yendo la
      // última, el nombre y los puntos ya se habrían guardado y el usuario
      // leería un error que le hace creer que no se guardó nada, con la
      // pantalla enseñándole todavía los valores viejos. Yendo la primera, o se
      // guarda todo o no se guarda nada.
      await ArmyListRepository.setShowSpecialCharacters(list.id, mostrarRenombre)
      await ArmyListRepository.rename(list.id, nextName)
      await ArmyListRepository.setPointsLimit(list.id, nextPointsLimit)
      onSaved({ name: nextName, pointsLimit: nextPointsLimit, showSpecialCharacters: mostrarRenombre })
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
        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="mt-0.5 accent-maroon"
            checked={mostrarRenombre}
            onChange={(e) => setMostrarRenombre(e.target.checked)}
          />
          <span>
            Ver Personajes de Renombre
            <span className="mt-0.5 block text-xs text-ink-soft">
              Les da su propia sección en el constructor. Cuentan como Personajes para los límites del ejército.
              Desmarcado, no se ofrecen en esta lista.
            </span>
          </span>
        </label>
        {!mostrarRenombre && yaMetidos.length > 0 && (
          <p className="rounded-sm border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-ink">
            Esta lista ya lleva{' '}
            {yaMetidos.length === 1 ? 'un Personaje de Renombre' : `${yaMetidos.length} Personajes de Renombre`} (
            {yaMetidos.map((e) => e.unit.name).join(', ')}). No se quitan al desmarcar, pero dejarán de ofrecerse: si
            los borras de la lista, no podrás volver a añadirlos sin marcar esto otra vez.
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
