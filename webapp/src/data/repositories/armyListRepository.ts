// ============================================================================
// Constructor de listas ("Ejércitos"): CRUD de listas guardadas y de sus
// entradas. Cada entrada lleva la unidad completa resuelta (UnitDetail) —
// reutiliza UnitRepository.getDetailById en vez de duplicar esas consultas,
// porque tanto el coste como la validación de legalidad (domain/
// armyValidation.ts) necesitan las reglas completas de la unidad, no solo
// su id.
// ============================================================================
import { exec, execBatch, query, queryOne, type BatchStatement } from '@/data/sqlite/client'
import { queryLocal } from '@/data/sqlite/localCatalog'
import { UnitRepository } from '@/data/repositories/unitRepository'
import { FactionRepository } from '@/data/repositories/factionRepository'
import { computeCategoryInsertIndex } from '@/domain/armyValidation'
import type {
  ArmyList,
  ArmyListDetail,
  ArmyListEntry,
  ArmyListEntryInput,
  EntryMagicPath,
  LadoDeDespliegue,
} from '@/domain/types'
import { MESA_ALTO_CM, MESA_ANCHO_CM, type DeploymentPosition } from '@/domain/deployment'

function mapArmyList(row: Record<string, unknown>): ArmyList {
  return {
    id: row.id as number,
    factionId: row.faction_id as number,
    name: row.name as string,
    pointsLimit: (row.points_limit as number) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    userId: (row.user_id as number) ?? null,
    // `?? 180/120` para que una migración a medias no deje la mesa en NaN.
    tableWidthCm: (row.table_width_cm as number) ?? MESA_ANCHO_CM,
    tableHeightCm: (row.table_height_cm as number) ?? MESA_ALTO_CM,
    battleMapId: (row.battle_map_id as number) ?? null,
    // La columna puede no existir todavía si la D1 no se ha migrado. En ese
    // caso la lista SÍ ofrece Personajes de Renombre: es el valor por defecto
    // de la columna y el que se pidió, y ante la duda es mejor ofrecer de más
    // que esconder una sección entera sin que nadie lo haya decidido.
    showSpecialCharacters: row.show_special_characters == null ? true : Boolean(row.show_special_characters),
    // Las tres pueden no venir todavía si la D1 no se ha migrado. Sin ellas la
    // lista se comporta como siempre: abierta, desplegando desde el sur y sin
    // imagen de fondo. Nunca al revés — una lista que se abre bloqueada porque
    // falta una columna es una lista que nadie puede desbloquear.
    ready: Boolean(row.ready),
    deploymentSide: row.deployment_side === 'norte' ? 'norte' : 'sur',
    deploymentImageKey: (row.deployment_image_key as string) ?? null,
  }
}

export interface ArmyListSummary extends ArmyList {
  factionName: string
  entryCount: number
  /**
   * La lista es de OTRO y la estás viendo porque te la han compartido. Solo se
   * puede mirar y exportar.
   */
  shared: boolean
  /** Quién te la compartió; null si es tuya. */
  ownerName: string | null
}

/** Una persona con la que está compartida una lista. */
export interface ArmyListShare {
  userId: number
  /** Si además de la lista ve el despliegue sobre la mesa. */
  shareDeployment: boolean
}

/** Qué puede ver alguien de una lista que no es suya. */
export interface ShareAccess {
  compartida: boolean
  conDespliegue: boolean
}

export interface ArmyListCreateInput {
  factionId: number
  name: string
  pointsLimit: number | null
  /** Dueño de la lista. Cada usuario ve solo las suyas (ver listAll). */
  userId: number
}

