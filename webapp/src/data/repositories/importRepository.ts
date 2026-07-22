// ============================================================================
// Importador de unidades desde un "libro de ejército" ya parseado (ver
// features/admin/import/armyBookParser.ts). Empareja cada unidad extraída con
// las existentes de la facción POR NOMBRE, y da de alta o actualiza las que el
// usuario marque — pudiendo elegir además QUÉ campos actualizar de cada una
// (nombre, tamaño, perfil, equipo, opciones, grupo de mando, reglas…), en vez
// de sobrescribir la ficha entera.
//
// Escritura estructurada: crea en el catálogo lo que falte (reglas especiales,
// piezas de equipo, opciones de unidad) y lo enlaza; el grupo de mando incluye
// las opciones (Músico/Portaestandarte/Campeón) con su coste, el nombre propio
// del Campeón y su ficha de atributos. Las monturas se importan como opciones
// de unidad (nombre + coste); su ficha de atributos completa (con stats) queda
// para una iteración posterior.
// ============================================================================
import { execCatalog, execCatalogBatch, type BatchStatement } from '@/data/sqlite/client'
import { UnitRepository } from '@/data/repositories/unitRepository'
import { RuleRepository } from '@/data/repositories/ruleRepository'
import {
  UnitCategoryRepository,
  EquipmentRepository,
  UpgradeRepository,
  CommandRoleRepository,
} from '@/data/repositories/lookupRepositories'
import { EQUIPMENT_ALIASES, UPGRADE_ALIASES, expandName, normalizeName } from '@/domain/catalogAliases'
import type { EquipmentOption, UnitDetail } from '@/domain/types'
import type { ParsedOption, ParsedProfile, ParsedUnit } from '@/features/admin/import/armyBookParser'

/** Qué campos actualizar de cada unidad al importar (el usuario los marca en la interfaz). */
export interface ImportFields {
  name: boolean
  category: boolean
  cost: boolean
  size: boolean
  profile: boolean
  /** Equipo básico (texto) + Tirada de Salvación por armadura. */
  equipText: boolean
  /** Opciones de equipo (armas/armaduras) con coste. */
  equipmentOptions: boolean
  /** Monturas y otras opciones (estirpes/opciones) como opciones de unidad con coste. */
  mountsOptions: boolean
  /** Grupo de mando: opciones (Músico/Portaestandarte/Campeón), nombre del Campeón y su ficha. */
  command: boolean
  rules: boolean
}

export const ALL_FIELDS: ImportFields = {
  name: true,
  category: true,
  cost: true,
  size: true,
  profile: true,
  equipText: true,
  equipmentOptions: true,
  mountsOptions: true,
  command: true,
  rules: true,
}

export interface ImportDiffItem {
  parsed: ParsedUnit
  existingUnitId: number | null
  existingName: string | null
}

const EQUIPMENT_SOURCES = new Set([
  'Armas y armadura',
  'Armas y armaduras',
  'Armas',
  'Armas de proyectiles',
  'Arma de proyectiles',
  'Armadura',
])
const UPGRADE_SOURCES = new Set(['Montura', 'Estirpes', 'Opciones'])

/** Clasifica una pieza de equipo por su nombre en uno de los huecos conocidos (o null si no se reconoce). */
function equipmentCategory(name: string): EquipmentOption['category'] {
  const n = name.toLowerCase()
  if (/escudo/.test(n)) return 'escudo'
  if (/armadura/.test(n)) return 'armadura'
  if (/arco|ballesta|pistola|proyectil|jabalina|honda/.test(n)) return 'arma_dist'
  if (/arma|lanza|hacha|espada|maza|alabarda|mangual|martillo|daga/.test(n)) return 'arma_cac'
  return null
}

function profileToInput(p: ParsedProfile) {
  return { m: p.m, ha: p.ha, hp: p.hp, f: p.f, r: p.r, h: p.h, i: p.i, a: p.a, l: p.l }
}

