// ============================================================================
// Redimensionado/compresión de imágenes subidas por el usuario, en el propio
// navegador (canvas), antes de guardarlas como BLOB en SQLite. Sin esto, una
// foto de varios MB subida como emblema de facción se exportaría entera en
// cada escritura de la BBDD (ver client.ts: "cada escritura exporta la BBDD
// completa"), lo que sería lento y pesado para algo que solo se muestra como
// un icono pequeño.
// ============================================================================

export interface ResizedImage {
  bytes: Uint8Array
  mime: string
}

/**
 * Redimensiona (con relación de aspecto) a `maxSize` px de lado mayor.
 *
 * `format`:
 * - `'image/jpeg'` (por defecto): recomprime a JPEG — más compacto, pensado
 *   para lo que SÍ vive en el snapshot de catálogo que se descarga entera en
 *   cada carga de la app (p.ej. el emblema de una facción, ver
 *   FactionFormModal.tsx). JPEG no tiene canal alfa, así que cualquier zona
 *   transparente del original se rellena de BLANCO antes de dibujar (si no,
 *   el navegador la "aplana" a negro puro por defecto al exportar a un
 *   formato sin alfa — apenas se notaba en color, pero en blanco y negro ese
 *   negro sin matices dominaba el icono entero).
 * - `'image/png'`: conserva la transparencia real (sin rellenar nada antes
 *   de dibujar). Imprescindible para la Ilustración y el Escudo de una
 *   ficha (`unit_sheets`, ver FichasPage.tsx): ahí la imagen se superpone
 *   flotando sobre la ficha, así que si el archivo original es un recorte
 *   con fondo transparente (lo habitual) tiene que seguir siéndolo — ni
 *   blanco ni negro, SIN fondo, igual que en el programa original. Como
 *   `unit_sheets` está deliberadamente excluida del snapshot de catálogo
 *   (ver schema.sql), un PNG algo más pesado aquí no afecta al tiempo de
 *   carga del resto de la app.
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
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No se pudo procesar la imagen (canvas no disponible).'))
        return
      }
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
      }
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('No se pudo comprimir la imagen.'))
            return
          }
          blob.arrayBuffer().then((buf) => resolve({ bytes: new Uint8Array(buf), mime: format }))
        },
        format,
        format === 'image/jpeg' ? quality : undefined,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('El archivo seleccionado no es una imagen válida.'))
    }
    img.src = objectUrl
  })
}

/** Convierte bytes crudos a una data: URL, para usarla directamente en un <img src>. */
export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return `data:${mime};base64,${btoa(binary)}`
}
