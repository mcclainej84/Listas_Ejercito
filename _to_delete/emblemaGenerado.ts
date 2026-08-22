// ============================================================================
// EMBLEMAS GENERADOS: heráldica sencilla a partir del color de la facción.
//
// QUÉ PROBLEMA RESUELVE. Un ejército puede llevar su propio emblema (ver
// domain/armyEmblem), pero hasta ahora las opciones eran "el de otra facción"
// —que no es tuyo— o "sube una imagen" —que exige tener una—. Casi nadie tiene
// a mano el escudo de su hueste. Esto da un tercer camino: pulsar un botón y
// que salga uno decente, del color de tu facción y distinto al del vecino.
//
// CÓMO SE CONSTRUYE. Como se construye un escudo de verdad, y de ahí que el
// resultado no parezca un icono generado: un CAMPO con su partición (faja,
// palo, banda, cuartelado…), un ESCUDO encima, y un MUEBLE dentro (la cruz, el
// creciente, la torre, la calavera). Tres decisiones tomadas por una semilla,
// no veinte parámetros al azar: con pocas piezas bien elegidas sale heráldica;
// con muchas sale ruido.
//
// TODO SALE DEL COLOR DE LA FACCIÓN. El campo es ese color oscurecido, la
// partición el mismo aclarado, y el mueble va en pergamino o en tinta según lo
// claro que quede el campo — sin eso, una facción casi blanca (los Altos
// Elfos) daba una figura crema sobre gris: correcta e ilegible.
//
// ES SVG, TEXTO PLANO. No hay dependencias, no hay lienzo y no hay red: se
// puede previsualizar al instante mientras se pulsa "otro". Solo al guardar se
// convierte en imagen (ver shared/image#rasterizarSvg) y se sube, para que sea
// un emblema normal y corriente como cualquier otro.
// ============================================================================

const HEX = /^#([0-9a-f]{6})$/i
const PERGAMINO = '#f6efdc'
const TINTA = '#241a10'
/** Gris neutro, el mismo que usa una facción sin color asignado. */
const SIN_COLOR = '#6b6a63'

function componentes(color: string): [number, number, number] {
  const m = HEX.exec((color ?? '').trim())
  if (!m) return [107, 106, 99]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function aHex(r: number, g: number, b: number): string {
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0')
  return `#${f(r)}${f(g)}${f(b)}`
}

/** Interpola dos colores. `t` = 0 devuelve `a`; `t` = 1 devuelve `b`. */
function mezcla(a: string, b: string, t: number): string {
  const x = componentes(a)
  const y = componentes(b)
  return aHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t)
}

