// ============================================================================
// BATALLAS: dos ejércitos completados, enfrentados sobre la misma mesa.
//
// UNA BATALLA NO GUARDA POSICIONES. Lee el despliegue de cada lista, y puede
// hacerlo porque las dos piezas encajan: para entrar en una batalla la lista
// tiene que estar COMPLETADA, y una lista metida en una batalla ya no se puede
// reabrir (lo impide ArmyListRepository.setReady). Es decir, lo que la batalla
// enseña no puede cambiar mientras la batalla exista. Congelar una copia habría
// sido guardar dos veces lo mismo, con dos tablas más y el deber de mantenerlas
// iguales para siempre.
//
// Van por RED como las listas de ejército, no en el snapshot del catálogo: son
// dato de partida y se leen cuando alguien abre la sección, no mil veces al
// pintar.
// ============================================================================
import { exec, query, queryOne } from '@/data/sqlite/client'

/** Una batalla, con lo justo para listarla. */
export interface BattleSummary {
  id: number
  name: string
  userId: number | null
  armyListAId: number
  armyListBId: number
  createdAt: string
  updatedAt: string
  /** Nombres de los dos ejércitos, resueltos en la misma consulta. */
  nombreA: string
  nombreB: string
  faccionA: string
  faccionB: string
}

function mapBattle(row: Record<string, unknown>): BattleSummary {
  return {
    id: row.id as number,
    name: row.name as string,
    userId: (row.user_id as number) ?? null,
    armyListAId: row.army_list_a_id as number,
    armyListBId: row.army_list_b_id as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    nombreA: (row.nombre_a as string) ?? '—',
    nombreB: (row.nombre_b as string) ?? '—',
    faccionA: (row.faccion_a as string) ?? '—',
    faccionB: (row.faccion_b as string) ?? '—',
  }
}

/** Nombre y facción de los dos bandos, en la misma consulta que la batalla. */
const SELECT_CON_BANDOS = `
  SELECT b.*,
         (SELECT name FROM army_lists WHERE id = b.army_list_a_id) AS nombre_a,
         (SELECT name FROM army_lists WHERE id = b.army_list_b_id) AS nombre_b,
         (SELECT f.name FROM army_lists al JOIN factions f ON f.id = al.faction_id WHERE al.id = b.army_list_a_id) AS faccion_a,
         (SELECT f.name FROM army_lists al JOIN factions f ON f.id = al.faction_id WHERE al.id = b.army_list_b_id) AS faccion_b
    FROM battles b`

export interface BattleInput {
  name: string
  armyListAId: number
  armyListBId: number
}

export const BattleRepository = {
  /** Las batallas del usuario. Son privadas de quien las crea, como los ejércitos. */
  async listAll(userId: number): Promise<BattleSummary[]> {
    return query(`${SELECT_CON_BANDOS} WHERE b.user_id = ? ORDER BY b.updated_at DESC`, [userId], mapBattle)
  },

  async getById(id: number): Promise<BattleSummary | null> {
    return queryOne(`${SELECT_CON_BANDOS} WHERE b.id = ?`, [id], mapBattle)
  },

  async create(input: BattleInput, userId: number): Promise<number> {
    const now = new Date().toISOString()
    return exec(
      `INSERT INTO battles (name, user_id, army_list_a_id, army_list_b_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.name.trim(), userId, input.armyListAId, input.armyListBId, now, now],
    )
  },

  async update(id: number, input: BattleInput): Promise<void> {
    await exec('UPDATE battles SET name = ?, army_list_a_id = ?, army_list_b_id = ?, updated_at = ? WHERE id = ?', [
      input.name.trim(),
      input.armyListAId,
      input.armyListBId,
      new Date().toISOString(),
      id,
    ])
  },

  async remove(id: number): Promise<void> {
    await exec('DELETE FROM battles WHERE id = ?', [id])
  },

  /**
   * Ids de las listas que están metidas en alguna batalla — de cualquiera, no
   * solo de las tuyas.
   *
   * Sirve para que el listado de ejércitos pinte su sello bloqueado y explique
   * por qué, en vez de dejar que el usuario lo pulse y se coma un error. La
   * comprobación de verdad, la que no se puede saltar, está en
   * ArmyListRepository.setReady; esto es solo para poder avisar antes.
   *
   * Si la tabla no existe todavía (Worker sin desplegar) devuelve un conjunto
   * vacío: sin batallas, nada que bloquear.
   */
  async idsDeListasEnBatalla(): Promise<Set<number>> {
    try {
      const filas = await query<number[]>('SELECT army_list_a_id, army_list_b_id FROM battles', [], (r) => [
        r.army_list_a_id as number,
        r.army_list_b_id as number,
      ])
      return new Set(filas.flat())
    } catch {
      return new Set()
    }
  },

  /** Cuántas batallas usan esta lista. Lo usa el bloqueo de "reabrir". */
  async cuantasBatallasUsan(armyListId: number): Promise<number> {
    const filas = await query<number>(
      'SELECT COUNT(*) AS n FROM battles WHERE army_list_a_id = ? OR army_list_b_id = ?',
      [armyListId, armyListId],
      (r) => r.n as number,
    )
    return filas[0] ?? 0
  },
}
