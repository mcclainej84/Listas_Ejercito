// ============================================================================
// "Despliegue" — la mesa de mando: colocar el ejército sobre el tablero antes
// de la partida.
//
// LA PANTALLA ES UN PUESTO DE MANDO, no un formulario. Tres columnas: el ORDEN
// DE BATALLA a la izquierda, la MESA en el centro y los CONTROLES a la derecha.
// OCUPA LA VENTANA ENTERA. El contenedor cancela con márgenes negativos el
// ancho máximo del resto del programa, porque aquí el ancho ES la herramienta:
// una mesa apaisada en 56 rem no se puede leer.
//
// Ojo con el detalle que ya falló una vez: los márgenes negativos solo estiran
// un elemento de ancho AUTOMÁTICO. Con `w-full` el ancho queda fijado al del
// padre y lo único que hacen es desplazarlo, que era justo por qué la mesa
// salía diminuta y pegada a la izquierda.
//
// Y CABE EN 1080p SIN DESPLAZARSE, porque la mesa se limita también POR ALTO
// (ver el `maxWidth` calculado con la proporción del tablero): un elemento con
// `aspect-ratio` crece de alto sin freno, y una mesa de 240 × 180 se salía por
// abajo.
//
// EL ORDEN DE BATALLA NO SE VACÍA. Antes, poner una unidad sobre la mesa la
// borraba de la lista, y con medio ejército desplegado no había forma de saber
// qué llevabas. Ahora están SIEMPRE las mismas filas y lo que cambia es su
// estado: un cuadro relleno si está en la mesa, hueco si sigue en reserva. La
// lista es el índice del ejército, no una bandeja de pendientes.
//
// Y VA EN LOS DOS SENTIDOS: al elegir una peana en la mesa, su fila se marca y
// se desplaza a la vista; al pulsar una fila desplegada, se elige su peana. Con
// veinte unidades iguales de emblema, ese vínculo es lo único que dice cuál es
// cuál.
//
// LA LISTA ENSEÑA LO MÍNIMO: nombre y cuántas miniaturas son. Todo lo demás
// —perfil, equipo, opciones, montura, reglas— sale al pasar el ratón, en la
// ficha emergente (ver EntryDetailCard). Con veinte unidades, meter el detalle
// en la propia fila convierte la lista en un muro de texto que no se puede
// recorrer con la vista.
//
// CENTÍMETROS, NO PÍXELES. Todo lo que se guarda y todo lo que se calcula va en
// cm reales de mesa; los píxeles solo aparecen al pintar y al leer el ratón, y
// se convierten en el acto (ver `aCm`).
//
// DE DÓNDE SALE EL TAMAÑO DE UNA PEANA. Primero el que se le haya dado a mano
// arrastrando su esquina; si no, el estándar de su etiqueta (configurable en
// Categorías y Etiquetas); y si no tiene etiqueta, 4 × 4 un personaje y 12 × 10
// una tropa. Ver domain/deployment#tamanoDeEntrada.
//
// MESA LIBRE O MAPA. Sin mapa cargado, la mesa es la de siempre: sus medidas
// se ajustan con las barras y el tablero está vacío. Al cargar un MAPA (los
// hace cualquiera en la sección Mapas y son públicos), sus medidas mandan —las
// barras desaparecen— y su escenografía se pinta de fondo SIN poder tocarse:
// aquí se despliega el ejército, no se rehace el terreno. Para cambiar el mapa
// se edita el mapa, que es donde eso significa algo.
//
// Es un BORRADOR: se edita en memoria y se persiste con "Guardar despliegue".
// Así arrastrar veinte veces no son veinte escrituras en la base.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { ArmyListRepository } from '@/data/repositories/armyListRepository'
import { UnitTypeTagRepository } from '@/data/repositories/lookupRepositories'
import { MapRepository } from '@/data/repositories/mapRepository'
import { computeEntryCost } from '@/domain/armyValidation'
import {
  MESA_ALTO_MAX_CM,
  MESA_ALTO_MIN_CM,
  MESA_ANCHO_MAX_CM,
  MESA_ANCHO_MIN_CM,
  PEANA_MAX_CM,
  PEANA_MIN_CM,
  RETICULA_CM,
  acotar,
  alinearFrentes,
  limitarAMesa,
  limitarDesplazamiento,
  peanaDentroDelRectangulo,
  redondearCm,
  tamanoDeEntrada,
  type DeploymentPosition,
  type Mesa,
  type RectanguloCm,
  type TamanoCm,
} from '@/domain/deployment'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession } from '@/shared/session/useSession'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { ArrowLeftIcon, CategoryShield, FileTextIcon, LockIcon, TrashIcon } from '@/shared/ui/icons'
import { categoryShieldMetal } from '@/features/army-lists/categoryShield'
import { COLOR_FACCION_POR_DEFECTO, estiloDePeana, textoSobre } from '@/domain/factionColor'
import { cuerpoDeAliasCm, referenciasDeDespliegue } from '@/domain/deploymentRefs'
import { exportDeploymentToPdf } from '@/features/army-lists/exportDeploymentPdf'
import { abrirPestanaPdf, cerrarPestanaPdf } from '@/features/army-lists/pdfWindow'
import { renderTableCanvas } from '@/features/maps/renderTableCanvas'
import { EntryDetailCard } from '@/features/army-lists/EntryDetailCard'
import { SceneryShape } from '@/features/maps/SceneryShape'
import { estiloDeSueloDeMapa } from '@/features/maps/tableSurface'
import { FloorAssetRepository } from '@/data/repositories/sceneryAssetRepository'
import { Tooltip } from '@/shared/ui/Tooltip'
import { compressImageFile, medirImagen } from '@/shared/image'
import { hashDeContenido, imageUrl, uploadImageAtKey } from '@/data/network/images'
import type { ArmyListEntry, LadoDeDespliegue } from '@/domain/types'

function nombreDeLaEntrada(entry: ArmyListEntry): string {
  return entry.alias ?? entry.unit.name
}

/**
 * Rótulo de sección de la barra lateral: versalita espaciada entre dos filetes.
 * Es el mismo gesto tipográfico que la "HOJA DE EJÉRCITO" del PDF, para que las
 * dos cosas se reconozcan como del mismo programa.
 */
function Rotulo({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="text-[10px] font-semibold tracking-[0.18em] text-ink-soft uppercase">{children}</span>
      <span className="h-px flex-1 bg-rule-dark/30" />
      {extra}
    </div>
  )
}

