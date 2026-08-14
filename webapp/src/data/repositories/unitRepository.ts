import { execCatalog, execCatalogBatch, type BatchStatement } from '@/data/sqlite/client'
import { queryLocal, queryLocalOne } from '@/data/sqlite/localCatalog'
import {
  mapAttributeProfileRow,
  mapEquipmentOptionRow,
  mapUpgradeRow,
  UPGRADE_SELECT_COLUMNS,
} from '@/data/repositories/mappers'
import { FactionRepository } from '@/data/repositories/factionRepository'
import { ChangeLogRepository } from '@/data/repositories/changeLogRepository'
import type {
  AttributeProfile,
  AttributeProfileInput,
  CommandRole,
  EquipmentOption,
  SpecialRule,
  Unit,
  UnitCategory,
  UnitDetail,
  UnitProfileRole,
  UnitTypeTag,
  Upgrade,
} from '@/domain/types'

// Dentro de la categoría "Personajes" (unit_categories.code = 'PERSONAJE') el
// orden lo decide el COSTE, DE MAYOR A MENOR, no `sort_order`: a petición del
// usuario, los personajes de una facción se listan siempre por puntos y con
// los caros arriba (Señor de la Guerra antes que Vidente Gris), sin que nadie
// tenga que reordenarlos a mano — por eso además la UI de arrastrar y soltar
// (ver UnitsListPage.tsx) no se ofrece para esa categoría. El resto de
// categorías siguen usando `sort_order`, que sí es arrastrable.
//
// El descendente se consigue NEGANDO el coste en vez de con un DESC. La
// expresión es una sola y la comparten personajes (coste) y el resto
// (sort_order); un DESC se los llevaría a los dos por delante y pondría las
// demás categorías del revés.
const PERSONAJE_ORDER_EXPR = `CASE WHEN c.code = 'PERSONAJE' THEN -u.base_cost ELSE u.sort_order END`

/**
 * «la unidad "Guerreros" (Enanos)» — cómo se nombra una unidad en el registro
 * de cambios. Lleva la facción porque hay nombres que se repiten entre
 * facciones ("Guerreros", "Arqueros"), y sin ella el registro no distingue
 * cuál de las dos se tocó.
 */
async function unitLabel(unitId: number): Promise<string> {
  const row = await queryLocalOne<{ name: string; faction: string }>(
    `SELECT u.name AS name, f.name AS faction FROM units u JOIN factions f ON f.id = u.faction_id WHERE u.id = ?`,
    [unitId],
    (r) => ({ name: r.name as string, faction: r.faction as string }),
  )
  return row ? `la unidad "${row.name}" (${row.faction})` : `la unidad #${unitId}`
}

function mapUnit(row: Record<string, unknown>): Unit {
  const unitType = row.unit_type as Unit['unitType']
  return {
    id: row.id as number,
    factionId: row.faction_id as number,
    categoryId: (row.category_id as number) ?? null,
    typeTagId: (row.type_tag_id as number) ?? null,
    unitType,
    name: row.name as string,
    baseCost: row.base_cost as number,
    minSize: (row.min_size as number) ?? null,
    maxSize: (row.max_size as number) ?? null,
    defaultSize: (row.default_size as number) ?? null,
    // "0-1" es un concepto de TROPAS. Un personaje nunca es 0-1: puede
    // repetirse en la lista tantas veces como permita la organización del
    // ejército, y su ficha ni siquiera ofrece la casilla (ver
    // UnitDetailPage). Se fuerza a false aquí, en el único punto por el que
    // entra una unidad a la aplicación, para que ni un dato antiguo ni un
    // "0-1" leído de un libro al importar puedan colar el distintivo en
    // pantalla ni bloquear el añadir un segundo personaje igual. La columna
    // is_unique de los personajes se limpia además en la propia D1 (ver
    // MIGRATIONS en el Worker).
    isUnique: unitType === 'personaje' ? false : Boolean(row.is_unique),
    equipmentText: (row.equipment_text as string) ?? null,
    armorSave: (row.armor_save as number) ?? null,
    notes: (row.notes as string) ?? null,
    sortOrder: row.sort_order as number,
    // La columna `active` puede no venir todavía si la D1 no se ha migrado
    // (ver worker MIGRATIONS): en ese caso se asume activa.
    active: row.active == null ? true : Boolean(row.active),
    // Marca de hechicero. La columna puede no existir todavía si la D1 no se
    // ha migrado: en ese caso, no es hechicera.
    isWizard: Boolean(row.is_wizard),
  }
}

export interface UnitSummary extends Unit {
  factionName: string
  categoryName: string | null
}

export interface UnitScalarInput {
  name: string
  categoryId: number | null
  typeTagId: number | null
  baseCost: number
  minSize: number | null
  maxSize: number | null
  defaultSize: number | null
  isUnique: boolean
  equipmentText: string | null
  armorSave: number | null
  notes: string | null
  /** Si lanza hechizos. Solo se ofrece en personajes (ver UnitDetailPage). */
  isWizard: boolean
}

