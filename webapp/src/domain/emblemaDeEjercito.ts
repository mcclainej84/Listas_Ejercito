// ============================================================================
// EL EMBLEMA DE UN EJÉRCITO: catálogo heráldico y montaje del escudo.
//
// Es un DISEÑADOR, no un generador de ruido: se elige una FIGURA (el "mueble"
// en heráldica), cómo se parte el CAMPO y los colores. Con esas cuatro
// decisiones sale un escudo que parece un escudo.
//
// POR QUÉ SILUETAS Y NO TRAZOS. Un emblema tiene que leerse a 40 px, que es el
// tamaño al que sale en el listado de Ejércitos. A ese tamaño un trazo de dos
// píxeles desaparece; una silueta rellena aguanta. El detalle —las cuencas de
// la calavera, las ventanas de la torre, la pupila del ojo— se hace con el
// HUECO (`fill-rule="evenodd"`), que es como se resuelve en heráldica de
// verdad.
//
// LAS FIGURAS NO TRAEN COLOR. Ninguna lleva `fill` ni `stroke`: heredan el que
// les inyecta `svgDeEmblema`. Es lo que permite que el usuario cambie los
// colores, y es el requisito principal del encargo de figuras nuevas (ver
// docs/ENCARGO_EMBLEMAS.md). Para añadir una, basta con pegar aquí el contenido
// de su SVG —sin la etiqueta <svg> y sin ningún atributo de color— con su clave
// y su nombre. No hay que tocar nada más.
//
// TODO ES SVG, TEXTO PLANO: sin dependencias, sin lienzo y sin red, así que el
// diseñador repinta el escudo entero en cada clic sin coste. Solo al guardar se
// convierte en imagen (shared/image#rasterizarSvg) y se sube.
// ============================================================================

const CX = 240
const CY = 252

/** Estrella de `n` puntas, con radios alternos. */
function estrella(n: number, rExt: number, rInt: number, giro = -Math.PI / 2): string {
  const p: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rExt : rInt
    const a = giro + (i * Math.PI) / n
    p.push(`${(CX + r * Math.cos(a)).toFixed(1)} ${(CY + r * Math.sin(a)).toFixed(1)}`)
  }
  return `M${p.join(' L')} Z`
}

/** Rueda dentada, diente a diente. */
function engranaje(dientes: number, rExt: number, rInt: number): string {
  let d = ''
  const paso = Math.PI / dientes
  const P = (r: number, a: number) => `${(CX + r * Math.cos(a)).toFixed(1)} ${(CY + r * Math.sin(a)).toFixed(1)}`
  for (let i = 0; i < dientes; i++) {
    const a0 = i * 2 * paso - Math.PI / 2
    d += (i === 0 ? 'M' : 'L') + P(rInt, a0 - paso * 0.55)
    d += ' L' + P(rExt, a0 - paso * 0.32)
    d += ' L' + P(rExt, a0 + paso * 0.32)
    d += ' L' + P(rInt, a0 + paso * 0.55)
  }
  return d + ' Z'
}

const CRUZ_PATY = (() => {
  const c = 24
  const e = 58
  const l = 98
  const q = 34
  return (
    `M${CX - c} ${CY - c} Q${CX - q} ${CY - 62} ${CX - e} ${CY - l} L${CX + e} ${CY - l} Q${CX + q} ${CY - 62} ${CX + c} ${CY - c}` +
    ` Q${CX + 62} ${CY - q} ${CX + l} ${CY - e} L${CX + l} ${CY + e} Q${CX + 62} ${CY + q} ${CX + c} ${CY + c}` +
    ` Q${CX + q} ${CY + 62} ${CX + e} ${CY + l} L${CX - e} ${CY + l} Q${CX - q} ${CY + 62} ${CX - c} ${CY + c}` +
    ` Q${CX - 62} ${CY + q} ${CX - l} ${CY + e} L${CX - l} ${CY - e} Q${CX - 62} ${CY - q} ${CX - c} ${CY - c} Z`
  )
})()

const ESPADA =
  '<path d="M240 118 L252 146 L252 300 L228 300 L228 146 Z"/>' +
  '<path d="M196 300h88v18h-88z"/><path d="M232 318h16v52h-16z"/><circle cx="240" cy="382" r="14"/>'

