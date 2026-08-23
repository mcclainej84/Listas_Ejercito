// ============================================================================
// LAS 120 FIGURAS HERÁLDICAS, y por qué no están dentro del programa.
//
// Son siluetas vectoriales, y juntas ocupan unos 650 kB de texto. Metidas en el
// código se descargarían SIEMPRE: al abrir el listado de ejércitos, al mirar
// una batalla, al consultar una ficha — en todas las visitas de todo el mundo,
// para una pantalla que se abre dos veces en la vida de un ejército. Así que
// viven en `public/assets/emblemas/figuras.json` y se piden la primera vez que
// alguien abre el diseñador. Después se quedan en memoria mientras la pestaña
// siga abierta, y en la caché del navegador para siempre (el archivo no cambia
// salvo que se añadan figuras).
//
// CÓMO SE USAN. Cada figura es un `path` sin color —hereda el que le inyecta
// svgDeEmblema— dibujado dentro de un cuadro de 1000×1000 y CENTRADO en él. Su
// caja real (`w` × `h`) viaja aparte porque hace falta para encajarla dentro
// del contorno: una lanza es 190×1000 y una faja 1000×300, y las dos tienen que
// caber sin deformarse (ver `encajarFigura`).
//
// EL DIBUJO SE SUAVIZA ANTES DE VECTORIZAR. Los PNG de origen tienen el borde
// escalonado, y trazarlos tal cual copiaba la escalera al vector: se veía
// pixelado a tamaño grande por muy vectorial que fuera. Se desenfoca el canal
// alfa antes de umbralizar, y el trazo sale en curvas. De propina, ocupa menos:
// una curva limpia necesita menos nodos que una escalera.
//
// SI FALTAN, EL EMBLEMA SE PINTA IGUAL, sin figura: campo, partición y
// contorno. Es medio segundo mientras llega el archivo, y es mucho mejor que un
// hueco vacío o una espera con la pantalla en blanco.
//
// PARA AÑADIR FIGURAS: se regeneran con el trazador (docs/ENCARGO_EMBLEMAS.md)
// y se sustituye el JSON. Aquí no hay que tocar nada.
// ============================================================================

/** Una figura del catálogo, tal y como viene en el JSON. */
export interface FiguraHeraldica {
  /**
   * SU NÚMERO, 1..120, y el mismo que sale escrito en su casilla del
   * diseñador. No es un detalle de presentación: es lo que permite hablar de
   * una figura concreta —"quita la 65", "la 12 está torcida"— sin describirla.
   * Va en el archivo y no se calcula al vuelo para que no cambie según cómo se
   * ordene o se filtre la rejilla.
   */
  i: number
  /** Nombre visible ("Águila bicéfala"). */
  n: string
  /** Grupo del catálogo, para poder filtrar 120 sin ir a ojo. */
  g: string
  /** El `path` completo, sin color, en un cuadro de 1000 y centrado en él. */
  d: string
  /** Ancho real de la figura dentro de ese cuadro. */
  w: number
  /** Alto real. */
  h: number
}

export type CatalogoDeFiguras = Record<string, FiguraHeraldica>

/** Grupos del catálogo, en el orden en que se ofrecen. */
export const GRUPOS_DE_FIGURAS: { clave: string; nombre: string }[] = [
  { clave: 'bestias', nombre: 'Bestias' },
  { clave: 'armas', nombre: 'Armas' },
  { clave: 'caos', nombre: 'Calaveras' },
  { clave: 'construcciones', nombre: 'Torres' },
  { clave: 'simbolos', nombre: 'Símbolos' },
  { clave: 'naturaleza', nombre: 'Naturaleza' },
]

const RUTA = `${import.meta.env.BASE_URL}assets/emblemas/figuras.json`

let cache: CatalogoDeFiguras | null = null
let enVuelo: Promise<CatalogoDeFiguras> | null = null

/**
 * Las figuras si ya están; null si todavía no. Para pintar sin esperar: quien
 * llame tiene que aguantar el null (ver la cabecera).
 */
export function figurasEnMemoria(): CatalogoDeFiguras | null {
  return cache
}

/**
 * Pide las figuras (o devuelve las que ya hay). Una sola petición aunque la
 * llamen diez sitios a la vez: la promesa se comparte.
 *
 * Si falla —sin red, archivo no desplegado— devuelve un catálogo VACÍO en vez
 * de reventar, y se podrá reintentar en la siguiente llamada. Un emblema sin
 * figura es un emblema pobre; una pantalla que no abre es una pantalla rota.
 */
export async function cargarFiguras(): Promise<CatalogoDeFiguras> {
  if (cache) return cache
  if (!enVuelo) {
    enVuelo = fetch(RUTA)
      .then((r) => {
        if (!r.ok) throw new Error(`figuras.json: ${r.status}`)
        return r.json() as Promise<CatalogoDeFiguras>
      })
      .then((datos) => {
        cache = datos
        return datos
      })
      .catch((err) => {
        console.error('No se pudieron cargar las figuras del emblema.', err)
        enVuelo = null
        return {} as CatalogoDeFiguras
      })
  }
  return enVuelo
}
