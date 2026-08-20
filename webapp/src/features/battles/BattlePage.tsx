// ============================================================================
// LA BATALLA: los dos despliegues enfrentados sobre la misma mesa, las dos
// listas y los PDF.
//
// AQUÍ NO SE EDITA NADA, y no es una limitación: es lo que la pantalla es. Una
// batalla es el acta de una partida que se va a jugar —quién trae qué y dónde
// lo pone— y su valor está justamente en que no se pueda retocar después. Por
// eso sus dos listas tienen que estar completadas, y por eso mientras la
// batalla exista no se pueden reabrir (ver ArmyListRepository.setReady).
//
// CÓMO SE ENFRENTAN. Cada ejército se despliega ABAJO en su propia pantalla,
// porque es lo cómodo para quien juega. Para ponerlos cara a cara, el bando B se
// gira 180° respecto al centro de la mesa (ver domain/battle#enfrentarPosicion):
// lo que tenía abajo queda arriba y lo que tenía a la izquierda, a la derecha.
// No es un espejo —un espejo cambiaría el orden de las unidades de un flanco—,
// es media vuelta, que es lo que de verdad pasa al sentarse al otro lado.
//
// EL TERRENO SE PINTA DESDE EL SUR, el lado del bando A. Los dos ejércitos
// comparten mesa por obligación (si no, no se deja crear la batalla), así que
// solo hay un terreno que pintar y hay que elegir desde dónde se mira; el
// anfitrión es A.
// ============================================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { ArmyListRepository } from '@/data/repositories/armyListRepository'
import { BattleRepository } from '@/data/repositories/battleRepository'
import { MapRepository } from '@/data/repositories/mapRepository'
import { FloorAssetRepository } from '@/data/repositories/sceneryAssetRepository'
import { UnitTypeTagRepository } from '@/data/repositories/lookupRepositories'
import { imageUrl } from '@/data/network/images'
import { computeEntryCost } from '@/domain/armyValidation'
import { enfrentarPosicion } from '@/domain/battle'
import { RETICULA_CM, tamanoDeEntrada, type DeploymentPosition, type Mesa, type TamanoCm } from '@/domain/deployment'
import { cuerpoDeAliasCm, referenciasDeDespliegue } from '@/domain/deploymentRefs'
import { COLOR_FACCION_POR_DEFECTO, estiloDePeana, textoSobre } from '@/domain/factionColor'
import { estiloDeSueloDeMapa } from '@/features/maps/tableSurface'
import { SceneryShape } from '@/features/maps/SceneryShape'
import { renderTableCanvas } from '@/features/maps/renderTableCanvas'
import { abrirPestanaPdf, cerrarPestanaPdf } from '@/features/army-lists/pdfWindow'
import { EntryDetailCard } from '@/features/army-lists/EntryDetailCard'
import { useAsync } from '@/shared/hooks/useAsync'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { ArrowLeftIcon, FileTextIcon, LockIcon } from '@/shared/ui/icons'
import type { ArmyListDetail, ArmyListEntry } from '@/domain/types'

/** Todo lo que hace falta de un bando para pintarlo y para exportarlo. */
interface Bando {
  lista: ArmyListDetail
  posiciones: Map<number, DeploymentPosition>
  /** Entradas con peana en la mesa, en el orden de la lista. */
  enMesa: ArmyListEntry[]
  /** Iniciales de cada entrada desplegada, numeradas si se repiten. */
  refPorEntrada: Map<number, string>
  color: string
  puntos: number
}

