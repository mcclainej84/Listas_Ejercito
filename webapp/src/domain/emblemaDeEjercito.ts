// ============================================================================
// EL EMBLEMA DE UN EJÉRCITO: montaje del escudo a partir de cinco decisiones.
//
//   1. La FIGURA — el "mueble" heráldico. 120 siluetas, y no viven aquí: se
//      piden a la red la primera vez (ver domain/emblemaFiguras y el porqué).
//   2. El ADORNO — la figura que enmarca al mueble: un cuadro algo más pequeño,
//      un círculo, dos escudos o una línea cruzando por el medio.
//   3. La PARTICIÓN del campo — jefe, faja, palo, banda, cuartelado…
//   4. El color del CAMPO.
//   5. El color de la FIGURA.
//
// EL EMBLEMA ES SIEMPRE UN CUADRADO. El adorno se dibuja DENTRO, sobre el
// campo; no recorta nada. Se probó lo contrario —que el adorno fuera la silueta
// del emblema, de modo que un escudo tuviera las esquinas vacías— y estaba mal:
// el emblema convive con los de facción en el mismo recuadro de 480, en el
// listado, en la cabecera y en las batallas, y uno que cambia de forma según lo
// que elijas rompe la fila. La forma la pone el sitio; el escudo es un adorno.
//
// LA FIGURA SE ENCAJA, NO SE ESTIRA. Cada adorno declara el hueco donde cabe
// una figura sin tocar el borde (`caja`), y la figura se mete ahí conservando
// su proporción: una lanza (190×1000) sale larga y estrecha, una faja
// (1000×300) sale ancha y baja, y las dos caben. Estirarlas al hueco haría que
// el mismo dragón fuera gordo en el círculo y flaco en la banda.
//
// POR QUÉ SILUETAS Y NO TRAZOS. Un emblema tiene que leerse a 40 px, que es el
// tamaño al que sale en el listado de Ejércitos. A ese tamaño un trazo de dos
// píxeles desaparece; una silueta rellena aguanta.
//
// TODO ES SVG, TEXTO PLANO: sin lienzo, así que el diseñador repinta el escudo
// entero en cada clic sin coste. Solo al guardar se convierte en imagen
// (shared/image#rasterizarSvg) y se sube.
// ============================================================================
import { figurasEnMemoria, type CatalogoDeFiguras } from '@/domain/emblemaFiguras'

const PERGAMINO = '#f6efdc'
const TINTA = '#2b2013'

// ---------------------------------------------------------------------------
// CONTORNOS. El `path` es la silueta del emblema entero en el cuadro de 480, y
// `caja` es el rectángulo [x0, y0, x1, y1] donde cabe la figura sin comerse el
// borde. Cada caja está medida sobre su forma: la del escudo termina antes de
// la punta, la del círculo se queda dentro del disco y la de la banda es ancha
// y baja porque la banda lo es.
//
// Los trazos van metidos unos píxeles hacia dentro (el cuadrado empieza en 6 y
// no en 0) para que el filete del borde se vea entero: dibujado justo en el
// canto, el lienzo se come la mitad de su grosor.
// ---------------------------------------------------------------------------
export interface Contorno {
  nombre: string
  /** El adorno, dibujado dentro del cuadrado de 480. */
  path: string
  /** [x0, y0, x1, y1] donde se encaja la figura, por dentro del adorno. */
  caja: [number, number, number, number]
  /**
   * Si el adorno encierra un área (todos menos la línea). Los que la encierran
   * llevan un fondo apenas más oscuro, que es lo que hace que se lea como un
   * escudo y no como cuatro trazos sueltos; una línea no encierra nada y
   * rellenarla la convertiría en una barra.
   */
  relleno?: boolean
}

/**
 * Los cinco adornos. Las cajas están medidas sobre cada forma: la del escudo
 * termina antes de la punta, la del círculo se queda dentro del disco y la de
 * la línea es casi todo el cuadro, porque una línea no encierra — la figura se
 * le monta encima y la línea asoma por los dos lados.
 */
export const CONTORNOS: Record<string, Contorno> = {
  cuadrado: { nombre: 'Cuadro', path: 'M62 62H418V418H62Z', caja: [96, 96, 384, 384], relleno: true },
  circulo: { nombre: 'Círculo', path: 'M240 62A178 178 0 1 0 240.1 62Z', caja: [122, 122, 358, 358], relleno: true },
  escudo: {
    nombre: 'Escudo',
    path: 'M88 70H392V244C392 330 332 388 240 422 148 388 88 330 88 244Z',
    caja: [126, 108, 354, 326],
    relleno: true,
  },
  'escudo-punta': {
    nombre: 'Escudo gótico',
    path: 'M92 74Q240 116 388 74V240Q388 348 240 428 92 348 92 240Z',
    caja: [132, 140, 348, 336],
    relleno: true,
  },
  linea: { nombre: 'Línea', path: 'M28 240H452', caja: [100, 100, 380, 380] },
}

