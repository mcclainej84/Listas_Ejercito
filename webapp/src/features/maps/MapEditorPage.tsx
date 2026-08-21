// ============================================================================
// Editor de un mapa: la mesa con su escenografía, vista desde arriba.
//
// Es hermana de la pantalla de Despliegue y usa su mismo lenguaje: la ventana
// entera en tres columnas, mesa a escala con reglas graduadas y limitada
// también por alto para caber en 1080p, centímetros reales de mesa (nunca
// píxeles), y edición en memoria que se persiste con "Guardar mapa".
// Comparten además las funciones de domain/deployment —limitarAMesa, acotar,
// redondearCm— porque hablan del mismo tablero; si un día se superponen un
// mapa y un despliegue, las coordenadas ya encajan.
//
// LO QUE CAMBIA respecto al Despliegue: aquí no hay una lista cerrada de
// unidades que colocar, sino un catálogo de tipos de terreno del que se saca
// una pieza NUEVA cada vez. Por eso la columna izquierda es una paleta y no un
// índice, y las piezas se borran de verdad en vez de "volver a la reserva".
//
// ROTACIÓN. Un río o un muro en diagonal es lo normal, no la excepción, así que
// cada pieza guarda sus grados. Dos consecuencias:
//
//   · Al REDIMENSIONAR hay que deshacer el giro: el tirador está en la esquina
//     y gira con la pieza, así que el ratón se mueve en los ejes de la mesa
//     pero lo que se estira son el ancho y el fondo de la pieza (ver
//     domain/scenery#tamanoDesdeTirador).
//   · Los LÍMITES, en cambio, se calculan sin rotar, así que una pieza muy
//     girada puede asomar un poco por el borde. Es una simplificación asumida:
//     calcular el rectángulo envolvente daría un mapa que se resiste a que
//     pongas un río tocando la esquina, que es justo donde suele ir.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { MapRepository } from '@/data/repositories/mapRepository'
import { estiloDeSueloDeMapa } from '@/features/maps/tableSurface'
import {
  MESA_ALTO_MAX_CM,
  MESA_ALTO_MIN_CM,
  MESA_ANCHO_MAX_CM,
  MESA_ANCHO_MIN_CM,
  RETICULA_CM,
  acotar,
  limitarAMesa,
  redondearCm,
  type Mesa,
} from '@/domain/deployment'
import {
  PIEZA_MAX_CM,
  PIEZA_MIN_CM,
  SCENERY_KINDS_INFO,
  construirPaleta,
  tamanoDesdeTirador,
  type EntradaDePaleta,
  type FloorAsset,
  type SceneryPiece,
  type TexturaMapa,
} from '@/domain/scenery'
import { FloorAssetRepository, SceneryAssetRepository } from '@/data/repositories/sceneryAssetRepository'
import { SceneryLibraryModal } from '@/features/maps/SceneryLibraryModal'
import { descargarCanvas, renderTableCanvas } from '@/features/maps/renderTableCanvas'
import { useAsync } from '@/shared/hooks/useAsync'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { ArrowLeftIcon, FileImageIcon, LayersIcon, TrashIcon } from '@/shared/ui/icons'
import { SceneryShape } from '@/features/maps/SceneryShape'

/** Rótulo de sección: versalita espaciada y filete, igual que en el Despliegue. */
function Rotulo({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="text-[10px] font-semibold tracking-[0.18em] text-ink-soft uppercase">{children}</span>
      <span className="h-px flex-1 bg-rule-dark/30" />
      {extra}
    </div>
  )
}

