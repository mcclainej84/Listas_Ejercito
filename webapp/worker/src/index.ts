// ============================================================================
// WHArmy API — Cloudflare Worker que expone la D1 compartida (wharmy-db) al
// frontend estático. Sustituye al antiguo modelo "sql.js + IndexedDB local":
// ahora todos los navegadores leen/escriben la misma base de datos.
//
// Rutas:
//   POST /query              — SELECT/WITH de solo lectura. Público (sin contraseña).
//   POST /mutate              — INSERT/UPDATE/DELETE en batch atómico. Requiere
//                                la contraseña de grupo (hash SHA-256).
//   GET  /snapshot            — Vuelca TODAS las filas de las 18 tablas de
//                                CATÁLOGO (todo menos army_lists y afines) en
//                                un único JSON. Público (sin contraseña, igual
//                                que /query). Lo usa el frontend para cargar
//                                una copia local en memoria (sql.js) del
//                                catálogo al abrir la app — ver
//                                src/data/sqlite/localCatalog.ts. Las listas
//                                de ejército cambian constantemente y NO
//                                forman parte de este volcado: siguen siendo
//                                100% de red vía /query y /mutate.
//   POST /admin/reset-seed    — Borra los datos maestros y los repone desde
//                                seed-data.ts. Requiere la contraseña de grupo.
//
// Seguridad: este Worker es deliberadamente simple (una única "contraseña de
// grupo" compartida, no hay usuarios ni sesiones) porque la app es una
// herramienta de un grupo cerrado de jugadores, no un producto multiusuario.
// La validación de prefijo SQL (SELECT/WITH para /query, INSERT/UPDATE/DELETE
// para /mutate) es la única barrera real contra un cliente comprometido o mal
// escrito — no hay un ORM ni sentencias predefinidas en el servidor.
//
// Rendimiento: el usuario prueba la app desde España mientras que la D1 se
// creó en Norteamérica (Este) — cada consulta cruzaba el Atlántico. En vez de
// recrear la base de datos (D1 no permite cambiar de región tras crearla),
// se activó "Read Replication" en el propio panel de Cloudflare (D1 >
// wharmy-db > Settings) y aquí se usa la D1 Sessions API (`env.DB.
// withSession(bookmark)`) en vez de `env.DB` directamente: Cloudflare crea
// réplicas de solo lectura en varias regiones y encamina cada sesión a la
// más cercana al usuario, sin tocar nada más. El "bookmark" que devuelve
// cada sesión viaja de vuelta al cliente en la cabecera `X-D1-Bookmark`
// (ver data/sqlite/client.ts) y éste lo reenvía en la siguiente petición,
// para que una lectura justo después de una escritura propia siempre vea
// esa escritura (consistencia secuencial dentro de una misma sesión de
// navegador), aunque la sirva una réplica distinta a la del primario.
// ============================================================================

import { SEED_STATEMENTS } from './seed-data'

export interface Env {
  DB: D1Database
  GROUP_PASSWORD_HASH: string
  /**
   * Bucket R2 con las imágenes de las hojas (ilustración y emblema propio).
   *
   * Es OPCIONAL a propósito: mientras no esté configurado el binding, la app
   * sigue funcionando leyendo las imágenes de los BLOB de D1 como siempre
   * (ver el respaldo en unitSheetRepository.mapRow). Así el Worker se puede
   * desplegar antes de habilitar R2 sin dejar la aplicación rota a medias.
   */
  IMAGES?: R2Bucket
}

const BOOKMARK_HEADER = 'X-D1-Bookmark'
/** Cabecera con el hash SHA-256 de la contraseña de grupo, para las peticiones cuyo cuerpo NO es JSON (subida de imágenes). */
const PASSWORD_HEADER = 'X-WHArmy-Password'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': `Content-Type, ${BOOKMARK_HEADER}, ${PASSWORD_HEADER}`,
  'Access-Control-Expose-Headers': BOOKMARK_HEADER,
}

/** Bookmark recibido del cliente (petición anterior) o "primero sin restricciones" si es la primera de la sesión. */
function getIncomingBookmark(request: Request): string {
  return request.headers.get(BOOKMARK_HEADER) ?? 'first-unconstrained'
}

const MAX_MUTATE_STATEMENTS = 50

// Tablas de CATÁLOGO servidas por GET /snapshot, en el mismo orden en que
// aparecen en el JSON de respuesta. Deliberadamente NO incluye army_lists,
// army_list_entries, army_list_entry_equipment ni army_list_entry_upgrades:
// esas cambian constantemente y siguen siendo 100% de red (ver nota de
// rutas al inicio del archivo).
const SNAPSHOT_TABLES = [
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
  'faction_featured_rules',
  'import_meta',
  // Magia: es catálogo puro (30 sendas, 213 hechizos, texto corto) y se
  // consulta al pintar cualquier ficha de hechicero, así que viaja en el
  // snapshot como el resto en vez de pedirse por red una y otra vez.
  'magic_paths',
  'magic_spells',
  'unit_magic_paths',
  'category_composition_rules',
  // Apéndices: texto largo con formato, pero se lee siempre junto a la ficha
  // de la unidad, así que viaja con el resto del catálogo.
  'unit_appendices',
] as const

