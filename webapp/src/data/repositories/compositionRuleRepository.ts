// ============================================================================
// Reglas de composición del ejército (ver category_composition_rules en
// db/schema.sql y domain/armyComposition.ts).
//
// Es configuración GLOBAL: una sola para todos los ejércitos y todas las
// facciones. Vive en el catálogo, así que se lee de la copia local y se
// escribe por red con execCatalog, igual que categorías o etiquetas.
//
// Una categoría SIN fila aquí no tiene restricción. Por eso "quitarle la
// regla" a una categoría es borrar su fila, no guardar ceros: un máximo de 0
// significaría "no puedes llevar ninguna", que es una regla muy distinta de
// "no hay regla".
// ============================================================================
import { execCatalog, execCatalogBatch } from '@/data/sqlite/client'
import { queryLocal } from '@/data/sqlite/localCatalog'
import { UnitCategoryRepository } from '@/data/repositories/lookupRepositories'
import type { CompositionRule, CompositionRuleKind } from '@/domain/armyComposition'

function mapRule(row: Record<string, unknown>): CompositionRule {
  return {
    categoryId: row.category_id as number,
    kind: (row.kind as CompositionRuleKind) === 'min' ? 'min' : 'max',
    base: (row.base as number) ?? 0,
    step: (row.step as number) ?? 0,
  }
}

export const CompositionRuleRepository = {
  async listAll(): Promise<CompositionRule[]> {
    return queryLocal('SELECT * FROM category_composition_rules', [], mapRule)
  },

  /** Crea o actualiza la regla de una categoría. */
  async save(rule: CompositionRule): Promise<void> {
    await execCatalog(
      `INSERT INTO category_composition_rules (category_id, kind, base, step) VALUES (?, ?, ?, ?)
       ON CONFLICT(category_id) DO UPDATE SET kind = excluded.kind, base = excluded.base, step = excluded.step`,
      [rule.categoryId, rule.kind, rule.base, rule.step],
    )
  },

  /** Quita la regla de una categoría: vuelve a "sin restricción". */
  async remove(categoryId: number): Promise<void> {
    await execCatalog('DELETE FROM category_composition_rules WHERE category_id = ?', [categoryId])
  },

  /**
   * Guarda TODAS las reglas de una vez, que es como se edita la pantalla: las
   * categorías presentes se crean o actualizan y las ausentes se borran.
   *
   * En un único batch para que no pueda quedarse a medias — media
   * configuración de composición guardada daría avisos que no se corresponden
   * con nada.
   */
  async replaceAll(rules: CompositionRule[]): Promise<void> {
    const keep = rules.map((r) => r.categoryId)
    await execCatalogBatch([
      {
        sql:
          keep.length > 0
            ? `DELETE FROM category_composition_rules WHERE category_id NOT IN (${keep.map(() => '?').join(',')})`
            : 'DELETE FROM category_composition_rules',
        params: keep,
      },
      ...rules.map((rule) => ({
        sql: `INSERT INTO category_composition_rules (category_id, kind, base, step) VALUES (?, ?, ?, ?)
              ON CONFLICT(category_id) DO UPDATE SET kind = excluded.kind, base = excluded.base, step = excluded.step`,
        params: [rule.categoryId, rule.kind, rule.base, rule.step],
      })),
    ])
  },
}

/**
 * Reglas del reglamento base, para que "Selección de puntos" venga ya
 * configurada en vez de en blanco:
 *
 *     Básicas      2+   y una más por tramo
 *     Especiales   0-3  y una más por tramo
 *     Singulares   0-1  y una más por tramo
 *
 * Se siembran UNA sola vez y solo si no hay ninguna regla guardada: en cuanto
 * el usuario configura lo suyo, esto no vuelve a tocar nada. Se emparejan por
 * CÓDIGO de categoría, no por nombre, para que sigan funcionando aunque las
 * renombre desde Categorías y Etiquetas.
 */
export async function seedDefaultCompositionRules(): Promise<void> {
  const existing = await CompositionRuleRepository.listAll()
  if (existing.length > 0) return

  const categories = await UnitCategoryRepository.listAll()
  const idByCode = new Map(categories.map((c) => [c.code, c.id]))
  const defaults: Array<[string, CompositionRuleKind, number, number]> = [
    ['BASICA', 'min', 2, 1],
    ['ESPECIAL', 'max', 3, 1],
    ['SINGULAR', 'max', 1, 1],
  ]
  const rules = defaults
    .filter(([code]) => idByCode.has(code))
    .map(([code, kind, base, step]) => ({ categoryId: idByCode.get(code) as number, kind, base, step }))

  if (rules.length > 0) await CompositionRuleRepository.replaceAll(rules)
}
