// ============================================================================
// "Opciones Lista de ejército" — qué líneas extra se ven bajo cada unidad en
// "Unidades en la lista" (ver ArmyListBuilderPage).
//
// Es preferencia de CADA usuario, no del catálogo ni de la lista: dos personas
// pueden abrir el mismo ejército y verlo con distinto detalle. Por eso vive en
// columnas de `users` y no en `army_lists`.
//
// Ambas nacen encendidas. Estrenarlas apagadas dejaría la novedad escondida
// detrás de un menú que casi nadie abre.
// ============================================================================
import { useEffect, useState } from 'react'
import { UserRepository, DEFAULT_ARMY_LIST_OPTIONS, type ArmyListOptions } from '@/data/repositories/userRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'

interface Opcion {
  key: keyof ArmyListOptions
  label: string
}

const OPCIONES: Opcion[] = [
  { key: 'showMounts', label: 'Ver la montura y el carro' },
  { key: 'showMagic', label: 'Ver las sendas de magia y su nivel' },
]

export function ArmyListOptionsModal({
  userId,
  onClose,
  onSaved,
}: {
  userId: number
  onClose: () => void
  onSaved: () => void
}) {
  const { data: guardadas, loading } = useAsync(() => UserRepository.getArmyListOptions(userId), [userId])

  const [draft, setDraft] = useState<ArmyListOptions>(DEFAULT_ARMY_LIST_OPTIONS)
  useEffect(() => {
    if (guardadas) setDraft(guardadas)
  }, [guardadas])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await UserRepository.setArmyListOptions(userId, draft)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Opciones Lista de ejército"
      widthClassName="max-w-md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-1">
          {OPCIONES.map((opcion) => (
            <label
              key={opcion.key}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-ink hover:bg-parchment-dark/50"
            >
              <input
                type="checkbox"
                className="accent-maroon"
                checked={draft[opcion.key]}
                onChange={(e) => setDraft((d) => ({ ...d, [opcion.key]: e.target.checked }))}
              />
              {opcion.label}
            </label>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Modal>
  )
}
