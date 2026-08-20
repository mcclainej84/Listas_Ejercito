// ============================================================================
// Redimensionado/compresión de imágenes subidas por el usuario, en el propio
// navegador (canvas), antes de guardarlas como BLOB en SQLite.
//
// POR QUÉ IMPORTA EL PESO. Un BLOB no viaja "en crudo": se codifica en base64
// dentro del JSON que se manda al Worker (ver `bytesToBase64` en
// data/sqlite/client.ts), lo que lo infla un 33% extra. Una ilustración PNG de
// 1200 px puede pesar 4-6 MB, que se convierten en ~8 MB de JSON, y ahí es
// donde reventaba la subida de imágenes grandes: el error no salía al elegir
// el archivo sino al escribirlo. La solución no es "avisar mejor", es que ese
// caso no pueda ocurrir — de ahí `compressImageFile`, que recomprime hasta
// caber en un presupuesto de bytes fijo.
// ============================================================================

import { cajaDeContenido, difuminarBorde, plumaDeBorde, quitarFondo, sangrarColor } from '@/shared/imageTrim'

export interface ResizedImage {
  bytes: Uint8Array
  mime: string
}

/** Presupuesto de peso de una ilustración de ficha, ya comprimida. */
export const MAX_ILLUSTRATION_BYTES = 600 * 1024
/** Presupuesto de un escudo/emblema: se ve pequeño, no necesita más. */
export const MAX_EMBLEM_BYTES = 120 * 1024

// ---------------------------------------------------------------------------
// Soporte de WebP. Es el formato que mejor resuelve el problema de esta app:
// tiene canal alfa (imprescindible para recortes de personaje sobre la ficha)
// Y compresión con pérdida (que PNG no tiene), así que pesa 3-5 veces menos
// que el PNG equivalente sin dejar de ser transparente. Lo soportan todos los
// navegadores actuales, pero se comprueba en tiempo de ejecución en vez de
// darlo por hecho: si no está, se cae a PNG (con alfa) o JPEG (sin alfa) y
// todo sigue funcionando, solo que el archivo pesa más.
// ---------------------------------------------------------------------------
let webpSupport: boolean | null = null

function supportsWebp(): boolean {
  if (webpSupport !== null) return webpSupport
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    webpSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    webpSupport = false
  }
  return webpSupport
}

interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
}

/**
 * Decodifica el archivo. Se prefiere `createImageBitmap` porque decodifica
 * fuera del hilo principal y aguanta mucho mejor las fotos enormes (móvil,
 * escaneos) que un `<img>` con object URL, que en esos tamaños a veces
 * dispara `onerror` sin más explicación — otra de las causas del "error al
 * subir imágenes grandes". Si no está disponible, se usa el `<img>` de toda
 * la vida.
 */
async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return { source: bitmap, width: bitmap.width, height: bitmap.height }
    } catch {
      // Formato que el decodificador rápido no entiende: se intenta con <img>.
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('No se pudo leer la imagen: el archivo está dañado o el formato no es compatible.'))
    }
    img.src = objectUrl
  })
}

function closeSource(source: CanvasImageSource): void {
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) source.close()
}

/**
 * ¿La imagen tiene zonas transparentes de verdad? Se comprueba sobre una
 * miniatura de 64 px (basta para saber si hay alfa y evita recorrer millones
 * de píxeles). Sirve para no malgastar peso: una ilustración opaca no necesita
 * canal alfa y puede irse a un formato aún más compacto.
 */
function hasTransparency(source: CanvasImageSource, width: number, height: number): boolean {
  const scale = Math.min(1, 64 / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return true // ante la duda, se conserva el alfa
  ctx.drawImage(source, 0, 0, w, h)
  try {
    const { data } = ctx.getImageData(0, 0, w, h)
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return true
    }
  } catch {
    return true
  }
  return false
}

function drawToCanvas(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  maxSize: number,
  background: string | null,
): HTMLCanvasElement {
  const scale = Math.min(1, maxSize / Math.max(srcW, srcH))
  const width = Math.max(1, Math.round(srcW * scale))
  const height = Math.max(1, Math.round(srcH * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen (canvas no disponible).')
  // Reducir de golpe de 4000 px a 900 px con el remuestreo por defecto deja
  // bordes con dientes de sierra; esto le pide al navegador su mejor filtro.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(source, 0, 0, width, height)
  return canvas
}

function canvasToBytes(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo comprimir la imagen.'))
          return
        }
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject)
      },
      mime,
      quality,
    )
  })
}

