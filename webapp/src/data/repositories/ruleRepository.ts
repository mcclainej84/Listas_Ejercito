import { execCatalog, execCatalogBatch } from '@/data/sqlite/client'
import { queryLocal, queryLocalOne } from '@/data/sqlite/localCatalog'
import { ChangeLogRepository } from '@/data/repositories/changeLogRepository'
import type { SpecialRule } from '@/domain/types'

function mapRule(row: Record<string, unknown>): SpecialRule {
  return {
    id: row.id as number,
    name: row.name as string,
    description: (row.description as string) ?? '',
  }
}

export interface RuleInput {
  name: string
  description: string
}

export interface SpecialRuleWithUsage extends SpecialRule {
  /** Cuántas fichas la usan, sumando los TRES orígenes (ver RULE_USAGE_SQL). */
  usageCount: number
}

/** Una ficha concreta que usa una regla, para poder ver "quién la lleva". */
export interface RuleUsageRow {
  ruleId: number
  /** Nombre de la unidad, la opción o la montura. */
  name: string
  /** De dónde sale: la facción (unidades) o el catálogo del que viene. */
  source: string
}

/**
 * Una regla puede estar en uso desde TRES sitios distintos, y los tres cuentan
 * para saber si está huérfana: unidades (unit_special_rules), opciones de
 * unidad con ficha propia (upgrade_special_rules) y monturas/monstruos del
 * catálogo (profile_special_rules). Mirar solo las unidades marcaría como "sin
 * usar" una regla que en realidad lleva un dragón, y se acabaría borrando algo
 * que sí se estaba usando.
 */
const RULE_USAGE_SQL = `
  SELECT usr.rule_id AS rule_id, u.name AS name, f.name AS source
    FROM unit_special_rules usr
    JOIN units u ON u.id = usr.unit_id
    JOIN factions f ON f.id = u.faction_id
  UNION ALL
  SELECT upsr.rule_id AS rule_id, up.name AS name, 'Opción de unidad' AS source
    FROM upgrade_special_rules upsr
    JOIN upgrades up ON up.id = upsr.upgrade_id
  UNION ALL
  SELECT psr.rule_id AS rule_id, ap.name AS name, 'Montura/Dotación' AS source
    FROM profile_special_rules psr
    JOIN attribute_profiles ap ON ap.id = psr.profile_id
`

