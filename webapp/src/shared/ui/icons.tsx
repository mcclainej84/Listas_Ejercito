// ============================================================================
// Iconos compartidos en línea (SVG), sin dependencia externa. Se usan en vez
// de símbolos de texto como "✕" cuando la acción es destructiva (borrar), que
// es más reconocible visualmente con una papelera.
//
// Casi todos son de TRAZO monocromo (stroke="currentColor") para que hereden
// el color del sitio donde se usan. Las excepciones son los escudos de
// categoría (CategoryShield), que llevan degradados metálicos propios porque
// su color ES la información que transmiten.
// ============================================================================
import { useId } from 'react'

export function TrashIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <path
        d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m-6.5 0 .6 9.4A1.5 1.5 0 0 0 7.6 17h4.8a1.5 1.5 0 0 0 1.5-1.6l.6-9.4M8.5 9v5m3-5v5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Dos hojas superpuestas — duplicar una unidad (ver UnitsListPage). */
export function CopyIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <rect x="7" y="7" width="9" height="10" rx="1.5" strokeLinejoin="round" />
      <path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Flecha para mover una fila hacia arriba en un listado reordenable (ver ArmyListBuilderPage). */
export function ArrowUpIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <path d="M10 15V5m0 0-4.5 4.5M10 5l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Flecha para mover una fila hacia abajo en un listado reordenable (ver ArmyListBuilderPage). */
export function ArrowDownIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <path d="M10 5v10m0 0-4.5-4.5M10 15l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Flecha hacia abajo, para indicar que un botón despliega un menú (ver TopNav > Editor). */
export function ChevronDownIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <path d="m5.5 8 4.5 4.5L14.5 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Estrella para marcar una opción de equipo/mejora como "por defecto" (ver RelationEditor). `filled` = ya marcada. */
export function StarIcon({ className = 'h-4 w-4', filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
    >
      <path
        d="M10 2.7l2.13 4.32 4.77.69-3.45 3.36.81 4.75L10 13.9l-4.26 2.24.81-4.75-3.45-3.36 4.77-.69L10 2.7Z"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Marco de imagen, para "Elegir imagen" (ver Fichas > Ilustración). */
export function ImageIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" strokeLinejoin="round" />
      <circle cx="7" cy="8" r="1.4" />
      <path d="m3.5 14 4-4 2.5 2.5 3-3.5 4 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Flechas de volteo horizontal (ver Fichas > Ilustración > Voltear). */
export function FlipHorizontalIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <path d="M10 2.5v15" strokeDasharray="2.2 2.2" />
      <path d="M6 6 3 10l3 4M14 6l3 4-3 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Flecha circular hacia atrás, para "Restablecer" (encuadre de la ilustración, alto de la ficha...). */
export function UndoIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <path d="M4 4v4.2H8.2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4.6 8A6 6 0 1 1 4 11.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Escudo, para el emblema/escudo por-ficha (ver Fichas > Escudo). */
export function ShieldIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <path d="M10 2.5 16.5 5v4.7c0 4-2.7 6.6-6.5 8.3-3.8-1.7-6.5-4.3-6.5-8.3V5L10 2.5Z" strokeLinejoin="round" />
    </svg>
  )
}

/** Sol, para el control de brillo de la ilustración. */
export function SunIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="3.2" />
      <path
        d="M10 2.3v2M10 15.7v2M17.7 10h-2M4.3 10h-2M15.4 4.6l-1.4 1.4M6 14l-1.4 1.4M15.4 15.4 14 14M6 6 4.6 4.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Marco/cuadro, para el botón "Marco" de Fichas (Vista). */
export function FrameIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="1" />
      <rect x="5.6" y="5.6" width="8.8" height="8.8" rx="0.5" strokeDasharray="1.6 1.6" />
    </svg>
  )
}

/** Círculo medio relleno, para el botón "Vista" (color/blanco y negro) de Fichas. */
export function ContrastIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="7.2" />
      <path d="M10 2.8a7.2 7.2 0 0 1 0 14.4Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Ojo abierto (mostrar) — ver Fichas > "Tus fichas" > ocultar/mostrar completadas. */
