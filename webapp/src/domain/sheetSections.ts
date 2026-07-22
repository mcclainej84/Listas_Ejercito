// ============================================================================
// Secciones de texto de una ficha y su ancho.
//
// Cada apartado en negrita de la tarjeta ("Tamaño de la unidad", "Opciones",
// "Reglas especiales"…) puede estrecharse por separado y por ficha. El motivo
// es la ILUSTRACIÓN: se coloca libremente sobre la tarjeta, y sin poder
// estrechar el texto no había forma de dejarle hueco — o la imagen pisaba las
// letras, o había que moverla a un sitio que no lucía.
//
// El ancho se guarda en PORCENTAJE del ancho útil de la tarjeta, no en
// píxeles, para que valga igual en la vista previa (CSS, ancho fluido) y en la
// exportación (canvas de 760 px, ver exportSheet.ts): un 64% es el mismo
// resultado en los dos sitios.
// ============================================================================

export const SHEET_SECTIONS = ['tamano', 'equipo', 'montura', 'opciones', 'mando', 'reglas'] as const

export type SheetSection = (typeof SHEET_SECTIONS)[number]

/** Ancho por sección, en % del ancho útil de la tarjeta. Lo que falte usa el valor por defecto. */
export type SectionWidths = Partial<Record<SheetSection, number>>

/**
 * 64% — el ancho que tenía la columna de texto antes de que esto existiera
 * (`.ficha-left-col { width: 64% }`). Como valor por defecto, las fichas ya
 * hechas se siguen viendo exactamente igual.
 */
export const DEFAULT_SECTION_WIDTH = 64

/** Límites del ajuste: por debajo de 25% el texto se rompe en sílabas sueltas. */
export const MIN_SECTION_WIDTH = 25
export const MAX_SECTION_WIDTH = 100

export const SECTION_LABELS: Record<SheetSection, string> = {
  tamano: 'Tamaño de la unidad',
  equipo: 'Equipo',
  montura: 'Montura',
  opciones: 'Opciones',
  mando: 'Grupo de mando',
  reglas: 'Reglas especiales',
}

/** Ancho de una sección, con el valor por defecto y acotado al rango válido. */
export function sectionWidth(widths: SectionWidths | null | undefined, section: SheetSection): number {
  const raw = widths?.[section]
  if (typeof raw !== 'number' || Number.isNaN(raw)) return DEFAULT_SECTION_WIDTH
  return Math.min(MAX_SECTION_WIDTH, Math.max(MIN_SECTION_WIDTH, raw))
}

/**
 * Lee el JSON guardado en la base de datos. Tolera basura (null, texto no
 * válido, claves desconocidas, valores no numéricos) devolviendo lo que se
 * pueda aprovechar: es una preferencia visual, nunca debe romper una ficha.
 */
export function parseSectionWidths(raw: unknown): SectionWidths {
  if (typeof raw !== 'string' || raw.trim() === '') return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: SectionWidths = {}
    for (const section of SHEET_SECTIONS) {
      const value = parsed?.[section]
      if (typeof value === 'number' && !Number.isNaN(value)) result[section] = value
    }
    return result
  } catch {
    return {}
  }
}


/**
 * Fichas de atributos (las filas de la tabla M/HA/HP/F…) ocultas en una hoja.
 * Se identifican por la clave que les da `unifiedProfileRows`: "base-12",
 * "champion-5", "montura-9", "carro-3", "upgrade-7".
 *
 * Se guardan las OCULTAS y no las visibles a propósito: si mañana se le añade
 * una montura o un campeón a la unidad, su fila aparece por defecto en vez de
 * quedarse invisible sin que nadie entienda por qué.
 */
export function parseHiddenProfiles(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.trim() === '') return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}
