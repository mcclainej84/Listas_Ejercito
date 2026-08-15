// ============================================================================
// Sendas de magia y sus hechizos (ver magic_paths / magic_spells en
// db/schema.sql y domain/magic.ts).
//
// Es CATÁLOGO: se lee de la copia local en memoria (queryLocal) y se escribe
// por red con execCatalog, que además replica la escritura en esa copia. Mismo
// mecanismo que facciones, unidades o reglas — 30 sendas y 213 hechizos de
// texto corto pesan poco y se consultan al pintar cualquier ficha de
// hechicero, así que no compensa ir a la red cada vez.
// ============================================================================
import { execCatalog, execCatalogBatch, type BatchStatement } from '@/data/sqlite/client'
import { queryLocal } from '@/data/sqlite/localCatalog'
import { ChangeLogRepository } from '@/data/repositories/changeLogRepository'
import {
  isMagicGroup,
  type MagicPath,
  type MagicPathDetail,
  type MagicPathInput,
  type MagicSpell,
  type MagicSpellInput,
} from '@/domain/magic'

function mapPath(row: Record<string, unknown>): MagicPath {
  const group = row.group_code
  return {
    id: row.id as number,
    code: row.code as string,
    name: row.name as string,
    // Si alguien mete a mano un grupo desconocido, se trata como MISTICAS en
    // vez de romper la pantalla: es una etiqueta, no un dato crítico.
    group: isMagicGroup(group) ? group : 'MISTICAS',
    sortOrder: (row.sort_order as number) ?? 0,
  }
}

function mapSpell(row: Record<string, unknown>): MagicSpell {
  return {
    id: row.id as number,
    pathId: row.path_id as number,
    level: (row.level as number) ?? 1,
    name: (row.name as string) ?? '',
    difficulty: (row.difficulty as string) ?? null,
    range: (row.range_text as string) ?? null,
    hits: (row.hits as string) ?? null,
    damage: (row.damage as string) ?? null,
    staysActive: Boolean(row.stays_active),
    cac: (row.cac as string) ?? null,
    rules: (row.rules as string) ?? null,
    sortOrder: (row.sort_order as number) ?? 0,
  }
}