/** Representación serializable en JSON de un BLOB (ver shared/image.ts en el frontend: mismo esquema base64). */
interface Base64Blob {
  __b64: string
}

function isBase64Blob(value: unknown): value is Base64Blob {
  return (
    typeof value === 'object' && value !== null && '__b64' in value && typeof (value as Base64Blob).__b64 === 'string'
  )
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/** Decodifica los parámetros `{__b64}` recibidos del cliente a Uint8Array antes de pasarlos a D1. */
function decodeParams(params: unknown[]): unknown[] {
  return params.map((param) => (isBase64Blob(param) ? base64ToBytes(param.__b64) : param))
}

/** Recorre las filas de un resultado D1 y convierte cualquier columna BLOB (ArrayBuffer) a `{__b64}` serializable. */
function encodeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const encoded: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      if (value instanceof ArrayBuffer) {
        encoded[key] = { __b64: bytesToBase64(new Uint8Array(value)) }
      } else if (value instanceof Uint8Array) {
        encoded[key] = { __b64: bytesToBase64(value) }
      } else {
        encoded[key] = value
      }
    }
    return encoded
  })
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

function startsWithKeyword(sql: string, keywords: string[]): boolean {
  const normalized = sql.trim().toUpperCase()
  return keywords.some((keyword) => normalized.startsWith(keyword))
}

async function checkPassword(env: Env, passwordHash: unknown): Promise<boolean> {
  return typeof passwordHash === 'string' && passwordHash.length > 0 && passwordHash === env.GROUP_PASSWORD_HASH
}

// ============================================================================
// /image/<clave> — imágenes de las hojas en R2
// ============================================================================
//
// POR QUÉ NO SIGUEN EN D1. Una ilustración guardada como BLOB tiene que
// codificarse en base64 para caber en la respuesta JSON de /query (+33% de
// peso), viaja en el mismo hueco que los datos de la hoja y el navegador NO
// puede cachearla: abrir dos veces la misma hoja la descargaba dos veces. Con
// una URL normal, el navegador la trata como cualquier imagen — la guarda en
// su caché de disco, la pide en paralelo y no vuelve a molestar al Worker.
//
// Las claves llevan el hash del contenido (ver buildImageKey en el cliente),
// así que un archivo dado NUNCA cambia: por eso se puede servir con
// `immutable` y un año de caché sin miedo a que se quede una versión vieja
// pegada. Cambiar la imagen de una hoja genera una clave distinta.
//
// Lectura pública (igual que /query), escritura y borrado con la contraseña
// de grupo en la cabecera X-WHArmy-Password — no en el cuerpo, porque aquí el
// cuerpo son los bytes crudos de la imagen, no JSON.
const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable'
/** Tope defensivo del lado del servidor: el cliente ya comprime a 600 KB (ver shared/image.ts). */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Claves admitidas: letras, números, `-`, `_`, `.` y `/`. Sin `..` ni barras iniciales — nada de salirse del prefijo. */
function isValidImageKey(key: string): boolean {
  if (key.length === 0 || key.length > 300) return false
  if (key.startsWith('/') || key.includes('..') || key.includes('//')) return false
  return /^[A-Za-z0-9/._-]+$/.test(key)
}

async function onImage(request: Request, env: Env, url: URL): Promise<Response> {
  const key = decodeURIComponent(url.pathname.slice('/image/'.length))
  if (!isValidImageKey(key)) {
    return jsonResponse({ error: 'Clave de imagen no válida.' }, 400)
  }
  if (!env.IMAGES) {
    return jsonResponse({ error: 'El almacén de imágenes (R2) no está configurado en este Worker.' }, 503)
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    const object = await env.IMAGES.get(key)
    if (!object) return jsonResponse({ error: 'Imagen no encontrada.' }, 404)
    return new Response(request.method === 'HEAD' ? null : object.body, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
        'Cache-Control': IMAGE_CACHE_CONTROL,
        ETag: object.httpEtag,
      },
    })
  }

  if (request.method === 'PUT') {
    if (!(await checkPassword(env, request.headers.get(PASSWORD_HEADER)))) {
      return jsonResponse({ error: 'Contraseña de grupo incorrecta o ausente.' }, 401)
    }
    const contentType = request.headers.get('Content-Type') ?? ''
    if (!contentType.startsWith('image/')) {
      return jsonResponse({ error: 'El contenido debe ser una imagen.' }, 400)
    }
    const body = await request.arrayBuffer()
    if (body.byteLength === 0) return jsonResponse({ error: 'Imagen vacía.' }, 400)
    if (body.byteLength > MAX_IMAGE_BYTES) {
      return jsonResponse({ error: 'La imagen supera el tamaño máximo permitido.' }, 413)
    }
    await env.IMAGES.put(key, body, { httpMetadata: { contentType, cacheControl: IMAGE_CACHE_CONTROL } })
    return jsonResponse({ key }, 201)
  }

  if (request.method === 'DELETE') {
    if (!(await checkPassword(env, request.headers.get(PASSWORD_HEADER)))) {
      return jsonResponse({ error: 'Contraseña de grupo incorrecta o ausente.' }, 401)
    }
    await env.IMAGES.delete(key)
    return jsonResponse({ deleted: key })
  }

  return jsonResponse({ error: 'Método no permitido.' }, 405)
}

