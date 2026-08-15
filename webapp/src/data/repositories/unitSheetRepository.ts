// ============================================================================
// Overrides de presentación de la ficha de una unidad (sección "Fichas", ver
// unit_sheets en db/schema.sql y UnitSheet en domain/types.ts): ilustración,
// escudo propio, alto máximo, marca de "completada".
//
// A diferencia de facciones/unidades/reglas (FactionRepository,
// UnitRepository...), este repositorio NO usa queryLocal/execCatalog: lee y
// escribe 100% por red (query/queryOne/exec/execBatch de data/sqlite/
// client.ts), igual que armyListRepository.ts — ver el comentario de
// unit_sheets en schema.sql sobre por qué se dejó fuera del snapshot de
// catálogo (tamaño de las imágenes).
// ============================================================================
import { execBatch, query, queryOne, type BatchStatement } from '@/data/sqlite/client'
import { deleteImageQuietly, imageUrl, uploadImage } from '@/data/network/images'
import { byteLength, bytesToDataUrl, type ByteSource } from '@/shared/image'
import { parseHiddenProfiles, parseSectionWidths } from '@/domain/sheetSections'
import type { UnitSheet } from '@/domain/types'

/**
 * Imágenes que han cambiado en un guardado. La distinción entre AUSENTE y
 * `null` es intencionada y hace falta:
 *   - ausente  → esta imagen no se ha tocado, no se manda nada.
 *   - `null`   → el usuario la ha quitado, hay que borrarla en la base.
 */
export interface SheetImageChange {
  illu?: { bytes: Uint8Array; mime: string; originalName: string | null } | null
  emblem?: { bytes: Uint8Array; mime: string } | null
}

/** Claves que ha dejado un guardado. `undefined` = esa imagen no se tocó; `null` = se quitó. */
export interface SavedImageKeys {
  illuKey?: string | null
  emblemKey?: string | null
}

/** Valores por defecto de una unidad que todavía no tiene fila propia en unit_sheets (la inmensa mayoría). */
function blank(unitId: number): UnitSheet {
  return {
    unitId,
    illuUrl: null,
    illuKey: null,
    illuOriginalName: null,
    illuWidthPct: 34,
    illuPosX: null,
    illuPosY: null,
    illuBrightness: 100,
    illuFlipped: false,
    emblemUrl: null,
    emblemKey: null,
    hasCustomEmblem: false,
    cardMaxHeight: 800,
    completed: false,
    sectionWidths: {},
    hiddenProfiles: [],
  }
}

/**
 * URL de una imagen de hoja, con la transición a R2 contemplada:
 *
 *   1. Si hay CLAVE, es una imagen ya en R2 → una URL normal que el navegador
 *      cachea. Este es el camino bueno.
 *   2. Si no, pero quedan BYTES en la columna BLOB, es una hoja que la
 *      migración todavía no ha tocado → se arma la data: URL de siempre.
 *
 * Ese respaldo es lo que permite migrar sin apagar nada: mientras el proceso
 * avanza, unas hojas se sirven de una forma y otras de la otra, y por pantalla
 * no se nota la diferencia.
 */
function resolveImageUrl(key: string | null, data: ByteSource | null, mime: string | null): string | null {
  if (key) return imageUrl(key)
  if (data && byteLength(data) > 0 && mime) return bytesToDataUrl(data, mime)
  return null
}

function mapRow(row: Record<string, unknown>): UnitSheet {
  const illuKey = (row.illu_key as string) ?? null
  const illuData = (row.illu_data as ByteSource | null) ?? null
  const illuMime = (row.illu_mime as string) ?? null
  const emblemKey = (row.emblem_key as string) ?? null
  const emblemData = (row.emblem_data as ByteSource | null) ?? null
  const emblemMime = (row.emblem_mime as string) ?? null
  const emblemUrl = resolveImageUrl(emblemKey, emblemData, emblemMime)
  return {
    unitId: (row.unit_id as number) ?? (row.ref_id as number),
    illuUrl: resolveImageUrl(illuKey, illuData, illuMime),
    illuKey,
    illuOriginalName: (row.illu_original_name as string) ?? null,
    illuWidthPct: (row.illu_width_pct as number) ?? 34,
    illuPosX: (row.illu_pos_x as number) ?? null,
    illuPosY: (row.illu_pos_y as number) ?? null,
    illuBrightness: (row.illu_brightness as number) ?? 100,
    illuFlipped: Boolean(row.illu_flipped),
    emblemUrl,
    emblemKey,
    hasCustomEmblem: emblemUrl !== null,
    cardMaxHeight: (row.card_max_height as number) ?? 800,
    completed: Boolean(row.completed),
    sectionWidths: parseSectionWidths(row.section_widths),
    hiddenProfiles: parseHiddenProfiles(row.hidden_profiles),
  }
}

