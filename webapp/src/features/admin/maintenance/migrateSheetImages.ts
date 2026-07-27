// ============================================================================
// Migración de las imágenes de las hojas: de BLOB dentro de D1 a objetos en R2.
//
// Es una operación de UNA VEZ, lanzada a mano desde Editor > Registro >
// Mantenimiento. No se ejecuta sola al arrancar la app, a propósito: mueve
// datos y sube archivos, y eso debe pasar cuando alguien lo decide y está
// mirando, no de tapadillo mientras se abre una pantalla.
//
// DE UNA EN UNA, Y EN ESTE ORDEN. Cada imagen se lee, se recomprime, se sube y
// se escribe su clave antes de pasar a la siguiente:
//
//   · No se leen todas juntas porque serían ~29 MB de base64 de golpe: el
//     navegador se quedaría clavado y una desconexión a mitad lo tiraría todo.
//   · Se sube ANTES de escribir la base. Si algo se corta, queda un archivo
//     huérfano de unos KB en el bucket; al revés quedaría una hoja apuntando a
//     una imagen inexistente, que es un fallo visible.
//   · Cada fila que termina bien deja la base ya consistente. Por eso la
//     migración es REANUDABLE: si falla en la número 20, se vuelve a lanzar y
//     sigue por donde estaba, porque solo busca filas que aún tengan bytes y
//     no tengan clave.
//
// De paso se recomprimen: las imágenes antiguas son PNG de ~1 MB (Bretonia
// promediaba 985 KB) y salen de aquí como WebP de ~110 KB, con transparencia.
// ============================================================================
import { execBatch, query } from '@/data/sqlite/client'
import { uploadImage } from '@/data/network/images'
import { byteLength, compressImageFile, MAX_EMBLEM_BYTES, MAX_ILLUSTRATION_BYTES, type ByteSource } from '@/shared/image'
import type { SheetTargetKind } from '@/data/repositories/unitSheetRepository'

export interface MigrationProgress {
  /** Cuántas imágenes se han procesado ya (con éxito o con error). */
  done: number
  /** Total a procesar, conocido antes de empezar. */
  total: number
  /** Qué se está haciendo ahora mismo, para enseñarlo en pantalla. */
  current: string
}

export interface MigrationResult {
  migradas: number
  bytesAntes: number
  bytesDespues: number
  errores: string[]
}

/** Una imagen pendiente de migrar. */
interface PendingImage {
  kind: SheetTargetKind
  id: number
  slot: 'illu' | 'emblem'
}

const TABLE_FOR: Record<SheetTargetKind, string> = {
  unidad: 'unit_sheets',
  montura: 'sheet_presentations',
  opcion: 'sheet_presentations',
}

function whereFor(item: PendingImage): { sql: string; params: (string | number)[] } {
  return item.kind === 'unidad'
    ? { sql: 'unit_id = ?', params: [item.id] }
    : { sql: 'kind = ? AND ref_id = ?', params: [item.kind, item.id] }
}

/**
 * Qué queda por migrar. Se piden SOLO los identificadores, nunca los bytes:
 * esta consulta tiene que ser barata aunque haya cientos de imágenes.
 */
export async function listPendingImages(): Promise<PendingImage[]> {
  const [units, presentations] = await Promise.all([
    query(
      `SELECT unit_id AS id,
              CASE WHEN illu_data IS NOT NULL AND illu_key IS NULL THEN 1 ELSE 0 END AS illu,
              CASE WHEN emblem_data IS NOT NULL AND emblem_key IS NULL THEN 1 ELSE 0 END AS emblem
         FROM unit_sheets
        WHERE (illu_data IS NOT NULL AND illu_key IS NULL)
           OR (emblem_data IS NOT NULL AND emblem_key IS NULL)`,
      [],
      (row) => row,
    ),
    query(
      `SELECT kind, ref_id AS id,
              CASE WHEN illu_data IS NOT NULL AND illu_key IS NULL THEN 1 ELSE 0 END AS illu,
              CASE WHEN emblem_data IS NOT NULL AND emblem_key IS NULL THEN 1 ELSE 0 END AS emblem
         FROM sheet_presentations
        WHERE (illu_data IS NOT NULL AND illu_key IS NULL)
           OR (emblem_data IS NOT NULL AND emblem_key IS NULL)`,
      [],
      (row) => row,
    ),
  ])

  const pending: PendingImage[] = []
  for (const row of units) {
    const id = row.id as number
    if (row.illu) pending.push({ kind: 'unidad', id, slot: 'illu' })
    if (row.emblem) pending.push({ kind: 'unidad', id, slot: 'emblem' })
  }
  for (const row of presentations) {
    const id = row.id as number
    const kind = (row.kind as SheetTargetKind) ?? 'opcion'
    if (row.illu) pending.push({ kind, id, slot: 'illu' })
    if (row.emblem) pending.push({ kind, id, slot: 'emblem' })
  }
  return pending
}

