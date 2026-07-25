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

/** Valores por defecto de una unidad que todavía no tiene fila propia en unit_sheets (la inmensa mayoría). */
function blank(unitId: number): UnitSheet {
  return {
    unitId,
    illuUrl: null,
    illuOriginalName: null,
    illuWidthPct: 34,
    illuPosX: null,
    illuPosY: null,
    illuBrightness: 100,
    illuFlipped: false,
    emblemUrl: null,
    hasCustomEmblem: false,
    cardMaxHeight: 800,
    completed: false,
    sectionWidths: {},
    hiddenProfiles: [],
  }
}

function mapRow(row: Record<string, unknown>): UnitSheet {
  const illuData = (row.illu_data as ByteSource | null) ?? null
  const illuMime = (row.illu_mime as string) ?? null
  const emblemData = (row.emblem_data as ByteSource | null) ?? null
  const emblemMime = (row.emblem_mime as string) ?? null
  return {
    unitId: (row.unit_id as number) ?? (row.ref_id as number),
    illuUrl: illuData && byteLength(illuData) > 0 && illuMime ? bytesToDataUrl(illuData, illuMime) : null,
    illuOriginalName: (row.illu_original_name as string) ?? null,
    illuWidthPct: (row.illu_width_pct as number) ?? 34,
    illuPosX: (row.illu_pos_x as number) ?? null,
    illuPosY: (row.illu_pos_y as number) ?? null,
    illuBrightness: (row.illu_brightness as number) ?? 100,
    illuFlipped: Boolean(row.illu_flipped),
    emblemUrl: emblemData && byteLength(emblemData) > 0 && emblemMime ? bytesToDataUrl(emblemData, emblemMime) : null,
    hasCustomEmblem: byteLength(emblemData) > 0,
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
   * Los BLOBs van en sentencias aparte dentro del MISMO batch (una sola
   * petición HTTP): así la sentencia con los campos normales sigue siendo
   * pequeña, y solo se manda una imagen cuando de verdad ha cambiado — volver
   * a subir la misma ilustración en cada guardado sería tirar ancho de banda.
   */
  async save(target: SheetTarget, sheet: UnitSheet, images: SheetImageChange = {}): Promise<void> {
    const { table, where, whereParams, ensure } = sqlFor(target)
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

    if (images.illu !== undefined) {
      statements.push(
        images.illu === null
          ? {
              sql: `UPDATE ${table} SET illu_data = NULL, illu_mime = NULL, illu_original_name = NULL WHERE ${where}`,
              params: whereParams,
            }
          : {
              sql: `UPDATE ${table} SET illu_data = ?, illu_mime = ?, illu_original_name = ? WHERE ${where}`,
              params: [images.illu.bytes, images.illu.mime, images.illu.originalName, ...whereParams],
            },
      )
    }

    if (images.emblem !== undefined) {
      statements.push(
        images.emblem === null
          ? { sql: `UPDATE ${table} SET emblem_data = NULL, emblem_mime = NULL WHERE ${where}`, params: whereParams }
          : {
              sql: `UPDATE ${table} SET emblem_data = ?, emblem_mime = ? WHERE ${where}`,
              params: [images.emblem.bytes, images.emblem.mime, ...whereParams],
            },
      )
    }

    await execBatch(statements)
  },
}
