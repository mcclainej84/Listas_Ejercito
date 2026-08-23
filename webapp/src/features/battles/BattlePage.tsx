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
//
// LO QUE ESTA PANTALLA NO ENSEÑA, y no enseñarlo es la función:
//
//   · LAS UNIDADES OCULTAS. Las que su dueño marcó como tales en el despliegue
//     no salen aquí: ni peana sobre la mesa, ni línea en el orden de batalla
//     (ver ArmyListEntry.hidden). Es lo que en la partida se declara escondido.
//
//   · LOS PUNTOS DE CADA UNIDAD. Solo el total de cada ejército. Y va con lo
//     anterior: con el total a la vista y todas las partes enumeradas, restar
//     bastaba para saber cuántos puntos se están escondiendo y, con la lista
//     delante, casi siempre qué. Un escondite que se deshace con una resta no
//     es un escondite. El total sí se enseña entero —ocultas incluidas— porque
//     a cuántos puntos se juega es lo que los dos han acordado de antemano.
//
// LA FIRMA DE LOS DOS. Una batalla no la borra cualquiera cuando le apetece:
// cada dueño la da por finalizada desde aquí, y solo con las dos firmas aparece
// el borrado en el listado. Ver BattleRepository.remove.
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
import { urlDelEmblemaDeLista } from '@/domain/armyEmblem'
import { cruzarPosicion, enfrentarPosicion, motivoDeEscenarioDistinto, motivoDeLadoRepetido } from '@/domain/battle'
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
import { mensajeDeMigracionPendiente } from '@/data/repositories/schemaHealth'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession } from '@/shared/session/useSession'
import { useVisibleFactions } from '@/shared/session/useVisibleFactions'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { ArrowLeftIcon, CheckIcon, FileTextIcon, LockIcon } from '@/shared/ui/icons'
import type { ArmyListDetail, ArmyListEntry } from '@/domain/types'

/** Todo lo que hace falta de un bando para pintarlo y para exportarlo. */
interface Bando {
  /**
   * La lista SIN SUS UNIDADES OCULTAS. Es una copia con `entries` filtrado, y
   * el filtro se hace una sola vez aquí a propósito: de este objeto cuelgan la
   * mesa, el orden de batalla y los dos PDF, así que filtrar en el origen es lo
   * único que garantiza que no se escape por ninguna de las cuatro salidas.
   */
  lista: ArmyListDetail
  posiciones: Map<number, DeploymentPosition>
  /** Entradas con peana en la mesa, en el orden de la lista. Sin ocultas. */
  enMesa: ArmyListEntry[]
  /** Iniciales de cada entrada desplegada, numeradas si se repiten. */
  refPorEntrada: Map<number, string>
  color: string
  /** Puntos del ejército ENTERO, contando las ocultas. Ver la cabecera. */
  puntos: number
  /**
   * Puntos de lo que sí se enseña. Solo lo usa el PDF de la lista, que sí
   * detalla unidad por unidad: allí el total tiene que cuadrar con la suma de
   * lo impreso, o el papel se contradice a sí mismo.
   */
  puntosVisibles: number
  /** Cuántas se han quedado fuera. Se dice el número, nunca cuáles. */
  ocultas: number
}

/**
 * Lo que la heráldica necesita de un bando.
 *
 * El emblema es EL DEL EJÉRCITO, no el de su facción: una batalla es
 * justamente donde un contingente se presenta con su propia enseña, y es el
 * sitio donde este ajuste tiene sentido (ver domain/armyEmblem). Cuando nadie
 * lo ha tocado —el caso normal— sale el de la facción igual que antes.
 */
function heraldicaDe(bando: Bando, emblemUrl: string | null): BandoHeraldico {
  return {
    nombreLista: bando.lista.name,
    faccion: { name: bando.lista.faction.name, emblemUrl },
    color: bando.color,
    puntos: bando.puntos,
    unidades: bando.lista.entries.length,
    enMesa: bando.enMesa.length,
  }
}