export interface CompressOptions {
  /** Lado mayor máximo, en px. Se va reduciendo si aun así no se cumple `maxBytes`. */
  maxSize?: number
  /** Presupuesto de peso del archivo final. */
  maxBytes?: number
  /**
   * `true` (por defecto) para respetar la transparencia del original: la
   * ilustración y el escudo de una ficha flotan sobre el pergamino, así que un
   * recorte con fondo transparente tiene que seguir sin fondo. `false` fuerza
   * fondo blanco y el formato más compacto posible.
   */
  keepAlpha?: boolean
}

/**
 * Redimensiona y comprime una imagen del usuario hasta que quepa en
 * `maxBytes`, eligiendo el formato más eficiente que conserve lo que hay que
 * conservar:
 *
 *   con transparencia → WebP con alfa (o PNG si el navegador no tiene WebP)
 *   sin transparencia → WebP (o JPEG si no hay WebP)
 *
 * La estrategia es bajar primero la CALIDAD (que casi no se nota) y solo
 * después el TAMAÑO en píxeles (que sí), en pasos, hasta entrar en el
 * presupuesto. Si ni con el mínimo razonable cabe, se devuelve lo mejor
 * conseguido en vez de fallar: más vale una ficha con una imagen algo peor que
 * un error que deja al usuario sin poder subir nada.
 */
export async function compressImageFile(file: File, options: CompressOptions = {}): Promise<ResizedImage> {
  const { maxSize = 1100, maxBytes = MAX_ILLUSTRATION_BYTES, keepAlpha = true } = options

  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('El archivo seleccionado no es una imagen.')
  }

  const { source, width: srcW, height: srcH } = await decodeImage(file)
  try {
    if (!srcW || !srcH) throw new Error('El archivo seleccionado no es una imagen válida.')

    const alpha = keepAlpha && hasTransparency(source, srcW, srcH)
    const webp = supportsWebp()
    const mime = webp ? 'image/webp' : alpha ? 'image/png' : 'image/jpeg'
    const background = alpha ? null : '#ffffff'
    // PNG no admite calidad: ahí el único mando disponible es el tamaño.
    const lossy = mime !== 'image/png'
    const qualities: (number | undefined)[] = lossy ? [0.86, 0.76, 0.66, 0.56, 0.46] : [undefined]

    let best: ResizedImage | null = null
    let size = maxSize

    // Tres rondas de reducción de tamaño como mucho (100% → 78% → 61% del lado
    // mayor). Más allá la imagen ya no luce en la ficha, así que no compensa.
    for (let round = 0; round < 3; round++) {
      const canvas = drawToCanvas(source, srcW, srcH, size, background)
      for (const quality of qualities) {
        const bytes = await canvasToBytes(canvas, mime, quality)
        if (!best || bytes.length < best.bytes.length) best = { bytes, mime }
        if (bytes.length <= maxBytes) return { bytes, mime }
      }
      size = Math.round(size * 0.78)
      if (size < 360) break
    }

    if (!best) throw new Error('No se pudo comprimir la imagen.')
    return best
  } finally {
    closeSource(source)
  }
}

/** Presupuesto de una pieza de escenografía o un suelo: se ve pequeño sobre la mesa. */
export const MAX_SCENERY_BYTES = 160 * 1024

/** Lado mayor de una pieza de escenografía ya preparada. Más resolución no se aprecia sobre la mesa. */
const LADO_ESCENOGRAFIA = 512

export interface ImagenPreparada extends ResizedImage {
  /** Proporción ancho/alto de lo que ha quedado, para poder proponer un tamaño en cm que no deforme. */
  proporcion: number
  /** true si se ha llegado a quitar fondo (para poder decírselo al usuario). */
  fondoQuitado: boolean
}

/** Un canvas del tamaño pedido con su contexto, listo para leer y escribir píxeles. */
function lienzoDeTrabajo(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('No se pudo procesar la imagen (canvas no disponible).')
  // Reducir de golpe de 4000 px a 512 px con el remuestreo por defecto deja
  // bordes con dientes de sierra; esto le pide al navegador su mejor filtro.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return { canvas, ctx }
}

