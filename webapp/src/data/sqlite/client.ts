// ============================================================================
// Cliente HTTP hacia la API compartida (Cloudflare Worker + D1).
//
// Modelo de persistencia (backend compartido, sin estado local real):
//   - Todos los datos (maestros + lo editado desde Admin/constructor de
//     listas) viven en una única base de datos D1 en Cloudflare, servida por
//     el Worker de webapp/worker/. Ya no hay copia local en IndexedDB: cada
//     lectura y escritura va por red.
//   - Las lecturas (`query`/`queryOne`) son públicas, sin contraseña.
//   - Las escrituras (`exec`/`execBatch`) y "Restaurar datos de fábrica"
//     (`resetToSeed`) requieren la contraseña de grupo — ver
//     data/network/auth.ts. Si el servidor la rechaza (401), se lanza
//     `AuthRequiredError` para que la UI pueda distinguirlo de otros errores
//     y pedir la contraseña de nuevo.
//
// Esta es la única pieza de la app que sabe que el transporte es HTTP contra
// el Worker. Todo lo demás (repositorios, dominio, UI) solo ve funciones
// async con la misma forma que tenían con sql.js.
//
// Excepción: los 5 repositorios de CATÁLOGO (facciones, unidades, reglas,
// catálogos auxiliares, monturas/carros) no llaman a `query`/`queryOne`/
// `exec`/`execBatch` de este módulo para sus lecturas — usan
// `queryLocal`/`queryLocalOne` de data/sqlite/localCatalog.ts contra una
// copia en memoria (sql.js) construida una vez por sesión desde GET
// /snapshot, porque el catálogo es pequeño y casi no cambia. Sus escrituras
// sí siguen yendo por red (fuente de verdad) pero a través de
// `execCatalog`/`execCatalogBatch` de aquí mismo, que además replican la
// escritura en esa copia local — ver el comentario de esas funciones más
// abajo. Las listas de ejército (army_lists/army_list_entries/...) no
// entran en ninguno de estos dos mecanismos: siguen siendo 100% de red con
// `query`/`queryOne`/`exec`/`execBatch` normales (ver armyListRepository.ts).
// ============================================================================
import { clearPassword, getStoredPasswordHash } from '@/data/network/auth'
import { applyLocalWrite, invalidateLocalCatalog } from '@/data/sqlite/localCatalog'

// Cuando el servidor rechaza una escritura por contraseña incorrecta/ausente
// (401), se borra aquí mismo el hash guardado (ver clearPassword) antes de
// propagar el error: así <PasswordGate> reacciona al instante (se suscribe a
// data/network/auth.ts#onAuthChange) y vuelve a pedir la contraseña, en vez
// de dejar que cada pantalla que escribe tenga que acordarse de hacerlo.

function getApiBaseUrl(): string {
  const url = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (!url) {
    throw new Error(
      'Falta VITE_API_BASE_URL: define la URL del Worker de la API (ver .env.example) antes de usar la app.',
    )
  }
  return url
}

/** Se lanza cuando el servidor rechaza una escritura por contraseña de grupo ausente/incorrecta (401). */
export class AuthRequiredError extends Error {
  constructor(message = 'Contraseña de grupo incorrecta o ausente.') {
    super(message)
    this.name = 'AuthRequiredError'
  }
}

const changeListeners = new Set<() => void>()

/** Se suscribe a cambios en los datos (para que la UI pueda refrescar listados tras un CRUD). */
export function onDatabaseChange(listener: () => void): () => void {
  changeListeners.add(listener)
  return () => changeListeners.delete(listener)
}

function notifyChange(): void {
  for (const listener of changeListeners) listener()
}

/** Tipo de parámetro admitido en consultas: escalares habituales + BLOB (Uint8Array) para columnas binarias como emblem_data. */
export type SqlParam = string | number | null | Uint8Array

/** Representación serializable en JSON de un BLOB — debe coincidir con el esquema del Worker (ver worker/src/index.ts). */
interface Base64Blob {
  __b64: string
}

