// ============================================================================
// Quitar el fondo y recortar una imagen. Aritmética pura sobre los píxeles: no
// toca el DOM ni el canvas, así que se puede probar fuera del navegador (que es
// justo lo que se hizo con estas dos funciones antes de darlas por buenas).
//
// EL FONDO SE QUITA POR CONEXIÓN, NO POR COLOR. Borrar "todo lo blanco" se come
// los cascos, la nieve y los reflejos del interior del dibujo. Lo que se borra
// aquí es lo que TOCA EL BORDE y sigue siendo del color del fondo: un rellenado
// por inundación desde los cuatro lados. Una nube blanca dentro de un bosque no
// llega al borde, así que se queda.
//
// Y NO SE DA POR HECHO QUE EL FONDO SEA BLANCO: se muestrean las cuatro
// esquinas y se usa su color. Con esto vale igual para un recorte sobre negro,
// que es como venían un par de las ilustraciones.
// ============================================================================

/** Cuánto puede alejarse un píxel del color del fondo y seguir contando como fondo. */
const TOLERANCIA = 42

/** Píxeles del borde hacia dentro que se miran para adivinar el color del fondo. */
const MARGEN_MUESTRA = 2

interface Rgb {
  r: number
  g: number
  b: number
}

function pixel(data: Uint8ClampedArray, i: number): Rgb {
  return { r: data[i], g: data[i + 1], b: data[i + 2] }
}

/** Distancia de color, sin raíz cuadrada (solo hay que comparar con un umbral). */
function distancia(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/**
 * El color del fondo, deducido de las cuatro esquinas. Si las esquinas no se
 * parecen entre sí, la imagen no tiene un fondo plano que quitar y se devuelve
 * null: ahí lo prudente es no tocar nada.
 */
export function colorDeFondo(data: Uint8ClampedArray, width: number, height: number): Rgb | null {
  const m = MARGEN_MUESTRA
  const esquinas = [
    (m * width + m) * 4,
    (m * width + (width - 1 - m)) * 4,
    ((height - 1 - m) * width + m) * 4,
    ((height - 1 - m) * width + (width - 1 - m)) * 4,
  ].map((i) => pixel(data, i))

  const medio = {
    r: Math.round(esquinas.reduce((s, c) => s + c.r, 0) / 4),
    g: Math.round(esquinas.reduce((s, c) => s + c.g, 0) / 4),
    b: Math.round(esquinas.reduce((s, c) => s + c.b, 0) / 4),
  }
  // Tres de las cuatro esquinas tienen que parecerse al color medio. Con la
  // cuarta se es indulgente: en muchas ilustraciones el dibujo llega hasta una
  // esquina.
  const parecidas = esquinas.filter((c) => distancia(c, medio) <= TOLERANCIA).length
  return parecidas >= 3 ? medio : null
}

/**
 * Hace transparente el fondo: los píxeles del color del fondo conectados al
 * borde. Modifica `data` en el sitio y devuelve cuántos píxeles ha borrado.
 *
 * El recorrido es iterativo, con una pila propia y no con recursión: una imagen
 * de 1024 × 1024 son más de un millón de píxeles y la recursión revienta la
 * pila del intérprete mucho antes.
 */
export function quitarFondo(data: Uint8ClampedArray, width: number, height: number): number {
  const fondo = colorDeFondo(data, width, height)
  if (!fondo) return 0

  const visitado = new Uint8Array(width * height)
  const pila: number[] = []

  // Se siembra desde los cuatro lados.
  for (let x = 0; x < width; x++) {
    pila.push(x, (height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    pila.push(y * width, y * width + width - 1)
  }

  let borrados = 0
  while (pila.length > 0) {
    const p = pila.pop()!
    if (visitado[p]) continue
    visitado[p] = 1
    const i = p * 4
    // Ya transparente: cuenta como fondo y deja pasar la inundación, pero no
    // se apunta como borrado.
    const yaVacio = data[i + 3] === 0
    if (!yaVacio && distancia(pixel(data, i), fondo) > TOLERANCIA) continue
    if (!yaVacio) {
      data[i + 3] = 0
      borrados++
    }
    const x = p % width
    const y = (p / width) | 0
    if (x > 0) pila.push(p - 1)
    if (x < width - 1) pila.push(p + 1)
    if (y > 0) pila.push(p - width)
    if (y < height - 1) pila.push(p + width)
  }
  return borrados
}

export interface Caja {
  x: number
  y: number
  ancho: number
  alto: number
}

/**
 * La caja que ocupa lo que NO es transparente. Sirve para recortar el aire que
 * queda alrededor tras quitar el fondo: si no, un bosque que ocupa la mitad de
 * su imagen se coloca en la mesa con 20 cm de nada alrededor y no hay forma de
 * ajustarlo.
 *
 * Devuelve null si no queda nada opaco (imagen entera borrada), para que quien
 * llame pueda dejar el original en paz en vez de recortar a cero.
 */
export function cajaDeContenido(data: Uint8ClampedArray, width: number, height: number, alfaMin = 8): Caja | null {
  let x0 = width
  let y0 = height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] >= alfaMin) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  return { x: x0, y: y0, ancho: x1 - x0 + 1, alto: y1 - y0 + 1 }
}
