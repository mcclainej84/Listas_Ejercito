// ============================================================================
// El PDF de una BATALLA: la mesa con los dos ejércitos enfrentados y, detrás,
// el orden de batalla de cada bando.
//
// Es hermano del PDF del despliegue (exportDeploymentPdf) y comparte su forma
// —apaisado, mapa a página entera, leyendas aparte— pero no su contenido: aquí
// hay DOS bandos, así que la cabecera lleva dos leyendas de color y la vuelta
// lleva dos tablas, una por página. Se escribió aparte en vez de hinchar el
// otro con condicionales porque lo que cambia no es un detalle, es de cuántos
// ejércitos habla la hoja.
//
// EL COLOR ES LO ÚNICO QUE SEPARA A LOS DOS BANDOS sobre el papel: una peana
// lleva tres letras y nada más. Por eso el cuadro de color sale en la cabecera,
// en cada tabla y en la propia celda de la referencia.
//
// LOS PUNTOS VAN SOLO EN EL TOTAL, igual que en la pantalla de la batalla. Ver
// allí el porqué: hay unidades ocultas que no salen en ninguna de las dos, y el
// desglose por unidad las delataba restando.
// ============================================================================
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Mesa } from '@/domain/deployment'
import type { ReferenciaDeUnidad } from '@/domain/deploymentRefs'
import { textoSobre } from '@/domain/factionColor'

const MARGEN = 12

