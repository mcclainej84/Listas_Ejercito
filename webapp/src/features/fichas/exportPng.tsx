// ============================================================================
// Exportación a PNG de las fichas — botón "PNG" de la sección Fichas. Si se
// marca más de una se agrupan en un .zip (JSZip); si es una sola, se descarga
// suelta. La tarjeta se construye y captura con exportSheet.ts (estructura y
// estilos exactos de CodexMaker, en un host limpio pegado a <body>).
// ============================================================================
import JSZip from 'jszip'
import type { UnitDetail, UnitSheet } from '@/domain/types'
import { captureUnitCanvas, type ExportView } from '@/features/fichas/exportSheet'
import { sanitizeFilename } from '@/features/fichas/sheetContent'

/** Una ficha lista para exportar: sirve tanto para una unidad real como para una opción de unidad con ficha propia (ver upgradeSheet.ts). */
export interface SheetToExport {
  unit: UnitDetail
  sheet: UnitSheet
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function exportSheetsToPng(items: SheetToExport[], view: ExportView): Promise<void> {
  const files: { name: string; blob: Blob }[] = []
  const usedNames = new Map<string, number>()

  for (const { unit, sheet } of items) {
    const canvas = await captureUnitCanvas(unit, sheet, view)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) continue

    let name = sanitizeFilename(unit.name)
    const count = usedNames.get(name)
    if (count != null) {
      usedNames.set(name, count + 1)
      name = `${name}_${count + 1}`
    } else {
      usedNames.set(name, 0)
    }
    files.push({ name: `${name}${view.grayscale ? '_bn' : ''}.png`, blob })
  }

  if (files.length === 0) return
  if (files.length === 1) {
    downloadBlob(files[0].blob, files[0].name)
    return
  }
  const zip = new JSZip()
  files.forEach((f) => zip.file(f.name, f.blob))
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(zipBlob, `fichas_png${view.grayscale ? '_bn' : ''}.zip`)
}
