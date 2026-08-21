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
// Y porque no se edita, la pantalla se puede permitir ser un CARTEL: una
// cabecera con las dos facciones enfrentadas y la balanza de puntos, la mesa
// enmarcada como una lámina, y debajo los dos órdenes de batalla. En una
// pantalla de trabajo eso estorbaría; en una que solo se mira, es justo lo que
// hace falta para saber a qué te enfrentas antes de empezar.
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
//
// EL PUENTE LISTA↔MESA. Pasar el ratón por una unidad la enciende en el
// tablero, y al revés. Es la única interacción de la pantalla y hace el trabajo
// que en el papel hace señalar con el dedo: con cuarenta peanas y dos listas de
// veinte, leer "C3" y buscarlo a ojo es exactamente lo que sobra.
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
import {
  CartelaDeEnfrentamiento,
  Escuadras,
  EstandarteDeBando,
  type BandoHeraldico,
} from '@/features/battles/BattleHeraldry'
import { BattleOrderPanel } from '@/features/battles/BattleOrderPanel'
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

/** Lo que la heráldica necesita de un bando, sacado del bando completo. */
function heraldicaDe(bando: Bando): BandoHeraldico {
  return {
    nombreLista: bando.lista.name,
    faccion: bando.lista.faction,
    color: bando.color,
    puntos: bando.puntos,
    unidades: bando.lista.entries.length,
    enMesa: bando.enMesa.length,
  }
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

  // El mapa y su suelo salen de la lista A. Los dos comparten mesa por
  // obligación (si no, no se deja crear la batalla), así que mirar la de una es
  // mirar la de las dos.
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
  // Del mapa si lo hay (lo normal), y si no de la imagen suelta de la lista,
  // que es como se guardaban las fotos antes de que fueran mapas.
  const imagenFondoUrl = mapaCargado
    ? mapaCargado.imageUrl
    : listaA.deploymentImageKey
      ? imageUrl(listaA.deploymentImageKey)
      : null

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

  // QUIÉN SE GIRA LO DICE EL LADO, no el orden en que se eligieron los
  // ejércitos. La mesa se pinta desde el sur, así que el del sur va tal cual y
  // el del norte se da media vuelta. Girar siempre "el segundo" ponía arriba a
  // quien había elegido el sur en cuanto alguien creara la batalla al revés.
  //
  // Que los dos lados sean distintos está garantizado en el alta (ver
  // motivoDeLadoRepetido); si aun así llegara una batalla vieja con los dos
  // iguales, el `else` la pinta como antes en vez de dejarlos superpuestos.
  const aEsNorte = listaA.deploymentSide === 'norte' && listaB.deploymentSide !== 'norte'
  const bandoA = prepararBando(listaA, datos?.planA ?? [], aEsNorte)
  const bandoB = prepararBando(listaB, datos?.planB ?? [], !aEsNorte)
  /** El de abajo primero: es el orden en que se leen la mesa y los estandartes. */
  const bandoSur = aEsNorte ? bandoB : bandoA
  const bandoNorte = aEsNorte ? bandoA : bandoB
  const bandos = [bandoSur, bandoNorte]

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

  const nombreDelMapa = mapaCargado?.name ?? (imagenFondoUrl ? 'Imagen suelta de la lista' : 'Mesa sin mapa')

  return (
    // ========================================================================
    // POR QUÉ ESTA CAJA ES ASÍ. La batalla necesita más ancho que el resto del
    // programa (AppShell centra todo en 56rem), así que se sale de su columna
    // con un margen negativo. Pero el que había se calculaba como
    // `(100vw - 56rem)/2` a secas, y eso deja el bloque MÁS ANCHO QUE EL HUECO
    // REAL por dos motivos que se suman: `main` tiene su propio `px-6`
    // (1,5rem a cada lado), y `100vw` incluye la barra de desplazamiento. El
    // sobrante no se puede alcanzar hacia la izquierda —una página no scrollea
    // a la izquierda—, así que la mesa aparecía cortada por ese lado. De ahí
    // que ahora se resten los dos: el padding de `main` y un dedo para la
    // barra.
    //
    // Y ADEMÁS SE LE PONE TECHO. Escaparse de la columna no quiere decir
    // ocupar todo lo que haya: en una pantalla muy ancha la mesa se estiraba
    // hasta un tamaño en el que hay que mover la cabeza para recorrerla, que
    // es lo contrario de lo que sirve una vista de conjunto.
    // ========================================================================
    <div className="-mx-6 -my-8 px-6 py-4 xl:-mx-[max(0px,calc((100vw-56rem)/2-2.5rem))]">
      <div className="mx-auto w-full max-w-[94rem]">
        {/* ---------- Barra de mando: volver, el sello y los tres PDF ---------- */}
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button variant="ghost" onClick={() => navigate('/batallas')}>
            <ArrowLeftIcon className="h-4 w-4" />
            Batallas
          </Button>

          <span
            className="flex items-center gap-1.5 rounded-sm border border-maroon/35 bg-maroon/8 px-2 py-1 text-mini font-semibold tracking-wide text-maroon"
            title="Una batalla es el acta de una partida: se mira y se exporta, no se edita"
          >
            <LockIcon className="h-3.5 w-3.5" />
            Acta cerrada
          </span>

          <span aria-hidden className="hidden h-px flex-1 bg-rule-dark/25 sm:block" />

          {/* Los tres PDF juntos y rotulados como un solo grupo: son la misma
              acción sobre tres cosas distintas, no tres botones sueltos. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-micro font-semibold tracking-[0.2em] text-ink-soft/60 uppercase">Exportar</span>
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

        {/* ---------- El cartel del enfrentamiento ---------- */}
        <CartelaDeEnfrentamiento
          titulo={batalla.name}
          a={heraldicaDe(bandoSur)}
          b={heraldicaDe(bandoNorte)}
          medidas={`${mesa.anchoCm} × ${mesa.altoCm} cm`}
          mapa={nombreDelMapa}
        />

        {/* ======================================================================
            EL REPARTO: los dos órdenes de batalla A LOS LADOS de la mesa.
            Debajo, uno al lado del otro, sobraba media pantalla a izquierda y
            derecha mientras las listas se estiraban a lo ancho sin necesitarlo —
            una lista es una columna estrecha por naturaleza— y la mesa quedaba a
            una pantalla de scroll de ellas, justo lo que hay que mirar a la vez.
            A los lados, las tres cosas caben de una vez y cada una ocupa la forma
            que le corresponde.

            Solo en pantallas anchas (xl). Por debajo se apilan, y la MESA VA
            PRIMERA: es lo que se ha venido a ver. De ahí el orden del DOM —mesa,
            sur, norte— y los `xl:order-*` que lo recolocan.
            ================================================================== */}
        <div
          className="wh-surgir mb-5 grid items-start gap-4 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_minmax(0,18rem)]"
          style={{ animationDelay: '90ms' }}
        >
          {/* ---------- La mesa ---------- */}
          {/* UN SOLO MARCO para los tres: estandarte de arriba, mesa y estandarte
              de abajo. Antes cada pieza llevaba el suyo y el filete exterior de
              la mesa pasaba por detrás de los rótulos, que es lo que hacía que
              parecieran pegados encima en vez de formar parte de la lámina. */}
          <div className="w-full self-start overflow-hidden rounded-sm border-2 border-ink/80 outline outline-1 outline-offset-[3px] outline-rule-dark/40 xl:order-2">
            <EstandarteDeBando bando={heraldicaDe(bandoNorte)} posicion="arriba" />

            <div
              style={{ aspectRatio: `${mesa.anchoCm} / ${mesa.altoCm}`, containerType: 'inline-size' }}
              className="relative w-full overflow-hidden shadow-[inset_0_0_60px_rgba(90,76,54,0.22)]"
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

              {/* Cada mitad teñida del color de quien despliega en ella. Es muy
                  flojo a propósito (un 9%): tiene que decir de quién es cada lado
                  sin competir con el terreno ni con las peanas. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 z-0 h-1/2"
                style={{ backgroundImage: `linear-gradient(to bottom, ${bandoNorte.color}17, transparent 85%)` }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-1/2"
                style={{ backgroundImage: `linear-gradient(to top, ${bandoSur.color}17, transparent 85%)` }}
              />

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
                  que en el despliegue de uno solo, y con su rombo en el centro
                  exacto de la mesa. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-px -translate-y-1/2"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(to right, rgba(122,36,32,.55) 0 8px, transparent 8px 16px)',
                }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-1/2 z-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-maroon/60 bg-parchment/70"
              />

              {/* Viñeta: asienta la mesa y evita que los cantos queden a cuchillo. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-20"
                style={{
                  backgroundImage: 'radial-gradient(ellipse at center, transparent 58%, rgba(43,32,19,.26) 100%)',
                }}
              />
              <Escuadras className="z-20 text-parchment/60" />

              {bandos.map((bando, indiceBando) =>
                bando.enMesa.map((entry, indice) => {
                  const pos = bando.posiciones.get(entry.id)!
                  const tamano = tamanoDe(entry, pos)
                  const resaltada = encima === entry.id
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
                        // Van cayendo sobre la mesa por orden, con el tope puesto
                        // a propósito: con cuarenta peanas, esperar a la última
                        // sería esperar de más.
                        animationDelay: `${Math.min(160 + indiceBando * 40 + indice * 22, 700)}ms`,
                      }}
                      className={clsx(
                        'wh-peana absolute -translate-x-1/2 -translate-y-1/2 cursor-default select-none',
                        resaltada ? 'z-30' : 'z-10',
                      )}
                    >
                      <div
                        className={clsx(
                          'h-full w-full overflow-hidden border transition-[transform,box-shadow] duration-150',
                          resaltada
                            ? 'border-ink shadow-[0_0_0_2px_var(--color-maroon),0_3px_10px_rgba(0,0,0,.45)]'
                            : 'border-ink/70 shadow-[0_1px_3px_rgba(0,0,0,.3)]',
                        )}
                        style={{
                          ...estiloDePeana(entry.unit.faction.color),
                          transform: resaltada ? 'scale(1.14)' : undefined,
                        }}
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

            <EstandarteDeBando bando={heraldicaDe(bandoSur)} posicion="abajo" />
          </div>

          {/* El del SUR a la izquierda y el del NORTE a la derecha, el mismo
              reparto que en la cartela de arriba: si el ojo aprende que la
              izquierda es de uno, no puede cambiar dos bloques más abajo. */}
          <div className="xl:order-1">
            <BattleOrderPanel
              lista={bandoSur.lista}
              color={bandoSur.color}
              puntos={bandoSur.puntos}
              refPorEntrada={bandoSur.refPorEntrada}
              encima={encima}
              onEncima={setEncima}
              ladoDeLaFicha="izquierda"
            />
          </div>
          <div className="xl:order-3">
            <BattleOrderPanel
              lista={bandoNorte.lista}
              color={bandoNorte.color}
              puntos={bandoNorte.puntos}
              refPorEntrada={bandoNorte.refPorEntrada}
              encima={encima}
              onEncima={setEncima}
              ladoDeLaFicha="derecha"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
