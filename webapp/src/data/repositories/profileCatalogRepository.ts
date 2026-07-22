// ============================================================================
// Catálogos "Monturas" y "Carros" (Administración): perfiles de atributos
// reutilizables con nombre propio (profile_kind IN ('montura','carro')) más
// las facciones que pueden elegirlos (profile_factions). Ambos catálogos
// tienen exactamente la misma forma — una ficha de 9 atributos + una lista
// de facciones asociadas — así que se genera una única fábrica en vez de
// duplicar el mismo CRUD dos veces (DRY).
//
// Una unidad solo puede añadir a su ficha (unit_profiles) una montura/carro
// asociado a su propia facción: `listForFaction` es lo que usa
// UnitDetailPage para filtrar las opciones ofrecidas en el RelationEditor.
// ============================================================================
import { execCatalog, execCatalogBatch } from '@/data/sqlite/client'
import { queryLocal, queryLocalOne } from '@/data/sqlite/localCatalog'
import { ChangeLogRepository } from '@/data/repositories/changeLogRepository'
import { mapAttributeProfileRow } from '@/data/repositories/mappers'
import type { AttributeProfile, SpecialRule, UnitProfileRole } from '@/domain/types'

export interface ProfileCatalogEntry {
  profile: AttributeProfile
  factionIds: number[]
  /**
   * Reglas especiales propias de la ficha (ver profile_special_rules). En la
   * práctica solo se usan en el catálogo "Montura/Dotación", donde están los
   * monstruos: son SUYAS, y se suman a las del jinete al pintar cualquier
   * unidad que los lleve, pero solo cuando esa montura se elige de verdad
   * (ver UnitDetail.specialRules). En "Carros" la
   * lista llega siempre vacía porque su pantalla no ofrece editarlas.
   */
  specialRules: SpecialRule[]
}

export interface ProfileCatalogInput {
  name: string
  m: string | null
  ha: string | null
  hp: string | null
  f: string | null
  r: string | null
  h: string | null
  i: string | null
  a: string | null
  l: string | null
  /** Solo se usa en el catálogo de Monturas; los carros lo ignoran (siempre queda a false). */
  equippableByCharacter: boolean
  /** Si aparece como ficha propia en la sección "Fichas". Solo se ofrece en Monturas. */
  includeInSheets: boolean
}

/** Cómo se llama cada catálogo en el registro de cambios. */
const LABEL: Record<Exclude<UnitProfileRole, 'base'>, string> = {
  montura: 'la montura/dotación',
  carro: 'el carro',
}