/** Datos mínimos para dar de alta una unidad desde cero; el resto (equipo, reglas, perfil...) se completa luego en su ficha. */
export interface UnitCreateInput {
  factionId: number
  name: string
  unitType: Unit['unitType']
  categoryId: number | null
}

/** Qué cambiar respecto al original al copiar una unidad — ver UnitRepository.duplicate. */
export interface UnitDuplicateOverrides {
  /** Facción de destino; por defecto, la misma del original. */
  factionId?: number
  /** Nombre de la copia; por defecto, el del original con " (copia)". */
  name?: string
  /** Categoría de la copia; por defecto, la del original. */
  categoryId?: number | null
}

/** Nombre de tabla/columnas de cada tipo de relación N:M simple de una unidad, para el toggler genérico. */
const RELATION_TABLES = {
  specialRule: { table: 'unit_special_rules', otherCol: 'rule_id' },
  equipment: { table: 'unit_equipment_options', otherCol: 'equipment_id' },
  upgrade: { table: 'unit_upgrade_options', otherCol: 'upgrade_id' },
} as const

export type UnitRelationKind = keyof typeof RELATION_TABLES

/**
 * Todos los cambios pendientes de la ficha de una unidad (ver
 * UnitDetailPage): campos escalares, las tres relaciones N:M simples,
 * perfiles de montura/carro asignados, nombres propios del grupo de mando y
 * estadísticas de las fichas de atributos editables (perfil base + Campeón).
 * Se aplican todos juntos en `saveUnitDetail` al pulsar "Guardar cambios",
 * en vez de persistir cada toggle/tecleo por separado.
 */
export interface UnitBatchSaveInput {
  scalar: UnitScalarInput
  specialRuleIds: number[]
  equipmentIds: number[]
  upgradeIds: number[]
  /** Subconjunto de equipmentIds que debe venir ya marcado al añadir esta unidad a una lista (ver unit_equipment_options.is_default). */
  defaultEquipmentIds: number[]
  /** Subconjunto de upgradeIds que debe venir ya marcado al añadir esta unidad a una lista (ver unit_upgrade_options.is_default). */
  defaultUpgradeIds: number[]
  mountProfileIds: number[]
  chariotProfileIds: number[]
  /** profile_id -> coste extra en puntos por llevar esa montura (ver unit_profiles.cost); null/ausente = sin coste. Solo se usa para los ids presentes en mountProfileIds. */
  mountProfileCosts: Record<number, number | null>
  /** Igual que mountProfileCosts, para chariotProfileIds. */
  chariotProfileCosts: Record<number, number | null>
  /** command_role_id -> nombre propio (null = usar el nombre genérico del rol). */
  championNames: Record<number, string | null>
  /** command_role_id -> coste en puntos de esa opción de grupo de mando (Músico/Portaestandarte/Campeón). */
  commandCosts: Record<number, number>
  /** attribute_profile_id -> estadísticas nuevas. */
  profileStats: Record<number, AttributeProfileInput>
}

/**
 * El UPDATE de los campos escalares de una unidad, en UN solo sitio.
 *
 * Estaba escrito por duplicado —en `updateScalarFields` y dentro de
 * `saveUnitDetail`— y al añadir `is_wizard` se actualizó la sentencia de los
 * dos pero la lista de parámetros de uno solo: trece interrogantes y doce
 * valores, con lo que el id se colaba en `is_wizard`, el WHERE se quedaba
 * vacío y guardar dejó de funcionar. Con una única definición ese fallo no
 * puede repetirse.
 */
function scalarUpdateStatement(unitId: number, scalar: UnitScalarInput): BatchStatement {
  return {
    sql: `UPDATE units
             SET name = ?, category_id = ?, type_tag_id = ?, base_cost = ?, min_size = ?, max_size = ?,
                 default_size = ?, is_unique = ?, equipment_text = ?, armor_save = ?, notes = ?, is_wizard = ?
           WHERE id = ?`,
    params: [
      scalar.name,
      scalar.categoryId,
      scalar.typeTagId,
      scalar.baseCost,
      scalar.minSize,
      scalar.maxSize,
      scalar.defaultSize,
      scalar.isUnique ? 1 : 0,
      scalar.equipmentText,
      scalar.armorSave,
      scalar.notes,
      scalar.isWizard ? 1 : 0,
      unitId,
    ],
  }
}