async function resolveEntry(row: Record<string, unknown>): Promise<ArmyListEntry | null> {
  // Las tres consultas son independientes entre sí (ninguna depende del
  // resultado de otra: unit_id y row.id ya se conocen desde el principio),
  // así que se lanzan en paralelo en vez de una detrás de otra.
  const [unit, equipmentIds, upgradeIds, magicPaths] = await Promise.all([
    UnitRepository.getDetailById(row.unit_id as number),
    query<number>(
      'SELECT equipment_id FROM army_list_entry_equipment WHERE entry_id = ?',
      [row.id as number],
      (r) => r.equipment_id as number,
    ),
    query<number>(
      'SELECT upgrade_id FROM army_list_entry_upgrades WHERE entry_id = ?',
      [row.id as number],
      (r) => r.upgrade_id as number,
    ),
    // Las sendas viven en su propia tabla porque cada una lleva su NIVEL:
    // un hechicero puede tener Fuego a 2 y Bestias a 1 en la misma entrada.
    query<EntryMagicPath>(
      'SELECT path_id, level FROM army_list_entry_magic_paths WHERE entry_id = ?',
      [row.id as number],
      (r) => ({ pathId: r.path_id as number, level: (r.level as number) ?? 1 }),
    ).catch(() => [] as EntryMagicPath[]),
  ])
  if (!unit) return null // unidad borrada después de añadirla a la lista: se omite en vez de romper la carga

  return {
    id: row.id as number,
    armyListId: row.army_list_id as number,
    unit,
    quantity: row.quantity as number,
    mountProfileId: (row.mount_profile_id as number) ?? null,
    chariotProfileId: (row.chariot_profile_id as number) ?? null,
    hasStandardBearer: Boolean(row.has_standard_bearer),
    hasMusician: Boolean(row.has_musician),
    hasChampion: Boolean(row.has_champion),
    championName: (row.champion_name as string) ?? null,
    alias: (row.alias as string) ?? null,
    // `?? null` y no `|| null`: un coste de 0 es válido y no debe convertirse
    // en "sin retocar".
    costOverride: (row.cost_override as number) ?? null,
    magicPaths,
    sortOrder: row.sort_order as number,
    equipmentIds,
    upgradeIds,
  }
}

async function touchList(armyListId: number): Promise<void> {
  await exec('UPDATE army_lists SET updated_at = ? WHERE id = ?', [new Date().toISOString(), armyListId])
}

async function replaceEntryRelations(
  entryId: number,
  equipmentIds: number[],
  upgradeIds: number[],
  magicPaths: EntryMagicPath[] = [],
): Promise<void> {
  const statements: BatchStatement[] = [
    { sql: 'DELETE FROM army_list_entry_equipment WHERE entry_id = ?', params: [entryId] },
    ...equipmentIds.map((equipmentId) => ({
      sql: 'INSERT OR IGNORE INTO army_list_entry_equipment (entry_id, equipment_id) VALUES (?, ?)',
      params: [entryId, equipmentId],
    })),
    { sql: 'DELETE FROM army_list_entry_upgrades WHERE entry_id = ?', params: [entryId] },
    ...upgradeIds.map((upgradeId) => ({
      sql: 'INSERT OR IGNORE INTO army_list_entry_upgrades (entry_id, upgrade_id) VALUES (?, ?)',
      params: [entryId, upgradeId],
    })),
    { sql: 'DELETE FROM army_list_entry_magic_paths WHERE entry_id = ?', params: [entryId] },
    ...magicPaths.map((path) => ({
      sql: 'INSERT OR IGNORE INTO army_list_entry_magic_paths (entry_id, path_id, level) VALUES (?, ?, ?)',
      params: [entryId, path.pathId, path.level],
    })),
  ]
  await execBatch(statements)
}