/** Particiones del campo. Las piezas honorables de toda la vida. */
export const PARTICIONES: Record<string, string> = {
  liso: 'Liso',
  jefe: 'Jefe',
  faja: 'Faja',
  palo: 'Palo',
  banda: 'Banda',
  chevron: 'Chevrón',
  cuartelado: 'Cuartelado',
  cruz: 'Cruz',
  bordura: 'Bordura',
  burelado: 'Burelado',
}

/**
 * Colores de campo: los esmaltes y metales heráldicos, con sus variantes
 * apagadas. Todos son oscuros o medios a propósito — el campo es el fondo, y
 * sobre un fondo claro la figura tiene que ir en tinta para verse, lo que deja
 * fuera la mitad de la paleta de figura.
 */
export const PALETA_FONDO: { nombre: string; color: string }[] = [
  { nombre: 'Gules', color: '#8c2f2f' },
  { nombre: 'Granate', color: '#5e1a17' },
  { nombre: 'Bermellón', color: '#b4462f' },
  { nombre: 'Teja', color: '#8a4b2a' },
  { nombre: 'Azur', color: '#2f5d8c' },
  { nombre: 'Añil', color: '#243a63' },
  { nombre: 'Celeste', color: '#4a7fa5' },
  { nombre: 'Turquesa', color: '#2f7d76' },
  { nombre: 'Sinople', color: '#3f7a45' },
  { nombre: 'Verde bosque', color: '#24512f' },
  { nombre: 'Oliva', color: '#6b7a3a' },
  { nombre: 'Musgo', color: '#55613a' },
  { nombre: 'Púrpura', color: '#5a3a63' },
  { nombre: 'Violeta', color: '#3f2f5e' },
  { nombre: 'Ciruela', color: '#6b2f4a' },
  { nombre: 'Rosa vieja', color: '#a05a6b' },
  { nombre: 'Oro', color: '#c9a227' },
  { nombre: 'Ámbar', color: '#c07f28' },
  { nombre: 'Bronce', color: '#a06a2c' },
  { nombre: 'Cuero', color: '#7a5230' },
  { nombre: 'Sable', color: '#2b2620' },
  { nombre: 'Pizarra', color: '#4a4f55' },
  { nombre: 'Plata', color: '#9aa1a8' },
  { nombre: 'Pergamino', color: '#c9b78d' },
]

/** Colores de figura. Pocos: en heráldica el mueble es metal o esmalte. */
export const PALETA_FIGURA: { nombre: string; color: string }[] = [
  { nombre: 'Pergamino', color: PERGAMINO },
  { nombre: 'Oro', color: '#e8c565' },
  { nombre: 'Plata', color: '#d8dde2' },
  { nombre: 'Bronce', color: '#c08a3e' },
  { nombre: 'Tinta', color: TINTA },
  { nombre: 'Gules', color: '#a83a34' },
  { nombre: 'Azur', color: '#5b8fc4' },
]

export interface DisenoDeEmblema {
  /** Clave de la figura en el catálogo (ver domain/emblemaFiguras). */
  mueble: string
  particion: string
  /** "#rrggbb" del campo. */
  fondo: string
  /** "#rrggbb" de la figura. */
  figura: string
  /** Clave de CONTORNOS. */
  contorno: string
}

const HEX = /^#[0-9a-f]{6}$/i

