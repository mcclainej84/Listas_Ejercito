// ============================================================================
// Escudo metálico por categoría, compartido por el constructor de listas y el
// despliegue.
//
// Vivía dentro de ArmyListBuilderPage. Al necesitarlo también el despliegue se
// sacó aquí en vez de copiarlo: dos tablas de colores separadas acabarían
// diciendo cosas distintas del mismo dato en dos pantallas contiguas.
// ============================================================================
import type { ShieldMetal } from '@/shared/ui/icons'

/**
 * Oro las Singulares, bronce las Básicas y plata las Especiales. Los personajes
 * no llevan escudo (decisión del usuario), y tampoco las categorías sin metal
 * asignado — devolver null es lo correcto ahí, no inventarles uno.
 */
export function categoryShieldMetal(categoryCode: string | null | undefined): ShieldMetal | null {
  switch (categoryCode) {
    case 'SINGULAR':
      return 'oro'
    case 'BASICA':
      return 'bronce'
    case 'ESPECIAL':
      return 'plata'
    default:
      return null
  }
}
