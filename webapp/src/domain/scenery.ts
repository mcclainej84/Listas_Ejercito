// ============================================================================
import type { TamanoCm } from '@/domain/deployment'
// Escenografía de un mapa: los elementos de terreno que se colocan sobre la
// mesa (bosques, colinas, ríos, rocas…).
//
// MISMAS UNIDADES QUE EL DESPLIEGUE: centímetros reales de mesa. Un mapa y un
// despliegue hablan del mismo tablero, así que comparten medidas, límites y
// funciones (ver domain/deployment). Si mañana se quieren superponer, ya
// encajan.
//
// EL CATÁLOGO DE TIPOS ES CERRADO. No se crean tipos desde la interfaz: cada
// uno tiene su forma dibujada a mano (ver SceneryShape), y un tipo "libre"
// saldría como un rectángulo gris sin significado. Añadir uno nuevo es añadir
// aquí su entrada y allí su dibujo.
// ============================================================================

export const SCENERY_KINDS = [
  'bosque',
  'colina',
  'colinaRocosa',
  'rio',
  'laguna',
  'pantano',
  'rocas',
  'penasco',
  'roca',
  'lajas',
  'ruinas',
  'edificio',
  'casa',
  'casaCuadrada',
  'campo',
  'muro',
  'puente',
  'camino',
] as const

export type SceneryKind = (typeof SCENERY_KINDS)[number]

export interface SceneryKindInfo {
  kind: SceneryKind
  label: string
  /** Tamaño con el que nace al añadirlo, en cm. Sale de piezas de escenografía reales. */
  anchoCm: number
  altoCm: number
}

/**
 * Los tipos y su tamaño de salida. Un bosque de 30 × 25 y un río que cruza la
 * mesa entera no son el mismo objeto, así que cada uno nace con la medida que
 * de verdad suele tener sobre una mesa: así se coloca y ya está, en vez de
 * tener que redimensionar cada pieza nada más ponerla.
 */
export const SCENERY_KINDS_INFO: Record<SceneryKind, SceneryKindInfo> = {
  bosque: { kind: 'bosque', label: 'Bosque', anchoCm: 30, altoCm: 25 },
  colina: { kind: 'colina', label: 'Colina', anchoCm: 35, altoCm: 28 },
  // Meseta de cantiles: más grande que la colina de tierra y con la proporción
  // de su ilustración (1,39:1), para que nazca sin deformar.
  colinaRocosa: { kind: 'colinaRocosa', label: 'Colina rocosa', anchoCm: 40, altoCm: 29 },
  rio: { kind: 'rio', label: 'Río', anchoCm: 180, altoCm: 14 },
  laguna: { kind: 'laguna', label: 'Laguna', anchoCm: 28, altoCm: 20 },
  pantano: { kind: 'pantano', label: 'Pantano', anchoCm: 30, altoCm: 22 },
  rocas: { kind: 'rocas', label: 'Rocas', anchoCm: 18, altoCm: 14 },
  // Las tres piedras sueltas: un peñasco grande, una roca suelta y un
  // afloramiento de lajas, más ancho que alto porque es una plancha.
  penasco: { kind: 'penasco', label: 'Peñasco', anchoCm: 12, altoCm: 13 },
  roca: { kind: 'roca', label: 'Roca', anchoCm: 8, altoCm: 8 },
  lajas: { kind: 'lajas', label: 'Lajas', anchoCm: 20, altoCm: 11 },
  ruinas: { kind: 'ruinas', label: 'Ruinas', anchoCm: 24, altoCm: 20 },
  edificio: { kind: 'edificio', label: 'Edificio', anchoCm: 20, altoCm: 16 },
  // La proporción sale de la propia ilustración (1,19:1), para que nazca sin
  // deformar y solo haya que colocarla.
  casa: { kind: 'casa', label: 'Casa', anchoCm: 20, altoCm: 17 },
  casaCuadrada: { kind: 'casaCuadrada', label: 'Casa cuadrada', anchoCm: 16, altoCm: 18 },
  campo: { kind: 'campo', label: 'Sembrado', anchoCm: 34, altoCm: 24 },
  muro: { kind: 'muro', label: 'Muro', anchoCm: 30, altoCm: 3 },
  puente: { kind: 'puente', label: 'Puente', anchoCm: 16, altoCm: 20 },
  camino: { kind: 'camino', label: 'Camino', anchoCm: 120, altoCm: 10 },
}

