// ============================================================================
// La biblioteca de escenografía y de suelos de mesa, VERSIONADA.
//
// LA REGLA DE ORO: aquí no se modifica ni se borra nada. Reemplazar la imagen
// de un elemento INSERTA una versión nueva del mismo `slug`; retirarlo marca
// `retired` en una versión nueva también. Los mapas guardan el `asset_id`
// concreto con el que se hicieron, así que un mapa de hace un mes sigue
// pintando la imagen de hace un mes por mucho que hoy se cambie el bosque. Ese
// es todo el propósito de este archivo: que mejorar la biblioteca no estropee
// lo ya hecho.
//
// Consecuencia práctica: las imágenes de R2 tampoco se borran al reemplazar
// (la clave lleva el hash del contenido, así que cada versión tiene la suya y
// la vieja sigue haciendo falta). Ocupan unos KB y son lo único que sostiene
// los mapas antiguos.
//
// Cualquiera puede editar la biblioteca: es un grupo cerrado, y los mapas ya
// funcionan así. Se guarda quién hizo cada versión, que es lo que hace falta
// para saber a quién preguntar.
// ============================================================================
import { exec, query } from '@/data/sqlite/client'
import { hashDeContenido, imageUrl, uploadImageAtKey } from '@/data/network/images'
import { isSceneryKind, type FloorAsset, type SceneryAsset } from '@/domain/scenery'

function mapAsset(row: Record<string, unknown>): SceneryAsset {
  const key = (row.image_key as string) ?? null
  const builtin = row.builtin_kind
  return {
    id: row.id as number,
    slug: row.slug as string,
    version: row.version as number,
    label: row.label as string,
    imageKey: key,
    imageUrl: key ? imageUrl(key) : null,
    builtinKind: isSceneryKind(builtin) ? builtin : null,
    anchoCm: row.w_cm as number,
    altoCm: row.h_cm as number,
    retired: Boolean(row.retired),
    createdAt: row.created_at as string,
  }
}

function mapFloor(row: Record<string, unknown>): FloorAsset {
  const key = (row.image_key as string) ?? null
  return {
    id: row.id as number,
    slug: row.slug as string,
    version: row.version as number,
    label: row.label as string,
    imageKey: key,
    imageUrl: key ? imageUrl(key) : null,
    tileCm: row.tile_cm as number,
    opacity: row.opacity as number,
    retired: Boolean(row.retired),
    createdAt: row.created_at as string,
  }
}

/**
 * "Solo la última versión de cada slug", en SQL: se emparejan las filas con el
 * máximo `version` de su slug. Es la consulta que sostiene toda la biblioteca,
 * así que va escrita una sola vez.
 */
const SQL_VIGENTES = (tabla: string) => `
  SELECT a.*
    FROM ${tabla} a
    JOIN (SELECT slug, MAX(version) AS v FROM ${tabla} GROUP BY slug) u
      ON u.slug = a.slug AND u.v = a.version
   ORDER BY a.label`

/** Nombre interno a partir del visible. Solo se usa al crear: después no cambia nunca. */
function slugify(texto: string): string {
  const base = texto
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return base || `elemento-${Date.now()}`
}

export interface NuevoElemento {
  label: string
  anchoCm: number
  altoCm: number
  imagen: { bytes: Uint8Array; mime: string } | null
}