export function EyeIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/** Ojo tachado (ocultar) — contraparte de EyeIcon. */
export function EyeOffIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path
        d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a13.16 13.16 0 0 1-3.24 4.06M6.61 6.61A13.53 13.53 0 0 0 1 12s4 7 11 7a10.88 10.88 0 0 0 5.11-1.24M14.12 14.12a3 3 0 1 1-4.24-4.24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
    </svg>
  )
}

/** Flecha hacia abajo sobre una bandeja, para los botones de exportación. */
export function DownloadIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <path d="M10 3v9.5m0 0-3.2-3.2M10 12.5l3.2-3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 14v1.7a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Seis puntos ("asa de arrastre"), para reordenar filas por arrastrar y soltar (ver UnitsListPage, ArmyListBuilderPage). */
export function DragHandleIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="7" cy="5" r="1.3" />
      <circle cx="7" cy="10" r="1.3" />
      <circle cx="7" cy="15" r="1.3" />
      <circle cx="13" cy="5" r="1.3" />
      <circle cx="13" cy="10" r="1.3" />
      <circle cx="13" cy="15" r="1.3" />
    </svg>
  )
}

/**
 * Triángulo de aviso. Sustituye al carácter «⚠», que se dibujaba con la fuente
 * de emoji del sistema: cambiaba de aspecto en cada plataforma, a veces salía
 * en color azul o amarillo y desentonaba con el resto de la interfaz.
 */
export function WarningIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <path d="M10 3.2 18 16.4a.9.9 0 0 1-.78 1.35H2.78A.9.9 0 0 1 2 16.4L10 3.2Z" strokeLinejoin="round" />
      <path d="M10 8.2v3.6" strokeLinecap="round" />
      <circle cx="10" cy="14.4" r="0.85" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Marca de verificación simple, para las columnas de grupo de mando de la lista de ejército. */
export function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2} className={className} aria-hidden="true">
      <path d="m4.5 10.5 3.6 3.6L15.5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Grupo de mando — portaestandarte, músico y campeón. Siluetas macizas (no de
// trazo como el resto del set) porque se usan a 14-16 px en la cabecera de la
// tabla del ejército, donde un contorno fino se emborrona.
// ---------------------------------------------------------------------------

/**
 * Iconos del grupo de mando: son los PNG originales que aportó el usuario
 * (carpeta `ico/` del repositorio), no dibujos aproximados.
 *
 * El preprocesado que se les hizo una sola vez, con Pillow, fue: recortar el
 * margen transparente que traían (mucho aire alrededor dejaba la silueta
 * diminuta a 18 px), centrarlos en un lienzo cuadrado común para que los tres
 * midan lo mismo, reducir a 72 px y teñir la silueta del color de tinta suave
 * de la interfaz usando el canal alfa como máscara. El resultado vive en
 * `public/assets/mando/`.
 */
const MANDO_ICON_BASE = `${import.meta.env.BASE_URL}assets/mando/`

function MandoIcon({ file, alt, className }: { file: string; alt: string; className: string }) {
  return <img src={`${MANDO_ICON_BASE}${file}.png`} alt={alt} title={alt} className={className} />
}

/** Estandarte — el portaestandarte de la unidad. */
export function BannerIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <MandoIcon file="portaestandarte" alt="Portaestandarte" className={className} />
}

/** Cuerno de guerra — el músico de la unidad. */
export function HornIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <MandoIcon file="musico" alt="Músico" className={className} />
}

/** Espada — el campeón de la unidad. */
export function SwordIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <MandoIcon file="campeon" alt="Campeón" className={className} />
}

// ---------------------------------------------------------------------------
// Escudos de categoría (ver CategoryShield más abajo)
// ---------------------------------------------------------------------------

export type ShieldMetal = 'oro' | 'bronce' | 'plata'

