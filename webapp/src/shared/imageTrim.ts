// ============================================================================
// Preparar los píxeles de una pieza de escenografía: quitar el fondo, DIFUMINAR
// EL CANTO y recortar. Aritmética pura: no toca el DOM ni el canvas, así que se
// puede probar fuera del navegador (que es justo lo que se hizo con estas
// funciones antes de darlas por buenas).
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
//
// ---------------------------------------------------------------------------
// POR QUÉ EL CANTO SE DIFUMINA (agosto de 2026)
// ---------------------------------------------------------------------------
// Al juntar varios caminos sobre la mesa se veía el corte de cada pieza como
// una línea, y cada pieza se leía como una pegatina puesta encima del terreno
// en vez de como parte de él. Eran TRES fallos distintos sumados, y los tres se
// arreglan en este archivo:
//
//   1. EL RECORTE ERA BINARIO. Un píxel estaba dentro (alfa 255) o fuera (alfa
//      0), sin nada en medio: el filo de unas tijeras. Ahora la tolerancia
//      tiene dos escalones — hasta TOLERANCIA es fondo y se borra entero; entre
//      TOLERANCIA y TOLERANCIA_SUAVE es el antialias del dibujo original y se
//      le da alfa proporcional a lo lejos que esté del color del fondo.
//
//   2. QUEDABA RIBETE. Los píxeles del antialias del original son mezcla de
//      dibujo y fondo: caían FUERA de la tolerancia y sobrevivían opacos,
//      formando un hilo del color del fondo viejo rodeando la pieza. Esa era la
//      línea clara que se veía al juntar dos caminos. El escalón suave los
//      convierte en semitransparentes, que es lo que siempre debieron ser.
//
//   3. EL COLOR DEL FONDO SEGUÍA DENTRO DEL CANTO. Un píxel a medio camino no
//      solo tiene alfa: tiene color, y el suyo era mezcla del dibujo y del
//      fondo viejo. Al posarlo sobre la mesa, esa mitad de blanco se ve. Es un
//      halo, y se puede medir: sobre el verde de la mesa, un canto sin corregir
//      se desvía 45 de media (y hasta 75) del color que debería dar.
//      `sangrarColor` lo repinta con el color del dibujo y el desvío baja a
//      1,7. Repintarlo abarata además el archivo un 8 %, porque un canto de
//      color plano se comprime mejor que uno degradado.
//
// Encima de eso, `difuminarBorde` desvanece el alfa en los últimos píxeles del
// contorno: la pieza se funde con la mesa en vez de posarse sobre ella.
//
// LO QUE TODO ESTO CUESTA, para que no sorprenda: la pieza terminada pesa
// alrededor de un 14 % MÁS que con el corte a hacha. Un canto con cincuenta
// tonos de alfa es información que antes no estaba, y comprimir un degradado
// sale más caro que comprimir un borde plano. A 512 px son unos pocos KB por
// pieza, así que no hay nada que discutir, pero el número no engaña a nadie:
// esto no sale gratis.
// ============================================================================

/** Cuánto puede alejarse un píxel del color del fondo y seguir contando como fondo. */
const TOLERANCIA = 42

/**
 * Hasta dónde llega la ZONA DE DUDA. Entre `TOLERANCIA` y este valor el píxel
 * no es fondo pero tampoco es dibujo limpio: es el antialias con el que el
 * original suavizó su propio contorno, mezcla de los dos. Se le da alfa
 * proporcional en vez de decidir por él.
 *
 * El valor no es libre: si se sube mucho, un dibujo de tonos claros sobre fondo
 * claro empieza a volverse translúcido por su cuenta. 104 deja pasar el
 * antialias típico (que se queda a media distancia entre dibujo y fondo) sin
 * llegar a tocar el relleno.
 */
const TOLERANCIA_SUAVE = 104

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