export const ImportRepository = {
  /** Empareja las unidades parseadas con las existentes de la facción (por nombre) para decidir cuáles son nuevas y cuáles se actualizarían. */
  async planImport(factionId: number, parsedUnits: ParsedUnit[]): Promise<ImportDiffItem[]> {
    const existing = await UnitRepository.listByFaction(factionId)
    const byName = new Map(existing.map((u) => [normalizeName(u.name), u]))
    return parsedUnits.map((parsed) => {
      const match = byName.get(normalizeName(parsed.name))
      return { parsed, existingUnitId: match?.id ?? null, existingName: match?.name ?? null }
    })
  },

  /**
   * Aplica el alta/actualización de las unidades marcadas, actualizando SOLO
   * los campos activados en `fields`. Devuelve el número de nuevas y
   * actualizadas. `onProgress` se llama tras cada unidad para poder mostrar
   * "x / total" (hay varias escrituras por unidad; en catálogos grandes puede
   * tardar unos segundos).
   */
  async applyImport(
    factionId: number,
    items: ImportDiffItem[],
    fields: ImportFields,
    onProgress?: (done: number, total: number) => void,
  ): Promise<{ created: number; updated: number }> {
    const categories = await UnitCategoryRepository.listAll()
    const categoryIdByCode = new Map(categories.map((c) => [c.code, c.id]))
    const rules = await RuleRepository.listAll()
    const ruleIdByName = new Map(rules.map((r) => [normalizeName(r.name), r.id]))
    // Equipo y opciones: además de indexar por nombre, se aplican los
    // renombrados de abreviaturas (2AM → "Dos armas de mano", MdC Nurgle →
    // "Marca de Nurgle"…) sobre lo que YA hubiera en el catálogo, para que no
    // queden abreviaturas y para que lo importado empareje con ello.
    const equipment = await EquipmentRepository.listAll()
    const equipmentIdByName = new Map<string, number>()
    for (const e of equipment) {
      const full = expandName(e.name, EQUIPMENT_ALIASES)
      if (full !== e.name) await execCatalog('UPDATE equipment_options SET name = ? WHERE id = ?', [full, e.id])
      equipmentIdByName.set(normalizeName(full), e.id)
    }
    const upgrades = await UpgradeRepository.listAll()
    const upgradeIdByName = new Map<string, number>()
    for (const u of upgrades) {
      const full = expandName(u.name, UPGRADE_ALIASES)
      if (full !== u.name) await execCatalog('UPDATE upgrades SET name = ? WHERE id = ?', [full, u.id])
      upgradeIdByName.set(normalizeName(full), u.id)
    }
    const commandRoles = await CommandRoleRepository.listAll()
    const roleIdByCode = new Map(commandRoles.map((r) => [r.code, r.id]))

    async function ruleId(name: string): Promise<number> {
      const key = normalizeName(name)
      let id = ruleIdByName.get(key)
      if (id == null) {
        id = await RuleRepository.create({ name, description: '' })
        ruleIdByName.set(key, id)
      }
      return id
    }
    async function equipmentId(opt: ParsedOption): Promise<number> {
      const displayName = expandName(opt.name, EQUIPMENT_ALIASES)
      const key = normalizeName(displayName)
      let id = equipmentIdByName.get(key)
      if (id == null) {
        id = await EquipmentRepository.create({ name: displayName, cost: opt.cost, category: equipmentCategory(displayName) })
        equipmentIdByName.set(key, id)
      }
      return id
    }
    async function upgradeId(opt: ParsedOption): Promise<number> {
      const displayName = expandName(opt.name, UPGRADE_ALIASES)
      const key = normalizeName(displayName)
      let id = upgradeIdByName.get(key)
      if (id == null) {
        id = await execCatalog('INSERT INTO upgrades (name, cost) VALUES (?, ?)', [displayName.trim(), opt.cost])
        upgradeIdByName.set(key, id)
      }
      return id
    }

    let created = 0
    let updated = 0
    let done = 0
    for (const item of items) {
      const p = item.parsed
      const parsedCategoryId = categoryIdByCode.get(p.categoryCode) ?? null

      let unitId = item.existingUnitId
      if (unitId == null) {
        unitId = await UnitRepository.create({ factionId, name: p.name, unitType: p.unitType, categoryId: parsedCategoryId })
        created++
      } else {
        updated++
      }

      const detail = (await UnitRepository.getDetailById(unitId)) as UnitDetail

      // 1) Campos escalares — se mezcla lo parseado (para los campos marcados)
      //    con lo que ya tuviera la unidad (para los NO marcados), para no
      //    pisar datos que el usuario no quería tocar.
      await UnitRepository.updateScalarFields(unitId, {
        name: fields.name ? p.name : detail.name,
        categoryId: fields.category ? parsedCategoryId : detail.categoryId,
        typeTagId: detail.typeTagId,
        baseCost: fields.cost ? p.baseCost ?? 0 : detail.baseCost,
        minSize: fields.size ? p.minSize : detail.minSize,
        maxSize: fields.size ? p.maxSize : detail.maxSize,
        defaultSize: detail.defaultSize,
        isUnique: fields.size ? p.isUnique : detail.isUnique,
        equipmentText: fields.equipText ? p.equipmentText : detail.equipmentText,
        armorSave: fields.equipText ? p.armorSave : detail.armorSave,
        notes: detail.notes,
      })

      // 2) Perfil de atributos base.
      if (fields.profile && p.profile) {
        let profileId = detail.profiles.base?.id ?? null
        if (profileId == null) profileId = (await UnitRepository.createBaseProfile(unitId)).id
        await UnitRepository.updateProfileStats(profileId, profileToInput(p.profile))
      }

      // 3) Opciones de equipo (armas/armaduras): sustituye el conjunto enlazado.
      if (fields.equipmentOptions) {
        const eqOpts = p.options.filter((o) => EQUIPMENT_SOURCES.has(o.source))
        const ids: number[] = []
        for (const o of eqOpts) ids.push(await equipmentId(o))
        const stmts: BatchStatement[] = [{ sql: 'DELETE FROM unit_equipment_options WHERE unit_id = ?', params: [unitId] }]
        for (const id of ids)
          stmts.push({ sql: 'INSERT OR IGNORE INTO unit_equipment_options (unit_id, equipment_id) VALUES (?, ?)', params: [unitId, id] })
        await execCatalogBatch(stmts)
      }

      // 4) Monturas y otras opciones -> opciones de unidad (upgrades).
      if (fields.mountsOptions) {
        const upOpts = p.options.filter((o) => UPGRADE_SOURCES.has(o.source))
        const ids: number[] = []
        for (const o of upOpts) ids.push(await upgradeId(o))
        const stmts: BatchStatement[] = [{ sql: 'DELETE FROM unit_upgrade_options WHERE unit_id = ?', params: [unitId] }]
        for (const id of ids)
          stmts.push({ sql: 'INSERT OR IGNORE INTO unit_upgrade_options (unit_id, upgrade_id) VALUES (?, ?)', params: [unitId, id] })
        await execCatalogBatch(stmts)
      }

      // 5) Grupo de mando: opciones + nombre y ficha del Campeón.
      if (fields.command) {
        await applyCommandGroup(unitId, p, detail, roleIdByCode)
      }

      // 6) Reglas especiales.
      if (fields.rules) {
        const ids: number[] = []
        for (const r of p.specialRules) ids.push(await ruleId(r))
        const stmts: BatchStatement[] = [{ sql: 'DELETE FROM unit_special_rules WHERE unit_id = ?', params: [unitId] }]
        for (const id of ids)
          stmts.push({ sql: 'INSERT OR IGNORE INTO unit_special_rules (unit_id, rule_id) VALUES (?, ?)', params: [unitId, id] })
        await execCatalogBatch(stmts)
      }

      done++
      onProgress?.(done, items.length)
    }

    return { created, updated }
  },
}

