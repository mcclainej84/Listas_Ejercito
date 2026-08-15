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
 * El color con TEXTURA, para pintar una peana en el Despliegue.
 *
 * Dos capas sobre el color base: un entramado diagonal muy fino y un degradado
 * que aclara una esquina y oscurece la contraria. Ninguna de las dos se lee
 * como "rayas" a este tamaño; lo que hacen es que el cuadro tenga materia y no
 * parezca un recorte de cartulina sobre el terreno pintado.
 */
export function estiloDePeana(color: string | null | undefined): React.CSSProperties {
  const base = color ?? COLOR_FACCION_POR_DEFECTO
  return {
    backgroundColor: base,
    backgroundImage: [
      'repeating-linear-gradient(45deg, rgba(255,255,255,.07) 0 2px, rgba(0,0,0,.06) 2px 4px)',
      'linear-gradient(150deg, rgba(255,255,255,.22), rgba(0,0,0,.28))',
    ].join(','),
    color: textoSobre(base),
  }
}

/** Muestra pequeña del color, para el listado y la ficha de facción. */
export function estiloDeMuestra(color: string | null | undefined): React.CSSProperties {
  const base = color ?? COLOR_FACCION_POR_DEFECTO
  return {
    backgroundColor: base,
    backgroundImage: 'linear-gradient(150deg, rgba(255,255,255,.25), rgba(0,0,0,.3))',
  }
}
