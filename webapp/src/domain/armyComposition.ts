// ============================================================================
// Composición del ejército: cuántas unidades de cada categoría son
// OBLIGATORIAS y cuántas son el MÁXIMO permitido, según los puntos de la lista.
//
// La tabla del reglamento es esta:
//
//     Puntos          Básicas   Especiales   Singulares
//     < 2.000           2+         0-3          0-1
//     2.000 - 2.999     3+         0-4          0-2
//     3.000 - 3.999     4+         0-5          0-3
//
// Y la regla que la genera: "cada 1.000 puntos extra incrementa en uno las
// básicas obligatorias y en uno el máximo de especiales y de singulares".
//
// Por eso NO se guarda la tabla fila a fila, sino la regla que la produce: por
// cada categoría, si es mínimo o máximo, su valor base y cuánto sube por tramo.
// Guardar filas obligaría a añadirlas a mano para 5.000, 6.000… y dejaría
// fuera cualquier categoría que se cree desde Categorías y Etiquetas.
//
// OJO CON EL SENTIDO DE CADA REGLA, que es lo que más se confunde:
//   · BÁSICAS es un MÍNIMO obligatorio y NO tiene tope: llevar diez está bien.
//   · ESPECIALES y SINGULARES son un MÁXIMO y son OPCIONALES: llevar cero está
//     bien; lo que no vale es pasarse.
// Un incumplimiento nunca es un error que bloquee: es un aviso.
// ============================================================================
import type { ArmyListEntry } from '@/domain/types'

/**
 * Puntos a partir de los cuales empieza a subir el escalón. Por debajo de esta
 * cifra se aplican los valores base.
 */
export const TIER_START_POINTS = 2000
/** Cada cuántos puntos sube un escalón por encima de TIER_START_POINTS. */
export const TIER_SIZE_POINTS = 1000

export type CompositionRuleKind = 'min' | 'max'

export const RULE_KIND_LABELS: Record<CompositionRuleKind, string> = {
  min: 'Mínimo obligatorio',
  max: 'Máximo permitido',
}

/** Regla de una categoría. Una categoría sin fila propia no tiene restricción. */
export interface CompositionRule {
  categoryId: number
  kind: CompositionRuleKind
  /** Valor en el tramo más bajo (por debajo de TIER_START_POINTS). */
  base: number
  /** Cuánto sube el valor por cada tramo completo por encima. */
  step: number
}

/**
 * Escalón que corresponde a unos puntos dados. 0 para cualquier valor por
 * debajo de TIER_START_POINTS; a partir de ahí, uno más por cada tramo.
 *
 *   1.999 → 0    ·    2.000 → 1    ·    2.999 → 1    ·    3.000 → 2
 */
export function tierForPoints(points: number | null): number {
  if (points == null || points < TIER_START_POINTS) return 0
  return Math.floor((points - TIER_START_POINTS) / TIER_SIZE_POINTS) + 1
}

/** Valor efectivo de una regla para unos puntos concretos. Nunca baja de 0. */
export function ruleValueAt(rule: CompositionRule, points: number | null): number {
  return Math.max(0, rule.base + rule.step * tierForPoints(points))
}

/** "2+" para un mínimo, "0-3" para un máximo — el mismo idioma que la tabla del reglamento. */
export function formatRuleValue(kind: CompositionRuleKind, value: number): string {
  return kind === 'min' ? `${value}+` : `0-${value}`
}

export interface CompositionCheck {
  categoryId: number
  categoryName: string
  kind: CompositionRuleKind
  /** Cuántas unidades de esa categoría hay en la lista. */
  count: number
  /** Cuántas exige (mínimo) o permite (máximo) la regla con estos puntos. */
  required: number
  /** true si la lista cumple. */
  ok: boolean
}

/**
 * Comprueba la lista contra las reglas. Devuelve una entrada por regla —
 * también las que se cumplen, para poder enseñar el estado completo y no solo
 * lo que va mal.
 *
 * Cuenta ENTRADAS de la lista, no miniaturas: "dos unidades básicas" son dos
 * regimientos, tengan diez o veinte figuras cada uno.
 */
export function checkComposition(
  entries: ArmyListEntry[],
  rules: CompositionRule[],
  points: number | null,
  categoryNameById: Map<number, string>,
): CompositionCheck[] {
  const countByCategory = new Map<number, number>()
  for (const entry of entries) {
    const id = entry.unit.category?.id
    if (id == null) continue
    countByCategory.set(id, (countByCategory.get(id) ?? 0) + 1)
  }

  return rules.map((rule) => {
    const count = countByCategory.get(rule.categoryId) ?? 0
    const required = ruleValueAt(rule, points)
    return {
      categoryId: rule.categoryId,
      categoryName: categoryNameById.get(rule.categoryId) ?? 'Categoría',
      kind: rule.kind,
      count,
      required,
      ok: rule.kind === 'min' ? count >= required : count <= required,
    }
  })
}

/** Los avisos en texto, listos para enseñar. Solo lo que NO se cumple. */
export function compositionWarnings(checks: CompositionCheck[]): string[] {
  return checks
    .filter((c) => !c.ok)
    .map((c) =>
      c.kind === 'min'
        ? `${c.categoryName}: llevas ${c.count} y hacen falta ${c.required} como mínimo.`
        : `${c.categoryName}: llevas ${c.count} y el máximo es ${c.required}.`,
    )
}