export const RuleRepository = {
  async listAll(): Promise<SpecialRule[]> {
    return queryLocal('SELECT * FROM special_rules ORDER BY name', [], mapRule)
  },

  /** Todas las reglas con su nº de usos — lo que permite filtrar las que no usa nadie. */
  async listAllWithUsage(): Promise<SpecialRuleWithUsage[]> {
    return queryLocal(
      `SELECT sr.*, (SELECT COUNT(*) FROM (${RULE_USAGE_SQL}) usos WHERE usos.rule_id = sr.id) AS usage_count
       FROM special_rules sr ORDER BY sr.name`,
      [],
      (row) => ({ ...mapRule(row), usageCount: row.usage_count as number }),
    )
  },

  /** Quién usa cada regla (unidades, opciones y monturas), para desplegarlo bajo la fila. */
  async listUsage(): Promise<RuleUsageRow[]> {
    return queryLocal(`SELECT * FROM (${RULE_USAGE_SQL}) ORDER BY source, name`, [], (row) => ({
      ruleId: row.rule_id as number,
      name: (row.name as string) ?? '(sin nombre)',
      source: row.source as string,
    }))
  },

  async getById(id: number): Promise<SpecialRule | null> {
    return queryLocalOne('SELECT * FROM special_rules WHERE id = ?', [id], mapRule)
  },

  /**
   * Reglas que de verdad puede llegar a llevar una unidad de esta facción:
   * las suyas propias (unit_special_rules), las de las opciones con ficha
   * que puede añadir (upgrade_special_rules vía unit_upgrade_options) y las
   * de las monturas/carros que puede montar (profile_special_rules vía
   * unit_profiles). Sirve para que "destacar reglas" (ver
   * faction_featured_rules) ofrezca solo las relevantes para esa facción, no las
   * 350+ del catálogo entero.
   */
  /**
   * Ids de las reglas DESTACADAS de una facción.
   *
   * Es catálogo compartido, no preferencia de usuario: lo que se marque aquí
   * lo ve todo el mundo. Antes vivía en user_faction_rules, una fila por
   * usuario, lo que significaba que cada uno tenía que volver a marcarlas.
   */
  async getFeaturedRuleIds(factionId: number): Promise<number[]> {
    try {
      return await queryLocal(
        'SELECT rule_id FROM faction_featured_rules WHERE faction_id = ?',
        [factionId],
        (r) => r.rule_id as number,
      )
    } catch {
      // Todavía sin desplegar el Worker: ninguna destacada es una respuesta
      // correcta y no rompe el constructor (ver schemaHealth).
      return []
    }
  },

  /** Sustituye enteras las reglas destacadas de una facción. */
  async setFeaturedRuleIds(factionId: number, ruleIds: number[]): Promise<void> {
    await execCatalogBatch([
      { sql: 'DELETE FROM faction_featured_rules WHERE faction_id = ?', params: [factionId] },
      ...ruleIds.map((ruleId) => ({
        sql: 'INSERT OR IGNORE INTO faction_featured_rules (faction_id, rule_id) VALUES (?, ?)',
        params: [factionId, ruleId],
      })),
    ])
  },

  async listByFaction(factionId: number): Promise<SpecialRule[]> {
    return queryLocal(
      `SELECT DISTINCT sr.* FROM special_rules sr
       WHERE sr.id IN (
         SELECT usr.rule_id FROM unit_special_rules usr
           JOIN units u ON u.id = usr.unit_id
           WHERE u.faction_id = ?
         UNION
         SELECT upsr.rule_id FROM upgrade_special_rules upsr
           JOIN unit_upgrade_options uuo ON uuo.upgrade_id = upsr.upgrade_id
           JOIN units u ON u.id = uuo.unit_id
           WHERE u.faction_id = ?
         UNION
         SELECT psr.rule_id FROM profile_special_rules psr
           JOIN unit_profiles up ON up.profile_id = psr.profile_id
           JOIN units u ON u.id = up.unit_id
           WHERE u.faction_id = ?
       )
       ORDER BY sr.name`,
      [factionId, factionId, factionId],
      mapRule,
    )
  },

  async create(input: RuleInput): Promise<number> {
    const id = await execCatalog('INSERT INTO special_rules (name, description) VALUES (?, ?)', [
      input.name,
      input.description,
    ])
    await ChangeLogRepository.record('regla', 'crear', `Creó la regla especial "${input.name}"`, id)
    return id
  },

  async update(id: number, input: RuleInput): Promise<void> {
    await execCatalog('UPDATE special_rules SET name = ?, description = ? WHERE id = ?', [
      input.name,
      input.description,
      id,
    ])
    await ChangeLogRepository.record('regla', 'editar', `Editó la regla especial "${input.name}"`, id)
  },

  async remove(id: number): Promise<void> {
    // Si la regla ya no existe, no hay nada que borrar NI que registrar: sin
    // esta comprobación, cualquier llamada repetida dejaba un segundo "borró
    // X" fantasma en el Log (ver ConfirmDialog).
    const existing = await RuleRepository.getById(id)
    if (!existing) return
    await execCatalog('DELETE FROM special_rules WHERE id = ?', [id])
    await ChangeLogRepository.record('regla', 'borrar', `Borró la regla especial "${existing.name}"`, id)
  },

  // Aquí vivía `listUnitsUsingRule`, que solo miraba unit_special_rules. Se ha
  // quitado (ya no la usaba nadie) en vez de dejarla como trampa: hoy una
  // regla puede venir también de una opción o de una montura, así que
  // responder "quién la usa" mirando solo las unidades da una respuesta
  // incompleta. Para eso está `listUsage`.
}
