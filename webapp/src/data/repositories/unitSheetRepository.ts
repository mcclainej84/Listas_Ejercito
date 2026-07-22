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
import { exec, execBatch, query, queryOne, type BatchStatement } from '@/data/sqlite/client'
import { bytesToDataUrl } from '@/shared/image'
import {
  parseHiddenProfiles,
  parseSectionWidths,
  type SectionWidths,
  type SheetSection,
} from '@/domain/sheetSections'
import type { UnitSheet } from '@/domain/types'

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
  const illuData = (row.illu_data as Uint8Array | null) ?? null
  const illuMime = (row.illu_mime as string) ?? null
  const emblemData = (row.emblem_data as Uint8Array | null) ?? null
  const emblemMime = (row.emblem_mime as string) ?? null
  return {
    unitId: (row.unit_id as number) ?? (row.ref_id as number),
    illuUrl: illuData && illuData.length > 0 && illuMime ? bytesToDataUrl(illuData, illuMime) : null,
    illuOriginalName: (row.illu_original_name as string) ?? null,
    illuWidthPct: (row.illu_width_pct as number) ?? 34,
    illuPosX: (row.illu_pos_x as number) ?? null,
    illuPosY: (row.illu_pos_y as number) ?? null,
    illuBrightness: (row.illu_brightness as number) ?? 100,
    illuFlipped: Boolean(row.illu_flipped),
    emblemUrl: emblemData && emblemData.length > 0 && emblemMime ? bytesToDataUrl(emblemData, emblemMime) : null,
    hasCustomEmblem: Boolean(emblemData && emblemData.length > 0),
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
   * Todas las fichas ya tocadas de una facción, indexadas por unit_id — para
   * pintar el panel "Tus fichas" (borde de completada, escudo propio...) sin
   * lanzar una consulta por unidad. Las unidades sin fila propia (la mayoría)
   * simplemente no aparecen en el mapa; quien lo consuma debe usar `blank`
   * (vía `getByUnitId`, o comprobando `.has(id)` y usando los valores por
   * defecto documentados en UnitSheet).
   */
  async getMapByFactionId(factionId: number): Promise<Map<number, UnitSheet>> {
    const rows = await query(
      `SELECT us.* FROM unit_sheets us JOIN units u ON u.id = us.unit_id WHERE u.faction_id = ?`,
      [factionId],
      mapRow,
    )
    return new Map(rows.map((r) => [r.unitId, r]))
  },

  /**
   * Sube/reemplaza la ilustración (ya redimensionada/comprimida en el
   * navegador). Reinicia zoom/posición/brillo/volteo a sus valores por
   * defecto, igual que al subir una imagen nueva en CodexMaker (ver
   * illuFile#change en index.html de referencia).
   */
  async setIllustration(
    target: SheetTarget,
    bytes: Uint8Array,
    mime: string,
    originalName: string | null,
  ): Promise<void> {
    const { table, where, whereParams, ensure } = sqlFor(target)
    await execBatch([
      ensure,
      {
        sql: `UPDATE ${table} SET illu_data = ?, illu_mime = ?, illu_original_name = ?,
              illu_width_pct = 34, illu_pos_x = NULL, illu_pos_y = NULL, illu_brightness = 100, illu_flipped = 0
              WHERE ${where}`,
        params: [bytes, mime, originalName, ...whereParams],
      },
    ])
  },

  async removeIllustration(target: SheetTarget): Promise<void> {
    const { table, where, whereParams, ensure } = sqlFor(target)
    await execBatch([
      ensure,
      {
        sql: `UPDATE ${table} SET illu_data = NULL, illu_mime = NULL, illu_original_name = NULL,
              illu_width_pct = 34, illu_pos_x = NULL, illu_pos_y = NULL, illu_brightness = 100, illu_flipped = 0
              WHERE ${where}`,
        params: whereParams,
      },
    ])
  },

  /** Zoom (%), posición libre (arrastre) y brillo (%) — sueltos porque cada uno cambia en un momento distinto (slider vs. arrastre). */
  async setIlluTransform(
    target: SheetTarget,
    transform: { widthPct?: number; posX?: number; posY?: number; brightness?: number; flipped?: boolean },
  ): Promise<void> {
    const sets: string[] = []
    const params: (number | null)[] = []
    if (transform.widthPct !== undefined) {
      sets.push('illu_width_pct = ?')
      params.push(transform.widthPct)
    }
    if (transform.posX !== undefined) {
      sets.push('illu_pos_x = ?')
      params.push(transform.posX)
    }
    if (transform.posY !== undefined) {
      sets.push('illu_pos_y = ?')
      params.push(transform.posY)
    }
    if (transform.brightness !== undefined) {
      sets.push('illu_brightness = ?')
      params.push(transform.brightness)
    }
    if (transform.flipped !== undefined) {
      sets.push('illu_flipped = ?')
      params.push(transform.flipped ? 1 : 0)
    }
    if (sets.length === 0) return
    const { table, where, whereParams, ensure } = sqlFor(target)
    await execBatch([
      ensure,
      { sql: `UPDATE ${table} SET ${sets.join(', ')} WHERE ${where}`, params: [...params, ...whereParams] },
    ])
  },

  /** "Restablecer encuadre": vuelve al zoom/posición/brillo/volteo por defecto sin quitar la imagen. */
  async resetIlluTransform(target: SheetTarget): Promise<void> {
    const { table, where, whereParams, ensure } = sqlFor(target)
    await execBatch([
      ensure,
      {
        sql: `UPDATE ${table} SET illu_width_pct = 34, illu_pos_x = NULL, illu_pos_y = NULL, illu_brightness = 100, illu_flipped = 0
              WHERE ${where}`,
        params: whereParams,
      },
    ])
  },

  /** Reemplaza el escudo SOLO en esta ficha (anula el emblema de la facción mientras exista). */
  async setEmblemOverride(target: SheetTarget, bytes: Uint8Array, mime: string): Promise<void> {
    const { table, where, whereParams, ensure } = sqlFor(target)
    await execBatch([
      ensure,
      { sql: `UPDATE ${table} SET emblem_data = ?, emblem_mime = ? WHERE ${where}`, params: [bytes, mime, ...whereParams] },
    ])
  },

  /** Quita el escudo propio de esta ficha: vuelve a usar el de la facción. */
  async clearEmblemOverride(target: SheetTarget): Promise<void> {
    const { table, where, whereParams } = sqlFor(target)
    await exec(`UPDATE ${table} SET emblem_data = NULL, emblem_mime = NULL WHERE ${where}`, whereParams)
  },

  async setCardMaxHeight(target: SheetTarget, px: number): Promise<void> {
    const { table, where, whereParams, ensure } = sqlFor(target)
    await execBatch([ensure, { sql: `UPDATE ${table} SET card_max_height = ? WHERE ${where}`, params: [px, ...whereParams] }])
  },

  /**
   * Cambia el ancho de UN apartado. Se lee el JSON actual y se reescribe
   * entero: son seis claves como mucho, así que no compensa un UPDATE parcial
   * con funciones JSON de SQLite (que además complicarían la copia local).
   */
  async setSectionWidth(target: SheetTarget, section: SheetSection, widthPct: number): Promise<void> {
    const current = await UnitSheetRepository.get(target)
    const next: SectionWidths = { ...current.sectionWidths, [section]: widthPct }
    const { table, where, whereParams, ensure } = sqlFor(target)
    await execBatch([
      ensure,
      { sql: `UPDATE ${table} SET section_widths = ? WHERE ${where}`, params: [JSON.stringify(next), ...whereParams] },
    ])
  },

  /** Devuelve todos los apartados a su ancho por defecto. */
  async resetSectionWidths(target: SheetTarget): Promise<void> {
    const { table, where, whereParams, ensure } = sqlFor(target)
    await execBatch([ensure, { sql: `UPDATE ${table} SET section_widths = '{}' WHERE ${where}`, params: whereParams }])
  },

  /** Muestra u oculta una ficha de atributos concreta dentro de la hoja. */
  async setProfileHidden(target: SheetTarget, profileKey: string, hidden: boolean): Promise<void> {
    const current = await UnitSheetRepository.get(target)
    const next = hidden
      ? [...new Set([...current.hiddenProfiles, profileKey])]
      : current.hiddenProfiles.filter((k) => k !== profileKey)
    const { table, where, whereParams, ensure } = sqlFor(target)
    await execBatch([
      ensure,
      { sql: `UPDATE ${table} SET hidden_profiles = ? WHERE ${where}`, params: [JSON.stringify(next), ...whereParams] },
    ])
  },

  async setCompleted(target: SheetTarget, completed: boolean): Promise<void> {
    const { table, where, whereParams, ensure } = sqlFor(target)
    await execBatch([
      ensure,
      { sql: `UPDATE ${table} SET completed = ? WHERE ${where}`, params: [completed ? 1 : 0, ...whereParams] },
    ])
  },
}
