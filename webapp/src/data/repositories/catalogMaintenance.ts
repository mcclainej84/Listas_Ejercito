// ============================================================================
// Mantenimiento del catálogo: renombrados de nombres abreviados del origen a
// su descripción completa (a petición del usuario). Se centraliza aquí para
// que lo usen TANTO la importación (features/admin/import) como una pasada
// automática al arrancar la app (ver runCatalogMaintenance), de modo que las
// abreviaturas que YA hubiera en el catálogo también queden corregidas, no
// solo lo que se importe de nuevo.
// ============================================================================
import { exec, execCatalog, execCatalogBatch, queryOne, runMigrations } from '@/data/sqlite/client'
import { queryLocal } from '@/data/sqlite/localCatalog'
import { hasStoredPassword } from '@/data/network/auth'
import { EQUIPMENT_ALIASES, UPGRADE_ALIASES, expandName } from '@/domain/catalogAliases'
import { UnitRepository } from '@/data/repositories/unitRepository'
import { UpgradeRepository, UnitTypeTagRepository } from '@/data/repositories/lookupRepositories'
import { seedMagicPaths } from '@/data/repositories/magicSeeding'
import type { AttributeProfileInput } from '@/domain/types'

const RENAME_KEY = 'wharmy_catalog_rename_v1'
const RULE_MERGE_KEY = 'wharmy_rule_merge_v1'
const MOUNT_SHEETS_KEY = 'wharmy_mount_sheets_v1'
const MAGIC_SEED_KEY = 'wharmy_magic_seed_v1'
const ETIQUETAS_MAGIA_KEY = 'wharmy_etiquetas_magia_v1'
// La versión se sube cuando se añaden correcciones nuevas, para que vuelvan a
// aplicarse en navegadores que ya ejecutaron las anteriores.
const DATA_FIX_KEY = 'wharmy_data_fixes_v7'

/** Quita acentos y mayúsculas para comparar nombres del catálogo con tolerancia. */
function normalizeForMatch(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Grupos de opciones EXCLUYENTES entre sí: elegir una impide elegir el resto
 * del grupo. Se traducen a filas de equipment_incompatibilities /
 * upgrade_incompatibilities (según dónde viva cada opción), que es lo que el
 * constructor de listas ya consulta para deshabilitarlas.
 */
const EXCLUSIVE_GROUPS: Array<{ reason: string; names?: string[]; prefixes?: string[] }> = [
  {
    reason: 'Solo se puede llevar un grupo de apoyo',
    names: [
      'Grupo de apoyo: Amerratadora',
      'Grupo de apoyo: Lanzallamas',
      'Grupo de apoyo: Mortero',
      'Grupo de apoyo: Picadora',
    ],
  },
  {
    reason: 'Ballesta ligera y hachas arrojadizas son excluyentes',
    names: ['Ballesta ligera', 'Hachas arrojadizas'],
  },
  {
    reason: 'Solo se puede elegir un tipo de esporas',
    names: ['Esporas cegadoras', 'Esporas regenerativas', 'Esporas toxicas'],
  },
  {
    // Por PREFIJO: TODA opción que se llame "Marca de …" es excluyente con
    // cualquier otra marca, sea cual sea el dios o la variante. Listarlas por
    // nombre dejaba fuera las que no estuvieran en la lista. Se incluye también
    // el prefijo antiguo "MdC " por si en algún catálogo no se ha aplicado
    // todavía el renombrado.
    reason: 'Solo se puede llevar una marca',
    prefixes: ['marca de', 'mdc '],
  },
  {
    // Por PREFIJO: en el catálogo conviven la opción suelta y sus variantes
    // combinadas ("Trol Rio", "Trol Rio / A2M", "Trol Piedra / 2AM"…), y solo
    // se puede llevar una de todas ellas. Enlazar únicamente las dos sueltas
    // dejaba fuera las combinadas, que son las que suele ofrecer la unidad.
    reason: 'Solo se puede llevar un tipo de trol',
    prefixes: ['trol rio', 'trol piedra', 'troll rio', 'troll piedra'],
  },
]

/** Da de alta todas las parejas excluyentes de un grupo en la tabla que corresponda. */
async function insertExclusivePairs(
  ids: number[],
  reason: string,
  table: 'equipment_incompatibilities' | 'upgrade_incompatibilities',
): Promise<void> {
  const [colA, colB] =
    table === 'equipment_incompatibilities' ? ['equipment_id_a', 'equipment_id_b'] : ['upgrade_id_a', 'upgrade_id_b']
  const statements = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      // El esquema exige a < b (CHECK), así que se ordenan.
      const a = Math.min(ids[i], ids[j])
      const b = Math.max(ids[i], ids[j])
      statements.push({
        sql: `INSERT OR IGNORE INTO ${table} (${colA}, ${colB}, reason) VALUES (?, ?, ?)`,
        params: [a, b, reason] as (string | number)[],
      })
    }
  }
  // En trozos: el número de parejas crece al CUADRADO (n·(n-1)/2), así que un
  // grupo de 11 opciones ya son 55 sentencias y el Worker rechaza los lotes de
  // más de 50. Mandarlas todas juntas hacía fallar el grupo entero (y con él
  // el resto de correcciones).
  const CHUNK = 45
  for (let i = 0; i < statements.length; i += CHUNK) {
    await execCatalogBatch(statements.slice(i, i + CHUNK))
  }
}

