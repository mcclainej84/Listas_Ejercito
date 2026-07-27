// ============================================================================
// Tarjeta visual de una ficha (sección "Fichas", inspirada en CodexMaker: ver
// index.html/README.md que el usuario adjuntó como referencia). A diferencia
// del programa original, aquí NO hay campos de texto que rellenar: todo el
// contenido (nombre, perfiles, equipo, reglas, grupo de mando/monturas) sale
// de `UnitDetail`, ya editado en Editor > Unidades — esta tarjeta es una
// capa puramente de PRESENTACIÓN sobre esos datos, más los overrides propios
// de `UnitSheet` (ilustración, escudo, alto máximo).
//
// Solo se renderiza una tarjeta viva a la vez (la unidad seleccionada en
// FichasPage) — el panel "Tus fichas" es una lista de nombres, no una lista
// de tarjetas en miniatura, igual que en el programa original. Esta misma
// tarjeta también se usa (montada fuera de pantalla) para las exportaciones
// PNG/Word — ver offscreenRender.tsx.
// ============================================================================
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { clsx } from 'clsx'
import { sectionWidth, type SheetSection } from '@/domain/sheetSections'
import type { UnitDetail, UnitSheet } from '@/domain/types'
import { ATTRIBUTE_LABELS } from '@/shared/ui/AttributeTable'
import {
  commandGroupText,
  monturaItems,
  optionsList,
  pointsLabel,
  sizeLabel,
  specialRulesText,
  unifiedProfileRows,
} from '@/features/fichas/sheetContent'

/**
 * Ancho fijo de la tarjeta — EXACTAMENTE el de CodexMaker (`#card{width:760px}`
 * en index.html), igual que el resto de medidas de este componente: el
 * usuario pidió que la ficha "tenga exactamente el mismo tamaño" que el
 * programa original, así que aquí no hay redondeos "a ojo" ni valores
 * aproximados de Tailwind — todo copiado literal de la hoja de estilos de
 * referencia (ver también `.ficha-sheet` en index.css). El cálculo de
 * posición/zoom de la ilustración usa CONTENT_W (ancho útil dentro del
 * padding, 760 - 26*2 = 708, igual que `CONTENT_W` en el original).
 */
export const CARD_W = 760
const CARD_PAD_X = 26
const CONTENT_W = CARD_W - CARD_PAD_X * 2
/** Tamaño del hueco vacío cuando la ficha no tiene ilustración (`.illu-ph` en el original). */
const ILLU_PLACEHOLDER_W = 249
const ILLU_PLACEHOLDER_H = 340

/**
 * Cuántos píxeles de la ilustración deben quedar siempre dentro de la
 * tarjeta. Es el ÚNICO límite del arrastre.
 *
 * Antes la imagen se acotaba a `0 … CONTENT_W - anchoImagen`, y eso era el
 * fallo de fondo del "a veces no se puede mover": en cuanto la ilustración
 * ocupaba el ancho útil de la ficha (a partir de ~68% de zoom, nada raro) ese
 * rango se quedaba en un único punto y la imagen no se movía ni un píxel por
 * más que se arrastrase — sin ningún aviso de por qué. Ahora la imagen puede
 * salirse por los bordes tanto como se quiera (recortarla contra el borde es
 * un encuadre legítimo, y la tarjeta ya recorta con `overflow: hidden`);
 * lo único que se impide es perderla del todo de vista.
 */
const KEEP_VISIBLE = 56
/** Margen de maniobra por arriba/abajo, para poder sacar la imagen fuera del alto de la tarjeta. */
const ILLU_VERTICAL_SLACK = 400

export interface UnitSheetCardProps {
  unit: UnitDetail
  sheet: UnitSheet
  /** Vista color/blanco y negro — global de sesión, no se guarda (ver FichasPage). */
  grayscale: boolean
  /** Marco de la tarjeta — global de sesión, no se guarda. */
  showFrame: boolean
  /** Si se puede arrastrar/editar la ilustración (solo la ficha activa en el editor; en las exportaciones va a false). */
  editable?: boolean
  /** Se llama al soltar el arrastre, con la posición final en px, para persistirla. */
  onIlluDragEnd?: (posX: number, posY: number) => void
  cardRef?: (el: HTMLDivElement | null) => void
}

