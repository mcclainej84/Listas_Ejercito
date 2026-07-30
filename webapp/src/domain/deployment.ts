// ============================================================================
// Despliegue: colocar las unidades de una lista sobre la mesa antes de jugar.
//
// TODO VA EN CENTÍMETROS REALES, no en píxeles. La mesa mide 180 × 120 y una
// unidad está en (34, 12) de mesa, no "a 217 píxeles del borde". El lienzo se
// dibuja a los píxeles que haga falta según la pantalla, pero lo que se guarda
// —y lo que significa algo— son los centímetros: el mismo plan se ve igual en
// un portátil y en un móvil, y las distancias se pueden leer con una regla.
// ============================================================================

/** Medidas de la mesa, en centímetros. */
export const MESA_ANCHO_CM = 180
export const MESA_ALTO_CM = 120

/** Ancho × fondo de una peana sobre la mesa, en cm. */
export interface TamanoCm {
  anchoCm: number
  altoCm: number
}

/**
 * Tamaños de peana, en cm de mesa y a escala real.
 *
 * Salen de las peanas del juego: 12 × 10 es el frente típico de un regimiento,
 * 5 × 10 la peana de carro (50 × 100 mm) y 4 × 4 la de personaje o máquina
 * (40 × 40 mm). Al ir a escala, dos unidades pegadas en el lienzo están
 * pegadas de verdad sobre la mesa.
 */
export const TAMANO_UNIDAD: TamanoCm = { anchoCm: 12, altoCm: 10 }
export const TAMANO_PERSONAJE: TamanoCm = { anchoCm: 4, altoCm: 4 }
export const TAMANO_CARRO: TamanoCm = { anchoCm: 5, altoCm: 10 }

/** Etiquetas que van con peana pequeña de 4 × 4, como los personajes. */
const CODIGOS_PEANA_PEQUENA = ['MAQUINA_GUERRA', 'ASEDIO']
/** Etiquetas de carro. También cuenta llevar un carro elegido en la entrada. */
const CODIGOS_CARRO = ['CARRO']

/**
 * Qué peana le toca a una entrada de la lista.
 *
 * Se mira, por este orden: si es personaje, si lleva carro (por etiqueta o
 * porque se le ha elegido uno en la lista) y si es máquina de guerra. Lo demás
 * es un regimiento.
 *
 * El carro va ANTES que la máquina de guerra porque una unidad puede tener las
 * dos cosas y sobre la mesa lo que ocupa es el carro.
 */
export function tamanoDeEntrada(opciones: {
  unitType: string
  typeTagCode: string | null | undefined
  llevaCarro: boolean
}): TamanoCm {
  const { unitType, typeTagCode, llevaCarro } = opciones
  if (llevaCarro || (typeTagCode != null && CODIGOS_CARRO.includes(typeTagCode))) return TAMANO_CARRO
  if (unitType === 'personaje') return TAMANO_PERSONAJE
  if (typeTagCode != null && CODIGOS_PEANA_PEQUENA.includes(typeTagCode)) return TAMANO_PERSONAJE
  return TAMANO_UNIDAD
}

/** Retícula de ayuda del lienzo, en cm. Coincide con las 12" de una mesa de reglamento. */
export const RETICULA_CM = 30

/** Dónde está una entrada sobre la mesa. `x`/`y` son el CENTRO de la peana, en cm. */
export interface DeploymentPosition {
  entryId: number
  xCm: number
  yCm: number
}

/**
 * Mantiene la peana dentro de la mesa.
 *
 * Se sujeta por su CENTRO, así que el margen es media peana por cada lado. Sin
 * esto, arrastrar hasta el borde dejaría media unidad fuera del tablero, que es
 * una posición que no existe en una partida.
 */
export function limitarAMesa(xCm: number, yCm: number, tamano: TamanoCm): { xCm: number; yCm: number } {
  const margenX = tamano.anchoCm / 2
  const margenY = tamano.altoCm / 2
  return {
    xCm: Math.min(MESA_ANCHO_CM - margenX, Math.max(margenX, xCm)),
    yCm: Math.min(MESA_ALTO_CM - margenY, Math.max(margenY, yCm)),
  }
}

/** Redondea a medio centímetro: la precisión que se puede medir de verdad sobre una mesa. */
export function redondearCm(valor: number): number {
  return Math.round(valor * 2) / 2
}