/** Resultado de aplicar los grupos excluyentes, para poder mostrarlo en pantalla. */
export interface ExclusiveGroupsReport {
  lines: string[]
  totalPairs: number
}

let lastReport: ExclusiveGroupsReport = { lines: [], totalPairs: 0 }

/** Informe de la última ejecución de applyExclusiveGroups (ver el botón en "Equipo y opciones"). */
export function getLastExclusiveGroupsReport(): ExclusiveGroupsReport {
  return lastReport
}

/** Aplica los grupos excluyentes sobre el catálogo (equipo y opciones de unidad). */
export async function applyExclusiveGroups(): Promise<ExclusiveGroupsReport> {
  const equipment = await queryLocal<{ id: number; name: string }>(
    'SELECT id, name FROM equipment_options',
    [],
    (r) => ({ id: r.id as number, name: r.name as string }),
  )
  const upgrades = await queryLocal<{ id: number; name: string }>(
    'SELECT id, name FROM upgrades',
    [],
    (r) => ({ id: r.id as number, name: r.name as string }),
  )

  const lines: string[] = []
  let totalPairs = 0

  for (const group of EXCLUSIVE_GROUPS) {
    const wanted = new Set((group.names ?? []).map(normalizeForMatch))
    const prefixes = (group.prefixes ?? []).map(normalizeForMatch)
    const matches = (name: string) => {
      const n = normalizeForMatch(name)
      return wanted.has(n) || prefixes.some((p) => n.startsWith(p))
    }
    const equipmentIds = equipment.filter((e) => matches(e.name)).map((e) => e.id)
    const upgradeIds = upgrades.filter((u) => matches(u.name)).map((u) => u.id)
    const pairs = (n: number) => (n > 1 ? (n * (n - 1)) / 2 : 0)
    const groupPairs = pairs(equipmentIds.length) + pairs(upgradeIds.length)

    // Cada grupo por separado: si uno falla, los demás se aplican igual.
    try {
      if (equipmentIds.length > 1) await insertExclusivePairs(equipmentIds, group.reason, 'equipment_incompatibilities')
      if (upgradeIds.length > 1) await insertExclusivePairs(upgradeIds, group.reason, 'upgrade_incompatibilities')
      totalPairs += groupPairs
      lines.push(
        `✓ ${group.reason}: ${equipmentIds.length} de equipo + ${upgradeIds.length} de unidad → ${groupPairs} parejas`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      lines.push(`✗ ${group.reason}: ${message}`)
      console.warn(`[WHArmy] Grupo excluyente "${group.reason}" no aplicado:`, err)
    }
  }

  lastReport = { lines, totalPairs }
  return lastReport
}

/**
 * Perfil de los "grupos de apoyo" (Skaven), tal y como viene en el origen
 * (HojaEjercito/datos.json, catálogo Montura/Dotación → "Grupo de apoyo").
 */
const GRUPO_APOYO_STATS: AttributeProfileInput = {
  m: '12',
  ha: '3',
  hp: '3',
  f: '3',
  r: '3',
  h: '1',
  i: '4',
  a: '2',
  l: '5',
}

/**
 * Correcciones puntuales de datos pedidas por el usuario, en una pasada única
 * e idempotente:
 *   1. Los "grupos de apoyo" dejan de existir como UNIDADES (pasan a ser solo
 *      opciones de unidad).
 *   2. Esas opciones reciben su ficha propia con el perfil del origen, para que
 *      sus atributos aparezcan en la tabla de características.
 *   3. "Marca de Nurgle" deja de existir como EQUIPO (los Pestigors y demás la
 *      llevan solo como opción de unidad).
 */
async function runDataFixes(): Promise<void> {
  /** Cada corrección va aislada: si una falla, se registra y NO impide las demás. */
  async function step(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn()
    } catch (err) {
      console.warn(`[WHArmy] Corrección de datos "${name}" no aplicada:`, err)
    }
  }

  /** Opciones "Grupo de apoyo: …" (se usan en dos correcciones). */
  async function grupoApoyoUpgrades() {
    return queryLocal<{ id: number; profileId: number | null }>(
      "SELECT id, profile_id FROM upgrades WHERE name LIKE 'Grupo de apoyo%'",
      [],
      (r) => ({ id: r.id as number, profileId: (r.profile_id as number) ?? null }),
    )
  }

  await step('grupos de apoyo ya no son unidades', async () => {
    const units = await queryLocal<{ id: number }>(
      "SELECT id FROM units WHERE name LIKE 'Grupo de apoyo%'",
      [],
      (r) => ({ id: r.id as number }),
    )
    for (const u of units) await UnitRepository.remove(u.id)
  })

  await step('ficha de los grupos de apoyo', async () => {
    for (const up of await grupoApoyoUpgrades()) {
      if (up.profileId == null) await UpgradeRepository.saveProfile(up.id, null, GRUPO_APOYO_STATS)
    }
  })

  await step('Marca de Nurgle deja de ser equipo', async () => {
    const equipment = await queryLocal<{ id: number }>(
      "SELECT id FROM equipment_options WHERE name IN ('Marca de Nurgle', 'MdC Nurgle')",
      [],
      (r) => ({ id: r.id as number }),
    )
    for (const e of equipment) await execCatalog('DELETE FROM equipment_options WHERE id = ?', [e.id])
  })

  await step('reglas de los grupos de apoyo', async () => {
    const source = await queryLocal<{ id: number }>(
      "SELECT id FROM units WHERE name = 'Guerreros Skaven' LIMIT 1",
      [],
      (r) => ({ id: r.id as number }),
    )
    const upgrades = await grupoApoyoUpgrades()
    if (source.length === 0 || upgrades.length === 0) return
    const ruleIds = await queryLocal<number>(
      'SELECT rule_id FROM unit_special_rules WHERE unit_id = ?',
      [source[0].id],
      (r) => r.rule_id as number,
    )
    if (ruleIds.length === 0) return
    for (const up of upgrades) await UpgradeRepository.replaceSpecialRules(up.id, ruleIds)
  })

  // La T.S. usaba antes el 7 como "sin salvación por armadura" y el rango
  // válido era 2-7. Ahora ese valor es el 0 (se muestra como "—") y el rango
  // es 0-6. Sin esta conversión, las unidades guardadas con la convención
  // vieja se verían como "7+" y, peor, saltaría el aviso de validación al
  // intentar guardarlas.
  await step('T.S.: el 7 pasa a ser 0 (sin salvación)', async () => {
    await execCatalog('UPDATE units SET armor_save = 0 WHERE armor_save >= 7', [])
  })

  await step('opciones excluyentes', async () => {
    await applyExclusiveGroups()
  })
}