export interface Mueble {
  nombre: string
  /** Contenido del SVG, SIN etiqueta <svg> y SIN atributos de color. */
  cuerpo: string
}

/**
 * El catálogo. Provisional: son las figuras que salieron legibles a 40 px.
 * Para añadir una nueva, pegar su SVG aquí (ver la cabecera del archivo).
 */
export const MUEBLES: Record<string, Mueble> = {
  'cruz-paty': { nombre: 'Cruz paté', cuerpo: `<path d="${CRUZ_PATY}"/>` },
  sotuer: {
    nombre: 'Sotuer',
    cuerpo:
      '<path d="M162 140 L240 218 L318 140 L346 168 L268 246 L346 324 L318 352 L240 274 L162 352 L134 324 L212 246 L134 168Z"/>' +
      '<path d="M126 132h56v56h-56Z M298 132h56v56h-56Z M126 304h56v56h-56Z M298 304h56v56h-56Z"/>',
  },
  creciente: { nombre: 'Creciente', cuerpo: '<path d="M300 168a88 88 0 1 0 0 168 70 70 0 1 1 0-168Z"/>' },
  estrella: { nombre: 'Estrella', cuerpo: `<path d="${estrella(8, 104, 42)}"/>` },
  mullete: { nombre: 'Estrella de seis', cuerpo: `<path d="${estrella(6, 104, 52)}"/>` },
  sol: {
    nombre: 'Sol radiante',
    cuerpo: `<path d="${estrella(12, 116, 58)}"/><circle cx="${CX}" cy="${CY}" r="60"/>`,
  },
  rueda: {
    nombre: 'Engranaje',
    cuerpo: `<path fill-rule="evenodd" d="${engranaje(11, 106, 78)} M${CX} ${CY - 46}a46 46 0 1 0 .1 0Z M${CX} ${CY - 22}a22 22 0 1 1-.1 0Z"/>`,
  },
  torre: {
    nombre: 'Torre',
    cuerpo:
      '<path fill-rule="evenodd" d="M158 200h26v-26h26v26h30v-26h26v26h30v-26h26v26h26v168H158Z ' +
      'M226 300h28v68h-28Z M186 232h30v30h-30Z M264 232h30v30h-30Z"/>',
  },
  espadas: {
    nombre: 'Espadas cruzadas',
    cuerpo: `<g transform="rotate(38 ${CX} ${CY})">${ESPADA}</g><g transform="rotate(-38 ${CX} ${CY})">${ESPADA}</g>`,
  },
  calavera: {
    nombre: 'Calavera',
    cuerpo:
      '<path d="M150 300 L330 372 L322 392 L142 320Z M330 320 L150 392 L142 372 L322 300Z"/>' +
      '<path fill-rule="evenodd" d="M240 140c50 0 84 36 84 82 0 28-14 48-28 60v26h-40v-20h-32v20h-40v-26c-14-12-28-32-28-60 0-46 34-82 84-82Z ' +
      'M204 236a22 26 0 1 0 0-.1Z M276 236a22 26 0 1 1 0-.1Z M232 268h16l-8 22Z"/>',
  },
  martillo: {
    nombre: 'Martillo',
    cuerpo:
      '<path d="M168 148h144v34l-20 18 20 18v34H168v-34l20-18-20-18Z"/><path d="M198 252h84v22h-84Z"/>' +
      '<path d="M220 274h40v112h-40Z"/><path d="M204 382h72v26h-72Z"/>',
  },
  corona: {
    nombre: 'Corona',
    cuerpo:
      '<path d="M148 200l34 46 34-70 24 70 24-70 34 70 34-46 14 128H134Z"/>' +
      '<rect x="140" y="336" width="200" height="34" rx="8"/>' +
      '<circle cx="182" cy="196" r="14"/><circle cx="298" cy="196" r="14"/><circle cx="240" cy="164" r="16"/>',
  },
  garra: {
    nombre: 'Garra',
    cuerpo:
      '<path d="M186 118c22 66 20 140-16 208-16 30-40 40-52 22 34-46 46-142 40-230Z"/>' +
      '<path d="M252 106c18 76 10 158-30 232-18 32-44 42-56 22 38-50 56-160 52-254Z"/>' +
      '<path d="M318 128c14 70 2 144-34 208-16 30-40 40-52 22 34-46 52-142 50-230Z"/>',
  },
  arbol: {
    nombre: 'Roble',
    cuerpo:
      '<path d="M240 128c34 0 58 20 66 46 26 2 44 22 44 46 0 16-8 30-22 38 8 8 12 18 12 28 0 26-24 44-56 44-14 0-26-4-36-10-10 6-22 10-36 10-32 0-56-18-56-44 0-10 4-20 12-28-14-8-22-22-22-38 0-24 18-44 44-46 8-26 32-46 66-46Z"/>' +
      '<path d="M226 316h28v72h-28Z"/><path d="M198 386h84v18h-84Z"/>',
  },
  llama: {
    nombre: 'Llama',
    cuerpo:
      '<path d="M240 122c8 46-18 62-40 92-18 24-26 46-26 68 0 48 32 82 66 82s66-34 66-82c0-30-16-54-32-72-6 16-16 24-26 24 12-40 4-80-8-112Z"/>',
  },
  rayo: { nombre: 'Rayo', cuerpo: '<path d="M276 122 168 268h58l-30 92 116-152h-60Z"/>' },
  ojo: {
    nombre: 'Ojo',
    cuerpo:
      '<path fill-rule="evenodd" d="M240 168c62 0 108 44 122 76-14 32-60 76-122 76s-108-44-122-76c14-32 60-76 122-76Z ' +
      'M240 200a44 44 0 1 0 .1 0Z M240 224a20 20 0 1 1-.1 0Z"/>',
  },
  roeles: {
    nombre: 'Tres roeles',
    cuerpo: '<circle cx="240" cy="180" r="42"/><circle cx="176" cy="296" r="42"/><circle cx="304" cy="296" r="42"/>',
  },
  rombo: {
    nombre: 'Rombo',
    cuerpo: '<path fill-rule="evenodd" d="M240 134 344 252 240 370 136 252Z M240 186 188 252 240 318 292 252Z"/>',
  },
  ninguno: { nombre: 'Sin figura', cuerpo: '' },
}