// ============================================================================
// Destino de una ficha. Las de UNIDAD viven en unit_sheets (con clave ajena a
// units, que da el borrado en cascada); las de montura y opción, en
// sheet_presentations, porque no son unidades y no caben en esa clave ajena
// (ver db/schema.sql). Todo lo demás —columnas, valores por defecto, forma de
// las consultas— es idéntico, así que el repositorio se escribe una vez y
// resuelve aquí a qué tabla va cada operación.
// ============================================================================
export type SheetTargetKind = 'unidad' | 'montura' | 'opcion'
export interface SheetTarget {
  kind: SheetTargetKind
  id: number
}

/** Atajo para el caso de siempre: la ficha de una unidad. */
export function unitTarget(unitId: number): SheetTarget {
  return { kind: 'unidad', id: unitId }
}

interface TargetSql {
  table: string
  /** Fragmento WHERE, ya con sus parámetros. */
  where: string
  whereParams: (string | number)[]
  /** Crea la fila si no existe: casi ninguna ficha la tiene hasta su primera edición. */
  ensure: BatchStatement
}

function sqlFor(target: SheetTarget): TargetSql {
  if (target.kind === 'unidad') {
    return {
      table: 'unit_sheets',
      where: 'unit_id = ?',
      whereParams: [target.id],
      ensure: { sql: 'INSERT OR IGNORE INTO unit_sheets (unit_id) VALUES (?)', params: [target.id] },
    }
  }
  return {
    table: 'sheet_presentations',
    where: 'kind = ? AND ref_id = ?',
    whereParams: [target.kind, target.id],
    ensure: {
      sql: 'INSERT OR IGNORE INTO sheet_presentations (kind, ref_id) VALUES (?, ?)',
      params: [target.kind, target.id],
    },
  }
}

