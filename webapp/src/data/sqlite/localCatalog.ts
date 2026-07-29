// ============================================================================
// Copia local en memoria del CATÁLOGO (facciones, unidades, reglas
// especiales, equipo, mejoras, perfiles de atributos, roles de mando...)
// usando sql.js (WASM), para que las lecturas de catálogo —muy frecuentes y
// que casi nunca cambian— no tengan que cruzar la red en cada página.
//
// Las listas de ejército (army_lists / army_list_entries / ...) NO forman
// parte de esta copia: cambian constantemente y siguen siendo 100% de red
// (ver data/sqlite/client.ts, data/repositories/armyListRepository.ts).
//
// Modelo:
//   - Al primer uso (primera llamada a `queryLocal`/`queryLocalOne`, o a
//     `preloadLocalCatalog` desde DatabaseGate), se pide GET /snapshot al
//     Worker (ver worker/src/index.ts) y se construye una base de datos
//     sql.js en memoria: primero se ejecuta el DDL completo de
//     db/schema.sql (crea también las tablas de listas de ejército, vacías
//     y sin uso — no merece la pena mantener un segundo DDL recortado solo
//     para esto), y luego se inserta cada fila de cada tabla del snapshot.
//   - Esa base de datos vive solo en memoria de la pestaña: no se persiste
//     en IndexedDB ni en ningún otro sitio. Recargar la página vuelve a
//     pedir el snapshot fresco desde cero.
//   - Cada escritura de catálogo que ya se confirmó contra D1 (ver
//     client.ts#execCatalogBatch) se replica aquí mismo con las mismas
//     sentencias (con sus params ORIGINALES, no los `{__b64}` de red), para
//     que el propio navegador que hizo el cambio lo vea reflejado al
//     instante en sus propias lecturas locales, sin esperar a una recarga.
// ============================================================================
import initSqlJs, { type Database } from 'sql.js'
import schemaSql from '../../../db/schema.sql?raw'
import type { BatchResult, BatchStatement, SqlParam } from '@/data/sqlite/client'

function getApiBaseUrl(): string {
  const url = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (!url) {
    throw new Error(
      'Falta VITE_API_BASE_URL: define la URL del Worker de la API (ver .env.example) antes de usar la app.',
    )
  }
  return url
}

const WASM_URL = `${import.meta.env.BASE_URL}sql-wasm.wasm`

// Las tablas de catálogo que expone GET /snapshot (ver worker/src/
// index.ts#SNAPSHOT_TABLES) — deliberadamente NO incluye army_lists y
// afines. Esta lista debe ir en paralelo con la del Worker.
const CATALOG_TABLES = [
  'factions',
  'unit_categories',
  'unit_type_tags',
  'attribute_profiles',
  'profile_factions',
  'special_rules',
  'profile_special_rules',
  'equipment_options',
  'equipment_incompatibilities',
  'upgrades',
  'upgrade_incompatibilities',
  'upgrade_special_rules',
  'command_roles',
  'units',
  'unit_profiles',
  'unit_special_rules',
  'unit_equipment_options',
  'unit_upgrade_options',
  'unit_command_options',
  'faction_construction_rules',
  'import_meta',
  'magic_paths',
  'magic_spells',
  'unit_magic_paths',
  'category_composition_rules',
] as const

type CatalogSnapshot = Partial<Record<(typeof CATALOG_TABLES)[number], Record<string, unknown>[]>>

/** Representación serializable en JSON de un BLOB — mismo esquema que client.ts/worker/src/index.ts. */
interface Base64Blob {
  __b64: string
}

function isBase64Blob(value: unknown): value is Base64Blob {
  return typeof value === 'object' && value !== null && '__b64' in value && typeof (value as Base64Blob).__b64 === 'string'
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function fetchSnapshot(): Promise<CatalogSnapshot> {
  const res = await fetch(`${getApiBaseUrl()}/snapshot`)
  if (!res.ok) {
    throw new Error(`No se pudo cargar el catálogo (${res.status}).`)
  }
  return (await res.json()) as CatalogSnapshot
}

/** Inserta una fila decodificando de vuelta cualquier valor `{__b64}` a Uint8Array (sql.js sí acepta Uint8Array nativo). */
function insertRow(db: Database, table: string, row: Record<string, unknown>): void {
  const columns = Object.keys(row)
  if (columns.length === 0) return
  const placeholders = columns.map(() => '?').join(', ')
  const values = columns.map((column) => {
    const value = row[column]
    return isBase64Blob(value) ? base64ToBytes(value.__b64) : (value as SqlParam)
  })
  db.run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values)
}