export const PARTICIONES: Record<string, string> = {
  liso: 'Liso',
  faja: 'Faja',
  palo: 'Palo',
  banda: 'Banda',
  cuartelado: 'Cuartelado',
  chevron: 'Chevrón',
  jefe: 'Jefe',
}

const PERGAMINO = '#f6efdc'
const TINTA = '#241a10'

/** Colores de campo. Los esmaltes y metales de toda la vida, más los del programa. */
export const PALETA_FONDO: { nombre: string; color: string }[] = [
  { nombre: 'Gules', color: '#8c2f2f' },
  { nombre: 'Granate', color: '#5e1a17' },
  { nombre: 'Azur', color: '#2f5d8c' },
  { nombre: 'Añil', color: '#243a63' },
  { nombre: 'Sinople', color: '#3f7a45' },
  { nombre: 'Oliva', color: '#6b7a3a' },
  { nombre: 'Púrpura', color: '#5a3a63' },
  { nombre: 'Oro', color: '#c9a227' },
  { nombre: 'Bronce', color: '#a06a2c' },
  { nombre: 'Sable', color: '#2b2620' },
  { nombre: 'Plata', color: '#b9bec4' },
  { nombre: 'Pergamino', color: '#c9b78d' },
]

/** Colores de figura. Pocos a propósito: en heráldica el mueble es metal o esmalte. */
export const PALETA_FIGURA: { nombre: string; color: string }[] = [
  { nombre: 'Pergamino', color: PERGAMINO },
  { nombre: 'Oro', color: '#e8c565' },
  { nombre: 'Plata', color: '#d8dde2' },
  { nombre: 'Tinta', color: TINTA },
  { nombre: 'Gules', color: '#a83a34' },
]

