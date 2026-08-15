// ============================================================================
// "Mapas" — el listado: crear, abrir, renombrar y borrar mesas con
// escenografía.
//
// Cada tarjeta lleva una MINIATURA del mapa de verdad, dibujada con las mismas
// piezas y a escala: un listado de nombres no dice nada cuando tienes seis
// mesas, y la forma del terreno es justo lo que se recuerda de cada una.
//
// LOS MAPAS SON COMUNES: aquí salen los de todo el mundo, y cualquiera puede
// abrirlos, editarlos, cargarlos en su despliegue y borrarlos. El nombre del
// autor se sigue enseñando, pero solo como dato: no da derechos.
//
// Un mapa se puede OCULTAR (el ojo tachado): entonces desaparece del listado de
// todos menos del de su autor. Está para tener uno a medias sin que le estorbe
// a nadie, no para cerrarlo con llave.
// ============================================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapRepository } from '@/data/repositories/mapRepository'
import { MESA_ALTO_CM, MESA_ANCHO_CM } from '@/domain/deployment'
import type { MapaResumen } from '@/domain/scenery'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession } from '@/shared/session/useSession'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Modal } from '@/shared/ui/Modal'
import { EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons'
import { MapThumbnail } from '@/features/maps/MapThumbnail'

export function MapsListPage() {
  const navigate = useNavigate()
  const { user } = useSession()
  const { data: mapas, loading, reload } = useAsync(() => MapRepository.listAll(user?.id ?? null), [user?.id])

  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [borrando, setBorrando] = useState<MapaResumen | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function alternarOculto(mapa: MapaResumen) {
    try {
      await MapRepository.setHidden(mapa.id, !mapa.hidden)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function crear() {
    if (!user || !nombre.trim()) return
    try {
      const id = await MapRepository.create({ name: nombre, anchoCm: MESA_ANCHO_CM, altoCm: MESA_ALTO_CM }, user.id)
      setCreando(false)
      setNombre('')
      navigate(`/mapas/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div>
      <PageHeader
        title="Mapas"
        description="Mesas con escenografía, listas para preparar una partida."
        actions={
          <Button variant="primary" onClick={() => setCreando(true)}>
            <PlusIcon className="h-4 w-4" />
            Nuevo mapa
          </Button>
        }
      />

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {loading && <Spinner />}

      {!loading && (mapas ?? []).length === 0 && (
        <EmptyState
          title="Todavía no hay ningún mapa"
          description="Los mapas son comunes: el que hagas lo verá y lo podrá usar todo el mundo."
          action={
            <Button variant="primary" onClick={() => setCreando(true)}>
              <PlusIcon className="h-4 w-4" />
              Nuevo mapa
            </Button>
          }
        />
      )}

      {!loading && (mapas ?? []).length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(mapas ?? []).map((mapa) => (
            <li key={mapa.id} className="group relative">
              <button
                onClick={() => navigate(`/mapas/${mapa.id}`)}
                className="w-full overflow-hidden rounded-sm border border-rule-dark/40 bg-parchment/70 text-left transition-colors hover:border-bronze"
              >
                <MapThumbnail mapaId={mapa.id} anchoCm={mapa.anchoCm} altoCm={mapa.altoCm} />
                <span className="block border-t border-rule-dark/25 px-3 py-2">
                  <span className="block truncate font-display text-lg leading-tight text-maroon">{mapa.name}</span>
                  <span className="mt-0.5 block text-xs text-ink-soft tabular-nums">
                    {mapa.anchoCm} × {mapa.altoCm} cm · {mapa.piezas} {mapa.piezas === 1 ? 'elemento' : 'elementos'}
                    {mapa.userId !== user?.id && mapa.ownerName && (
                      <span className="text-ink-soft/70"> · de {mapa.ownerName}</span>
                    )}
                  </span>
                </span>
              </button>

              {/* Oculto: se avisa SIEMPRE, no solo al pasar el ratón. Es el
                  único estado que explica por qué los demás no ven este mapa. */}
              {mapa.hidden && (
                <span
                  className="pointer-events-none absolute top-2 left-2 flex items-center gap-1 rounded-sm bg-ink/75 px-1.5 py-0.5 text-mini font-medium text-parchment"
                  title="Solo lo ves tú"
                >
                  <EyeOffIcon className="h-3 w-3" />
                  Oculto
                </span>
              )}

              {/* Las acciones asoman al pasar por encima: la tarjeta es una
                  miniatura del mapa, y tres botones fijos encima la tapan. */}
              <span className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                {/* Ocultar solo tiene sentido en los propios: un mapa oculto lo
                    ve su autor, así que ocultar el de otro sería quitárselo de
                    en medio a todos menos a él. */}
                {mapa.userId === user?.id && (
                  <button
                    onClick={() => void alternarOculto(mapa)}
                    aria-label={mapa.hidden ? `Mostrar ${mapa.name} a todos` : `Ocultar ${mapa.name}`}
                    title={mapa.hidden ? 'Mostrar a todos' : 'Ocultar: solo lo verás tú'}
                    className="rounded-sm bg-parchment/90 p-1.5 text-ink-soft transition-colors hover:text-maroon"
                  >
                    {mapa.hidden ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeOffIcon className="h-3.5 w-3.5" />}
                  </button>
                )}
                <button
                  onClick={() => setBorrando(mapa)}
                  aria-label={`Borrar ${mapa.name}`}
                  title="Borrar"
                  className="rounded-sm bg-parchment/90 p-1.5 text-ink-soft transition-colors hover:text-danger"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {creando && (
        <Modal
          title="Nuevo mapa"
          widthClassName="max-w-sm"
          onClose={() => setCreando(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreando(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={crear} disabled={!nombre.trim()}>
                Crear y abrir
              </Button>
            </>
          }
        >
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">Nombre</span>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void crear()
              }}
              placeholder="p.ej. Vado del Reik"
              className="w-full rounded-sm border border-rule-dark/40 bg-parchment px-2 py-1.5 text-sm text-ink outline-none focus:border-bronze"
            />
          </label>
          {/* La mesa nace de 180 × 120 y se ajusta dentro, con las barras: no
              hace falta decidirlo antes de haber visto nada. */}
        </Modal>
      )}

      {borrando && (
        <ConfirmDialog
          title="Borrar mapa"
          message={
            `Se borrará "${borrando.name}" con toda su escenografía, y los mapas son comunes: ` +
            'desaparece para todo el mundo. No se puede deshacer.'
          }
          confirmLabel="Borrar definitivamente"
          onCancel={() => setBorrando(null)}
          onConfirm={async () => {
            await MapRepository.remove(borrando.id)
            setBorrando(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