interface QueryRequestBody {
  sql: string
  params: unknown[]
}

// --- Sentencias de borrado de datos maestros, en orden inverso de FKs. ------
const RESET_DELETE_TABLES = [
  // El registro de cambios se vacía también: "restaurar datos de fábrica"
  // borra el catálogo al que apuntaban esas entradas, así que dejarlas sería
  // conservar un historial de cosas que ya no existen.
  'change_log',
  'army_list_entry_equipment',
  'army_list_entry_upgrades',
  'army_list_entries',
  'army_lists',
  'faction_construction_rules',
  'unit_command_options',
  'unit_upgrade_options',
  'unit_equipment_options',
  'unit_special_rules',
  'unit_profiles',
  'units',
  'command_roles',
  'upgrade_incompatibilities',
  'upgrade_special_rules',
  'upgrades',
  'equipment_incompatibilities',
  'equipment_options',
  'profile_special_rules',
  'special_rules',
  'profile_factions',
  'attribute_profiles',
  'unit_categories',
  'factions',
  'import_meta',
]

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)

    try {
      if (request.method === 'POST' && url.pathname === '/query') {
        return await onQuery(request, env)
      }
      if (request.method === 'POST' && url.pathname === '/mutate') {
        return await onMutate(request, env)
      }
      if (request.method === 'GET' && url.pathname === '/snapshot') {
        return await onSnapshot(request, env)
      }
      if (request.method === 'POST' && url.pathname === '/admin/reset-seed') {
        return await onResetSeed(request, env)
      }
      if (request.method === 'POST' && url.pathname === '/admin/migrate') {
        return await onMigrate(request, env)
      }
      if (url.pathname.startsWith('/image/')) {
        return await onImage(request, env, url)
      }
      return jsonResponse({ error: 'Not found' }, 404)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return jsonResponse({ error: message }, 500)
    }
  },
}

async function onQuery(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as QueryRequestBody
  const sql = body.sql ?? ''
  const params = Array.isArray(body.params) ? body.params : []

  if (!startsWithKeyword(sql, ['SELECT', 'WITH'])) {
    return jsonResponse({ error: 'Solo se permiten sentencias SELECT/WITH en /query.' }, 400)
  }

  // Sessions API: encamina esta lectura a la réplica más cercana al usuario
  // (si Read Replication está activada en el panel de Cloudflare) en vez de
  // ir siempre al primario. Ver la nota de rendimiento al inicio del archivo.
  const session = env.DB.withSession(getIncomingBookmark(request))
  const stmt = session.prepare(sql).bind(...decodeParams(params))
  const result = await stmt.all()
  const rows = encodeRows((result.results ?? []) as Record<string, unknown>[])
  return jsonResponse({ rows }, 200, { [BOOKMARK_HEADER]: session.getBookmark() ?? '' })
}

/**
 * Vuelca las 18 tablas de catálogo en un único JSON, para que el frontend
 * construya su copia local en memoria (sql.js) — ver
 * src/data/sqlite/localCatalog.ts. Usa la misma D1 Sessions API que /query
 * (reutiliza getIncomingBookmark/BOOKMARK_HEADER: una sola sesión para las
 * 18 lecturas). Las 18 SELECT son independientes entre sí, así que se lanzan
 * todas en paralelo con Promise.all sobre esa misma sesión.
 */
async function onSnapshot(request: Request, env: Env): Promise<Response> {
  const session = env.DB.withSession(getIncomingBookmark(request))
  // Cada tabla se consulta por separado y TOLERANDO que no exista todavía: si
  // se añade una tabla nueva al catálogo, el Worker puede desplegarse antes de
  // que la migración la haya creado (la migración la dispara el propio
  // frontend, que necesita este snapshot para arrancar). Sin esta tolerancia
  // se produce un bloqueo circular: el snapshot falla con 500 -> la app no
  // carga -> la migración no llega a ejecutarse nunca.
  const results = await Promise.all(
    SNAPSHOT_TABLES.map(async (table) => {
      try {
        const res = await session.prepare(`SELECT * FROM ${table}`).all()
        return (res.results ?? []) as Record<string, unknown>[]
      } catch {
        return [] as Record<string, unknown>[]
      }
    }),
  )

  const snapshot: Record<string, Record<string, unknown>[]> = {}
  SNAPSHOT_TABLES.forEach((table, index) => {
    snapshot[table] = encodeRows(results[index])
  })

  return jsonResponse(snapshot, 200, { [BOOKMARK_HEADER]: session.getBookmark() ?? '' })
}

