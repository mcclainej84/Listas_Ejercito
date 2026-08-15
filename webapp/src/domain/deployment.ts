// ============================================================================
// Despliegue: colocar las unidades de una lista sobre la mesa antes de jugar.
//
// TODO VA EN CENTÍMETROS REALES, no en píxeles. La mesa mide lo que diga la
// lista y una unidad está en (34, 12) de mesa, no "a 217 píxeles del borde". El
// lienzo se dibuja a los píxeles que haga falta según la pantalla, pero lo que
// se guarda —y lo que significa algo— son los centímetros: el mismo plan se ve
// igual en un portátil y en un móvil, y las distancias se pueden leer con una
// regla.
// ============================================================================

/** Medidas de la mesa por defecto, en centímetros. */
export const MESA_ANCHO_CM = 180
export const MESA_ALTO_CM = 120

/** Hasta dónde se puede agrandar la mesa. Por debajo no se baja de la de serie. */
export const MESA_ANCHO_MAX_CM = 240
export const MESA_ALTO_MAX_CM = 180
export const MESA_ANCHO_MIN_CM = 60
export const MESA_ALTO_MIN_CM = 60

/** Ancho × fondo de una peana sobre la mesa, en cm. */
export interface TamanoCm {
  anchoCm: number
  altoCm: number
}

/** Medidas de la mesa de una lista, en cm. */
export interface Mesa {
  anchoCm: number
  altoCm: number
}

export const MESA_POR_DEFECTO: Mesa = { anchoCm: MESA_ANCHO_CM, altoCm: MESA_ALTO_CM }

/**
 * Tamaño de peana cuando no hay etiqueta que lo diga.
 *
 * El estándar de cada etiqueta vive ahora en la base (unit_type_tags.base_*_cm)
 * y se edita en Categorías y Etiquetas. Esto es solo la última red: una unidad
 * sin etiqueta ninguna.
 */
export const TAMANO_UNIDAD: TamanoCm = { anchoCm: 12, altoCm: 10 }
export const TAMANO_PERSONAJE: TamanoCm = { anchoCm: 4, altoCm: 4 }

/** Límites al redimensionar una peana a mano. Nada de peanas de 0 ni más grandes que la mesa. */
export const PEANA_MIN_CM = 2
export const PEANA_MAX_CM = 60

/**
 * Qué peana le toca a una entrada de la lista.
 *
 * Manda la ETIQUETA, con su tamaño configurable. Sin etiqueta se distingue solo
 * entre personaje (una miniatura, 4 × 4) y tropa (un regimiento, 12 × 10), que
 * es lo poco que se puede deducir sin más datos.
 *
 * `tamanoPropio` gana a todo: es el tamaño que el usuario le ha dado a ESA
 * peana arrastrando su esquina, y una preferencia explícita pesa más que
 * cualquier estándar.
 */
export function tamanoDeEntrada(opciones: {
  unitType: string
  tamanoEtiqueta: TamanoCm | null | undefined
  tamanoPropio: TamanoCm | null | undefined
}): TamanoCm {
  const { unitType, tamanoEtiqueta, tamanoPropio } = opciones
  if (tamanoPropio) return tamanoPropio
  if (tamanoEtiqueta) return tamanoEtiqueta
  return unitType === 'personaje' ? TAMANO_PERSONAJE : TAMANO_UNIDAD
}

/** Retícula de ayuda del lienzo, en cm. Coincide con las 12" de una mesa de reglamento. */
export const RETICULA_CM = 30

/** Dónde está una entrada sobre la mesa, y de qué tamaño. `x`/`y` son el CENTRO de la peana, en cm. */
export interface DeploymentPosition {
  entryId: number
  xCm: number
  yCm: number
  /** Ancho a medida, o null para usar el estándar de la etiqueta. */
  anchoCm: number | null
  /** Fondo a medida, o null para usar el estándar de la etiqueta. */
  altoCm: number | null
}

/**
 * Mantiene la peana dentro de la mesa.
 *
 * Se sujeta por su CENTRO, así que el margen es media peana por cada lado. Sin
 * esto, arrastrar hasta el borde dejaría media unidad fuera del tablero, que es
 * una posición que no existe en una partida.
 */
export function limitarAMesa(xCm: number, yCm: number, tamano: TamanoCm, mesa: Mesa): { xCm: number; yCm: number } {
  const margenX = Math.min(tamano.anchoCm / 2, mesa.anchoCm / 2)
  const margenY = Math.min(tamano.altoCm / 2, mesa.altoCm / 2)
  return {
    xCm: Math.min(mesa.anchoCm - margenX, Math.max(margenX, xCm)),
    yCm: Math.min(mesa.altoCm - margenY, Math.max(margenY, yCm)),
  }
}

/** Redondea a medio centímetro: la precisión que se puede medir de verdad sobre una mesa. */
export function redondearCm(valor: number): number {
  return Math.round(valor * 2) / 2
}

/** Una peana ya colocada, con su tamaño resuelto. */
export interface PeanaEnMesa {
  entryId: number
  xCm: number
  yCm: number
  tamano: TamanoCm
}

