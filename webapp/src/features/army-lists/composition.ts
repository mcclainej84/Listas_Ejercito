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

/** Cómo se identifica y dónde va cada fila: su etiqueta visible y su puesto en el catálogo. */
interface Bucket {
  label: string
  /** `sort_order` de la categoría/etiqueta en el catálogo (ver Editor → Categorías y Etiquetas). */
  order: number
}

function tally(entries: ArmyListEntry[], bucketOf: (e: ArmyListEntry) => Bucket, total: number): CompositionRow[] {
  const acc = new Map<string, { points: number; entries: number; order: number }>()
  for (const entry of entries) {
    const { label, order } = bucketOf(entry)
    const current = acc.get(label) ?? { points: 0, entries: 0, order }
    current.points += computeEntryCost(entry.unit, entry)
    current.entries += 1
    acc.set(label, current)
  }
  return (
    Array.from(acc, ([label, v]) => ({
      label,
      points: v.points,
      entries: v.entries,
      order: v.order,
      // El guardia de `total > 0` no es paranoia: una lista puede tener entradas
      // cuyo coste sume 0 (unidades gratuitas o a medio configurar), y ahí la
      // división daría NaN y el globo enseñaría "NaN%".
      percent: total > 0 ? Math.round((v.points / total) * 100) : 0,
    }))
      // El orden es el del CATÁLOGO (Editor → Categorías y Etiquetas), no el de
      // puntos. Antes mandaban los puntos, y el resultado era que el resumen se
      // reordenaba solo cada vez que añadías una unidad: imposible comparar dos
      // listas de un vistazo porque las filas no estaban nunca en el mismo
      // sitio. Con el orden del catálogo, "Personajes, Básicas, Especiales…"
      // sale siempre igual y en el orden en que uno piensa un ejército.
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'es'))
      .map(({ order: _order, ...row }) => row)
  )
}

const SIN_ETIQUETA = 'Sin etiqueta'
const SIN_CATEGORIA = 'Sin categoría'
/** Lo que no tiene categoría/etiqueta va al final, detrás de todo lo que sí la tiene. */
const AL_FINAL = Number.MAX_SAFE_INTEGER

export function buildComposition(entries: ArmyListEntry[], total: number) {
  return {
    byTag: tally(
      entries,
      (e) => ({ label: e.unit.typeTag?.name ?? SIN_ETIQUETA, order: e.unit.typeTag?.sortOrder ?? AL_FINAL }),
      total,
    ),
    byCategory: tally(
      entries,
      (e) => ({ label: e.unit.category?.name ?? SIN_CATEGORIA, order: e.unit.category?.sortOrder ?? AL_FINAL }),
      total,
    ),
  }
}
