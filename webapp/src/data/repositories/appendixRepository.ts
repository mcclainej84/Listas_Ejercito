// ============================================================================
// Apéndices de una unidad: bloques de texto con formato (título + cuerpo) que
// se escriben a mano y salen al final de su ficha.
//
// SE COPIAN, NO SE COMPARTEN. Copiar un apéndice de una unidad a otra DUPLICA
// el texto: a partir de ahí son dos apéndices independientes y editar uno no
// toca el otro. Fue una decisión explícita: compartirlos obligaría a avisar en
// cada edición de a cuántas unidades afecta, y lo normal es que el texto
// copiado se acabe retocando para la unidad de destino.
//
// El HTML se sanea AQUÍ, además de en el editor: este repositorio es lo último
// que hay antes de la base de datos y no puede fiarse de quién le llame (ver
// shared/richText).
// ============================================================================
import { execCatalog, execCatalogBatch } from '@/data/sqlite/client'
import { queryLocal } from '@/data/sqlite/localCatalog'
import { ChangeLogRepository } from '@/data/repositories/changeLogRepository'
import { sanearHtml } from '@/shared/richText'
import type { UnitAppendix } from '@/domain/types'

function mapAppendix(row: Record<string, unknown>): UnitAppendix {
  return {
    id: row.id as number,
    unitId: row.unit_id as number,
    title: row.title as string,
    bodyHtml: (row.body_html as string) ?? '',
    sortOrder: row.sort_order as number,
  }
}

export interface AppendixInput {
  title: string
  bodyHtml: string
}

/** Un apéndice de OTRA unidad, con de quién es, para el buscador de "copiar desde…". */
export interface AppendixFromUnit extends UnitAppendix {
  unitName: string
  factionName: string
}

export const AppendixRepository = {
  async listByUnit(unitId: number): Promise<UnitAppendix[]> {
    return queryLocal('SELECT * FROM unit_appendices WHERE unit_id = ? ORDER BY sort_order, id', [unitId], mapAppendix)
  },

  /**
   * Todos los apéndices del programa MENOS los de esta unidad, para poder
   * copiar uno de otra. Van con el nombre de su unidad y su facción porque
   * "Reglas de asedio" repetido siete veces no se distingue de otro modo.
   */
  async listCopiables(exceptUnitId: number): Promise<AppendixFromUnit[]> {
    return queryLocal(
      `SELECT a.*, u.name AS unit_name, f.name AS faction_name
         FROM unit_appendices a
         JOIN units u ON u.id = a.unit_id
         JOIN factions f ON f.id = u.faction_id
        WHERE a.unit_id <> ?
        ORDER BY f.name, u.name, a.sort_order`,
      [exceptUnitId],
      (row) => ({
        ...mapAppendix(row),
        unitName: row.unit_name as string,
        factionName: row.faction_name as string,
      }),
    )
  },

  async create(unitId: number, input: AppendixInput): Promise<number> {
    const id = await execCatalog(
      `INSERT INTO unit_appendices (unit_id, title, body_html, sort_order)
       VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM unit_appendices WHERE unit_id = ?))`,
      [unitId, input.title.trim(), sanearHtml(input.bodyHtml), unitId],
    )
    await ChangeLogRepository.record('unidad', 'editar', `Añadió el apéndice "${input.title.trim()}"`, unitId)
    return id
  },

  async update(id: number, input: AppendixInput): Promise<void> {
    await execCatalog('UPDATE unit_appendices SET title = ?, body_html = ? WHERE id = ?', [
      input.title.trim(),
      sanearHtml(input.bodyHtml),
      id,
    ])
    // El Log guardaba aquí el id del APÉNDICE en una entrada de tipo "unidad",
    // mientras que las de al lado guardan el de la unidad. Pasaba desapercibido
    // —la pantalla del Log solo enseña el texto— hasta que ese id empezó a
    // usarse para decidir si la entrada se registra o no (los Personajes de
    // Renombre no se registran, ver changeLogRepository): con el id equivocado
    // se consultaba la unidad que no era.
    const [existente] = await queryLocal('SELECT unit_id FROM unit_appendices WHERE id = ?', [id], (row) => ({
      unitId: row.unit_id as number,
    }))
    await ChangeLogRepository.record(
      'unidad',
      'editar',
      `Editó el apéndice "${input.title.trim()}"`,
      existente?.unitId ?? null,
    )
  },

  async remove(id: number): Promise<void> {
    // Se lee antes de borrar para poder decir QUÉ se borró: después ya no hay
    // de dónde sacar el título (mismo criterio que en el resto de repositorios).
    const [existente] = await queryLocal('SELECT * FROM unit_appendices WHERE id = ?', [id], mapAppendix)
    if (!existente) return
    await execCatalog('DELETE FROM unit_appendices WHERE id = ?', [id])
    await ChangeLogRepository.record('unidad', 'editar', `Borró el apéndice "${existente.title}"`, existente.unitId)
  },

  /** Nuevo orden, por ids. Se escribe en un único lote para que no queden órdenes a medias. */
  async reorder(orderedIds: number[]): Promise<void> {
    if (orderedIds.length === 0) return
    await execCatalogBatch(
      orderedIds.map((id, indice) => ({
        sql: 'UPDATE unit_appendices SET sort_order = ? WHERE id = ?',
        params: [indice + 1, id],
      })),
    )
  },

  /**
   * Copia un apéndice a otra unidad. El resultado es un apéndice NUEVO e
   * independiente: se copia el texto tal cual estaba en ese momento.
   */
  async copyTo(appendixId: number, targetUnitId: number): Promise<number> {
    const [origen] = await queryLocal('SELECT * FROM unit_appendices WHERE id = ?', [appendixId], mapAppendix)
    if (!origen) throw new Error('El apéndice que se quería copiar ya no existe.')
    return AppendixRepository.create(targetUnitId, { title: origen.title, bodyHtml: origen.bodyHtml })
  },
}
