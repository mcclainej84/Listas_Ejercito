// ============================================================================
// "Compartir" un ejército con otros usuarios.
//
// Compartir da acceso de SOLO LECTURA: el destinatario ve la lista en su
// sección de Ejércitos, la puede abrir y exportar, pero no tocar. Un ejército
// tiene un dueño y uno solo (army_lists.user_id) — si dos personas pudieran
// editar la misma lista, el borrador local de cada una pisaría el de la otra
// al guardar, sin forma de saber cuál era la buena.
//
// EL DESPLIEGUE VA APARTE, y por persona. Enseñarle el ejército a un rival
// para que lo revise antes de la partida no debería enseñarle dónde vas a
// colocar; a un compañero de equipo sí. Por eso son dos casillas y no una, y
// la del despliegue nace APAGADA: lo que se comparte sin querer no se puede
// des-ver.
//
// Solo lo abre el dueño: en una lista compartida contigo este botón no sale.
// ============================================================================
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { ArmyListRepository, type ArmyListShare } from '@/data/repositories/armyListRepository'
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
  const { data: compartidos } = useAsync(() => ArmyListRepository.getShares(armyListId), [armyListId])

  /** Por id de usuario: null = todavía cargando. Sin clave = no compartida con él. */
  const [selected, setSelected] = useState<Map<number, ArmyListShare> | null>(null)
  useEffect(() => {
    if (compartidos) setSelected(new Map(compartidos.map((c) => [c.userId, c])))
  }, [compartidos])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // El dueño no se comparte la lista consigo mismo: ya la tiene, y aparecer en
  // su propia lista de destinatarios solo invita a marcarse por error.
  const destinatarios = (users ?? []).filter((u) => u.id !== ownerId)

  function toggleCompartir(id: number) {
    setSelected((prev) => {
      const next = new Map(prev ?? [])
      if (next.has(id)) next.delete(id)
      // Al compartir de nuevo se empieza SIN despliegue, aunque antes lo
      // tuviera: quitar y volver a poner es la forma natural de "empezar de
      // cero" con alguien.
      else next.set(id, { userId: id, shareDeployment: false })
      return next
    })
  }

  function toggleDespliegue(id: number) {
    setSelected((prev) => {
      const next = new Map(prev ?? [])
      const actual = next.get(id)
      if (!actual) return next
      next.set(id, { ...actual, shareDeployment: !actual.shareDeployment })
      return next
    })
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await ArmyListRepository.setShares(armyListId, [...selected.values()])
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
        <div className="max-h-[50vh] overflow-y-auto pr-1">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-ink-soft">
                <th className="border-b border-rule-dark/30 px-2 py-1 text-left text-xs font-semibold">Usuario</th>
                <th className="w-24 border-b border-rule-dark/30 px-2 py-1 text-center text-xs font-semibold">
                  Ejército
                </th>
                <th className="w-24 border-b border-rule-dark/30 px-2 py-1 text-center text-xs font-semibold">
                  Despliegue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule-dark/15">
              {destinatarios.map((u) => {
                const share = selected.get(u.id)
                return (
                  <tr key={u.id} className={clsx(!share && 'opacity-70')}>
                    <td className="px-2 py-1.5 text-ink">{u.username}</td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        className="accent-maroon"
                        checked={share != null}
                        onChange={() => toggleCompartir(u.id)}
                        aria-label={`Compartir el ejército con ${u.username}`}
                      />
                    </td>
                    {/* Sin el ejército no hay despliegue que enseñar, así que
                        la segunda casilla solo se activa con la primera. */}
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        className="accent-maroon disabled:opacity-40"
                        disabled={share == null}
                        checked={share?.shareDeployment ?? false}
                        onChange={() => toggleDespliegue(u.id)}
                        aria-label={`Compartir el despliegue con ${u.username}`}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Modal>
  )
}
