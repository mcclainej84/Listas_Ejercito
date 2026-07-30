// ============================================================================
// "Exportar Hojas de unidad" — un PDF con la hoja de cada unidad del ejército,
// UNA POR PÁGINA, y debajo sus reglas especiales desarrolladas.
//
// Es el compañero de "Exportar Lista" (exportArmyListPdf.ts): aquella es el
// resumen que se firma antes de jugar, ésta es lo que se consulta durante la
// partida.
//
// POR QUÉ VA EN IMAGEN Y NO EN TEXTO. Las hojas se dibujan con la API Canvas
// 2D en exportSheet.ts, controlando cada píxel, y así es como salen ya en PNG y
// en Word. Rehacerlas aquí con las primitivas de jsPDF significaría mantener
// dos maquetaciones distintas de la misma hoja, que acabarían divergiendo a la
// primera corrección. Se reutiliza el mismo motor y el PDF hereda gratis la
// tipografía (Cinzel + PT Serif), el filete bajo la cabecera y hasta el blanco
// y negro: sale exactamente lo que se ve en la sección Fichas.
//
// Consecuencia asumida: el texto no se puede seleccionar ni buscar dentro del
// PDF. A cambio, no hay una sola diferencia entre lo que se ve y lo que se
// imprime, que es la promesa de la sección Fichas.
// ============================================================================
import { jsPDF } from 'jspdf'
import { captureUnitCanvas, captureSpecialRulesCanvas, type ExportView } from '@/features/fichas/exportSheet'
import { mostrarPdf } from '@/features/army-lists/pdfWindow'
import type { UnitDetail, UnitSheet } from '@/domain/types'

/** Una hoja a exportar, en el orden en que va a salir. */
export interface HojaAExportar {
  unit: UnitDetail
  sheet: UnitSheet
}

const MARGEN = 10
/** Aire entre la hoja y el bloque de reglas de debajo. */
const SEPARACION = 5

/** Un trozo vertical de un canvas, ya como imagen suelta lista para el PDF. */
function recortar(origen: HTMLCanvasElement, desdeY: number, alto: number): string {
  const trozo = document.createElement('canvas')
  trozo.width = origen.width
  trozo.height = alto
  const ctx = trozo.getContext('2d')!
  // Fondo blanco explícito: el último trozo casi nunca llena su alto, y sin
  // esto el sobrante saldría transparente (negro al imprimir).
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, trozo.width, alto)
  ctx.drawImage(origen, 0, desdeY, origen.width, alto, 0, 0, origen.width, alto)
  return trozo.toDataURL('image/png')
}

/**
 * `ventana` es la pestaña que el llamador abrió EN EL CLIC (ver pdfWindow.ts):
 * generar estas hojas lleva su tiempo —fuentes, ilustraciones desde R2 y un
 * canvas por unidad—, y para cuando el PDF está hecho el navegador ya no deja
 * abrir pestañas.
 */
export async function exportUnitSheetsToPdf(
  hojas: HojaAExportar[],
  view: ExportView,
  ventana: Window | null,
): Promise<void> {
  if (hojas.length === 0) return

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const anchoPagina = doc.internal.pageSize.getWidth()
  const altoPagina = doc.internal.pageSize.getHeight()
  const anchoUtil = anchoPagina - MARGEN * 2
  const altoUtil = altoPagina - MARGEN * 2

  let primera = true
  for (const { unit, sheet } of hojas) {
    const hoja = await captureUnitCanvas(unit, sheet, view)
    const reglas = await captureSpecialRulesCanvas(unit, view)

    if (!primera) doc.addPage()
    primera = false

    // La hoja manda: se escala a todo el ancho útil y solo se reduce más si
    // por sí sola no cabe de alto. Encogerla para hacerle sitio a las reglas
    // sería sacrificar lo que se lee a cada rato por lo que se consulta de
    // vez en cuando.
    const escala = Math.min(anchoUtil / hoja.width, altoUtil / hoja.height)
    const hojaW = hoja.width * escala
    const hojaH = hoja.height * escala
    doc.addImage(hoja.toDataURL('image/png'), 'PNG', MARGEN, MARGEN, hojaW, hojaH, undefined, 'FAST')

    if (!reglas) continue

    // Las reglas se dibujan al mismo ancho que la hoja (comparten el ancho de
    // tarjeta), así que van alineadas con ella sin cuadrar nada a mano.
    const escalaReglas = hojaW / reglas.width
    let restanteMm = altoUtil - hojaH - SEPARACION
    let y = MARGEN + hojaH + SEPARACION
    let cursorPx = 0

    while (cursorPx < reglas.height) {
      const cabenPx = Math.floor(restanteMm / escalaReglas)
      // Si en lo que queda de página no entra ni una línea, se pasa de página
      // en vez de dibujar una franja ilegible de dos píxeles.
      if (cabenPx < 40) {
        doc.addPage()
        restanteMm = altoUtil
        y = MARGEN
        continue
      }
      const trozoPx = Math.min(cabenPx, reglas.height - cursorPx)
      doc.addImage(
        recortar(reglas, cursorPx, trozoPx),
        'PNG',
        MARGEN,
        y,
        hojaW,
        trozoPx * escalaReglas,
        undefined,
        'FAST',
      )
      cursorPx += trozoPx
      y += trozoPx * escalaReglas
      restanteMm -= trozoPx * escalaReglas
    }
  }

  // Igual que "Exportar Lista": se ve en una pestaña para poder consultarlo o
  // imprimirlo desde el visor del navegador, sin forzar una descarga.
  mostrarPdf(ventana, doc, 'hojas_de_unidad.pdf')
}