/** Luminancia relativa (WCAG), como en domain/factionColor#textoSobre. */
function luminancia(color: string): number {
  const [r, g, b] = componentes(color).map((v) => {
    const x = v / 255
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Generador determinista (mulberry32). Hace falta que lo sea: la misma semilla
 * tiene que dar SIEMPRE el mismo emblema, porque lo que se ve al pulsar "otro"
 * es lo que se va a guardar después.
 */
function generador(semilla: number): () => number {
  let a = semilla >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PARTICIONES = ['liso', 'faja', 'palo', 'banda', 'cuartelado', 'chevron', 'jefe'] as const

function particion(clave: string, claro: string, oscuro: string): string {
  switch (clave) {
    case 'faja':
      return `<rect x="0" y="196" width="480" height="88" fill="${claro}" opacity=".5"/>`
    case 'palo':
      return `<rect x="196" y="0" width="88" height="480" fill="${claro}" opacity=".5"/>`
    case 'banda':
      // Con filete: sin él, una banda clara en diagonal se lee como el reflejo
      // de un icono de aplicación en vez de como una pieza heráldica.
      return (
        `<path d="M-40 300 L300 -40 L400 60 L60 400 Z" fill="${claro}" opacity=".34"/>` +
        `<path d="M-40 300 L300 -40 M400 60 L60 400" stroke="${PERGAMINO}" stroke-opacity=".22" stroke-width="5" fill="none"/>`
      )
    case 'cuartelado':
      return (
        `<path d="M0 0h240v240H0z" fill="${oscuro}" opacity=".55"/>` +
        `<path d="M240 240h240v240H240z" fill="${oscuro}" opacity=".55"/>`
      )
    case 'chevron':
      return `<path d="M240 150 L470 380 L470 480 L240 250 L10 480 L10 380 Z" fill="${claro}" opacity=".45"/>`
    case 'jefe':
      return `<rect x="0" y="0" width="480" height="120" fill="${oscuro}" opacity=".6"/>`
    default:
      return ''
  }
}

const MUEBLES = [
  'cruz',
  'sotuer',
  'creciente',
  'estrella',
  'torre',
  'lis',
  'roeles',
  'espadas',
  'rombo',
  'calavera',
] as const

function mueble(clave: string, tinte: string): string {
  // OJO CON LOS ATRIBUTOS REPETIDOS: el grosor se pasa al construir el trazo.
  // Poner `stroke-width` otra vez dentro del mismo grupo es un atributo
  // duplicado, y eso NO es SVG válido: el navegador descarta la imagen entera
  // y sale el icono de "imagen rota". Costó una tanda de emblemas en blanco.
  const trazo = (w = 17) =>
    `fill="none" stroke="${tinte}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`
  const relleno = `fill="${tinte}"`
  switch (clave) {
    case 'cruz':
      return `<g ${trazo()}><path d="M240 160v168M156 244h168"/></g>`
    case 'sotuer':
      return `<g ${trazo()}><path d="M182 186 L302 306M302 186 L182 306"/></g>`
    case 'creciente':
      return `<path d="M292 178a78 78 0 1 0 0 132 64 64 0 1 1 0-132Z" ${relleno}/>`
    case 'estrella':
      return `<path d="M242 164 L263 222 L324 222 L275 258 L294 316 L242 281 L190 316 L209 258 L160 222 L221 222 Z" ${relleno}/>`
    case 'torre':
      return (
        `<g ${relleno}><path d="M172 228h140v112H172z"/><path d="M162 178h28v28h28v-28h28v28h28v-28h28v42H162z"/></g>` +
        `<g ${trazo(13)}><path d="M224 340v-46a18 18 0 0 1 36 0v46"/></g>`
      )
    case 'lis':
      return (
        `<g ${relleno}><path d="M242 148c10 24 10 42 0 58-10-16-10-34 0-58Z"/><path d="M236 206v112h12V206Z"/>` +
        `<path d="M230 214c-6-26-28-40-48-30-18 9-18 36-2 54 14 16 32 24 50 26-2-18 2-34 0-50Z"/>` +
        `<path d="M254 214c6-26 28-40 48-30 18 9 18 36 2 54-14 16-32 24-50 26 2-18-2-34 0-50Z"/>` +
        `<rect x="188" y="286" width="108" height="16" rx="8"/></g>`
      )
    case 'roeles':
      return `<g ${relleno}><circle cx="242" cy="192" r="27"/><circle cx="194" cy="282" r="27"/><circle cx="290" cy="282" r="27"/></g>`
    case 'espadas':
      return `<g ${trazo(14)}><path d="M178 310 L306 182M160 292 L196 328M306 310 L178 182M324 292 L288 328"/></g>`
    case 'rombo':
      return `<g ${trazo()}><path d="M242 156 L322 244 L242 332 L162 244 Z"/></g>`
    case 'calavera':
      // Cráneo, cuencas y mandíbula, y nada más: es el mueble más reconocible
      // del género y tiene que leerse también a 40 px, que es como sale en el
      // listado de ejércitos.
      return (
        `<g ${relleno}><path d="M242 166c42 0 72 30 72 70 0 24-12 40-24 50v20h-96v-20c-12-10-24-26-24-50 0-40 30-70 72-70Z"/>` +
        `<rect x="212" y="316" width="60" height="16" rx="6"/></g>` +
        `<g fill="#00000055"><ellipse cx="216" cy="240" rx="17" ry="20"/><ellipse cx="268" cy="240" rx="17" ry="20"/>` +
        `<path d="M236 272h12l-6 18Z"/></g>`
      )
    default:
      return ''
  }
}

const ESCUDO = 'M240 78 L404 136 V268 c0 88-76 122-164 148 -88-26-164-60-164-148 V136 Z'

/**
 * Un emblema completo, en SVG, para una semilla y un color de facción.
 *
 * Cuadrado de 480 px: el mismo lado con el que se guardan los emblemas de
 * facción, para que ocupe idéntico recuadro allá donde se pinte.
 */
export function svgDeEmblema(semilla: number, colorFaccion: string | null | undefined): string {
  const r = generador(semilla)
  const base = colorFaccion && HEX.test(colorFaccion) ? colorFaccion : SIN_COLOR
  const oscuro = mezcla(base, TINTA, 0.55)
  const medio = mezcla(base, TINTA, 0.18)
  const claro = mezcla(base, PERGAMINO, 0.3)
  const tinte = luminancia(medio) > 0.42 ? TINTA : PERGAMINO
  const laParticion = PARTICIONES[Math.floor(r() * PARTICIONES.length)]
  const elMueble = MUEBLES[Math.floor(r() * MUEBLES.length)]
  const conEscudo = r() > 0.28
  // Los degradados llevan id único: dos emblemas en la misma página con el
  // mismo id se pisan el uno al otro.
  const id = Math.floor(r() * 1e6)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" width="480" height="480">
<defs>
<linearGradient id="f${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${medio}"/><stop offset="1" stop-color="${oscuro}"/></linearGradient>
<radialGradient id="v${id}" cx="50%" cy="42%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".42"/></radialGradient>
</defs>
<rect width="480" height="480" fill="url(#f${id})"/>
${particion(laParticion, claro, oscuro)}
${conEscudo ? `<path d="${ESCUDO}" fill="${oscuro}" fill-opacity=".45" stroke="${tinte}" stroke-opacity=".88" stroke-width="14" stroke-linejoin="round"/>` : ''}
${mueble(elMueble, tinte)}
<rect x="14" y="14" width="452" height="452" fill="none" stroke="${PERGAMINO}" stroke-opacity=".30" stroke-width="4"/>
<rect x="26" y="26" width="428" height="428" fill="none" stroke="${PERGAMINO}" stroke-opacity=".16" stroke-width="2"/>
<rect width="480" height="480" fill="url(#v${id})"/>
</svg>`
}

/** El SVG listo para un `src`, sin pasar por la red. */
export function urlDeEmblemaGenerado(semilla: number, colorFaccion: string | null | undefined): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDeEmblema(semilla, colorFaccion))}`
}

/** Una semilla nueva al azar, para el botón de "otro". */
export function semillaAlAzar(): number {
  return Math.floor(Math.random() * 4294967296)
}
