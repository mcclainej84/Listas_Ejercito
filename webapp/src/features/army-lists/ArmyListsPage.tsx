import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { ArmyListRepository, type ArmyListSummary } from '@/data/repositories/armyListRepository'
import { BattleRepository } from '@/data/repositories/battleRepository'
import { ensureArmyListsOwned } from '@/data/repositories/catalogMaintenance'
import { mensajeDeMigracionPendiente } from '@/data/repositories/schemaHealth'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession } from '@/shared/session/useSession'
import { useVisibleFactions } from '@/shared/session/useVisibleFactions'
import { useFavoriteFactionId } from '@/shared/session/useFavoriteFactionId'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { CheckIcon, LockIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons'
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
  const [cerrandoId, setCerrandoId] = useState<number | null>(null)
  // Qué listas están metidas en alguna batalla. No se pueden reabrir (lo impide
  // ArmyListRepository.setReady); esto es solo para poder DECIRLO antes, en vez
  // de dejar que el usuario pulse el sello y se coma un error.
  const { data: enBatalla } = useAsync(() => BattleRepository.idsDeListasEnBatalla(), [])
  const [readyError, setReadyError] = useState<string | null>(null)

  /**
   * Marca o desmarca una lista como TERMINADA. Cerrada, el constructor se abre
   * en solo lectura.
   *
   * Se puede abrir y cerrar las veces que haga falta: no es un permiso ni un
   * camino de ida, es el pestillo que evita el manotazo sobre una lista dada por
   * buena. Por eso el interruptor está aquí, a la vista en el listado, y no
   * escondido dentro de un menú de la propia lista.
   */
  async function alternarListo(list: ArmyListSummary, ready: boolean) {
    setCerrandoId(list.id)
    setReadyError(null)
    try {
      await ArmyListRepository.setReady(list.id, ready)
      reload()
    } catch (err) {
      // Si lo que falla es que la columna no existe todavía, se dice qué hacer
      // en vez de soltar el error crudo de D1, que es exacto y no sirve de nada.
      setReadyError(mensajeDeMigracionPendiente(err) ?? (err instanceof Error ? err.message : String(err)))
    } finally {
      setCerrandoId(null)
    }
  }

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
      {readyError && (
        <p className="mb-3 rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-ink">
          <b className="text-danger">No se pudo cambiar el estado de la lista.</b> {readyError}
        </p>
      )}

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
            <div
              key={list.id}
              className={clsx(
                'group flex items-center justify-between gap-4 px-4 py-3 transition-colors',
                list.ready && !list.shared && 'bg-maroon/[0.04]',
              )}
            >
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
              {/* EL SELLO. Va al final de la fila y no pegado al nombre: los
                  nombres miden lo que miden, así que ahí el sello bailaría de una
                  fila a otra; al final forman una columna y el estado del montón
                  se lee de arriba abajo de una pasada.

                  Y va SIEMPRE visible, no escondido tras el hover como duplicar
                  o borrar: aquello son acciones de mantenimiento y esto es el
                  estado de la lista. Es el mismo gesto tipográfico que los
                  rótulos del Despliegue —versalita espaciada— porque es lo que en
                  este programa significa "esto es una etiqueta, no un botón
                  más". En una lista compartida no sale: cerrar la de otro no es
                  cosa tuya. */}
              {!list.shared && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={list.ready}
                  disabled={cerrandoId === list.id || (enBatalla?.has(list.id) ?? false)}
                  onClick={() => alternarListo(list, !list.ready)}
                  title={
                    enBatalla?.has(list.id)
                      ? 'Está en una batalla, así que no se puede reabrir: lo que la batalla enseña no puede cambiar. Borra la batalla o cámbiale el ejército.'
                      : list.ready
                        ? 'Completada: la lista y su despliegue se abren en solo lectura. Pulsa para volver a editarlos.'
                        : 'Márcala cuando esté completada: se cerrará a cambios —la lista y su despliegue— hasta que la desmarques.'
                  }
                  className={clsx(
                    // Ancho FIJO: sin fijarlo los sellos quedaban escalonados de
                    // una fila a otra en vez de formar columna, que es justo lo
                    // que se venía a arreglar.
                    'flex w-32 shrink-0 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase transition-colors disabled:opacity-50',
                    list.ready
                      ? 'border border-maroon/45 bg-maroon/10 text-maroon hover:bg-maroon/15'
                      : 'border border-dashed border-rule-dark/35 text-ink-soft/45 hover:border-bronze/60 hover:text-bronze',
                  )}
                >
                  {/* EL MISMO RÓTULO EN LOS DOS ESTADOS. Un interruptor no se
                      cambia de nombre según esté encendido o apagado: lo que
                      dice es de QUÉ trata, y si está puesto o no lo dicen el
                      sello frente al contorno de trazos, el candado frente al
                      visto, y `aria-checked` para quien no ve ninguno de los
                      dos. */}
                  {list.ready ? <LockIcon className="h-3 w-3" /> : <CheckIcon className="h-3 w-3" />}
                  Completado
                </button>
              )}

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
