// ============================================================================
// Repositorios de catálogos auxiliares (solo lectura por ahora): categorías
// de unidad, equipo, mejoras y roles de mando. Se agrupan en un solo fichero
// porque son consultas de una tabla sin lógica propia; si alguno gana CRUD
// dedicado (p.ej. un Admin de Equipo), se separa en su propio módulo
// siguiendo el mismo patrón que factionRepository.ts.
// ============================================================================
import { execCatalog, execCatalogBatch, type BatchStatement } from '@/data/sqlite/client'
import { queryLocal, queryLocalOne } from '@/data/sqlite/localCatalog'
import { ChangeLogRepository } from '@/data/repositories/changeLogRepository'
import {
  mapEquipmentOptionRow,
  mapUpgradeRow,
  UPGRADE_FROM_JOIN,
  UPGRADE_SELECT_COLUMNS,
} from '@/data/repositories/mappers'
import type {
  AttributeProfileInput,
  CommandRole,
  EquipmentOption,
  SpecialRule,
  Upgrade,
  UnitCategory,
  UnitTypeTag,
} from '@/domain/types'

export const UnitCategoryRepository = {
  async listAll(): Promise<UnitCategory[]> {
    return queryLocal(
      'SELECT * FROM unit_categories ORDER BY sort_order',
      [],
      (row) => ({
        id: row.id as number,
        code: row.code as string,
        name: row.name as string,
        sortOrder: row.sort_order as number,
      }),
    )
  },
}

/** Etiquetas de TIPO de unidad (Infantería, Caballería, Monstruo...) — ver unit_type_tags en db/schema.sql. Solo lectura: se importaron de una vez desde "Categoria tropas.xlsx", se editan a mano caso a caso desde la ficha de unidad si hace falta. */
export const UnitTypeTagRepository = {
  async listAll(): Promise<UnitTypeTag[]> {
    return queryLocal(
      'SELECT * FROM unit_type_tags ORDER BY sort_order',
      [],
      (row) => ({
        id: row.id as number,
        code: row.code as string,
        name: row.name as string,
        sortOrder: row.sort_order as number,
      }),
    )
  },
}

/** Pieza de equipo con el nº de unidades que la usan (para el gestor de equipo: avisar antes de borrar). */
export interface EquipmentOptionWithUsage extends EquipmentOption {
  usageCount: number
}

/** Una unidad que usa una opción concreta (para poder ver "quién la lleva"). */
export interface OptionUsageRow {
  optionId: number
  unitName: string
  factionName: string
}

/**
 * Nombre de una fila del catálogo, para el registro de cambios. Se consulta
 * ANTES de borrarla: después ya no hay de dónde sacarlo y quedaría un
 * "Borró la opción #37" que no le dice nada a nadie.
 */
async function nameOf(table: 'equipment_options' | 'upgrades' | 'attribute_profiles', id: number): Promise<string> {
  const row = await queryLocalOne<string>(`SELECT name FROM ${table} WHERE id = ?`, [id], (r) => r.name as string)
  return row ?? `#${id}`
}

const USAGE_SELECT = `u.name AS unit_name, f.name AS faction_name
   FROM %TABLE% x
   JOIN units u ON u.id = x.unit_id
   JOIN factions f ON f.id = u.faction_id
   ORDER BY f.name, u.name`

/**
 * Sustituye el conjunto de opciones incompatibles con `id`: borra todas las
 * parejas donde aparece y vuelve a insertar las indicadas. El esquema exige
 * a < b (CHECK), así que cada pareja se ordena. Se envía en trozos para no
 * superar el límite de sentencias por lote del Worker.
 */
async function replaceIncompatibilities(
  table: 'equipment_incompatibilities' | 'upgrade_incompatibilities',
  colA: string,
  colB: string,
  id: number,
  otherIds: number[],
  reason: string,
): Promise<void> {
  const statements: BatchStatement[] = [
    { sql: `DELETE FROM ${table} WHERE ${colA} = ? OR ${colB} = ?`, params: [id, id] },
    ...otherIds
      .filter((other) => other !== id)
      .map((other) => ({
        sql: `INSERT OR IGNORE INTO ${table} (${colA}, ${colB}, reason) VALUES (?, ?, ?)`,
        params: [Math.min(id, other), Math.max(id, other), reason] as (string | number)[],
      })),
  ]
  const CHUNK = 45
  for (let i = 0; i < statements.length; i += CHUNK) {
    await execCatalogBatch(statements.slice(i, i + CHUNK))
  }
}

