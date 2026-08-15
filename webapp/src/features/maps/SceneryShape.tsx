// ============================================================================
// Cómo se dibuja cada tipo de escenografía VISTO DESDE ARRIBA.
//
// Todo es SVG con `preserveAspectRatio="none"` sobre un lienzo de 100 × 100:
// así la forma se estira a la caja que tenga la pieza sin que haya que
// recalcular nada al redimensionarla. Un bosque de 60 × 10 sale como una franja
// de árboles, que es exactamente lo que es.
//
// POR QUÉ DIBUJADO Y NO ICONOS. Un mapa se lee de un vistazo y desde lejos: lo
// que hace falta es distinguir "esto es bosque" de "esto es colina" sin leer
// una etiqueta. Formas y colores propios lo consiguen; una fila de iconos
// iguales con distinto pictograma, no.
//
// LOS QUE NO TIENEN ILUSTRACIÓN IMITAN SU ESTILO. Las ilustraciones traen un
// lenguaje muy marcado —borde de hierba irregular alrededor, silueta dibujada a
// pulso, verdes oliva y tierras apagados, y grano— y un vector limpio al lado
// canta muchísimo. Así que los tipos vectoriales llevan ahora:
//
//   · un RUEDO de hierba irregular, como el que rodea al bosque o la colina;
//   · siluetas trazadas a mano, sin círculos ni rectángulos perfectos;
//   · la paleta MUESTREADA de las propias ilustraciones (ver PALETA);
//   · un grano de ruido y una sombra suave (ver los filtros de <defs>).
//
// No van a pasar por pintadas a mano, pero dejan de parecer de otro programa.
// ============================================================================
import { clsx } from 'clsx'
import type { SceneryKind } from '@/domain/scenery'

/**
 * Tipos que se pintan con una ILUSTRACIÓN en vez de con vectores. La ruta pasa
 * por BASE_URL para que siga funcionando si el programa cuelga de un
 * subdirectorio.
 */
const ILUSTRACIONES: Partial<Record<SceneryKind, string>> = {
  bosque: `${import.meta.env.BASE_URL}assets/scenery/bosque.webp`,
  colina: `${import.meta.env.BASE_URL}assets/scenery/colina.webp`,
  colinaRocosa: `${import.meta.env.BASE_URL}assets/scenery/colina_rocosa.webp`,
  pantano: `${import.meta.env.BASE_URL}assets/scenery/pantano.webp`,
  laguna: `${import.meta.env.BASE_URL}assets/scenery/laguna.webp`,
  campo: `${import.meta.env.BASE_URL}assets/scenery/campo.webp`,
  penasco: `${import.meta.env.BASE_URL}assets/scenery/penasco.webp`,
  roca: `${import.meta.env.BASE_URL}assets/scenery/roca.webp`,
  lajas: `${import.meta.env.BASE_URL}assets/scenery/lajas.webp`,
  casa: `${import.meta.env.BASE_URL}assets/scenery/casa.webp`,
  casaCuadrada: `${import.meta.env.BASE_URL}assets/scenery/casa_cuadrada.webp`,
}

/**
 * Color de cada tipo. Los verdes y tierras salen de muestrear las
 * ilustraciones (bosque, colina, sembrado y laguna), para que lo vectorial y
 * lo pintado convivan sin que se note el salto.
 */
const HIERBA = '#6b7a2e'
const HIERBA_OSCURA = '#3f4a19'