/** "#rrggbb" → [r, g, b], que es como los quiere jsPDF. */
function rgb(color: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return [107, 106, 99]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Cuadro de color + nombre de la facción. Devuelve lo que ha ocupado de ancho. */
function dibujarLeyenda(doc: jsPDF, x: number, y: number, color: string, texto: string): number {
  const lado = 5
  doc.setFillColor(...rgb(color))
  doc.setDrawColor(43, 32, 19)
  doc.setLineWidth(0.2)
  doc.rect(x, y, lado, lado, 'FD')
  doc.setFont('times', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(43, 32, 19)
  doc.text(texto, x + lado + 2, y + lado - 1)
  return lado + 2 + doc.getTextWidth(texto)
}

export interface BandoDeLaBatalla {
  nombreLista: string
  faccion: string
  /** Color de la facción, "#rrggbb": el mismo con el que se pintan sus peanas. */
  color: string
  referencias: ReferenciaDeUnidad[]
  puntos: number
}

export interface DatosDeLaBatalla {
  nombre: string
  mesa: Mesa
  nombreMapa: string | null
  /** La mesa ya pintada con los dos bandos (ver features/maps/renderTableCanvas). */
  mapa: HTMLCanvasElement
  /** Los dos bandos, en el mismo orden que en la mesa: primero el de abajo. */
  bandos: BandoDeLaBatalla[]
}

export function exportBattleToPdf(datos: DatosDeLaBatalla, ventana: Window | null = null): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const anchoPagina = doc.internal.pageSize.getWidth()
  const altoPagina = doc.internal.pageSize.getHeight()
  const anchoUtil = anchoPagina - MARGEN * 2

  // --- Cabecera ---
  doc.setFont('times', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(43, 32, 19)
  doc.text(datos.nombre, MARGEN, MARGEN + 4)

  doc.setFont('times', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90, 76, 54)
  doc.text(
    [`mesa de ${datos.mesa.anchoCm} × ${datos.mesa.altoCm} cm`, datos.nombreMapa ?? 'mesa libre'].join(' · '),
    MARGEN,
    MARGEN + 9,
  )

  // Las dos leyendas a la derecha, una debajo de otra y en el mismo orden que
  // en la mesa: arriba el bando de arriba.
  const [abajo, arriba] = datos.bandos
  const anchoArriba = doc.getTextWidth(arriba?.faccion ?? '') + 9
  const anchoAbajo = doc.getTextWidth(abajo?.faccion ?? '') + 9
  if (arriba) dibujarLeyenda(doc, anchoPagina - MARGEN - anchoArriba, MARGEN, arriba.color, arriba.faccion)
  if (abajo) dibujarLeyenda(doc, anchoPagina - MARGEN - anchoAbajo, MARGEN + 6, abajo.color, abajo.faccion)

  doc.setDrawColor(138, 113, 63)
  doc.setLineWidth(0.3)
  doc.line(MARGEN, MARGEN + 13, anchoPagina - MARGEN, MARGEN + 13)

  // --- El mapa ---
  const arribaMapa = MARGEN + 17
  const altoDisponible = altoPagina - arribaMapa - MARGEN
  const proporcion = datos.mesa.anchoCm / datos.mesa.altoCm
  let anchoMapa = anchoUtil
  let altoMapa = anchoMapa / proporcion
  if (altoMapa > altoDisponible) {
    altoMapa = altoDisponible
    anchoMapa = altoMapa * proporcion
  }
  doc.addImage(
    datos.mapa.toDataURL('image/png'),
    'PNG',
    MARGEN + (anchoUtil - anchoMapa) / 2,
    arribaMapa,
    anchoMapa,
    altoMapa,
  )

  // --- Un orden de batalla por bando, cada uno en su página ---
  // Separados y no en dos columnas: durante la partida cada jugador mira el
  // suyo, y dos tablas estrechas compartiendo hoja obligan a leer en zigzag.
  for (const bando of datos.bandos) {
    doc.addPage('a4', 'landscape')
    doc.setFont('times', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(43, 32, 19)
    doc.text(`Orden de batalla · ${bando.nombreLista}`, MARGEN, MARGEN + 4)
    doc.setFont('times', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(90, 76, 54)
    doc.text(
      `${bando.puntos} pts · la referencia es lo que lleva escrito la peana; cuando dos unidades comparten iniciales, se numeran.`,
      MARGEN,
      MARGEN + 9,
    )
    const ancho = doc.getTextWidth(bando.faccion) + 9
    dibujarLeyenda(doc, anchoPagina - MARGEN - ancho, MARGEN, bando.color, bando.faccion)

    autoTable(doc, {
      startY: MARGEN + 12,
      margin: { left: MARGEN, right: MARGEN },
      // SIN COLUMNA DE PUNTOS. La hoja solo lleva el total del ejército, arriba.
      // En una batalla puede haber unidades ocultas que no salen ni en la mesa ni
      // en esta tabla (ver ArmyListEntry.hidden), y un desglose línea a línea al
      // lado del total las delataba con una resta. El ancho que deja libre se lo
      // queda "Equipo y opciones", que es lo que siempre iba justo.
      head: [['Ref.', 'Nº', 'Unidad', 'Equipo y opciones']],
      body: bando.referencias.map((r) => [r.ref, String(r.cantidad), r.nombre, r.detalle || '--']),
      theme: 'grid',
      styles: { font: 'times', fontSize: 9, cellPadding: 1.6, textColor: [43, 32, 19], lineColor: [138, 113, 63] },
      headStyles: { fillColor: [122, 36, 32], textColor: [246, 239, 220], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 12, halign: 'center' },
        2: { cellWidth: 80 },
        3: { cellWidth: 163 },
      },
      // `columnStyles` pisa a `headStyles`, así que la cabecera se recentra a
      // mano (el mismo tropiezo de siempre con jspdf-autotable).
      didParseCell: (data) => {
        if (data.section === 'head') data.cell.styles.halign = 'center'
        if (data.section === 'body' && data.column.index === 0) {
          data.cell.styles.fillColor = rgb(bando.color)
          data.cell.styles.textColor = rgb(textoSobre(bando.color))
        }
      },
    })

    if (bando.referencias.length === 0) {
      doc.setFont('times', 'italic')
      doc.setFontSize(10)
      doc.setTextColor(90, 76, 54)
      doc.text('Este ejército no tiene despliegue creado.', MARGEN, MARGEN + 20)
    }
  }

  const nombreArchivo = `batalla-${datos.nombre.replace(/[^\w-]+/g, '-').toLowerCase()}.pdf`
  const url = doc.output('bloburl') as unknown as string
  if (ventana && !ventana.closed) {
    ventana.location.href = url
    return
  }
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  a.remove()
}