/**
 * Hace que TODAS las opciones dadas sean excluyentes entre sí (todas contra
 * todas), no solo contra una. Es lo que hace falta para un grupo como las
 * marcas del Caos: elegir una debe descartar cualquier otra, y eso son
 * n·(n-1)/2 parejas, no n. Se trocea porque el Worker rechaza lotes de más de
 * 50 sentencias (ver worker/src/index.ts, MAX_MUTATE_STATEMENTS).
 */
async function makeMutuallyExclusive(
  table: 'equipment_incompatibilities' | 'upgrade_incompatibilities',
  colA: string,
  colB: string,
  ids: number[],
  reason: string,
): Promise<void> {
  const unique = [...new Set(ids)]
  const statements: BatchStatement[] = []
  for (let i = 0; i < unique.length; i += 1) {
    for (let j = i + 1; j < unique.length; j += 1) {
      const a = Math.min(unique[i], unique[j])
      const b = Math.max(unique[i], unique[j])
      statements.push({
        sql: `INSERT OR IGNORE INTO ${table} (${colA}, ${colB}, reason) VALUES (?, ?, ?)`,
        params: [a, b, reason] as (string | number)[],
      })
    }
  }
  const CHUNK = 45
  for (let i = 0; i < statements.length; i += CHUNK) {
    await execCatalogBatch(statements.slice(i, i + CHUNK))
  }
}

function mapUsageRow(row: Record<string, unknown>): OptionUsageRow {
  return {
    optionId: row.option_id as number,
    unitName: row.unit_name as string,
    factionName: row.faction_name as string,
  }
}

