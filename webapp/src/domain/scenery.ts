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

// ---------------------------------------------------------------------------
// BIBLIOTECA VERSIONADA (ver scenery_assets / floor_assets en db/schema.sql).
//
// Reemplazar un elemento no modifica nada: crea una VERSIÓN nueva del mismo
// `slug`. Cada pieza de un mapa se guarda con el id de la versión que estaba
// vigente, así que los mapas ya hechos conservan su aspecto y el que se está
// editando adopta la nueva al guardarlo. Retirar tampoco borra: solo saca el
// elemento de la paleta.
// ---------------------------------------------------------------------------

/** Una versión concreta de un elemento de escenografía. */
export interface SceneryAsset {
  id: number
  /** Identidad estable del elemento entre versiones ('bosque', 'torre-vieja'). */
  slug: string
  version: number
  label: string
  /** Imagen en R2; null en un elemento de fábrica que sigue con su dibujo del código. */
  imageKey: string | null
  /** URL lista para un <img>, resuelta por el repositorio. */
  imageUrl: string | null
  /** Tipo de fábrica al que sustituye, si lo hay (ver SCENERY_KINDS). */
  builtinKind: SceneryKind | null
  anchoCm: number
  altoCm: number
  /** Fuera de la paleta. Los mapas que ya lo usaban lo siguen pintando. */
  retired: boolean
  createdAt: string
}

/** Un suelo de mesa: una imagen que se enlosa cada `tileCm` centímetros. */
export interface FloorAsset {
  id: number
  slug: string
  version: number
  label: string
  imageKey: string | null
  imageUrl: string | null
  /** Cuántos centímetros de mesa ocupa una repetición de la imagen. */
  tileCm: number
  /** 0–1. Cuánto se ve: por encima van la retícula, el terreno y las peanas. */
  opacity: number
  retired: boolean
  createdAt: string
}

/**
 * Lo que se ofrece en la paleta del editor: un tipo de fábrica o un elemento
 * de la biblioteca, ya resueltos a lo mismo.
 */
export interface EntradaDePaleta {
  /** Clave para React y para saber qué se ha pulsado. */
  slug: string
  label: string
  anchoCm: number
  altoCm: number
  /** Imagen de la biblioteca; sin ella se dibuja el tipo de fábrica. */
  imageUrl: string | null
  /** Qué guardar en la pieza: el tipo de fábrica (compatibilidad) y la versión. */
  kind: SceneryKind
  assetId: number | null
}

/**
 * La paleta vigente: los tipos de fábrica, sustituidos por su versión más
 * reciente cuando la haya, más los elementos propios. Sin los retirados.
 *
 * `assetsVigentes` tiene que traer SOLO la última versión de cada slug (ver
 * SceneryAssetRepository.listVigentes).
 */
export function construirPaleta(assetsVigentes: SceneryAsset[]): EntradaDePaleta[] {
  const porSlug = new Map(assetsVigentes.map((a) => [a.slug, a]))
  const entradas: EntradaDePaleta[] = []

  for (const kind of SCENERY_KINDS_CATALOGO) {
    const asset = porSlug.get(kind)
    if (asset?.retired) continue
    const info = SCENERY_KINDS_INFO[kind]
    entradas.push({
      slug: kind,
      label: asset?.label ?? info.label,
      anchoCm: asset?.anchoCm ?? info.anchoCm,
      altoCm: asset?.altoCm ?? info.altoCm,
      imageUrl: asset?.imageUrl ?? null,
      kind,
      assetId: asset?.id ?? null,
    })
  }

  for (const asset of assetsVigentes) {
    // Los que sustituyen a un tipo de fábrica ya han salido arriba.
    if (asset.retired || isSceneryKind(asset.slug)) continue
    entradas.push({
      slug: asset.slug,
      label: asset.label,
      anchoCm: asset.anchoCm,
      altoCm: asset.altoCm,
      imageUrl: asset.imageUrl,
      // Un elemento propio no tiene dibujo de fábrica al que caer; se guarda
      // con el kind más neutro para que, si algún día se perdiera su imagen,
      // siga saliendo algo con forma de pieza y no un hueco.
      kind: asset.builtinKind ?? 'ruinas',
      assetId: asset.id,
    })
  }

  return entradas
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
  /**
   * Versión de la biblioteca con la que se guardó. null = pieza anterior a la
   * biblioteca, o tipo de fábrica sin reemplazar: se dibuja como siempre.
   */
  assetId: number | null
  /** Imagen de esa versión, resuelta al leer el mapa. Es lo que se pinta. */
  imageUrl: string | null
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
  /** Suelo de fábrica. Por defecto, 'ninguna'. Solo cuenta si no hay floorId. */
  textura: TexturaMapa
  /** Suelo de la biblioteca, con su versión. null = el de fábrica de `textura`. */
  floorId: number | null
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
  floorId: number | null
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