function createProfileCatalogRepository(kind: Exclude<UnitProfileRole, 'base'>) {
  return {
    /** Todas las fichas del catálogo (con sus facciones asociadas), para la pantalla de Administración. */
    async listAll(): Promise<ProfileCatalogEntry[]> {
      const [profiles, links, ruleLinks] = await Promise.all([
        queryLocal('SELECT * FROM attribute_profiles WHERE profile_kind = ? ORDER BY name', [kind], mapAttributeProfileRow),
        queryLocal<{ profileId: number; factionId: number }>(
          `SELECT pf.profile_id AS profile_id, pf.faction_id AS faction_id
           FROM profile_factions pf
           JOIN attribute_profiles ap ON ap.id = pf.profile_id
           WHERE ap.profile_kind = ?`,
          [kind],
          (row) => ({ profileId: row.profile_id as number, factionId: row.faction_id as number }),
        ),
        queryLocal<{ profileId: number; rule: SpecialRule }>(
          `SELECT psr.profile_id AS profile_id, sr.*
           FROM profile_special_rules psr
           JOIN special_rules sr ON sr.id = psr.rule_id
           JOIN attribute_profiles ap ON ap.id = psr.profile_id
           WHERE ap.profile_kind = ?
           ORDER BY sr.name`,
          [kind],
          (row) => ({
            profileId: row.profile_id as number,
            rule: { id: row.id as number, name: row.name as string, description: (row.description as string) ?? '' },
          }),
        ),
      ])
      const factionsByProfile = new Map<number, number[]>()
      for (const link of links) {
        factionsByProfile.set(link.profileId, [...(factionsByProfile.get(link.profileId) ?? []), link.factionId])
      }
      const rulesByProfile = new Map<number, SpecialRule[]>()
      for (const link of ruleLinks) {
        rulesByProfile.set(link.profileId, [...(rulesByProfile.get(link.profileId) ?? []), link.rule])
      }
      return profiles.map((profile) => ({
        profile,
        factionIds: factionsByProfile.get(profile.id) ?? [],
        specialRules: rulesByProfile.get(profile.id) ?? [],
      }))
    },

    /** Reglas especiales propias de una ficha del catálogo — para su ficha en la sección "Fichas". */
    async listSpecialRules(profileId: number): Promise<SpecialRule[]> {
      return queryLocal(
        `SELECT sr.* FROM special_rules sr
         JOIN profile_special_rules psr ON psr.rule_id = sr.id
         WHERE psr.profile_id = ?
         ORDER BY sr.name`,
        [profileId],
        (row) => ({
          id: row.id as number,
          name: row.name as string,
          description: (row.description as string) ?? '',
        }),
      )
    },

    /**
     * Fichas del catálogo de esta facción marcadas para salir en "Fichas".
     * Es lo que alimenta el grupo "Monturas y dotaciones" de esa sección: el
     * catálogo entero incluye muchas cabalgaduras de tropa que no interesa
     * imprimir por separado, así que se enseñan solo las marcadas.
     */
    async listForSheetsByFaction(factionId: number): Promise<AttributeProfile[]> {
      return queryLocal(
        `SELECT ap.* FROM attribute_profiles ap
         JOIN profile_factions pf ON pf.profile_id = ap.id
         WHERE ap.profile_kind = ? AND pf.faction_id = ? AND ap.include_in_sheets = 1
         ORDER BY ap.name`,
        [kind, factionId],
        mapAttributeProfileRow,
      )
    },

    /** Fichas del catálogo disponibles para una facción concreta — lo que puede añadir una unidad suya. */
    async listForFaction(factionId: number): Promise<AttributeProfile[]> {
      return queryLocal(
        `SELECT ap.* FROM attribute_profiles ap
         JOIN profile_factions pf ON pf.profile_id = ap.id
         WHERE ap.profile_kind = ? AND pf.faction_id = ?
         ORDER BY ap.name`,
        [kind, factionId],
        mapAttributeProfileRow,
      )
    },

    async create(input: ProfileCatalogInput): Promise<number> {
      const id = await execCatalog(
        `INSERT INTO attribute_profiles (name, profile_kind, equippable_by_character, include_in_sheets, m, ha, hp, f, r, h, i, a, l)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.name.trim(),
          kind,
          input.equippableByCharacter ? 1 : 0,
          input.includeInSheets ? 1 : 0,
          input.m,
          input.ha,
          input.hp,
          input.f,
          input.r,
          input.h,
          input.i,
          input.a,
          input.l,
        ],
      )
      await ChangeLogRepository.record(kind, 'crear', `Creó ${LABEL[kind]} "${input.name.trim()}"`, id)
      return id
    },

    async update(id: number, input: ProfileCatalogInput): Promise<void> {
      await execCatalog(
        `UPDATE attribute_profiles SET name = ?, equippable_by_character = ?, include_in_sheets = ?, m = ?, ha = ?, hp = ?, f = ?, r = ?, h = ?, i = ?, a = ?, l = ?
         WHERE id = ?`,
        [
          input.name.trim(),
          input.equippableByCharacter ? 1 : 0,
          input.includeInSheets ? 1 : 0,
          input.m,
          input.ha,
          input.hp,
          input.f,
          input.r,
          input.h,
          input.i,
          input.a,
          input.l,
          id,
        ],
      )
      await ChangeLogRepository.record(kind, 'editar', `Editó ${LABEL[kind]} "${input.name.trim()}"`, id)
    },

    async remove(id: number): Promise<void> {
      // D1 borraría solas las filas hijas por ON DELETE CASCADE, pero la copia
      // local en memoria (sql.js) no fuerza claves foráneas — mismo motivo que
      // en UnitRepository.remove. Se borran explícitamente para que las dos
      // queden iguales sin esperar a una recarga del catálogo.
      const name = await queryLocalOne<string>(
        'SELECT name FROM attribute_profiles WHERE id = ?',
        [id],
        (r) => (r.name as string) ?? `#${id}`,
      )
      await execCatalogBatch([
        { sql: 'DELETE FROM profile_special_rules WHERE profile_id = ?', params: [id] },
        { sql: 'DELETE FROM profile_factions WHERE profile_id = ?', params: [id] },
        { sql: 'DELETE FROM attribute_profiles WHERE id = ?', params: [id] },
      ])
      await ChangeLogRepository.record(kind, 'borrar', `Borró ${LABEL[kind]} "${name ?? `#${id}`}"`, id)
    },

    async addFaction(profileId: number, factionId: number): Promise<void> {
      await execCatalogBatch([
        {
          sql: 'INSERT OR IGNORE INTO profile_factions (profile_id, faction_id) VALUES (?, ?)',
          params: [profileId, factionId],
        },
      ])
    },

    async removeFaction(profileId: number, factionId: number): Promise<void> {
      await execCatalogBatch([
        { sql: 'DELETE FROM profile_factions WHERE profile_id = ? AND faction_id = ?', params: [profileId, factionId] },
      ])
    },

    /**
     * Reescribe de una vez las reglas especiales de la ficha. Se borra y se
     * vuelve a insertar (en vez de calcular altas y bajas) porque son como
     * mucho un puñado de filas y así el estado final es exactamente el que
     * pide el formulario, sin depender de qué había antes.
     */
    async setSpecialRules(profileId: number, ruleIds: number[]): Promise<void> {
      await execCatalogBatch([
        { sql: 'DELETE FROM profile_special_rules WHERE profile_id = ?', params: [profileId] },
        ...ruleIds.map((ruleId) => ({
          sql: 'INSERT OR IGNORE INTO profile_special_rules (profile_id, rule_id) VALUES (?, ?)',
          params: [profileId, ruleId],
        })),
      ])
    },
  }
}

export const MountRepository = createProfileCatalogRepository('montura')
export const ChariotRepository = createProfileCatalogRepository('carro')