export const EquipmentRepository = {
  async listAll(): Promise<EquipmentOption[]> {
    return queryLocal('SELECT * FROM equipment_options ORDER BY name', [], mapEquipmentOptionRow)
  },

  /** Todas las piezas de equipo con su nº de usos (unidades que la llevan). */
  async listAllWithUsage(): Promise<EquipmentOptionWithUsage[]> {
    return queryLocal(
      `SELECT eo.*, (SELECT COUNT(*) FROM unit_equipment_options ueo WHERE ueo.equipment_id = eo.id) AS usage_count
       FROM equipment_options eo ORDER BY eo.name`,
      [],
      (row) => ({ ...mapEquipmentOptionRow(row), usageCount: row.usage_count as number }),
    )
  },

  /** Piezas de equipo usadas por al menos una unidad de la facción dada (con su nº total de usos). */
  async listByFaction(factionId: number): Promise<EquipmentOptionWithUsage[]> {
    return queryLocal(
      `SELECT eo.*, (SELECT COUNT(*) FROM unit_equipment_options ueo WHERE ueo.equipment_id = eo.id) AS usage_count
       FROM equipment_options eo
       WHERE eo.id IN (
         SELECT ueo.equipment_id FROM unit_equipment_options ueo
         JOIN units u ON u.id = ueo.unit_id
         WHERE u.faction_id = ?
       )
       ORDER BY eo.name`,
      [factionId],
      (row) => ({ ...mapEquipmentOptionRow(row), usageCount: row.usage_count as number }),
    )
  },

  async update(id: number, input: { name: string; cost: number; category: EquipmentOption['category'] }): Promise<void> {
    await execCatalog('UPDATE equipment_options SET name = ?, cost = ?, category = ? WHERE id = ?', [
      input.name.trim(),
      input.cost,
      input.category ?? null,
      id,
    ])
    await ChangeLogRepository.record('equipo', 'editar', `Editó la opción de equipo "${input.name.trim()}"`, id)
  },

  /** Ids de las piezas de equipo incompatibles con la dada. */
  async listIncompatibleWith(id: number): Promise<number[]> {
    return queryLocal<number>(
      `SELECT CASE WHEN equipment_id_a = ? THEN equipment_id_b ELSE equipment_id_a END AS other
       FROM equipment_incompatibilities WHERE equipment_id_a = ? OR equipment_id_b = ?`,
      [id, id, id],
      (r) => r.other as number,
    )
  },

  /** Define qué piezas de equipo son incompatibles con la dada (sustituye las anteriores). */
  async setIncompatibilities(id: number, otherIds: number[]): Promise<void> {
    await replaceIncompatibilities(
      'equipment_incompatibilities',
      'equipment_id_a',
      'equipment_id_b',
      id,
      otherIds,
      'Definida desde el editor',
    )
  },

  /** Marca un conjunto de piezas de equipo como excluyentes entre sí. */
  async setExclusiveGroup(ids: number[], reason: string): Promise<void> {
    await makeMutuallyExclusive('equipment_incompatibilities', 'equipment_id_a', 'equipment_id_b', ids, reason)
  },

  /** Qué unidades usan cada pieza de equipo (todas de una vez; se agrupa en la UI por optionId). */
  async listUsage(): Promise<OptionUsageRow[]> {
    return queryLocal(
      `SELECT x.equipment_id AS option_id, ${USAGE_SELECT.replace('%TABLE%', 'unit_equipment_options')}`,
      [],
      mapUsageRow,
    )
  },

  /** Borra una pieza de equipo del catálogo. El ON DELETE CASCADE del esquema la quita de todas las unidades y de las incompatibilidades. */
  async remove(id: number): Promise<void> {
    const name = await nameOf('equipment_options', id)
    await execCatalog('DELETE FROM equipment_options WHERE id = ?', [id])
    await ChangeLogRepository.record('equipo', 'borrar', `Borró la opción de equipo "${name}"`, id)
  },

  /**
   * Da de alta una pieza de equipo nueva en el catálogo (para cuando, al
   * asignar opciones a una unidad, la que hace falta todavía no existe).
   * `category` es opcional: si no se reconoce el hueco, se deja sin
   * categoría (siempre combinable, sin exclusividad automática).
   */
  async create(input: { name: string; cost: number; category?: EquipmentOption['category'] }): Promise<number> {
    const id = await execCatalog('INSERT INTO equipment_options (name, cost, category) VALUES (?, ?, ?)', [
      input.name.trim(),
      input.cost,
      input.category ?? null,
    ])
    await ChangeLogRepository.record('equipo', 'crear', `Creó la opción de equipo "${input.name.trim()}"`, id)
    return id
  },

  /**
   * Todos los pares de piezas incompatibles (equipo ilegal / mismo hueco sin
   * excepción conocida — ver equipment_incompatibilities). Se trae la tabla
   * entera de una vez (es pequeña, ~30 filas) en vez de una consulta por
   * unidad: el constructor de listas la usa para validar localmente sin ir y
   * volver a la BBDD en cada cambio de selección.
   */
  async listIncompatibilities(): Promise<Array<[number, number]>> {
    return queryLocal<[number, number]>(
      'SELECT equipment_id_a, equipment_id_b FROM equipment_incompatibilities',
      [],
      (row) => [row.equipment_id_a as number, row.equipment_id_b as number],
    )
  },
}

/** Opción de unidad con el nº de unidades que la usan (para el gestor: avisar antes de borrar). */
export interface UpgradeWithUsage extends Upgrade {
  usageCount: number
}