function componentes(color: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(color)
  if (!m) return [107, 106, 99]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mezcla(a: string, b: string, t: number): string {
  const x = componentes(a)
  const y = componentes(b)
  const f = (i: number) =>
    Math.max(0, Math.min(255, Math.round(x[i] + (y[i] - x[i]) * t)))
      .toString(16)
      .padStart(2, '0')
  return `#${f(0)}${f(1)}${f(2)}`
}

function particionSvg(clave: string, claro: string, oscuro: string): string {
  switch (clave) {
    case 'jefe':
      return `<rect width="480" height="126" fill="${oscuro}" opacity=".6"/>`
    case 'faja':
      return `<rect y="190" width="480" height="100" fill="${claro}" opacity=".5"/>`
    case 'palo':
      return `<rect x="190" width="100" height="480" fill="${claro}" opacity=".5"/>`
    case 'banda':
      return `<path d="M-60 300 300 -60 400 40 40 400Z" fill="${claro}" opacity=".34"/>`
    case 'chevron':
      return `<path d="M240 140 490 390V490L240 240 -10 490V390Z" fill="${claro}" opacity=".45"/>`
    case 'cuartelado':
      return `<path d="M0 0h240v240H0z M240 240h240v240H240z" fill="${oscuro}" opacity=".55"/>`
    case 'cruz':
      return `<path d="M198 0h84v480h-84z M0 198h480v84H0z" fill="${claro}" opacity=".4"/>`
    case 'bordura':
      return `<path fill-rule="evenodd" d="M0 0h480v480H0z M46 46v388h388V46z" fill="${oscuro}" opacity=".6"/>`
    case 'burelado':
      return `<path d="M0 60h480v60H0z M0 180h480v60H0z M0 300h480v60H0z M0 420h480v60H0z" fill="${claro}" opacity=".3"/>`
    default:
      return ''
  }
}

/**
 * Coloca la figura dentro del hueco del contorno CONSERVANDO SU PROPORCIÓN, y
 * devuelve el `transform` que hay que ponerle.
 *
 * El path viene dibujado en un cuadro de 1000 con la figura centrada, así que
 * primero se lleva su esquina al origen (`-ox -oy`), luego se escala por el
 * factor que la hace caber entera —el menor de los dos— y por último se
 * centra en la caja.
 */
function encajarFigura(caja: [number, number, number, number], w: number, h: number): string {
  const [x0, y0, x1, y1] = caja
  const anchoCaja = x1 - x0
  const altoCaja = y1 - y0
  const k = Math.min(anchoCaja / Math.max(1, w), altoCaja / Math.max(1, h))
  const tx = x0 + (anchoCaja - w * k) / 2
  const ty = y0 + (altoCaja - h * k) / 2
  const ox = (1000 - w) / 2
  const oy = (1000 - h) / 2
  return `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${k.toFixed(4)}) translate(${-ox} ${-oy})`
}

/**
 * El emblema entero, en SVG. Cuadrado de 480, como los emblemas de facción.
 *
 * `figuras` puede ser null: entonces sale el campo con su partición y su
 * contorno, sin figura. Es lo que se ve el medio segundo que tarda en llegar el
 * catálogo, y es mejor que un hueco.
 */
export function svgDeEmblema(d: DisenoDeEmblema, figuras: CatalogoDeFiguras | null = figurasEnMemoria()): string {
  const adorno = CONTORNOS[d.contorno] ?? CONTORNOS.escudo
  const base = HEX.test(d.fondo) ? d.fondo : '#6b6a63'
  const figuraColor = HEX.test(d.figura) ? d.figura : PERGAMINO
  const oscuro = mezcla(base, TINTA, 0.5)
  const medio = mezcla(base, TINTA, 0.12)
  const claro = mezcla(base, PERGAMINO, 0.3)
  const fig = figuras?.[d.mueble] ?? null
  // Id único por diseño: dos emblemas en la misma página con el mismo id de
  // degradado se pisan el uno al otro.
  const id = Math.abs(
    [...`${d.mueble}${d.particion}${base}${figuraColor}${d.contorno}`].reduce(
      (a, c) => (a * 31 + c.charCodeAt(0)) | 0,
      7,
    ),
  ).toString(36)
  const dibujo = fig
    ? `<g fill="${figuraColor}" transform="${encajarFigura(adorno.caja, fig.w, fig.h)}"><path d="${fig.d}"/></g>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" width="480" height="480">
<defs>
<linearGradient id="f${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${medio}"/><stop offset="1" stop-color="${oscuro}"/></linearGradient>
<radialGradient id="v${id}" cx="50%" cy="40%" r="72%"><stop offset="52%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".42"/></radialGradient>
</defs>
<rect width="480" height="480" fill="url(#f${id})"/>
${particionSvg(d.particion, claro, oscuro)}
<path d="${adorno.path}" fill="${adorno.relleno ? oscuro : 'none'}" fill-opacity=".35" stroke="${figuraColor}" stroke-opacity=".85" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
${dibujo}
<rect width="480" height="480" fill="url(#v${id})"/>
<rect x="14" y="14" width="452" height="452" fill="none" stroke="${figuraColor}" stroke-opacity=".28" stroke-width="4"/>
<rect x="26" y="26" width="428" height="428" fill="none" stroke="${figuraColor}" stroke-opacity=".15" stroke-width="2"/>
</svg>`
}

/** El SVG listo para un `src`, sin pasar por la red. */
export function urlDeEmblema(d: DisenoDeEmblema, figuras: CatalogoDeFiguras | null = figurasEnMemoria()): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDeEmblema(d, figuras))}`
}

/**
 * Una figura suelta sobre un cuadrado, para las miniaturas del catálogo.
 *
 * Se pinta con los colores QUE ESTÁN PUESTOS en ese momento, no con unos de
 * muestra: el catálogo tiene 120 casillas y elegir sobre un gris que no es el
 * tuyo es elegir a ciegas.
 */
export function urlDeMuestraDeMueble(
  clave: string,
  fondo: string,
  figura: string,
  figuras: CatalogoDeFiguras | null = figurasEnMemoria(),
): string {
  const fig = figuras?.[clave]
  const cuerpo = fig
    ? `<g fill="${figura}" transform="${encajarFigura([56, 56, 424, 424], fig.w, fig.h)}"><path d="${fig.d}"/></g>`
    : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" width="480" height="480"><rect width="480" height="480" fill="${fondo}"/>${cuerpo}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * Solo el CAMPO con su partición, sin adorno y sin figura. Para las muestras de
 * "Campo" del diseñador.
 *
 * Sin adorno a propósito: lo que se está eligiendo ahí es cómo se parte el
 * fondo, y con un escudo y un dragón delante las diez muestras se parecían
 * entre sí mucho más de lo que se parecen los diez campos.
 */
export function urlDeMuestraDeCampo(particion: string, fondo: string, figura: string): string {
  const base = HEX.test(fondo) ? fondo : '#6b6a63'
  const tinta = HEX.test(figura) ? figura : PERGAMINO
  const oscuro = mezcla(base, TINTA, 0.5)
  const medio = mezcla(base, TINTA, 0.12)
  const claro = mezcla(base, PERGAMINO, 0.3)
  const id = Math.abs([...`${particion}${base}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)).toString(36)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" width="480" height="480">