const PALETA: Record<SceneryKind, { fondo: string; borde: string; detalle: string }> = {
  bosque: { fondo: '#4a5c22', borde: '#28330c', detalle: '#3a4a17' },
  colina: { fondo: '#7d7a2c', borde: '#4c4a17', detalle: '#8f8b3a' },
  // Meseta de cantiles: verde de la ilustración por dentro, gris de roca por
  // fuera. Como tiene ilustración no llega a usarse, pero la tabla es un
  // Record de TODOS los tipos y el hueco no compilaría; y si algún día se
  // quitara la imagen, quedaría un vector con su color, no un gris cualquiera.
  colinaRocosa: { fondo: '#5e6f2b', borde: '#6b675e', detalle: '#8d8b83' },
  rio: { fondo: '#2f5560', borde: '#1d3a44', detalle: '#4b7683' },
  laguna: { fondo: '#274a4c', borde: '#16333a', detalle: '#3f6a6c' },
  pantano: { fondo: '#4b5526', borde: '#2b3312', detalle: '#5f6b33' },
  rocas: { fondo: '#8d8b83', borde: '#4f4c46', detalle: '#a9a69d' },
  penasco: { fondo: '#8d8b83', borde: '#4f4c46', detalle: '#a9a69d' },
  roca: { fondo: '#8d8b83', borde: '#4f4c46', detalle: '#a9a69d' },
  lajas: { fondo: '#8d8b83', borde: '#4f4c46', detalle: '#a9a69d' },
  ruinas: { fondo: '#96938a', borde: '#4f4c46', detalle: '#b3b0a6' },
  edificio: { fondo: '#8a6a45', borde: '#4a3620', detalle: '#a5825a' },
  casa: { fondo: '#8a6a45', borde: '#4a3620', detalle: '#a5825a' },
  casaCuadrada: { fondo: '#8a6a45', borde: '#4a3620', detalle: '#a5825a' },
  campo: { fondo: '#6b4a25', borde: '#3f2b14', detalle: '#8a6435' },
  muro: { fondo: '#8d8b83', borde: '#4f4c46', detalle: '#a9a69d' },
  puente: { fondo: '#8a6a45', borde: '#4a3620', detalle: '#a5825a' },
  camino: { fondo: '#8a6f42', borde: '#5a4526', detalle: '#a8895a' },
}

/**
 * Los filtros compartidos: un GRANO de ruido que rompe el plano liso del
 * vector y una SOMBRA suave que despega la pieza del tablero, que es lo que
 * hacen las ilustraciones.
 *
 * Los ids llevan el tipo dentro porque en un mapa hay varias piezas a la vez y
 * dos `<defs>` con el mismo id se pisan: la segunda pieza usaría el filtro de
 * la primera.
 */
function Defs({ kind }: { kind: SceneryKind }) {
  return (
    <defs>
      <filter id={`grano-${kind}`} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} seed={7} result="ruido" />
        <feColorMatrix in="ruido" type="saturate" values="0" result="gris" />
        <feComponentTransfer in="gris" result="suave">
          <feFuncA type="linear" slope="0.16" intercept="0" />
        </feComponentTransfer>
        <feComposite in="suave" in2="SourceGraphic" operator="in" result="grano" />
        <feBlend in="SourceGraphic" in2="grano" mode="multiply" />
      </filter>
      <filter id={`sombra-${kind}`} x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor="#1c1a16" floodOpacity="0.35" />
      </filter>
    </defs>
  )
}

/**
 * El RUEDO de hierba: la orla irregular que rodea a todas las ilustraciones.
 * Es lo que más hace que una pieza "pertenezca" a la misma familia, así que lo
 * llevan todas las siluetas vectoriales salvo las que son puro camino o muro.
 */
function Ruedo({ d, kind }: { d: string; kind: SceneryKind }) {
  return (
    <>
      <path d={d} fill={HIERBA} stroke={HIERBA_OSCURA} strokeWidth={2.5} filter={`url(#sombra-${kind})`} />
      <path d={d} fill={HIERBA} opacity={0.001} filter={`url(#grano-${kind})`} />
    </>
  )
}

