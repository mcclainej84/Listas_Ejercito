// ============================================================================
// Mapas de batalla y su escenografía.
//
// LOS MAPAS SON COMUNES. Los ve, los carga, los edita y los borra cualquiera:
// una mesa no es información privada como una lista de ejército —es el terreno
// donde se juega, y lo normal es que los dos jugadores usen el mismo—. `userId`
// solo dice de quién salió.
//
// La única excepción es OCULTAR (`hidden`): un mapa oculto desaparece del
// listado de todos menos del suyo. Está para poder tener uno a medias sin que
// le estorbe a nadie, no para cerrarlo con llave.
//
// Van por `exec`/`query` (red) y no por `execCatalog`, que además replica en la
// copia local: un mapa no lo necesita, no se consulta al pintar cada ficha.
//
// La escenografía se guarda BORRANDO Y REESCRIBIENDO entera la del mapa. Mover
// una pieza cambia dos números y añadir otra crea una fila: llevar la cuenta
// de qué cambió para hacer INSERT/UPDATE/DELETE por separado sería mucho
// trabajo para una tabla que en el peor caso tiene veinte filas.
// ============================================================================
import { exec, execBatch, query, queryOne } from '@/data/sqlite/client'
import { imageUrl } from '@/data/network/images'
import {
  esTextura,
  isSceneryKind,
  type MapaDetalle,
  type MapaResumen,
  type SceneryPiece,
  type TexturaMapa,
} from '@/domain/scenery'

/**
 * La textura guardada, o 'ninguna'. Es null en todo mapa hecho antes de que
 * existiera la opción, y también mientras el Worker no se haya desplegado (la
 * columna no viaja en la respuesta): en los dos casos, tablero liso.
 */
function mapTextura(valor: unknown): TexturaMapa {
  return esTextura(valor) ? valor : 'ninguna'
}

function mapPiece(row: Record<string, unknown>): SceneryPiece | null {
  const kind = row.kind
  // Una pieza de un tipo que ya no existe se omite en vez de romper el mapa
  // entero: es un dato viejo, no un fallo del programa.
  if (!isSceneryKind(kind)) return null
  // La imagen sale de la VERSIÓN con la que se guardó la pieza (asset_id), no
  // de la vigente: es lo que hace que un mapa antiguo no cambie al reemplazar
  // un elemento de la biblioteca. Sin asset_id, es una pieza anterior a la
  // biblioteca y se dibuja con su tipo de fábrica.
  const key = (row.asset_image_key as string) ?? null
  return {
    id: row.id as number,
    kind,
    xCm: row.x_cm as number,
    yCm: row.y_cm as number,
    anchoCm: row.w_cm as number,
    altoCm: row.h_cm as number,
    rotacion: (row.rotation as number) ?? 0,
    nombre: (row.name as string) ?? null,
    assetId: (row.asset_id as number) ?? null,
    imageUrl: key ? imageUrl(key) : null,
  }
}

export interface MapaInput {
  name: string
  anchoCm: number
  altoCm: number
}

