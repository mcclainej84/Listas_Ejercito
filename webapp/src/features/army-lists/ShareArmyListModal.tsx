// ============================================================================
// "Compartir" un ejército con otros usuarios.
//
// Compartir da acceso de SOLO LECTURA: el destinatario ve la lista en su
// sección de Ejércitos, la puede abrir y exportar, pero no tocar. Un ejército
// tiene un dueño y uno solo (army_lists.user_id) — si dos personas pudieran
// editar la misma lista, el borrador local de cada una pisaría el de la otra
// al guardar, sin forma de saber cuál era la buena.
//
// Solo lo abre el dueño: en una lista compartida contigo este botón no sale.
// ============================================================================
import { useEffect, useState } from 'react'
import { ArmyListRepository } from '@/data/repositories/armyListRepository'
import { UserRepository } from '@/data/repositories/userRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'

export function ShareArmyListModal({
  armyListId,
  listName,
  ownerId,
  onClose,
  onSaved,
}: {
  armyListId: number
  listName: string
  ownerId: number
  onClose: () => void
  onSaved: () => void
}) {
  const { data: users, loading: loadingUsers } = useAsync(() => UserRepository.listAll())
  const { data: compartidos } = useAsync(() => ArmyListRepository.getShareUserIds(armyListId), [armyListId])

  const [selected, setSelected] = useState<Set<number> | null>(null)
  useEffect(() => {
    if (compartidos) setSelected(new Set(compartidos))
  }, [compartidos])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // El dueño no se comparte la lista consigo mismo: ya la tiene, y aparecer en
  // su propia lista de destinatarios solo invita a marcarse por error.
  const destinatarios = (users ?? []).filter((u) => u.id !== ownerId)

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev ?? [])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await ArmyListRepository.setShareUserIds(armyListId, [...selected])
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Compartir — ${listName}`}
      widthClassName="max-w-md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !selected}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      {loadingUsers || !selected ? (
        <Spinner />
      ) : destinatarios.length === 0 ? (
        <p className="text-xs italic text-ink-soft">No hay otros usuarios con los que compartir.</p>
      ) : (
        <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
          {destinatarios.map((u) => (
            <label
              key={u.id}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-ink hover:bg-parchment-dark/50"
            >
              <input
                type="checkbox"
                className="accent-maroon"
                checked={selected.has(u.id)}
                onChange={() => toggle(u.id)}
              />
              {u.username}
            </label>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Modal>
  )
}
