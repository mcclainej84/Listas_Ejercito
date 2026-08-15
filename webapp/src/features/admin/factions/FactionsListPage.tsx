// ============================================================================
// "Facciones" — rejilla de LÁMINAS, no de fichas con un icono.
//
// El giro de diseño está en darse cuenta de qué son las imágenes de facción:
// no son logotipos recortados sino ILUSTRACIONES cuadradas de 480×480, escenas
// completas (ver FactionEmblem). Se estaban enseñando en un cuadradito de
// 56 px, o sea tirando el 99% de la imagen. Aquí la ilustración pasa a ser el
// contenido —ocupa la tarjeta de borde a borde— y el nombre baja a una
// CARTELA de pergamino debajo, como las láminas de un bestiario ilustrado.
//
// La rejilla sube hasta 4 columnas y, en pantallas anchas, 5: con el
// contenedor de la app (max-w-4xl) eso deja láminas de ~215 px y ~170 px
// respectivamente. Siguen siendo 3-4 veces la imagen de antes, pero se ve la
// colección entera de un vistazo en vez de tres facciones por pantallazo, que
// es lo que se pide de una pantalla de índice.
//
// Los tamaños de la cartela (nombre, filete, recuento) están calibrados para
// el ancho MENOR de esos dos: si el nombre no cabe en la lámina de 170 px,
// parte la cartela en dos líneas y descuadra la fila entera.
// ============================================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FactionRepository, type FactionWithCounts } from '@/data/repositories/factionRepository'
import { UserRepository } from '@/data/repositories/userRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession } from '@/shared/session/useSession'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { PlusIcon, StarIcon, TrashIcon } from '@/shared/ui/icons'
import { FactionFormModal } from '@/features/admin/factions/FactionFormModal'
import type { Faction } from '@/domain/types'

/** "24 unidades · 6 personajes", o el aviso de que la facción está vacía. */
function factionSummary(faction: FactionWithCounts): string {
  if (faction.unitCount === 0) return 'Sin unidades todavía'
  const units = `${faction.unitCount} ${faction.unitCount === 1 ? 'unidad' : 'unidades'}`
  if (faction.characterCount === 0) return units
  return `${units} · ${faction.characterCount} ${faction.characterCount === 1 ? 'personaje' : 'personajes'}`
}

/**
 * Marco de la ilustración. La viñeta interior es la misma idea que en
 * FactionEmblem: sin ella el recorte queda "a cuchillo" sobre el pergamino.
 * A este tamaño hace aún más falta, así que se refuerza un poco y se remata
 * con un degradado bajo, que asienta la imagen sobre la cartela.
 *
 * La lámina es CUADRADA a propósito, igual que el original de 480×480: así la
 * escena entra entera. Se probó a bajarla a 5:4 para hacerle sitio al rótulo
 * grande y fue un error — con `object-cover`, reducir el alto no encoge la
 * ilustración, la RECORTA por arriba y por abajo. El rótulo grande sale de
 * hacer la tarjeta algo más alta, que no le cuesta nada a la imagen.
 */
