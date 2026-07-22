import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  /** Texto de la ayuda. Si es null o vacío, no se envuelve nada y no hay tooltip. */
  label: ReactNode
  children: ReactNode
  /** Clases del envoltorio. Por defecto `inline-flex`, para no romper la maquetación de un icono. */
  className?: string
}

/**
 * Ayuda contextual al pasar el cursor. Sustituye al atributo `title` nativo,
 * que en este proyecto ya dio problemas: tarda cerca de un segundo en salir,
 * no aparece en móvil ni tablet, no se puede dar estilo y en algunos casos el
 * navegador solo mostraba el cursor de interrogación sin texto.
 *
 * Decisiones:
 *
 * - Aparece SIN retardo (el usuario lo pidió expresamente).
 * - Se dibuja en un portal sobre `document.body` y con posición fija: si se
 *   pintara dentro del elemento, lo recortaría cualquier ancestro con
 *   `overflow` — que es justo lo que pasa en las tablas y en la barra de
 *   navegación (ver GlobalSearch, que ya tuvo este mismo problema).
 * - Se abre también con el foco de teclado, y se cierra con Escape.
 * - Lleva `touch-action: manipulation` y responde al toque, para que en móvil
 *   se pueda consultar tocando el icono.
 */
export function Tooltip({ label, children, className = 'inline-flex' }: TooltipProps) {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null)
  const anchorRef = useRef<HTMLSpanElement>(null)

  function show() {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (!rect) return
    setCoords({ x: rect.left + rect.width / 2, y: rect.top })
  }

  const hide = () => setCoords(null)

  if (label == null || label === '') return <>{children}</>

  return (
    <span
      ref={anchorRef}
      className={className}
      style={{ touchAction: 'manipulation' }}
      onPointerEnter={show}
      onPointerLeave={hide}
      onPointerDown={show}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => {
        if (e.key === 'Escape') hide()
      }}
      tabIndex={0}
    >
      {children}
      {coords &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-full rounded-sm border border-rule-dark/50 bg-ink px-2 py-1 text-mini leading-snug text-parchment shadow-lg"
            style={{ left: coords.x, top: coords.y - 6, maxWidth: '18rem' }}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  )
}