/**
 * Paletas metálicas. Cada una lleva el borde exterior (rim), el filo oscuro
 * que separa borde y campo, y el degradado del campo interior — los tres
 * planos que dan la sensación de relieve del escudo.
 */
const SHIELD_METALS: Record<ShieldMetal, { rim: [string, string]; edge: string; body: [string, string, string] }> = {
  oro: { rim: ['#FFE9A3', '#B87A0A'], edge: '#6B4405', body: ['#FFF0B8', '#F0B429', '#B9780C'] },
  bronce: { rim: ['#F0C89B', '#8C4E1E'], edge: '#4E2A0E', body: ['#F5D4AC', '#C97F3F', '#8A4A1B'] },
  plata: { rim: ['#FFFFFF', '#8B959D'], edge: '#3F474D', body: ['#FFFFFF', '#D5DBE0', '#949DA5'] },
}

/**
 * Escudo metálico que marca la categoría de la unidad en la lista de ejército:
 * oro = Singular, bronce = Básica, plata = Especial. Los personajes no llevan
 * ninguno (así el escudo distingue de un vistazo el bloque de tropas).
 *
 * Es SVG y no un PNG a propósito: se dibuja a 16-18 px dentro de una tabla, y
 * un bitmap reducido desde 1024 px llega emborronado; además así pesa nada y
 * se mantiene nítido en pantallas de alta densidad.
 *
 * Los ids de los degradados se generan con useId porque el icono aparece
 * repetido muchas veces en la misma página y los ids han de ser únicos.
 */
export function CategoryShield({ metal, className = 'h-4 w-4' }: { metal: ShieldMetal; className?: string }) {
  const uid = useId()
  const { rim, edge, body } = SHIELD_METALS[metal]
  const rimId = `rim-${uid}`
  const bodyId = `body-${uid}`
  const glossId = `gloss-${uid}`

  return (
    <svg viewBox="0 0 24 28" className={className} aria-hidden="true" data-metal={metal}>
      <defs>
        <linearGradient id={rimId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={rim[0]} />
          <stop offset="100%" stopColor={rim[1]} />
        </linearGradient>
        <linearGradient id={bodyId} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor={body[0]} />
          <stop offset="45%" stopColor={body[1]} />
          <stop offset="100%" stopColor={body[2]} />
        </linearGradient>
        <linearGradient id={glossId} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Borde exterior */}
      <path
        d="M12 1.2c-3.6 1.9-7.1 2.7-9.8 2.9v9.6c0 7.2 4.7 11.2 9.8 13.3 5.1-2.1 9.8-6.1 9.8-13.3V4.1c-2.7-.2-6.2-1-9.8-2.9Z"
        fill={`url(#${rimId})`}
      />
      {/* Filo oscuro entre borde y campo */}
      <path
        d="M12 4.1c-2.9 1.5-5.7 2.2-7.8 2.4v7.3c0 5.6 3.6 8.8 7.8 10.6 4.2-1.8 7.8-5 7.8-10.6V6.5c-2.1-.2-4.9-.9-7.8-2.4Z"
        fill={edge}
      />
      {/* Campo interior */}
      <path
        d="M12 5.5c-2.6 1.3-5.1 2-7 2.2v6.1c0 4.9 3.2 7.8 7 9.4 3.8-1.6 7-4.5 7-9.4V7.7c-1.9-.2-4.4-.9-7-2.2Z"
        fill={`url(#${bodyId})`}
      />
      {/* Brillo superior izquierdo: es lo que lo hace leer como metal pulido */}
      <path d="M12 5.5c-2.6 1.3-5.1 2-7 2.2v6.1c0 2.4.8 4.3 2 5.8Z" fill={`url(#${glossId})`} />
    </svg>
  )
}

/** Marca de verificación en círculo, para "completada". */
/** Etiqueta con hilo — "ponerle un nombre propio" a una miniatura de la lista. */
export function NameTagIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" strokeLinejoin="round" />
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function CheckCircleIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="7.2" />
      <path d="m6.8 10.2 2.1 2.1 4.3-4.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
