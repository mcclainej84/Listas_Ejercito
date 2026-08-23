// ============================================================================
// "Batallas": el listado de batallas guardadas. Crear y borrar; EDITAR NO.
//
// Una batalla creada no se toca. Es el acta de una partida acordada entre dos:
// cambiarle un ejército después es cambiar contra quién juega el otro sin que se
// entere, y el nombre no vale una pantalla. Si hay que rehacerla, se finaliza
// entre los dos, se borra y se monta otra — que es exactamente el camino que ya
// existe. Ver también BattlePage: dentro tampoco se edita nada.
//
// Una batalla son dos ejércitos completados enfrentados sobre la misma mesa.
// Aquí solo se administran; verla es entrar en ella (ver BattlePage), y dentro
// no se toca nada.
//
// EL LISTADO ES EL MISMO PARA TODOS. No se filtra por usuario: una batalla es
// de solo lectura y le interesa a los dos bandos, así que la ve y la administra
// cualquiera del grupo. Por eso el aviso de borrado dice que se la quita a
// todos: quien borra puede no ser quien la creó.
//
// Y JUSTO POR ESO EL BORRADO ESTÁ BAJO DOS LLAVES. Si cualquiera puede borrar y
// la batalla es de dos, cualquiera puede quitarle al otro el acta de la partida
// —el plan, el mapa, las dos listas— sin avisar. Aquí el botón no aparece hasta
// que los dos dueños la han dado por finalizada desde dentro (ver BattlePage);
// hasta entonces, en su sitio hay un candado que dice por quién falta. La
// comprobación de verdad está en BattleRepository.remove.
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
import { CheckIcon, LockIcon, PlusIcon, SwordIcon, TrashIcon } from '@/shared/ui/icons'
import { BattleFormModal } from '@/features/battles/BattleFormModal'
import { mensajeDeMigracionPendiente } from '@/data/repositories/schemaHealth'

/** Los nombres de los ejércitos cuyo dueño todavía no ha firmado. */
function quienFalta(b: BattleSummary): string {
  const faltan = [!b.finalizadaA ? b.nombreA : null, !b.finalizadaB ? b.nombreB : null].filter(
    (n): n is string => n != null,
  )
  return faltan.length === 2 ? `los dueños de ${faltan[0]} y ${faltan[1]}` : `el dueño de ${faltan[0]}`
}

/**
 * En qué punto está la batalla: sin firmas no se dice nada —es el caso normal y
 * un rótulo por batalla sería ruido—, con una se dice que falta la otra, y con
 * las dos se sella.
 */
function SelloDeFinalizada({ batalla }: { batalla: BattleSummary }) {
  const firmas = (batalla.finalizadaA ? 1 : 0) + (batalla.finalizadaB ? 1 : 0)
  if (firmas === 0) return null
  if (firmas === 1) {
    return (
      <span
        className="shrink-0 rounded-sm border border-bronze/45 bg-bronze/10 px-1.5 py-0.5 text-micro whitespace-nowrap text-bronze"
        title={`Falta que ${quienFalta(batalla)} la dé por finalizada.`}
      >
        1 de 2 finalizada
      </span>
    )
  }
  return (
    <span
      className="flex shrink-0 items-center gap-1 rounded-sm border border-success/50 bg-success/10 px-1.5 py-0.5 text-micro whitespace-nowrap text-success"
      title="Los dos jugadores la han dado por terminada: ya se puede borrar."
    >
      <CheckIcon className="h-3 w-3" />
      Finalizada
    </span>
  )
}

export function BattlesListPage() {
  const navigate = useNavigate()
  const { user } = useSession()
  const { data: batallas, loading, error, reload } = useAsync(() => BattleRepository.listAll(), [])

  const [creando, setCreando] = useState(false)
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

              {/* El sello de finalizada va SIEMPRE visible, no al pasar el ratón:
                  es el estado de la batalla, no una acción sobre ella. */}
              <SelloDeFinalizada batalla={b} />

              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {b.finalizadaA && b.finalizadaB ? (
                  <button
                    className="rounded-sm p-1.5 text-ink-soft hover:bg-maroon/10 hover:text-danger"
                    onClick={() => setBorrando(b)}
                    aria-label={`Borrar ${b.name}`}
                    title="Borrar esta batalla"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                ) : (
                  // Candado y no papelera desactivada: una papelera en gris se
                  // lee como "no tienes permiso", y no es eso — es que la
                  // partida sigue viva. El title dice por quién falta.
                  <span
                    className="cursor-not-allowed rounded-sm p-1.5 text-ink-soft/35"
                    title={`No se puede borrar todavía: falta que ${quienFalta(b)} den la batalla por finalizada, desde dentro de ella.`}
                  >
                    <LockIcon className="h-4 w-4" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {creando && (
        <BattleFormModal
          userId={user.id}
          onClose={() => setCreando(false)}
          onSaved={() => {
            setCreando(false)
            reload()
          }}
        />
      )}

      {borrando && (
        <ConfirmDialog
          title="Borrar batalla"
          message={
            `Los dos jugadores han dado "${borrando.name}" por finalizada, así que ya se puede borrar. Desaparece ` +
            'para todo el grupo y no se puede recuperar. Se borra solo la batalla: los dos ejércitos y sus ' +
            'despliegues se quedan como están, y vuelven a poder reabrirse.'
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