export function MapEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const mapaId = Number(id)

  const { data: mapa, loading } = useAsync(() => MapRepository.getById(mapaId), [mapaId])

  const [piezas, setPiezas] = useState<SceneryPiece[]>([])
  const [mesa, setMesa] = useState<Mesa | null>(null)
  const [nombre, setNombre] = useState('')
  const [textura, setTextura] = useState<TexturaMapa>('ninguna')
  const [floorId, setFloorId] = useState<number | null>(null)
  const [editandoBiblioteca, setEditandoBiblioteca] = useState(false)

  // La BIBLIOTECA: la versión vigente de cada elemento y de cada suelo. Se
  // recarga al cerrar la ventana de edición, que es lo único que la cambia.
  const { data: assets, reload: recargarAssets } = useAsync(() => SceneryAssetRepository.listVigentes())
  const { data: suelos, reload: recargarSuelos } = useAsync(() => FloorAssetRepository.listVigentes())
  const paleta = construirPaleta(assets ?? [])
  const sueloElegido = (suelos ?? []).find((f) => f.id === floorId) ?? null
  const [seleccionada, setSeleccionada] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapa) return
    setPiezas(mapa.piezas)
    setMesa({ anchoCm: mapa.anchoCm, altoCm: mapa.altoCm })
    setNombre(mapa.name)
    setTextura(mapa.textura)
    setFloorId(mapa.floorId)
  }, [mapa])

  const mesaRef = useRef<HTMLDivElement>(null)
  /** Ids provisionales de las piezas nuevas: negativos, como en el constructor de listas. */
  const idTemporal = useRef(-1)
  const agarre = useRef<{ id: number; dxCm: number; dyCm: number } | null>(null)
  const redim = useRef<{ id: number; xCm: number; yCm: number } | null>(null)

  const mesaActual: Mesa = mesa ?? {
    anchoCm: mapa?.anchoCm ?? 180,
    altoCm: mapa?.altoCm ?? 120,
  }

  function aCm(clientX: number, clientY: number): { xCm: number; yCm: number } {
    const caja = mesaRef.current?.getBoundingClientRect()
    if (!caja) return { xCm: 0, yCm: 0 }
    return {
      xCm: ((clientX - caja.left) / caja.width) * mesaActual.anchoCm,
      yCm: ((clientY - caja.top) / caja.height) * mesaActual.altoCm,
    }
  }

  function actualizar(id: number, cambios: Partial<SceneryPiece>) {
    setPiezas((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)))
    setDirty(true)
  }

  /**
   * Añade una pieza de la paleta, centrada en la mesa y escalonada.
   *
   * La pieza se queda con el `assetId` de la versión VIGENTE al colocarla: es
   * lo que se guardará y lo que la fija para siempre en este mapa aunque la
   * biblioteca cambie después.
   */
  function anadir(entrada: EntradaDePaleta) {
    const desfase = (piezas.length % 5) * 6
    const tamano = {
      anchoCm: Math.min(entrada.anchoCm, mesaActual.anchoCm),
      altoCm: Math.min(entrada.altoCm, mesaActual.altoCm),
    }
    const centro = limitarAMesa(mesaActual.anchoCm / 2 + desfase, mesaActual.altoCm / 2 + desfase, tamano, mesaActual)
    const nueva: SceneryPiece = {
      id: idTemporal.current--,
      kind: entrada.kind,
      xCm: redondearCm(centro.xCm),
      yCm: redondearCm(centro.yCm),
      anchoCm: tamano.anchoCm,
      altoCm: tamano.altoCm,
      rotacion: 0,
      nombre: null,
      assetId: entrada.assetId,
      imageUrl: entrada.imageUrl,
    }
    setPiezas((prev) => [...prev, nueva])
    setSeleccionada(nueva.id)
    setDirty(true)
  }

  function mover(id: number, xCm: number, yCm: number) {
    const pieza = piezas.find((p) => p.id === id)
    if (!pieza) return
    const dentro = limitarAMesa(xCm, yCm, { anchoCm: pieza.anchoCm, altoCm: pieza.altoCm }, mesaActual)
    actualizar(id, {
      xCm: redondearCm(dentro.xCm),
      yCm: redondearCm(dentro.yCm),
    })
  }

  function redimensionar(id: number, anchoCm: number, altoCm: number) {
    const pieza = piezas.find((p) => p.id === id)
    if (!pieza) return
    const ancho = redondearCm(acotar(anchoCm, PIEZA_MIN_CM, Math.min(PIEZA_MAX_CM, mesaActual.anchoCm)))
    const alto = redondearCm(acotar(altoCm, PIEZA_MIN_CM, Math.min(PIEZA_MAX_CM, mesaActual.altoCm)))
    const dentro = limitarAMesa(pieza.xCm, pieza.yCm, { anchoCm: ancho, altoCm: alto }, mesaActual)
    actualizar(id, {
      anchoCm: ancho,
      altoCm: alto,
      xCm: dentro.xCm,
      yCm: dentro.yCm,
    })
  }

  /**
   * El mapa como PNG, a 8 px/cm (1440 × 960 en una mesa normal): nítido en
   * pantalla y suficiente para imprimirlo en A4. Se pinta desde los datos, no
   * capturando la pantalla, así que sale igual en cualquier ordenador y con
   * cualquier tamaño de ventana (ver renderTableCanvas).
   */
  async function exportarPng() {
    setExportando(true)
    setError(null)
    try {
      const canvas = await renderTableCanvas({
        mesa: mesaActual,
        textura,
        suelo: sueloElegido,
        piezas,
      })
      descargarCanvas(canvas, `${(nombre || 'mapa').replace(/[^\w-]+/g, '-').toLowerCase()}.png`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setExportando(false)
    }
  }

  function borrar(id: number) {
    setPiezas((prev) => prev.filter((p) => p.id !== id))
    setSeleccionada((s) => (s === id ? null : s))
    setDirty(true)
  }

  /** Duplicar: cuatro bosques iguales es lo más normal del mundo en una mesa. */
  function duplicar(id: number) {
    const pieza = piezas.find((p) => p.id === id)
    if (!pieza) return
    const centro = limitarAMesa(
      pieza.xCm + 8,
      pieza.yCm + 8,
      { anchoCm: pieza.anchoCm, altoCm: pieza.altoCm },
      mesaActual,
    )
    const copia: SceneryPiece = {
      ...pieza,
      id: idTemporal.current--,
      xCm: redondearCm(centro.xCm),
      yCm: redondearCm(centro.yCm),
    }
    setPiezas((prev) => [...prev, copia])
    setSeleccionada(copia.id)
    setDirty(true)
  }

  function cambiarMesa(anchoCm: number, altoCm: number) {
    const nueva: Mesa = {
      anchoCm: acotar(anchoCm, MESA_ANCHO_MIN_CM, MESA_ANCHO_MAX_CM),
      altoCm: acotar(altoCm, MESA_ALTO_MIN_CM, MESA_ALTO_MAX_CM),
    }
    setMesa(nueva)
    // Al encoger la mesa, lo que se quedaría fuera se reencaja por el borde más
    // cercano en vez de perderse (mismo criterio que en el Despliegue).
    setPiezas((prev) =>
      prev.map((p) => {
        const ancho = Math.min(p.anchoCm, nueva.anchoCm)
        const alto = Math.min(p.altoCm, nueva.altoCm)
        const dentro = limitarAMesa(p.xCm, p.yCm, { anchoCm: ancho, altoCm: alto }, nueva)
        return {
          ...p,
          anchoCm: ancho,
          altoCm: alto,
          xCm: redondearCm(dentro.xCm),
          yCm: redondearCm(dentro.yCm),
        }
      }),
    )
    setDirty(true)
  }

  async function guardar() {
    setSaving(true)
    setError(null)
    try {
      if (mapa && nombre.trim() && nombre.trim() !== mapa.name) await MapRepository.rename(mapaId, nombre)
      await MapRepository.save(mapaId, mesaActual.anchoCm, mesaActual.altoCm, textura, floorId, piezas)
      setDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  if (!mapa) {
    return (
      <div>
        <button onClick={() => navigate('/mapas')} className="mb-3 text-sm text-ink-soft hover:text-ink">
          ← Volver a Mapas
        </button>
        <p className="text-sm text-ink">No se ha encontrado este mapa.</p>
      </div>
    )
  }

  const elegida = piezas.find((p) => p.id === seleccionada) ?? null
  const marcasX = Array.from({ length: Math.floor(mesaActual.anchoCm / RETICULA_CM) }, (_, i) => (i + 1) * RETICULA_CM)
  const marcasY = Array.from({ length: Math.floor(mesaActual.altoCm / RETICULA_CM) }, (_, i) => (i + 1) * RETICULA_CM)

  return (
    <div className="-mx-6 -my-8 px-6 py-4 xl:-mx-[max(0px,calc((100vw-56rem)/2))]">
      <header className="mb-4 border-b border-rule-dark/30 pb-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.22em] text-ink-soft uppercase">Mapa</p>
            {/* El nombre se edita en el sitio: entrar a un modal para cambiar
                una palabra es un paso de más en una pantalla que ya guarda. */}
            <input
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value)
                setDirty(true)
              }}
              aria-label="Nombre del mapa"
              className="w-full max-w-sm border-b border-transparent bg-transparent font-display text-2xl leading-tight text-ink outline-none hover:border-rule-dark/30 focus:border-bronze"
            />
          </div>

          <dl className="flex shrink-0 items-stretch gap-5">
            <div className="px-3 text-center">
              <dt className="text-[9px] tracking-[0.16em] text-ink-soft uppercase">Mesa</dt>
              <dd className="font-display text-lg leading-tight text-ink tabular-nums">
                {mesaActual.anchoCm}×{mesaActual.altoCm}
              </dd>
            </div>
            <div className="px-3 text-center">
              <dt className="text-[9px] tracking-[0.16em] text-ink-soft uppercase">Elementos</dt>
              <dd className="font-display text-lg leading-tight text-maroon tabular-nums">{piezas.length}</dd>
            </div>
          </dl>

          <div className="flex shrink-0 items-center gap-3">
            {dirty && <span className="text-xs font-medium text-bronze">● Sin guardar</span>}
            <Button variant="ghost" onClick={() => navigate('/mapas')}>
              <ArrowLeftIcon className="h-4 w-4" />
              Mapas
            </Button>
            <Button variant="secondary" onClick={exportarPng} disabled={exportando} title="Descargar el mapa como PNG">
              <FileImageIcon className="h-4 w-4" />
              {exportando ? 'Exportando…' : 'PNG'}
            </Button>
            <Button variant="primary" onClick={guardar} disabled={!dirty || saving}>
              {saving ? 'Guardando…' : 'Guardar mapa'}
            </Button>
          </div>
        </div>
      </header>

      {error && <p className="mb-3 text-sm text-danger">No se pudo guardar: {error}</p>}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* ============ Izquierda: catálogo de escenografía ============ */}
        <aside className="w-full shrink-0 lg:w-48">
          <Rotulo
            extra={
              <button
                type="button"
                onClick={() => setEditandoBiblioteca(true)}
                aria-label="Biblioteca de escenografía"
                title="Biblioteca: añadir, reemplazar o borrar elementos"
                className="rounded-sm border border-rule-dark/40 p-1 text-ink-soft transition-colors hover:bg-parchment-dark hover:text-ink"
              >
                <LayersIcon className="h-3.5 w-3.5" />
              </button>
            }
          >
            Escenografía
          </Rotulo>
          {/* Cada tipo con su propia silueta: se elige por la forma, que es
              como se piensa el terreno, no leyendo una lista de palabras. */}
          <ul className="grid grid-cols-3 gap-1.5 lg:grid-cols-2">
            {paleta.map((entrada) => (
              <li key={entrada.slug}>
                <button
                  type="button"
                  onClick={() => anadir(entrada)}
                  title={`Añadir ${entrada.label.toLowerCase()} (${entrada.anchoCm} × ${entrada.altoCm} cm)`}
                  className="flex w-full flex-col items-center gap-1 rounded-sm border border-rule-dark/30 bg-parchment/60 px-1 py-1.5 transition-colors hover:border-bronze hover:bg-parchment-dark/50"
                >
                  <SceneryShape
                    kind={entrada.kind}
                    imagenUrl={entrada.imageUrl}
                    ajuste="contener"
                    className="h-8 w-full"
                  />
                  <span className="w-full truncate text-center text-[10px] leading-none text-ink-soft">
                    {entrada.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* ============ Centro: la mesa ============ */}
        {/* El TABLERO manda el ancho de todo el bloque —reglas incluidas— y el
            bloque se centra en la columna. Antes las reglas ocupaban el ancho
            entero de la columna mientras el tablero, limitado por alto, solo
            una parte: las marcas no caían sobre sus líneas y el conjunto
            quedaba escorado a la izquierda.

            El `+ 1.25rem` es el canal de la regla vertical (w-4 más el hueco):
            se suma al ancho del bloque para que al tablero le quede exactamente
            el que le corresponde por su alto. */}
        <div className="flex min-w-0 flex-1 justify-center">
          <div
            className="min-w-0"
            style={{
              width: `min(95%, calc((100vh - 13rem) * ${mesaActual.anchoCm / mesaActual.altoCm} * 0.95 + 1.25rem))`,
            }}
          >
            <div className="mb-1 flex gap-1">
              <span aria-hidden className="w-4 shrink-0" />
              <div className="relative h-3 min-w-0 flex-1 select-none">
                {marcasX.map((cm) => (
                  <span
                    key={cm}
                    className="absolute -translate-x-1/2 text-[9px] text-ink-soft/60 tabular-nums"
                    style={{ left: `${(cm / mesaActual.anchoCm) * 100}%` }}
                  >
                    {cm}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-1">
              <div className="relative w-4 shrink-0 select-none">
                {marcasY.map((cm) => (
                  <span
                    key={cm}
                    className="absolute right-0 -translate-y-1/2 text-[9px] text-ink-soft/60 tabular-nums"
                    style={{ top: `${(cm / mesaActual.altoCm) * 100}%` }}
                  >
                    {cm}
                  </span>
                ))}
              </div>

              <div className="min-w-0 flex-1">
                <div
                  ref={mesaRef}
                  style={{
                    aspectRatio: `${mesaActual.anchoCm} / ${mesaActual.altoCm}`,
                    ...estiloDeSueloDeMapa(
                      textura,
                      sueloElegido,
                      mesaActual.anchoCm,
                      mesaActual.altoCm,
                      mapa?.imageUrl ?? null,
                    ),
                  }}
                  onPointerDown={() => setSeleccionada(null)}
                  className="relative w-full touch-none overflow-hidden border-2 border-ink/80 shadow-[inset_0_0_60px_rgba(90,76,54,0.22)] outline outline-1 outline-offset-[3px] outline-rule-dark/40"
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-35"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, rgba(125,121,95,.5) 1px, transparent 1px),' +
                        'linear-gradient(to bottom, rgba(125,121,95,.5) 1px, transparent 1px)',
                      backgroundSize: `${(RETICULA_CM / mesaActual.anchoCm) * 100}% ${(RETICULA_CM / mesaActual.altoCm) * 100}%`,
                    }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(to bottom, rgba(122,36,32,.45) 0 6px, transparent 6px 12px)',
                    }}
                  />

                  {piezas.map((pieza) => {
                    const activa = pieza.id === seleccionada
                    return (
                      <div
                        key={pieza.id}
                        role="button"
                        tabIndex={0}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return
                          e.preventDefault()
                          e.stopPropagation()
                          setSeleccionada(pieza.id)
                          const raton = aCm(e.clientX, e.clientY)
                          // Desfase respecto al centro, para que no dé un salto
                          // al empezar a arrastrar.
                          agarre.current = {
                            id: pieza.id,
                            dxCm: pieza.xCm - raton.xCm,
                            dyCm: pieza.yCm - raton.yCm,
                          }
                          e.currentTarget.setPointerCapture(e.pointerId)
                        }}
                        onPointerMove={(e) => {
                          const a = agarre.current
                          if (!a || a.id !== pieza.id) return
                          const raton = aCm(e.clientX, e.clientY)
                          mover(pieza.id, raton.xCm + a.dxCm, raton.yCm + a.dyCm)
                        }}
                        onPointerUp={() => {
                          agarre.current = null
                        }}
                        onKeyDown={(e) => {
                          const paso = e.shiftKey ? 5 : 1
                          if (e.key === 'ArrowLeft') mover(pieza.id, pieza.xCm - paso, pieza.yCm)
                          else if (e.key === 'ArrowRight') mover(pieza.id, pieza.xCm + paso, pieza.yCm)
                          else if (e.key === 'ArrowUp') mover(pieza.id, pieza.xCm, pieza.yCm - paso)
                          else if (e.key === 'ArrowDown') mover(pieza.id, pieza.xCm, pieza.yCm + paso)
                          else if (e.key === 'Delete' || e.key === 'Backspace') borrar(pieza.id)
                          else return
                          e.preventDefault()
                        }}
                        title={`${pieza.nombre ?? SCENERY_KINDS_INFO[pieza.kind].label} — ${pieza.anchoCm} × ${pieza.altoCm} cm`}
                        style={{
                          left: `${(pieza.xCm / mesaActual.anchoCm) * 100}%`,
                          top: `${(pieza.yCm / mesaActual.altoCm) * 100}%`,
                          width: `${(pieza.anchoCm / mesaActual.anchoCm) * 100}%`,
                          height: `${(pieza.altoCm / mesaActual.altoCm) * 100}%`,
                          transform: `translate(-50%, -50%) rotate(${pieza.rotacion}deg)`,
                        }}
                        className={clsx(
                          'absolute cursor-grab touch-none select-none active:cursor-grabbing',
                          activa ? 'z-20' : 'z-10',
                        )}
                      >
                        <SceneryShape kind={pieza.kind} imagenUrl={pieza.imageUrl} className="h-full w-full" />
                        {activa && (
                          <>
                            <span
                              aria-hidden
                              className="pointer-events-none absolute inset-0 border border-dashed border-maroon"
                            />
                            {/* Tirador de tamaño: mismo gesto que en el
                              Despliegue, esquina inferior derecha. */}
                            <span
                              role="slider"
                              tabIndex={-1}
                              aria-label="Cambiar el tamaño"
                              aria-valuenow={pieza.anchoCm}
                              onPointerDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                redim.current = {
                                  id: pieza.id,
                                  xCm: pieza.xCm,
                                  yCm: pieza.yCm,
                                }
                                e.currentTarget.setPointerCapture(e.pointerId)
                              }}
                              onPointerMove={(e) => {
                                const r = redim.current
                                if (!r || r.id !== pieza.id) return
                                // Distancia al CENTRO por dos: la pieza está
                                // centrada en su posición, así que crece por los
                                // cuatro lados y no se desplaza al estirar.
                                const raton = aCm(e.clientX, e.clientY)
                                const t = tamanoDesdeTirador(raton.xCm - r.xCm, raton.yCm - r.yCm, pieza.rotacion)
                                redimensionar(pieza.id, t.anchoCm, t.altoCm)
                              }}
                              onPointerUp={() => {
                                redim.current = null
                              }}
                              className="absolute -right-1.5 -bottom-1.5 z-30 h-3 w-3 cursor-nwse-resize border border-maroon bg-parchment shadow-[0_1px_2px_rgba(0,0,0,.35)]"
                            />
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {editandoBiblioteca && (
          <SceneryLibraryModal
            onClose={() => setEditandoBiblioteca(false)}
            onSaved={() => {
              recargarAssets()
              recargarSuelos()
            }}
          />
        )}

        {/* ============ Derecha: controles ============ */}
        <aside className="w-full shrink-0 space-y-5 lg:w-56">
          <section>
            <Rotulo>Medidas de la mesa</Rotulo>
            <div className="space-y-3">
              {[
                {
                  etiqueta: 'Ancho',
                  valor: mesaActual.anchoCm,
                  min: MESA_ANCHO_MIN_CM,
                  max: MESA_ANCHO_MAX_CM,
                  set: (v: number) => cambiarMesa(v, mesaActual.altoCm),
                },
                {
                  etiqueta: 'Fondo',
                  valor: mesaActual.altoCm,
                  min: MESA_ALTO_MIN_CM,
                  max: MESA_ALTO_MAX_CM,
                  set: (v: number) => cambiarMesa(mesaActual.anchoCm, v),
                },
              ].map((eje) => (
                <label key={eje.etiqueta} className="block">
                  <span className="mb-1 flex items-baseline justify-between">
                    <span className="text-[10px] tracking-[0.14em] text-ink-soft uppercase">{eje.etiqueta}</span>
                    <span className="font-display text-base text-ink tabular-nums">{eje.valor} cm</span>
                  </span>
                  <input
                    type="range"
                    min={eje.min}
                    max={eje.max}
                    step={5}
                    value={eje.valor}
                    onChange={(e) => eje.set(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-rule-dark/30 accent-maroon"
                  />
                  <span className="mt-0.5 flex justify-between text-[9px] text-ink-soft/60 tabular-nums">
                    <span>{eje.min}</span>
                    <span>{eje.max}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          {/* El suelo del tablero. Dos opciones y no un desplegable: son dos, y
              lo que hay que ver es cuál está puesta, no abrir una lista. Cada
              botón se pinta con su propia textura, que es la única forma de
              elegir "hierba" sabiendo lo que se va a ver. */}
          <section>
            <Rotulo
              extra={
                <button
                  type="button"
                  onClick={() => setEditandoBiblioteca(true)}
                  aria-label="Suelos de la biblioteca"
                  title="Biblioteca: crear o reemplazar suelos de mesa"
                  className="rounded-sm border border-rule-dark/40 p-1 text-ink-soft transition-colors hover:bg-parchment-dark hover:text-ink"
                >
                  <LayersIcon className="h-3.5 w-3.5" />
                </button>
              }
            >
              Suelo
            </Rotulo>
            {/* Un mapa que ES una foto no tiene suelo que elegir: la imagen lo
                tapa entero. Decirlo aquí evita el peor de los silencios —pulsar
                un control y que no pase nada visible— y explica por qué. */}
            {mapa?.imageUrl && (
              <p className="mb-2 rounded-sm border border-rule-dark/30 bg-parchment-dark/40 px-2 py-1.5 text-[10px] leading-snug text-ink-soft">
                Este mapa es una <b className="text-ink">imagen de escenario</b>, y la imagen se estira al tablero
                entero: el suelo que elijas aquí queda debajo y no se ve. La escenografía sí se pinta encima.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {[
                { clave: 'ninguna', etiqueta: 'Liso', suelo: null as FloorAsset | null, textura: 'ninguna' as const },
                { clave: 'hierba', etiqueta: 'Hierba', suelo: null as FloorAsset | null, textura: 'hierba' as const },
                ...(suelos ?? [])
                  .filter((f) => !f.retired)
                  .map((f) => ({ clave: `f${f.id}`, etiqueta: f.label, suelo: f, textura: 'ninguna' as const })),
              ].map((opcion) => {
                const elegido = opcion.suelo
                  ? floorId === opcion.suelo.id
                  : floorId == null && textura === opcion.textura
                return (
                  <button
                    key={opcion.clave}
                    type="button"
                    onClick={() => {
                      setTextura(opcion.textura)
                      setFloorId(opcion.suelo?.id ?? null)
                      setDirty(true)
                    }}
                    aria-pressed={elegido}
                    title={opcion.etiqueta}
                    className={clsx(
                      'w-16 shrink-0 overflow-hidden rounded-sm border transition-shadow disabled:opacity-50',
                      elegido
                        ? 'border-maroon shadow-[0_0_0_2px_rgba(122,36,32,.25)]'
                        : 'border-rule-dark/40 hover:border-bronze',
                    )}
                  >
                    <span
                      className="block h-8 w-full"
                      style={estiloDeSueloDeMapa(opcion.textura, opcion.suelo, 180, 120)}
                    />
                    <span className="block truncate bg-parchment px-1 py-0.5 text-center text-[10px] text-ink-soft">
                      {opcion.etiqueta}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <Rotulo>Elemento</Rotulo>
            {!elegida ? (
              <p className="text-[10px] leading-relaxed text-ink-soft/80">
                Pulsa un tipo de escenografía para ponerlo en la mesa. Después arrástralo, gíralo o cambia su tamaño con
                el tirador de la esquina.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="border-l-2 border-maroon pl-2">
                  <p className="text-sm leading-tight font-medium text-ink">
                    {elegida.nombre ?? SCENERY_KINDS_INFO[elegida.kind].label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink-soft tabular-nums">
                    {elegida.anchoCm} × {elegida.altoCm} cm · ({elegida.xCm}, {elegida.yCm}) cm
                  </p>
                </div>

                <label className="block">
                  <span className="mb-1 block text-[10px] tracking-[0.14em] text-ink-soft uppercase">Nombre</span>
                  <input
                    value={elegida.nombre ?? ''}
                    onChange={(e) => actualizar(elegida.id, { nombre: e.target.value || null })}
                    placeholder={SCENERY_KINDS_INFO[elegida.kind].label}
                    className="w-full rounded-sm border border-rule-dark/40 bg-parchment px-2 py-1 text-xs text-ink outline-none focus:border-bronze"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 flex items-baseline justify-between">
                    <span className="text-[10px] tracking-[0.14em] text-ink-soft uppercase">Giro</span>
                    <span className="text-xs text-ink tabular-nums">{elegida.rotacion}°</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={355}
                    step={5}
                    value={elegida.rotacion}
                    onChange={(e) =>
                      actualizar(elegida.id, {
                        rotacion: Number(e.target.value),
                      })
                    }
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-rule-dark/30 accent-maroon"
                  />
                </label>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => duplicar(elegida.id)}
                    className="rounded-sm border border-rule-dark/40 px-2 py-1 text-xs text-ink-soft transition-colors hover:border-bronze hover:text-bronze"
                  >
                    Duplicar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      actualizar(elegida.id, {
                        anchoCm: Math.min(SCENERY_KINDS_INFO[elegida.kind].anchoCm, mesaActual.anchoCm),
                        altoCm: Math.min(SCENERY_KINDS_INFO[elegida.kind].altoCm, mesaActual.altoCm),
                      })
                    }
                    className="rounded-sm border border-rule-dark/40 px-2 py-1 text-xs text-ink-soft transition-colors hover:border-bronze hover:text-bronze"
                  >
                    Tamaño de serie
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => borrar(elegida.id)}
                  className="flex w-full items-center justify-center gap-1 rounded-sm border border-maroon/40 px-2 py-1 text-xs font-medium text-maroon transition-colors hover:bg-maroon/10"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  Quitar del mapa
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
