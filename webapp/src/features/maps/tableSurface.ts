// ============================================================================
// El SUELO del tablero: lo que hay debajo de la escenografía y de las peanas.
//
// Lo usan los tres sitios donde se pinta una mesa —el editor de mapas, la
// miniatura del listado y el Despliegue—, y por eso vive aquí y no en ninguno
// de ellos: un mapa tiene que verse igual se mire desde donde se mire.
//
// MUY SUAVE, A PROPÓSITO. La hierba es un fondo, no el tema. Por encima van la
// retícula de 30 cm, la línea central, las ilustraciones del terreno y hasta
// veinte peanas de colores: si el suelo tuviera contraste de verdad, competiría
// con todo eso y la mesa dejaría de leerse. Así que son manchas de verde a un
// 10 % de opacidad como mucho sobre el mismo pergamino de siempre, más un rayado
// finísimo en dos direcciones que a tamaño de pantalla no se ve como rayas sino
// como grano de hierba.
// ============================================================================
import type { CSSProperties } from 'react'
import type { TexturaMapa } from '@/domain/scenery'

/** El pergamino de siempre: el tablero como un plano, sin terreno pintado. */
const PERGAMINO = '#e7dcc0'

export function estiloDeSuelo(textura: TexturaMapa): CSSProperties {
  if (textura !== 'hierba') return { backgroundColor: PERGAMINO }
  return {
    // El color base apenas se mueve del pergamino (un punto hacia el verde):
    // lo que da el prado son las manchas, no el tinte.
    backgroundColor: '#dfd9b4',
    backgroundImage: [
      // Tres manchas de tamaños distintos y sin múltiplos entre sí, para que al
      // repetirse no se note la cuadrícula del patrón.
      'radial-gradient(ellipse 70px 46px at 22% 32%, rgba(107,122,46,.10), transparent 70%)',
      'radial-gradient(ellipse 96px 58px at 68% 64%, rgba(107,122,46,.08), transparent 72%)',
      'radial-gradient(ellipse 54px 38px at 44% 84%, rgba(63,74,25,.07), transparent 70%)',
      // El "grano" de hierba: dos rayados casi cruzados y casi invisibles.
      'repeating-linear-gradient(115deg, rgba(63,74,25,.05) 0 1px, transparent 1px 4px)',
      'repeating-linear-gradient(65deg, rgba(255,255,255,.05) 0 1px, transparent 1px 5px)',
    ].join(','),
    backgroundSize: '163px 121px, 227px 167px, 139px 109px, auto, auto',
  }
}