export const UpgradeRepository = {
  async listAll(): Promise<Upgrade[]> {
    return queryLocal(`SELECT ${UPGRADE_SELECT_COLUMNS} ${UPGRADE_FROM_JOIN} ORDER BY up.name`, [], mapUpgradeRow)
  },

  /** Todas las opciones de unidad con su nº de usos. */
  async listAllWithUsage(): Promise<UpgradeWithUsage[]> {
    return queryLocal(
      `SELECT ${UPGRADE_SELECT_COLUMNS},
              (SELECT COUNT(*) FROM unit_upgrade_options uuo WHERE uuo.upgrade_id = up.id) AS usage_count
       ${UPGRADE_FROM_JOIN} ORDER BY up.name`,
      [],
      (row) => ({ ...mapUpgradeRow(row), usageCount: row.usage_count as number }),
    )
  },

  /** Opciones de unidad usadas por al menos una unidad de la facción dada (con su nº total de usos). */
  async listByFaction(factionId: number): Promise<UpgradeWithUsage[]> {
    return queryLocal(
      `SELECT ${UPGRADE_SELECT_COLUMNS},
              (SELECT COUNT(*) FROM unit_upgrade_options uuo WHERE uuo.upgrade_id = up.id) AS usage_count
       ${UPGRADE_FROM_JOIN}
       WHERE up.id IN (
         SELECT uuo.upgrade_id FROM unit_upgrade_options uuo
         JOIN units u ON u.id = uuo.unit_id
         WHERE u.faction_id = ?
       )
       ORDER BY up.name`,
      [factionId],
      (row) => ({ ...mapUpgradeRow(row), usageCount: row.usage_count as number }),
    )
  },

  /** Opciones marcadas para aparecer como ficha propia en la sección "Fichas" (solo las que tienen perfil). */
  async listForSheets(): Promise<Upgrade[]> {
    return queryLocal(
      `SELECT ${UPGRADE_SELECT_COLUMNS} ${UPGRADE_FROM_JOIN}
       WHERE up.include_in_sheets = 1 AND up.profile_id IS NOT NULL
       ORDER BY up.name`,
      [],
      mapUpgradeRow,
    )
  },

  /**
   * Las mismas opciones con ficha propia, pero solo las que USA alguna unidad
   * de la facción dada.
   *
   * `upgrades` es un catálogo GLOBAL, así que sin este filtro la sección
   * "Fichas" enseñaba a todo el mundo opciones de otras facciones (el clásico
   * "Grupo de apoyo: Ametralladora" apareciendo en los Elfos Silvanos). La
   * pertenencia a una facción no está en la propia opción: se deduce de qué
   * unidades la ofrecen, que es como funciona todo el resto del catálogo
   * compartido (ver EquipmentRepository.listByFaction).
   */
  async listForSheetsByFaction(factionId: number): Promise<Upgrade[]> {
    return queryLocal(
      `SELECT ${UPGRADE_SELECT_COLUMNS} ${UPGRADE_FROM_JOIN}
       WHERE up.include_in_sheets = 1 AND up.profile_id IS NOT NULL
         AND up.id IN (
           SELECT uuo.upgrade_id FROM unit_upgrade_options uuo
           JOIN units u ON u.id = uuo.unit_id
           WHERE u.faction_id = ?
         )
       ORDER BY up.name`,
      [factionId],
      mapUpgradeRow,
    )
  },

  /** Marca/desmarca si la opción aparece como ficha propia en la sección "Fichas". */
  async setIncludeInSheets(id: number, include: boolean): Promise<void> {
    await execCatalog('UPDATE upgrades SET include_in_sheets = ? WHERE id = ?', [include ? 1 : 0, id])
  },

  /**
   * Crea (si no existía) la ficha de atributos propia de la opción y guarda sus
   * 9 características. Devuelve el id del perfil.
   */
  async saveProfile(upgradeId: number, currentProfileId: number | null, stats: AttributeProfileInput): Promise<number> {
    if (currentProfileId != null) {
      await execCatalog(
        'UPDATE attribute_profiles SET m = ?, ha = ?, hp = ?, f = ?, r = ?, h = ?, i = ?, a = ?, l = ? WHERE id = ?',
        [stats.m, stats.ha, stats.hp, stats.f, stats.r, stats.h, stats.i, stats.a, stats.l, currentProfileId],
      )
      return currentProfileId
    }
    const profileId = await execCatalog(
      `INSERT INTO attribute_profiles (name, profile_kind, m, ha, hp, f, r, h, i, a, l)
       VALUES (NULL, 'unidad', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [stats.m, stats.ha, stats.hp, stats.f, stats.r, stats.h, stats.i, stats.a, stats.l],
    )
    await execCatalog('UPDATE upgrades SET profile_id = ? WHERE id = ?', [profileId, upgradeId])
    return profileId
  },

  /** Quita la ficha propia de la opción (y borra el perfil, que solo pertenecía a ella). */
  async removeProfile(upgradeId: number, profileId: number): Promise<void> {
    await execCatalogBatch([
      { sql: 'UPDATE upgrades SET profile_id = NULL, include_in_sheets = 0 WHERE id = ?', params: [upgradeId] },
      { sql: 'DELETE FROM attribute_profiles WHERE id = ?', params: [profileId] },
    ])
  },

  /** Reglas especiales propias de la opción. */
  async listSpecialRules(upgradeId: number): Promise<SpecialRule[]> {
    return queryLocal(
      `SELECT sr.* FROM special_rules sr
       JOIN upgrade_special_rules usr ON usr.rule_id = sr.id
       WHERE usr.upgrade_id = ? ORDER BY sr.name`,
      [upgradeId],
      (row) => ({ id: row.id as number, name: row.name as string, description: (row.description as string) ?? '' }),
    )
  },

  /** Sustituye el conjunto de reglas especiales de la opción. */
  async replaceSpecialRules(upgradeId: number, ruleIds: number[]): Promise<void> {
    await execCatalogBatch([
      { sql: 'DELETE FROM upgrade_special_rules WHERE upgrade_id = ?', params: [upgradeId] },
      ...ruleIds.map((ruleId) => ({
        sql: 'INSERT OR IGNORE INTO upgrade_special_rules (upgrade_id, rule_id) VALUES (?, ?)',
        params: [upgradeId, ruleId],
      })),
    ])
  },

  async create(input: { name: string; cost: number }): Promise<number> {
    const id = await execCatalog('INSERT INTO upgrades (name, cost) VALUES (?, ?)', [input.name.trim(), input.cost])
    await ChangeLogRepository.record('opcion', 'crear', `Creó la opción de unidad "${input.name.trim()}"`, id)
    return id
  },

  async update(id: number, input: { name: string; cost: number }): Promise<void> {
    await execCatalog('UPDATE upgrades SET name = ?, cost = ? WHERE id = ?', [input.name.trim(), input.cost, id])
    await ChangeLogRepository.record('opcion', 'editar', `Editó la opción de unidad "${input.name.trim()}"`, id)
  },

  /** Ids de las opciones de unidad incompatibles con la dada. */
  async listIncompatibleWith(id: number): Promise<number[]> {
    return queryLocal<number>(
      `SELECT CASE WHEN upgrade_id_a = ? THEN upgrade_id_b ELSE upgrade_id_a END AS other
       FROM upgrade_incompatibilities WHERE upgrade_id_a = ? OR upgrade_id_b = ?`,
      [id, id, id],
      (r) => r.other as number,
    )
  },

  /** Define qué opciones de unidad son incompatibles con la dada (sustituye las anteriores). */
  async setIncompatibilities(id: number, otherIds: number[]): Promise<void> {
    await replaceIncompatibilities(
      'upgrade_incompatibilities',
      'upgrade_id_a',
      'upgrade_id_b',
      id,
      otherIds,
      'Definida desde el editor',
    )
  },

  /** Marca un conjunto de opciones de unidad como excluyentes entre sí (p. ej. todas las marcas). */
  async setExclusiveGroup(ids: number[], reason: string): Promise<void> {
    await makeMutuallyExclusive('upgrade_incompatibilities', 'upgrade_id_a', 'upgrade_id_b', ids, reason)
  },

  /** Qué unidades usan cada opción de unidad (todas de una vez; se agrupa en la UI por optionId). */
  async listUsage(): Promise<OptionUsageRow[]> {
    return queryLocal(
      `SELECT x.upgrade_id AS option_id, ${USAGE_SELECT.replace('%TABLE%', 'unit_upgrade_options')}`,
      [],
      mapUsageRow,
    )
  },

  /** Borra una opción de unidad. El ON DELETE CASCADE la quita de todas las unidades y de las incompatibilidades. */
  async remove(id: number): Promise<void> {
    const name = await nameOf('upgrades', id)
    await execCatalog('DELETE FROM upgrades WHERE id = ?', [id])
    await ChangeLogRepository.record('opcion', 'borrar', `Borró la opción de unidad "${name}"`, id)
  },

  /**
   * Todos los pares de mejoras/opciones de unidad incompatibles entre sí
   * (p.ej. las runas de los Golems: solo se puede llevar una) — análogo a
   * EquipmentRepository.listIncompatibilities. Tabla pequeña, se trae entera
   * de una vez para validar localmente sin ir y volver a la BBDD.
   */
  async listIncompatibilities(): Promise<Array<[number, number]>> {
    return queryLocal<[number, number]>(
      'SELECT upgrade_id_a, upgrade_id_b FROM upgrade_incompatibilities',
      [],
      (row) => [row.upgrade_id_a as number, row.upgrade_id_b as number],
    )
  },
}

// Los perfiles reutilizables con nombre propio (monturas y carros) tienen su
// propio repositorio con CRUD completo + facciones asociadas — ver
// profileCatalogRepository.ts (MountRepository / ChariotRepository).

export const CommandRoleRepository = {
  async listAll(): Promise<CommandRole[]> {
    return queryLocal(
      'SELECT * FROM command_roles ORDER BY id',
      [],
      (row) => ({ id: row.id as number, code: row.code as CommandRole['code'], name: row.name as string }),
    )
  },
}
