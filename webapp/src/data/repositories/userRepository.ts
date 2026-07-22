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

  // ---- Reglas destacadas por facción --------------------------------------

  /** Ids de las reglas que el usuario ha destacado para una facción. */
  async getFactionRuleIds(userId: number, factionId: number): Promise<number[]> {
    try {
      return await query<number>(
        'SELECT rule_id FROM user_faction_rules WHERE user_id = ? AND faction_id = ?',
        [userId, factionId],
        (r) => r.rule_id as number,
      )
    } catch {
      return []
    }
  },

  /** Sustituye las reglas destacadas del usuario para una facción. */
  async setFactionRuleIds(userId: number, factionId: number, ruleIds: number[]): Promise<void> {
    await execBatch([
      { sql: 'DELETE FROM user_faction_rules WHERE user_id = ? AND faction_id = ?', params: [userId, factionId] },
      ...ruleIds.map((ruleId) => ({
        sql: 'INSERT OR IGNORE INTO user_faction_rules (user_id, faction_id, rule_id) VALUES (?, ?, ?)',
        params: [userId, factionId, ruleId],
      })),
    ])
  },
}
