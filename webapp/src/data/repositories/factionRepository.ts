import { execCatalog, execCatalogBatch } from '@/data/sqlite/client'
import { queryLocal, queryLocalOne } from '@/data/sqlite/localCatalog'
import { ChangeLogRepository } from '@/data/repositories/changeLogRepository'
import { byteLength, bytesToDataUrl, type ByteSource } from '@/shared/image'
import type { Faction } from '@/domain/types'

function resolveEmblemUrl(imagePath: string | null, emblemData: ByteSource | null, emblemMime: string | null): string | null {
  if (emblemData && byteLength(emblemData) > 0 && emblemMime) {
    return bytesToDataUrl(emblemData, emblemMime)
  }
  if (imagePath) {
    return `${import.meta.env.BASE_URL}${imagePath}`
  }
  return null
}

function mapFaction(row: Record<string, unknown>): Faction {
  const imagePath = (row.image_path as string) ?? null
  const emblemData = (row.emblem_data as ByteSource | null) ?? null
  const emblemMime = (row.emblem_mime as string) ?? null
  return {
    id: row.id as number,
    name: row.name as string,
    slug: row.slug as string,
    imagePath,
    description: (row.description as string) ?? null,
    sortOrder: row.sort_order as number,
    emblemUrl: resolveEmblemUrl(imagePath, emblemData, emblemMime),
    hasCustomEmblem: byteLength(emblemData) > 0,
  }
}

export interface FactionInput {
  name: string
  slug: string
  imagePath?: string | null
  description?: string | null
}

/** Facción con lo que hay dentro, para poder resumirla sin abrirla. */
export interface FactionWithCounts extends Faction {
  unitCount: number
  /** Cuántas de esas unidades son personajes (unit_categories.code = 'PERSONAJE'). */
  characterCount: number
}

export const FactionRepository = {
  async listAll(): Promise<Faction[]> {
    return queryLocal('SELECT * FROM factions ORDER BY sort_order, name', [], mapFaction)
  },

  /**
   * Todas las facciones con el recuento de lo que contienen. Es lo que da
   * sentido a la pantalla "Facciones": de un vistazo se ve cuáles están
   * trabajadas y cuáles siguen vacías, sin tener que entrar en cada una.
   *
   * Solo cuenta unidades ACTIVAS (units.active): una unidad desactivada no se
   * puede meter en un ejército, así que inflar con ellas el "24 unidades" de
   * la facción daría una idea falsa de lo que hay disponible.
   */
  async listAllWithCounts(): Promise<FactionWithCounts[]> {
    return queryLocal(
      `SELECT f.*,
              (SELECT COUNT(*) FROM units u WHERE u.faction_id = f.id AND u.active = 1) AS unit_count,
              (SELECT COUNT(*) FROM units u
                 JOIN unit_categories c ON c.id = u.category_id
                WHERE u.faction_id = f.id AND u.active = 1 AND c.code = 'PERSONAJE') AS character_count
         FROM factions f
        ORDER BY f.sort_order, f.name`,
      [],
      (row) => ({
        ...mapFaction(row),
        unitCount: row.unit_count as number,
        characterCount: row.character_count as number,
      }),
    )
  },

  async getById(id: number): Promise<Faction | null> {
    return queryLocalOne('SELECT * FROM factions WHERE id = ?', [id], mapFaction)
  },

  async create(input: FactionInput): Promise<number> {
    const id = await execCatalog(
      `INSERT INTO factions (name, slug, image_path, description, sort_order)
       VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM factions))`,
      [input.name, input.slug, input.imagePath ?? null, input.description ?? null],
    )
    await ChangeLogRepository.record('faccion', 'crear', `Creó la facción "${input.name}"`, id)
    return id
  },

  async update(id: number, input: FactionInput): Promise<void> {
    await execCatalog(
      `UPDATE factions SET name = ?, slug = ?, image_path = ?, description = ? WHERE id = ?`,
      [input.name, input.slug, input.imagePath ?? null, input.description ?? null, id],
    )
    await ChangeLogRepository.record('faccion', 'editar', `Editó la facción "${input.name}"`, id)
  },

  async remove(id: number): Promise<void> {
    // Se lee la facción ANTES de borrar por dos motivos: después ya no hay de
    // dónde sacar el nombre (un "borró la facción #12" no le sirve a nadie), y
    // si ya no existe se sale sin registrar nada — así una llamada repetida no
    // deja un borrado fantasma en el Log (ver ConfirmDialog).
    const existing = await FactionRepository.getById(id)
    if (!existing) return
    await execCatalog('DELETE FROM factions WHERE id = ?', [id])
    await ChangeLogRepository.record('faccion', 'borrar', `Borró la facción "${existing.name}" y todas sus unidades`, id)
  },

  /** Sube/reemplaza el emblema personalizado de una facción (ya redimensionado/comprimido en el navegador). Anula el de fábrica mientras exista. */
  async setEmblem(id: number, bytes: Uint8Array, mime: string): Promise<void> {
    await execCatalogBatch([
      { sql: 'UPDATE factions SET emblem_data = ?, emblem_mime = ? WHERE id = ?', params: [bytes, mime, id] },
    ])
    const name = (await FactionRepository.getById(id))?.name ?? `#${id}`
    await ChangeLogRepository.record('faccion', 'editar', `Cambió el emblema de "${name}"`, id)
  },

  /** Quita el emblema personalizado, volviendo al de fábrica (image_path) si existe, o a ninguno si no. */
  async clearEmblem(id: number): Promise<void> {
    await execCatalog('UPDATE factions SET emblem_data = NULL, emblem_mime = NULL WHERE id = ?', [id])
    const name = (await FactionRepository.getById(id))?.name ?? `#${id}`
    await ChangeLogRepository.record('faccion', 'editar', `Quitó el emblema propio de "${name}"`, id)
  },
}