export interface DisenoDeEmblema {
  mueble: string
  particion: string
  /** "#rrggbb" del campo. */
  fondo: string
  /** "#rrggbb" de la figura. */
  figura: string
  conEscudo: boolean
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
    case 'faja':
      return `<rect x="0" y="196" width="480" height="88" fill="${claro}" opacity=".5"/>`
    case 'palo':
      return `<rect x="196" y="0" width="88" height="480" fill="${claro}" opacity=".5"/>`
    case 'banda':
      // Con filete: sin él, una banda clara en diagonal se lee como el reflejo
      // de un icono de aplicación y no como una pieza heráldica.
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

const ESCUDO = 'M240 78 L404 136 V268 c0 88-76 122-164 148 -88-26-164-60-164-148 V136 Z'

/** El emblema entero, en SVG. Cuadrado de 480, como los emblemas de facción. */
export function svgDeEmblema(d: DisenoDeEmblema): string {
  const base = HEX.test(d.fondo) ? d.fondo : '#6b6a63'
  const figura = HEX.test(d.figura) ? d.figura : PERGAMINO
  const oscuro = mezcla(base, TINTA, 0.5)
  const medio = mezcla(base, TINTA, 0.12)
  const claro = mezcla(base, PERGAMINO, 0.3)
  const cuerpo = MUEBLES[d.mueble]?.cuerpo ?? ''
  // Id único por diseño: dos emblemas en la misma página con el mismo id de
  // degradado se pisan el uno al otro.
  const id = Math.abs(
    [...`${d.mueble}${d.particion}${base}${figura}${d.conEscudo}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7),
  ).toString(36)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" width="480" height="480">
<defs>
<linearGradient id="f${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${medio}"/><stop offset="1" stop-color="${oscuro}"/></linearGradient>
<radialGradient id="v${id}" cx="50%" cy="42%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".42"/></radialGradient>
</defs>
<rect width="480" height="480" fill="url(#f${id})"/>
${particionSvg(d.particion, claro, oscuro)}
${d.conEscudo ? `<path d="${ESCUDO}" fill="${oscuro}" fill-opacity=".45" stroke="${figura}" stroke-opacity=".85" stroke-width="14" stroke-linejoin="round"/>` : ''}
<g fill="${figura}">${cuerpo}</g>
<rect x="14" y="14" width="452" height="452" fill="none" stroke="${figura}" stroke-opacity=".28" stroke-width="4"/>
<rect x="26" y="26" width="428" height="428" fill="none" stroke="${figura}" stroke-opacity=".15" stroke-width="2"/>
<rect width="480" height="480" fill="url(#v${id})"/>
</svg>`
}

/** El SVG listo para un `src`, sin pasar por la red. */
export function urlDeEmblema(d: DisenoDeEmblema): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDeEmblema(d))}`
}

/** Una figura suelta sobre un cuadrado, para las miniaturas del catálogo. */
export function urlDeMuestraDeMueble(clave: string, fondo: string, figura: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" width="480" height="480"><rect width="480" height="480" fill="${fondo}"/><g fill="${figura}">${MUEBLES[clave]?.cuerpo ?? ''}</g></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function disenoPorDefecto(colorFaccion: string | null | undefined): DisenoDeEmblema {
  return {
    mueble: 'cruz-paty',
    particion: 'liso',
    fondo: colorFaccion && HEX.test(colorFaccion) ? colorFaccion : PALETA_FONDO[0].color,
    figura: PERGAMINO,
    conEscudo: true,
  }
}

// ---------------------------------------------------------------------------
// EL DISEÑO VIAJA EN EL NOMBRE DEL ARCHIVO.
//
// `emblemas/gen-cruz-paty~faja~2f5d8c~f6efdc~1~a1b2c3.webp`. Así, al reabrir el
// emblema de un ejército, el diseñador puede arrancar con lo que el usuario
// eligió en vez de empezar de cero — y sin una columna nueva en la base para
// guardar el diseño. La clave ya la teníamos que guardar de todas formas.
// ---------------------------------------------------------------------------
export const PREFIJO_DISENO = 'emblemas/gen-'

export function claveDeDiseno(d: DisenoDeEmblema, hash: string, extension: string): string {
  const partes = [
    d.mueble,
    d.particion,
    d.fondo.slice(1),
    d.figura.slice(1),
    d.conEscudo ? '1' : '0',
    hash.slice(0, 10),
  ]
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
  if (!MUEBLES[p[0]] || !PARTICIONES[p[1]] || !HEX.test(fondo) || !HEX.test(figura)) return null
  return { mueble: p[0], particion: p[1], fondo, figura, conEscudo: p[4] === '1' }
}
