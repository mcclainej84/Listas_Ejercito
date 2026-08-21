// ============================================================================
// "Batallas": el listado de batallas guardadas, con crear, editar y borrar.
//
// Una batalla son dos ejércitos completados enfrentados sobre la misma mesa.
// Aquí solo se administran; verla es entrar en ella (ver BattlePage), y dentro
// no se toca nada.
//
// EL LISTADO ES EL MISMO PARA TODOS. No se filtra por usuario: una batalla es
// de solo lectura y le interesa a los dos bandos, así que la ve y la administra
// cualquiera del grupo. Por eso el aviso de borrado dice que se la quita a
// todos: quien borra puede no ser quien la creó.
// ============================================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BattleRepository, type BattleSummary } from '@/data/repositories/battleRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession } from '@/shared/session/useSession'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { PencilIcon, PlusIcon, SwordIcon, TrashIcon } from '@/shared/ui/icons'
import { BattleFormModal } from '@/features/battles/BattleFormModal'
import { mensajeDeMigracionPendiente } from '@/data/repositories/schemaHealth'

export function BattlesListPage() {
  const navigate = useNavigate()
  const { user } = useSession()
  const { data: batallas, loading, error, reload } = useAsync(() => BattleRepository.listAll(), [])

  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<BattleSummary | null>(null)
  const [borrando, setBorrando] = useState<BattleSummary | null>(null)

  if (!user) return null

  const lista = batallas ?? []

  return (
    <div>
      <PageHeader
        title="Batallas"
        description="Dos ejércitos completados, enfrentados sobre la misma mesa: los dos despliegues cara a cara, las dos listas y los PDF para llevar a la partida. Las batallas las ve todo el grupo."
        actions={
          <Button variant="primary" onClick={() => setCreando(true)}>
            <PlusIcon className="h-4 w-4" />
            Nueva batalla
          </Button>
        }
      />

      {loading && <Spinner />}
      {/* Un "no such table" aquí significa que falta desplegar el Worker, y el
          mensaje lo dice con el comando en vez de soltar el error de D1. */}
      {error && (
        <p className="mb-3 rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-ink">
          <b className="text-danger">No se pudieron cargar las batallas.</b>{' '}
          {mensajeDeMigracionPendiente(error) ?? error}
        </p>
      )}

      {!loading && !error && lista.length === 0 && (
        <EmptyState
          title="Todavía no hay ninguna batalla"
          description="Necesitas dos ejércitos marcados como completados. Con eso, se enfrentan sobre la mesa de uno de ellos."
          action={
            <Button variant="primary" onClick={() => setCreando(true)}>
              <PlusIcon className="h-4 w-4" />
              Nueva batalla
            </Button>
          }
        />
      )}

      {lista.length > 0 && (
        <div className="divide-y divide-rule-dark/20 overflow-hidden rounded-sm border border-rule-dark/40 bg-parchment/70">
          {lista.map((b) => (
            <div key={b.id} className="group flex items-center justify-between gap-4 px-4 py-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/batallas/${b.id}`)}>
                <p className="flex items-center gap-2 font-display text-lg font-semibold text-maroon">
                  <SwordIcon className="h-4 w-4 shrink-0 text-bronze" />
                  {b.name}
                </p>
                {/* Los dos bandos en la línea de debajo y en el mismo orden que
                    en la mesa: el de abajo primero. */}
                <p className="mt-0.5 text-xs text-ink-soft">
                  <span className="text-ink">{b.nombreA}</span> <span className="text-ink-soft/60">({b.faccionA})</span>
                  <span className="mx-1.5 text-rule-dark/60">contra</span>
                  <span className="text-ink">{b.nombreB}</span> <span className="text-ink-soft/60">({b.faccionB})</span>
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  className="rounded-sm p-1.5 text-ink-soft hover:bg-bronze/15 hover:text-bronze"
                  onClick={() => setEditando(b)}
                  aria-label={`Editar ${b.name}`}
                  title="Cambiarle el nombre o los ejércitos"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  className="rounded-sm p-1.5 text-ink-soft hover:bg-maroon/10 hover:text-danger"
                  onClick={() => setBorrando(b)}
                  aria-label={`Borrar ${b.name}`}
                  title="Borrar esta batalla"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creando || editando) && (
        <BattleFormModal
          userId={user.id}
          batalla={editando}
          onClose={() => {
            setCreando(false)
            setEditando(null)
          }}
          onSaved={() => {
            setCreando(false)
            setEditando(null)
            reload()
          }}
        />
      )}

      {borrando && (
        <ConfirmDialog
          title="Borrar batalla"
          message={
            `¿Seguro que quieres borrar "${borrando.name}"? Las batallas son de todos, así que desaparece ` +
            'también para los demás jugadores, la creara quien la creara. Se borra solo la batalla: los dos ' +
            'ejércitos y sus despliegues se quedan como están, y vuelven a poder reabrirse.'
          }
          confirmLabel="Borrar"
          onCancel={() => setBorrando(null)}
          onConfirm={async () => {
            await BattleRepository.remove(borrando.id)
            setBorrando(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
