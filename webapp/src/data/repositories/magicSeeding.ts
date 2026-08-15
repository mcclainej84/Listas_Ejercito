// ============================================================================
// Carga inicial del catálogo de magia (30 sendas, 213 hechizos).
//
// Se ejecuta una sola vez, desde runCatalogMaintenance, con el mismo mecanismo
// que el resto de correcciones de catálogo. No es una migración del Worker
// porque las migraciones solo crean estructura: esto son DATOS, y meterlos ahí
// obligaría a mantener 213 INSERT dentro del código del servidor.
//
// IDEMPOTENTE POR CÓDIGO DE SENDA, no por marca de localStorage a secas: antes
// de insertar se mira qué sendas existen ya y solo se crean las que faltan.
// Así, si alguien borra la marca o entra desde otro navegador, no se duplica
// nada; y si mañana se añade una senda al fichero semilla, entra sola sin
// tocar las que el usuario ya haya editado a mano.
//
// Lo que NUNCA hace es actualizar una senda existente: si el usuario cambia un
// hechizo, es suyo. Esta carga solo rellena huecos.
// ============================================================================
import { execCatalogBatch, type BatchStatement } from '@/data/sqlite/client'
import { queryLocal } from '@/data/sqlite/localCatalog'
import { MAGIC_PATH_SEED } from '@/data/seeds/magicPaths'
import { isMagicGroup } from '@/domain/magic'

/** Número de sentencias por lote. El Worker rechaza más de 50 por batch (ver MAX_MUTATE_STATEMENTS). */
const CHUNK = 45

export interface MagicSeedResult {
  sendasCreadas: number
  hechizosCreados: number
}

/**
 * Crea las sendas del fichero semilla que todavía no existan, con sus
 * hechizos. Devuelve cuántas se han creado (0 = ya estaba todo).
 */
export async function seedMagicPaths(): Promise<MagicSeedResult> {
  // Se mira qué sendas existen Y CUÁNTOS HECHIZOS tienen, no solo si existen.
  //
  // La diferencia importa: las sendas se crean en un lote y sus hechizos en
  // varios más. Si uno de esos lotes falla a mitad (red, 401, Worker a medio
  // desplegar), las sendas quedan creadas pero vacías — y con una comprobación
  // de "¿existe la senda?" se darían por buenas para siempre, dejando sendas
  // sin un solo hechizo y sin que nadie se entere. Al mirar también el
  // recuento, una senda a medias se vuelve a intentar en la próxima carga.
  const existing = await queryLocal(
    `SELECT mp.code AS code, COUNT(ms.id) AS spells
       FROM magic_paths mp
       LEFT JOIN magic_spells ms ON ms.path_id = mp.id
      GROUP BY mp.id, mp.code`,
    [],
    (row) => [(row.code as string).toUpperCase(), row.spells as number] as const,
  )
  const spellCountByCode = new Map(existing)

  const pending = MAGIC_PATH_SEED.filter((path) => !spellCountByCode.has(path.code.toUpperCase()))
  // Sendas que sí existen pero se quedaron sin hechizos: se completan sin
  // volver a crear la senda. Solo si están COMPLETAMENTE vacías — si tienen
  // alguno, puede que el usuario los haya borrado a propósito y no somos
  // quién para reponérselos.
  const incomplete = MAGIC_PATH_SEED.filter((path) => spellCountByCode.get(path.code.toUpperCase()) === 0)

  if (pending.length === 0 && incomplete.length === 0) return { sendasCreadas: 0, hechizosCreados: 0 }

  const [{ next }] = await queryLocal('SELECT COALESCE(MAX(sort_order), 0) AS next FROM magic_paths', [], (row) => ({
    next: (row.next as number) ?? 0,
  }))

  // Las sendas primero, todas de golpe: hacen falta sus ids para colgar los
  // hechizos, y execCatalogBatch devuelve el id de cada INSERT.
  const pathStatements: BatchStatement[] = pending.map((path, index) => ({
    sql: 'INSERT INTO magic_paths (code, name, group_code, sort_order) VALUES (?, ?, ?, ?)',
    params: [path.code, path.name, isMagicGroup(path.group) ? path.group : 'MISTICAS', next + index + 1],
  }))

  const createdIds: number[] = []
  for (let i = 0; i < pathStatements.length; i += CHUNK) {
    const results = await execCatalogBatch(pathStatements.slice(i, i + CHUNK))
    for (const result of results) createdIds.push(result.insertId)
  }

  // Los ids de las sendas a completar hay que buscarlos: ya existían.
  const idByCode = new Map(
    await queryLocal(
      'SELECT id, code FROM magic_paths',
      [],
      (row) => [(row.code as string).toUpperCase(), row.id as number] as const,
    ),
  )

  const spellStatements: BatchStatement[] = []
  const withIds: Array<{ path: (typeof MAGIC_PATH_SEED)[number]; pathId: number | undefined }> = [
    ...pending.map((path, index) => ({ path, pathId: createdIds[index] })),
    ...incomplete.map((path) => ({ path, pathId: idByCode.get(path.code.toUpperCase()) })),
  ]

  withIds.forEach(({ path, pathId }) => {
    if (pathId == null) return
    path.spells.forEach((spell, spellIndex) => {
      spellStatements.push({
        sql: `INSERT INTO magic_spells (path_id, level, name, difficulty, range_text, hits, damage, stays_active, cac, rules, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          pathId,
          spell.level,
          spell.name,
          spell.difficulty,
          spell.range,
          spell.hits,
          spell.damage,
          spell.staysActive ? 1 : 0,
          spell.cac,
          spell.rules,
          spellIndex + 1,
        ],
      })
    })
  })

  for (let i = 0; i < spellStatements.length; i += CHUNK) {
    await execCatalogBatch(spellStatements.slice(i, i + CHUNK))
  }

  return { sendasCreadas: pending.length, hechizosCreados: spellStatements.length }
}