// ============================================================================
// Reglas especiales duplicadas por el singular/plural (y algún sinónimo) con
// que las escribía cada libro: "Causa miedo" y "Causan miedo" son la MISMA
// regla, pero al venir como dos filas de special_rules aparecían dos veces en
// el catálogo, había que mantener las dos descripciones y el filtro "sin usar"
// no cuadraba.
//
// El PRIMER nombre de cada grupo es el que se conserva; el resto se reasigna a
// él y se borra.
// ============================================================================
const RULE_MERGE_GROUPS: string[][] = [
  ['Causa miedo', 'Causan miedo'],
  ['Causa terror', 'Causan terror'],
  ['Inflamable', 'Inflamables'],
  ['Controlada', 'Controlados'],
  ['Incursores', 'Rastreadores'],
  ['Guardabosques', 'Movimiento por el bosque', 'Caminantes', 'Leñadores'],
  ['Espíritu del bosque', 'Espíritus del bosque'],
  ['Inmune a desmoralización', 'Inmunes a desmoralización'],
  ['Inmune a psicología', 'Inmunes a psicología'],
  ['Inmune al fuego', 'Inmunes al fuego'],
  ['Inmune al pánico', 'Inmunes al pánico'],
]

/** Las tres tablas desde las que se puede referenciar una regla. */
const RULE_LINK_TABLES: Array<{ table: string; ownerColumn: string }> = [
  { table: 'unit_special_rules', ownerColumn: 'unit_id' },
  { table: 'upgrade_special_rules', ownerColumn: 'upgrade_id' },
  { table: 'profile_special_rules', ownerColumn: 'profile_id' },
]