/** Lee los bytes de UNA imagen concreta. La consulta más cara del proceso, de ahí que vaya suelta. */
async function readImageBytes(item: PendingImage): Promise<{ bytes: ByteSource; mime: string } | null> {
  const table = TABLE_FOR[item.kind]
  const where = whereFor(item)
  const column = item.slot === 'illu' ? 'illu' : 'emblem'
  const rows = await query(
    `SELECT ${column}_data AS data, ${column}_mime AS mime FROM ${table} WHERE ${where.sql}`,
    where.params,
    (row) => row,
  )
  const row = rows[0]
  if (!row) return null
  const bytes = (row.data as ByteSource | null) ?? null
  if (!bytes || byteLength(bytes) === 0) return null
  return { bytes, mime: (row.mime as string) ?? 'image/png' }
}

/** `ByteSource` (que puede ser array normal) a un File, que es lo que sabe recomprimir compressImageFile. */
function toFile(bytes: ByteSource, mime: string, name: string): File {
  const data =
    bytes instanceof Uint8Array
      ? bytes
      : bytes instanceof ArrayBuffer
        ? new Uint8Array(bytes)
        : Uint8Array.from(Array.isArray(bytes) ? bytes : Object.values(bytes))
  const buffer = new ArrayBuffer(data.byteLength)
  new Uint8Array(buffer).set(data)
  return new File([buffer], name, { type: mime })
}

/**
 * Migra todas las imágenes pendientes. `onProgress` se llama antes de cada
 * una para poder pintar el avance: el proceso puede tardar minutos y sin
 * señales parecería colgado.
 */
export async function migrateSheetImagesToR2(onProgress?: (p: MigrationProgress) => void): Promise<MigrationResult> {
  const pending = await listPendingImages()
  const result: MigrationResult = { migradas: 0, bytesAntes: 0, bytesDespues: 0, errores: [] }

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i]
    const etiqueta = `${item.kind} ${item.id} (${item.slot === 'illu' ? 'ilustración' : 'emblema'})`
    onProgress?.({ done: i, total: pending.length, current: etiqueta })

    try {
      const original = await readImageBytes(item)
      if (!original) continue

      const antes = byteLength(original.bytes)
      const { bytes, mime } = await compressImageFile(toFile(original.bytes, original.mime, 'imagen'), {
        maxSize: item.slot === 'illu' ? 1100 : 480,
        maxBytes: item.slot === 'illu' ? MAX_ILLUSTRATION_BYTES : MAX_EMBLEM_BYTES,
      })

      const key = await uploadImage(item.kind, item.id, item.slot, bytes, mime)

      const table = TABLE_FOR[item.kind]
      const where = whereFor(item)
      const column = item.slot === 'illu' ? 'illu' : 'emblem'
      await execBatch([
        {
          sql: `UPDATE ${table} SET ${column}_key = ?, ${column}_mime = ?, ${column}_data = NULL WHERE ${where.sql}`,
          params: [key, mime, ...where.params],
        },
      ])

      result.migradas++
      result.bytesAntes += antes
      result.bytesDespues += bytes.length
    } catch (err) {
      // Un fallo suelto no debe abortar las 42 restantes: se anota y se sigue.
      // Como la fila conserva sus bytes y sigue sin clave, la próxima pasada
      // volverá a intentarlo.
      result.errores.push(`${etiqueta}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  onProgress?.({ done: pending.length, total: pending.length, current: 'Terminado' })
  return result
}