export const UnitRepository = {
  async listByFaction(factionId: number): Promise<UnitSummary[]> {
    return queryLocal(
      `SELECT u.*, f.name AS faction_name, c.name AS category_name
       FROM units u
       JOIN factions f ON f.id = u.faction_id
       LEFT JOIN unit_categories c ON c.id = u.category_id
       WHERE u.faction_id = ?
       ORDER BY c.sort_order, ${PERSONAJE_ORDER_EXPR}, u.name`,
      [factionId],
      (row) => ({
        ...mapUnit(row),
        factionName: row.faction_name as string,
        categoryName: (row.category_name as string) ?? null,
      }),
    )
  },

  /**
   * Todas las unidades de todas las facciones, ordenadas por facción y
   * categoría — usado por el constructor de listas ("Ejércitos"), que
   * permite combinar unidades de cualquier facción en una misma lista (a
   * diferencia de la ficha de unidad, que sí restringe monturas/carros a la
   * facción propia — ver 8quater en ARCHITECTURE.md).
   */
  async listAll(): Promise<UnitSummary[]> {
    return queryLocal(
      `SELECT u.*, f.name AS faction_name, c.name AS category_name
       FROM units u
       JOIN factions f ON f.id = u.faction_id
       LEFT JOIN unit_categories c ON c.id = u.category_id
       ORDER BY f.sort_order, f.name, c.sort_order, ${PERSONAJE_ORDER_EXPR}, u.name`,
      [],
      (row) => ({
        ...mapUnit(row),
        factionName: row.faction_name as string,
        categoryName: (row.category_name as string) ?? null,
      }),
    )
  },

  async search(text: string): Promise<UnitSummary[]> {
    const like = `%${text.trim()}%`
    return queryLocal(
      `SELECT u.*, f.name AS faction_name, c.name AS category_name
       FROM units u
       JOIN factions f ON f.id = u.faction_id
       LEFT JOIN unit_categories c ON c.id = u.category_id
       WHERE u.name LIKE ?
       ORDER BY f.name, u.name
       LIMIT 50`,
      [like],
      (row) => ({
        ...mapUnit(row),
        factionName: row.faction_name as string,
        categoryName: (row.category_name as string) ?? null,
      }),
    )
  },

  async getDetailById(id: number): Promise<UnitDetail | null> {
    // La ficha de unidad se reconstruye a partir de 7 consultas. Solo dos
    // dependen de datos que devuelve la query de `units` (faction_id y
    // category_id); las otras cinco (perfiles, reglas, equipo, mejoras,
    // opciones de mando) solo necesitan el `id` de la unidad, que ya se
    // conoce desde el principio — así que se lanzan todas en paralelo junto
    // con la propia query de `units` en vez de una detrás de otra. Al ir
    // todas contra la copia local en memoria (queryLocal/queryLocalOne), el
    // "paralelismo" ya no ahorra latencia de red, pero se mantiene por
    // claridad y porque no tiene coste.
    const [
      unit,
      linkedProfiles,
      specialRules,
      profileRuleLinks,
      equipmentOptions,
      equipmentExclusivePairs,
      upgradeOptions,
      commandOptions,
    ] = await Promise.all([
      queryLocalOne('SELECT * FROM units WHERE id = ?', [id], mapUnit),
      // Una unidad puede tener varios perfiles de atributos a la vez (base,
      // montura, carro...). Se cargan todos de una vez y se agrupan por rol.
      queryLocal<{ role: UnitProfileRole; cost: number | null; profile: AttributeProfile }>(
        `SELECT up.role AS role, up.cost AS mount_cost, ap.*
         FROM unit_profiles up
         JOIN attribute_profiles ap ON ap.id = up.profile_id
         WHERE up.unit_id = ?
         ORDER BY up.role, up.sort_order, ap.name`,
        [id],
        (row) => ({
          role: row.role as UnitProfileRole,
          cost: (row.mount_cost as number) ?? null,
          profile: mapAttributeProfileRow(row),
        }),
      ),
      queryLocal<SpecialRule>(
        `SELECT sr.* FROM special_rules sr
         JOIN unit_special_rules usr ON usr.rule_id = sr.id
         WHERE usr.unit_id = ? ORDER BY sr.name`,
        [id],
        (row) => ({ id: row.id as number, name: row.name as string, description: (row.description as string) ?? '' }),
      ),
      // Reglas propias de las monturas/monstruos de esta unidad, en una sola
      // consulta para todos sus perfiles (se agrupan luego por profile_id).
      queryLocal<{ profileId: number; rule: SpecialRule }>(
        `SELECT psr.profile_id AS profile_id, sr.*
         FROM special_rules sr
         JOIN profile_special_rules psr ON psr.rule_id = sr.id
         JOIN unit_profiles up ON up.profile_id = psr.profile_id
         WHERE up.unit_id = ?
         ORDER BY sr.name`,
        [id],
        (row) => ({
          profileId: row.profile_id as number,
          rule: { id: row.id as number, name: row.name as string, description: (row.description as string) ?? '' },
        }),
      ),
      queryLocal<EquipmentOption & { isDefault: boolean }>(
        `SELECT eo.*, ueo.is_default AS is_default FROM equipment_options eo
         JOIN unit_equipment_options ueo ON ueo.equipment_id = eo.id
         WHERE ueo.unit_id = ? ORDER BY eo.name`,
        [id],
        (row) => ({ ...mapEquipmentOptionRow(row), isDefault: Boolean(row.is_default) }),
      ),
      // Solo las parejas cuyas DOS opciones ofrece esta unidad: una
      // incompatibilidad con algo que la unidad no puede llevar no dice nada
      // aquí.
      queryLocal<[number, number]>(
        `SELECT ei.equipment_id_a AS a, ei.equipment_id_b AS b
         FROM equipment_incompatibilities ei
         WHERE ei.equipment_id_a IN (SELECT equipment_id FROM unit_equipment_options WHERE unit_id = ?)
           AND ei.equipment_id_b IN (SELECT equipment_id FROM unit_equipment_options WHERE unit_id = ?)`,
        [id, id],
        (row) => [row.a as number, row.b as number],
      ),
      queryLocal<Upgrade & { isDefault: boolean }>(
        `SELECT ${UPGRADE_SELECT_COLUMNS}, uuo.is_default AS is_default
         FROM upgrades up
         LEFT JOIN attribute_profiles ap ON ap.id = up.profile_id
         JOIN unit_upgrade_options uuo ON uuo.upgrade_id = up.id
         WHERE uuo.unit_id = ? ORDER BY up.name`,
        [id],
        (row) => ({ ...mapUpgradeRow(row), isDefault: Boolean(row.is_default) }),
      ),
      queryLocal<UnitDetail['commandOptions'][number]>(
        `SELECT cr.id AS role_id, cr.code AS role_code, cr.name AS role_name, uco.cost AS cost,
                uco.custom_name AS custom_name, ap.id AS profile_id, ap.*
         FROM unit_command_options uco
         JOIN command_roles cr ON cr.id = uco.command_role_id
         LEFT JOIN attribute_profiles ap ON ap.id = uco.profile_id
         WHERE uco.unit_id = ? ORDER BY cr.id`,
        [id],
        (row) => ({
          role: {
            id: row.role_id as number,
            code: row.role_code as CommandRole['code'],
            name: row.role_name as string,
          },
          cost: row.cost as number,
          customName: (row.custom_name as string) ?? null,
          profile: row.profile_id != null ? mapAttributeProfileRow(row) : null,
        }),
      ),
    ])
    if (!unit) return null

    // Estas tres sí dependen del resultado de `unit` (faction_id/category_id/
    // type_tag_id), pero no dependen la una de la otra: se lanzan juntas.
    const [faction, category, typeTag] = await Promise.all([
      FactionRepository.getById(unit.factionId),
      unit.categoryId
        ? queryLocalOne<UnitCategory>('SELECT * FROM unit_categories WHERE id = ?', [unit.categoryId], (row) => ({
            id: row.id as number,
            code: row.code as string,
            name: row.name as string,
            sortOrder: row.sort_order as number,
          }))
        : Promise.resolve(null),
      unit.typeTagId
        ? queryLocalOne<UnitTypeTag>('SELECT * FROM unit_type_tags WHERE id = ?', [unit.typeTagId], (row) => ({
            id: row.id as number,
            code: row.code as string,
            name: row.name as string,
            sortOrder: row.sort_order as number,
          }))
        : Promise.resolve(null),
    ])
    if (!faction) return null

    const rulesByProfile = new Map<number, SpecialRule[]>()
    for (const link of profileRuleLinks) {
      rulesByProfile.set(link.profileId, [...(rulesByProfile.get(link.profileId) ?? []), link.rule])
    }

    const profiles = {
      base: linkedProfiles.find((p) => p.role === 'base')?.profile ?? null,
      montura: linkedProfiles
        .filter((p) => p.role === 'montura')
        .map((p) => ({ ...p.profile, cost: p.cost, specialRules: rulesByProfile.get(p.profile.id) ?? [] })),
      // El carro lleva sus propias reglas igual que la montura: son la misma
      // tabla (profile_special_rules) y el mismo concepto — reglas del
      // vehículo/bestia, no de quien lo tripula.
      carro: linkedProfiles
        .filter((p) => p.role === 'carro')
        .map((p) => ({ ...p.profile, cost: p.cost, specialRules: rulesByProfile.get(p.profile.id) ?? [] })),
    }

    return {
      ...unit,
      faction,
      category,
      typeTag,
      profiles,
      specialRules,
      equipmentOptions,
      equipmentExclusivePairs,
      upgradeOptions,
      commandOptions,
    }
  },

  /**
   * Aplica un nuevo orden manual (arrastrar y soltar, ver UnitsListPage.tsx)
   * a las unidades de una categoría: `orderedUnitIds` ya viene en el orden
   * final deseado, se persiste como 0,1,2... en `sort_order`. No tiene
   * sentido llamarla para la categoría "Personajes" (se ordenan por coste,
   * ver PERSONAJE_ORDER_EXPR, de mayor a menor) — la UI ya no ofrece
   * arrastrar ahí.
   */
  async reorderWithinCategory(orderedUnitIds: number[]): Promise<void> {
    await execCatalogBatch(
      orderedUnitIds.map((id, index) => ({ sql: 'UPDATE units SET sort_order = ? WHERE id = ?', params: [index, id] })),
    )
  },

  /**
   * Borra una unidad (o personaje) por completo. Aunque el esquema tiene
   * ON DELETE CASCADE en todas las tablas hijas de `units`, aquí se borran
   * también explícitamente las de CATÁLOGO (perfiles, reglas, equipo, mejoras
   * y opciones de mando de la unidad) para que la copia local en memoria
   * (sql.js, que no fuerza claves foráneas) quede igual de consistente que D1
   * sin esperar a una recarga — ver execCatalogBatch/applyLocalWrite. Las
   * tablas NO de catálogo (unit_sheets y las entradas de listas de ejército
   * que usaran la unidad) las limpia el propio CASCADE de D1.
   */
  async remove(unitId: number): Promise<void> {
    // El nombre se lee antes de borrar; después ya no existe (ver el mismo
    // criterio en FactionRepository.remove). Si la unidad ya no está, se sale
    // sin registrar: una llamada repetida no debe dejar un borrado fantasma.
    const exists = await queryLocalOne('SELECT id FROM units WHERE id = ?', [unitId], (r) => r.id as number)
    if (!exists) return
    const label = await unitLabel(unitId)
    await execCatalogBatch([
      { sql: 'DELETE FROM unit_profiles WHERE unit_id = ?', params: [unitId] },
      { sql: 'DELETE FROM unit_special_rules WHERE unit_id = ?', params: [unitId] },
      { sql: 'DELETE FROM unit_equipment_options WHERE unit_id = ?', params: [unitId] },
      { sql: 'DELETE FROM unit_upgrade_options WHERE unit_id = ?', params: [unitId] },
      { sql: 'DELETE FROM unit_command_options WHERE unit_id = ?', params: [unitId] },
      { sql: 'DELETE FROM units WHERE id = ?', params: [unitId] },
    ])
    await ChangeLogRepository.record('unidad', 'borrar', `Borró ${label}`, unitId)
  },

  /**
   * Duplica una unidad completa dentro de su misma facción, con el nombre
   * seguido de " (copia)". Devuelve el id de la nueva.
   *
   * Qué se copia y qué se comparte:
   * - El perfil BASE y la ficha del Campeón son PROPIOS de la unidad, así que
   *   se duplican de verdad (filas nuevas en attribute_profiles). Si se
   *   reutilizaran, editar la copia cambiaría también el original.
   * - Las monturas/carros vienen del catálogo compartido, así que la copia
   *   simplemente enlaza los MISMOS perfiles (con su coste).
   * - Reglas especiales, equipo y opciones se enlazan igual (conservando cuáles
   *   venían marcadas "por defecto").
   * - La presentación de la ficha (ilustración, escudo…) NO se copia: la unidad
   *   nueva empieza en blanco.
   *
   * Con `overrides` sirve además de "crear desde": copiar una unidad de OTRA
   * facción a la actual, con su nombre y categoría propios (ver
   * UnitFormModal). En ese caso las monturas/carros enlazados son los del
   * original, que pueden no estar asociados a la facción de destino — se
   * copian igualmente (es una copia completa, que es lo que se pide) y se
   * quitan a mano desde la ficha si sobran.
   */
  async duplicate(unitId: number, overrides: UnitDuplicateOverrides = {}): Promise<number> {
    const source = await UnitRepository.getDetailById(unitId)
    if (!source) throw new Error('No se encontró la unidad que se quiere copiar.')

    const factionId = overrides.factionId ?? source.factionId
    const categoryId = overrides.categoryId !== undefined ? overrides.categoryId : source.categoryId
    const name = overrides.name?.trim() || `${source.name} (copia)`

    const newUnitId = await execCatalog(
      `INSERT INTO units
         (faction_id, category_id, type_tag_id, unit_type, name, base_cost, min_size, max_size,
          default_size, is_unique, equipment_text, armor_save, notes, sort_order, active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,
               (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM units WHERE faction_id = ?), ?)`,
      [
        factionId,
        categoryId,
        source.typeTagId,
        source.unitType,
        name,
        source.baseCost,
        source.minSize,
        source.maxSize,
        source.defaultSize,
        source.isUnique ? 1 : 0,
        source.equipmentText,
        source.armorSave,
        source.notes,
        factionId,
        source.active ? 1 : 0,
      ],
    )

    // Perfil base: copia propia, no referencia compartida.
    if (source.profiles.base) {
      const p = source.profiles.base
      const newProfileId = await execCatalog(
        `INSERT INTO attribute_profiles (name, profile_kind, m, ha, hp, f, r, h, i, a, l)
         VALUES (?, 'unidad', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.name, p.m, p.ha, p.hp, p.f, p.r, p.h, p.i, p.a, p.l],
      )
      await execCatalog("INSERT INTO unit_profiles (unit_id, profile_id, role, sort_order) VALUES (?, ?, 'base', 0)", [
        newUnitId,
        newProfileId,
      ])
    }

    const statements: BatchStatement[] = []
    for (const p of source.profiles.montura) {
      statements.push({
        sql: "INSERT OR IGNORE INTO unit_profiles (unit_id, profile_id, role, sort_order, cost) VALUES (?, ?, 'montura', 0, ?)",
        params: [newUnitId, p.id, p.cost],
      })
    }
    for (const p of source.profiles.carro) {
      statements.push({
        sql: "INSERT OR IGNORE INTO unit_profiles (unit_id, profile_id, role, sort_order, cost) VALUES (?, ?, 'carro', 0, ?)",
        params: [newUnitId, p.id, p.cost],
      })
    }
    for (const r of source.specialRules) {
      statements.push({
        sql: 'INSERT OR IGNORE INTO unit_special_rules (unit_id, rule_id) VALUES (?, ?)',
        params: [newUnitId, r.id],
      })
    }
    for (const e of source.equipmentOptions) {
      statements.push({
        sql: 'INSERT OR IGNORE INTO unit_equipment_options (unit_id, equipment_id, is_default) VALUES (?, ?, ?)',
        params: [newUnitId, e.id, e.isDefault ? 1 : 0],
      })
    }
    for (const u of source.upgradeOptions) {
      statements.push({
        sql: 'INSERT OR IGNORE INTO unit_upgrade_options (unit_id, upgrade_id, is_default) VALUES (?, ?, ?)',
        params: [newUnitId, u.id, u.isDefault ? 1 : 0],
      })
    }
    // En trozos, para no superar el límite de sentencias por lote del Worker.
    const CHUNK = 45
    for (let i = 0; i < statements.length; i += CHUNK) {
      await execCatalogBatch(statements.slice(i, i + CHUNK))
    }

    // Grupo de mando: la ficha del Campeón también se duplica.
    for (const c of source.commandOptions) {
      let profileId: number | null = null
      if (c.profile) {
        const p = c.profile
        profileId = await execCatalog(
          `INSERT INTO attribute_profiles (name, profile_kind, m, ha, hp, f, r, h, i, a, l)
           VALUES (?, 'unidad', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.name, p.m, p.ha, p.hp, p.f, p.r, p.h, p.i, p.a, p.l],
        )
      }
      await execCatalog(
        'INSERT OR IGNORE INTO unit_command_options (unit_id, command_role_id, cost, custom_name, profile_id) VALUES (?, ?, ?, ?, ?)',
        [newUnitId, c.role.id, c.cost, c.customName, profileId],
      )
    }

    await ChangeLogRepository.record(
      'unidad',
      'crear',
      `Creó ${await unitLabel(newUnitId)} copiando ${await unitLabel(unitId)}`,
      newUnitId,
    )
    return newUnitId
  },

  /** Activa o desactiva una unidad: las desactivadas no se ofrecen al montar ejércitos (ver units.active), pero siguen editándose en Administración. */
  async setActive(unitId: number, active: boolean): Promise<void> {
    await execCatalog('UPDATE units SET active = ? WHERE id = ?', [active ? 1 : 0, unitId])
    await ChangeLogRepository.record(
      'unidad',
      'editar',
      `${active ? 'Activó' : 'Desactivó'} ${await unitLabel(unitId)}`,
      unitId,
    )
  },

  /** Da de alta una unidad nueva "en blanco" en una facción. Devuelve su id para navegar directamente a su ficha. */
  async create(input: UnitCreateInput): Promise<number> {
    const id = await execCatalog(
      `INSERT INTO units (faction_id, category_id, unit_type, name, base_cost, sort_order)
       VALUES (?, ?, ?, ?, 0, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM units WHERE faction_id = ?))`,
      [input.factionId, input.categoryId, input.unitType, input.name.trim(), input.factionId],
    )
    await ChangeLogRepository.record('unidad', 'crear', `Creó ${await unitLabel(id)}`, id)
    return id
  },

  /**
   * Crea una ficha de atributos en blanco (las 9 características a NULL) y
   * la asocia como perfil "base" de la unidad — necesario porque una unidad
   * recién creada desde cero no trae ninguna. Se edita después con
   * `updateProfileStats`, igual que la ficha del Campeón.
   */
  async createBaseProfile(unitId: number): Promise<AttributeProfile> {
    const blank = { m: null, ha: null, hp: null, f: null, r: null, h: null, i: null, a: null, l: null }
    const profileId = await execCatalog(
      "INSERT INTO attribute_profiles (name, profile_kind, m, ha, hp, f, r, h, i, a, l) VALUES (NULL, 'unidad', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
    )
    await execCatalog('INSERT INTO unit_profiles (unit_id, profile_id, role, sort_order) VALUES (?, ?, ?, 0)', [
      unitId,
      profileId,
      'base',
    ])
    return { id: profileId, name: null, equippableByCharacter: false, includeInSheets: false, ...blank }
  },

  async updateScalarFields(id: number, input: UnitScalarInput): Promise<void> {
    const { sql, params } = scalarUpdateStatement(id, input)
    await execCatalog(sql, params)
  },

  /** Edita las 9 características de un perfil de atributos ya existente (p.ej. la ficha propia del Campeón). */
  async updateProfileStats(profileId: number, input: AttributeProfileInput): Promise<void> {
    await execCatalog(
      `UPDATE attribute_profiles SET m = ?, ha = ?, hp = ?, f = ?, r = ?, h = ?, i = ?, a = ?, l = ? WHERE id = ?`,
      [input.m, input.ha, input.hp, input.f, input.r, input.h, input.i, input.a, input.l, profileId],
    )
  },

  /** Activa/desactiva una relación N:M simple de la unidad (regla, equipo o mejora). */
  async toggleRelation(kind: UnitRelationKind, unitId: number, otherId: number, enabled: boolean): Promise<void> {
    const { table, otherCol } = RELATION_TABLES[kind]
    const sql = enabled
      ? `INSERT OR IGNORE INTO ${table} (unit_id, ${otherCol}) VALUES (?, ?)`
      : `DELETE FROM ${table} WHERE unit_id = ? AND ${otherCol} = ?`
    await execCatalogBatch([{ sql, params: [unitId, otherId] }])
  },

  /**
   * Da de alta o de baja un rol del grupo de mando (Músico, Portaestandarte,
   * Campeón) en una unidad.
   *
   * Existe porque una unidad recién creada no tiene NINGUNA opción de mando:
   * sin esto, su ficha no ofrecía forma de añadirlas y el grupo de mando solo
   * podía llegar importando de un libro o copiando otra unidad.
   *
   * Al quitar el Campeón se borra además su ficha de atributos propia
   * (attribute_profiles), que no la comparte nadie más — el ON DELETE SET NULL
   * del esquema solo desengancha la referencia, así que sin este borrado
   * quedaría un perfil huérfano en el catálogo.
   */
  async toggleCommandRole(unitId: number, commandRoleId: number, enabled: boolean): Promise<void> {
    if (enabled) {
      await execCatalogBatch([
        {
          sql: 'INSERT OR IGNORE INTO unit_command_options (unit_id, command_role_id, cost) VALUES (?, ?, 0)',
          params: [unitId, commandRoleId],
        },
      ])
      return
    }
    const profileId = await queryLocalOne<number | null>(
      'SELECT profile_id FROM unit_command_options WHERE unit_id = ? AND command_role_id = ?',
      [unitId, commandRoleId],
      (row) => (row.profile_id as number) ?? null,
    )
    const statements: BatchStatement[] = [
      {
        sql: 'DELETE FROM unit_command_options WHERE unit_id = ? AND command_role_id = ?',
        params: [unitId, commandRoleId],
      },
    ]
    if (profileId) {
      statements.push({ sql: 'DELETE FROM attribute_profiles WHERE id = ?', params: [profileId] })
    }
    await execCatalogBatch(statements)
  },

  /**
   * Crea la ficha de atributos propia del Campeón (en blanco) y la engancha a
   * su opción de mando. Análoga a `createBaseProfile`, pero para el Campeón:
   * al añadirlo desde cero no trae ninguna.
   */
  async createCommandProfile(unitId: number, commandRoleId: number): Promise<AttributeProfile> {
    const blank = { m: null, ha: null, hp: null, f: null, r: null, h: null, i: null, a: null, l: null }
    const profileId = await execCatalog(
      "INSERT INTO attribute_profiles (name, profile_kind, m, ha, hp, f, r, h, i, a, l) VALUES (NULL, 'unidad', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)",
    )
    await execCatalog('UPDATE unit_command_options SET profile_id = ? WHERE unit_id = ? AND command_role_id = ?', [
      profileId,
      unitId,
      commandRoleId,
    ])
    return { id: profileId, name: null, equippableByCharacter: false, includeInSheets: false, ...blank }
  },

  /**
   * Cambia el nombre propio de una opción de mando de la unidad (p. ej. que
   * el Campeón de una unidad concreta se llame "Capitán de la guardia" en
   * vez de "Campeón"). `null`/cadena vacía vuelve a usar el nombre genérico
   * del rol (command_roles.name — "Campeón" por defecto).
   */
  async updateCommandCustomName(unitId: number, commandRoleId: number, customName: string | null): Promise<void> {
    await execCatalog('UPDATE unit_command_options SET custom_name = ? WHERE unit_id = ? AND command_role_id = ?', [
      customName && customName.trim() ? customName.trim() : null,
      unitId,
      commandRoleId,
    ])
  },

  /** Añade o quita un perfil de atributos (montura/carro) de una unidad. El perfil 'base' no se gestiona aquí. */
  async toggleProfile(
    unitId: number,
    profileId: number,
    role: Exclude<UnitProfileRole, 'base'>,
    enabled: boolean,
  ): Promise<void> {
    if (enabled) {
      await execCatalogBatch([
        {
          sql: 'INSERT OR IGNORE INTO unit_profiles (unit_id, profile_id, role, sort_order) VALUES (?, ?, ?, 0)',
          params: [unitId, profileId, role],
        },
      ])
    } else {
      await execCatalogBatch([
        {
          sql: 'DELETE FROM unit_profiles WHERE unit_id = ? AND profile_id = ? AND role = ?',
          params: [unitId, profileId, role],
        },
      ])
    }
  },

  /**
   * Aplica de una sola vez TODOS los cambios pendientes de la ficha de una
   * unidad (ver UnitBatchSaveInput) y persiste una única vez al final. Las
   * relaciones N:M (reglas, equipo, mejoras, monturas, carros) se guardan
   * "sustituyendo el conjunto completo" (borrar todas + insertar las
   * seleccionadas) porque el borrador en memoria ya tiene el conjunto final
   * completo, no un diff — es más simple y igual de correcto que calcular
   * altas/bajas una por una.
   */
  async saveUnitDetail(unitId: number, input: UnitBatchSaveInput): Promise<void> {
    const statements: BatchStatement[] = []

    statements.push(scalarUpdateStatement(unitId, input.scalar))

    const relationSets: [UnitRelationKind, number[]][] = [
      ['specialRule', input.specialRuleIds],
      ['equipment', input.equipmentIds],
      ['upgrade', input.upgradeIds],
    ]
    // equipment/upgrade llevan además `is_default` (ver unit_equipment_options/
    // unit_upgrade_options.is_default): qué opciones vienen ya marcadas al
    // añadir esta unidad a una lista — configurable desde Administración.
    // specialRule no tiene esa columna, de ahí el `Partial`.
    const defaultIdsByKind: Partial<Record<UnitRelationKind, Set<number>>> = {
      equipment: new Set(input.defaultEquipmentIds),
      upgrade: new Set(input.defaultUpgradeIds),
    }
    for (const [kind, ids] of relationSets) {
      const { table, otherCol } = RELATION_TABLES[kind]
      statements.push({ sql: `DELETE FROM ${table} WHERE unit_id = ?`, params: [unitId] })
      const defaults = defaultIdsByKind[kind]
      for (const otherId of ids) {
        if (defaults) {
          statements.push({
            sql: `INSERT OR IGNORE INTO ${table} (unit_id, ${otherCol}, is_default) VALUES (?, ?, ?)`,
            params: [unitId, otherId, defaults.has(otherId) ? 1 : 0],
          })
        } else {
          statements.push({
            sql: `INSERT OR IGNORE INTO ${table} (unit_id, ${otherCol}) VALUES (?, ?)`,
            params: [unitId, otherId],
          })
        }
      }
    }

    const profileSets: [Exclude<UnitProfileRole, 'base'>, number[], Record<number, number | null>][] = [
      ['montura', input.mountProfileIds, input.mountProfileCosts],
      ['carro', input.chariotProfileIds, input.chariotProfileCosts],
    ]
    for (const [role, ids, costs] of profileSets) {
      statements.push({ sql: 'DELETE FROM unit_profiles WHERE unit_id = ? AND role = ?', params: [unitId, role] })
      for (const profileId of ids) {
        statements.push({
          sql: 'INSERT OR IGNORE INTO unit_profiles (unit_id, profile_id, role, sort_order, cost) VALUES (?, ?, ?, 0, ?)',
          params: [unitId, profileId, role, costs[profileId] ?? null],
        })
      }
    }

    for (const [roleId, customName] of Object.entries(input.championNames)) {
      statements.push({
        sql: 'UPDATE unit_command_options SET custom_name = ? WHERE unit_id = ? AND command_role_id = ?',
        params: [customName, unitId, Number(roleId)],
      })
    }

    for (const [roleId, cost] of Object.entries(input.commandCosts)) {
      statements.push({
        sql: 'UPDATE unit_command_options SET cost = ? WHERE unit_id = ? AND command_role_id = ?',
        params: [cost, unitId, Number(roleId)],
      })
    }

    for (const [profileId, stats] of Object.entries(input.profileStats)) {
      statements.push({
        sql: `UPDATE attribute_profiles SET m = ?, ha = ?, hp = ?, f = ?, r = ?, h = ?, i = ?, a = ?, l = ? WHERE id = ?`,
        params: [stats.m, stats.ha, stats.hp, stats.f, stats.r, stats.h, stats.i, stats.a, stats.l, Number(profileId)],
      })
    }

    await execCatalogBatch(statements)
    // Una sola entrada por "Guardar cambios", no una por campo tocado: es el
    // gesto que hace el usuario y lo que tiene sentido leer luego en el Log.
    await ChangeLogRepository.record('unidad', 'editar', `Editó ${await unitLabel(unitId)}`, unitId)
  },
}