/**
 * Funde los grupos de RULE_MERGE_GROUPS en su primer nombre.
 *
 * Para cada duplicado, y en las TRES tablas que pueden referenciar una regla:
 * se enganchan a la regla buena todos los que llevaban la duplicada, se sueltan
 * los enlaces viejos y se borra la regla sobrante. El `INSERT OR IGNORE` es la
 * clave del caso incómodo: quien ya tuviera las dos reglas (p.ej. una unidad
 * con "Causa miedo" Y "Causan miedo") no rompe la clave primaria, simplemente
 * se queda con una.
 *
 * Si la regla buena no existe pero sí una duplicada, se RENOMBRA la duplicada
 * en vez de crear una nueva: así no se pierden las unidades que la llevaban ni
 * su descripción.
 *
 * Es idempotente: pasado una vez, no queda ninguna duplicada que reasignar.
 */
async function mergeDuplicateRules(): Promise<void> {
  const rules = await queryLocal<{ id: number; name: string }>(
    'SELECT id, name FROM special_rules',
    [],
    (r) => ({ id: r.id as number, name: r.name as string }),
  )
  const byName = new Map(rules.map((r) => [normalizeForMatch(r.name), r]))

  for (const [canonicalName, ...duplicates] of RULE_MERGE_GROUPS) {
    let canonical = byName.get(normalizeForMatch(canonicalName))

    if (!canonical) {
      const survivor = duplicates.map((d) => byName.get(normalizeForMatch(d))).find(Boolean)
      if (!survivor) continue
      await execCatalog('UPDATE special_rules SET name = ? WHERE id = ?', [canonicalName, survivor.id])
      canonical = { id: survivor.id, name: canonicalName }
      byName.set(normalizeForMatch(canonicalName), canonical)
    }

    for (const duplicateName of duplicates) {
      const duplicate = byName.get(normalizeForMatch(duplicateName))
      if (!duplicate || duplicate.id === canonical.id) continue

      for (const { table, ownerColumn } of RULE_LINK_TABLES) {
        try {
          await execCatalogBatch([
            {
              sql: `INSERT OR IGNORE INTO ${table} (${ownerColumn}, rule_id)
                    SELECT ${ownerColumn}, ? FROM ${table} WHERE rule_id = ?`,
              params: [canonical.id, duplicate.id],
            },
            { sql: `DELETE FROM ${table} WHERE rule_id = ?`, params: [duplicate.id] },
          ])
        } catch (err) {
          // profile_special_rules puede no existir todavía si el Worker no se
          // ha desplegado con su migración. Se deja constancia y se sigue: el
          // resto de tablas sí se puede unificar, y al no marcar la pasada
          // como hecha se reintentará en la próxima carga.
          console.warn(`[WHArmy] No se pudo reasignar "${duplicateName}" en ${table}:`, err)
          throw err
        }
      }

      await execCatalog('DELETE FROM special_rules WHERE id = ?', [duplicate.id])
      byName.delete(normalizeForMatch(duplicateName))
      console.info(`[WHArmy] Regla "${duplicate.name}" unificada en "${canonical.name}".`)
    }
  }
}