export const MagicRepository = {
  async listPaths(): Promise<MagicPath[]> {
    return queryLocal('SELECT * FROM magic_paths ORDER BY sort_order, name', [], mapPath)
  },

  /** Todas las sendas con sus hechizos. Dos consultas y un cruce en memoria: son 30 y 213 filas. */
  async listPathsWithSpells(): Promise<MagicPathDetail[]> {
    const [paths, spells] = await Promise.all([
      MagicRepository.listPaths(),
      queryLocal('SELECT * FROM magic_spells ORDER BY level, sort_order, id', [], mapSpell),
    ])
    const byPath = new Map<number, MagicSpell[]>()
    for (const spell of spells) {
      const list = byPath.get(spell.pathId)
      if (list) list.push(spell)
      else byPath.set(spell.pathId, [spell])
    }
    return paths.map((path) => ({ ...path, spells: byPath.get(path.id) ?? [] }))
  },

  async getPathById(id: number): Promise<MagicPathDetail | null> {
    const [path] = await queryLocal('SELECT * FROM magic_paths WHERE id = ?', [id], mapPath)
    if (!path) return null
    const spells = await queryLocal(
      'SELECT * FROM magic_spells WHERE path_id = ? ORDER BY level, sort_order, id',
      [id],
      mapSpell,
    )
    return { ...path, spells }
  },

  async createPath(input: MagicPathInput): Promise<number> {
    const [{ next }] = await queryLocal(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM magic_paths',
      [],
      (row) => ({ next: row.next as number }),
    )
    const id = await execCatalog('INSERT INTO magic_paths (code, name, group_code, sort_order) VALUES (?, ?, ?, ?)', [
      input.code,
      input.name,
      input.group,
      next,
    ])
    await ChangeLogRepository.record('regla', 'crear', `Creó la senda de magia "${input.name}"`, id)
    return id
  },

  async updatePath(id: number, input: MagicPathInput): Promise<void> {
    await execCatalog('UPDATE magic_paths SET code = ?, name = ?, group_code = ? WHERE id = ?', [
      input.code,
      input.name,
      input.group,
      id,
    ])
    await ChangeLogRepository.record('regla', 'editar', `Editó la senda de magia "${input.name}"`, id)
  },

  /** Borra la senda y, en cascada, sus hechizos y las asignaciones a unidades. */
  async removePath(id: number): Promise<void> {
    const path = await MagicRepository.getPathById(id)
    if (!path) return
    await execCatalogBatch([
      { sql: 'DELETE FROM unit_magic_paths WHERE path_id = ?', params: [id] },
      { sql: 'DELETE FROM magic_spells WHERE path_id = ?', params: [id] },
      { sql: 'DELETE FROM magic_paths WHERE id = ?', params: [id] },
    ])
    await ChangeLogRepository.record('regla', 'borrar', `Borró la senda de magia "${path.name}"`, id)
  },

  /** Reordena las sendas: se guarda el orden completo, que es lo que se ve en pantalla. */
  async reorderPaths(orderedIds: number[]): Promise<void> {
    if (orderedIds.length === 0) return
    await execCatalogBatch(
      orderedIds.map((id, index) => ({
        sql: 'UPDATE magic_paths SET sort_order = ? WHERE id = ?',
        params: [index + 1, id],
      })),
    )
  },

  async addSpell(pathId: number, input: MagicSpellInput): Promise<number> {
    const [{ next }] = await queryLocal(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM magic_spells WHERE path_id = ?',
      [pathId],
      (row) => ({ next: row.next as number }),
    )
    return execCatalog(
      `INSERT INTO magic_spells (path_id, level, name, difficulty, range_text, hits, damage, stays_active, cac, rules, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pathId,
        input.level,
        input.name,
        input.difficulty,
        input.range,
        input.hits,
        input.damage,
        input.staysActive ? 1 : 0,
        input.cac,
        input.rules,
        next,
      ],
    )
  },

  async updateSpell(id: number, input: MagicSpellInput): Promise<void> {
    await execCatalog(
      `UPDATE magic_spells SET level = ?, name = ?, difficulty = ?, range_text = ?, hits = ?, damage = ?,
              stays_active = ?, cac = ?, rules = ? WHERE id = ?`,
      [
        input.level,
        input.name,
        input.difficulty,
        input.range,
        input.hits,
        input.damage,
        input.staysActive ? 1 : 0,
        input.cac,
        input.rules,
        id,
      ],
    )
  },

  async removeSpell(id: number): Promise<void> {
    await execCatalog('DELETE FROM magic_spells WHERE id = ?', [id])
  },

  // --------------------------------------------------------------------------
  // Sendas que conoce una unidad
  // --------------------------------------------------------------------------

  async listPathIdsByUnit(unitId: number): Promise<number[]> {
    return queryLocal(
      'SELECT path_id FROM unit_magic_paths WHERE unit_id = ?',
      [unitId],
      (row) => row.path_id as number,
    )
  },

  /**
   * Fija de una vez las sendas de una unidad. Se borra y se reinserta en vez
   * de calcular altas y bajas: son un puñado de filas y así el resultado no
   * depende de que el cliente haya calculado bien la diferencia.
   */
  async setUnitPaths(unitId: number, pathIds: number[]): Promise<void> {
    const statements: BatchStatement[] = [{ sql: 'DELETE FROM unit_magic_paths WHERE unit_id = ?', params: [unitId] }]
    for (const pathId of pathIds) {
      statements.push({
        sql: 'INSERT OR IGNORE INTO unit_magic_paths (unit_id, path_id) VALUES (?, ?)',
        params: [unitId, pathId],
      })
    }
    await execCatalogBatch(statements)
  },
}