function isBase64Blob(value: unknown): value is Base64Blob {
  return typeof value === 'object' && value !== null && '__b64' in value && typeof (value as Base64Blob).__b64 === 'string'
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Convierte cualquier Uint8Array de los params a `{__b64}` para que el body JSON sea serializable. */
function encodeParams(params: readonly unknown[]): unknown[] {
  return params.map((param) => (param instanceof Uint8Array ? { __b64: bytesToBase64(param) } : param))
}

/** Decodifica de vuelta cualquier valor `{__b64}` de una fila recibida a Uint8Array, para que `mapRow` reciba lo mismo que antes recibía de sql.js. */
function decodeRow(row: Record<string, unknown>): Record<string, unknown> {
  const decoded: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    decoded[key] = isBase64Blob(value) ? base64ToBytes(value.__b64) : value
  }
  return decoded
}

// Bookmark de la D1 Sessions API (ver worker/src/index.ts): permite que
// Cloudflare encamine las lecturas a la réplica más cercana al usuario (Read
// Replication) sin perder consistencia — cada respuesta del Worker devuelve
// el bookmark más reciente en esta cabecera, y aquí se reenvía en la
// siguiente petición para que una lectura justo después de una escritura
// propia siempre la vea, la sirva la réplica que la sirva. Vive en memoria
// (una recarga de página empieza una sesión nueva, "sin restricciones" —
// eso es intencionado y seguro, ver documentación de D1 Sessions).
const BOOKMARK_HEADER = 'X-D1-Bookmark'
let bookmark: string | null = null

async function postJson<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bookmark) headers[BOOKMARK_HEADER] = bookmark

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const receivedBookmark = res.headers.get(BOOKMARK_HEADER)
  if (receivedBookmark) bookmark = receivedBookmark

  const data = (await res.json().catch(() => ({}))) as T
  return { status: res.status, data }
}

/** SELECT tipado genérico. `mapRow` convierte cada fila en un objeto de dominio. */
export async function query<T>(
  sql: string,
  params: SqlParam[],
  mapRow: (row: Record<string, unknown>) => T,
): Promise<T[]> {
  const { status, data } = await postJson<{ rows?: Record<string, unknown>[]; error?: string }>('/query', {
    sql,
    params: encodeParams(params),
  })
  if (status !== 200) {
    throw new Error(data.error ?? `Error de consulta (${status}).`)
  }
  return (data.rows ?? []).map((row) => mapRow(decodeRow(row)))
}

export async function queryOne<T>(
  sql: string,
  params: SqlParam[],
  mapRow: (row: Record<string, unknown>) => T,
): Promise<T | null> {
  const rows = await query(sql, params, mapRow)
  return rows[0] ?? null
}

export interface BatchStatement {
  sql: string
  params: SqlParam[]
}

export interface BatchResult {
  insertId: number
  changes: number
}

/**
 * Ejecuta varias sentencias INSERT/UPDATE/DELETE como un único batch atómico
 * en el servidor. Es lo que usan tanto `exec` (una sola sentencia) como los
 * repositorios que antes hacían varios `db.run(...)` + `persist(db)` a mano
 * sobre sql.js (ver factionRepository.setEmblem, armyListRepository.
 * replaceEntryRelations, profileCatalogRepository.addFaction/removeFaction y
 * unitRepository.toggleRelation/toggleProfile/saveUnitDetail).
 */
export async function execBatch(statements: BatchStatement[]): Promise<BatchResult[]> {
  const passwordHash = await getStoredPasswordHash()
  const { status, data } = await postJson<{ results?: BatchResult[]; error?: string }>('/mutate', {
    statements: statements.map((s) => ({ sql: s.sql, params: encodeParams(s.params) })),
    passwordHash,
  })
  if (status === 401) {
    clearPassword()
    throw new AuthRequiredError()
  }
  if (status !== 200) {
    throw new Error(data.error ?? `Error al guardar (${status}).`)
  }
  notifyChange()
  return data.results ?? []
}