function FactionPlate({ faction }: { faction: FactionWithCounts }) {
  return (
    <span className="relative block aspect-square overflow-hidden bg-parchment-dark">
      {faction.emblemUrl ? (
        <img
          src={faction.emblemUrl}
          alt=""
          /* `scale` mínimo al pasar el ratón: la lámina "respira" sin que el
             movimiento distraiga de una rejilla que puede tener 20 imágenes. */
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      ) : (
        // Sin emblema, la inicial en tipografía de display: sigue siendo una
        // lámina, no un hueco roto.
        <span className="flex h-full w-full items-center justify-center font-display text-5xl font-bold text-ink-soft/25">
          {faction.name.charAt(0).toUpperCase()}
        </span>
      )}
      {/* La viñeta se mide en px, así que acompaña al tamaño de la lámina: a
          ~215 px, los 26 px de antes se comían el borde de la escena. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: 'inset 0 0 18px rgba(20,14,6,0.32)' }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
        style={{ background: 'linear-gradient(to top, rgba(20,14,6,0.2), transparent)' }}
      />
    </span>
  )
}

export function FactionsListPage() {
  const navigate = useNavigate()
  const { user } = useSession()
  const { data: factions, loading, error, reload } = useAsync(() => FactionRepository.listAllWithCounts())
  const [editing, setEditing] = useState<Faction | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Faction | null>(null)

  // Facción favorita del usuario: se preselecciona en todas las pantallas con
  // selector de facción. Se marca/desmarca dentro de "Editar" (ver
  // FactionFormModal); aquí solo se lee, para pintar la estrella de la
  // favorita sobre su lámina.
  const { data: favoriteId, reload: reloadFavorite } = useAsync(
    () => (user ? UserRepository.getFavoriteFactionId(user.id) : Promise.resolve(null)),
    [user],
  )

  const sorted = factions ?? []

  return (
    <div>
      <PageHeader
        title="Facciones"
        description="Ejércitos disponibles. Cada facción agrupa sus propias unidades, personajes y restricciones."
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <PlusIcon className="h-4 w-4" />
            Nueva facción
          </Button>
        }
      />

      {loading && <Spinner />}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && sorted.length === 0 && (
        <EmptyState
          title="Todavía no hay facciones"
          description="Crea la primera facción para empezar a añadir unidades."
          action={
            <Button variant="primary" onClick={() => setEditing('new')}>
              <PlusIcon className="h-4 w-4" />
              Nueva facción
            </Button>
          }
        />
      )}

      {!loading && sorted.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {sorted.map((faction) => (
            <article
              key={faction.id}
              className="group relative overflow-hidden rounded-sm border border-rule-dark/40 bg-parchment shadow-sm shadow-black/10 transition-all duration-300 hover:-translate-y-0.5 hover:border-rule-dark/70 hover:shadow-md hover:shadow-black/20"
            >
              {/* Toda la lámina es el enlace a sus unidades: el objetivo de
                  clic es la tarjeta entera, no un "Ver unidades →" de 90 px. */}
              <button
                className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze/60 focus-visible:ring-inset"
                onClick={() => navigate(`/admin/unidades?faccion=${faction.id}`)}
                aria-label={`Ver las unidades de ${faction.name}`}
              >
                <FactionPlate faction={faction} />

                {/* Cartela: el nombre, el filete de la casa y el recuento. */}
                <span className="block border-t border-rule-dark/30 px-2.5 py-2">
                  {/* Sin alto fijo: reservar dos líneas siempre dejaba una
                      línea vacía —un hueco muy visible— en los nombres cortos,
                      que son la mayoría. Los largos siguen pudiendo ocupar dos
                      líneas (line-clamp-2) y, como la rejilla estira todas las
                      tarjetas de una fila a la misma altura, la fila no se
                      descuadra por ello. */}
                  <span className="line-clamp-2 font-display text-lg leading-[1.2] font-bold text-ink transition-colors group-hover:text-maroon">
                    {faction.name}
                  </span>
                  <span className="my-1 block h-px bg-rule-dark/35" />
                  <span
                    className={`block truncate text-micro ${faction.unitCount === 0 ? 'text-ink-soft/70 italic' : 'text-ink-soft'}`}
                  >
                    {factionSummary(faction)}
                  </span>
                </span>
              </button>

              {/* La estrella de favorita: solo un DISTINTIVO pasivo (no se
                  puede pulsar aquí) para reconocer de un vistazo cuál es. La
                  acción de marcar/desmarcar y la de elegir reglas destacadas
                  viven ahora dentro de "Editar" (ver FactionFormModal), en
                  vez de como botones sueltos sobre la lámina. */}
              {favoriteId === faction.id && (
                <span
                  aria-hidden
                  className="absolute top-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-sm border border-rule-dark/40 bg-parchment/95 text-bronze shadow-sm backdrop-blur-sm"
                  title="Favorita"
                >
                  <StarIcon className="h-3.5 w-3.5" filled />
                </span>
              )}

              {/* Editar/Borrar flotan sobre la ilustración y solo aparecen al
                  acercarse. Son HERMANOS del botón de la lámina, nunca hijos:
                  un <button> dentro de otro es HTML inválido y el navegador
                  reordena el marcado por su cuenta.
                  `focus-within` los hace alcanzables con el teclado, que si no
                  quedarían invisibles para quien no usa ratón. */}
              <div className="absolute top-1.5 right-1.5 flex h-6 items-stretch gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
                <button
                  className="flex items-center rounded-sm border border-rule-dark/40 bg-parchment/95 px-2 text-mini font-medium whitespace-nowrap text-ink-soft shadow-sm backdrop-blur-sm transition-colors hover:bg-parchment hover:text-maroon"
                  onClick={() => setEditing(faction)}
                >
                  Editar
                </button>
                <button
                  className="flex w-6 items-center justify-center rounded-sm border border-rule-dark/40 bg-parchment/95 text-ink-soft shadow-sm backdrop-blur-sm transition-colors hover:bg-danger/10 hover:text-danger"
                  onClick={() => setDeleting(faction)}
                  aria-label={`Borrar ${faction.name}`}
                  title="Borrar"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <FactionFormModal
          faction={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
            reloadFavorite()
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Borrar facción"
          message={`Se borrará "${deleting.name}" y TODAS sus unidades y personajes. Esta acción no se puede deshacer.`}
          confirmLabel="Borrar definitivamente"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await FactionRepository.remove(deleting.id)
            setDeleting(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
