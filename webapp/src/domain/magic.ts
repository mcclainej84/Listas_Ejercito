// ============================================================================
// Magia: sendas, hechizos y nivel de mago.
//
// Una SENDA es un conjunto de hechizos (Fuego, Nigromancia, Bestias…) que
// pertenece a uno de cuatro GRUPOS. Un personaje hechicero tiene un NIVEL
// (1 a 4) y puede conocer VARIAS sendas a la vez — de ahí que la relación
// unidad↔senda viva en su propia tabla y no en una columna.
// ============================================================================

/** Los cuatro grupos de sendas. Es una lista cerrada: no se crean desde la interfaz. */
export const MAGIC_GROUPS = ['ELEMENTALES', 'MISTICAS', 'OSCURAS', 'MANUSCRITOS'] as const

export type MagicGroup = (typeof MAGIC_GROUPS)[number]

export const MAGIC_GROUP_LABELS: Record<MagicGroup, string> = {
  ELEMENTALES: 'Elementales',
  MISTICAS: 'Místicas',
  OSCURAS: 'Oscuras',
  MANUSCRITOS: 'Manuscritos',
}

export function isMagicGroup(value: unknown): value is MagicGroup {
  return typeof value === 'string' && (MAGIC_GROUPS as readonly string[]).includes(value)
}

/**
 * Etiquetas de tipo que convierten a un personaje en lanzador de hechizos.
 *
 * Se comparan por CÓDIGO y no por nombre: el código no cambia al renombrar la
 * etiqueta desde Categorías y Etiquetas, así que "Hechicero" puede pasar a
 * llamarse "Mago" sin que nadie deje de poder elegir sendas.
 */
export const WIZARD_TAG_CODES = ['HECHICERO', 'ARCHIMAGO'] as const

/** ¿Esta etiqueta de tipo hace que el personaje pueda llevar sendas? */
export function isWizardTag(code: string | null | undefined): boolean {
  return code != null && (WIZARD_TAG_CODES as readonly string[]).includes(code)
}

/** Niveles de mago. El 0 no existe: una unidad sin magia simplemente no tiene nivel (null). */
export const MAGIC_LEVELS = [1, 2, 3, 4] as const

export type MagicLevel = (typeof MAGIC_LEVELS)[number]


/**
 * Tope de hechizos por senda.
 *
 * La estructura normal es 7 —dos de nivel 1, dos de nivel 2, dos de nivel 3 y
 * uno de nivel 4—, y la cumplen 28 de las 30 sendas del catálogo original.
 *
 * OJO: este límite se aplica al AÑADIR, no al cargar. Dos sendas vienen del
 * fichero de origen fuera de esa norma (Pergaminos sagrados con 13 y Yunque
 * rúnico con 4) y son datos legítimos del usuario: rechazarlas al leer habría
 * sido hacer desaparecer información suya sin avisar. Lo que se impide es que
 * una senda CREZCA por encima del tope.
 */
export const MAX_SPELLS_PER_PATH = 7

/** Reparto de hechizos por nivel de la estructura normal, para poder señalar lo que se sale de ella. */
export const EXPECTED_SPELLS_BY_LEVEL: Record<MagicLevel, number> = { 1: 2, 2: 2, 3: 2, 4: 1 }

export interface MagicSpell {
  id: number
  pathId: number
  level: number
  name: string
  /** Dificultad de lanzamiento ("6+", "9+"…). */
  difficulty: string | null
  /** Alcance ("60 cm.", "Sin límite"…). */
  range: string | null
  /** Número de impactos ("1D6", "1xFila", "Plantilla"…). */
  hits: string | null
  /** Daño ("F4", "Hiere 5+"…). */
  damage: string | null
  /** Si el hechizo permanece activo entre turnos. */
  staysActive: boolean
  /** Dónde se puede lanzar ("Fuera del CaC", "En CaC", "Dentro o Fuera del CaC"). */
  cac: string | null
  rules: string | null
  sortOrder: number
}

export interface MagicPath {
  id: number
  code: string
  name: string
  group: MagicGroup
  sortOrder: number
}

export interface MagicPathDetail extends MagicPath {
  spells: MagicSpell[]
}

/** Datos editables de una senda. */
export interface MagicPathInput {
  code: string
  name: string
  group: MagicGroup
}

/** Datos editables de un hechizo. */
export interface MagicSpellInput {
  level: number
  name: string
  difficulty: string | null
  range: string | null
  hits: string | null
  damage: string | null
  staysActive: boolean
  cac: string | null
  rules: string | null
}

/**
 * Avisos sobre una senda, para enseñarlos en el editor sin bloquear nada.
 * Devuelve lista vacía si encaja con la estructura normal.
 */
export function pathWarnings(spells: Pick<MagicSpell, 'level'>[]): string[] {
  // Una senda recién creada está vacía a propósito. Sacarle cuatro avisos de
  // "faltan hechizos" nada más crearla es ruido: el aviso es para lo que se
  // sale de la norma, no para lo que aún no ha empezado.
  if (spells.length === 0) return []
  const warnings: string[] = []
  if (spells.length > MAX_SPELLS_PER_PATH) {
    warnings.push(`Tiene ${spells.length} hechizos; lo normal son ${MAX_SPELLS_PER_PATH}.`)
  }
  for (const level of MAGIC_LEVELS) {
    const count = spells.filter((s) => s.level === level).length
    const expected = EXPECTED_SPELLS_BY_LEVEL[level]
    if (count !== expected) {
      warnings.push(`Nivel ${level}: ${count} ${count === 1 ? 'hechizo' : 'hechizos'} en vez de ${expected}.`)
    }
  }
  return warnings
}