/** INSERT/UPDATE/DELETE. Devuelve el rowid insertado (0 si no aplica). */
export async function exec(sql: string, params: SqlParam[] = []): Promise<number> {
  const [result] = await execBatch([{ sql, params }])
  return result?.insertId ?? 0
}

/**
 * Variante de `execBatch` para escrituras de CATÁLOGO (facciones, unidades,
 * reglas especiales, equipo, mejoras, monturas/carros...): la escritura de
 * red sigue siendo exactamente la misma (fuente de verdad, ver `execBatch`),
 * pero además replica las mismas sentencias sobre la copia local en memoria
 * del catálogo (data/sqlite/localCatalog.ts), para que el propio navegador
 * que hizo el cambio lo vea reflejado al instante en sus propias lecturas
 * locales, sin tener que esperar a una recarga de página. NO usar para
 * army_lists/army_list_entries y afines — esas tablas no forman parte del
 * snapshot local y siguen usando `execBatch`/`exec` directamente (ver
 * armyListRepository.ts).
 */
export async function execCatalogBatch(statements: BatchStatement[]): Promise<BatchResult[]> {
  const results = await execBatch(statements)
  // Los `results` viajan a la copia local para que pueda quedarse con los
  // MISMOS ids que ha asignado D1 (ver forceServerId): cada base lleva su
  // propio AUTOINCREMENT y, si divergen, quien use el id devuelto acaba
  // apuntando a una fila que en local no existe.
  applyLocalWrite(statements, results)
  return results
}

/** Variante de una sola sentencia de `execCatalogBatch`, análoga a `exec`. */
export async function execCatalog(sql: string, params: SqlParam[] = []): Promise<number> {
  const [result] = await execCatalogBatch([{ sql, params }])
  return result?.insertId ?? 0
}

/** Vuelve a los datos de fábrica: borra TODO lo editado desde Administración (para todos los usuarios) y repone los datos maestros. */
export async function resetToSeed(): Promise<void> {
  const passwordHash = await getStoredPasswordHash()
  const { status, data } = await postJson<{ ok?: boolean; error?: string }>('/admin/reset-seed', { passwordHash })
  if (status === 401) {
    clearPassword()
    throw new AuthRequiredError()
  }
  if (status !== 200) {
    throw new Error(data.error ?? `Error al restaurar los datos (${status}).`)
  }
  notifyChange()
  // El reset reescribe TODO el catálogo (borra + repone desde seed-data.ts)
  // sin pasar por `execCatalogBatch`, así que no hay sentencias que replicar
  // aquí uno a uno: más simple y más seguro invalidar la copia local entera
  // y dejar que la próxima lectura de catálogo pida un /snapshot fresco.
  invalidateLocalCatalog()
}

/**
 * Aplica las migraciones de esquema idempotentes en el servidor (ver
 * worker/src/index.ts#MIGRATIONS): añadir columnas nuevas a la D1 en
 * producción, algo que /mutate no permite (solo INSERT/UPDATE/DELETE).
 * Requiere la contraseña de grupo; si no hay, no hace nada.
 */
export async function runMigrations(): Promise<void> {
  const passwordHash = await getStoredPasswordHash()
  if (!passwordHash) return
  const { status, data } = await postJson<{ ok?: boolean; error?: string }>('/admin/migrate', { passwordHash })
  if (status === 401) {
    clearPassword()
    throw new AuthRequiredError()
  }
  if (status !== 200) {
    throw new Error(data.error ?? `Error al migrar (${status}).`)
  }
}

/** Comprueba que la API esté disponible antes de renderizar el resto de la app — ver app/DatabaseGate.tsx. */
export async function ensureReady(): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: 'SELECT 1 as ok', params: [] }),
  })
  if (!res.ok) {
    throw new Error(`No se pudo contactar con la API (${res.status}).`)
  }
}