export const MapRepository = {
  /**
   * TODOS los mapas, del más reciente al más antiguo, menos los ocultos de
   * otros. Cada uno trae el nombre de su autor para poder distinguir los
   * propios.
   */
  async listAll(userId: number | null = null): Promise<MapaResumen[]> {
    try {
      return await query(
        `SELECT m.*, (SELECT COUNT(*) FROM battle_map_pieces p WHERE p.map_id = m.id) AS piezas,
                (SELECT u.username FROM users u WHERE u.id = m.user_id) AS owner_name
           FROM battle_maps m
          WHERE m.hidden = 0 OR m.user_id = ?
          ORDER BY m.updated_at DESC`,
        [userId],
        (row) => ({
          id: row.id as number,
          name: row.name as string,
          anchoCm: row.width_cm as number,
          altoCm: row.height_cm as number,
          userId: (row.user_id as number) ?? null,
          ownerName: (row.owner_name as string) ?? null,
          updatedAt: row.updated_at as string,
          textura: mapTextura(row.texture),
          floorId: (row.floor_id as number) ?? null,
          hidden: Boolean(row.hidden),
          piezas: row.piezas as number,
        }),
      )
    } catch {
      // Worker sin desplegar: mejor una sección vacía que una pantalla de
      // error (ver schemaHealth, que ya avisa de lo que falta).
      return []
    }
  },

  async create(input: MapaInput, userId: number): Promise<number> {
    const now = new Date().toISOString()
    return exec(
      'INSERT INTO battle_maps (name, width_cm, height_cm, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [input.name.trim(), input.anchoCm, input.altoCm, userId, now, now],
    )
  },

  async rename(id: number, name: string): Promise<void> {
    await exec('UPDATE battle_maps SET name = ?, updated_at = ? WHERE id = ?', [
      name.trim(),
      new Date().toISOString(),
      id,
    ])
  },

  /**
   * Oculta el mapa o lo devuelve al listado común. Oculto solo lo ve su autor
   * (ver listAll); si no tiene autor, no lo vería nadie, así que ahí no se
   * ofrece.
   */
  async setHidden(id: number, hidden: boolean): Promise<void> {
    await exec('UPDATE battle_maps SET hidden = ?, updated_at = ? WHERE id = ?', [
      hidden ? 1 : 0,
      new Date().toISOString(),
      id,
    ])
  },

  async remove(id: number): Promise<void> {
    // Las piezas caen solas por ON DELETE CASCADE.
    await exec('DELETE FROM battle_maps WHERE id = ?', [id])
  },

  async getById(id: number): Promise<MapaDetalle | null> {
    const cabecera = await queryOne('SELECT * FROM battle_maps WHERE id = ?', [id], (row) => ({
      id: row.id as number,
      name: row.name as string,
      anchoCm: row.width_cm as number,
      altoCm: row.height_cm as number,
      userId: (row.user_id as number) ?? null,
      updatedAt: row.updated_at as string,
      textura: mapTextura(row.texture),
      floorId: (row.floor_id as number) ?? null,
      hidden: Boolean(row.hidden),
    }))
    if (!cabecera) return null

    const filas = await query(
      `SELECT p.*, a.image_key AS asset_image_key
         FROM battle_map_pieces p
         LEFT JOIN scenery_assets a ON a.id = p.asset_id
        WHERE p.map_id = ?
        ORDER BY p.sort_order, p.id`,
      [id],
      mapPiece,
    )
    return { ...cabecera, piezas: filas.filter((p): p is SceneryPiece => p !== null) }
  },

  /** Guarda de una vez las medidas del mapa, su textura y TODA su escenografía. */
  async save(
    id: number,
    anchoCm: number,
    altoCm: number,
    textura: TexturaMapa,
    floorId: number | null,
    piezas: SceneryPiece[],
  ): Promise<void> {
    await execBatch([
      {
        sql: 'UPDATE battle_maps SET width_cm = ?, height_cm = ?, texture = ?, floor_id = ?, updated_at = ? WHERE id = ?',
        params: [anchoCm, altoCm, textura, floorId, new Date().toISOString(), id],
      },
      { sql: 'DELETE FROM battle_map_pieces WHERE map_id = ?', params: [id] },
      // Cada pieza se guarda con el `assetId` que tiene ahora, que es la
      // versión vigente cuando se colocó. Ahí está el versionado: guardar este
      // mapa lo pone al día y no toca ningún otro.
      ...piezas.map((p, i) => ({
        sql: `INSERT INTO battle_map_pieces (map_id, kind, asset_id, x_cm, y_cm, w_cm, h_cm, rotation, name, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [id, p.kind, p.assetId, p.xCm, p.yCm, p.anchoCm, p.altoCm, p.rotacion, p.nombre, i],
      })),
    ])
  },
}
