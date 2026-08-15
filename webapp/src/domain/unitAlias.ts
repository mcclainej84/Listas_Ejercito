// ============================================================================
// El alias de una unidad: las iniciales que se pintan DENTRO de su peana en el
// Despliegue ("RO" para Ratas Ogro).
//
// Es solo eso, una etiqueta de dibujo. No se busca por él, no sale en las
// listas ni en los PDF, y dos unidades pueden compartirlo. Nada del montaje de
// ejércitos lo mira.
// ============================================================================

/** Tope de caracteres. Más de tres no caben legibles en una peana de 4 cm. */
export const ALIAS_MAX = 3

/**
 * Palabras que NO cuentan para sacar iniciales. Con ellas, "Caballeros de la
 * Muerte" daría "CDL" —tres letras que no dicen nada— en vez de "CM".
 */
const VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'con', 'a', 'al', "d'", 'en'])

/**
 * Deja un alias escrito a mano en su forma final: sin espacios, en mayúsculas
 * y recortado a ALIAS_MAX. Devuelve null si no queda nada, para no guardar la
 * cadena vacía (que no es "sin alias", es un alias en blanco).
 */
export function normalizarAlias(texto: string): string | null {
  const limpio = texto.trim().replace(/\s+/g, '').toUpperCase().slice(0, ALIAS_MAX)
  return limpio || null
}

/**
 * Iniciales automáticas a partir del nombre. Es lo que se pinta mientras nadie
 * haya escrito un alias a mano.
 *
 * Una inicial por palabra con contenido ("Ratas Ogro" → "RO"). Si el nombre es
 * de una sola palabra no hay iniciales que juntar, así que se cogen sus tres
 * primeras letras ("Skavenesclavos" → "SKA"): sigue siendo reconocible, que es
 * de lo que se trata.
 */
export function inicialesDe(nombre: string): string {
  const palabras = nombre
    .trim()
    .split(/[\s-]+/)
    .filter((p) => p && !VACIAS.has(p.toLowerCase()))
  if (palabras.length === 0) return ''
  if (palabras.length === 1) return palabras[0].slice(0, ALIAS_MAX).toUpperCase()
  return palabras
    .map((p) => p[0])
    .join('')
    .slice(0, ALIAS_MAX)
    .toUpperCase()
}

/** Lo que se pinta en la peana: el alias si lo hay, si no las iniciales del nombre. */
export function aliasDeUnidad(unidad: { alias: string | null; name: string }): string {
  return unidad.alias ?? inicialesDe(unidad.name)
}

/** Lo mínimo que hace falta saber de una unidad para comprobar si su alias choca. */
export interface UnidadConAlias {
  id: number
  name: string
  alias: string | null
}

/**
 * Las unidades de la MISMA FACCIÓN que ya usan estas iniciales.
 *
 * POR QUÉ SOLO LA FACCIÓN. Un despliegue es un ejército, y un ejército es de
 * una facción: dos unidades de facciones distintas nunca coinciden en la misma
 * mesa, así que sus iniciales no se estorban. Exigir que no se repitan en las
 * 474 unidades del programa con solo tres letras obligaría a inventar
 * abreviaturas ilegibles —hay 80 choques ahora mismo—; dentro de una facción
 * son 31, y ahí sí molestan de verdad.
 *
 * Se compara el alias EFECTIVO: el escrito a mano o, si no lo hay, las
 * iniciales del nombre. Es lo que se ve en la peana, y por tanto lo que puede
 * confundirse.
 */
export function unidadesConLasMismasIniciales(
  iniciales: string,
  unidadesDeLaFaccion: UnidadConAlias[],
  exceptoId: number,
): UnidadConAlias[] {
  const buscado = iniciales.trim().toUpperCase()
  if (!buscado) return []
  return unidadesDeLaFaccion.filter((u) => u.id !== exceptoId && aliasDeUnidad(u).toUpperCase() === buscado)
}