export function DeploymentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useSession()
  const listId = Number(id)

  const { data: list, loading } = useAsync(() => ArmyListRepository.getDetailById(listId), [listId])
  const { data: guardado, loading: cargandoPlan } = useAsync(() => ArmyListRepository.getDeployment(listId), [listId])
  const { data: etiquetas } = useAsync(() => UnitTypeTagRepository.listAll())

  /** Posiciones EN CENTÍMETROS, por id de entrada. Sin clave = en reserva. */
  const [posiciones, setPosiciones] = useState<Map<number, DeploymentPosition>>(new Map())
  const [mesa, setMesa] = useState<Mesa | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [recuadro, setRecuadro] = useState<RectanguloCm | null>(null)
  /** Peana bajo el ratón: la que enseña su nombre y su cantidad. */
  const [encima, setEncima] = useState<number | null>(null)
  /** Mapa cargado; null = mesa libre. */
  const [mapaId, setMapaId] = useState<number | null>(null)
  /**
   * Imagen de fondo propia (clave en R2). Es una alternativa AL MAPA, no un
   * añadido: o se despliega sobre un mapa del grupo, o sobre una imagen suelta
   * de esta lista, o sobre la mesa desnuda. Mezclar las dos dejaría la
   * escenografía de un mapa flotando sobre la foto de otro sitio.
   */
  const [imagenKey, setImagenKey] = useState<string | null>(null)
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const imagenRef = useRef<HTMLInputElement>(null)
  /**
   * Lado del tablero desde el que se despliega. Las peanas van SIEMPRE abajo;
   * lo que cambia es la perspectiva del terreno (ver ArmyList.deploymentSide).
   */
  const [lado, setLado] = useState<LadoDeDespliegue>('sur')

  // Los mapas ocultos de otros no se ofrecen: para quien despliega no existen.
  const { data: mapasDisponibles } = useAsync(() => MapRepository.listAll(user?.id ?? null), [user?.id])
  const { data: mapaCargado } = useAsync(
    () => (mapaId != null ? MapRepository.getById(mapaId) : Promise.resolve(null)),
    [mapaId],
  )
  // El suelo se pide por el id guardado en el mapa —su versión—, no por el
  // vigente: desplegar sobre un mapa tiene que enseñar el mapa tal cual es.
  const { data: sueloDelMapa } = useAsync(
    () => (mapaCargado?.floorId ? FloorAssetRepository.getById(mapaCargado.floorId) : Promise.resolve(null)),
    [mapaCargado?.floorId],
  )

  useEffect(() => {
    if (guardado) setPosiciones(new Map(guardado.map((p) => [p.entryId, p])))
  }, [guardado])
  useEffect(() => {
    if (!list) return
    setMesa({ anchoCm: list.tableWidthCm, altoCm: list.tableHeightCm })
    setMapaId(list.battleMapId)
    setImagenKey(list.deploymentImageKey)
    setLado(list.deploymentSide)
  }, [list])

  const mesaRef = useRef<HTMLDivElement>(null)
  /** Fila de cada entrada en el orden de batalla, para poder traerla a la vista. */
  const filasRef = useRef(new Map<number, HTMLLIElement>())
  /**
   * Arrastre en curso: dónde estaba el ratón al empezar y dónde estaba CADA
   * peana que se mueve. Se guardan las posiciones de partida en vez de ir
   * acumulando incrementos porque, al recortar el desplazamiento contra el
   * borde, los incrementos acumulados iban perdiendo la formación.
   */
  const agarre = useRef<{
    xCm: number
    yCm: number
    inicio: Map<number, DeploymentPosition>
  } | null>(null)
  const redim = useRef<{ entryId: number; xCm: number; yCm: number } | null>(null)
  const inicioRecuadro = useRef<{ xCm: number; yCm: number } | null>(null)

  const esDeOtro = list != null && list.userId != null && user != null && list.userId !== user.id
  const { data: acceso, loading: cargandoComparticion } = useAsync(
    () =>
      esDeOtro && list && user
        ? ArmyListRepository.getShareAccess(list.id, user.id)
        : Promise.resolve({ compartida: false, conDespliegue: false }),
    [esDeOtro, list?.id, user?.id],
  )
  const soloLectura = esDeOtro && acceso?.compartida === true
  const puedeVerlo = !esDeOtro || acceso?.conDespliegue === true

  // Con mapa cargado, sus medidas MANDAN: el tablero es el suyo y no se toca.
  const mesaActual: Mesa = mapaCargado
    ? { anchoCm: mapaCargado.anchoCm, altoCm: mapaCargado.altoCm }
    : (mesa ?? { anchoCm: list?.tableWidthCm ?? 180, altoCm: list?.tableHeightCm ?? 120 })
  const conMapa = mapaCargado != null
  const imagenFondoUrl = !conMapa && imagenKey ? imageUrl(imagenKey) : null
  /** El terreno se pinta del revés: es lo que se ve desde el norte de la mesa. */
  const girado = lado === 'norte'

  function tamanoDe(entry: ArmyListEntry): TamanoCm {
    const pos = posiciones.get(entry.id)
    const etiqueta = etiquetas?.find((t) => t.id === entry.unit.typeTag?.id)
    return tamanoDeEntrada({
      unitType: entry.unit.unitType,
      tamanoEtiqueta: etiqueta ? { anchoCm: etiqueta.baseWidthCm, altoCm: etiqueta.baseHeightCm } : null,
      tamanoPropio: pos?.anchoCm != null && pos.altoCm != null ? { anchoCm: pos.anchoCm, altoCm: pos.altoCm } : null,
    })
  }

  function tamanoPorId(entryId: number): TamanoCm {
    const entry = list?.entries.find((e) => e.id === entryId)
    return entry ? tamanoDe(entry) : { anchoCm: 12, altoCm: 10 }
  }

  /** Píxeles del lienzo → centímetros de mesa. Es la única conversión del archivo. */
  function aCm(clientX: number, clientY: number): { xCm: number; yCm: number } {
    const caja = mesaRef.current?.getBoundingClientRect()
    if (!caja) return { xCm: 0, yCm: 0 }
    return {
      xCm: ((clientX - caja.left) / caja.width) * mesaActual.anchoCm,
      yCm: ((clientY - caja.top) / caja.height) * mesaActual.altoCm,
    }
  }

  function colocar(entry: ArmyListEntry, xCm: number, yCm: number) {
    const dentro = limitarAMesa(xCm, yCm, tamanoDe(entry), mesaActual)
    setPosiciones((prev) => {
      const next = new Map(prev)
      const actual = prev.get(entry.id)
      next.set(entry.id, {
        entryId: entry.id,
        xCm: redondearCm(dentro.xCm),
        yCm: redondearCm(dentro.yCm),
        anchoCm: actual?.anchoCm ?? null,
        altoCm: actual?.altoCm ?? null,
      })
      return next
    })
    setDirty(true)
  }

  /** Vacía la mesa de golpe: todas las unidades vuelven a la reserva. */
  /**
   * El despliegue en un PDF: el mapa pintado con las peanas y, en la página
   * siguiente, la leyenda que dice quién es cada referencia.
   *
   * El mapa se pinta desde los datos (renderTableCanvas) y no capturando la
   * pantalla, así que sale igual sea cual sea el tamaño de la ventana.
   */
  async function exportarDespliegue(ventana: Window | null) {
    // El botón solo existe con la lista cargada, pero TypeScript no lo sabe y
    // tiene razón en no fiarse.
    if (!list) return
    setExportando(true)
    setError(null)
    try {
      const canvas = await renderTableCanvas({
        mesa: mesaActual,
        textura: mapaCargado?.textura ?? 'ninguna',
        imagenFondoUrl,
        girado,
        suelo: sueloDelMapa ?? null,
        piezas: mapaCargado?.piezas ?? [],
        peanas: enMesa.map((entry) => {
          const pos = posiciones.get(entry.id)!
          const tamano = tamanoDe(entry)
          const color = entry.unit.faction.color ?? COLOR_FACCION_POR_DEFECTO
          return {
            xCm: pos.xCm,
            yCm: pos.yCm,
            anchoCm: tamano.anchoCm,
            altoCm: tamano.altoCm,
            color,
            colorTexto: textoSobre(color),
            texto: refPorEntrada.get(entry.id) ?? '',
          }
        }),
      })
      exportDeploymentToPdf(
        {
          nombreLista: list.name,
          faccion: list.faction.name,
          colorFaccion: list.faction.color ?? COLOR_FACCION_POR_DEFECTO,
          colorTexto: textoSobre(list.faction.color),
          mapa: canvas,
          anchoCm: mesaActual.anchoCm,
          altoCm: mesaActual.altoCm,
          nombreMapa: mapaCargado?.name ?? null,
          referencias,
          puntosDesplegados,
          puntosTotales,
        },
        ventana,
      )
    } catch (err) {
      cerrarPestanaPdf(ventana)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setExportando(false)
    }
  }

  function retirarTodas() {
    setPosiciones(new Map())
    setSeleccion(new Set())
    setDirty(true)
  }

  function retirar(entryIds: number[]) {
    setPosiciones((prev) => {
      const next = new Map(prev)
      for (const id of entryIds) next.delete(id)
      return next
    })
    setSeleccion(new Set())
    setDirty(true)
  }

  function moverGrupo(dxCm: number, dyCm: number) {
    const enJuego = agarre.current
    if (!enJuego) return
    const peanas = [...enJuego.inicio.values()].map((p) => ({
      entryId: p.entryId,
      xCm: p.xCm,
      yCm: p.yCm,
      tamano: tamanoPorId(p.entryId),
    }))
    const d = limitarDesplazamiento(peanas, dxCm, dyCm, mesaActual)
    setPosiciones((prev) => {
      const next = new Map(prev)
      for (const p of enJuego.inicio.values()) {
        next.set(p.entryId, {
          ...p,
          xCm: redondearCm(p.xCm + d.dxCm),
          yCm: redondearCm(p.yCm + d.dyCm),
        })
      }
      return next
    })
    setDirty(true)
  }

  function redimensionar(entryId: number, anchoCm: number, altoCm: number) {
    setPosiciones((prev) => {
      const actual = prev.get(entryId)
      if (!actual) return prev
      const ancho = redondearCm(acotar(anchoCm, PEANA_MIN_CM, Math.min(PEANA_MAX_CM, mesaActual.anchoCm)))
      const alto = redondearCm(acotar(altoCm, PEANA_MIN_CM, Math.min(PEANA_MAX_CM, mesaActual.altoCm)))
      const dentro = limitarAMesa(actual.xCm, actual.yCm, { anchoCm: ancho, altoCm: alto }, mesaActual)
      const next = new Map(prev)
      next.set(entryId, {
        ...actual,
        xCm: dentro.xCm,
        yCm: dentro.yCm,
        anchoCm: ancho,
        altoCm: alto,
      })
      return next
    })
    setDirty(true)
  }

  function restaurarTamano(entryIds: number[]) {
    setPosiciones((prev) => {
      const next = new Map(prev)
      for (const id of entryIds) {
        const actual = next.get(id)
        if (actual) next.set(id, { ...actual, anchoCm: null, altoCm: null })
      }
      return next
    })
    setDirty(true)
  }

  /** Trae la fila de una entrada a la vista: el vínculo mesa → orden de batalla. */
  function enfocarFila(entryId: number) {
    filasRef.current.get(entryId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  /**
   * Pulsar una fila del orden de batalla. Si está en reserva, la despliega; si
   * ya está en la mesa, la selecciona (y no la mueve): pulsar el índice no
   * debería recolocar nada.
   */
  function pulsarFila(entry: ArmyListEntry) {
    if (soloLectura) {
      if (posiciones.has(entry.id)) setSeleccion(new Set([entry.id]))
      return
    }
    if (posiciones.has(entry.id)) {
      setSeleccion(new Set([entry.id]))
      return
    }
    const yaPuestas = posiciones.size
    const columna = yaPuestas % 10
    const fila = Math.floor(yaPuestas / 10)
    colocar(entry, 12 + columna * 17, mesaActual.altoCm - 12 - fila * 13)
    setSeleccion(new Set([entry.id]))
  }

  function handleAlinear(entradas: ArmyListEntry[]) {
    const enMesa = entradas.filter((e) => posiciones.has(e.id))
    if (enMesa.length < 2) return
    const alineadas = alinearFrentes(
      enMesa.map((entry) => {
        const p = posiciones.get(entry.id)!
        return {
          entryId: entry.id,
          xCm: p.xCm,
          yCm: p.yCm,
          tamano: tamanoDe(entry),
        }
      }),
      mesaActual,
    )
    setPosiciones((prev) => {
      const next = new Map(prev)
      for (const a of alineadas) {
        const actual = next.get(a.entryId)
        if (actual) next.set(a.entryId, { ...actual, xCm: a.xCm, yCm: a.yCm })
      }
      return next
    })
    setDirty(true)
  }

  /** Cambia las medidas de la mesa y reencaja lo que se quede fuera. */
  function cambiarMesa(anchoCm: number, altoCm: number) {
    const nueva: Mesa = {
      anchoCm: acotar(anchoCm, MESA_ANCHO_MIN_CM, MESA_ANCHO_MAX_CM),
      altoCm: acotar(altoCm, MESA_ALTO_MIN_CM, MESA_ALTO_MAX_CM),
    }
    setMesa(nueva)
    // Encoger la mesa dejaría unidades fuera del tablero. En vez de perderlas
    // en un limbo invisible, se las mete de vuelta por el borde más cercano.
    setPosiciones((prev) => {
      const next = new Map(prev)
      for (const [entryId, p] of prev) {
        const dentro = limitarAMesa(p.xCm, p.yCm, tamanoPorId(entryId), nueva)
        next.set(entryId, {
          ...p,
          xCm: redondearCm(dentro.xCm),
          yCm: redondearCm(dentro.yCm),
        })
      }
      return next
    })
    setDirty(true)
  }

  /**
   * Carga un mapa (o vuelve a mesa libre) y reencaja lo que se quede fuera: dos
   * mapas no tienen por qué medir lo mismo.
   */
  function cambiarMapa(nuevoId: number | null) {
    const destino = nuevoId != null ? mapasDisponibles?.find((m) => m.id === nuevoId) : null
    const nuevaMesa: Mesa = destino
      ? { anchoCm: destino.anchoCm, altoCm: destino.altoCm }
      : { anchoCm: list?.tableWidthCm ?? 180, altoCm: list?.tableHeightCm ?? 120 }
    setMapaId(nuevoId)
    setPosiciones((prev) => {
      const next = new Map(prev)
      for (const [entryId, p] of prev) {
        const dentro = limitarAMesa(p.xCm, p.yCm, tamanoPorId(entryId), nuevaMesa)
        next.set(entryId, { ...p, xCm: redondearCm(dentro.xCm), yCm: redondearCm(dentro.yCm) })
      }
      return next
    })
    setDirty(true)
  }

  /**
   * Sube una imagen de fondo y AJUSTA LA MESA a su proporción.
   *
   * Lo segundo es la mitad del truco: la imagen se estira al tablero, así que si
   * la mesa no tiene su misma proporción, el mapa sale deformado y las
   * distancias mienten. Cambiando el fondo de la mesa para que cuadre con la
   * imagen, se estira sin deformar y el ancho —que es lo que uno tiene decidido—
   * no se toca. Después se puede reajustar con las barras de siempre.
   *
   * La imagen NO pasa por `prepararImagenDeEscenografia`: eso quita el fondo
   * liso y recorta al contenido, que es lo que hay que hacerle a una pieza de
   * escenografía recortada y justo lo contrario de lo que necesita la foto de un
   * escenario, donde el fondo ES el contenido.
   */
  async function subirImagenDeFondo(file: File | undefined) {
    if (!file) return
    setSubiendoImagen(true)
    setError(null)
    try {
      const comprimida = await compressImageFile(file, { maxSize: 2000, keepAlpha: false })
      const ext = comprimida.mime === 'image/png' ? 'png' : comprimida.mime === 'image/jpeg' ? 'jpg' : 'webp'
      const key = `despliegue/${listId}/${await hashDeContenido(comprimida.bytes)}.${ext}`
      await uploadImageAtKey(key, comprimida.bytes, comprimida.mime)
      // Las medidas de la imagen se leen del blob que acabamos de comprimir, no
      // del archivo original: son las que de verdad se van a pintar.
      const medidas = await medirImagen(comprimida.bytes, comprimida.mime)
      setMapaId(null)
      setImagenKey(key)
      if (medidas) {
        const alto = acotar(
          Math.round((mesaActual.anchoCm * medidas.alto) / medidas.ancho),
          MESA_ALTO_MIN_CM,
          MESA_ALTO_MAX_CM,
        )
        cambiarMesa(mesaActual.anchoCm, alto)
      }
      setDirty(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubiendoImagen(false)
    }
  }

  function quitarImagenDeFondo() {
    setImagenKey(null)
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      // EL LADO Y LA IMAGEN VAN APARTE Y NO PUEDEN TUMBAR EL RESTO. Son las
      // columnas de la migración más reciente, así que con la D1 sin actualizar
      // fallan; y colocar el ejército sobre la mesa funcionaba desde mucho antes
      // que ellas. Dejar que se lleven por delante el guardado de las posiciones
      // sería estrenar dos ajustes rompiendo la función que ya estaba.
      let faltaEsquema = false
      try {
        await ArmyListRepository.setDeploymentSide(listId, lado)
        await ArmyListRepository.setDeploymentImageKey(listId, conMapa ? null : imagenKey)
      } catch {
        faltaEsquema = true
      }
      await ArmyListRepository.setBattleMap(listId, mapaId)
      // Las medidas propias solo se guardan sin mapa: con mapa son las suyas y
      // pisarlas aquí dejaría una copia que se desincroniza en cuanto alguien
      // edite el mapa.
      if (!conMapa) await ArmyListRepository.setTableSize(listId, mesaActual.anchoCm, mesaActual.altoCm)
      await ArmyListRepository.saveDeployment(listId, [...posiciones.values()])
      setDirty(false)
      if (faltaEsquema) {
        setError(
          'El despliegue se ha guardado, pero el lado y la imagen de fondo no: a la base de datos le faltan esas ' +
            'columnas. Se arregla desplegando el Worker (cd webapp/worker && npx wrangler deploy).',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading || cargandoPlan || cargandoComparticion) return <Spinner />

  if (!list) {
    return (
      <div>
        <button onClick={() => navigate('/ejercitos')} className="mb-3 text-sm text-ink-soft hover:text-ink">
          ← Volver a Ejércitos
        </button>
        <p className="text-sm text-ink">No se ha encontrado este ejército.</p>
      </div>
    )
  }

  // Dos negativas distintas y con mensajes distintos: no es lo mismo "esta
  // lista no es tuya" que "esta lista sí, pero su despliegue no".
  if (esDeOtro && !soloLectura) {
    return (
      <div>
        <button onClick={() => navigate('/ejercitos')} className="mb-3 text-sm text-ink-soft hover:text-ink">
          ← Volver a Ejércitos
        </button>
        <div className="rounded-sm border border-rule-dark/40 bg-parchment/70 px-4 py-3">
          <p className="text-sm text-ink">Este ejército es de otro usuario.</p>
        </div>
      </div>
    )
  }

  if (!puedeVerlo) {
    return (
      <div>
        <button onClick={() => navigate(`/ejercitos/${list.id}`)} className="mb-3 text-sm text-ink-soft hover:text-ink">
          ← Volver al ejército
        </button>
        <div className="rounded-sm border border-rule-dark/40 bg-parchment/70 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-ink">
            <LockIcon className="h-4 w-4 text-ink-soft" />
            Te han compartido este ejército, pero no su despliegue.
          </p>
        </div>
      </div>
    )
  }

  const entradas = [...list.entries].sort((a, b) => a.sortOrder - b.sortOrder)
  const enMesa = entradas.filter((e) => posiciones.has(e.id))
  const seleccionadas = entradas.filter((e) => seleccion.has(e.id) && posiciones.has(e.id))
  const puntosDesplegados = enMesa.reduce((suma, e) => suma + computeEntryCost(e.unit, e), 0)
  const puntosTotales = entradas.reduce((suma, e) => suma + computeEntryCost(e.unit, e), 0)
  /**
   * La REFERENCIA de cada unidad desplegada: sus iniciales, numeradas si otra
   * unidad de la mesa comparte las mismas (ver domain/deploymentRefs). Es lo
   * que se pinta en la peana y lo que desarrolla la leyenda del PDF, así que
   * pantalla y papel dicen exactamente lo mismo.
   */
  const referencias = referenciasDeDespliegue(enMesa, new Map(enMesa.map((e) => [e.id, computeEntryCost(e.unit, e)])))
  const refPorEntrada = new Map(referencias.map((r) => [r.entryId, r.ref]))

  /** Cuerpo de letra de las referencias, igual para toda la mesa. */
  const cuerpoAliasCm = cuerpoDeAliasCm(
    enMesa.map((entry) => ({ texto: refPorEntrada.get(entry.id) ?? '', tamano: tamanoDe(entry) })),
  )
  /** Marcas de la regla, cada 30 cm. La del 0 sobra: es el propio borde. */
  const marcasX = Array.from({ length: Math.floor(mesaActual.anchoCm / RETICULA_CM) }, (_, i) => (i + 1) * RETICULA_CM)
  const marcasY = Array.from({ length: Math.floor(mesaActual.altoCm / RETICULA_CM) }, (_, i) => (i + 1) * RETICULA_CM)

  return (
    <div className="-mx-6 -my-8 px-6 py-4 xl:-mx-[max(0px,calc((100vw-56rem)/2))]">
      {/* ---------- Cabecera: filete doble, como el encabezado del PDF ---------- */}
      <header className="mb-4 border-b border-rule-dark/30 pb-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.22em] text-ink-soft uppercase">Despliegue</p>
            <h1 className="truncate font-display text-2xl leading-tight text-ink">{list.name}</h1>
          </div>

          {/* Marcador: lo desplegado frente al total. Tres datos en versalitas
              pequeñas y cifras grandes, para poder leerlo de un vistazo desde
              lejos mientras se coloca. */}
          <dl className="flex shrink-0 items-stretch gap-5">
            <div className="px-3 text-center">
              <dt className="text-[9px] tracking-[0.16em] text-ink-soft uppercase">Mesa</dt>
              <dd className="font-display text-lg leading-tight text-ink tabular-nums">
                {mesaActual.anchoCm}×{mesaActual.altoCm}
              </dd>
            </div>
            <div className="px-3 text-center">
              <dt className="text-[9px] tracking-[0.16em] text-ink-soft uppercase">Desplegadas</dt>
              <dd className="font-display text-lg leading-tight text-ink tabular-nums">
                {enMesa.length}
                <span className="text-ink-soft/60">/{entradas.length}</span>
              </dd>
            </div>
            <div className="px-3 text-center">
              <dt className="text-[9px] tracking-[0.16em] text-ink-soft uppercase">Puntos</dt>
              <dd className="font-display text-lg leading-tight text-maroon tabular-nums">
                {puntosDesplegados}
                <span className="text-ink-soft/60">/{puntosTotales}</span>
              </dd>
            </div>
          </dl>

          <div className="flex shrink-0 items-center gap-3">
            {soloLectura && (
              <span className="flex items-center gap-1.5 rounded-sm border border-rule-dark/40 px-2 py-1 text-xs font-medium text-ink-soft">
                <LockIcon className="h-3.5 w-3.5" />
                Solo lectura
              </span>
            )}
            {dirty && <span className="text-xs font-medium text-bronze">● Sin guardar</span>}
            <Button variant="ghost" onClick={() => navigate(`/ejercitos/${list.id}`)}>
              <ArrowLeftIcon className="h-4 w-4" />
              Ejército
            </Button>
            <Button
              variant="secondary"
              disabled={exportando || enMesa.length === 0}
              onClick={() => {
                // La pestaña se abre AQUÍ, en el propio clic: pintar el mapa y
                // armar el PDF tarda lo suyo y para entonces el navegador ya no
                // deja abrir nada (ver pdfWindow).
                const ventana = abrirPestanaPdf()
                void exportarDespliegue(ventana)
              }}
            >
              <FileTextIcon className="h-4 w-4" />
              {exportando ? 'Exportando…' : 'Exportar'}
            </Button>
            {!soloLectura && (
              <Button variant="primary" onClick={handleSave} disabled={!dirty || saving}>
                {saving ? 'Guardando…' : 'Guardar despliegue'}
              </Button>
            )}
          </div>
        </div>
      </header>

      {error && <p className="mb-3 text-sm text-danger">No se pudo guardar: {error}</p>}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* ================= Izquierda: orden de batalla ================= */}
        <aside className="w-full shrink-0 lg:w-64">
          <Rotulo
            extra={
              <span className="text-[10px] text-ink-soft/70 tabular-nums">
                {enMesa.length}/{entradas.length}
              </span>
            }
          >
            Orden de batalla
          </Rotulo>

          {entradas.length === 0 ? (
            <p className="text-xs text-ink-soft italic">Este ejército todavía no tiene unidades.</p>
          ) : (
            <ul className="max-h-[calc(100vh-16rem)] space-y-1 overflow-y-auto pr-1">
              {entradas.map((entry) => {
                const desplegada = posiciones.has(entry.id)
                const elegida = seleccion.has(entry.id)
                const metal = categoryShieldMetal(entry.unit.category?.code)
                return (
                  <li
                    key={entry.id}
                    ref={(el) => {
                      if (el) filasRef.current.set(entry.id, el)
                      else filasRef.current.delete(entry.id)
                    }}
                  >
                    <Tooltip
                      label={<EntryDetailCard entry={entry} />}
                      maxWidth="20rem"
                      posicion="derecha"
                      tono="claro"
                      className="block w-full"
                    >
                      <button
                        type="button"
                        onClick={() => pulsarFila(entry)}
                        className={clsx(
                          'flex w-full items-center gap-1.5 border-l-2 py-1 pr-2 pl-2 text-left transition-colors',
                          elegida
                            ? 'border-l-maroon bg-maroon/10'
                            : desplegada
                              ? 'border-l-bronze/60 bg-parchment/70 hover:bg-parchment-dark/60'
                              : 'border-l-transparent hover:border-l-rule-dark/40 hover:bg-parchment-dark/40',
                        )}
                      >
                        {/* Cuadro relleno = sobre la mesa; hueco = en reserva.
                            Es el único distintivo de estado, y va primero
                            porque es lo que se busca al repasar la lista. */}
                        <span
                          aria-hidden
                          className={clsx(
                            'h-2 w-2 shrink-0 rounded-[1px] border',
                            desplegada ? 'border-maroon bg-maroon' : 'border-ink-soft/50',
                          )}
                        />
                        {metal && <CategoryShield metal={metal} className="h-3.5 w-3.5 shrink-0" />}
                        <span
                          className={clsx(
                            'min-w-0 flex-1 truncate text-xs',
                            desplegada ? 'font-medium text-ink' : 'text-ink-soft',
                          )}
                        >
                          {nombreDeLaEntrada(entry)}
                        </span>
                        {/* Solo la CANTIDAD. Lo demás está en la ficha
                            emergente: en una lista de veinte, cada dato de más
                            es una línea que hay que saltarse. */}
                        <span className="shrink-0 text-[11px] text-ink-soft/70 tabular-nums">{entry.quantity}</span>
                      </button>
                    </Tooltip>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {/* ================= Centro: la mesa ================= */}
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
                    // El tablero es el CONTENEDOR contra el que se mide el
                    // cuerpo de letra de las iniciales (unidades `cqw`): así
                    // una letra ocupa siempre los mismos centímetros de mesa,
                    // se vea la pantalla como se vea.
                    containerType: 'inline-size',
                  }}
                  onPointerDown={(e) => {
                    if (soloLectura || e.button !== 0) return
                    const p = aCm(e.clientX, e.clientY)
                    inicioRecuadro.current = p
                    setRecuadro({ x1: p.xCm, y1: p.yCm, x2: p.xCm, y2: p.yCm })
                    e.currentTarget.setPointerCapture(e.pointerId)
                  }}
                  onPointerMove={(e) => {
                    const origen = inicioRecuadro.current
                    if (!origen) return
                    const p = aCm(e.clientX, e.clientY)
                    setRecuadro({
                      x1: origen.xCm,
                      y1: origen.yCm,
                      x2: p.xCm,
                      y2: p.yCm,
                    })
                  }}
                  onPointerUp={() => {
                    const rect = recuadro
                    inicioRecuadro.current = null
                    setRecuadro(null)
                    if (!rect) return
                    // Un recuadro minúsculo es un clic, no un barrido: se
                    // interpreta como "deseleccionar todo".
                    if (Math.abs(rect.x2 - rect.x1) < 2 && Math.abs(rect.y2 - rect.y1) < 2) {
                      setSeleccion(new Set())
                      return
                    }
                    const dentro = enMesa.filter((entry) =>
                      peanaDentroDelRectangulo(
                        {
                          entryId: entry.id,
                          xCm: posiciones.get(entry.id)!.xCm,
                          yCm: posiciones.get(entry.id)!.yCm,
                          tamano: tamanoDe(entry),
                        },
                        rect,
                      ),
                    )
                    setSeleccion(new Set(dentro.map((e) => e.id)))
                  }}
                  className="relative w-full touch-none overflow-hidden border-2 border-ink/80 shadow-[inset_0_0_60px_rgba(90,76,54,0.22)] outline outline-1 outline-offset-[3px] outline-rule-dark/40"
                >
                  {/* EL TERRENO, EN SU PROPIA CAPA. Estaba pintado como fondo
                    del tablero, y desde ahí no se puede girar sin llevarse por
                    delante las peanas, que son sus hijas. Aquí dentro va todo lo
                    que cambia de perspectiva con el lado de despliegue —el
                    suelo, la imagen de fondo y la escenografía— y nada más.

                    El suelo lo pone el MAPA cargado. Sin mapa, o la imagen
                    propia, o el pergamino de siempre: quien despliega sobre una
                    mesa sin terreno está usando un plano, no un campo. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-0"
                    style={{
                      ...estiloDeSueloDeMapa(
                        mapaCargado?.textura ?? 'ninguna',
                        sueloDelMapa ?? null,
                        mesaActual.anchoCm,
                        mesaActual.altoCm,
                      ),
                      ...(imagenFondoUrl
                        ? {
                            backgroundImage: `url(${imagenFondoUrl})`,
                            // Estirada, no recortada: la mesa ya se ajustó a su
                            // proporción al subirla, así que no deforma.
                            backgroundSize: '100% 100%',
                            backgroundRepeat: 'no-repeat',
                          }
                        : null),
                      transform: girado ? 'rotate(180deg)' : undefined,
                    }}
                  >
                    {/* La escenografía del mapa, de FONDO y sin tocar: aquí se
                      despliega el ejército, no se rehace el terreno. Va dentro
                      de esta capa para girar con el resto del terreno. */}
                    {mapaCargado?.piezas.map((pieza) => (
                      <div
                        key={pieza.id}
                        className="absolute"
                        style={{
                          left: `${(pieza.xCm / mesaActual.anchoCm) * 100}%`,
                          top: `${(pieza.yCm / mesaActual.altoCm) * 100}%`,
                          width: `${(pieza.anchoCm / mesaActual.anchoCm) * 100}%`,
                          height: `${(pieza.altoCm / mesaActual.altoCm) * 100}%`,
                          transform: `translate(-50%, -50%) rotate(${pieza.rotacion}deg)`,
                        }}
                      >
                        <SceneryShape kind={pieza.kind} imagenUrl={pieza.imageUrl} className="h-full w-full" />
                      </div>
                    ))}
                  </div>

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
                  {/* Línea central a trazos: la referencia que de verdad se usa
                    al desplegar, y no un borde más del tablero. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(to bottom, rgba(122,36,32,.55) 0 6px, transparent 6px 12px)',
                    }}
                  />

                  {recuadro && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute z-30 border border-dashed border-maroon bg-maroon/10"
                      style={{
                        left: `${(Math.min(recuadro.x1, recuadro.x2) / mesaActual.anchoCm) * 100}%`,
                        top: `${(Math.min(recuadro.y1, recuadro.y2) / mesaActual.altoCm) * 100}%`,
                        width: `${(Math.abs(recuadro.x2 - recuadro.x1) / mesaActual.anchoCm) * 100}%`,
                        height: `${(Math.abs(recuadro.y2 - recuadro.y1) / mesaActual.altoCm) * 100}%`,
                      }}
                    />
                  )}

                  {enMesa.map((entry) => {
                    const pos = posiciones.get(entry.id)!
                    const tamano = tamanoDe(entry)
                    const elegida = seleccion.has(entry.id)
                    return (
                      <div
                        key={entry.id}
                        role="button"
                        tabIndex={0}
                        onPointerDown={(e) => {
                          if (soloLectura) {
                            e.stopPropagation()
                            setSeleccion(new Set([entry.id]))
                            enfocarFila(entry.id)
                            return
                          }
                          if (e.button !== 0) return
                          e.preventDefault()
                          e.stopPropagation()
                          const grupo = e.shiftKey
                            ? new Set(seleccion).add(entry.id)
                            : seleccion.has(entry.id)
                              ? seleccion
                              : new Set([entry.id])
                          setSeleccion(grupo)
                          // El vínculo con el orden de batalla: elegir una peana
                          // trae su fila a la vista.
                          enfocarFila(entry.id)
                          const raton = aCm(e.clientX, e.clientY)
                          const inicio = new Map<number, DeploymentPosition>()
                          for (const gid of grupo) {
                            const p = posiciones.get(gid)
                            if (p) inicio.set(gid, p)
                          }
                          agarre.current = {
                            xCm: raton.xCm,
                            yCm: raton.yCm,
                            inicio,
                          }
                          e.currentTarget.setPointerCapture(e.pointerId)
                        }}
                        onPointerMove={(e) => {
                          if (!agarre.current) return
                          const raton = aCm(e.clientX, e.clientY)
                          moverGrupo(raton.xCm - agarre.current.xCm, raton.yCm - agarre.current.yCm)
                        }}
                        onPointerUp={() => {
                          agarre.current = null
                        }}
                        onKeyDown={(e) => {
                          if (soloLectura) return
                          const paso = e.shiftKey ? 5 : 1
                          const delta =
                            e.key === 'ArrowLeft'
                              ? { x: -paso, y: 0 }
                              : e.key === 'ArrowRight'
                                ? { x: paso, y: 0 }
                                : e.key === 'ArrowUp'
                                  ? { x: 0, y: -paso }
                                  : e.key === 'ArrowDown'
                                    ? { x: 0, y: paso }
                                    : null
                          if (!delta) return
                          e.preventDefault()
                          const grupo = seleccion.has(entry.id) ? seleccion : new Set([entry.id])
                          const inicio = new Map<number, DeploymentPosition>()
                          for (const gid of grupo) {
                            const p = posiciones.get(gid)
                            if (p) inicio.set(gid, p)
                          }
                          agarre.current = { xCm: 0, yCm: 0, inicio }
                          moverGrupo(delta.x, delta.y)
                          agarre.current = null
                        }}
                        onPointerEnter={() => setEncima(entry.id)}
                        onPointerLeave={() => setEncima((id) => (id === entry.id ? null : id))}
                        style={{
                          left: `${(pos.xCm / mesaActual.anchoCm) * 100}%`,
                          top: `${(pos.yCm / mesaActual.altoCm) * 100}%`,
                          width: `${(tamano.anchoCm / mesaActual.anchoCm) * 100}%`,
                          height: `${(tamano.altoCm / mesaActual.altoCm) * 100}%`,
                        }}
                        className={clsx(
                          'absolute -translate-x-1/2 -translate-y-1/2 touch-none select-none',
                          soloLectura ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
                          elegida ? 'z-20' : 'z-10',
                        )}
                      >
                        {/* La peana entera pintada del color de la facción. Antes
                          iba el emblema: a este tamaño —una peana de 12 cm son
                          unos 40 px— no se distinguía uno de otro, y encima
                          dejaba pergamino alrededor. El color llena el recuadro
                          y se lee de un vistazo aun con la mesa llena. */}
                        <div
                          className={clsx(
                            'h-full w-full overflow-hidden border transition-shadow',
                            elegida
                              ? 'border-maroon shadow-[0_0_0_2px_rgba(122,36,32,.35),0_2px_6px_rgba(0,0,0,.35)]'
                              : 'border-ink/70 shadow-[0_1px_3px_rgba(0,0,0,.3)]',
                          )}
                          style={estiloDePeana(entry.unit.faction.color)}
                        >
                          {/* Las iniciales, centradas y del mismo cuerpo en
                            toda la mesa (ver cuerpoDeAliasCm). Van en `cqw`
                            —tanto por ciento del ANCHO del tablero— para que
                            sigan midiendo lo mismo en centímetros de mesa
                            aunque cambie el tamaño de la ventana; el navegador
                            lo recalcula solo, sin medir nada desde aquí.
                            La sombra corta despega las letras del color sin
                            llegar a leerse como sombra. */}
                          <span
                            className="pointer-events-none flex h-full w-full items-center justify-center leading-none font-bold [text-shadow:0_1px_1px_rgba(0,0,0,.35)]"
                            style={{ fontSize: `${(cuerpoAliasCm / mesaActual.anchoCm) * 100}cqw` }}
                          >
                            {refPorEntrada.get(entry.id)}
                          </span>
                        </div>

                        {/* Tirador de tamaño. Solo en la peana elegida: uno por
                          unidad, siempre visible, se pulsaría sin querer justo
                          al ir a arrastrarla. */}
                        {!soloLectura && elegida && (
                          <span
                            role="slider"
                            tabIndex={-1}
                            aria-label={`Cambiar el tamaño de ${nombreDeLaEntrada(entry)}`}
                            aria-valuenow={tamano.anchoCm}
                            onPointerDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              redim.current = {
                                entryId: entry.id,
                                xCm: pos.xCm,
                                yCm: pos.yCm,
                              }
                              e.currentTarget.setPointerCapture(e.pointerId)
                            }}
                            onPointerMove={(e) => {
                              const r = redim.current
                              if (!r) return
                              // El tamaño sale de la distancia al CENTRO, por
                              // dos: la peana se dibuja centrada, así que crece
                              // por los cuatro lados y no se desplaza al estirar.
                              const raton = aCm(e.clientX, e.clientY)
                              redimensionar(r.entryId, (raton.xCm - r.xCm) * 2, (raton.yCm - r.yCm) * 2)
                            }}
                            onPointerUp={() => {
                              redim.current = null
                            }}
                            className="absolute -right-1.5 -bottom-1.5 z-30 h-3 w-3 cursor-nwse-resize border border-maroon bg-parchment shadow-[0_1px_2px_rgba(0,0,0,.35)]"
                          />
                        )}

                        {/* Quién es esta peana: nombre y cuántas miniaturas.
                          Sale al posar el ratón y al momento —sin espera—,
                          porque con la mesa llena de cuadros de tres letras es
                          la única forma de reconocer una unidad sin ir a
                          buscarla en la lista. El rótulo del navegador (title)
                          no vale: tarda un segundo largo en salir y no se puede
                          dar estilo.

                          Se pinta ARRIBA salvo en la franja superior de la
                          mesa, donde no cabría y saldría cortado por el borde
                          del tablero. */}
                        {encima === entry.id && (
                          <span
                            className={clsx(
                              'pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 rounded-sm border border-rule-dark/50 bg-parchment px-1.5 py-0.5 text-center text-[11px] leading-tight whitespace-nowrap text-ink shadow-[0_2px_6px_rgba(0,0,0,.3)]',
                              pos.yCm < mesaActual.altoCm * 0.12 ? 'top-full mt-1' : 'bottom-full mb-1',
                            )}
                          >
                            <span className="font-semibold tabular-nums">{entry.quantity} </span>
                            <span className="font-semibold">{nombreDeLaEntrada(entry)}</span>
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= Derecha: controles ================= */}
        <aside className="w-full shrink-0 space-y-5 lg:w-56">
          <section>
            <Rotulo>Mesa</Rotulo>
            {/* TRES orígenes y un solo desplegable, porque son excluyentes: la
                mesa desnuda, una imagen propia de esta lista, o uno de los mapas
                del grupo (que son públicos, así que salen los de todo el mundo).
                Con dos controles separados quedaría la duda de qué manda cuando
                hay mapa Y imagen. */}
            <select
              value={mapaId != null ? String(mapaId) : imagenKey ? 'imagen' : 'libre'}
              disabled={soloLectura}
              onChange={(e) => {
                const v = e.target.value
                if (v === 'libre') {
                  cambiarMapa(null)
                  quitarImagenDeFondo()
                } else if (v === 'imagen') {
                  cambiarMapa(null)
                  // Sin imagen todavía, el propio desplegable abre el archivo:
                  // elegir "Imagen propia" y no ver nada sería un callejón.
                  if (!imagenKey) imagenRef.current?.click()
                } else {
                  setImagenKey(null)
                  cambiarMapa(Number(v))
                }
              }}
              aria-label="Fondo del despliegue"
              className="mb-3 w-full rounded-sm border border-rule-dark/40 bg-parchment px-2 py-1 text-xs text-ink outline-none focus:border-bronze disabled:opacity-50"
            >
              <option value="libre">Mesa libre (sin mapa)</option>
              <option value="imagen">Imagen propia…</option>
              {(mapasDisponibles ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.anchoCm} × {m.altoCm} cm
                </option>
              ))}
            </select>

            <input
              ref={imagenRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                subirImagenDeFondo(e.target.files?.[0])
                // Se limpia para que volver a elegir EL MISMO archivo dispare el
                // change otra vez (si no, el navegador lo considera sin cambios).
                e.target.value = ''
              }}
            />

            {!conMapa && (imagenKey || subiendoImagen) && (
              <div className="mb-3 space-y-2">
                <div className="overflow-hidden rounded-sm border border-rule-dark/40 bg-parchment-dark/30">
                  {imagenFondoUrl ? (
                    <img src={imagenFondoUrl} alt="" className="block w-full" />
                  ) : (
                    <p className="px-2 py-3 text-center text-[10px] text-ink-soft">Subiendo…</p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={soloLectura || subiendoImagen}
                    onClick={() => imagenRef.current?.click()}
                    className="flex-1 rounded-sm border border-rule-dark/40 bg-parchment px-2 py-1 text-[10px] font-medium text-ink hover:bg-parchment-dark disabled:opacity-50"
                  >
                    {subiendoImagen ? 'Subiendo…' : 'Cambiar'}
                  </button>
                  <button
                    type="button"
                    disabled={soloLectura || subiendoImagen}
                    onClick={quitarImagenDeFondo}
                    className="rounded-sm px-2 py-1 text-[10px] font-medium text-ink-soft hover:bg-maroon/10 hover:text-danger disabled:opacity-50"
                  >
                    Quitar
                  </button>
                </div>
                <p className="text-[10px] leading-snug text-ink-soft/80">
                  La imagen se estira a la mesa entera. Al subirla se ajusta el fondo de la mesa a su proporción para
                  que no salga deformada; el ancho no se toca.
                </p>
              </div>
            )}

            {/* Con mapa cargado no hay barras: las medidas son las suyas. */}
            {conMapa ? (
              <p className="text-[10px] leading-snug text-ink-soft/80">
                <b className="text-ink">{mapaCargado?.name}</b> · {mesaActual.anchoCm} × {mesaActual.altoCm} cm ·{' '}
                {mapaCargado?.piezas.length} {mapaCargado?.piezas.length === 1 ? 'elemento' : 'elementos'}
              </p>
            ) : (
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
                    {/* Barra y no casilla: aquí no se teclea una medida exacta,
                      se busca la mesa que se parezca a la de casa, y una barra
                      deja verlo cambiar mientras se arrastra. */}
                    <input
                      type="range"
                      min={eje.min}
                      max={eje.max}
                      step={5}
                      disabled={soloLectura}
                      value={eje.valor}
                      onChange={(e) => eje.set(Number(e.target.value))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-rule-dark/30 accent-maroon disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <span className="mt-0.5 flex justify-between text-[9px] text-ink-soft/60 tabular-nums">
                      <span>{eje.min}</span>
                      <span>{eje.max}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* LADO DE DESPLIEGUE. Lo que NO hace: mover las peanas. Se colocan
              siempre abajo porque es lo cómodo para quien está sentado delante
              de la mesa, y cambiar eso obligaría a desplegar del revés cada dos
              partidas. Lo que hace es girar el TERRENO 180°, que es exactamente
              lo que uno ve cuando le toca el otro borde. */}
          <section>
            <Rotulo>Lado de despliegue</Rotulo>
            <div className="flex overflow-hidden rounded-sm border border-rule-dark/40">
              {(
                [
                  { valor: 'sur', etiqueta: 'Sur' },
                  { valor: 'norte', etiqueta: 'Norte' },
                ] as Array<{ valor: LadoDeDespliegue; etiqueta: string }>
              ).map((op) => (
                <button
                  key={op.valor}
                  type="button"
                  disabled={soloLectura}
                  aria-pressed={lado === op.valor}
                  onClick={() => {
                    if (lado === op.valor) return
                    setLado(op.valor)
                    setDirty(true)
                  }}
                  className={clsx(
                    'flex-1 px-2 py-1.5 text-[11px] font-semibold tracking-wide transition-colors disabled:opacity-50',
                    lado === op.valor
                      ? 'bg-maroon text-parchment'
                      : 'bg-parchment text-ink-soft hover:bg-parchment-dark',
                  )}
                >
                  {op.etiqueta}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-ink-soft/80">
              Tus unidades se colocan siempre abajo. Lo que cambia es la perspectiva: desde el norte, el terreno se ve
              del revés.
            </p>
          </section>

          {!soloLectura && (
            <section>
              <Rotulo>Formación</Rotulo>
              <div className="space-y-1.5">
                <Button variant="secondary" onClick={() => handleAlinear(entradas)} disabled={enMesa.length < 2}>
                  Alinear unidades
                </Button>
                {/* Vaciar la mesa entera. No pide confirmación porque no borra
                    nada: las unidades vuelven a la reserva y basta con no
                    guardar para deshacerlo. */}
                <button
                  type="button"
                  onClick={retirarTodas}
                  disabled={enMesa.length === 0}
                  className="flex w-full items-center justify-center gap-1 rounded-sm border border-maroon/40 px-2 py-1 text-xs font-medium text-maroon transition-colors hover:bg-maroon/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  Retirar todas de la mesa
                </button>
              </div>
            </section>
          )}

          <section>
            <Rotulo
              extra={
                seleccionadas.length > 1 ? (
                  <span className="text-[10px] text-maroon tabular-nums">{seleccionadas.length}</span>
                ) : undefined
              }
            >
              Selección
            </Rotulo>
            {seleccionadas.length === 0 ? null : (
              <div className="space-y-2.5">
                {seleccionadas.length === 1 ? (
                  <div className="border-l-2 border-maroon pl-2">
                    <p className="text-sm leading-tight font-medium text-ink">{nombreDeLaEntrada(seleccionadas[0])}</p>
                    <p className="mt-0.5 text-[10px] text-ink-soft tabular-nums">
                      {tamanoDe(seleccionadas[0]).anchoCm} × {tamanoDe(seleccionadas[0]).altoCm} cm · (
                      {posiciones.get(seleccionadas[0].id)?.xCm}, {posiciones.get(seleccionadas[0].id)?.yCm}) cm
                    </p>
                  </div>
                ) : (
                  <p className="border-l-2 border-maroon pl-2 text-sm text-ink">
                    <b>{seleccionadas.length} unidades</b>
                    <span className="mt-0.5 block text-[10px] text-ink-soft">se mueven juntas</span>
                  </p>
                )}

                {!soloLectura && (
                  <>
                    {/* Solo si alguna está a medida: si ninguna lo está, el
                        botón no haría nada. */}
                    {seleccionadas.some((e) => posiciones.get(e.id)?.anchoCm != null) && (
                      <button
                        type="button"
                        onClick={() => restaurarTamano(seleccionadas.map((e) => e.id))}
                        className="w-full rounded-sm border border-rule-dark/40 px-2 py-1 text-xs text-ink-soft transition-colors hover:border-bronze hover:text-bronze"
                      >
                        Volver al tamaño de su etiqueta
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => retirar(seleccionadas.map((e) => e.id))}
                      className="flex w-full items-center justify-center gap-1 rounded-sm border border-maroon/40 px-2 py-1 text-xs font-medium text-maroon transition-colors hover:bg-maroon/10"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      {seleccionadas.length === 1 ? 'Retirar de la mesa' : 'Retirar todas'}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