/**
 * Los tipos que se OFRECEN en la paleta del editor.
 *
 * "Rocas" se retiró al añadir Peñasco, Roca y Lajas, que lo cubren mejor; pero
 * sigue en SCENERY_KINDS porque hay mapas guardados que lo usan, y quitarlo de
 * ahí haría desaparecer esas piezas sin avisar. Se deja de ofrecer, no se
 * borra.
 */
export const SCENERY_KINDS_CATALOGO: readonly SceneryKind[] = SCENERY_KINDS.filter((k) => k !== 'rocas')

export function isSceneryKind(value: unknown): value is SceneryKind {
  return typeof value === 'string' && (SCENERY_KINDS as readonly string[]).includes(value)
}

/** Una pieza colocada sobre el mapa. `x`/`y` son su CENTRO, en cm. */
export interface SceneryPiece {
  /** Negativo mientras es nueva y no se ha guardado (mismo truco que las entradas de lista). */
  id: number
  kind: SceneryKind
  xCm: number
  yCm: number
  anchoCm: number
  altoCm: number
  /** Grados en el sentido de las agujas del reloj. Un río en diagonal es lo normal, no la excepción. */
  rotacion: number
  /** Nombre propio ("Bosque de Athel Loren"); null = se usa el del tipo. */
  nombre: string | null
}

/** Tamaños mínimos y máximos de una pieza, en cm. */
export const PIEZA_MIN_CM = 2
export const PIEZA_MAX_CM = 240

/**
 * TEXTURA del tablero: el suelo sobre el que se pinta la escenografía.
 *
 * 'ninguna' es el pergamino liso de siempre, que es lo que quiere quien usa la
 * mesa como un plano. 'hierba' pinta un prado muy suave: lo justo para que se
 * lea como campo y no tanto como para tapar la retícula ni competir con las
 * piezas, que es lo que de verdad hay que mirar.
 */
export const TEXTURAS = ['ninguna', 'hierba'] as const
export type TexturaMapa = (typeof TEXTURAS)[number]

export function esTextura(valor: unknown): valor is TexturaMapa {
  return typeof valor === 'string' && (TEXTURAS as readonly string[]).includes(valor)
}

/** Un mapa con su escenografía. */
export interface MapaDetalle {
  id: number
  name: string
  anchoCm: number
  altoCm: number
  userId: number | null
  updatedAt: string
  /** Suelo del tablero. Por defecto, 'ninguna'. */
  textura: TexturaMapa
  piezas: SceneryPiece[]
}

export interface MapaResumen {
  id: number
  name: string
  anchoCm: number
  altoCm: number
  userId: number | null
  /** Quién lo hizo. Los mapas son públicos, así que hace falta para saber cuáles son tuyos. */
  ownerName: string | null
  updatedAt: string
  textura: TexturaMapa
  piezas: number
}

/**
 * Tamaño de una pieza a partir de dónde se ha arrastrado su tirador de esquina.
 *
 * EL GIRO HAY QUE DESHACERLO. El tirador vive en la esquina de la pieza y gira
 * con ella, así que al arrastrarlo el ratón se mueve en los ejes de la MESA
 * pero lo que se está estirando son el ancho y el fondo de la PIEZA, que a 40°
 * apuntan a otro sitio. Tomar la distancia tal cual daba un tamaño que crecía y
 * encogía de forma aparentemente aleatoria según hacia dónde estuviera girada.
 *
 * Se gira el vector centro → ratón en sentido contrario a la pieza, y ya sí
 * cada componente es el semiancho y el semifondo. Por dos, porque la pieza está
 * centrada en su posición y crece por los cuatro lados a la vez.
 *
 * Se usa el valor ABSOLUTO para que arrastrar más allá del centro no dé
 * medidas negativas: pasado ese punto la pieza deja de encoger y vuelve a
 * crecer, que es lo que hace cualquier editor.
 */
export function tamanoDesdeTirador(dxCm: number, dyCm: number, rotacionGrados: number): TamanoCm {
  const rad = (-rotacionGrados * Math.PI) / 180
  const cos = Math.cos(rad)
  const sen = Math.sin(rad)
  return {
    anchoCm: Math.abs(dxCm * cos - dyCm * sen) * 2,
    altoCm: Math.abs(dxCm * sen + dyCm * cos) * 2,
  }
}
