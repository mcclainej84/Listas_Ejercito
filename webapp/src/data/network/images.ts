// ============================================================================
// Imágenes de las hojas de unidad, guardadas en R2 (ver /image en
// worker/src/index.ts) en vez de como BLOB dentro de la D1.
//
// EL PORQUÉ, EN NÚMEROS. Con las imágenes dentro de la base, abrir una hoja de
// Bretonia descargaba su ilustración entera: de media 985 KB que viajaban como
// ~1,3 MB, porque un BLOB tiene que ir en base64 dentro del JSON de la
// consulta. Y volvía a descargarse cada vez, porque el navegador no puede
// cachear algo que llega incrustado en la respuesta de un POST.
//
// Aquí la base guarda solo una CLAVE ("sheets/unidad/12/<hash>.webp") y la
// imagen se pide por su URL como cualquier otra imagen de la web: el navegador
// la guarda en su caché de disco, la descarga en paralelo con el resto de la
// página y no vuelve a molestar al servidor. La clave incluye el hash del
// contenido, así que un archivo dado nunca cambia y se puede servir con caché
// "immutable" de un año sin riesgo de quedarse con una versión vieja: cambiar
// la imagen de una hoja produce una clave distinta.
// ============================================================================
import { AuthRequiredError, getApiBaseUrl } from '@/data/sqlite/client'
import { clearPassword, getStoredPasswordHash } from '@/data/network/auth'
import type { SheetTargetKind } from '@/data/repositories/unitSheetRepository'

const PASSWORD_HEADER = 'X-WHArmy-Password'

/** URL pública de una imagen ya guardada. */
export function imageUrl(key: string): string {
  return `${getApiBaseUrl()}/image/${key}`
}

/** Extensión a partir del tipo MIME, para que la clave sea legible y el navegador no se confunda. */
function extensionFor(mime: string): string {
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  return 'bin'
}

/**
 * Hash del contenido, corto. No es criptografía: solo necesita que dos
 * imágenes distintas den claves distintas y que la misma imagen dé siempre la
 * misma, para poder cachearla eternamente.
 */
async function contentHash(bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest).subarray(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export type ImageSlot = 'illu' | 'emblem'

/** Clave del objeto en R2. El prefijo agrupa por hoja, lo que hace legible el bucket y permite borrar por lotes. */
export async function buildImageKey(
  kind: SheetTargetKind,
  id: number,
  slot: ImageSlot,
  bytes: Uint8Array,
  mime: string,
): Promise<string> {
  return `sheets/${kind}/${id}/${slot}-${await contentHash(bytes)}.${extensionFor(mime)}`
}

/**
 * Sube la imagen y devuelve su clave. Requiere la contraseña de grupo, que
 * viaja en una cabecera y no en el cuerpo porque el cuerpo son los bytes
 * crudos de la imagen.
 */
export async function uploadImage(
  kind: SheetTargetKind,
  id: number,
  slot: ImageSlot,
  bytes: Uint8Array,
  mime: string,
): Promise<string> {
  const passwordHash = await getStoredPasswordHash()
  const key = await buildImageKey(kind, id, slot, bytes, mime)

  const body = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(body).set(bytes)

  const res = await fetch(imageUrl(key), {
    method: 'PUT',
    headers: { 'Content-Type': mime, [PASSWORD_HEADER]: passwordHash ?? '' },
    body,
  })

  if (res.status === 401) {
    // Mismo trato que una escritura rechazada en client.ts: se borra el hash
    // guardado para que <PasswordGate> vuelva a pedir la contraseña al vuelo.
    clearPassword()
    throw new AuthRequiredError()
  }
  if (res.status === 503) {
    throw new Error(
      'El almacén de imágenes no está configurado todavía. Hay que habilitar R2, crear el bucket ' +
        '"wharmy-images" y volver a desplegar el Worker (ver worker/wrangler.toml).',
    )
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `No se pudo subir la imagen (${res.status}).`)
  }
  return key
}

/**
 * Borra una imagen que ya no usa ninguna hoja. Se llama al reemplazar o quitar
 * una imagen, DESPUÉS de que la base apunte a la nueva.
 *
 * Los fallos se tragan a propósito: si el borrado no sale, lo único que queda
 * es un archivo huérfano de unos KB que nadie referencia. Interrumpir por eso
 * un guardado que ya ha ido bien sería mucho peor.
 */
export async function deleteImageQuietly(key: string | null | undefined): Promise<void> {
  if (!key) return
  try {
    const passwordHash = await getStoredPasswordHash()
    await fetch(imageUrl(key), {
      method: 'DELETE',
      headers: { [PASSWORD_HEADER]: passwordHash ?? '' },
    })
  } catch {
    // Huérfano inofensivo; ver comentario de arriba.
  }
}
