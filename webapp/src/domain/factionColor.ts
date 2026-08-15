// ============================================================================
// El color de una facción: su distintivo cuando el emblema no se puede leer.
//
// POR QUÉ NO SALEN DEL EMBLEMA. Es lo primero que se intentó. Los 22 emblemas
// son ilustraciones sepia sobre pergamino: al muestrearlos, sus tonos caen
// todos en la franja 23°–47° y nueve son prácticamente grises (saturación por
// debajo de 0,08). Sacados de ahí, los 22 colores habrían sido el mismo marrón,
// que es justo lo contrario de lo que hacen falta. Así que se eligen por lo que
// cada facción ES —el rojo del Imperio, el azul de Bretonia, el verde de los
// Orcos— y se comprueba que ningún par quede demasiado cerca.
//
// SEPARACIÓN COMPROBADA. Con 22 facciones el par más parecido está a 17,6 de
// distancia perceptiva (CIE76) y la mediana es 60. Por debajo de ~15 dos
// colores empiezan a confundirse de un vistazo, así que hay margen.
//
// NO SON PLANOS. Sobre la mesa cada peana se pinta con este color MÁS una
// textura (ver `estiloDePeana`): un degradado diagonal muy suave y un
// entramado fino. Un plano liso al lado de las ilustraciones del terreno se ve
// como un agujero recortado.
// ============================================================================

/** Gris neutro para una facción sin color asignado. No es un color de nadie. */
export const COLOR_FACCION_POR_DEFECTO = '#6b6a63'

// Los 22 colores de partida NO están aquí: se siembran en una migración del
// Worker (ver MIGRATIONS, "Colores de partida de las facciones"). El color vive
// en la base y se edita desde la ficha de la facción, así que tenerlo también
// en el código sería una segunda verdad que se quedaría vieja al primer cambio.

/** "#rrggbb" → sus tres componentes. Devuelve null si no es un color válido. */
function componentes(color: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Si sobre este color hay que escribir en claro o en oscuro.
 *
 * Se usa la luminancia relativa de la WCAG y no el "brillo" a ojo: un amarillo
 * saturado tiene los tres canales altos pero se percibe clarísimo, y con texto
 * blanco encima no habría quien lo leyera.
 */
export function textoSobre(color: string | null | undefined): '#f6efdc' | '#1c1a16' {
  const rgb = componentes(color ?? COLOR_FACCION_POR_DEFECTO) ?? [107, 106, 99]
  const lineal = rgb.map((c) => {
    const x = c / 255
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  const luminancia = 0.2126 * lineal[0] + 0.7152 * lineal[1] + 0.0722 * lineal[2]
  return luminancia > 0.45 ? '#1c1a16' : '#f6efdc'
}

/**
 * EL DESGASTE de una peana: dónde está rozada la pintura y dónde se ha
 * ensuciado.
 *
 * Es una lista de manchas en TANTO POR CIENTO de la peana, no en píxeles, para
 * que valga igual en una de 4 cm que en un carro de 5 × 10 y para que la
 * pantalla y el PNG/PDF exportados pinten exactamente lo mismo (ver
 * renderTableCanvas, que lee esta misma lista).
 *
 * Las posiciones están elegidas a mano, sin simetría ni repartos regulares: en
 * cuanto el desgaste se ordena deja de parecer desgaste y parece un patrón.
 * Los claros van arriba y hacia la izquierda (donde da la luz y donde más se
 * roza) y los oscuros abajo y a la derecha, que es donde se acumula la
 * suciedad.
 */
export interface ManchaDeDesgaste {
  /** Centro, en % del ancho y del alto. */
  x: number
  y: number
  /** Radio, en % del lado mayor. */
  r: number
  /** true = pintura perdida (aclara); false = suciedad (oscurece). */
  luz: boolean
  alfa: number
}

export const DESGASTE: ManchaDeDesgaste[] = [
  { x: 17, y: 20, r: 38, luz: true, alfa: 0.22 },
  { x: 73, y: 14, r: 26, luz: true, alfa: 0.13 },
  { x: 44, y: 55, r: 42, luz: true, alfa: 0.09 },
  { x: 7, y: 63, r: 18, luz: true, alfa: 0.15 },
  { x: 86, y: 78, r: 34, luz: false, alfa: 0.3 },
  { x: 29, y: 88, r: 26, luz: false, alfa: 0.22 },
  { x: 63, y: 41, r: 16, luz: false, alfa: 0.16 },
  { x: 95, y: 33, r: 14, luz: false, alfa: 0.18 },
]

/** El viñeteado del borde: lo que hace que la pieza no parezca recortada. */
export const VINETA = 'radial-gradient(118% 108% at 48% 44%, rgba(0,0,0,0) 50%, rgba(0,0,0,.40))'

/**
 * El color con TEXTURA, para pintar una peana en el Despliegue.
 *
 * PINTURA DESGASTADA, no un degradado. El color plano con un rayado encima
 * parecía una etiqueta de plástico; una miniatura de verdad tiene la pintura
 * rozada por las esquinas, un poco de suciedad en los bordes y luz irregular.
 * Eso son cuatro capas, de arriba abajo:
 *
 *   1. el bisel: una línea de luz arriba y una de sombra abajo, para que el
 *      cuadro tenga canto;
 *   2. el grano, a 27° (no a 45, que se lee como cuadrícula);
 *   3. las manchas de desgaste y suciedad (ver DESGASTE);
 *   4. el viñeteado del borde.
 *
 * Debajo de todo, el color de la facción.
 */
export function estiloDePeana(color: string | null | undefined): React.CSSProperties {
  const base = color ?? COLOR_FACCION_POR_DEFECTO
  const manchas = DESGASTE.map(
    (m) =>
      `radial-gradient(${m.r}% ${m.r}% at ${m.x}% ${m.y}%, rgba(${m.luz ? '255,255,255' : '0,0,0'},${m.alfa}), rgba(${m.luz ? '255,255,255' : '0,0,0'},0) 70%)`,
  )
  return {
    backgroundColor: base,
    backgroundImage: [
      'linear-gradient(rgba(255,255,255,.34), rgba(255,255,255,0) 7%)',
      'linear-gradient(rgba(0,0,0,0) 91%, rgba(0,0,0,.38))',
      'repeating-linear-gradient(27deg, rgba(255,255,255,.05) 0 1px, rgba(0,0,0,.06) 1px 3px)',
      ...manchas,
      VINETA,
    ].join(','),
    color: textoSobre(base),
  }
}

/**
 * Muestra pequeña del color, para la ficha de facción. Lleva el mismo acabado
 * que la peana: si el recuadro de la ficha enseñara un color plano, no estaría
 * enseñando lo que se va a ver en la mesa.
 */
export function estiloDeMuestra(color: string | null | undefined): React.CSSProperties {
  const { color: _texto, ...fondo } = estiloDePeana(color)
  return fondo
}
