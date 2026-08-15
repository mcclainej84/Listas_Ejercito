import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArmyListRepository, type ArmyListSummary } from '@/data/repositories/armyListRepository'
import { ensureArmyListsOwned } from '@/data/repositories/catalogMaintenance'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession } from '@/shared/session/useSession'
import { useVisibleFactions } from '@/shared/session/useVisibleFactions'
import { useFavoriteFactionId } from '@/shared/session/useFavoriteFactionId'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { LockIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons'
import { Tooltip } from '@/shared/ui/Tooltip'
import { ArmyListFormModal } from '@/features/army-lists/ArmyListFormModal'
import { CompositionRulesModal } from '@/features/army-lists/CompositionRulesModal'
import { ShareArmyListModal } from '@/features/army-lists/ShareArmyListModal'

/**
 * "Mis ejércitos": listado de listas guardadas, con crear/renombrar/borrar y
 * abrir en el constructor. Sustituye al antiguo guardado/cargado como
 * fichero .json del "Hoja de Ejército" original — aquí todo vive en la BBDD
 * del navegador, igual que el resto de la app (ver ARCHITECTURE.md).
 */
export function ArmyListsPage() {
  const navigate = useNavigate()
  const { user } = useSession()
  const {
    data: lists,
    loading,
    error,
    reload,
  } = useAsync(async () => {
    if (!user) return []
    // Los ejércitos anteriores a los usuarios se asignan al usuario "admin".
    // Se hace aquí además de al arrancar porque ese usuario puede haberse
    // creado DESPUÉS del arranque, y este es el momento en que de verdad
    // importa que estén asignados.
    await ensureArmyListsOwned().catch(() => undefined)
    return ArmyListRepository.listAll(user.id)
  }, [user?.id])
  // Solo las facciones que el usuario quiere ver (en modo admin, todas).
  const { factions } = useVisibleFactions()
  const favoriteFactionId = useFavoriteFactionId()
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<ArmyListSummary | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null)
  const [editingComposition, setEditingComposition] = useState(false)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [sharing, setSharing] = useState<ArmyListSummary | null>(null)

  /**
   * Copia una lista con todas sus entradas y se queda en el listado (no abre
   * la copia): duplicar suele ser el paso previo a comparar variantes, y
   * saltar a una de ellas te sacaría de la vista donde estás decidiendo.
   *
   * El nombre lleva un contador —"(copia)", "(copia 2)"…— para no acabar con
   * tres listas llamadas igual, que es exactamente el lío que esta función
   * pretende evitar.
   */
  async function handleDuplicate(list: ArmyListSummary) {
    if (!user) return
    setDuplicatingId(list.id)
    setDuplicateError(null)
    try {
      const existing = new Set((lists ?? []).map((l) => l.name))
      let name = `${list.name} (copia)`
      for (let n = 2; existing.has(name); n++) name = `${list.name} (copia ${n})`
      await ArmyListRepository.duplicate(list.id, name, user.id)
      // `reload()` solo pide la recarga (devuelve void, no espera al fetch),
      // así que la copia aparece en el listado un instante después de que el
      // botón deje de decir "Copiando…". Es un parpadeo, no un fallo.
      reload()
    } catch (err) {
      setDuplicateError(err instanceof Error ? err.message : String(err))
    } finally {
      setDuplicatingId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Ejércitos"
        description="Tus listas de ejército guardadas: crea una nueva, retómala donde la dejaste o expórtala a PDF para llevarla a la partida."
        actions={
          <div className="flex items-center gap-2">
            {/* Configuración COMÚN a todos los ejércitos, de ahí que viva en el
                listado y no dentro de una lista concreta. */}
            <Button variant="secondary" onClick={() => setEditingComposition(true)}>
              Selección de puntos
            </Button>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <PlusIcon className="h-4 w-4" />
              Nueva lista
            </Button>
          </div>
        }
      />

      {loading && <Spinner />}
      {error && <p className="text-sm text-danger">{error}</p>}
      {duplicateError && <p className="mb-3 text-sm text-danger">No se pudo duplicar la lista: {duplicateError}</p>}

      {!loading && (lists ?? []).length === 0 && (
        <EmptyState
          title="Todavía no tienes ninguna lista"
          description='Crea la primera con "+ Nueva lista".'
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              <PlusIcon className="h-4 w-4" />
              Nueva lista
            </Button>
          }
        />
      )}

      {!loading && (lists ?? []).length > 0 && (
        <div className="divide-y divide-rule-dark/20 overflow-hidden rounded-sm border border-rule-dark/40 bg-parchment/70">
          {(lists ?? []).map((list) => (
            <div key={list.id} className="group flex items-center justify-between gap-4 px-4 py-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/ejercitos/${list.id}`)}>
                <p className="flex items-center gap-1.5 font-display text-lg font-semibold text-maroon">
                  {list.name}
                  {/* El candado, aquí y en la propia lista al abrirla: hay que
                      poder distinguir de un vistazo cuáles son tuyas antes de
                      entrar, no descubrirlo al intentar cambiar algo. */}
                  {list.shared && (
                    <Tooltip label="Compartida contigo: solo lectura" className="inline-flex text-ink-soft">
                      <LockIcon className="h-4 w-4" />
                    </Tooltip>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {list.factionName} · {list.entryCount} {list.entryCount === 1 ? 'entrada' : 'entradas'}
                  {list.pointsLimit != null && <> · límite {list.pointsLimit} pts</>}
                  {list.shared && list.ownerName && <> · de {list.ownerName}</>}
                </p>
              </button>
              {/* Duplicar, compartir y borrar son cosa del dueño. En una lista
                  compartida contigo no salen: no es que fallen, es que no
                  existen. */}
              {!list.shared && (
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    className="rounded-sm px-2 py-0.5 text-mini font-medium text-ink-soft hover:bg-bronze/10 hover:text-bronze"
                    onClick={() => setSharing(list)}
                    aria-label={`Compartir ${list.name}`}
                    title="Compartir esta lista con otros usuarios"
                  >
                    Compartir
                  </button>
                  <button
                    className="rounded-sm px-2 py-0.5 text-mini font-medium text-ink-soft hover:bg-bronze/10 hover:text-bronze disabled:cursor-wait disabled:opacity-50"
                    onClick={() => handleDuplicate(list)}
                    disabled={duplicatingId === list.id}
                    aria-label={`Duplicar ${list.name}`}
                    title="Duplicar esta lista"
                  >
                    {duplicatingId === list.id ? 'Copiando…' : 'Duplicar'}
                  </button>
                  <button
                    className="rounded-sm px-1.5 py-0.5 text-ink-soft hover:bg-maroon/10 hover:text-danger"
                    onClick={() => setDeleting(list)}
                    aria-label={`Borrar ${list.name}`}
                    title="Borrar"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {creating && (
        <ArmyListFormModal
          factions={factions ?? []}
          defaultFactionId={
            favoriteFactionId != null && (factions ?? []).some((f) => f.id === favoriteFactionId)
              ? favoriteFactionId
              : undefined
          }
          onClose={() => setCreating(false)}
          onCreate={async (input) => {
            if (!user) return
            const id = await ArmyListRepository.create({ ...input, userId: user.id })
            setCreating(false)
            navigate(`/ejercitos/${id}`)
          }}
        />
      )}

      {sharing && user && (
        <ShareArmyListModal
          armyListId={sharing.id}
          listName={sharing.name}
          ownerId={user.id}
          onClose={() => setSharing(null)}
          onSaved={() => setSharing(null)}
        />
      )}

      {editingComposition && <CompositionRulesModal onClose={() => setEditingComposition(false)} />}

      {deleting && (
        <ConfirmDialog
          title="Borrar lista"
          message={`Se borrará "${deleting.name}" con todas sus entradas. Esta acción no se puede deshacer.`}
          confirmLabel="Borrar definitivamente"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await ArmyListRepository.remove(deleting.id)
            setDeleting(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
