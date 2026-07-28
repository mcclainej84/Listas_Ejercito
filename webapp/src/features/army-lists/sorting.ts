// ============================================================================
// Ordenación de "Unidades en la lista".
//
// Reordena DE VERDAD la lista (no es un filtro de vista): el nuevo orden es el
// que se guarda y el que sale en el PDF. Es lo que se pidió expresamente, con
// la contrapartida de que sustituye al orden manual que se hubiera montado
// arrastrando filas. Como cualquier otro cambio del borrador, no se escribe
// hasta pulsar "Guardar ejército", así que salir sin guardar lo deshace.
// ============================================================================
import { computeEntryCost } from '@/domain/armyValidation'
import type { ArmyListEntry } from '@/domain/types'

export type SortCriterion = 'coste' | 'nombre' | 'etiqueta' | 'categoria' | 'faccion'

export const SORT_LABELS: Record<SortCriterion, string> = {
  coste: 'Coste',
  nombre: 'Nombre',
  etiqueta: 'Etiqueta',
  categoria: 'Categoría',
  faccion: 'Facción',
}

/**
 * Ordena una copia de las entradas. Los criterios de agrupación (etiqueta,
 * categoría, facción) desempatan por COSTE descendente y luego por nombre: si
 * agrupas por categoría, dentro de "Personajes" quieres ver primero al caro,
 * no un orden alfabético que no dice nada.
 *
 * Categoría y etiqueta usan su `sortOrder` del catálogo, no el alfabético:
 * "Personajes, Básicas, Especiales, Singulares" es el orden con el que se
 * piensa una lista, y ordenarlas por la letra las dejaría en un orden que no
 * significa nada para nadie.
 *
 * `descending` invierte SOLO el criterio principal, no los desempates. Antes
 * esto se resolvía dando la vuelta al array entero, y el resultado era
 * incoherente: "Categoría ↓" devolvía las categorías al revés (bien) pero
 * además la unidad más barata primero dentro de cada una (mal), justo lo
 * contrario de lo que promete el párrafo de arriba.
 */
export function sortEntries(entries: ArmyListEntry[], criterion: SortCriterion, descending: boolean): ArmyListEntry[] {
  const cost = (e: ArmyListEntry) => computeEntryCost(e.unit, e)
  const byCostThenName = (a: ArmyListEntry, b: ArmyListEntry) =>
    cost(b) - cost(a) || a.unit.name.localeCompare(b.unit.name, 'es')

  /** Comparación por el criterio principal, sin desempates. Es lo único que `descending` da la vuelta. */
  const primary = (a: ArmyListEntry, b: ArmyListEntry): number => {
    switch (criterion) {
      case 'coste':
        return cost(a) - cost(b)
      case 'nombre':
        return a.unit.name.localeCompare(b.unit.name, 'es')
      case 'etiqueta':
        return (
          (a.unit.typeTag?.sortOrder ?? 9999) - (b.unit.typeTag?.sortOrder ?? 9999) ||
          (a.unit.typeTag?.name ?? '').localeCompare(b.unit.typeTag?.name ?? '', 'es')
        )
      case 'categoria':
        return (
          (a.unit.category?.sortOrder ?? 9999) - (b.unit.category?.sortOrder ?? 9999) ||
          (a.unit.category?.name ?? '').localeCompare(b.unit.category?.name ?? '', 'es')
        )
      case 'faccion':
        return a.unit.faction.name.localeCompare(b.unit.faction.name, 'es')
    }
  }

  /** Desempate dentro del grupo. Siempre en el mismo sentido, suba o baje el criterio principal. */
  const tiebreak = (a: ArmyListEntry, b: ArmyListEntry): number =>
    criterion === 'coste' || criterion === 'nombre' ? a.unit.name.localeCompare(b.unit.name, 'es') : byCostThenName(a, b)

  return entries.slice().sort((a, b) => {
    const main = primary(a, b)
    if (main !== 0) return descending ? -main : main
    return tiebreak(a, b)
  })
}
