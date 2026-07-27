// ============================================================================
// Procesado de imágenes por canvas para las exportaciones (PNG/Word) — mismo
// algoritmo que CodexMaker (ver grayscaleImageData/adjustImageBrightness/
// flipImageHorizontal en index.html de referencia). Necesario porque ni
// html2canvas ni un documento Word interpretan el filter:brightness()/
// transform:scaleX(-1) que se usan en pantalla (ver UnitSheetCard): hay que
// "hornear" brillo/volteo en los píxeles reales antes de exportar.
// ============================================================================

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // Ver la nota extensa en exportSheet.ts#loadImage: las imágenes de las
    // hojas llegan desde el Worker (otro dominio) y sin CORS contaminarían el
    // canvas, haciendo fallar el `toDataURL` de aquí abajo. Antes de `src`.
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo procesar una imagen de la ficha.'))
    img.src = dataUrl
  })
}

// ----------------------------------------------------------------------------
// Escala de grises por luminancia (0.299R+0.587G+0.114B), la misma fórmula que
// CodexMaker. Se deja LIMPIA, sin realces de brillo/contraste/gamma: cualquier
// añadido restaba nitidez/definición a los emblemas, así que se conserva el
// gris tal cual para mantener el detalle original.
function grayscalePixels(d: Uint8ClampedArray): void {
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = d[i + 1] = d[i + 2] = gray
  }
}

/** Escala de grises con realce (ver GRAY_GAMMA). Usada para emblema/ilustración sueltos en la exportación a Word con texto. */
export async function grayscaleDataUrl(dataUrl: string | null): Promise<string | null> {
  if (!dataUrl) return dataUrl
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || 1
  canvas.height = img.naturalHeight || 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  grayscalePixels(imageData.data)
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

/** Escala de grises con realce directamente sobre un canvas ya capturado (más barato que re-cargar la imagen: se usa tras html2canvas para la exportación PNG/Word con imágenes). */
export function grayscaleCanvasInPlace(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  grayscalePixels(imageData.data)
  ctx.putImageData(imageData, 0, 0)
}

export async function adjustBrightnessDataUrl(dataUrl: string | null, brightnessPct: number): Promise<string | null> {
  if (!dataUrl || !brightnessPct || brightnessPct === 100) return dataUrl
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || 1
  canvas.height = img.naturalHeight || 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = imageData.data
  const factor = brightnessPct / 100
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.max(0, Math.min(255, d[i] * factor))
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * factor))
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * factor))
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

export async function flipHorizontalDataUrl(dataUrl: string | null): Promise<string | null> {
  if (!dataUrl) return dataUrl
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || 1
  canvas.height = img.naturalHeight || 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.translate(canvas.width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * Aplica volteo + brillo (en ese orden, igual que CodexMaker) a la
 * ilustración de una ficha, dejándola lista para exportar sin depender de
 * filtros/transforms CSS en tiempo de captura. Devuelve el mismo dataURL si
 * no hay nada que hornear (sin imagen, sin volteo y con brillo 100%).
 */
export async function bakeIllustration(illuUrl: string | null, flipped: boolean, brightness: number): Promise<string | null> {
  let data = illuUrl
  if (flipped) data = await flipHorizontalDataUrl(data)
  if (brightness !== 100) data = await adjustBrightnessDataUrl(data, brightness)
  return data
}