/**
 * Alinea las unidades en FRENTES DE BATALLA.
 *
 * Cómo funciona: se busca la unidad más adelantada (la que tiene el frente más
 * cerca del enemigo, o sea la `y` menor). Todas las que se solapen con ella en
 * vertical forman su misma línea y suben a su altura. Las que no se solapen se
 * quedan donde están y se repite el proceso con ellas: sale otra línea, y otra,
 * hasta que no queda ninguna. Por eso puede haber varios frentes a la vez, que
 * es justo lo que se pidió.
 *
 * SE ALINEAN LOS FRENTES, NO LOS CENTROS. Una peana de personaje tiene 4 cm de
 * fondo y un regimiento 10: igualando los centros, el personaje quedaría 3 cm
 * por detrás de la línea. Lo que forma una línea de batalla es que los frentes
 * estén a la misma altura, así que cada peana se coloca por su frente y su
 * fondo cae hacia atrás.
 *
 * El solape se mide contra el tramo del LÍDER, no contra el de la unidad que se
 * acaba de mover: si se encadenaran, una fila de unidades escalonadas se
 * arrastraría entera hasta la primera, y el ejemplo del usuario dice justo lo
 * contrario (la unidad Z se queda donde está).
 */
export function alinearFrentes(
  peanas: PeanaEnMesa[],
  mesa: Mesa,
): Array<{ entryId: number; xCm: number; yCm: number }> {
  const frenteDe = (p: PeanaEnMesa) => p.yCm - p.tamano.altoCm / 2
  const traseraDe = (p: PeanaEnMesa) => p.yCm + p.tamano.altoCm / 2

  const pendientes = [...peanas].sort((a, b) => frenteDe(a) - frenteDe(b))
  const resultado: Array<{ entryId: number; xCm: number; yCm: number }> = []

  while (pendientes.length > 0) {
    const lider = pendientes.shift()!
    const frente = frenteDe(lider)
    const trasera = traseraDe(lider)

    const alineadas = [lider]
    for (let i = pendientes.length - 1; i >= 0; i--) {
      const candidata = pendientes[i]
      // Solape estricto: tocarse justo por el borde no es estar en la misma
      // línea, es estar una detrás de otra.
      if (frenteDe(candidata) < trasera && traseraDe(candidata) > frente) {
        alineadas.push(candidata)
        pendientes.splice(i, 1)
      }
    }

    for (const peana of alineadas) {
      const dentro = limitarAMesa(peana.xCm, frente + peana.tamano.altoCm / 2, peana.tamano, mesa)
      resultado.push({ entryId: peana.entryId, xCm: redondearCm(dentro.xCm), yCm: redondearCm(dentro.yCm) })
    }
  }

  return resultado
}

/**
 * Recorta un desplazamiento para que NINGUNA de las peanas se salga de la mesa.
 *
 * Se calcula un único recorte para todo el grupo, no uno por peana. Si cada una
 * se limitara por su cuenta, al empujar la formación contra un borde las de
 * fuera se pararían y las de dentro seguirían: el frente se deformaría solo por
 * haber arrastrado un poco de más. Así el grupo se mueve como un bloque y
 * simplemente deja de avanzar cuando la primera toca el borde.
 */
export function limitarDesplazamiento(
  peanas: PeanaEnMesa[],
  dxCm: number,
  dyCm: number,
  mesa: Mesa,
): { dxCm: number; dyCm: number } {
  let dx = dxCm
  let dy = dyCm
  for (const p of peanas) {
    const margenX = Math.min(p.tamano.anchoCm / 2, mesa.anchoCm / 2)
    const margenY = Math.min(p.tamano.altoCm / 2, mesa.altoCm / 2)
    dx = Math.max(margenX - p.xCm, Math.min(mesa.anchoCm - margenX - p.xCm, dx))
    dy = Math.max(margenY - p.yCm, Math.min(mesa.altoCm - margenY - p.yCm, dy))
  }
  return { dxCm: dx, dyCm: dy }
}

/** Un rectángulo de selección sobre la mesa, en cm. Los extremos pueden venir en cualquier orden. */
export interface RectanguloCm {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** ¿Toca esta peana el rectángulo? Basta con rozarlo: pedir que quepa entera obligaría a barridos enormes. */
export function peanaDentroDelRectangulo(peana: PeanaEnMesa, rect: RectanguloCm): boolean {
  const izq = Math.min(rect.x1, rect.x2)
  const der = Math.max(rect.x1, rect.x2)
  const arr = Math.min(rect.y1, rect.y2)
  const aba = Math.max(rect.y1, rect.y2)
  return (
    peana.xCm - peana.tamano.anchoCm / 2 < der &&
    peana.xCm + peana.tamano.anchoCm / 2 > izq &&
    peana.yCm - peana.tamano.altoCm / 2 < aba &&
    peana.yCm + peana.tamano.altoCm / 2 > arr
  )
}

/** Encierra un valor entre dos límites. */
export function acotar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor))
}