export function BattlePage() {
  const navigate = useNavigate()
  const battleId = Number(useParams().id)
  const [exportando, setExportando] = useState<string | null>(null)
  const [encima, setEncima] = useState<number | null>(null)

  const { data: batalla, loading } = useAsync(() => BattleRepository.getById(battleId), [battleId])
  const { data: etiquetas } = useAsync(() => UnitTypeTagRepository.listAll())

  // Las dos listas y sus dos despliegues, todo a la vez: son cuatro consultas
  // independientes y encadenarlas solo sumaría esperas.
  const { data: datos, loading: cargandoBandos } = useAsync(async () => {
    if (!batalla) return null
    const [listaA, listaB, planA, planB] = await Promise.all([
      ArmyListRepository.getDetailById(batalla.armyListAId),
      ArmyListRepository.getDetailById(batalla.armyListBId),
      ArmyListRepository.getDeployment(batalla.armyListAId),
      ArmyListRepository.getDeployment(batalla.armyListBId),
    ])
    return { listaA, listaB, planA, planB }
  }, [batalla?.id])

  const listaA = datos?.listaA ?? null
  const listaB = datos?.listaB ?? null

  // El mapa y su suelo salen del bando A, el anfitrión. Los dos comparten mesa
  // por obligación, así que mirar la de A es mirar la de los dos.
  const { data: mapaCargado } = useAsync(
    () => (listaA?.battleMapId ? MapRepository.getById(listaA.battleMapId) : Promise.resolve(null)),
    [listaA?.battleMapId],
  )
  const { data: sueloDelMapa } = useAsync(
    () => (mapaCargado?.floorId ? FloorAssetRepository.getById(mapaCargado.floorId) : Promise.resolve(null)),
    [mapaCargado?.floorId],
  )

  if (loading || cargandoBandos) return <Spinner />

  if (!batalla || !listaA || !listaB) {
    return (
      <div>
        <button onClick={() => navigate('/batallas')} className="mb-3 text-sm text-ink-soft hover:text-ink">
          ← Volver a Batallas
        </button>
        <div className="rounded-sm border border-rule-dark/40 bg-parchment/70 px-4 py-3">
          <p className="text-sm text-ink">No se pudo cargar esta batalla.</p>
          <p className="mt-1 text-xs text-ink-soft">
            Puede que se haya borrado, o que se haya borrado alguno de sus ejércitos.
          </p>
        </div>
      </div>
    )
  }

  const mesa: Mesa = mapaCargado
    ? { anchoCm: mapaCargado.anchoCm, altoCm: mapaCargado.altoCm }
    : { anchoCm: listaA.tableWidthCm, altoCm: listaA.tableHeightCm }
  const imagenFondoUrl = !mapaCargado && listaA.deploymentImageKey ? imageUrl(listaA.deploymentImageKey) : null

  function tamanoDe(entry: ArmyListEntry, pos: DeploymentPosition | undefined): TamanoCm {
    const etiqueta = etiquetas?.find((t) => t.id === entry.unit.typeTag?.id)
    return tamanoDeEntrada({
      unitType: entry.unit.unitType,
      tamanoEtiqueta: etiqueta ? { anchoCm: etiqueta.baseWidthCm, altoCm: etiqueta.baseHeightCm } : null,
      tamanoPropio: pos?.anchoCm != null && pos.altoCm != null ? { anchoCm: pos.anchoCm, altoCm: pos.altoCm } : null,
    })
  }

  /** Prepara un bando. `girar` es lo único que distingue al de arriba del de abajo. */
  function prepararBando(lista: ArmyListDetail, plan: DeploymentPosition[], girar: boolean): Bando {
    const posiciones = new Map(
      plan.map((p) => [p.entryId, girar ? enfrentarPosicion(p, mesa) : p] as [number, DeploymentPosition]),
    )
    const entradas = [...lista.entries].sort((a, b) => a.sortOrder - b.sortOrder)
    const enMesa = entradas.filter((e) => posiciones.has(e.id))
    const costes = new Map(enMesa.map((e) => [e.id, computeEntryCost(e.unit, e)]))
    const referencias = referenciasDeDespliegue(enMesa, costes)
    return {
      lista,
      posiciones,
      enMesa,
      refPorEntrada: new Map(referencias.map((r) => [r.entryId, r.ref])),
      color: lista.faction.color ?? COLOR_FACCION_POR_DEFECTO,
      puntos: entradas.reduce((s, e) => s + computeEntryCost(e.unit, e), 0),
    }
  }

  const bandoA = prepararBando(listaA, datos?.planA ?? [], false)
  const bandoB = prepararBando(listaB, datos?.planB ?? [], true)
  const bandos = [bandoA, bandoB]

  /**
   * Cuerpo de letra de las iniciales, calculado sobre las peanas DE LOS DOS
   * bandos a la vez: si cada uno usara el suyo, la mesa tendría dos tamaños de
   * letra y parecería que unas unidades importan más que otras.
   */
  const cuerpoAliasCm = cuerpoDeAliasCm(
    bandos.flatMap((b) =>
      b.enMesa.map((e) => ({ texto: b.refPorEntrada.get(e.id) ?? '', tamano: tamanoDe(e, b.posiciones.get(e.id)) })),
    ),
  )

  /** Las peanas de los dos bandos, tal y como las quiere el lienzo del PDF. */
  function peanasParaElLienzo() {
    return bandos.flatMap((b) =>
      b.enMesa.map((e) => {
        const pos = b.posiciones.get(e.id)!
        const tamano = tamanoDe(e, pos)
        return {
          xCm: pos.xCm,
          yCm: pos.yCm,
          anchoCm: tamano.anchoCm,
          altoCm: tamano.altoCm,
          color: e.unit.faction.color ?? COLOR_FACCION_POR_DEFECTO,
          colorTexto: textoSobre(e.unit.faction.color),
          texto: b.refPorEntrada.get(e.id) ?? '',
        }
      }),
    )
  }

  async function exportarLista(bando: Bando, etiqueta: string) {
    const ventana = abrirPestanaPdf()
    setExportando(etiqueta)
    try {
      // Carga perezosa: el generador de PDF arrastra jsPDF, que pesa más que
      // el resto de la pantalla junta y no hace falta hasta que se pulsa.
      const { exportArmyListToPdf } = await import('@/features/army-lists/exportArmyListPdf')
      await exportArmyListToPdf(bando.lista, bando.puntos, ventana)
    } catch (err) {
      cerrarPestanaPdf(ventana)
      console.error(err)
    } finally {
      setExportando(null)
    }
  }

  async function exportarMapa() {
    const ventana = abrirPestanaPdf()
    setExportando('mapa')
    try {
      // El mapa se pinta DESDE LOS DATOS, no capturando la pantalla: capturar el
      // DOM reproduce mal los fondos y arrastra el tamaño de la ventana (misma
      // razón que en el PDF del despliegue).
      const canvas = await renderTableCanvas({
        mesa,
        textura: mapaCargado?.textura ?? 'ninguna',
        suelo: sueloDelMapa ?? null,
        piezas: mapaCargado?.piezas ?? [],
        peanas: peanasParaElLienzo(),
        imagenFondoUrl,
      })
      const { exportBattleToPdf } = await import('@/features/battles/exportBattlePdf')
      exportBattleToPdf(
        {
          nombre: batalla!.name,
          mesa,
          nombreMapa: mapaCargado?.name ?? null,
          mapa: canvas,
          bandos: bandos.map((b) => ({
            nombreLista: b.lista.name,
            faccion: b.lista.faction.name,
            color: b.color,
            referencias: referenciasDeDespliegue(
              b.enMesa,
              new Map(b.enMesa.map((e) => [e.id, computeEntryCost(e.unit, e)])),
            ),
            puntos: b.puntos,
          })),
        },
        ventana,
      )
    } catch (err) {
      cerrarPestanaPdf(ventana)
      console.error(err)
    } finally {
      setExportando(null)
    }
  }

  return (
    <div className="-mx-6 -my-8 px-6 py-4 xl:-mx-[max(0px,calc((100vw-56rem)/2))]">
      <header className="mb-4 border-b border-rule-dark/30 pb-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.22em] text-ink-soft uppercase">Batalla</p>
            <h1 className="truncate font-display text-2xl leading-tight text-ink">{batalla.name}</h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span
              className="flex items-center gap-1.5 rounded-sm border border-rule-dark/40 px-2 py-1 text-xs font-medium text-ink-soft"
              title="Una batalla es el acta de una partida: se mira y se exporta, no se edita"
            >
              <LockIcon className="h-3.5 w-3.5" />
              Solo lectura
            </span>
            <Button variant="ghost" onClick={() => navigate('/batallas')}>
              <ArrowLeftIcon className="h-4 w-4" />
              Batallas
            </Button>
            <Button variant="secondary" disabled={exportando != null} onClick={exportarMapa}>
              <FileTextIcon className="h-4 w-4" />
              {exportando === 'mapa' ? 'Exportando…' : 'Mapa'}
            </Button>
            <Button variant="secondary" disabled={exportando != null} onClick={() => exportarLista(bandoA, 'a')}>
              <FileTextIcon className="h-4 w-4" />
              {exportando === 'a' ? 'Exportando…' : `Lista · ${listaA.faction.name}`}
            </Button>
            <Button variant="secondary" disabled={exportando != null} onClick={() => exportarLista(bandoB, 'b')}>
              <FileTextIcon className="h-4 w-4" />
              {exportando === 'b' ? 'Exportando…' : `Lista · ${listaB.faction.name}`}
            </Button>
          </div>
        </div>
      </header>

      {/* ---------- La mesa ---------- */}
      <div className="mb-5 flex justify-center">
        <div className="w-full max-w-5xl">
          <RotuloDeBando bando={bandoB} posicion="arriba" />
          <div
            style={{ aspectRatio: `${mesa.anchoCm} / ${mesa.altoCm}`, containerType: 'inline-size' }}
            className="relative w-full overflow-hidden border-2 border-ink/80 shadow-[inset_0_0_60px_rgba(90,76,54,0.22)] outline outline-1 outline-offset-[3px] outline-rule-dark/40"
          >
            {/* El terreno, en su capa: suelo o imagen, y la escenografía del
                mapa. Sin girar — se mira desde el sur, el lado del bando A. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                ...estiloDeSueloDeMapa(
                  mapaCargado?.textura ?? 'ninguna',
                  sueloDelMapa ?? null,
                  mesa.anchoCm,
                  mesa.altoCm,
                ),
                ...(imagenFondoUrl
                  ? {
                      backgroundImage: `url(${imagenFondoUrl})`,
                      backgroundSize: '100% 100%',
                      backgroundRepeat: 'no-repeat',
                    }
                  : null),
              }}
            >
              {mapaCargado?.piezas.map((pieza) => (
                <div
                  key={pieza.id}
                  className="absolute"
                  style={{
                    left: `${(pieza.xCm / mesa.anchoCm) * 100}%`,
                    top: `${(pieza.yCm / mesa.altoCm) * 100}%`,
                    width: `${(pieza.anchoCm / mesa.anchoCm) * 100}%`,
                    height: `${(pieza.altoCm / mesa.altoCm) * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${pieza.rotacion}deg)`,
                  }}
                >
                  <SceneryShape kind={pieza.kind} imagenUrl={pieza.imageUrl} className="h-full w-full" />
                </div>
              ))}
            </div>

            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 opacity-35"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(125,121,95,.5) 1px, transparent 1px),' +
                  'linear-gradient(to bottom, rgba(125,121,95,.5) 1px, transparent 1px)',
                backgroundSize: `${(RETICULA_CM / mesa.anchoCm) * 100}% ${(RETICULA_CM / mesa.altoCm) * 100}%`,
              }}
            />
            {/* La línea central, la referencia que de verdad se usa. En una
                batalla separa además un bando del otro, así que va más marcada
                que en el despliegue de uno solo. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-px -translate-y-1/2"
              style={{
                backgroundImage: 'repeating-linear-gradient(to right, rgba(122,36,32,.55) 0 8px, transparent 8px 16px)',
              }}
            />

            {bandos.map((bando) =>
              bando.enMesa.map((entry) => {
                const pos = bando.posiciones.get(entry.id)!
                const tamano = tamanoDe(entry, pos)
                return (
                  <div
                    key={`${bando.lista.id}-${entry.id}`}
                    onPointerEnter={() => setEncima(entry.id)}
                    onPointerLeave={() => setEncima((id) => (id === entry.id ? null : id))}
                    style={{
                      left: `${(pos.xCm / mesa.anchoCm) * 100}%`,
                      top: `${(pos.yCm / mesa.altoCm) * 100}%`,
                      width: `${(tamano.anchoCm / mesa.anchoCm) * 100}%`,
                      height: `${(tamano.altoCm / mesa.altoCm) * 100}%`,
                    }}
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-default select-none"
                  >
                    <div
                      className="h-full w-full overflow-hidden border border-ink/70 shadow-[0_1px_3px_rgba(0,0,0,.3)]"
                      style={estiloDePeana(entry.unit.faction.color)}
                    >
                      <span
                        className="pointer-events-none flex h-full w-full items-center justify-center leading-none font-bold [text-shadow:0_1px_1px_rgba(0,0,0,.35)]"
                        style={{ fontSize: `${(cuerpoAliasCm / mesa.anchoCm) * 100}cqw` }}
                      >
                        {bando.refPorEntrada.get(entry.id)}
                      </span>
                    </div>
                  </div>
                )
              }),
            )}
          </div>
          <RotuloDeBando bando={bandoA} posicion="abajo" />
        </div>
      </div>

      {/* ---------- Las dos listas ---------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        {bandos.map((bando) => (
          <ListaDelBando key={bando.lista.id} bando={bando} encima={encima} onEncima={setEncima} />
        ))}
      </div>
    </div>
  )
}

/** Quién despliega en ese borde de la mesa, con su color por delante. */
function RotuloDeBando({ bando, posicion }: { bando: Bando; posicion: 'arriba' | 'abajo' }) {
  return (
    <div className={clsx('flex items-center gap-2', posicion === 'arriba' ? 'mb-1.5' : 'mt-1.5')}>
      <span
        aria-hidden
        className="h-3 w-3 shrink-0 rounded-[1px] border border-ink/50"
        style={{ backgroundColor: bando.color }}
      />
      <span className="truncate text-xs font-semibold text-ink">{bando.lista.name}</span>
      <span className="truncate text-xs text-ink-soft">{bando.lista.faction.name}</span>
      <span className="text-mini tabular-nums text-ink-soft/70">{bando.puntos} pts</span>
      <span aria-hidden className="h-px flex-1 bg-rule-dark/25" />
      <span className="text-[10px] tracking-[0.16em] text-ink-soft/60 uppercase">
        {posicion === 'arriba' ? 'Arriba' : 'Abajo'}
      </span>
    </div>
  )
}

/**
 * La lista de un bando, entera y de solo lectura: lo mismo que se ve al montar
 * el ejército, sin nada que tocar. El detalle (perfil, equipo, reglas) sale al
 * pasar el ratón, igual que en el orden de batalla del Despliegue — meterlo en
 * la propia fila convertiría dos listas de veinte unidades en un muro.
 */
function ListaDelBando({
  bando,
  encima,
  onEncima,
}: {
  bando: Bando
  encima: number | null
  onEncima: (id: number | null) => void
}) {
  const entradas = [...bando.lista.entries].sort((a, b) => a.sortOrder - b.sortOrder)
  return (
    <section className="rounded-sm border border-rule-dark/40 bg-parchment/70 p-4">
      <div className="mb-2.5 flex items-baseline gap-2">
        <span
          aria-hidden
          className="h-3 w-3 shrink-0 self-center rounded-[1px] border border-ink/50"
          style={{ backgroundColor: bando.color }}
        />
        <h2 className="min-w-0 truncate font-display text-lg font-semibold text-ink">{bando.lista.name}</h2>
        <span aria-hidden className="h-px flex-1 self-center bg-rule-dark/25" />
        <span className="shrink-0 font-display text-base text-maroon tabular-nums">{bando.puntos} pts</span>
      </div>

      <ul className="divide-y divide-rule-dark/15">
        {entradas.map((entry) => {
          const ref = bando.refPorEntrada.get(entry.id)
          return (
            <li
              key={entry.id}
              onPointerEnter={() => onEncima(entry.id)}
              onPointerLeave={() => onEncima(null)}
              className="relative flex items-center gap-2 py-1.5"
            >
              {/* Las iniciales, solo si la unidad está en la mesa: es lo que
                  enlaza cada fila con su peana. Sin desplegar, un hueco del
                  mismo ancho para que los nombres no bailen. */}
              <span
                className={clsx(
                  'w-8 shrink-0 text-center text-mini font-bold',
                  ref ? 'text-ink-soft' : 'text-ink-soft/25',
                )}
              >
                {ref ?? '—'}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {entry.alias ?? entry.unit.name}
                {entry.quantity > 1 && <span className="text-ink-soft"> ×{entry.quantity}</span>}
              </span>
              <span className="shrink-0 text-xs text-ink-soft tabular-nums">
                {computeEntryCost(entry.unit, entry)} pts
              </span>
              {encima === entry.id && (
                <div className="absolute top-full right-0 z-40 pt-1">
                  <EntryDetailCard entry={entry} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
