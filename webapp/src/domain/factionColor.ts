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
 * SIN RAYAS. La primera versión llevaba un rayado fino de grano y se leía como
 * lo que era —un patrón—, sobre todo en las peanas grandes, donde la repetición
 * canta. Aquí solo hay manchas: elipses de tamaños y proporciones dispares,
 * ninguna igual a otra, colocadas a ojo sin simetría ni retícula. Es lo que
 * hace que parezca desgaste y no textura de relleno.
 *
 * Van en TANTO POR CIENTO de la peana, no en píxeles, para que valgan igual en
 * una de 4 cm que en un carro de 5 × 10, y para que la pantalla y el PNG/PDF
 * pinten lo mismo (renderTableCanvas lee esta misma lista).
 */
export interface ManchaDeDesgaste {
  /** Centro, en % del ancho y del alto. */
  x: number
  y: number
  /** Radios horizontal y vertical, en % de la peana. Distintos entre sí: una mancha redonda perfecta se nota. */
  rx: number
  ry: number
  /** true = pintura perdida (aclara); false = suciedad (oscurece). */
  luz: boolean
  alfa: number
}

export const DESGASTE: ManchaDeDesgaste[] = [
  // Desconchones grandes, arriba y a la izquierda: donde da la luz y donde más
  // se roza al manejar la miniatura.
  { x: 14, y: 17, rx: 41, ry: 29, luz: true, alfa: 0.24 },
  { x: 68, y: 11, rx: 23, ry: 34, luz: true, alfa: 0.14 },
  { x: 39, y: 47, rx: 47, ry: 22, luz: true, alfa: 0.1 },
  { x: 88, y: 26, rx: 15, ry: 25, luz: true, alfa: 0.13 },
  { x: 6, y: 71, rx: 19, ry: 13, luz: true, alfa: 0.16 },
  { x: 52, y: 92, rx: 26, ry: 11, luz: true, alfa: 0.08 },
  // Suciedad, abajo y a la derecha.
  { x: 84, y: 81, rx: 37, ry: 26, luz: false, alfa: 0.32 },
  { x: 27, y: 89, rx: 22, ry: 31, luz: false, alfa: 0.24 },
  { x: 61, y: 38, rx: 13, ry: 19, luz: false, alfa: 0.15 },
  { x: 97, y: 55, rx: 11, ry: 17, luz: false, alfa: 0.2 },
  { x: 45, y: 68, rx: 17, ry: 9, luz: false, alfa: 0.14 },
  { x: 8, y: 41, rx: 9, ry: 14, luz: false, alfa: 0.12 },
  // Motas sueltas: las que rompen del todo la sensación de degradado.
  { x: 33, y: 28, rx: 6, ry: 4, luz: false, alfa: 0.18 },
  { x: 76, y: 62, rx: 4, ry: 6, luz: true, alfa: 0.16 },
  { x: 58, y: 19, rx: 5, ry: 3, luz: false, alfa: 0.14 },
  { x: 21, y: 57, rx: 3, ry: 5, luz: true, alfa: 0.14 },
]

/** El viñeteado del borde: lo que hace que la pieza no parezca recortada. */
export const VINETA = 'radial-gradient(118% 108% at 48% 44%, rgba(0,0,0,0) 50%, rgba(0,0,0,.40))'

/**
 * El color con TEXTURA, para pintar una peana en el Despliegue.
 *
 * PINTURA DESGASTADA. Tres capas sobre el color: el canto (una línea de luz
 * arriba y una de sombra abajo, para que el cuadro tenga grosor), las manchas
 * de roce y suciedad, y el viñeteado del borde. Nada que se repita: ni rayas
 * ni tramas, que a este tamaño se leen como patrón y no como pintura.
 */
export function estiloDePeana(color: string | null | undefined): React.CSSProperties {
  const base = color ?? COLOR_FACCION_POR_DEFECTO
  const manchas = DESGASTE.map((m) => {
    const tinta = m.luz ? '255,255,255' : '0,0,0'
    return `radial-gradient(${m.rx}% ${m.ry}% at ${m.x}% ${m.y}%, rgba(${tinta},${m.alfa}), rgba(${tinta},0) 72%)`
  })
  return {
    backgroundColor: base,
    backgroundImage: [
      'linear-gradient(rgba(255,255,255,.32), rgba(255,255,255,0) 7%)',
      'linear-gradient(rgba(0,0,0,0) 91%, rgba(0,0,0,.36))',
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