/**
 * ¿La imagen viene YA recortada, con su transparencia puesta? Se mira si hay
 * algún píxel transparente en el marco: si lo hay, alguien le quitó el fondo
 * antes — el original del usuario, o nosotros mismos en un pase anterior, que
 * es lo que ocurre al REPROCESAR la biblioteca.
 *
 * Hace falta saberlo porque `quitarFondo` deduce el color del fondo mirando las
 * cuatro esquinas, y en una imagen ya recortada esas esquinas son
 * transparentes; y transparente, dentro de un canvas, se lee como NEGRO,
 * porque el color se guarda multiplicado por el alfa. Sin esta comprobación se
 * pondría a borrar todo lo oscuro que tocase el borde y una roca o un tejado en
 * sombra se irían por el desagüe.
 */
function yaVieneRecortada(data: Uint8ClampedArray, width: number, height: number): boolean {
  for (let x = 0; x < width; x++) {
    if (data[x * 4 + 3] === 0) return true
    if (data[((height - 1) * width + x) * 4 + 3] === 0) return true
  }
  for (let y = 0; y < height; y++) {
    if (data[y * width * 4 + 3] === 0) return true
    if (data[(y * width + width - 1) * 4 + 3] === 0) return true
  }
  return false
}

/**
 * El molino, común a la imagen que se acaba de elegir y a la que se reprocesa:
 *
 *   1. la reduce a 512 px de lado mayor,
 *   2. quita el fondo liso que toque el borde (ver shared/imageTrim),
 *   3. recorta el aire que queda alrededor,
 *   4. DIFUMINA EL CANTO de la silueta y le quita el color del fondo viejo,
 *   5. la comprime a WebP.
 *
 * Todos los pasos existen por lo mismo: sobre la mesa, una pieza se pinta a
 * pocos centímetros. Una foto de 4000 px con su fondo blanco se vería como un
 * recorte de papel encima del terreno, y pesaría cien veces lo necesario.
 *
 * EL RECORTE VA ANTES DE DIFUMINAR, no después, y no da igual: la anchura del
 * desvanecido se calcula sobre el tamaño de la pieza de verdad, no sobre el
 * aire que la rodeaba, así que una piedra pequeña en una foto grande no se lleva
 * la pluma de la foto.
 *
 * Si la imagen no tiene un fondo plano que quitar, se salta ese paso y sigue
 * con el resto: es mejor eso que devolverle al usuario un error por una imagen
 * perfectamente válida.
 */
async function prepararPieza(source: CanvasImageSource, srcW: number, srcH: number): Promise<ImagenPreparada> {
  if (!srcW || !srcH) throw new Error('El archivo seleccionado no es una imagen válida.')

  // Se trabaja ya a tamaño reducido: quitar el fondo de una foto de 4000 px
  // son 16 millones de píxeles recorridos para tirarlos justo después.
  const escala = Math.min(1, LADO_ESCENOGRAFIA / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * escala))
  const h = Math.max(1, Math.round(srcH * escala))

  const grande = lienzoDeTrabajo(w, h)
  grande.ctx.drawImage(source, 0, 0, w, h)

  const imagen = grande.ctx.getImageData(0, 0, w, h)
  const borrados = yaVieneRecortada(imagen.data, w, h) ? 0 : quitarFondo(imagen.data, w, h)
  grande.ctx.putImageData(imagen, 0, 0)

  const caja = cajaDeContenido(imagen.data, w, h)
  let final = grande
  if (caja && (caja.ancho < w || caja.alto < h)) {
    final = lienzoDeTrabajo(caja.ancho, caja.alto)
    final.ctx.drawImage(grande.canvas, caja.x, caja.y, caja.ancho, caja.alto, 0, 0, caja.ancho, caja.alto)
  }

  const fw = final.canvas.width
  const fh = final.canvas.height
  const pieza = final.ctx.getImageData(0, 0, fw, fh)
  difuminarBorde(pieza.data, fw, fh, plumaDeBorde(fw, fh))
  sangrarColor(pieza.data, fw, fh)
  final.ctx.putImageData(pieza, 0, 0)

  const mime = supportsWebp() ? 'image/webp' : 'image/png'
  const lossy = mime !== 'image/png'
  let mejor: Uint8Array | null = null
  for (const quality of lossy ? [0.88, 0.78, 0.68, 0.55] : [undefined]) {
    const bytes = await canvasToBytes(final.canvas, mime, quality)
    if (!mejor || bytes.length < mejor.length) mejor = bytes
    if (bytes.length <= MAX_SCENERY_BYTES) {
      mejor = bytes
      break
    }
  }
  if (!mejor) throw new Error('No se pudo comprimir la imagen.')
  return { bytes: mejor, mime, proporcion: fw / fh, fondoQuitado: borrados > 0 }
}

