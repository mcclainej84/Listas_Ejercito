// ============================================================================
// Composición del ejército: en qué se han ido los puntos.
//
// Las dos preguntas que se hacen al montar una lista son "¿cuánta infantería
// llevo?" y "¿me he pasado de personajes?", y ninguna se responde mirando una
// tabla de entradas sueltas: hay que sumar mentalmente. Esto lo suma.
//
// Van en DOS repartos independientes, no en uno cruzado, porque responden a
// cosas distintas: la ETIQUETA dice de qué está hecho el ejército (infantería,
// caballería, monstruos) y la CATEGORÍA, cómo se reparte según las reglas de
// composición (personajes, básicas, especiales…). Cada uno suma el total.
//
// Vive fuera de ArmyListBuilderPage porque son funciones puras sobre las
// entradas: así se pueden probar sueltas y el archivo de la página no exporta
// nada que no sea un componente.
// ============================================================================
import { computeEntryCost } from '@/domain/armyValidation'
import type { ArmyListEntry } from '@/domain/types'

export interface CompositionRow {
  label: string
  points: number
  /** Número de ENTRADAS, no de miniaturas: la tabla de abajo ya da las miniaturas. */
  entries: number
  /** Porcentaje sobre el total de la lista, para ver el reparto de un vistazo. */
  percent: number
}

function tally(entries: ArmyListEntry[], keyOf: (e: ArmyListEntry) => string, total: number): CompositionRow[] {
  const acc = new Map<string, { points: number; entries: number }>()
  for (const entry of entries) {
    const key = keyOf(entry)
    const current = acc.get(key) ?? { points: 0, entries: 0 }
    current.points += computeEntryCost(entry.unit, entry)
    current.entries += 1
    acc.set(key, current)
  }
  return Array.from(acc, ([label, v]) => ({
    label,
    points: v.points,
    entries: v.entries,
    // El guardia de `total > 0` no es paranoia: una lista puede tener entradas
    // cuyo coste sume 0 (unidades gratuitas o a medio configurar), y ahí la
    // división daría NaN y el globo enseñaría "NaN%".
    percent: total > 0 ? Math.round((v.points / total) * 100) : 0,
  })).sort((a, b) => b.points - a.points || a.label.localeCompare(b.label, 'es'))
}

const SIN_ETIQUETA = 'Sin etiqueta'
const SIN_CATEGORIA = 'Sin categoría'

export function buildComposition(entries: ArmyListEntry[], total: number) {
  return {
    byTag: tally(entries, (e) => e.unit.typeTag?.name ?? SIN_ETIQUETA, total),
    byCategory: tally(entries, (e) => e.unit.category?.name ?? SIN_CATEGORIA, total),
  }
}
