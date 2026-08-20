// ============================================================================
// BATALLA: dos ejércitos completados, enfrentados sobre la misma mesa.
//
// Aquí vive lo que se puede decidir SIN tocar la base de datos ni la pantalla:
// si dos listas pueden pelear entre sí, y dónde cae una peana del bando de
// arriba. Está en el dominio porque lo necesitan tres sitios —el diálogo de
// alta (para no dejar crear una batalla imposible), la propia batalla (para
// pintarla) y su PDF—, y porque una regla repartida en tres copias acaba
// siendo tres reglas distintas.
// ============================================================================
import type { DeploymentPosition, Mesa } from '@/domain/deployment'

/** Lo que hace falta de una lista para saber SOBRE QUÉ se despliega. */
export interface EscenarioDeLista {
  battleMapId: number | null
  deploymentImageKey: string | null
  tableWidthCm: number
  tableHeightCm: number
}

/**
 * ¿Estas dos listas se pelean en el mismo sitio?
 *
 * Devuelve null si sí, y si no, EN QUÉ se diferencian, con palabras que se
 * puedan enseñar tal cual. Una batalla ocurre en un sitio: con dos mesas
 * distintas no hay forma honesta de enfrentar los despliegues —habría que
 * estirar uno, recortarlo o inventarse el terreno que falta—, así que no se
 * deja crear y se dice por qué.
 *
 * Con MAPA cargado basta con comparar el mapa: las medidas son las suyas. Sin
 * mapa se comparan la imagen de fondo y las medidas, que es lo que define esa
 * mesa libre.
 */
export function motivoDeEscenarioDistinto(a: EscenarioDeLista, b: EscenarioDeLista): string | null {
  if (a.battleMapId !== b.battleMapId) {
    if (a.battleMapId == null || b.battleMapId == null) return 'uno despliega sobre un mapa y el otro sobre mesa libre'
    return 'cada uno despliega sobre un mapa distinto'
  }
  // Con mapa, las medidas y el fondo los pone él: no hay nada más que mirar.
  if (a.battleMapId != null) return null
  if ((a.deploymentImageKey ?? null) !== (b.deploymentImageKey ?? null)) {
    return 'cada uno tiene una imagen de fondo distinta'
  }
  if (a.tableWidthCm !== b.tableWidthCm || a.tableHeightCm !== b.tableHeightCm) {
    return `las mesas no miden lo mismo (${a.tableWidthCm} × ${a.tableHeightCm} y ${b.tableWidthCm} × ${b.tableHeightCm} cm)`
  }
  return null
}

/**
 * Coloca una peana del bando de ARRIBA sobre la mesa de la batalla.
 *
 * Cada ejército se despliega abajo en su propia pantalla, porque es lo cómodo
 * para quien juega (ver ArmyList.deploymentSide). Para enfrentarlos, el bando B
 * se gira 180° respecto al centro de la mesa: lo que estaba abajo queda arriba,
 * y lo que estaba a la izquierda, a la derecha. No es un espejo —un espejo
 * cambiaría el orden de las unidades de un flanco— sino media vuelta, que es lo
 * que de verdad pasa cuando te sientas al otro lado.
 */
export function enfrentarPosicion(pos: DeploymentPosition, mesa: Mesa): DeploymentPosition {
  return { ...pos, xCm: mesa.anchoCm - pos.xCm, yCm: mesa.altoCm - pos.yCm }
}