/** Distancia de color entre dos píxeles. */
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
 * borde. Modifica `data` en el sitio y devuelve cuántos píxeles ha borrado del
 * todo (los de la zona de duda no cuentan; sirve para poder decirle al usuario
 * si se ha llegado a quitar fondo o no).
 *
 * La inundación SOLO SE PROPAGA por el fondo de verdad. Un píxel de la zona de
 * duda recibe su alfa y ahí se para: si dejara pasar la marea, la
 * semitransparencia se comería el dibujo hacia dentro píxel a píxel, porque
 * cada vecino está a su vez cerca del anterior.
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
    if (!yaVacio) {
      const d = distancia(pixel(data, i), fondo)
      if (d > TOLERANCIA_SUAVE) continue
      if (d > TOLERANCIA) {
        // Zona de duda: el antialias del original. Alfa proporcional y punto
        // final del recorrido por aquí.
        const alfa = Math.round((255 * (d - TOLERANCIA)) / (TOLERANCIA_SUAVE - TOLERANCIA))
        if (alfa < data[i + 3]) data[i + 3] = alfa
        continue
      }
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

// ---------------------------------------------------------------------------
// Distancia al vecino más cercano
// ---------------------------------------------------------------------------

const LEJOS = Number.MAX_SAFE_INTEGER

interface Cercanias {
  /** Distancia AL CUADRADO hasta la semilla más cercana. Al cuadrado para no hacer raíces de más. */
  dist2: Float64Array
  /** Coordenadas de esa semilla. Pueden caer fuera del lienzo si `fueraCuenta`. */
  ox: Int32Array
  oy: Int32Array
}

/**
 * Para cada píxel, cuál es la semilla más cercana y a qué distancia.
 *
 * Es el algoritmo de Danielsson: dos barridos, uno de arriba-izquierda a
 * abajo-derecha y otro al revés, propagando NO la distancia sino las
 * COORDENADAS de la semilla más cercana conocida. La distancia se recalcula
 * desde esas coordenadas, así que sale exacta (euclídea de verdad) en vez de la
 * escalera que dan las distancias de tablero. Importa: con una distancia
 * aproximada el desvanecido del canto se ve ondulado en las diagonales.
 *
 * `fueraCuenta` añade semillas virtuales JUSTO FUERA del lienzo, es decir,
 * trata "salirse de la imagen" como si fuera vacío. Lo usa quien quiera
 * desvanecer también contra el marco.
 */
function cercanias(width: number, height: number, esSemilla: (p: number) => boolean, fueraCuenta: boolean): Cercanias {
  const n = width * height
  const dist2 = new Float64Array(n)
  const ox = new Int32Array(n)
  const oy = new Int32Array(n)

  for (let p = 0; p < n; p++) {
    if (esSemilla(p)) {
      dist2[p] = 0
      ox[p] = p % width
      oy[p] = (p / width) | 0
    } else {
      dist2[p] = LEJOS
      ox[p] = 0
      oy[p] = 0
    }
  }

  /** Propone para `p` (en x,y) el origen que ya tiene el vecino `q`. */
  function desde(p: number, x: number, y: number, q: number): void {
    if (dist2[q] >= LEJOS) return
    const cx = ox[q]
    const cy = oy[q]
    const dx = x - cx
    const dy = y - cy
    const d = dx * dx + dy * dy
    if (d < dist2[p]) {
      dist2[p] = d
      ox[p] = cx
      oy[p] = cy
    }
  }

  /** Propone para `p` una semilla concreta, se esté donde se esté (incluso fuera del lienzo). */
  function semillaEn(p: number, x: number, y: number, cx: number, cy: number): void {
    const dx = x - cx
    const dy = y - cy
    const d = dx * dx + dy * dy
    if (d < dist2[p]) {
      dist2[p] = d
      ox[p] = cx
      oy[p] = cy
    }
  }

  if (fueraCuenta) {
    for (let x = 0; x < width; x++) {
      semillaEn(x, x, 0, x, -1)
      semillaEn((height - 1) * width + x, x, height - 1, x, height)
    }
    for (let y = 0; y < height; y++) {
      semillaEn(y * width, 0, y, -1, y)
      semillaEn(y * width + width - 1, width - 1, y, width, y)
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (dist2[p] === 0) continue
      if (x > 0) desde(p, x, y, p - 1)
      if (y > 0) desde(p, x, y, p - width)
      if (x > 0 && y > 0) desde(p, x, y, p - width - 1)
      if (x < width - 1 && y > 0) desde(p, x, y, p - width + 1)
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const p = y * width + x
      if (dist2[p] === 0) continue
      if (x < width - 1) desde(p, x, y, p + 1)
      if (y < height - 1) desde(p, x, y, p + width)
      if (x < width - 1 && y < height - 1) desde(p, x, y, p + width + 1)
      if (x > 0 && y < height - 1) desde(p, x, y, p + width - 1)
    }
  }

  return { dist2, ox, oy }
}

/**
 * Cuántos píxeles de canto se desvanecen, en función del tamaño de la pieza ya
 * recortada.
 *
 * Es proporcional y no fijo porque la pieza se guarda a 512 px de lado mayor
 * pase lo que pase, así que un número fijo de píxeles significa un desvanecido
 * distinto según lo que la pieza mida EN CENTÍMETROS sobre la mesa. Con el 1,8 %
 * del lado mayor, un camino de 60 cm se funde en poco más de medio centímetro
 * de mesa: bastante para que no se lea el corte, poco para que la pieza siga
 * teniendo forma.
 *
 * El tope por el lado MENOR es para las piezas muy alargadas (un muro, un río):
 * sin él, un desvanecido calculado sobre el largo se comería el ancho entero.
 */
export function plumaDeBorde(width: number, height: number): number {
  const porLadoMayor = Math.round(Math.max(width, height) * 0.018)
  const tope = Math.round(Math.min(width, height) * 0.15)
  return Math.max(2, Math.min(porLadoMayor, tope, 14))
}

/**
 * Desvanece el alfa en los últimos `pluma` píxeles del contorno, hacia dentro.
 *
 * La curva es una `smoothstep` y no una rampa recta a propósito: una rampa
 * lineal deja un cambio de pendiente visible justo donde termina, y el ojo lo
 * lee como una línea — que es exactamente de lo que se venía huyendo.
 *
 * SOLO SE DESVANECE CONTRA EL VACÍO, NUNCA CONTRA EL MARCO DE LA IMAGEN
 * (`fueraCuenta` en false), y esto es una decisión, no un descuido. Un canto que
 * llega hasta el borde de su propia imagen es un CORTE DELIBERADO: el camino
 * recto que se acaba en seco para poder empalmarlo con el siguiente. Si se
 * desvaneciera, dos tramos pegados dejarían un claro entre ellos, que es
 * justamente lo contrario de lo que se busca. Se probó difuminando también
 * contra el marco y los empalmes salían con un hueco tenue en medio.
 *
 * Lo que sí se desvanece es la SILUETA: el contorno rodeado de transparencia,
 * que es el que se leía como el filo de un recorte de papel.
 */
export function difuminarBorde(data: Uint8ClampedArray, width: number, height: number, pluma: number): void {
  if (pluma <= 0) return
  const { dist2 } = cercanias(width, height, (p) => data[p * 4 + 3] === 0, false)
  const n = width * height
  for (let p = 0; p < n; p++) {
    const i = p * 4
    const alfa = data[i + 3]
    if (alfa === 0) continue
    const d = Math.sqrt(dist2[p])
    if (d >= pluma) continue
    const t = d / pluma
    data[i + 3] = Math.round(alfa * t * t * (3 - 2 * t))
  }
}

/**
 * Repinta los píxeles SEMITRANSPARENTES con el color del píxel opaco más
 * cercano, sin tocar su alfa.
 *
 * QUÉ ARREGLA. Un píxel del canto con alfa 90 lleva un color que es mezcla del
 * dibujo y del fondo que se quitó. Al componerlo sobre la mesa, esa parte de
 * fondo se ve: un hilo claro (o negro, según el original) rodeando la pieza.
 * Medido en Chromium sobre el verde de la mesa: el canto sin corregir se
 * desvía 45 de media y 75 en el peor píxel respecto del color que debería dar;
 * repintado, 1,7. Y el archivo sale un 8 % más pequeño que con el canto
 * teñido, porque un color plano se comprime mejor que un degradado.
 *
 * POR QUÉ SOLO LOS SEMITRANSPARENTES, Y NO TAMBIÉN LOS INVISIBLES. Rellenar de
 * color la zona de alfa 0 es la receta habitual contra los halos, y aquí NO
 * SIRVE: el canvas del navegador guarda el color ya multiplicado por el alfa,
 * así que multiplicar por cero lo borra. Comprobado en Chromium — se escribe
 * (255, 128, 0) con alfa 0 y se vuelve a leer (0, 0, 0). El color no
 * sobreviviría ni hasta el `toBlob`, de modo que recorrer esos píxeles sería
 * gastar tiempo en algo que el navegador va a tirar. Los semitransparentes sí
 * sobreviven (200 se lee como 198 con alfa 40: solo el redondeo).
 */
export function sangrarColor(data: Uint8ClampedArray, width: number, height: number): void {
  const { dist2, ox, oy } = cercanias(width, height, (p) => data[p * 4 + 3] >= 250, false)
  const n = width * height
  for (let p = 0; p < n; p++) {
    const i = p * 4
    const alfa = data[i + 3]
    if (alfa === 0 || alfa >= 250) continue
    if (dist2[p] >= LEJOS) continue // imagen sin un solo píxel opaco: nada que repartir
    const q = (oy[p] * width + ox[p]) * 4
    data[i] = data[q]
    data[i + 1] = data[q + 1]
    data[i + 2] = data[q + 2]
  }
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
