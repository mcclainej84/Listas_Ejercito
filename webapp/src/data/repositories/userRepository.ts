// ============================================================================
// Usuarios: identifican Y autorizan.
//
// Sirven para saber quién eres y personalizar tu vista (tus ejércitos, qué
// facciones ves), y desde que el Worker comprueba quién escribe son también lo
// que permite guardar cambios — ver la sección AUTENTICACIÓN de
// worker/src/index.ts.
//
// POR ESO ENTRAR, DARSE DE ALTA Y CAMBIAR LA CONTRASEÑA NO SON CONSULTAS SQL.
// Antes eran un SELECT y un UPDATE normales desde el navegador; ahora van por
// /auth/login, /auth/register y /auth/password, porque el hash de la contraseña
// vive en una tabla que /query tiene prohibida. Si se pudiera leer con un
// SELECT cualquiera —y /query es público— la credencial estaría a la vista y
// comprobarla en el servidor no protegería nada.
//
// Lo DEMÁS de un usuario (nombre, fecha, facción favorita, preferencias) sigue
// siendo público y se consulta con query/exec como siempre.
//
// El "modo admin" sigue siendo una preferencia de vista que se activa sin pedir
// nada: no es un permiso (ver useSession).
// ============================================================================
import { exec, execBatch, getApiBaseUrl, query, queryOne } from '@/data/sqlite/client'
import { guardarCredencial, olvidarCredencial } from '@/data/network/auth'
import { sha256Hex } from '@/shared/hash'
import type { User } from '@/domain/types'