/** Deja lista la imagen que el usuario acaba de elegir para una pieza o un suelo. */
export async function prepararImagenDeEscenografia(file: File): Promise<ImagenPreparada> {
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('El archivo seleccionado no es una imagen.')
  }
  const { source, width, height } = await decodeImage(file)
  try {
    return await prepararPieza(source, width, height)
  } finally {
    closeSource(source)
  }
}

/**
 * Lo mismo, pero para una imagen que YA está guardada: se descarga de su URL y
 * se vuelve a pasar por el molino. Es lo que usa el reprocesado de la
 * biblioteca (ver SceneryLibraryModal) para llevar las piezas antiguas al canto
 * difuminado sin tener que volver a subirlas una por una.
 *
 * SE BAJA CON `fetch` Y SE DECODIFICA DESDE EL BLOB, no con un `<img src=…>`
 * apuntando a R2. Una imagen traída de otro origen contamina el canvas, y ese
 * fallo no salta al dibujar sino AL EXPORTAR, que es de las trampas más caras
 * de depurar que hay en este repositorio (ver la nota de renderTableCanvas).
 * Bajando el blob, los bytes ya son nuestros y no hay origen que valga.
 */
export async function reprocesarImagenDeEscenografia(url: string): Promise<ImagenPreparada> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status}).`)
  const blob = await res.blob()
  const archivo = new File([blob], 'pieza', { type: blob.type || 'image/webp' })
  const { source, width, height } = await decodeImage(archivo)
  try {
    return await prepararPieza(source, width, height)
  } finally {
    closeSource(source)
  }
}

/**
 * Versión antigua y simple, sin presupuesto de peso. Se conserva porque el
 * emblema de facción (FactionFormModal) ya la usaba con parámetros pensados
 * para el snapshot de catálogo y no hay motivo para cambiarlos.
 *
 * Para cualquier imagen nueva usa `compressImageFile`.
 */
export function resizeImageFile(
  file: File,
  maxSize = 480,
  quality = 0.82,
  format: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<ResizedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      try {
        const canvas = drawToCanvas(
          img,
          img.naturalWidth,
          img.naturalHeight,
          maxSize,
          format === 'image/jpeg' ? '#ffffff' : null,
        )
        canvasToBytes(canvas, format, format === 'image/jpeg' ? quality : undefined).then(
          (bytes) => resolve({ bytes, mime: format }),
          reject,
        )
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('El archivo seleccionado no es una imagen válida.'))
    }
    img.src = objectUrl
  })
}

/**
 * Los bytes de un BLOB no llegan siempre en el mismo envase.
 *
 * El Worker convierte a `{__b64}` las columnas que D1 le devuelve como
 * `ArrayBuffer` o `Uint8Array` (ver encodeRows en worker/src/index.ts), y el
 * cliente las decodifica a `Uint8Array`. Pero D1 devuelve algunas columnas
 * BLOB como un **array de números normal**, que no entra en ese caso y llega
 * al navegador tal cual, como `number[]`. Y desde el catálogo local (sql.js)
 * llegan como `Uint8Array` de verdad.
 *
 * Así que aquí se normaliza en vez de dar por hecho un `Uint8Array`. Es la
 * causa del "bytes.subarray is not a function" en las fichas que ya tenían
 * ilustración guardada.
 */
export type ByteSource = Uint8Array | ArrayBuffer | number[] | Record<string, number>

function toUint8Array(bytes: ByteSource): Uint8Array {
  if (bytes instanceof Uint8Array) return bytes
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes)
  if (Array.isArray(bytes)) return Uint8Array.from(bytes)
  // Último caso: un Uint8Array que en algún punto pasó por JSON.stringify y
  // llegó como objeto con claves numéricas ({"0":137,"1":80,…}).
  return Uint8Array.from(Object.values(bytes))
}

/** Longitud en bytes de cualquiera de los envases de arriba. */
export function byteLength(bytes: ByteSource | null | undefined): number {
  if (!bytes) return 0
  if (bytes instanceof ArrayBuffer) return bytes.byteLength
  if (bytes instanceof Uint8Array || Array.isArray(bytes)) return bytes.length
  return Object.keys(bytes).length
}

/**
 * Convierte bytes crudos a una data: URL, para usarla directamente en un
 * <img src>. Va por trozos de 32 KB: con `String.fromCharCode` byte a byte,
 * una imagen de medio mega tardaba lo suyo, y con `apply` sobre el array
 * entero se desborda la pila de llamadas.
 */
export function bytesToDataUrl(bytes: ByteSource, mime: string): string {
  const data = toUint8Array(bytes)
  const CHUNK = 0x8000
  const parts: string[] = []
  for (let i = 0; i < data.length; i += CHUNK) {
    parts.push(String.fromCharCode(...data.subarray(i, i + CHUNK)))
  }
  return `data:${mime};base64,${btoa(parts.join(''))}`
}

/** Tamaño legible para avisos ("1,2 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ---------------------------------------------------------------------------
// ENCUADRE DEL RETRATO DE UN PERSONAJE DE RENOMBRE
//
// El hueco del retrato en la lámina es CUADRADO (160 × 160), y una foto casi
// nunca lo es. Antes se metía con `object-contain` y el resultado quedaba a
// merced de la foto: un retrato vertical salía con dos franjas vacías a los
// lados y la cara diminuta en el centro, sin nada que hacer al respecto salvo
// recortar el archivo antes de subirlo. Con esto se elige el trozo que se ve.
//
// EL ENCUADRE SE APLICA AL GUARDAR, no se guarda como dato. Lo que sube a R2
// ya es el cuadrado definitivo, así que ni hay columnas nuevas ni hay que
// reaplicar una transformación cada vez que se pinta la lámina. A cambio,
// reencuadrar más tarde parte de la imagen ya recortada (ver
// `descargarImagenComoBytes`): para un retoque va bien, y para un cambio grande
// se vuelve a elegir la foto.
// ---------------------------------------------------------------------------

/** Lado del retrato ya encuadrado. Cuadrado, como su hueco. */
export const LADO_RETRATO = 512

/**
 * Dónde queda la foto dentro del cuadro.
 *
 * Todo en FRACCIONES del lado del cuadro y no en píxeles, a propósito: la misma
 * pareja de números vale para la vista previa (que mide 240 px o los que le
 * quepan) y para el lienzo final (512 px), sin convertir nada por el camino ni
 * poder equivocarse en la conversión.
 */
export interface EncuadreRetrato {
  /** 1 = la foto entera cabe justo dentro del cuadro. Más, se amplía. */
  zoom: number
  /** Desplazamiento respecto al centro, en fracciones del lado. 0 = centrada. */
  x: number
  y: number
}

export const ENCUADRE_CENTRADO: EncuadreRetrato = { zoom: 1, x: 0, y: 0 }

export const ZOOM_RETRATO_MIN = 1
export const ZOOM_RETRATO_MAX = 4

/**
 * Cuánto ocupa la foto dentro del cuadro, en fracciones del lado, para un zoom
 * dado. Con zoom 1 el lado mayor mide exactamente 1 (cabe justo).
 */
export function medidasDelEncuadre(
  anchoOriginal: number,
  altoOriginal: number,
  zoom: number,
): { fw: number; fh: number } {
  if (anchoOriginal <= 0 || altoOriginal <= 0) return { fw: zoom, fh: zoom }
  const proporcion = anchoOriginal / altoOriginal
  return proporcion >= 1 ? { fw: zoom, fh: zoom / proporcion } : { fw: zoom * proporcion, fh: zoom }
}

/**
 * Recorta el desplazamiento a lo razonable.
 *
 * Con la foto más grande que el cuadro, no se deja asomar el pergamino por
 * ningún lado; con la foto más pequeña, no se deja sacarla fuera. Las dos cosas
 * salen de la misma cuenta: el margen es la mitad de la diferencia entre lo que
 * mide la foto y lo que mide el cuadro, mida más o mida menos.
 */
export function limitarEncuadre(
  encuadre: EncuadreRetrato,
  anchoOriginal: number,
  altoOriginal: number,
): EncuadreRetrato {
  const zoom = Math.min(ZOOM_RETRATO_MAX, Math.max(ZOOM_RETRATO_MIN, encuadre.zoom))
  const { fw, fh } = medidasDelEncuadre(anchoOriginal, altoOriginal, zoom)
  const maxX = Math.abs(fw - 1) / 2
  const maxY = Math.abs(fh - 1) / 2
  return {
    zoom,
    x: Math.min(maxX, Math.max(-maxX, encuadre.x)),
    y: Math.min(maxY, Math.max(-maxY, encuadre.y)),
  }
}

/**
 * Aplica el encuadre y devuelve el cuadrado definitivo, listo para subir.
 *
 * El lienzo se deja TRANSPARENTE por debajo (no se pinta ningún fondo): la foto
 * llega aquí con el fondo ya quitado por `prepararImagenDeEscenografia`, y
 * rellenar el sobrante de blanco —o de color pergamino— devolvería justo el
 * recorte pegado sobre el papel que ese arreglo evita.
 */
export async function recortarRetrato(
  bytes: Uint8Array,
  mime: string,
  encuadre: EncuadreRetrato,
): Promise<ResizedImage> {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const archivo = new File([buffer], 'retrato', { type: mime || 'image/webp' })
  const { source, width, height } = await decodeImage(archivo)
  try {
    const L = LADO_RETRATO
    const { canvas, ctx } = lienzoDeTrabajo(L, L)
    const seguro = limitarEncuadre(encuadre, width, height)
    const { fw, fh } = medidasDelEncuadre(width, height, seguro.zoom)
    const anchoDibujo = fw * L
    const altoDibujo = fh * L
    const izquierda = (L - anchoDibujo) / 2 + seguro.x * L
    const arriba = (L - altoDibujo) / 2 + seguro.y * L
    ctx.drawImage(source, izquierda, arriba, anchoDibujo, altoDibujo)
    // WebP conserva el canal alfa Y comprime con pérdida; si el navegador no lo
    // soporta se cae a PNG, que también es transparente aunque pese más (JPEG
    // no vale aquí: pintaría de negro todo lo que fuera transparente).
    const salida = supportsWebp() ? 'image/webp' : 'image/png'
    const recortado = await canvasToBytes(canvas, salida, salida === 'image/webp' ? 0.9 : undefined)
    return { bytes: recortado, mime: salida }
  } finally {
    closeSource(source)
  }
}

/**
 * Baja una imagen ya guardada y devuelve sus bytes, para poder reencuadrarla.
 *
 * SE BAJA CON `fetch`, no con un `<img src=…>` apuntando a R2: una imagen de
 * otro origen contamina el canvas y el fallo no salta al dibujar sino AL
 * EXPORTAR, que es de las trampas más caras de depurar que hay aquí (mismo
 * motivo que en `reprocesarImagenDeEscenografia`).
 */
export async function descargarImagenComoBytes(url: string): Promise<ResizedImage> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status}).`)
  const blob = await res.blob()
  const buf = await blob.arrayBuffer()
  return { bytes: new Uint8Array(buf), mime: blob.type || 'image/webp' }
}

/**
 * Cuánto mide una imagen que ya tenemos en bytes.
 *
 * Se decodifica con el mismo camino que el resto del archivo
 * (`createImageBitmap` y, si no está, un `<img>`), en vez de montar aquí otro
 * `<img>` a mano: las fotos grandes de móvil son justo las que fallan con el
 * segundo, y ese error ya costó un rato de depuración una vez.
 *
 * Devuelve null si no se puede leer, para que quien llame pueda seguir con lo
 * suyo — medir es un extra, no el trabajo.
 */
export async function medirImagen(bytes: Uint8Array, mime: string): Promise<{ ancho: number; alto: number } | null> {
  try {
    const buffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(buffer).set(bytes)
    const archivo = new File([buffer], 'imagen', { type: mime || 'image/webp' })
    const { source, width, height } = await decodeImage(archivo)
    closeSource(source)
    return width > 0 && height > 0 ? { ancho: width, alto: height } : null
  } catch {
    return null
  }
}