export const SceneryAssetRepository = {
  /** La versión vigente de cada elemento, retirados incluidos (la paleta ya los filtra). */
  async listVigentes(): Promise<SceneryAsset[]> {
    try {
      return await query(SQL_VIGENTES('scenery_assets'), [], mapAsset)
    } catch {
      // Worker sin desplegar: la biblioteca todavía no existe y el editor
      // funciona con los tipos de fábrica, como siempre.
      return []
    }
  },

  /** Todas las versiones de un elemento, de la más nueva a la más vieja. */
  async listVersiones(slug: string): Promise<SceneryAsset[]> {
    return query('SELECT * FROM scenery_assets WHERE slug = ? ORDER BY version DESC', [slug], mapAsset)
  },

  /**
   * Crea la PRIMERA versión de un elemento nuevo. Si el nombre choca con uno ya
   * existente se le añade un sufijo: dos elementos distintos no pueden
   * compartir slug, porque el slug es lo que los identifica entre versiones.
   */
  async crear(nuevo: NuevoElemento, userId: number | null): Promise<number> {
    const usados = new Set((await SceneryAssetRepository.listVigentes()).map((a) => a.slug))
    let slug = slugify(nuevo.label)
    let n = 2
    while (usados.has(slug) || isSceneryKind(slug)) slug = `${slugify(nuevo.label)}-${n++}`
    return insertarVersion(slug, 1, nuevo, null, false, userId)
  },

  /**
   * Reemplaza un elemento: nueva versión con la imagen y las medidas nuevas.
   * `builtinKind` se conserva, para que un bosque reemplazado siga siendo el
   * bosque.
   */
  async reemplazar(
    slug: string,
    cambios: NuevoElemento,
    builtinKind: string | null,
    userId: number | null,
  ): Promise<number> {
    const siguiente = (await proximaVersion('scenery_assets', slug)) ?? 1
    return insertarVersion(slug, siguiente, cambios, builtinKind, false, userId)
  },

  /**
   * Retira o devuelve a la paleta. Es una versión más, no un borrado: los
   * mapas que ya lo usaban siguen igual, y volver a ofrecerlo es otra versión.
   */
  async marcarRetirado(asset: SceneryAsset, retirado: boolean, userId: number | null): Promise<number> {
    const siguiente = (await proximaVersion('scenery_assets', asset.slug)) ?? 1
    return exec(
      `INSERT INTO scenery_assets (slug, version, label, image_key, builtin_kind, w_cm, h_cm, retired, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        asset.slug,
        siguiente,
        asset.label,
        asset.imageKey,
        asset.builtinKind,
        asset.anchoCm,
        asset.altoCm,
        retirado ? 1 : 0,
        userId,
        new Date().toISOString(),
      ],
    )
  },
}

async function proximaVersion(tabla: 'scenery_assets' | 'floor_assets', slug: string): Promise<number | null> {
  const filas = await query(
    `SELECT COALESCE(MAX(version), 0) + 1 AS siguiente FROM ${tabla} WHERE slug = ?`,
    [slug],
    (row) => row.siguiente as number,
  )
  return filas[0] ?? null
}

async function insertarVersion(
  slug: string,
  version: number,
  datos: NuevoElemento,
  builtinKind: string | null,
  retirado: boolean,
  userId: number | null,
): Promise<number> {
  let key: string | null = null
  if (datos.imagen) {
    key = `scenery/${slug}/${await hashDeContenido(datos.imagen.bytes)}.${datos.imagen.mime === 'image/png' ? 'png' : 'webp'}`
    await uploadImageAtKey(key, datos.imagen.bytes, datos.imagen.mime)
  }
  return exec(
    `INSERT INTO scenery_assets (slug, version, label, image_key, builtin_kind, w_cm, h_cm, retired, user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      version,
      datos.label.trim(),
      key,
      builtinKind,
      datos.anchoCm,
      datos.altoCm,
      retirado ? 1 : 0,
      userId,
      new Date().toISOString(),
    ],
  )
}

export interface NuevoSuelo {
  label: string
  tileCm: number
  opacity: number
  imagen: { bytes: Uint8Array; mime: string } | null
}

export const FloorAssetRepository = {
  async listVigentes(): Promise<FloorAsset[]> {
    try {
      return await query(SQL_VIGENTES('floor_assets'), [], mapFloor)
    } catch {
      return []
    }
  },

  async getById(id: number): Promise<FloorAsset | null> {
    const filas = await query('SELECT * FROM floor_assets WHERE id = ?', [id], mapFloor)
    return filas[0] ?? null
  },

  async crear(nuevo: NuevoSuelo, userId: number | null): Promise<number> {
    const usados = new Set((await FloorAssetRepository.listVigentes()).map((f) => f.slug))
    let slug = slugify(nuevo.label)
    let n = 2
    while (usados.has(slug)) slug = `${slugify(nuevo.label)}-${n++}`
    return insertarSuelo(slug, 1, nuevo, false, userId)
  },

  async reemplazar(slug: string, cambios: NuevoSuelo, userId: number | null): Promise<number> {
    const siguiente = (await proximaVersion('floor_assets', slug)) ?? 1
    return insertarSuelo(slug, siguiente, cambios, false, userId)
  },

  async marcarRetirado(suelo: FloorAsset, retirado: boolean, userId: number | null): Promise<number> {
    const siguiente = (await proximaVersion('floor_assets', suelo.slug)) ?? 1
    return exec(
      `INSERT INTO floor_assets (slug, version, label, image_key, tile_cm, opacity, retired, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        suelo.slug,
        siguiente,
        suelo.label,
        suelo.imageKey,
        suelo.tileCm,
        suelo.opacity,
        retirado ? 1 : 0,
        userId,
        new Date().toISOString(),
      ],
    )
  },
}

async function insertarSuelo(
  slug: string,
  version: number,
  datos: NuevoSuelo,
  retirado: boolean,
  userId: number | null,
): Promise<number> {
  let key: string | null = null
  if (datos.imagen) {
    key = `floors/${slug}/${await hashDeContenido(datos.imagen.bytes)}.${datos.imagen.mime === 'image/png' ? 'png' : 'webp'}`
    await uploadImageAtKey(key, datos.imagen.bytes, datos.imagen.mime)
  }
  return exec(
    `INSERT INTO floor_assets (slug, version, label, image_key, tile_cm, opacity, retired, user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      version,
      datos.label.trim(),
      key,
      datos.tileCm,
      datos.opacity,
      retirado ? 1 : 0,
      userId,
      new Date().toISOString(),
    ],
  )
}
