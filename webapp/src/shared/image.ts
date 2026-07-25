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