/** La silueta —o la ilustración— del tipo, ajustada a la caja de la pieza. */
export function SceneryShape({
  kind,
  className,
  /**
   * `estirar` (por defecto) deforma la silueta hasta llenar su caja, que es lo
   * que hace falta sobre la mesa: un bosque de 60 × 10 tiene que salir como una
   * franja. En el catálogo de la izquierda las casillas son todas iguales, así
   * que ahí se usa `contener` para que la muestra no salga achatada.
   */
  ajuste = 'estirar',
}: {
  kind: SceneryKind
  className?: string
  ajuste?: 'estirar' | 'contener'
}) {
  const ilustracion = ILUSTRACIONES[kind]
  if (ilustracion) {
    // `draggable={false}`: sin esto, el navegador inicia su propio arrastre de
    // imagen y se come el del ratón que mueve la pieza.
    return (
      <img
        src={ilustracion}
        alt=""
        draggable={false}
        aria-hidden
        className={clsx(className, ajuste === 'contener' ? 'object-contain' : 'object-fill')}
      />
    )
  }

  const c = PALETA[kind]
  const comun = {
    viewBox: '0 0 100 100',
    preserveAspectRatio: ajuste === 'contener' ? ('xMidYMid meet' as const) : ('none' as const),
    className,
    'aria-hidden': true,
  }

  switch (kind) {
    // Mancha irregular con copas dentro: la silueta de un bosque en un mapa.
    case 'bosque':
      return (
        <svg {...comun}>
          <path
            d="M8 38 Q4 18 22 12 Q40 4 58 10 Q80 4 92 22 Q98 44 88 62 Q94 84 70 92 Q46 100 26 90 Q4 78 8 56 Z"
            fill={c.fondo}
            stroke={c.borde}
            strokeWidth={3}
          />
          {[
            [26, 32],
            [52, 24],
            [76, 38],
            [34, 60],
            [62, 62],
            [46, 84],
            [82, 74],
            [16, 74],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={9} fill={c.detalle} stroke={c.borde} strokeWidth={1.5} />
          ))}
        </svg>
      )

    // Curvas de nivel concéntricas: la convención cartográfica para el relieve.
    case 'colina':
      return (
        <svg {...comun}>
          <path
            d="M6 56 Q10 22 40 12 Q72 4 90 28 Q100 54 84 78 Q62 98 34 92 Q8 84 6 56 Z"
            fill={c.fondo}
            stroke={c.borde}
            strokeWidth={3}
          />
          <path
            d="M22 56 Q26 34 46 26 Q70 20 80 40 Q86 60 72 74 Q52 86 36 78 Q22 70 22 56 Z"
            fill={c.detalle}
            stroke={c.borde}
            strokeWidth={1.6}
          />
          <path
            d="M40 56 Q44 44 56 42 Q68 42 70 54 Q70 66 56 68 Q42 68 40 56 Z"
            fill={c.fondo}
            stroke={c.borde}
            strokeWidth={1.4}
          />
        </svg>
      )

    // Cauce sinuoso con las dos orillas de hierba, como en las ilustraciones.
    case 'rio':
      return (
        <svg {...comun}>
          <Defs kind={kind} />
          {/* Las riberas: hierba a los dos lados, con el borde comido. */}
          <path
            d="M0 6 Q14 2 26 8 Q42 16 58 10 Q76 3 100 9 L100 94 Q78 99 60 92 Q42 84 26 91 Q13 97 0 93 Z"
            fill={HIERBA}
            stroke={HIERBA_OSCURA}
            strokeWidth={2}
            filter={`url(#sombra-${kind})`}
          />
          {/* El agua, más estrecha que la ribera y con la orilla irregular. */}
          <path
            d="M0 24 Q15 17 30 25 Q46 34 62 27 Q80 20 100 26 L100 76 Q80 82 62 74 Q46 66 30 74 Q15 82 0 74 Z"
            fill={c.fondo}
            stroke={c.borde}
            strokeWidth={2}
          />
          <path d="M6 40 Q26 33 44 41 Q62 49 82 42" fill="none" stroke={c.detalle} strokeWidth={2} opacity={0.8} />
          <path d="M14 60 Q34 53 52 61 Q70 68 92 60" fill="none" stroke={c.detalle} strokeWidth={1.6} opacity={0.6} />
          <path
            d="M0 24 Q15 17 30 25 Q46 34 62 27 Q80 20 100 26 L100 76 Q80 82 62 74 Q46 66 30 74 Q15 82 0 74 Z"
            fill={c.fondo}
            opacity={0.001}
            filter={`url(#grano-${kind})`}
          />
        </svg>
      )

    // Los tres tipos de piedra van SIEMPRE con su ilustración (ver
    // ILUSTRACIONES) y no llegan aquí; comparten el dibujo de "rocas" como
    // último recurso, por si algún día faltara el archivo.
    case 'penasco':
    case 'roca':
    case 'lajas':
    // Un afloramiento: ruedo de hierba y bloques de piedra encima, con la cara
    // iluminada arriba y la sombra abajo, como las rocas de las ilustraciones.
    case 'rocas':
      return (
        <svg {...comun}>
          <Defs kind={kind} />
          <Ruedo kind={kind} d="M8 52 Q4 26 26 16 Q50 6 72 14 Q94 22 96 48 Q98 76 76 88 Q50 98 26 90 Q6 80 8 52 Z" />
          <polygon
            points="22,58 32,30 52,22 68,32 78,58 66,78 40,82 24,72"
            fill={c.fondo}
            stroke={c.borde}
            strokeWidth={2.2}
          />
          <polygon points="32,30 52,22 56,40 36,48" fill={c.detalle} stroke={c.borde} strokeWidth={1.4} />
          <polygon points="56,40 68,32 78,58 62,60" fill={c.detalle} stroke={c.borde} strokeWidth={1.4} opacity={0.8} />
          <polygon points="24,72 40,82 66,78 62,60 36,64" fill={c.borde} opacity={0.35} />
          <polygon points="70,66 86,60 92,74 78,82" fill={c.fondo} stroke={c.borde} strokeWidth={1.6} />
          <polygon points="10,60 24,54 28,68 14,74" fill={c.fondo} stroke={c.borde} strokeWidth={1.6} />
        </svg>
      )

    // Planta de un edificio derruido: los muros conservan grosor de piedra y se
    // interrumpen, con escombro dentro y hierba comiéndose el perímetro.
    case 'ruinas':
      return (
        <svg {...comun}>
          <Defs kind={kind} />
          <Ruedo kind={kind} d="M6 50 Q4 22 28 14 Q52 6 74 14 Q96 22 95 50 Q96 78 74 88 Q50 96 27 88 Q5 78 6 50 Z" />
          <rect x={20} y={22} width={60} height={56} fill="#5c5347" opacity={0.35} />
          <g fill={c.fondo} stroke={c.borde} strokeWidth={1.8}>
            <path d="M18 20 H48 V28 H18 Z" />
            <path d="M60 20 H82 V28 H60 Z" />
            <path d="M74 28 V46 H82 V28 Z" />
            <path d="M74 58 V80 H82 V58 Z" />
            <path d="M52 72 H82 V80 H52 Z" />
            <path d="M18 72 H38 V80 H18 Z" />
            <path d="M18 20 V44 H26 V20 Z" />
            <path d="M18 60 V80 H26 V60 Z" />
          </g>
          <g fill={c.detalle} stroke={c.borde} strokeWidth={1.2}>
            <polygon points="40,42 50,38 56,46 46,52" />
            <polygon points="58,54 66,52 68,60 60,62" />
            <polygon points="32,56 40,54 42,62 34,64" />
          </g>
        </svg>
      )

    // Las casas van siempre con su ilustración y no llegan aquí; comparten
    // este dibujo por si algún día faltara el archivo.
    case 'casa':
    case 'casaCuadrada':
    // Edificio visto desde arriba: tejado a dos aguas con caballete y aleros,
    // sobre su parcela de hierba.
    case 'edificio':
      return (
        <svg {...comun}>
          <Defs kind={kind} />
          <Ruedo kind={kind} d="M6 48 Q5 20 30 13 Q54 6 76 14 Q96 22 95 50 Q96 78 74 89 Q50 97 26 88 Q5 77 6 48 Z" />
          <polygon points="16,24 84,24 84,78 16,78" fill={c.fondo} stroke={c.borde} strokeWidth={2.4} />
          {/* Faldones: el sombreado a un lado del caballete es lo que hace que
              se lea como tejado y no como una caja. */}
          <polygon points="16,24 84,24 50,51" fill={c.detalle} />
          <polygon points="16,78 84,78 50,51" fill={c.borde} opacity={0.45} />
          <line x1={16} y1={51} x2={84} y2={51} stroke={c.borde} strokeWidth={2.4} />
          {[26, 38, 62, 74].map((x) => (
            <line key={x} x1={x} y1={24} x2={50} y2={51} stroke={c.borde} strokeWidth={0.9} opacity={0.5} />
          ))}
          {[26, 38, 62, 74].map((x) => (
            <line key={`b${x}`} x1={x} y1={78} x2={50} y2={51} stroke={c.borde} strokeWidth={0.9} opacity={0.35} />
          ))}
          <rect x={44} y={70} width={12} height={8} fill="#3a2a17" stroke={c.borde} strokeWidth={1.4} />
        </svg>
      )

    // Muro de piedra seca: hiladas irregulares, con hierba pegada a los dos
    // lados en vez de un rectángulo suelto.
    case 'muro':
      return (
        <svg {...comun}>
          <Defs kind={kind} />
          <path
            d="M0 14 Q22 8 46 14 Q72 20 100 12 L100 88 Q74 94 48 87 Q24 81 0 88 Z"
            fill={HIERBA}
            stroke={HIERBA_OSCURA}
            strokeWidth={1.8}
            filter={`url(#sombra-${kind})`}
          />
          <path
            d="M0 34 Q24 28 50 34 Q74 40 100 33 L100 68 Q74 74 50 68 Q24 62 0 68 Z"
            fill={c.fondo}
            stroke={c.borde}
            strokeWidth={2}
          />
          {[0, 14, 28, 42, 56, 70, 84].map((x, i) => (
            <path
              key={x}
              d={`M${x} ${33 + (i % 2)} q7 3 14 0 v34 q-7 3 -14 0 Z`}
              fill={i % 2 ? c.detalle : c.fondo}
              stroke={c.borde}
              strokeWidth={1.2}
              opacity={0.95}
            />
          ))}
        </svg>
      )

    // Puente de piedra con pretiles y tajamares, cruzando de arriba abajo.
    case 'puente':
      return (
        <svg {...comun}>
          <Defs kind={kind} />
          <polygon
            points="10,0 90,0 90,100 10,100"
            fill={c.fondo}
            stroke={c.borde}
            strokeWidth={2.4}
            filter={`url(#sombra-${kind})`}
          />
          {/* Pretiles: las dos bandas oscuras de los lados. */}
          <rect x={10} y={0} width={12} height={100} fill={c.borde} opacity={0.75} />
          <rect x={78} y={0} width={12} height={100} fill={c.borde} opacity={0.75} />
          {/* Tablero: las hiladas del piso, ligeramente desiguales. */}
          {[6, 20, 34, 48, 62, 76, 90].map((y, i) => (
            <line
              key={y}
              x1={22}
              y1={y + (i % 2)}
              x2={78}
              y2={y - (i % 2)}
              stroke={c.borde}
              strokeWidth={1.8}
              opacity={0.7}
            />
          ))}
          <line x1={50} y1={0} x2={50} y2={100} stroke={c.detalle} strokeWidth={1.2} opacity={0.4} />
        </svg>
      )

    // Camino de tierra con las rodadas marcadas y los bordes comidos por la
    // hierba: sin ruedo entero, porque un camino atraviesa, no ocupa.
    case 'camino':
      return (
        <svg {...comun}>
          <Defs kind={kind} />
          <path
            d="M0 16 Q26 6 52 18 Q78 30 100 20 L100 80 Q76 90 50 78 Q26 66 0 76 Z"
            fill={HIERBA}
            stroke={HIERBA_OSCURA}
            strokeWidth={1.8}
            filter={`url(#sombra-${kind})`}
          />
          <path
            d="M0 30 Q26 20 52 32 Q78 44 100 34 L100 66 Q76 76 50 64 Q26 52 0 62 Z"
            fill={c.fondo}
            stroke={c.borde}
            strokeWidth={1.6}
          />
          <path d="M0 40 Q26 30 52 42 Q78 54 100 44" fill="none" stroke={c.borde} strokeWidth={1.4} opacity={0.55} />
          <path d="M0 54 Q26 44 52 56 Q78 68 100 58" fill="none" stroke={c.borde} strokeWidth={1.4} opacity={0.55} />
          <path
            d="M0 30 Q26 20 52 32 Q78 44 100 34 L100 66 Q76 76 50 64 Q26 52 0 62 Z"
            fill={c.fondo}
            opacity={0.001}
            filter={`url(#grano-${kind})`}
          />
        </svg>
      )
  }
}