/** Escribe las opciones de grupo de mando (Músico/Portaestandarte/Campeón) parseadas, incluyendo el nombre propio del Campeón y su ficha de atributos. */
async function applyCommandGroup(
  unitId: number,
  p: ParsedUnit,
  detail: UnitDetail,
  roleIdByCode: Map<string, number>,
): Promise<void> {
  const cmdOpts = p.options.filter((o) => o.source === 'Grupo de mando')
  if (cmdOpts.length === 0) return

  interface Resolved {
    roleCode: 'MUSICO' | 'PORTAESTANDARTE' | 'CAMPEON'
    cost: number
    customName: string | null
    profile: ParsedProfile | null
  }
  const resolved: Resolved[] = []
  for (const o of cmdOpts) {
    const n = o.name.toLowerCase()
    if (/m[uú]sico/.test(n)) resolved.push({ roleCode: 'MUSICO', cost: o.cost, customName: null, profile: null })
    else if (/portaestandarte|estandarte/.test(n)) resolved.push({ roleCode: 'PORTAESTANDARTE', cost: o.cost, customName: null, profile: null })
    else {
      // Cualquier otra entrada del grupo de mando es el Campeón (con su nombre propio, p.ej. "Paladín del Bosque").
      const customName = /campe[oó]n/.test(n) ? null : o.name
      resolved.push({ roleCode: 'CAMPEON', cost: o.cost, customName, profile: p.championProfile })
    }
  }

  const existingChampion = detail.commandOptions.find((c) => c.role.code === 'CAMPEON')
  for (const r of resolved) {
    const roleId = roleIdByCode.get(r.roleCode)
    if (roleId == null) continue

    let profileId: number | null = null
    if (r.roleCode === 'CAMPEON' && r.profile) {
      // Reutiliza la ficha de campeón existente (si la había) para no dejar
      // perfiles huérfanos al reimportar; si no, crea una nueva.
      profileId = existingChampion?.profile?.id ?? null
      const stats = r.profile
      if (profileId == null) {
        profileId = await execCatalog(
          `INSERT INTO attribute_profiles (name, profile_kind, m, ha, hp, f, r, h, i, a, l)
           VALUES (NULL, 'unidad', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [stats.m, stats.ha, stats.hp, stats.f, stats.r, stats.h, stats.i, stats.a, stats.l],
        )
      } else {
        await execCatalog(
          'UPDATE attribute_profiles SET m = ?, ha = ?, hp = ?, f = ?, r = ?, h = ?, i = ?, a = ?, l = ? WHERE id = ?',
          [stats.m, stats.ha, stats.hp, stats.f, stats.r, stats.h, stats.i, stats.a, stats.l, profileId],
        )
      }
    }

    await execCatalog(
      `INSERT INTO unit_command_options (unit_id, command_role_id, cost, custom_name, profile_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(unit_id, command_role_id)
       DO UPDATE SET cost = excluded.cost, custom_name = excluded.custom_name, profile_id = COALESCE(excluded.profile_id, unit_command_options.profile_id)`,
      [unitId, roleId, r.cost, r.customName, profileId],
    )
  }
}