/**
 * La firma de un bando: en qué estado está y, si el ejército es tuyo, la casilla
 * con la que se pone y se quita.
 *
 * LA CASILLA ES EL MANDO, no un indicador con un botón al lado. Una casilla que
 * dice si algo está hecho y encima se puede pulsar para hacerlo es un gesto que
 * no hay que explicar, y ahorra el botón entero: la barra pasa de dos controles
 * por bando a uno.
 *
 * Se enseñan SIEMPRE las dos, firmadas o no, y también cuando ninguna es tuya.
 * El estado de la partida le importa a todo el grupo —es lo que explica por qué
 * la batalla no se puede borrar todavía— y una fila que solo aparece cuando te
 * toca a ti obliga a adivinar qué pasa cuando no aparece. La diferencia es que
 * la ajena no se puede pulsar y lo dice al pasar el ratón.
 */
function FirmaDeBando({
  nombre,
  finalizada,
  esMio,
  ocupado,
  onFirmar,
}: {
  nombre: string
  finalizada: boolean
  esMio: boolean
  ocupado: boolean
  onFirmar: (finalizada: boolean) => void
}) {
  const marca = (
    <>
      <span
        aria-hidden
        className={clsx(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] border transition-colors',
          finalizada ? 'border-success bg-success text-parchment' : 'border-ink-soft/45 bg-parchment/80',
          esMio && !finalizada && 'group-hover/firma:border-maroon group-hover/firma:bg-maroon/10',
        )}
      >
        {finalizada && <CheckIcon className="h-3 w-3" />}
      </span>
      <span className="max-w-[16rem] truncate text-xs text-ink">{nombre}</span>
    </>
  )

  const marco = clsx(
    'flex items-center gap-2 rounded-sm border px-2 py-1 transition-colors',
    finalizada ? 'border-success/50 bg-success/10' : 'border-rule-dark/35 bg-parchment/60',
  )

  if (!esMio) {
    return (
      <span
        className={clsx(marco, 'cursor-default')}
        title={`${nombre}: ${finalizada ? 'su dueño la ha dado por terminada.' : 'su dueño todavía no la ha dado por terminada.'} Solo él puede marcarla.`}
      >
        {marca}
      </span>
    )
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={finalizada}
      disabled={ocupado}
      onClick={() => onFirmar(!finalizada)}
      className={clsx(marco, 'group/firma text-left hover:border-ink/40 disabled:opacity-60')}
      title={
        finalizada
          ? `Has dado ${nombre} por terminada. Pulsa para retirarlo.`
          : `Pulsa para dar ${nombre} por terminada por tu parte. Con las dos firmas, la batalla se podrá borrar.`
      }
    >
      {marca}
    </button>
  )
}

