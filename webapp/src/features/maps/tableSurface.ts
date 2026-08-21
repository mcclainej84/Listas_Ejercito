// ============================================================================
// El SUELO del tablero: lo que hay debajo de la escenografía y de las peanas.
//
// Lo usan los tres sitios donde se pinta una mesa —el editor de mapas, la
// miniatura del listado y el Despliegue—, y por eso vive aquí y no en ninguno
// de ellos: un mapa tiene que verse igual se mire desde donde se mire.
//
// DOS ORÍGENES. Los de FÁBRICA (liso y hierba) son puro CSS, sin imágenes que
// descargar. Los de la BIBLIOTECA son una foto que se enlosa cada `tileCm`
// centímetros de mesa (ver floor_assets); como se guardan versionados, un mapa
// antiguo sigue viendo la imagen con la que se hizo.
//
// MUY SUAVES, LOS DOS. El suelo es un fondo, no el tema. Por encima van la
// retícula de 30 cm, la línea central, las ilustraciones del terreno y hasta
// veinte peanas de colores: si el suelo tuviera contraste de verdad,
// competiría con todo eso y la mesa dejaría de leerse. De ahí que la hierba de
// fábrica sean manchas al 10 % y que los suelos con imagen lleven su propia
// opacidad, que se aclara con un velo de pergamino por encima.
// ============================================================================
import type { CSSProperties } from 'react'
import type { FloorAsset, TexturaMapa } from '@/domain/scenery'

/** El pergamino de siempre: el tablero como un plano, sin terreno pintado. */
const PERGAMINO = '#e7dcc0'
/** El mismo color, en componentes, para poder velar con él una imagen. */
const PERGAMINO_RGB = '231, 220, 192'

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

/**
 * El suelo del mapa, sea de la biblioteca o de fábrica.
 *
 * Con imagen, se enlosa en TANTO POR CIENTO del ancho de la mesa y no en
 * píxeles: así una losa de 60 cm mide 60 cm se vea la mesa como se vea, y no
 * cambia de escala al agrandar la ventana.
 *
 * La opacidad se consigue con un velo de pergamino ENCIMA de la imagen, dentro
 * de la misma pila de fondos. Es la única forma: `opacity` en CSS afectaría
 * también a la escenografía y a las peanas, que son hijas del tablero.
 */
export function estiloDeSueloDeMapa(
  textura: TexturaMapa,
  suelo: FloorAsset | null,
  anchoCm: number,
  altoCm: number,
  /**
   * Foto del escenario del propio mapa. Si la hay, MANDA sobre el suelo y sobre
   * la textura, y se estira a la mesa entera en vez de enlosarse: en un suelo la
   * imagen es la textura del tablero y se repite; aquí la imagen ES el mapa —
   * este bosque, este río, este puente— y repetirla lo destruiría. Tampoco se
   * vela con pergamino: un suelo se aclara para no competir con las peanas,
   * pero aclarar el mapa sería borrar lo que se ha ido a ver.
   */
  imagenFondoUrl?: string | null,
): CSSProperties {
  if (imagenFondoUrl) {
    return {
      backgroundColor: PERGAMINO,
      backgroundImage: `url("${imagenFondoUrl}")`,
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
    }
  }
  if (!suelo?.imageUrl) return estiloDeSuelo(textura)
  const velo = Math.min(1, Math.max(0, 1 - suelo.opacity))
  const anchoLosa = (suelo.tileCm / anchoCm) * 100
  const altoLosa = (suelo.tileCm / altoCm) * 100
  return {
    backgroundColor: PERGAMINO,
    backgroundImage: [
      `linear-gradient(rgba(${PERGAMINO_RGB},${velo}), rgba(${PERGAMINO_RGB},${velo}))`,
      `url("${suelo.imageUrl}")`,
    ].join(','),
    backgroundSize: `auto, ${anchoLosa}% ${altoLosa}%`,
    backgroundRepeat: 'no-repeat, repeat',
  }
}