<defs><linearGradient id="k${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${medio}"/><stop offset="1" stop-color="${oscuro}"/></linearGradient></defs>
<rect width="480" height="480" fill="url(#k${id})"/>
${particionSvg(particion, claro, oscuro)}
<rect x="14" y="14" width="452" height="452" fill="none" stroke="${tinta}" stroke-opacity=".28" stroke-width="4"/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function disenoPorDefecto(colorFaccion: string | null | undefined): DisenoDeEmblema {
  return {
    mueble: 'cruz_patee',
    particion: 'liso',
    fondo: colorFaccion && HEX.test(colorFaccion) ? colorFaccion : PALETA_FONDO[0].color,
    figura: PERGAMINO,
    contorno: 'escudo',
  }
}

// ---------------------------------------------------------------------------
// EL DISEÑO VIAJA EN EL NOMBRE DEL ARCHIVO.
//
// `emblemas/gen-dragon~faja~2f5d8c~f6efdc~escudo~a1b2c3.webp`. Así, al reabrir
// el emblema de un ejército, el diseñador arranca con lo que el usuario eligió
// en vez de empezar de cero — y sin una columna nueva en la base para guardar
// el diseño. La clave ya la teníamos que guardar de todas formas.
//
// El hueco del contorno guardaba antes un 1/0 ("¿lleva escudo?"), de cuando
// solo había dos formas. Los emblemas de entonces se siguen leyendo: 1 era el
// escudo y 0 el cuadrado. Romperlos habría dejado emblemas imposibles de
// reabrir por un cambio que no les afecta en nada.
// ---------------------------------------------------------------------------
export const PREFIJO_DISENO = 'emblemas/gen-'

export function claveDeDiseno(d: DisenoDeEmblema, hash: string, extension: string): string {
  const partes = [d.mueble, d.particion, d.fondo.slice(1), d.figura.slice(1), d.contorno, hash.slice(0, 10)]
  return `${PREFIJO_DISENO}${partes.join('~')}.${extension}`
}

/** Lee el diseño de una clave. Devuelve null si no es una clave de diseño. */
export function disenoDesdeClave(clave: string | null | undefined): DisenoDeEmblema | null {
  if (!clave || !clave.startsWith(PREFIJO_DISENO)) return null
  const cuerpo = clave.slice(PREFIJO_DISENO.length).replace(/\.[^.]+$/, '')
  const p = cuerpo.split('~')
  if (p.length < 5) return null
  const fondo = `#${p[2]}`
  const figura = `#${p[3]}`
  // El adorno ha cambiado de nombre dos veces y las dos se siguen leyendo: al
  // principio era un 1/0 ("¿lleva escudo?"), y luego hubo una 'banda' que
  // recortaba el emblema y ahora es la 'linea' que lo cruza. Romper emblemas ya
  // guardados por un cambio que no les afecta sería gratuito.
  //
  // La figura NO se valida contra el catálogo: no está cargado todavía cuando
  // esto se llama, y una figura que no exista se pinta como "sin figura" en vez
  // de tirar el diseño entero a la basura.
  const contorno = p[4] === '1' ? 'escudo' : p[4] === '0' ? 'cuadrado' : p[4] === 'banda' ? 'linea' : p[4]
  if (!PARTICIONES[p[1]] || !CONTORNOS[contorno] || !HEX.test(fondo) || !HEX.test(figura)) return null
  return { mueble: p[0], particion: p[1], fondo, figura, contorno }
}
