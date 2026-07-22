// ============================================================================
// Formateo de valores de unidad para mostrar. Lógica pura, sin React ni SQL,
// para que la misma regla valga en la ficha, en el constructor de listas y en
// las exportaciones — y no acabe cada pantalla inventándose la suya.
// ============================================================================

import type { SpecialRule } from '@/domain/types'

/**
 * Une varias listas de reglas especiales en una sola, sin repetir (por `id`)
 * y respetando el orden de llegada: primero las de la unidad, después las que
 * aportan sus monturas/monstruos.
 *
 * La misma regla puede venir por los dos lados —un Señor del Caos con
 * "Miedo" propio montando un engendro que también causa Miedo— y en la ficha
 * debe aparecer UNA vez. Se compara por `id` y no por nombre porque
 * special_rules es la única fuente de verdad: dos filas distintas con el
 * mismo nombre serían un dato mal metido, no dos reglas iguales.
 */
export function mergeSpecialRules(...lists: SpecialRule[][]): SpecialRule[] {
  const seen = new Set<number>()
  const merged: SpecialRule[] = []
  for (const list of lists) {
    for (const rule of list) {
      if (seen.has(rule.id)) continue
      seen.add(rule.id)
      merged.push(rule)
    }
  }
  return merged
}

/** Valores admitidos para la tirada de salvación por armadura (T.S.). */
export const ARMOR_SAVE_VALUES = [0, 1, 2, 3, 4, 5, 6] as const

/**
 * Cómo se escribe una T.S.:
 *
 * - `null` (sin definir todavía en la ficha) → null; quien llame decide si
 *   oculta la línea entera.
 * - `0` → "—": la unidad NO tiene salvación por armadura. No es lo mismo que
 *   "sin definir": es un dato afirmativo.
 * - `1..6` → "1+", "2+"… — la tirada que hay que igualar o superar.
 *
 * Fuera de 0-6 no hay valor legal, pero si llegase algo raro de un import se
 * devuelve tal cual con el "+" en vez de romper la pantalla.
 */
export function formatArmorSave(value: number | null | undefined): string | null {
  if (value == null) return null
  if (value <= 0) return '—'
  return `${value}+`
}