async function buildLocalDb(): Promise<Database> {
  const [SQL, snapshot] = await Promise.all([initSqlJs({ locateFile: () => WASM_URL }), fetchSnapshot()])
  const db = new SQL.Database()
  // DDL completo (fuente de verdad única — ver db/schema.sql): crea también
  // las tablas de listas de ejército, que quedan vacías y no se usan aquí.
  db.run(schemaSql)
  db.run('BEGIN TRANSACTION')
  try {
    for (const table of CATALOG_TABLES) {
      for (const row of snapshot[table] ?? []) {
        insertRow(db, table, row)
      }
    }
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  return db
}

let dbInstance: Database | null = null
let loadPromise: Promise<Database> | null = null

async function getLocalDb(): Promise<Database> {
  if (dbInstance) return dbInstance
  if (!loadPromise) {
    loadPromise = buildLocalDb().catch((err: unknown) => {
      // Si la construcción falla (red caída, /snapshot con error...), se
      // limpia loadPromise para que el siguiente intento (p.ej. tras
      // recuperar la conexión) vuelva a intentarlo en vez de quedarse
      // repitiendo para siempre el mismo error cacheado.
      loadPromise = null
      throw err
    })
  }
  dbInstance = await loadPromise
  return dbInstance
}

/** Dispara la carga del catálogo local sin bloquear al llamador más de lo necesario — ver app/DatabaseGate.tsx. */
export async function preloadLocalCatalog(): Promise<void> {
  await getLocalDb()
}

/**
 * Descarta la copia local cargada (si la hay). La próxima lectura de
 * catálogo volverá a pedir /snapshot desde cero. Se usa tras "Restaurar
 * datos de fábrica" (ver client.ts#resetToSeed): ese reset borra y repone el
 * catálogo entero con sentencias que no pasan por `execCatalogBatch`, así
 * que no hay un conjunto de sentencias que replicar aquí — más simple y más
 * seguro invalidar del todo y dejar que se recargue sola.
 */
export function invalidateLocalCatalog(): void {
  dbInstance = null
  loadPromise = null
}

/** SELECT tipado genérico contra la copia local de catálogo. `mapRow` convierte cada fila en un objeto de dominio. */
export async function queryLocal<T>(
  sql: string,
  params: SqlParam[],
  mapRow: (row: Record<string, unknown>) => T,
): Promise<T[]> {
  const db = await getLocalDb()
  const stmt = db.prepare(sql)
  try {
    stmt.bind(params)
    const rows: T[] = []
    while (stmt.step()) {
      rows.push(mapRow(stmt.getAsObject()))
    }
    return rows
  } finally {
    stmt.free()
  }
}

export async function queryLocalOne<T>(
  sql: string,
  params: SqlParam[],
  mapRow: (row: Record<string, unknown>) => T,
): Promise<T | null> {
  const rows = await queryLocal(sql, params, mapRow)
  return rows[0] ?? null
}

/**
 * Aplica sobre la copia local ya cargada las mismas sentencias que se acaban
 * de confirmar contra D1 (ver client.ts#execCatalogBatch). Si todavía no se
 * ha cargado ninguna copia local en esta sesión (nadie ha leído catálogo
 * aún), es un no-op silencioso: no merece la pena forzar la carga solo para
 * aplicar un mirror-write — la próxima lectura pedirá un snapshot fresco que
 * ya incluirá este cambio (la escritura real ya está confirmada en D1).
 */
export function applyLocalWrite(statements: BatchStatement[], results: BatchResult[] = []): void {
  if (!dbInstance) return
  statements.forEach((statement, index) => {
    dbInstance!.run(statement.sql, statement.params)
    forceServerId(dbInstance!, statement.sql, results[index]?.insertId)
  })
}

const INSERT_TABLE_RE = /^\s*INSERT(?:\s+OR\s+\w+)?\s+INTO\s+([A-Za-z_][A-Za-z0-9_]*)/i

/**
 * Alinea el id que acaba de asignar la copia local con el que asignó D1.
 *
 * Hace falta porque las dos bases llevan su propio contador AUTOINCREMENT: al
 * insertar una unidad, D1 devolvía (p.ej.) 512 mientras la copia local se
 * quedaba con 498, y quien llamaba usaba el id del servidor. Eso hacía que
 * "Nueva unidad" navegase a una ficha inexistente en la copia local y saliera
 * "No se pudo cargar esta unidad." — y dejaba mal enlazadas las filas creadas
 * a continuación con ese id (el perfil base, sin ir más lejos).
 *
 * Solo actúa si la sentencia es un INSERT que ha insertado algo de verdad
 * (un `INSERT OR IGNORE` ignorado no toca nada) y la tabla tiene columna
 * `id`; en las tablas de unión (unit_special_rules y demás) el UPDATE fallaría
 * y se descarta en silencio, que es justo lo correcto: ahí no hay id que
 * cuadrar.
 */
function forceServerId(db: Database, sql: string, serverId: number | undefined): void {
  if (!serverId) return
  if (db.getRowsModified() === 0) return
  const table = INSERT_TABLE_RE.exec(sql)?.[1]
  if (!table) return
  try {
    const localId = db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0]
    if (typeof localId !== 'number' || localId === serverId) return
    db.run(`UPDATE ${table} SET id = ? WHERE id = ?`, [serverId, localId])
  } catch {
    // Tabla sin columna `id` (tablas de unión): no hay nada que alinear.
  }
}