export function BattlePage() {
  const navigate = useNavigate()
  const battleId = Number(useParams().id)
  const [exportando, setExportando] = useState<string | null>(null)
  const [encima, setEncima] = useState<number | null>(null)

  const { user } = useSession()
  const { factions } = useVisibleFactions()
  const {
    data: batalla,
    loading,
    reload: recargarBatalla,
  } = useAsync(() => BattleRepository.getById(battleId), [battleId])
  const { data: etiquetas } = useAsync(() => UnitTypeTagRepository.listAll())
  /** Lado cuya firma se está guardando ahora mismo, para desactivar su botón. */
  const [firmando, setFirmando] = useState<'a' | 'b' | null>(null)
  const [errorDeFirma, setErrorDeFirma] = useState<string | null>(null)

  /**
   * Da la batalla por finalizada por uno de los dos bandos, o retira la firma.
   *
   * Se recarga la batalla en vez de apañar el estado a mano: la otra firma la
   * pone otra persona en otro ordenador, así que lo que había en pantalla puede
   * estar viejo, y lo que hay que enseñar es lo que hay en la base.
   */
  async function firmar(lado: 'a' | 'b', finalizada: boolean) {
    setFirmando(lado)
    setErrorDeFirma(null)
    try {
      await BattleRepository.setFinalizada(battleId, lado, finalizada)
      await recargarBatalla()
    } catch (err) {
      setErrorDeFirma(mensajeDeMigracionPendiente(err) ?? (err instanceof Error ? err.message : String(err)))
    } finally {
      setFirmando(null)
    }
  }

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

  // SE ESPERA TAMBIÉN A LAS ETIQUETAS, y no es una espera de más: son las que
  // dicen cuánto mide la peana de cada tipo de unidad. Sin ellas, `tamanoDe`
  // se cae al tamaño genérico —más grande que la mayoría de las peanas
  // reales— y las unidades pegadas a un borde se pintan asomando fuera de la
  // mesa, comidas por el marco. Sus posiciones se guardaron para el tamaño de
  // verdad; dibujarlas con otro es dibujar una mesa que no existe.
  if (loading || cargandoBandos || etiquetas == null) return <Spinner />

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

  /**
   * Cómo se lleva un despliegue a la mesa de la batalla.
   *
   *   · `tal-cual`  el bando de abajo, el anfitrión: se pinta como está.
   *   · `media-vuelta` el de arriba, cuando declaró el lado NORTE. Desplegó
   *     viendo la mesa desde su borde (la pantalla se la giró), así que para
   *     traerlo a la vista común hay que deshacer ese giro: media vuelta.
   *   · `cruzar`  el de arriba cuando los dos declararon el MISMO lado. Ahí
   *     media vuelta está mal —le cambiaría la izquierda por la derecha— y
   *     basta con pasarlo al otro lado de la línea central.
   */
  type ComoSeColoca = 'tal-cual' | 'media-vuelta' | 'cruzar'

  function prepararBando(lista: ArmyListDetail, plan: DeploymentPosition[], como: ComoSeColoca): Bando {
    const mover = (p: DeploymentPosition) =>
      como === 'media-vuelta' ? enfrentarPosicion(p, mesa) : como === 'cruzar' ? cruzarPosicion(p, mesa) : p
    const posiciones = new Map(plan.map((p) => [p.entryId, mover(p)] as [number, DeploymentPosition]))
    const todas = [...lista.entries].sort((a, b) => a.sortOrder - b.sortOrder)
    // EL FILTRO, y de aquí no pasa ninguna. Todo lo que se pinta y se exporta
    // sale de `visibles`; `todas` solo se usa para sumar los puntos del
    // ejército, que sí son los de verdad.
    const visibles = todas.filter((e) => !e.hidden)
    const enMesa = visibles.filter((e) => posiciones.has(e.id))
    const costes = new Map(enMesa.map((e) => [e.id, computeEntryCost(e.unit, e)]))
    const referencias = referenciasDeDespliegue(enMesa, costes)
    return {
      lista: { ...lista, entries: visibles },
      posiciones,
      enMesa,
      refPorEntrada: new Map(referencias.map((r) => [r.entryId, r.ref])),
      color: lista.faction.color ?? COLOR_FACCION_POR_DEFECTO,
      puntos: todas.reduce((s, e) => s + computeEntryCost(e.unit, e), 0),
      puntosVisibles: visibles.reduce((s, e) => s + computeEntryCost(e.unit, e), 0),
      ocultas: todas.length - visibles.length,
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
  // Con los dos en el mismo lado —solo las batallas viejas— el de arriba CRUZA
  // en vez de dar media vuelta: ninguno de los dos desplegó viendo la mesa
  // girada, así que comparten izquierda y derecha, y girar a uno le movería el
  // ejército de flanco. Ver domain/battle#cruzarPosicion.
  const mismoLado = listaA.deploymentSide === listaB.deploymentSide
  const arriba: ComoSeColoca = mismoLado ? 'cruzar' : 'media-vuelta'
  const bandoA = prepararBando(listaA, datos?.planA ?? [], aEsNorte ? arriba : 'tal-cual')
  const bandoB = prepararBando(listaB, datos?.planB ?? [], aEsNorte ? 'tal-cual' : arriba)
  /** El de abajo primero: es el orden en que se leen la mesa y los estandartes. */
  const bandoSur = aEsNorte ? bandoB : bandoA
  const bandoNorte = aEsNorte ? bandoA : bandoB
  const bandos = [bandoSur, bandoNorte]

  /** El emblema que le toca a este bando, resuelto una sola vez. */
  function emblemaDe(bando: Bando): string | null {
    return urlDelEmblemaDeLista(bando.lista, factions ?? [])
  }
  const heraldicaSur = heraldicaDe(bandoSur, emblemaDe(bandoSur))
  const heraldicaNorte = heraldicaDe(bandoNorte, emblemaDe(bandoNorte))

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
      // `puntosVisibles` y no `puntos`: este PDF imprime unidad por unidad con
      // su coste, así que el total tiene que ser el de lo impreso. Con el total
      // completo, la hoja se delataría sola — la resta cantaría cuántos puntos
      // faltan. Para el ejército entero, su dueño lo exporta desde Ejércitos.
      await exportArmyListToPdf(bando.lista, bando.puntosVisibles, ventana)
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

  /**
   * ¿Siguen los dos ejércitos desplegando sobre el mismo sitio?
   *
   * El alta de la batalla ya no deja crearla si no coinciden, pero eso se
   * comprobó EL DÍA QUE SE CREÓ: después, cualquiera puede cambiarle el mapa a
   * su lista o redimensionar su mesa, y entonces la batalla se sigue pintando
   * tan tranquila sobre la mesa de la lista A, con el otro ejército colocado
   * para una mesa que ya no es esa. Aquí no se puede arreglar —una batalla no
   * edita nada—, pero sí se puede DECIR, en vez de dejar que se lea como un
   * mapa mal encuadrado, que es exactamente a lo que se parece.
   */
  const escenariosDistintos = motivoDeEscenarioDistinto(listaA, listaB)

  /**
   * ¿Los dos desplegaron desde el mismo borde?
   *
   * ESTE es el aviso importante, y explica el desconcierto que provoca. Para
   * enfrentar dos ejércitos hay que girar a uno, y girarlo mueve sus unidades
   * respecto al TERRENO. Eso solo es correcto si ese jugador desplegó viendo la
   * mesa desde su lado —que es justo lo que hace la pantalla de Despliegue
   * cuando su lado es el norte: le da la vuelta al mapa—. Si los dos
   * desplegaron mirando desde el sur, uno de ellos colocó sus unidades contra
   * un terreno que en la batalla ya no está donde él lo veía, y sus posiciones
   * dejan de corresponderse con el mapa. Se ve exactamente como "las unidades
   * no están donde las puse".
   *
   * El alta ya no permite crear una batalla así (ver motivoDeLadoRepetido),
   * pero las de antes existen y hay que explicarlas.
   */
  const ladoRepetido = motivoDeLadoRepetido(listaA.deploymentSide, listaB.deploymentSide)

  return (
    // La caja ya no hace nada raro: el ancho lo pone AppShell, que ensancha su
    // columna en esta ruta (ver el comentario largo de allí). Esta pantalla se
    // limita a recuperar el aire vertical que le sobra al `py-8` del armazón.
    <div className="-my-4">
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

      {ladoRepetido && (
        <p className="mb-3 rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-ink">
          <b className="text-danger">Ojo: {ladoRepetido}.</b> Ninguno de los dos desplegó viendo la mesa desde su borde,
          así que <b className="text-ink">{bandoNorte.lista.name}</b> se ha pasado al otro lado{' '}
          <b className="text-ink">sin girarlo</b>: cada unidad se queda en la columna donde la pusieron y solo cambia de
          mitad. Es lo más fiel que se puede hacer con este despliegue.
          <br />
          Lo correcto es que cada ejército declare su lado. Ponle <b className="text-ink">lado Norte</b> a uno de los
          dos en su Despliegue: verá la mesa girada —como la va a tener delante— y a partir de ahí los dos se enfrentan
          de verdad, con su terreno. Esta batalla es anterior a la comprobación que ahora lo impide.
        </p>
      )}

      {escenariosDistintos && (
        <p className="mb-3 rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-ink">
          <b className="text-danger">Los dos ejércitos ya no despliegan sobre la misma mesa:</b> {escenariosDistintos}.
          La batalla se dibuja sobre la de <b className="text-ink">{listaA.name}</b>, así que las posiciones del otro
          bando pueden no cuadrar. Se creó cuando sí coincidían; alguien le ha cambiado el mapa o las medidas a una de
          las dos listas desde entonces.
        </p>
      )}

      {/* ---------- Fin de la partida: una firma por bando ---------- */}
      {/* Va ARRIBA del cartel y no al final de la pantalla: es lo que decide si
          la batalla se puede borrar, y al final —debajo de dos listas de veinte
          unidades— no lo habría encontrado nadie. */}
      <section className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-sm border border-rule-dark/30 bg-parchment/40 px-3 py-2">
        <span className="text-micro font-semibold tracking-[0.2em] text-ink-soft/60 uppercase">Fin de la partida</span>
        <FirmaDeBando
          nombre={listaA.name}
          finalizada={batalla.finalizadaA}
          esMio={user != null && listaA.userId === user.id}
          ocupado={firmando != null}
          onFirmar={(v) => void firmar('a', v)}
        />
        <FirmaDeBando
          nombre={listaB.name}
          finalizada={batalla.finalizadaB}
          esMio={user != null && listaB.userId === user.id}
          ocupado={firmando != null}
          onFirmar={(v) => void firmar('b', v)}
        />
        {batalla.finalizadaA && batalla.finalizadaB && (
          <span className="text-mini leading-snug text-ink-soft/80">
            Ya se puede borrar desde el listado de Batallas.
          </span>
        )}
        {errorDeFirma && <span className="w-full text-xs text-danger">{errorDeFirma}</span>}
      </section>

      {/* ---------- El cartel del enfrentamiento ---------- */}
      <CartelaDeEnfrentamiento
        titulo={batalla.name}
        a={heraldicaSur}
        b={heraldicaNorte}
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
          <EstandarteDeBando bando={heraldicaNorte} posicion="arriba" />

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
                backgroundImage: 'repeating-linear-gradient(to right, rgba(122,36,32,.55) 0 8px, transparent 8px 16px)',
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
                // SIN CORRECCIONES. Cada peana se pinta EXACTAMENTE donde la
                // dejó su jugador. Hubo aquí una "red" que la metía dentro de
                // la mesa si se salía, y estaba mal pensada: una batalla es el
                // acta de un despliegue, y un acta que endereza lo que copia
                // deja de ser un acta. Si algo no cuadra hay que DECIRLO —eso
                // son los avisos de arriba—, no moverlo en silencio para que
                // parezca que cuadra.
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

          <EstandarteDeBando bando={heraldicaSur} posicion="abajo" />
        </div>

        {/* El del SUR a la izquierda y el del NORTE a la derecha, el mismo
            reparto que en la cartela de arriba: si el ojo aprende que la
            izquierda es de uno, no puede cambiar dos bloques más abajo. */}
        <div className="xl:order-1">
          <BattleOrderPanel
            lista={bandoSur.lista}
            emblemUrl={emblemaDe(bandoSur)}
            color={bandoSur.color}
            puntos={bandoSur.puntos}
            refPorEntrada={bandoSur.refPorEntrada}
            encima={encima}
            onEncima={setEncima}
            ladoDeLaFicha="izquierda"
            ocultasPropias={user != null && bandoSur.lista.userId === user.id ? bandoSur.ocultas : 0}
          />
        </div>
        <div className="xl:order-3">
          <BattleOrderPanel
            lista={bandoNorte.lista}
            emblemUrl={emblemaDe(bandoNorte)}
            color={bandoNorte.color}
            puntos={bandoNorte.puntos}
            refPorEntrada={bandoNorte.refPorEntrada}
            encima={encima}
            onEncima={setEncima}
            ladoDeLaFicha="derecha"
            ocultasPropias={user != null && bandoNorte.lista.userId === user.id ? bandoNorte.ocultas : 0}
          />
        </div>
      </div>
    </div>
  )
}