export function UnitSheetCard({ unit, sheet, grayscale, showFrame, editable = false, onIlluDragEnd, cardRef }: UnitSheetCardProps) {
  const emblemUrl = sheet.emblemUrl ?? unit.faction.emblemUrl
  const illuWidthPx = Math.round(CONTENT_W * (sheet.illuWidthPct / 100))
  const defaultPosX = Math.max(0, CONTENT_W - illuWidthPx)
  const defaultPosY = -24

  // Posición "en vivo" durante el arrastre: arranca desde la guardada (o la
  // por defecto si nunca se ha movido), y solo se confirma hacia afuera
  // (onIlluDragEnd) al soltar — igual que el programa de referencia, que no
  // persiste en cada pointermove, solo al final del gesto.
  const [livePos, setLivePos] = useState({
    x: sheet.illuPosX ?? defaultPosX,
    y: sheet.illuPosY ?? defaultPosY,
  })
  // Se sincroniza con lo que llega de fuera SALVO mientras se arrastra: si no,
  // un re-render del padre a mitad de gesto devolvía la imagen a su sitio
  // anterior y el arrastre "se soltaba solo".
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    if (dragging) return
    setLivePos({ x: sheet.illuPosX ?? defaultPosX, y: sheet.illuPosY ?? defaultPosY })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.id, sheet.illuUrl, sheet.illuPosX, sheet.illuPosY, sheet.illuWidthPct])

  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  // `livePos` en una ref: el `pointerup` tiene que leer la ÚLTIMA posición, y
  // leerla del estado capturado en la clausura del handler daba de vez en
  // cuando la penúltima (la del render anterior), guardando una posición
  // ligeramente distinta de la que se veía en pantalla.
  const livePosRef = useRef(livePos)
  livePosRef.current = livePos

  /** Mueve la imagen actualizando a la vez el estado (para pintar) y la ref (para leer sin esperar al render). */
  function applyPos(pos: { x: number; y: number }) {
    livePosRef.current = pos
    setLivePos(pos)
  }

  /**
   * Alto real de la ilustración en pantalla. Hace falta para dibujar la zona
   * de agarre encima (ver más abajo): la imagen se pinta con alto automático,
   * así que solo se sabe una vez cargada.
   */
  const [illuHeight, setIlluHeight] = useState(0)
  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    const update = () => setIlluHeight(img.offsetHeight)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(img)
    return () => observer.disconnect()
  }, [sheet.illuUrl, illuWidthPx])

  function clampPos(x: number, y: number) {
    const layerH = layerRef.current?.clientHeight || 380
    const visible = Math.min(KEEP_VISIBLE, illuWidthPx)
    const visibleY = Math.min(KEEP_VISIBLE, illuHeight || KEEP_VISIBLE)
    return {
      x: Math.max(visible - illuWidthPx, Math.min(CONTENT_W - visible, x)),
      y: Math.max(
        -(illuHeight || 0) - ILLU_VERTICAL_SLACK + visibleY,
        Math.min(layerH + ILLU_VERTICAL_SLACK - visibleY, y),
      ),
    }
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!editable || !sheet.illuUrl) return
    // Sin esto, el navegador interpreta el gesto como "seleccionar texto" (en
    // ratón) o "desplazar la página" (en táctil) y el arrastre se pierde a
    // mitad de camino — otra de las razones de que solo funcionase a veces.
    e.preventDefault()
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: livePosRef.current.x,
      originY: livePosRef.current.y,
    }
    // La captura va en `currentTarget` (la zona de agarre, que es quien tiene
    // los handlers) y no en `e.target`, que puede ser un hijo cualquiera.
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    applyPos(clampPos(dragState.current.originX + dx, dragState.current.originY + dy))
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState.current) return
    dragState.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    onIlluDragEnd?.(livePosRef.current.x, livePosRef.current.y)
  }

  /** Ajuste fino con el teclado, una vez la zona de agarre tiene el foco (Mayús = 10 px). */
  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 10 : 1
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = delta[e.key]
    if (!move) return
    e.preventDefault()
    const next = clampPos(livePosRef.current.x + move[0], livePosRef.current.y + move[1])
    applyPos(next)
    onIlluDragEnd?.(next.x, next.y)
  }

  const options = optionsList(unit)
  const mandoText = commandGroupText(unit)
  const monturas = monturaItems(unit)
  const rulesText = specialRulesText(unit)
  /**
   * Ancho de cada apartado, en % del ancho útil de la tarjeta. Se aplica al
   * bloque, no al texto: así el salto de línea ocurre donde marca el ancho y
   * la justificación se calcula contra él (ver .ficha-section en index.css).
   */
  const sw = (section: SheetSection) => ({ width: `${sectionWidth(sheet.sectionWidths, section)}%` })
  const statRows = unifiedProfileRows(unit, sheet.hiddenProfiles)

  return (
    <div
      ref={cardRef}
      className={clsx('ficha-sheet', showFrame && 'ficha-sheet--framed', grayscale && 'grayscale')}
      style={{ maxHeight: sheet.cardMaxHeight, overflow: 'hidden' }}
    >
      <div className="ficha-title">{unit.name}</div>

      <div className="ficha-subbar">
        <div className="ficha-logo">
          {emblemUrl && <img className="emblem-img" src={emblemUrl} crossOrigin="anonymous" alt="" />}
        </div>
        <div className="ficha-uname">
          {unit.isUnique && unit.unitType !== 'personaje' && <span className="ficha-uname-unique">0-1 </span>}
          {unit.name}
        </div>
        <div className="ficha-pts">{pointsLabel(unit)}</div>
      </div>

      <div className="ficha-content">
        <div className="ficha-left-col">
          {statRows.length > 0 && (
            <table className="ficha-stats">
              <thead>
                <tr>
                  <th></th>
                  {ATTRIBUTE_LABELS.map(({ key, label }) => (
                    <th key={key}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    {ATTRIBUTE_LABELS.map(({ key }) => (
                      <td key={key}>{row.profile[key] || '–'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {unit.unitType === 'tropa' && (
            <div className="ficha-field ficha-section" style={sw('tamano')}>
              <b>Tamaño de la unidad:</b> {sizeLabel(unit)}
            </div>
          )}

          <div className="ficha-field ficha-section" style={sw('equipo')}>
            <b>Equipo:</b> {unit.equipmentText || '–'}
          </div>

          {monturas.length > 0 && (
            <div className="ficha-field ficha-section" style={sw('montura')}>
              <div className="ficha-opt-title">Montura:</div>
              <ul className="ficha-options">
                {monturas.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {options.length > 0 && (
            <div className="ficha-section" style={sw('opciones')}>
              <div className="ficha-opt-title">Opciones:</div>
              <ul className="ficha-options">
                {options.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          )}

          {mandoText && (
            <div className="ficha-field ficha-section" style={sw('mando')}>
              <b>Grupo de mando:</b> {mandoText}
            </div>
          )}

          {/* El único apartado justificado: es el más largo y el que de
              verdad gana con el margen recto. En los cortos, justificar
              abría huecos enormes entre palabras. */}
          <div className="ficha-section ficha-section--justify" style={sw('reglas')}>
            <div className="ficha-rules-title">Reglas especiales:</div>
            <div className="ficha-rules-text">{rulesText || '–'}</div>
          </div>
        </div>

        {/* La ilustración, PINTADA por debajo del texto (z-1 contra el z-2 de
            .ficha-left-col): así es como se ve la ficha y como se exporta. */}
        <div ref={layerRef} className="pointer-events-none absolute inset-0 z-[1]">
          {sheet.illuUrl ? (
            <div className="absolute select-none" style={{ width: illuWidthPx, left: livePos.x, top: livePos.y }}>
              <img
                ref={imgRef}
                src={sheet.illuUrl}
                // Ver exportSheet.ts#loadImage: la tarjeta también se captura
                // con html2canvas, así que la imagen tiene que venir con CORS
                // o el canvas queda contaminado y la exportación falla.
                crossOrigin="anonymous"
                alt=""
                draggable={false}
                className="block w-full select-none"
                style={{
                  filter: `brightness(${sheet.illuBrightness}%)`,
                  transform: sheet.illuFlipped ? 'scaleX(-1)' : undefined,
                }}
              />
            </div>
          ) : (
            <div
              className="absolute"
              style={{ width: ILLU_PLACEHOLDER_W, height: ILLU_PLACEHOLDER_H, left: Math.max(0, CONTENT_W - ILLU_PLACEHOLDER_W), top: 0 }}
            />
          )}
        </div>

        {/*
          ZONA DE AGARRE. Un rectángulo transparente del tamaño exacto de la
          ilustración, colocado POR ENCIMA de todo (z-3).

          Es la corrección de fondo del "no siempre funciona": la imagen se
          pinta en una capa por debajo del texto, así que el navegador entrega
          el clic al párrafo que haya delante y solo respondía al arrastre por
          los trozos de imagen que no pisaba ningún texto — justo los que
          menos se usan, porque la ilustración suele solaparse con la columna.
          Separar "lo que se ve" de "lo que se agarra" deja el aspecto de la
          ficha intacto y hace que valga cualquier punto de la imagen, incluidas
          las zonas transparentes de un recorte.

          Solo existe en el editor (`editable`), nunca en las exportaciones.
        */}
        {editable && sheet.illuUrl && (
          <div
            role="application"
            aria-label="Mover la ilustración: arrastra, o usa las flechas del teclado"
            tabIndex={0}
            className={clsx(
              'absolute z-[3] touch-none select-none rounded-[2px] outline-none',
              'focus-visible:ring-2 focus-visible:ring-bronze/70',
              dragging ? 'cursor-grabbing ring-1 ring-bronze/60' : 'cursor-grab hover:ring-1 hover:ring-bronze/30',
            )}
            style={{
              width: illuWidthPx,
              // Antes de que la imagen mida (primer render), un alto mínimo
              // razonable para que ya se pueda agarrar.
              height: illuHeight || Math.round(illuWidthPx * 1.2),
              left: livePos.x,
              top: livePos.y,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
          />
        )}
      </div>
    </div>
  )
}