export const UnitSheetRepository = {
  /** Presentación de cualquier ficha (unidad, montura u opción). */
  async get(target: SheetTarget): Promise<UnitSheet> {
    const { table, where, whereParams } = sqlFor(target)
    const row = await queryOne(`SELECT * FROM ${table} WHERE ${where}`, whereParams, mapRow)
    return row ?? blank(target.id)
  },

  async getByUnitId(unitId: number): Promise<UnitSheet> {
    return UnitSheetRepository.get(unitTarget(unitId))
  },

  /**
   * Claves ("u:12", "m:3", "o:5") de las fichas marcadas como COMPLETADAS —
   * lo único que el panel "Tus hojas" necesita saber de las fichas que no
   * están abiertas.
   *
   * Antes esto era un `SELECT us.*` que traía la fila entera de cada ficha de
   * la facción, BLOBs incluidos: al entrar en la sección se descargaban TODAS
   * las ilustraciones y escudos de la facción —varios MB en base64— solo para
   * pintar un tick verde junto a unos nombres. Ese era el grueso de la espera
   * al abrir "Hojas de Unidad". Aquí se piden dos columnas y ni un byte de
   * imagen; la ficha completa se carga solo al seleccionarla.
   */
  async getCompletedKeys(factionId: number): Promise<Set<string>> {
    const [unitRows, presentationRows] = await Promise.all([
      query(
        `SELECT us.unit_id AS id FROM unit_sheets us
         JOIN units u ON u.id = us.unit_id
         WHERE u.faction_id = ? AND us.completed = 1`,
        [factionId],
        (row) => `u:${row.id as number}`,
      ),
      query(
        `SELECT kind, ref_id FROM sheet_presentations WHERE completed = 1`,
        [],
        (row) => `${row.kind === 'montura' ? 'm' : 'o'}:${row.ref_id as number}`,
      ),
    ])
    return new Set([...unitRows, ...presentationRows])
  },

  /**
   * Guarda DE UNA VEZ toda la presentación de una ficha: el estado completo
   * del borrador que se está editando en pantalla, más las imágenes que hayan
   * cambiado.
   *
   * Sustituye al puñado de métodos sueltos que había antes (setIlluTransform,
   * setSectionWidth, setCompleted…), y no por gusto de agrupar: aquellos
   * escribían por red en CADA movimiento del deslizador y en cada arrastre, y
   * eso era lo que hacía que la sección se sintiera lenta y que un fallo de
   * red dejara la pantalla enseñando algo que no estaba guardado. Ahora la
   * edición ocurre en memoria (ver FichasPage) y aquí llega una sola escritura
   * al pulsar "Guardar".
   *
   * ORDEN DE LAS OPERACIONES con imágenes. Primero se suben a R2 y solo
   * después se escribe la base, nunca al revés. Si el guardado se corta a
   * medias, el peor caso es un archivo en el bucket al que no apunta nadie
   * —unos KB desperdiciados—; al revés, la base apuntaría a una imagen que no
   * existe y la hoja se vería rota.
   *
   * Las imágenes viejas se borran al final, cuando la base ya apunta a las
   * nuevas y ya no hacen falta.
   *
   * Solo se sube lo que de verdad ha cambiado: repetir la subida de la misma
   * ilustración en cada guardado sería tirar ancho de banda, y además la clave
   * lleva el hash del contenido, así que subir dos veces lo mismo produciría
   * exactamente el mismo archivo.
   */
  async save(target: SheetTarget, sheet: UnitSheet, images: SheetImageChange = {}): Promise<SavedImageKeys> {
    const { table, where, whereParams, ensure } = sqlFor(target)

    // --- 1. Subir a R2 lo que haya cambiado ---
    let illuKey: string | null | undefined
    if (images.illu !== undefined) {
      illuKey =
        images.illu === null
          ? null
          : await uploadImage(target.kind, target.id, 'illu', images.illu.bytes, images.illu.mime)
    }
    let emblemKey: string | null | undefined
    if (images.emblem !== undefined) {
      emblemKey =
        images.emblem === null
          ? null
          : await uploadImage(target.kind, target.id, 'emblem', images.emblem.bytes, images.emblem.mime)
    }

    // --- 2. Escribir la base en un único batch ---
    const statements: BatchStatement[] = [
      ensure,
      {
        sql: `UPDATE ${table} SET
                illu_width_pct = ?, illu_pos_x = ?, illu_pos_y = ?, illu_brightness = ?, illu_flipped = ?,
                card_max_height = ?, completed = ?, section_widths = ?, hidden_profiles = ?
              WHERE ${where}`,
        params: [
          sheet.illuWidthPct,
          sheet.illuPosX,
          sheet.illuPosY,
          sheet.illuBrightness,
          sheet.illuFlipped ? 1 : 0,
          sheet.cardMaxHeight,
          sheet.completed ? 1 : 0,
          JSON.stringify(sheet.sectionWidths ?? {}),
          JSON.stringify(sheet.hiddenProfiles ?? []),
          ...whereParams,
        ],
      },
    ]

    // Al escribir una imagen nueva se vacía también su columna BLOB: si la
    // hoja venía de antes de R2, sus bytes ya no pintan nada y solo harían
    // engordar la base (y confundir al respaldo de mapRow).
    if (images.illu !== undefined) {
      statements.push({
        sql: `UPDATE ${table} SET illu_key = ?, illu_mime = ?, illu_original_name = ?, illu_data = NULL WHERE ${where}`,
        params: [illuKey ?? null, images.illu?.mime ?? null, images.illu?.originalName ?? null, ...whereParams],
      })
    }

    if (images.emblem !== undefined) {
      statements.push({
        sql: `UPDATE ${table} SET emblem_key = ?, emblem_mime = ?, emblem_data = NULL WHERE ${where}`,
        params: [emblemKey ?? null, images.emblem?.mime ?? null, ...whereParams],
      })
    }

    await execBatch(statements)

    // --- 3. Recoger lo que ha quedado atrás ---
    if (images.illu !== undefined && sheet.illuKey && sheet.illuKey !== illuKey) {
      await deleteImageQuietly(sheet.illuKey)
    }
    if (images.emblem !== undefined && sheet.emblemKey && sheet.emblemKey !== emblemKey) {
      await deleteImageQuietly(sheet.emblemKey)
    }

    // Las claves vuelven a quien llamó para que actualice su copia en memoria
    // sin tener que releer la fila. Importa para el borrado: si el borrador se
    // quedase con la clave vieja, al cambiar otra vez la imagen se borraría el
    // archivo equivocado.
    return { illuKey, emblemKey }
  },
}