/**
 * Primera carga del criterio "qué monturas salen en Fichas": las que monta
 * algún PERSONAJE, sí; el resto, no.
 *
 * El razonamiento es el del propio juego. La montura de un personaje es una
 * elección suya que cambia su ficha —y suele ser un monstruo con atributos y
 * reglas propios—, así que interesa tenerla impresa aparte. Las cabalgaduras y
 * dotaciones de tropa, en cambio, vienen incluidas en la unidad y no se
 * consultan por separado: llenarían la sección de fichas que nadie imprime.
 *
 * Se aplica UNA vez, con dos sentencias sobre el conjunto entero en vez de
 * fila a fila. Después, la marca es de cada uno: si más adelante alguien marca
 * o desmarca una montura a mano, esta pasada no vuelve a pisarla.
 */
async function seedMountSheetFlags(): Promise<void> {
  // Primero todas a 0 (el estado de partida) y luego se levantan las de
  // personaje: así el resultado no depende de lo que hubiera antes.
  await execCatalog("UPDATE attribute_profiles SET include_in_sheets = 0 WHERE profile_kind = 'montura'", [])
  await execCatalog(
    `UPDATE attribute_profiles SET include_in_sheets = 1
      WHERE profile_kind = 'montura'
        AND id IN (
          SELECT up.profile_id FROM unit_profiles up
          JOIN units u ON u.id = up.unit_id
          WHERE up.role = 'montura' AND u.unit_type = 'personaje'
        )`,
    [],
  )
}

function flagDone(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'done'
  } catch {
    return false
  }
}
function setDone(key: string): void {
  try {
    localStorage.setItem(key, 'done')
  } catch {
    // ignorar (localStorage no disponible)
  }
}

/**
 * Mantenimiento único (por navegador) del catálogo compartido, disparado desde
 * app/DatabaseGate cuando el catálogo local ya está listo. Solo actúa si hay
 * contraseña de grupo guardada (las escrituras la necesitan). Cada bloque tiene
 * su propia marca de "hecho" y su try/catch: si uno falla —p.ej. el Worker aún
 * no tiene la ruta /admin/migrate porque no se ha desplegado— no bloquea al
 * otro y se reintenta en la siguiente carga.
 *
 * 1) Migraciones de esquema (columnas/tablas nuevas).
 * 2) Renombrado de abreviaturas de equipo/opciones a su descripción completa.
 * 3) Correcciones puntuales de datos (ver runDataFixes).
 */
/**
 * Asigna al usuario "admin" los ejércitos que quedaran sin dueño (creados antes
 * de que existieran los usuarios). Se comprueba en CADA carga —no con una marca
 * en localStorage— porque el usuario "admin" puede crearse después: en cuanto
 * exista, la siguiente carga los asigna. Es barato: una lectura, y solo escribe
 * si de verdad hay listas huérfanas.
 *
 * Va aquí, en el cliente, y no en las migraciones del Worker, para que no
 * dependa de volver a desplegarlo: es un UPDATE normal y /mutate lo admite.
 */
export async function ensureArmyListsOwned(): Promise<void> {
  const orphans = await queryOne<number>(
    'SELECT COUNT(*) AS n FROM army_lists WHERE user_id IS NULL',
    [],
    (r) => r.n as number,
  )
  if (!orphans) return

  const adminId = await queryOne<number>(
    'SELECT id FROM users WHERE username = ? COLLATE NOCASE',
    ['admin'],
    (r) => r.id as number,
  )
  if (adminId == null) return

  await exec('UPDATE army_lists SET user_id = ? WHERE user_id IS NULL', [adminId])
}

