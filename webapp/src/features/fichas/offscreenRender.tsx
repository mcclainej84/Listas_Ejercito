// ============================================================================
// Monta la tarjeta de una ficha (UnitSheetCard) FUERA de la pantalla, para
// las exportaciones: PNG (se captura con html2canvas), Word con texto/Hoja
// de referencia (solo se usa para medir el alto real y decidir saltos de
// página, ver exportWord.ts), y Word con imágenes (se captura igual que
// PNG). Solo se pinta una tarjeta a la vez en la página real (la ficha
// activa del editor), así que exportar varias renderiza cada unidad, una
// detrás de otra, en un host oculto que se descarta al terminar.
// ============================================================================
import { createRoot, type Root } from 'react-dom/client'
import { UnitRepository } from '@/data/repositories/unitRepository'
import { UnitSheetRepository } from '@/data/repositories/unitSheetRepository'
import { UnitSheetCard } from '@/features/fichas/UnitSheetCard'
import type { UnitDetail, UnitSheet } from '@/domain/types'

export interface OffscreenHost {
  root: Root
  host: HTMLDivElement
}

export function createOffscreenHost(): OffscreenHost {
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.top = '0'
  host.style.left = '-10000px'
  host.style.pointerEvents = 'none'
  document.body.appendChild(host)
  return { root: createRoot(host), host }
}

export function destroyOffscreenHost(o: OffscreenHost): void {
  o.root.unmount()
  o.host.remove()
}

function waitForImages(container: HTMLElement): Promise<void> {
  const imgs = Array.from(container.querySelectorAll('img'))
  return Promise.all(
    imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true })
              img.addEventListener('error', () => resolve(), { once: true })
            }),
    ),
  ).then(() => undefined)
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

/**
 * Espera a que las tipografías de Google Fonts (Cinzel/PT Serif, ver
 * `.ficha-sheet` en index.css) terminen de cargar. Sin esto, la primera vez
 * que se exporta una ficha (host oculto recién creado) html2canvas puede
 * capturar el texto todavía con la tipografía de reserso (fallback, p.ej.
 * Georgia) mientras Cinzel/PT Serif siguen descargándose — el título mide
 * distinto con una fuente que con otra, así que el hueco entre el título y
 * la barra gris del escudo sale mal calculado SOLO en la exportación (en
 * pantalla no se nota porque para cuando el usuario mira la ficha, la
 * tipografía ya llevaba un rato cargada y no hay parpadeo visible). Se pide
 * explícitamente la carga de los pesos usados (no basta con `fonts.ready`
 * a secas si el navegador aún no ha "visto" la necesidad de esa fuente) y
 * luego se espera a que el conjunto entero esté listo.
 */
async function waitForFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('700 26px Cinzel'),
      document.fonts.load('600 26px Cinzel'),
      document.fonts.load('400 10px "PT Serif"'),
      document.fonts.load('700 10px "PT Serif"'),
      document.fonts.load('italic 400 12.5px "PT Serif"'),
    ])
    await document.fonts.ready
  } catch {
    // Si el navegador no soporta la Font Loading API (o falla la carga),
    // seguimos adelante con lo que haya disponible en vez de bloquear la
    // exportación entera por esto.
  }
}

export interface RenderedSheet {
  unit: UnitDetail
  sheet: UnitSheet
  cardEl: HTMLDivElement
}

/**
 * Renderiza la ficha de `unitId` en el host oculto, con la `sheet` que se le
 * pase (normalmente ya "horneada" — ver imageProcessing.ts#bakeIllustration
 * — para que la ilustración no dependa de filtros CSS en la captura), y
 * espera a que sus imágenes carguen antes de devolver el nodo.
 */
export async function renderSheetOffscreen(
  host: OffscreenHost,
  unitId: number,
  overrides: { sheet?: UnitSheet; grayscale: boolean; showFrame: boolean },
): Promise<RenderedSheet | null> {
  const [unit, fetchedSheet] = await Promise.all([
    UnitRepository.getDetailById(unitId),
    overrides.sheet ? Promise.resolve(overrides.sheet) : UnitSheetRepository.getByUnitId(unitId),
  ])
  if (!unit) return null
  const sheet = overrides.sheet ?? fetchedSheet

  let cardEl: HTMLDivElement | null = null
  await new Promise<void>((resolve) => {
    host.root.render(
      <UnitSheetCard
        unit={unit}
        sheet={sheet}
        grayscale={overrides.grayscale}
        showFrame={overrides.showFrame}
        cardRef={(el) => {
          cardEl = el
          if (el) resolve()
        }}
      />,
    )
  })
  if (!cardEl) return null

  await Promise.all([waitForImages(cardEl), waitForFonts()])
  await nextFrame()
  return { unit, sheet, cardEl }
}