interface MutateStatement {
  sql: string
  params: unknown[]
}

interface MutateRequestBody {
  statements: MutateStatement[]
  passwordHash: string
}

async function onMutate(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as MutateRequestBody

  if (!(await checkPassword(env, body.passwordHash))) {
    return jsonResponse({ error: 'Contraseña de grupo incorrecta o ausente.' }, 401)
  }

  const statements = Array.isArray(body.statements) ? body.statements : []
  if (statements.length === 0) {
    return jsonResponse({ results: [] })
  }
  if (statements.length > MAX_MUTATE_STATEMENTS) {
    return jsonResponse({ error: `Demasiadas sentencias en un mismo batch (máximo ${MAX_MUTATE_STATEMENTS}).` }, 400)
  }
  for (const statement of statements) {
    if (!startsWithKeyword(statement.sql, ['INSERT', 'UPDATE', 'DELETE'])) {
      return jsonResponse({ error: 'Solo se permiten sentencias INSERT/UPDATE/DELETE en /mutate.' }, 400)
    }
  }

  // Las escrituras siempre las resuelve el primario (una sesión no cambia
  // eso), pero usar la sesión aquí también deja su bookmark actualizado con
  // el resultado de esta escritura, para que la siguiente lectura del mismo
  // cliente (con ese bookmark) vea el cambio aunque la sirva una réplica.
  const session = env.DB.withSession(getIncomingBookmark(request))
  const prepared = statements.map((statement) =>
    session.prepare(statement.sql).bind(...decodeParams(statement.params ?? [])),
  )
  const batchResults = await session.batch(prepared)
  const results = batchResults.map((r) => ({
    insertId: r.meta.last_row_id,
    changes: r.meta.changes,
  }))
  return jsonResponse({ results }, 200, { [BOOKMARK_HEADER]: session.getBookmark() ?? '' })
}

interface MigrateRequestBody {
  passwordHash: string
}

