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
import { TrashIcon } from '@/shared/ui/icons'
import { ArmyListFormModal } from '@/features/army-lists/ArmyListFormModal'

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

  return (
    <div>
      <PageHeader
        title="Ejércitos"
        description="Tus listas de ejército guardadas: crea una nueva, retómala donde la dejaste o expórtala a PDF para llevarla a la partida."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            + Nueva lista
          </Button>
        }
      />

      {loading && <Spinner />}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && (lists ?? []).length === 0 && (
        <EmptyState
          title="Todavía no tienes ninguna lista"
          description='Crea la primera con "+ Nueva lista".'
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              + Nueva lista
            </Button>
          }
        />
      )}

      {!loading && (lists ?? []).length > 0 && (
        <div className="divide-y divide-rule-dark/20 overflow-hidden rounded-sm border border-rule-dark/40 bg-parchment/70">
          {(lists ?? []).map((list) => (
            <div key={list.id} className="group flex items-center justify-between gap-4 px-4 py-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/ejercitos/${list.id}`)}>
                <p className="font-display text-lg font-semibold text-maroon">{list.name}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {list.factionName} · {list.entryCount} {list.entryCount === 1 ? 'entrada' : 'entradas'}
                  {list.pointsLimit != null && <> · límite {list.pointsLimit} pts</>}
                </p>
              </button>
              <button
                className="shrink-0 rounded-sm px-1.5 py-0.5 text-ink-soft opacity-0 transition-opacity hover:bg-maroon/10 hover:text-danger group-hover:opacity-100"
                onClick={() => setDeleting(list)}
                aria-label={`Borrar ${list.name}`}
                title="Borrar"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
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