/** POST a un endpoint /auth/*. Devuelve el cuerpo ya interpretado y el estado. */
async function postAuth<T>(ruta: string, cuerpo: unknown): Promise<{ status: number; data: T & { error?: string } }> {
  const res = await fetch(`${getApiBaseUrl()}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  return { status: res.status, data }
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as number,
    username: row.username as string,
    createdAt: row.created_at as string,
  }
}

/** Líneas opcionales bajo cada unidad en "Unidades en la lista". */
export interface ArmyListOptions {
  /** Línea con la montura y el carro elegidos. */
  showMounts: boolean
  /** Línea con las sendas de magia y su nivel. */
  showMagic: boolean
}

/** Ambas encendidas: quien no sepa que existen ve los datos igualmente. */
export const DEFAULT_ARMY_LIST_OPTIONS: ArmyListOptions = { showMounts: true, showMagic: true }

export const UserRepository = {
  /** Todos los usuarios, para poder elegir en la pantalla de acceso sin tener que recordar el nombre exacto. */
  async listAll(): Promise<User[]> {
    return query('SELECT id, username, created_at FROM users ORDER BY username', [], mapUser)
  },

  async findByUsername(username: string): Promise<User | null> {
    return queryOne(
      'SELECT id, username, created_at FROM users WHERE username = ? COLLATE NOCASE',
      [username.trim()],
      mapUser,
    )
  },

  /**
   * Comprueba la contraseña contra el servidor. Devuelve el usuario si coincide,
   * null si no — y de paso GUARDA LA CREDENCIAL con la que este navegador
   * escribirá a partir de ahora.
   */
  async authenticate(username: string, password: string): Promise<User | null> {
    const hash = await sha256Hex(password)
    const { status, data } = await postAuth<{ user?: Record<string, unknown> }>('/auth/login', {
      username: username.trim(),
      passwordHash: hash,
    })
    if (status === 401) return null
    if (status !== 200 || !data.user) throw new Error(data.error ?? `No se pudo entrar (${status}).`)
    const user = mapUser(data.user)
    guardarCredencial({ userId: user.id, hash })
    return user
  },

  /** Crea un usuario y deja la sesión acreditada. Falla si el nombre ya existe. */
  async create(username: string, password: string): Promise<User> {
    const name = username.trim()
    if (!name) throw new Error('El nombre de usuario es obligatorio.')
    const hash = await sha256Hex(password)
    const { status, data } = await postAuth<{ user?: Record<string, unknown> }>('/auth/register', {
      username: name,
      passwordHash: hash,
    })
    if (status !== 201 || !data.user) throw new Error(data.error ?? `No se pudo crear el usuario (${status}).`)
    const user = mapUser(data.user)
    guardarCredencial({ userId: user.id, hash })
    return user
  },

  /**
   * Cambia la contraseña, PIDIENDO LA ACTUAL.
   *
   * Antes se restablecía sin comprobar nada, y se podía permitir porque el
   * usuario no autorizaba nada. Ahora autoriza a escribir, así que un
   * restablecido libre sería una puerta abierta para suplantar a cualquiera.
   */
  async changePassword(username: string, currentPassword: string, newPassword: string): Promise<void> {
    const { status, data } = await postAuth<Record<string, never>>('/auth/password', {
      username: username.trim(),
      currentHash: await sha256Hex(currentPassword),
      passwordHash: await sha256Hex(newPassword),
    })
    if (status === 401) throw new Error('Usuario o contraseña actual incorrectos.')
    if (status !== 200) throw new Error(data.error ?? `No se pudo cambiar la contraseña (${status}).`)
    // La credencial guardada lleva el hash viejo: ya no vale para escribir.
    olvidarCredencial()
  },

  // ---- Facciones ocultas (preferencia "Mis facciones") --------------------

  /** Ids de las facciones que el usuario ha ocultado. */
  async getHiddenFactionIds(userId: number): Promise<number[]> {
    return query<number>(
      'SELECT faction_id FROM user_hidden_factions WHERE user_id = ?',
      [userId],
      (r) => r.faction_id as number,
    )
  },

  /** Sustituye el conjunto de facciones ocultas del usuario. */
  async setHiddenFactionIds(userId: number, factionIds: number[]): Promise<void> {
    await execBatch([
      { sql: 'DELETE FROM user_hidden_factions WHERE user_id = ?', params: [userId] },
      ...factionIds.map((factionId) => ({
        sql: 'INSERT OR IGNORE INTO user_hidden_factions (user_id, faction_id) VALUES (?, ?)',
        params: [userId, factionId],
      })),
    ])
  },

  // ---- Facción favorita ----------------------------------------------------

  /** Facción favorita del usuario, o null. Tolera que la columna no exista aún (Worker sin desplegar). */
  async getFavoriteFactionId(userId: number): Promise<number | null> {
    try {
      return await queryOne<number | null>(
        'SELECT favorite_faction_id FROM users WHERE id = ?',
        [userId],
        (r) => (r.favorite_faction_id as number) ?? null,
      )
    } catch {
      return null
    }
  },

  /** Marca (o desmarca, con null) la facción favorita del usuario. */
  async setFavoriteFactionId(userId: number, factionId: number | null): Promise<void> {
    await exec('UPDATE users SET favorite_faction_id = ? WHERE id = ?', [factionId, userId])
  },

  // ---- Opciones de la lista de ejército -----------------------------------

  /**
   * Qué líneas extra se ven bajo cada unidad en "Unidades en la lista".
   *
   * Si la consulta falla —Worker sin desplegar, red caída— se devuelven las
   * dos ENCENDIDAS: es el valor por defecto de la columna, y ante la duda es
   * mejor enseñar de más que esconder datos sin que el usuario lo haya pedido.
   */
  async getArmyListOptions(userId: number): Promise<ArmyListOptions> {
    try {
      const row = await queryOne<ArmyListOptions>(
        'SELECT show_mounts, show_magic FROM users WHERE id = ?',
        [userId],
        (r) => ({ showMounts: r.show_mounts !== 0, showMagic: r.show_magic !== 0 }),
      )
      return row ?? DEFAULT_ARMY_LIST_OPTIONS
    } catch {
      return DEFAULT_ARMY_LIST_OPTIONS
    }
  },

  async setArmyListOptions(userId: number, options: ArmyListOptions): Promise<void> {
    await exec('UPDATE users SET show_mounts = ?, show_magic = ? WHERE id = ?', [
      options.showMounts ? 1 : 0,
      options.showMagic ? 1 : 0,
      userId,
    ])
  },
}
