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
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
/** Cuánto puede subir la ilustración por encima del borde superior del texto. */
const ILLU_MIN_Y = -40
/** Tamaño del hueco vacío cuando la ficha no tiene ilustración (`.illu-ph` en el original). */
const ILLU_PLACEHOLDER_W = 249
const ILLU_PLACEHOLDER_H = 340

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
  useEffect(() => {
    setLivePos({ x: sheet.illuPosX ?? defaultPosX, y: sheet.illuPosY ?? defaultPosY })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.id, sheet.illuPosX, sheet.illuPosY, sheet.illuWidthPct])

  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const layerRef = useRef<HTMLDivElement>(null)

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!editable || !sheet.illuUrl) return
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: livePos.x, originY: livePos.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    const maxX = Math.max(0, CONTENT_W - illuWidthPx)
    const layerH = layerRef.current?.clientHeight ?? 0
    const maxY = Math.max(ILLU_MIN_Y, layerH)
    setLivePos({
      x: Math.max(0, Math.min(maxX, dragState.current.originX + dx)),
      y: Math.max(ILLU_MIN_Y, Math.min(maxY, dragState.current.originY + dy)),
    })
  }
  function handlePointerUp() {
    if (!dragState.current) return
    dragState.current = null
    onIlluDragEnd?.(livePos.x, livePos.y)
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
        <div className="ficha-logo">{emblemUrl && <img className="emblem-img" src={emblemUrl} alt="" />}</div>
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

        <div ref={layerRef} className="pointer-events-none absolute inset-0 z-[1]">
          {sheet.illuUrl ? (
            <div
              className={clsx(
                'absolute touch-none select-none',
                editable && 'pointer-events-auto',
                editable && (dragState.current ? 'cursor-grabbing' : 'cursor-grab'),
              )}
              style={{ width: illuWidthPx, left: livePos.x, top: livePos.y }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                src={sheet.illuUrl}
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
      </div>
    </div>
  )
}