export async function runCatalogMaintenance(): Promise<void> {
  if (!hasStoredPassword()) return

  try {
    await ensureArmyListsOwned()
  } catch (err) {
    console.warn('[WHArmy] No se pudieron asignar los ejércitos sin dueño:', err)
  }

  // Las migraciones se intentan SIEMPRE, sin marca en localStorage. Son
  // idempotentes y baratas (una petición), y cachearlas fue justo lo que hizo
  // que, al añadir migraciones nuevas, una marca antigua de "ya hecho"
  // impidiera que llegaran a aplicarse nunca.
  try {
    await runMigrations()
  } catch {
    // Worker sin desplegar o sin red: se reintenta en la próxima carga.
  }

  if (!flagDone(RENAME_KEY)) {
    try {
      const equipment = await queryLocal<{ id: number; name: string }>(
        'SELECT id, name FROM equipment_options',
        [],
        (r) => ({ id: r.id as number, name: r.name as string }),
      )
      for (const e of equipment) {
        const full = expandName(e.name, EQUIPMENT_ALIASES)
        if (full !== e.name) await execCatalog('UPDATE equipment_options SET name = ? WHERE id = ?', [full, e.id])
      }

      const upgrades = await queryLocal<{ id: number; name: string }>(
        'SELECT id, name FROM upgrades',
        [],
        (r) => ({ id: r.id as number, name: r.name as string }),
      )
      for (const u of upgrades) {
        const full = expandName(u.name, UPGRADE_ALIASES)
        if (full !== u.name) await execCatalog('UPDATE upgrades SET name = ? WHERE id = ?', [full, u.id])
      }
      setDone(RENAME_KEY)
    } catch (err) {
      console.warn('[WHArmy] No se pudieron aplicar los renombrados del catálogo:', err)
    }
  }

  if (!flagDone(RULE_MERGE_KEY)) {
    try {
      await mergeDuplicateRules()
      setDone(RULE_MERGE_KEY)
    } catch (err) {
      // No se marca como hecha: se reintenta en la próxima carga (p.ej. cuando
      // el Worker ya tenga la tabla profile_special_rules).
      console.warn('[WHArmy] No se pudieron unificar las reglas duplicadas:', err)
    }
  }

  if (!flagDone(MOUNT_SHEETS_KEY)) {
    try {
      await seedMountSheetFlags()
      setDone(MOUNT_SHEETS_KEY)
    } catch (err) {
      // Lo normal aquí es que falte desplegar el Worker con la columna
      // include_in_sheets. No se marca como hecha: se reintenta en la próxima
      // carga, cuando ya exista.
      console.warn('[WHArmy] No se pudo fijar qué monturas salen en Hojas de Unidad:', err)
    }
  }

  if (!flagDone(MAGIC_SEED_KEY)) {
    try {
      // Solo crea las sendas que falten: si ya están, no toca nada. Ver
      // magicSeeding.ts — la marca es un atajo, no la garantía.
      await seedMagicPaths()
      setDone(MAGIC_SEED_KEY)
    } catch (err) {
      // Lo esperable aquí es que falte desplegar el Worker con las tablas de
      // magia. No se marca como hecha: se reintenta en la próxima carga.
      console.warn('[WHArmy] No se pudo cargar el catálogo de sendas de magia:', err)
    }
  }

  if (!flagDone(ETIQUETAS_MAGIA_KEY)) {
    try {
      // "Hechicero" y "Archimago" son etiquetas de tipo normales, como
      // Infantería o Caballería (así lo pidió el usuario).
      await UnitTypeTagRepository.ensureMagicTags()
      setDone(ETIQUETAS_MAGIA_KEY)
    } catch (err) {
      console.warn('[WHArmy] No se pudieron crear las etiquetas Hechicero/Archimago:', err)
    }
  }

  if (!flagDone(DATA_FIX_KEY)) {
    try {
      await runDataFixes()
      setDone(DATA_FIX_KEY)
    } catch (err) {
      // P.ej. si el Worker aún no está migrado (falta upgrades.profile_id):
      // no se marca como hecho y se reintenta en la próxima carga. Se registra
      // en consola porque, tragado en silencio, era imposible saber por qué no
      // se aplicaban las correcciones.
      console.warn('[WHArmy] No se pudieron aplicar las correcciones de datos:', err)
    }
  }
}