// Migraciones idempotentes de esquema que el frontend no puede aplicar por
// /mutate (que solo admite INSERT/UPDATE/DELETE): añaden columnas nuevas a la
// D1 en producción. Cada una se envuelve en try/catch para poder ejecutarlas
// tantas veces como haga falta sin romper si ya estaban aplicadas ("duplicate
// column name"). Requiere la contraseña de grupo.
const MIGRATIONS: string[] = [
  'ALTER TABLE units ADD COLUMN active INTEGER NOT NULL DEFAULT 1',
  // Opciones de unidad con ficha propia (grupos de apoyo y similares).
  'ALTER TABLE upgrades ADD COLUMN profile_id INTEGER REFERENCES attribute_profiles(id)',
  'ALTER TABLE upgrades ADD COLUMN include_in_sheets INTEGER NOT NULL DEFAULT 0',
  `CREATE TABLE IF NOT EXISTS upgrade_special_rules (
     upgrade_id INTEGER NOT NULL REFERENCES upgrades(id) ON DELETE CASCADE,
     rule_id    INTEGER NOT NULL REFERENCES special_rules(id) ON DELETE CASCADE,
     PRIMARY KEY (upgrade_id, rule_id)
   )`,
  // Usuarios (perfiles) y sus preferencias.
  `CREATE TABLE IF NOT EXISTS users (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     username      TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     created_at    TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS user_hidden_factions (
     user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     faction_id INTEGER NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
     PRIMARY KEY (user_id, faction_id)
   )`,
  // Ancho por apartado de texto en cada ficha (JSON, ver domain/sheetSections).
  "ALTER TABLE unit_sheets ADD COLUMN section_widths TEXT NOT NULL DEFAULT '{}'",
  "ALTER TABLE sheet_presentations ADD COLUMN section_widths TEXT NOT NULL DEFAULT '{}'",
  // Facción favorita del usuario (preseleccionada en todas las pantallas).
  'ALTER TABLE users ADD COLUMN favorite_faction_id INTEGER REFERENCES factions(id)',
  // Reglas especiales destacadas por usuario y facción. OBSOLETA: las reglas
  // destacadas pasaron a ser del CATÁLOGO (faction_featured_rules, más abajo),
  // iguales para todos. Se deja la tabla porque borrarla haría desaparecer sin
  // vuelta atrás lo que cada usuario tuviera marcado; ya no se lee ni escribe.
  `CREATE TABLE IF NOT EXISTS user_faction_rules (
     user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     faction_id INTEGER NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
     rule_id    INTEGER NOT NULL REFERENCES special_rules(id) ON DELETE CASCADE,
     PRIMARY KEY (user_id, faction_id, rule_id)
   )`,
  // Fichas de atributos ocultas en cada hoja (JSON con sus claves).
  "ALTER TABLE unit_sheets ADD COLUMN hidden_profiles TEXT NOT NULL DEFAULT '[]'",
  "ALTER TABLE sheet_presentations ADD COLUMN hidden_profiles TEXT NOT NULL DEFAULT '[]'",
  // Presentación de las fichas que no son unidades (monturas y opciones).
  `CREATE TABLE IF NOT EXISTS sheet_presentations (
     kind               TEXT NOT NULL,
     ref_id             INTEGER NOT NULL,
     illu_data          BLOB,
     illu_mime          TEXT,
     illu_original_name TEXT,
     illu_width_pct     INTEGER NOT NULL DEFAULT 34,
     illu_pos_x         REAL,
     illu_pos_y         REAL,
     illu_brightness    INTEGER NOT NULL DEFAULT 100,
     illu_flipped       INTEGER NOT NULL DEFAULT 0,
     emblem_data        BLOB,
     emblem_mime        TEXT,
     card_max_height    INTEGER NOT NULL DEFAULT 800,
     completed          INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (kind, ref_id)
   )`,
  // Monturas/carros que aparecen como ficha propia en la sección "Fichas".
  'ALTER TABLE attribute_profiles ADD COLUMN include_in_sheets INTEGER NOT NULL DEFAULT 0',
  // Registro de cambios del editor (sección "Log").
  `CREATE TABLE IF NOT EXISTS change_log (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     created_at  TEXT NOT NULL,
     user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
     username    TEXT NOT NULL,
     entity      TEXT NOT NULL,
     entity_id   INTEGER,
     action      TEXT NOT NULL,
     description TEXT NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS idx_change_log_created_at ON change_log (created_at DESC)',
  // "0-1" es un distintivo de tropas: los personajes que quedaran marcados
  // (por un import antiguo que leyera el "0-1" del libro) se limpian. El
  // frontend además ignora is_unique en los personajes al leerlos, así que
  // esto solo cierra el círculo en el dato guardado.
  "UPDATE units SET is_unique = 0 WHERE unit_type = 'personaje' AND is_unique = 1",
  // Reglas especiales propias de una montura/monstruo del catálogo.
  `CREATE TABLE IF NOT EXISTS profile_special_rules (
     profile_id INTEGER NOT NULL REFERENCES attribute_profiles(id) ON DELETE CASCADE,
     rule_id    INTEGER NOT NULL REFERENCES special_rules(id) ON DELETE CASCADE,
     PRIMARY KEY (profile_id, rule_id)
   )`,
  'ALTER TABLE army_lists ADD COLUMN user_id INTEGER REFERENCES users(id)',
  // Los ejércitos son privados de cada usuario, así que los que venían de antes
  // (sin dueño) se asignan al usuario "admin". Es idempotente: en cuanto no
  // queden listas sin dueño no hace nada, y si todavía no existe ese usuario
  // tampoco toca nada (el EXISTS lo impide) y se reintenta en la próxima carga.
  `UPDATE army_lists
      SET user_id = (SELECT id FROM users WHERE username = 'admin' COLLATE NOCASE)
    WHERE user_id IS NULL
      AND EXISTS (SELECT 1 FROM users WHERE username = 'admin' COLLATE NOCASE)`,
  // Imágenes de las hojas en R2: la base pasa a guardar solo la CLAVE del
  // objeto, no sus bytes. Las columnas *_data se conservan como respaldo hasta
  // que la migración de imágenes las vacíe (ver "Migrar imágenes a R2" en
  // Editor > Registro): mientras una fila tenga bytes y no tenga clave, se
  // sigue leyendo de ahí, así que nada deja de verse a mitad de camino.
  'ALTER TABLE unit_sheets ADD COLUMN illu_key TEXT',
  'ALTER TABLE unit_sheets ADD COLUMN emblem_key TEXT',
  'ALTER TABLE sheet_presentations ADD COLUMN illu_key TEXT',
  'ALTER TABLE sheet_presentations ADD COLUMN emblem_key TEXT',

  // --------------------------------------------------------------------------
  // MAGIA. Una senda es un conjunto de hechizos (Fuego, Nigromancia…) dentro de
  // uno de cuatro grupos cerrados; un personaje hechicero tiene un nivel (1-4)
  // y puede conocer VARIAS sendas, de ahí la tabla de unión.
  // --------------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS magic_paths (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     code       TEXT NOT NULL UNIQUE,
     name       TEXT NOT NULL,
     group_code TEXT NOT NULL,
     sort_order INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS magic_spells (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     path_id       INTEGER NOT NULL REFERENCES magic_paths(id) ON DELETE CASCADE,
     level         INTEGER NOT NULL,
     name          TEXT NOT NULL,
     difficulty    TEXT,
     range_text    TEXT,
     hits          TEXT,
     damage        TEXT,
     stays_active  INTEGER NOT NULL DEFAULT 0,
     cac           TEXT,
     rules         TEXT,
     sort_order    INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS unit_magic_paths (
     unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
     path_id INTEGER NOT NULL REFERENCES magic_paths(id) ON DELETE CASCADE,
     PRIMARY KEY (unit_id, path_id)
   )`,
  // Nivel de mago. NULL = la unidad no es hechicera, que es la inmensa mayoría.
  'ALTER TABLE units ADD COLUMN magic_level INTEGER',

  // Nombre propio de una entrada de lista ("Jules el Bretón"), para poder
  // bautizar a los personajes sin perder de qué tipo son.
  'ALTER TABLE army_list_entries ADD COLUMN alias TEXT',

  // Composición del ejército: cuántas unidades de cada categoría son
  // obligatorias o como mucho permitidas, según los puntos de la lista. Es
  // configuración GLOBAL (una sola para todos los ejércitos) — ver
  // domain/armyComposition.ts.
  `CREATE TABLE IF NOT EXISTS category_composition_rules (
     category_id INTEGER PRIMARY KEY REFERENCES unit_categories(id) ON DELETE CASCADE,
     kind        TEXT NOT NULL,
     base        INTEGER NOT NULL DEFAULT 0,
     step        INTEGER NOT NULL DEFAULT 0
   )`,

  // Marca de hechicero. Solo dice SI la unidad lanza hechizos; qué sendas y de
  // qué nivel se decide al meterla en un ejército, no en el catálogo.
  'ALTER TABLE units ADD COLUMN is_wizard INTEGER NOT NULL DEFAULT 0',

  // Sendas de una entrada de lista, con su NIVEL propio: un mismo hechicero
  // puede llevar Fuego nivel 2 y Bestias nivel 1 a la vez, de ahí que el nivel
  // viva en esta tabla y no en la unidad.
  `CREATE TABLE IF NOT EXISTS army_list_entry_magic_paths (
     entry_id INTEGER NOT NULL REFERENCES army_list_entries(id) ON DELETE CASCADE,
     path_id  INTEGER NOT NULL REFERENCES magic_paths(id) ON DELETE CASCADE,
     level    INTEGER NOT NULL DEFAULT 1,
     PRIMARY KEY (entry_id, path_id)
   )`,
  // Reglas destacadas de cada FACCIÓN. Sustituye a user_faction_rules: son
  // parte del catálogo compartido, no una preferencia de cada usuario, así que
  // lo que se marque aquí lo ve todo el mundo. Nace vacía a propósito.
  `CREATE TABLE IF NOT EXISTS faction_featured_rules (
     faction_id INTEGER NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
     rule_id    INTEGER NOT NULL REFERENCES special_rules(id) ON DELETE CASCADE,
     PRIMARY KEY (faction_id, rule_id)
   )`,
  // Opciones de la lista de ejército, por usuario. Por defecto ENCENDIDAS (1):
  // el que no las quiera las apaga, pero quien no sepa que existen ve los
  // datos, que es lo contrario de estrenarlas ocultas y no enterarse nunca.
  'ALTER TABLE users ADD COLUMN show_mounts INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE users ADD COLUMN show_magic INTEGER NOT NULL DEFAULT 1',
  // Coste escrito a mano para una entrada, que pisa el calculado. NULL = usar
  // el cálculo. Se distingue a propósito de 0, que es un coste válido
  // ("gratis") y no lo mismo que "sin retocar".
  'ALTER TABLE army_list_entries ADD COLUMN cost_override INTEGER',
  // Ejércitos COMPARTIDOS: una fila por lista y usuario con quien se comparte.
  // El destinatario la ve, pero no la puede tocar; quien manda sigue siendo
  // army_lists.user_id.
  `CREATE TABLE IF NOT EXISTS army_list_shares (
     army_list_id INTEGER NOT NULL REFERENCES army_lists(id) ON DELETE CASCADE,
     user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     PRIMARY KEY (army_list_id, user_id)
   )`,
  // Despliegue: dónde se coloca cada entrada de la lista sobre la mesa.
  // Las coordenadas van en CENTÍMETROS reales de mesa (0..180 x 0..120) y no
  // en píxeles: así el plan sigue valiendo aunque el lienzo se dibuje a otro
  // tamaño en otra pantalla.
  `CREATE TABLE IF NOT EXISTS army_list_deployments (
     entry_id INTEGER PRIMARY KEY REFERENCES army_list_entries(id) ON DELETE CASCADE,
     x_cm     REAL NOT NULL,
     y_cm     REAL NOT NULL
   )`,
  // ¿Esta persona ve también el DESPLIEGUE, o solo la lista? Por defecto no:
  // enseñarle el ejército a un rival no debería enseñarle dónde vas a colocar.
  'ALTER TABLE army_list_shares ADD COLUMN share_deployment INTEGER NOT NULL DEFAULT 0',
  // Tamaño de peana ESTÁNDAR de cada etiqueta, en cm (ver domain/deployment).
  // Se siembra con los valores que estaban escritos a fuego en el código.
  'ALTER TABLE unit_type_tags ADD COLUMN base_width_cm REAL NOT NULL DEFAULT 12',
  'ALTER TABLE unit_type_tags ADD COLUMN base_height_cm REAL NOT NULL DEFAULT 10',
  `UPDATE unit_type_tags SET base_width_cm = 4, base_height_cm = 4
    WHERE code IN ('PERSONAJE','HECHICERO','ARCHIMAGO','MAQUINA_GUERRA','ASEDIO')`,
  "UPDATE unit_type_tags SET base_width_cm = 5, base_height_cm = 10 WHERE code = 'CARRO'",
  // Medidas de la mesa de CADA lista: no todo el mundo juega en 180 × 120.
  'ALTER TABLE army_lists ADD COLUMN table_width_cm REAL NOT NULL DEFAULT 180',
  'ALTER TABLE army_lists ADD COLUMN table_height_cm REAL NOT NULL DEFAULT 120',
  // Tamaño de una peana CONCRETA sobre la mesa, si se ha ajustado a mano.
  // NULL = usar el estándar de su etiqueta.
  'ALTER TABLE army_list_deployments ADD COLUMN w_cm REAL',
  'ALTER TABLE army_list_deployments ADD COLUMN h_cm REAL',
  // MAPAS: mesas con escenografía, independientes de los ejércitos. Se guardan
  // en cm reales como el despliegue, para que hablen de la misma mesa.
  `CREATE TABLE IF NOT EXISTS battle_maps (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     name       TEXT NOT NULL,
     width_cm   REAL NOT NULL DEFAULT 180,
     height_cm  REAL NOT NULL DEFAULT 120,
     user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS battle_map_pieces (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     map_id     INTEGER NOT NULL REFERENCES battle_maps(id) ON DELETE CASCADE,
     kind       TEXT NOT NULL,
     x_cm       REAL NOT NULL,
     y_cm       REAL NOT NULL,
     w_cm       REAL NOT NULL,
     h_cm       REAL NOT NULL,
     rotation   REAL NOT NULL DEFAULT 0,
     name       TEXT,
     sort_order INTEGER NOT NULL DEFAULT 0
   )`,
  'CREATE INDEX IF NOT EXISTS idx_battle_map_pieces_map ON battle_map_pieces(map_id)',
  // Mapa cargado en el despliegue de una lista. NULL = mesa libre, la de
  // siempre, con sus medidas ajustables a mano.
  'ALTER TABLE army_lists ADD COLUMN battle_map_id INTEGER REFERENCES battle_maps(id) ON DELETE SET NULL',
  // Color de facción: el distintivo con el que se reconoce a un ejército de un
  // vistazo (ver domain/factionColor). NULL = todavía sin asignar.
  'ALTER TABLE factions ADD COLUMN color TEXT',
  // ---------------------------------------------------------------------
  // BIBLIOTECA DE ESCENOGRAFÍA Y SUELOS, VERSIONADA.
  //
  // El problema que resuelve: si al cambiar la ilustración de "bosque" se
  // sobrescribiera la anterior, TODOS los mapas ya hechos cambiarían de
  // aspecto de golpe. Aquí una edición no modifica nada: INSERTA una versión
  // nueva del mismo `slug`. Cada pieza de un mapa guarda el `asset_id`
  // concreto con el que se guardó, así que un mapa antiguo sigue pintando su
  // versión para siempre; el mapa que se está editando adopta la nueva en
  // cuanto se guarda.
  //
  // `retired` saca un tipo de la paleta sin borrarlo: los mapas que ya lo
  // usaban lo siguen pintando. Nada se borra nunca de estas tablas.
  //
  // `builtin_kind` enlaza con los tipos de fábrica dibujados en el código
  // (ver domain/scenery): una fila con builtin_kind='bosque' e image_key
  // reemplaza la ilustración de fábrica del bosque.
  // ---------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS scenery_assets (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     slug         TEXT NOT NULL,
     version      INTEGER NOT NULL DEFAULT 1,
     label        TEXT NOT NULL,
     image_key    TEXT,
     builtin_kind TEXT,
     w_cm         REAL NOT NULL DEFAULT 20,
     h_cm         REAL NOT NULL DEFAULT 20,
     retired      INTEGER NOT NULL DEFAULT 0,
     user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
     created_at   TEXT NOT NULL,
     UNIQUE (slug, version)
   )`,
  `CREATE TABLE IF NOT EXISTS floor_assets (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     slug       TEXT NOT NULL,
     version    INTEGER NOT NULL DEFAULT 1,
     label      TEXT NOT NULL,
     image_key  TEXT,
     tile_cm    REAL NOT NULL DEFAULT 60,
     opacity    REAL NOT NULL DEFAULT 0.5,
     retired    INTEGER NOT NULL DEFAULT 0,
     user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
     created_at TEXT NOT NULL,
     UNIQUE (slug, version)
   )`,
  // La versión con la que se guardó cada pieza. NULL = pieza anterior a la
  // biblioteca: se pinta con el tipo de fábrica de su `kind`, como siempre.
  'ALTER TABLE battle_map_pieces ADD COLUMN asset_id INTEGER REFERENCES scenery_assets(id)',
  // Suelo del mapa. NULL = el de antes (columna `texture`: liso o hierba).
  'ALTER TABLE battle_maps ADD COLUMN floor_id INTEGER REFERENCES floor_assets(id)',
  // Textura del tablero de un mapa: 'hierba' o NULL (tablero liso, que es como
  // estaban todos los mapas hechos antes de que existiera la opción).
  'ALTER TABLE battle_maps ADD COLUMN texture TEXT',
  // Apéndices de una unidad: bloques de texto con formato (título + HTML
  // saneado) que se escriben a mano y se pintan al final de su ficha. Van en
  // tabla aparte y no en una columna de units porque son VARIOS por unidad y
  // se reordenan. `body_html` guarda HTML porque el texto lleva negritas,
  // cursivas y listas; lo que puede entrar está acotado en shared/richText.
  `CREATE TABLE IF NOT EXISTS unit_appendices (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     unit_id    INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
     title      TEXT NOT NULL,
     body_html  TEXT NOT NULL DEFAULT '',
     sort_order INTEGER NOT NULL DEFAULT 0
   )`,
  'CREATE INDEX IF NOT EXISTS idx_unit_appendices_unit ON unit_appendices(unit_id)',
  // Iniciales que se pintan dentro de la peana en el Despliegue ("RO" para
  // Ratas Ogro), 3 caracteres. NULL = sin poner: la mesa saca entonces las
  // iniciales del nombre (ver domain/unitAlias). No se usa para nada más, así
  // que no lleva ni índice ni restricción de unicidad.
  'ALTER TABLE units ADD COLUMN alias TEXT',
  // Colores de partida de las facciones. NO salen del emblema: los 22 son
  // ilustraciones sepia sobre pergamino (tonos en la franja 23°–47°, nueve de
  // ellos casi grises), así que muestreándolos saldrían 22 marrones iguales.
  // Se eligen por lo que cada facción es y se comprobó que el par más parecido
  // queda a 17,6 de distancia perceptiva (CIE76), mediana 60.
  // `WHERE color IS NULL` deja intacto lo que el usuario haya cambiado a mano.
  `UPDATE factions SET color = CASE name
     WHEN 'Imperio'          THEN '#a8262a'
     WHEN 'Bretonia'         THEN '#2b56a8'
     WHEN 'Enanos'           THEN '#c25c17'
     WHEN 'Altos Elfos'      THEN '#4d9ed6'
     WHEN 'Elfos Oscuros'    THEN '#6a2a8c'
     WHEN 'Elfos Silvanos'   THEN '#2f7a3c'
     WHEN 'Orcos y Goblins'  THEN '#8fbf22'
     WHEN 'Skaven'           THEN '#8a6b3d'
     WHEN 'Condes Vampiro'   THEN '#2f2a45'
     WHEN 'Reyes Funerarios' THEN '#d9b83a'
     WHEN 'Hombres Lagarto'  THEN '#12867c'
     WHEN 'Hombres Bestia'   THEN '#4a3218'
     WHEN 'Hordas del Caos'  THEN '#8e1f5e'
     WHEN 'Enanos del Caos'  THEN '#6d2a08'
     WHEN 'Norsca'           THEN '#1d6e94'
     WHEN 'Enanos Norses'    THEN '#8fa3ad'
     WHEN 'Mercenarios'      THEN '#6d5a86'
     WHEN 'Estalia'          THEN '#e8801a'
     WHEN 'Akenhara'         THEN '#c99a6a'
     WHEN 'Kerit Khanan'     THEN '#2f4a2a'
     WHEN 'Bestias'          THEN '#a4515f'
     WHEN 'Asedio'           THEN '#5a646d'
     ELSE color END
   WHERE color IS NULL`,
]

async function onMigrate(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as MigrateRequestBody
  if (!(await checkPassword(env, body.passwordHash))) {
    return jsonResponse({ error: 'Contraseña de grupo incorrecta o ausente.' }, 401)
  }
  const applied: string[] = []
  for (const sql of MIGRATIONS) {
    try {
      await env.DB.prepare(sql).run()
      applied.push(sql)
    } catch {
      // Ya aplicada (o columna existente): se ignora, es idempotente.
    }
  }
  return jsonResponse({ ok: true, applied })
}

interface ResetSeedRequestBody {
  passwordHash: string
}

async function onResetSeed(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as ResetSeedRequestBody

  if (!(await checkPassword(env, body.passwordHash))) {
    return jsonResponse({ error: 'Contraseña de grupo incorrecta o ausente.' }, 401)
  }

  const session = env.DB.withSession(getIncomingBookmark(request))
  const deletes = RESET_DELETE_TABLES.map((table) => session.prepare(`DELETE FROM ${table}`))
  const inserts = SEED_STATEMENTS.map((s) => session.prepare(s.sql).bind(...s.params))

  await session.batch([...deletes, ...inserts])
  return jsonResponse({ ok: true }, 200, { [BOOKMARK_HEADER]: session.getBookmark() ?? '' })
}