export const ArmyListRepository = {
  /**
   * Listas del usuario indicado, y SOLO las suyas: los ejércitos son privados
   * de cada uno (es el concepto central de la sección). Las que quedaran sin
   * dueño de antes de existir los usuarios se asignan al usuario "admin" con
   * una corrección de datos, en vez de mostrarse a todo el mundo.
   */
  async listAll(userId: number): Promise<ArmyListSummary[]> {
    // Dos orígenes en una sola consulta: las TUYAS y las que te han
    // COMPARTIDO. Las tuyas primero (`es_mia` primero en el ORDER BY) porque
    // son con las que se trabaja; las compartidas son de consulta.
    //
    // Si la tabla de compartidos todavía no existe (Worker sin desplegar), la
    // consulta entera fallaría y te quedarías sin ver ni tus propias listas.
    // Por eso se intenta primero la completa y, si falla, se cae a la de
    // siempre.
    const conCompartidas = `
       SELECT al.*, f.name AS faction_name,
              (SELECT COUNT(*) FROM army_list_entries e WHERE e.army_list_id = al.id) AS entry_count,
              CASE WHEN al.user_id = ?1 THEN 1 ELSE 0 END AS es_mia,
              (SELECT u.username FROM users u WHERE u.id = al.user_id) AS owner_name
       FROM army_lists al
       JOIN factions f ON f.id = al.faction_id
       WHERE al.user_id = ?1
          OR EXISTS (SELECT 1 FROM army_list_shares s WHERE s.army_list_id = al.id AND s.user_id = ?1)
       ORDER BY es_mia DESC, al.updated_at DESC`

    const mapear = (row: Record<string, unknown>): ArmyListSummary => {
      const mia = (row.es_mia as number) !== 0
      return {
        ...mapArmyList(row),
        factionName: row.faction_name as string,
        entryCount: row.entry_count as number,
        shared: !mia,
        ownerName: mia ? null : ((row.owner_name as string) ?? null),
      }
    }

    try {
      return await query(conCompartidas, [userId], mapear)
    } catch {
      return await query(
        `SELECT al.*, f.name AS faction_name,
                (SELECT COUNT(*) FROM army_list_entries e WHERE e.army_list_id = al.id) AS entry_count,
                1 AS es_mia, NULL AS owner_name
         FROM army_lists al
         JOIN factions f ON f.id = al.faction_id
         WHERE al.user_id = ?
         ORDER BY al.updated_at DESC`,
        [userId],
        mapear,
      )
    }
  },

  /**
   * Resúmenes de listas CONCRETAS por id, sin mirar de quién son.
   *
   * Es la excepción a que los ejércitos sean privados, y existe por las
   * batallas: una batalla la puede editar cualquiera, así que el formulario
   * tiene que poder enseñar los dos ejércitos que ya tiene puestos aunque no
   * sean del que está editando. Sin esto, abrir la batalla de otro mostraba dos
   * desplegables en blanco y no dejaba guardar.
   *
   * No abre ninguna puerta nueva: hay que saber el id de antemano, y esos ids
   * salen de una batalla, que ya es pública. Para descubrir listas ajenas sigue
   * sin servir — eso lo hace `listAll`, que sí filtra.
   */
  async resumenesPorIds(ids: number[], userId: number): Promise<ArmyListSummary[]> {
    if (ids.length === 0) return []
    const huecos = ids.map(() => '?').join(', ')
    return query(
      `SELECT al.*, f.name AS faction_name,
              (SELECT COUNT(*) FROM army_list_entries e WHERE e.army_list_id = al.id) AS entry_count,
              (SELECT u.username FROM users u WHERE u.id = al.user_id) AS owner_name,
              al.user_id AS dueno
       FROM army_lists al
       JOIN factions f ON f.id = al.faction_id
       WHERE al.id IN (${huecos})`,
      ids,
      (row) => {
        const mia = (row.dueno as number | null) === userId
        return {
          ...mapArmyList(row),
          factionName: row.faction_name as string,
          entryCount: row.entry_count as number,
          shared: !mia,
          ownerName: mia ? null : ((row.owner_name as string) ?? null),
        }
      },
    )
  },

  // ---- Compartir --------------------------------------------------------

  /** Con quién está compartida una lista, y si a cada uno se le enseña el despliegue. */
  async getShares(armyListId: number): Promise<ArmyListShare[]> {
    try {
      return await query<ArmyListShare>(
        'SELECT user_id, share_deployment FROM army_list_shares WHERE army_list_id = ?',
        [armyListId],
        (r) => ({ userId: r.user_id as number, shareDeployment: (r.share_deployment as number) !== 0 }),
      )
    } catch {
      return []
    }
  },

  /** Sustituye entera la lista de destinatarios. */
  async setShares(armyListId: number, shares: ArmyListShare[]): Promise<void> {
    await execBatch([
      { sql: 'DELETE FROM army_list_shares WHERE army_list_id = ?', params: [armyListId] },
      ...shares.map((share) => ({
        sql: 'INSERT OR IGNORE INTO army_list_shares (army_list_id, user_id, share_deployment) VALUES (?, ?, ?)',
        params: [armyListId, share.userId, share.shareDeployment ? 1 : 0],
      })),
    ])
  },

  /** Carga un mapa en el despliegue de una lista, o lo quita (null = mesa libre). */
  async setBattleMap(armyListId: number, battleMapId: number | null): Promise<void> {
    await exec('UPDATE army_lists SET battle_map_id = ? WHERE id = ?', [battleMapId, armyListId])
  },

  /** Cambia las medidas de la mesa de una lista (ver Despliegue). */
  async setTableSize(armyListId: number, anchoCm: number, altoCm: number): Promise<void> {
    await exec('UPDATE army_lists SET table_width_cm = ?, table_height_cm = ? WHERE id = ?', [
      anchoCm,
      altoCm,
      armyListId,
    ])
  },

  // ---- Despliegue -------------------------------------------------------

  /**
   * Dónde está colocada cada entrada de la lista sobre la mesa. Las entradas
   * SIN fila no están desplegadas: siguen en la reserva del lateral.
   */
  async getDeployment(armyListId: number): Promise<DeploymentPosition[]> {
    try {
      return await query<DeploymentPosition>(
        `SELECT d.entry_id, d.x_cm, d.y_cm, d.w_cm, d.h_cm
           FROM army_list_deployments d
           JOIN army_list_entries e ON e.id = d.entry_id
          WHERE e.army_list_id = ?`,
        [armyListId],
        (r) => ({
          entryId: r.entry_id as number,
          xCm: r.x_cm as number,
          yCm: r.y_cm as number,
          anchoCm: (r.w_cm as number) ?? null,
          altoCm: (r.h_cm as number) ?? null,
        }),
      )
    } catch {
      return []
    }
  },

  /**
   * Sustituye entero el despliegue de una lista.
   *
   * Se borra por LISTA y no por entrada porque quitar una unidad de la mesa es
   * borrar su fila: si solo se insertara lo que hay colocado, lo retirado se
   * quedaría clavado en la mesa para siempre.
   */
  /**
   * Cuántas peanas tiene desplegadas cada una de estas listas, en UNA consulta.
   *
   * Lo usa el alta de una batalla para poder avisar de que a un ejército le
   * falta el despliegue. Una consulta por lista serían tantos viajes a la red
   * como listas completadas tenga el usuario, y todos para contar enteros.
   */
  async contarDespliegues(armyListIds: number[]): Promise<Map<number, number>> {
    const total = new Map<number, number>()
    if (armyListIds.length === 0) return total
    const marcas = armyListIds.map(() => '?').join(',')
    const filas = await query(
      `SELECT army_list_id, COUNT(*) AS n
         FROM army_list_deployments
        WHERE army_list_id IN (${marcas})
        GROUP BY army_list_id`,
      armyListIds,
      (r) => ({ id: r.army_list_id as number, n: r.n as number }),
    )
    for (const f of filas) total.set(f.id, f.n)
    return total
  },

  async saveDeployment(armyListId: number, posiciones: DeploymentPosition[]): Promise<void> {
    await execBatch([
      {
        sql: `DELETE FROM army_list_deployments
               WHERE entry_id IN (SELECT id FROM army_list_entries WHERE army_list_id = ?)`,
        params: [armyListId],
      },
      ...posiciones.map((p) => ({
        sql: 'INSERT OR REPLACE INTO army_list_deployments (entry_id, x_cm, y_cm, w_cm, h_cm) VALUES (?, ?, ?, ?, ?)',
        params: [p.entryId, p.xCm, p.yCm, p.anchoCm, p.altoCm],
      })),
    ])
  },

  /**
   * Qué puede ver este usuario de una lista que no es suya. Decide si la abre
   * (en solo lectura) y si además ve su despliegue.
   *
   * Devuelve las DOS cosas de una vez porque el despliegue se comparte aparte:
   * se puede tener acceso a la lista y no a su despliegue. Si la columna
   * todavía no existe (Worker sin desplegar), se responde que sí al despliegue,
   * que es como se comportaba antes de que esto se pudiera elegir: quitar
   * acceso por una migración a medias sería un fallo desconcertante.
   */
  async getShareAccess(armyListId: number, userId: number): Promise<ShareAccess> {
    try {
      const filas = await query<boolean>(
        'SELECT share_deployment FROM army_list_shares WHERE army_list_id = ? AND user_id = ?',
        [armyListId, userId],
        (r) => (r.share_deployment as number) !== 0,
      )
      return { compartida: filas.length > 0, conDespliegue: filas[0] === true }
    } catch {
      try {
        const filas = await query<number>(
          'SELECT user_id FROM army_list_shares WHERE army_list_id = ? AND user_id = ?',
          [armyListId, userId],
          (r) => r.user_id as number,
        )
        return { compartida: filas.length > 0, conDespliegue: filas.length > 0 }
      } catch {
        return { compartida: false, conDespliegue: false }
      }
    }
  },

  async create(input: ArmyListCreateInput): Promise<number> {
    const now = new Date().toISOString()
    return exec(
      'INSERT INTO army_lists (faction_id, name, points_limit, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [input.factionId, input.name.trim(), input.pointsLimit, now, now, input.userId],
    )
  },

  async rename(id: number, name: string): Promise<void> {
    await exec('UPDATE army_lists SET name = ?, updated_at = ? WHERE id = ?', [
      name.trim(),
      new Date().toISOString(),
      id,
    ])
  },

  async setPointsLimit(id: number, pointsLimit: number | null): Promise<void> {
    await exec('UPDATE army_lists SET points_limit = ?, updated_at = ? WHERE id = ?', [
      pointsLimit,
      new Date().toISOString(),
      id,
    ])
  },

  /** Enciende o apaga los Personajes de Renombre en esta lista (ver ArmyList.showSpecialCharacters). */
  async setShowSpecialCharacters(id: number, mostrar: boolean): Promise<void> {
    await exec('UPDATE army_lists SET show_special_characters = ?, updated_at = ? WHERE id = ?', [
      mostrar ? 1 : 0,
      new Date().toISOString(),
      id,
    ])
  },

  /**
   * Marca o desmarca la lista como COMPLETADA (ver ArmyList.ready).
   *
   * REABRIR UNA LISTA METIDA EN UNA BATALLA NO SE PUEDE. Una batalla no guarda
   * copia de nada: enseña el despliegue y las unidades tal y como están, y puede
   * permitírselo precisamente porque sus dos listas están cerradas. Si se
   * pudiera reabrir una, la batalla cambiaría a espaldas de quien la creó — y de
   * su rival. Para poder reabrirla hay que borrar antes la batalla.
   *
   * La comprobación va AQUÍ, en el único sitio por el que se pasa, y no en cada
   * botón: son tres (el sello del listado y los "Reabrir" del constructor y del
   * despliegue) y el cuarto que se añada se olvidaría. La consulta se hace a
   * mano en vez de llamar a BattleRepository para no montar un círculo de
   * importaciones entre los dos repositorios.
   *
   * No toca `updated_at`: cerrar una lista no es editarla, y si lo tocara, el
   * orden del listado —que va por fecha— bailaría cada vez que alguien abre y
   * cierra el candado.
   */
  async setReady(id: number, ready: boolean): Promise<void> {
    if (!ready) {
      let enBatallas = 0
      try {
        const filas = await query<number>(
          'SELECT COUNT(*) AS n FROM battles WHERE army_list_a_id = ? OR army_list_b_id = ?',
          [id, id],
          (r) => r.n as number,
        )
        enBatallas = filas[0] ?? 0
      } catch {
        // Sin tabla de batallas todavía: no hay ninguna que proteger.
      }
      if (enBatallas > 0) {
        throw new Error(
          enBatallas === 1
            ? 'Este ejército está en una batalla. Bórrala o cámbiale el ejército para poder reabrirlo.'
            : `Este ejército está en ${enBatallas} batallas. Bórralas o cámbiales el ejército para poder reabrirlo.`,
        )
      }
    }
    await exec('UPDATE army_lists SET ready = ? WHERE id = ?', [ready ? 1 : 0, id])
  },

  /** Lado del tablero desde el que despliega (ver ArmyList.deploymentSide). */
  async setDeploymentSide(id: number, lado: LadoDeDespliegue): Promise<void> {
    await exec('UPDATE army_lists SET deployment_side = ? WHERE id = ?', [lado, id])
  },

  /** Clave en R2 de la imagen de fondo del despliegue; null la quita. */
  async setDeploymentImageKey(id: number, key: string | null): Promise<void> {
    await exec('UPDATE army_lists SET deployment_image_key = ? WHERE id = ?', [key, id])
  },

  async remove(id: number): Promise<void> {
    await exec('DELETE FROM army_lists WHERE id = ?', [id])
  },

  /**
   * Copia una lista entera —cabecera y todas sus entradas con su equipo,
   * opciones, montura y grupo de mando— en una lista nueva. Para probar
   * variaciones de un mismo ejército sin perder el original.
   *
   * La copia se hace LEYENDO Y REESCRIBIENDO, no con un `INSERT ... SELECT`.
   * Es más código, pero cada entrada tiene tres tablas satélite colgando
   * (equipo, opciones y su propia fila), y reutilizar `getDetailById` +
   * `replaceAllEntries` garantiza que la copia pase por exactamente el mismo
   * camino que un guardado normal: si mañana una entrada gana un campo nuevo,
   * la duplicación lo hereda sola en vez de quedarse muda perdiendo ese dato.
   */
  async duplicate(id: number, newName: string, userId: number): Promise<number> {
    const source = await ArmyListRepository.getDetailById(id)
    if (!source) throw new Error('No se encontró la lista que se quiere copiar.')
    // Los ejércitos son privados de cada usuario (ver listAll). La interfaz
    // solo ofrece duplicar las propias, pero el repositorio no debe dar por
    // hecho quién le llama: sin esta comprobación, bastaría pedir un id ajeno
    // para llevarse la lista de otro.
    if (source.userId != null && source.userId !== userId) {
      throw new Error('Esa lista no es tuya.')
    }

    const newId = await ArmyListRepository.create({
      factionId: source.factionId,
      name: newName,
      pointsLimit: source.pointsLimit,
      userId,
    })

    if (source.entries.length === 0) return newId

    try {
      await ArmyListRepository.replaceAllEntries(
        newId,
        source.entries.map((e) => ({
          unitId: e.unit.id,
          quantity: e.quantity,
          mountProfileId: e.mountProfileId,
          chariotProfileId: e.chariotProfileId,
          hasStandardBearer: e.hasStandardBearer,
          hasMusician: e.hasMusician,
          hasChampion: e.hasChampion,
          championName: e.championName,
          alias: e.alias,
          costOverride: e.costOverride,
          magicPaths: e.magicPaths,
          equipmentIds: e.equipmentIds,
          upgradeIds: e.upgradeIds,
        })),
      )
    } catch (err) {
      // La cabecera ya está creada, pero las entradas no. Sin esto, un fallo
      // de red dejaría al usuario con el mensaje de error Y una lista vacía
      // llamada "X (copia)" en el listado, sin ninguna pista de que hay que
      // borrarla a mano. Se deshace y se propaga el error original.
      await ArmyListRepository.remove(newId).catch(() => undefined)
      throw err
    }
    return newId
  },

  async getDetailById(id: number): Promise<ArmyListDetail | null> {
    // La query de filas de entradas solo necesita `id` (ya conocido), no el
    // resultado de `list`, así que se lanza en paralelo con ella en vez de
    // esperar a que `list` resuelva primero.
    const [list, entryRows] = await Promise.all([
      queryOne('SELECT * FROM army_lists WHERE id = ?', [id], mapArmyList),
      query('SELECT * FROM army_list_entries WHERE army_list_id = ? ORDER BY sort_order, id', [id], (row) => row),
    ])
    if (!list) return null

    // La facción sí depende de `list.factionId`, pero resolver las entradas
    // no depende de la facción: se lanzan también en paralelo entre sí.
    const [faction, resolved] = await Promise.all([
      FactionRepository.getById(list.factionId),
      Promise.all(entryRows.map(resolveEntry)),
    ])
    if (!faction) return null

    const entries = resolved.filter((e): e is ArmyListEntry => e !== null)

    return { ...list, faction, entries }
  },

  /**
   * Añade una unidad a la lista como una nueva entrada. Devuelve el id de la
   * entrada creada.
   *
   * La posición por defecto de la entrada nueva no es simplemente "al final":
   * se agrupa junto a las de su misma categoría (Personajes, luego Básicas,
   * Especiales, Singulares, y el resto al final — ver
   * domain/armyValidation.ts#computeCategoryInsertIndex), respetando el orden
   * en el que ya estuvieran las demás entradas (incluida cualquier
   * reordenación manual previa del usuario, ver `reorderEntries`). Para eso
   * hace falta conocer la categoría de la unidad de cada entrada existente Y
   * de la nueva ANTES de decidir su `sort_order`, así que estos pasos van
   * secuenciales entre sí (cada uno depende del anterior); solo al final se
   * hace el `UPDATE` en batch de todos los `sort_order` afectados de una vez.
   */
  async addEntry(armyListId: number, input: ArmyListEntryInput): Promise<number> {
    const existingRows = await query<{ id: number; unitId: number }>(
      'SELECT id, unit_id FROM army_list_entries WHERE army_list_id = ? ORDER BY sort_order, id',
      [armyListId],
      (row) => ({ id: row.id as number, unitId: row.unit_id as number }),
    )

    // Categoría de cada unidad implicada (las de las entradas ya presentes +
    // la que se va a añadir), consultada de una sola vez contra el catálogo
    // local (sql.js) — no hace falta ir al Worker para esto.
    const unitIds = [...new Set([...existingRows.map((r) => r.unitId), input.unitId])]
    const categoryByUnitId = new Map<number, string | null>()
    if (unitIds.length > 0) {
      const categoryRows = await queryLocal<{ unitId: number; code: string | null }>(
        `SELECT u.id AS unit_id, uc.code AS code FROM units u
         LEFT JOIN unit_categories uc ON uc.id = u.category_id
         WHERE u.id IN (${unitIds.map(() => '?').join(',')})`,
        unitIds,
        (row) => ({ unitId: row.unit_id as number, code: (row.code as string | null) ?? null }),
      )
      for (const r of categoryRows) categoryByUnitId.set(r.unitId, r.code)
    }
    const categoryOf = (unitId: number) => {
      const code = categoryByUnitId.get(unitId)
      return code ? { code } : null
    }

    const insertIndex = computeCategoryInsertIndex(
      existingRows.map((r) => ({ unit: { category: categoryOf(r.unitId) } })),
      { category: categoryOf(input.unitId) },
    )

    const entryId = await exec(
      `INSERT INTO army_list_entries
         (army_list_id, unit_id, quantity, mount_profile_id, chariot_profile_id,
          has_standard_bearer, has_musician, has_champion, champion_name, alias, cost_override, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        armyListId,
        input.unitId,
        input.quantity,
        input.mountProfileId,
        input.chariotProfileId,
        input.hasStandardBearer ? 1 : 0,
        input.hasMusician ? 1 : 0,
        input.hasChampion ? 1 : 0,
        input.championName,
        input.alias,
        input.costOverride,
        existingRows.length, // provisional (al final); se corrige justo debajo
      ],
    )
    await replaceEntryRelations(entryId, input.equipmentIds, input.upgradeIds, input.magicPaths)

    const orderedIds = existingRows.map((r) => r.id)
    orderedIds.splice(insertIndex, 0, entryId)
    await execBatch(
      orderedIds.map((id, i) => ({ sql: 'UPDATE army_list_entries SET sort_order = ? WHERE id = ?', params: [i, id] })),
    )

    await touchList(armyListId)
    return entryId
  },

  /**
   * Reordena a mano las entradas de una lista: `orderedEntryIds` es el orden
   * completo deseado (todas las entradas de la lista, no un subconjunto).
   * Usado por los botones subir/bajar de "Unidades en la lista" — a
   * diferencia de `addEntry`, aquí no se aplica ningún criterio de
   * categoría: es el usuario quien decide el orden explícitamente.
   */
  async reorderEntries(armyListId: number, orderedEntryIds: number[]): Promise<void> {
    await execBatch(
      orderedEntryIds.map((id, i) => ({
        sql: 'UPDATE army_list_entries SET sort_order = ? WHERE id = ?',
        params: [i, id],
      })),
    )
    await touchList(armyListId)
  },

  async updateEntry(entryId: number, armyListId: number, input: ArmyListEntryInput): Promise<void> {
    await exec(
      `UPDATE army_list_entries
       SET unit_id = ?, quantity = ?, mount_profile_id = ?, chariot_profile_id = ?,
           has_standard_bearer = ?, has_musician = ?, has_champion = ?, champion_name = ?, alias = ?,
           cost_override = ?
       WHERE id = ?`,
      [
        input.unitId,
        input.quantity,
        input.mountProfileId,
        input.chariotProfileId,
        input.hasStandardBearer ? 1 : 0,
        input.hasMusician ? 1 : 0,
        input.hasChampion ? 1 : 0,
        input.championName,
        input.alias,
        input.costOverride,
        entryId,
      ],
    )
    await replaceEntryRelations(entryId, input.equipmentIds, input.upgradeIds, input.magicPaths)
    await touchList(armyListId)
  },

  async removeEntry(entryId: number, armyListId: number): Promise<void> {
    await exec('DELETE FROM army_list_entries WHERE id = ?', [entryId])
    await touchList(armyListId)
  },

  /**
   * Guarda de una sola vez TODAS las entradas de una lista, sustituyendo por
   * completo lo que hubiera. Es lo que usa el botón "Guardar ejército" del
   * constructor: mientras el usuario añade/edita/reordena unidades, todo vive
   * en memoria (sin tocar la red — antes cada añadir era una escritura + una
   * recarga completa, de ahí la lentitud); solo al pulsar Guardar se persiste
   * aquí, en bloque.
   *
   * Estrategia "borrar y reinsertar": se borran todas las entradas de la lista
   * (el ON DELETE CASCADE del esquema se lleva por delante su equipo/opciones)
   * y se reinsertan todas en el orden recibido, con `sort_order` = índice. Para
   * poder insertar el equipo/opciones de cada entrada en el MISMO lote sin
   * depender del id que autogeneraría la BBDD, se eligen ids EXPLÍCITOS a
   * partir de `MAX(id)+1` (por encima de cualquier id existente, así que no
   * colisionan con los de otras listas ni con los recién borrados).
   *
   * El Worker limita cada batch a 50 sentencias (ver worker/src/index.ts:
   * MAX_MUTATE_STATEMENTS), así que las sentencias se envían en trozos de
   * como mucho 45. Como los ids son explícitos, el resultado no depende de
   * dónde caigan los cortes entre trozos; lo único que debe ir primero es el
   * DELETE (primer trozo) y el UPDATE de `updated_at` al final.
   */
  async replaceAllEntries(armyListId: number, entries: ArmyListEntryInput[]): Promise<void> {
    const maxId =
      (await queryOne<number>('SELECT COALESCE(MAX(id), 0) AS m FROM army_list_entries', [], (r) => r.m as number)) ?? 0

    const statements: BatchStatement[] = [
      { sql: 'DELETE FROM army_list_entries WHERE army_list_id = ?', params: [armyListId] },
    ]

    entries.forEach((entry, index) => {
      const entryId = maxId + 1 + index
      statements.push({
        sql: `INSERT INTO army_list_entries
                (id, army_list_id, unit_id, quantity, mount_profile_id, chariot_profile_id,
                 has_standard_bearer, has_musician, has_champion, champion_name, alias, cost_override,
                 sort_order)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        params: [
          entryId,
          armyListId,
          entry.unitId,
          entry.quantity,
          entry.mountProfileId,
          entry.chariotProfileId,
          entry.hasStandardBearer ? 1 : 0,
          entry.hasMusician ? 1 : 0,
          entry.hasChampion ? 1 : 0,
          entry.championName,
          entry.alias,
          entry.costOverride,
          index,
        ],
      })
      for (const equipmentId of entry.equipmentIds) {
        statements.push({
          sql: 'INSERT OR IGNORE INTO army_list_entry_equipment (entry_id, equipment_id) VALUES (?, ?)',
          params: [entryId, equipmentId],
        })
      }
      for (const upgradeId of entry.upgradeIds) {
        statements.push({
          sql: 'INSERT OR IGNORE INTO army_list_entry_upgrades (entry_id, upgrade_id) VALUES (?, ?)',
          params: [entryId, upgradeId],
        })
      }
      for (const path of entry.magicPaths) {
        statements.push({
          sql: 'INSERT OR IGNORE INTO army_list_entry_magic_paths (entry_id, path_id, level) VALUES (?, ?, ?)',
          params: [entryId, path.pathId, path.level],
        })
      }
    })

    statements.push({
      sql: 'UPDATE army_lists SET updated_at = ? WHERE id = ?',
      params: [new Date().toISOString(), armyListId],
    })

    // Trozos de <=45 sentencias para no superar el límite del Worker (50).
    const CHUNK = 45
    for (let i = 0; i < statements.length; i += CHUNK) {
      await execBatch(statements.slice(i, i + CHUNK))
    }
  },
}
