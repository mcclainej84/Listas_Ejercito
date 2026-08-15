import { useEffect, useState } from 'react'
import { FactionRepository } from '@/data/repositories/factionRepository'
import { UserRepository } from '@/data/repositories/userRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'

/**
 * "Mis facciones": qué facciones quiere ver este usuario en Fichas y Ejércitos.
 * Se guardan las OCULTAS (ver user_hidden_factions), así que una facción nueva
 * del catálogo aparece por defecto para todo el mundo.
 */
export function MyFactionsModal({
  userId,
  onClose,
  onSaved,
}: {
  userId: number
  onClose: () => void
  onSaved: () => void
}) {
  const { data: factions, loading } = useAsync(() => FactionRepository.listAll())
  const { data: hidden } = useAsync(() => UserRepository.getHiddenFactionIds(userId), [userId])

  const [visible, setVisible] = useState<Set<number> | null>(null)
  useEffect(() => {
    if (factions && hidden) {
      const hiddenSet = new Set(hidden)
      setVisible(new Set(factions.filter((f) => !hiddenSet.has(f.id)).map((f) => f.id)))
    }
  }, [factions, hidden])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!factions || !visible) return
    setSaving(true)
    setError(null)
    try {
      const hiddenIds = factions.filter((f) => !visible.has(f.id)).map((f) => f.id)
      await UserRepository.setHiddenFactionIds(userId, hiddenIds)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  function toggle(id: number) {
    setVisible((prev) => {
      const next = new Set(prev ?? [])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Modal
      title="Mis facciones"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !visible}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-ink-soft">
        Marca las facciones que quieres ver en <b>Hojas de Unidad</b> y <b>Ejércitos</b>. Las que desmarques se ocultan
        solo para ti. En modo administrador se ven todas.
      </p>

      {loading || !visible ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-3 flex gap-3 text-xs">
            <button
              onClick={() => setVisible(new Set((factions ?? []).map((f) => f.id)))}
              className="text-ink-soft hover:text-maroon"
            >
              Marcar todas
            </button>
            <button onClick={() => setVisible(new Set())} className="text-ink-soft hover:text-maroon">
              Desmarcar todas
            </button>
          </div>

          <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
            {(factions ?? []).map((f) => (
              <label
                key={f.id}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-sm text-ink hover:bg-parchment-dark/50"
              >
                <input
                  type="checkbox"
                  className="accent-maroon"
                  checked={visible.has(f.id)}
                  onChange={() => toggle(f.id)}
                />
                {f.name}
              </label>
            ))}
          </div>
        </>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Modal>
  )
}
