// ============================================================================
// Usuarios = PERFILES, no seguridad.
//
// Sirven para saber quién eres y personalizar tu vista (tus ejércitos, qué
// facciones ves). Decidido así a propósito: la API de lectura del Worker es
// pública, el "modo admin" se activa sin contraseña y restablecer la contraseña
// no pide comprobación. Es una herramienta de un grupo cerrado.
//
// Los usuarios NO viajan en el snapshot del catálogo (no son catálogo y se
// consultan poco), así que van por red con query/exec como las listas de
// ejército.
// ============================================================================
import { exec, execBatch, query, queryOne } from '@/data/sqlite/client'
import { sha256Hex } from '@/shared/hash'
import type { User } from '@/domain/types'

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

  /** Comprueba la contraseña. Devuelve el usuario si coincide, null si no. */
  async authenticate(username: string, password: string): Promise<User | null> {
    const hash = await sha256Hex(password)
    return queryOne(
      'SELECT id, username, created_at FROM users WHERE username = ? COLLATE NOCASE AND password_hash = ?',
      [username.trim(), hash],
      mapUser,
    )
  },

  /** Crea un usuario. Falla si el nombre ya existe. */
  async create(username: string, password: string): Promise<User> {
    const name = username.trim()
    if (!name) throw new Error('El nombre de usuario es obligatorio.')
    const existing = await UserRepository.findByUsername(name)
    if (existing) throw new Error('Ya existe un usuario con ese nombre.')
    const hash = await sha256Hex(password)
    const id = await exec('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)', [
      name,
      hash,
      new Date().toISOString(),
    ])
    return { id, username: name, createdAt: new Date().toISOString() }
  },

  /** Restablece la contraseña de un usuario. Sin comprobaciones, por decisión expresa (ver cabecera). */
  async resetPassword(userId: number, newPassword: string): Promise<void> {
    const hash = await sha256Hex(newPassword)
    await exec('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId])
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
