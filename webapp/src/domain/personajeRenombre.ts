// ============================================================================
// Reglas de visibilidad de un PERSONAJE DE RENOMBRE.
//
// Vive en el dominio y no en su repositorio porque la usan tres sitios que no
// se pueden importar entre sí sin dar una vuelta rara: el listado de la sección
// (specialCharacterRepository), el explorador del constructor de listas y el
// buscador global (que consulta unidades a secas). Un personaje oculto tiene
// que desaparecer de LOS TRES; con la regla escrita una sola vez, ninguno se
// puede quedar atrás.
// ============================================================================

/** Lo mínimo que hace falta saber de una unidad para decidir si se enseña. */
export interface UnidadOcultable {
  hidden: boolean
  /** Autor. Solo lo tienen los personajes de renombre; null = sin autor conocido. */
  userId: number | null
}

/**
 * Si el usuario dado puede VER esta unidad.
 *
 * Oculto = solo su autor. Un personaje oculto SIN autor (los creados antes de
 * que existiera la columna no lo tienen) lo sigue viendo todo el mundo: es
 * preferible enseñar de más a que un personaje desaparezca para siempre sin que
 * nadie pueda recuperarlo. Quien oculta uno de esos pasa a ser su autor, así que
 * el caso se cura solo (ver SpecialCharacterRepository.setHidden).
 */
export function esVisiblePara(unidad: UnidadOcultable, userId: number | null | undefined): boolean {
  if (!unidad.hidden) return true
  if (unidad.userId == null) return true
  return unidad.userId === userId
}
