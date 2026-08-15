// ============================================================================
// El PDF del DESPLIEGUE: el mapa con el ejército colocado, y debajo la leyenda
// que dice quién es cada peana.
//
// POR QUÉ HACE FALTA LA LEYENDA. Sobre la mesa una peana lleva tres letras, y
// eso se repite: dos regimientos de Guerreros Skaven son los dos "GS". En
// pantalla se sale del apuro pasando el ratón por encima; en un papel, no. Así
// que las repetidas se numeran ("GS1", "GS2", ver domain/deploymentRefs) y la
// leyenda las desarrolla con su cantidad, su nombre y su equipo, que es lo
// único que separa dos unidades del mismo tipo.
//
// Va apaisado porque una mesa lo es (180 × 120 y hasta 240 × 180): en vertical,
// el mapa saldría a media página y las peanas no se distinguirían.
// ============================================================================
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ReferenciaDeUnidad } from '@/domain/deploymentRefs'

/** Márgenes de la página, en mm. */
const MARGEN = 12

export interface DatosDelDespliegue {
  nombreLista: string
  faccion: string
  /** El mapa ya pintado (ver features/maps/renderTableCanvas). */
  mapa: HTMLCanvasElement
  anchoCm: number
  altoCm: number
  nombreMapa: string | null
  referencias: ReferenciaDeUnidad[]
  puntosDesplegados: number
  puntosTotales: number
}

export function exportDeploymentToPdf(datos: DatosDelDespliegue, ventana: Window | null = null): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const anchoPagina = doc.internal.pageSize.getWidth()
  const altoPagina = doc.internal.pageSize.getHeight()
  const anchoUtil = anchoPagina - MARGEN * 2

  // --- Cabecera ---
  doc.setFont('times', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(43, 32, 19)
  doc.text(datos.nombreLista, MARGEN, MARGEN + 4)

  doc.setFont('times', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90, 76, 54)
  const subtitulo = [
    datos.faccion,
    `mesa de ${datos.anchoCm} × ${datos.altoCm} cm`,
    datos.nombreMapa ?? 'mesa libre',
    `${datos.puntosDesplegados} de ${datos.puntosTotales} pts desplegados`,
  ]
    .filter(Boolean)
    .join(' · ')
  doc.text(subtitulo, MARGEN, MARGEN + 9)

  doc.setDrawColor(138, 113, 63)
  doc.setLineWidth(0.3)
  doc.line(MARGEN, MARGEN + 11, anchoPagina - MARGEN, MARGEN + 11)

  // --- El mapa ---
  // Se reserva sitio para la leyenda: con más de ocho unidades, la tabla se va
  // a una segunda página, así que aquí basta con dejar un respiro.
  const arribaMapa = MARGEN + 15
  const altoDisponible = altoPagina - arribaMapa - MARGEN - 8
  const proporcion = datos.anchoCm / datos.altoCm
  let anchoMapa = anchoUtil
  let altoMapa = anchoMapa / proporcion
  if (altoMapa > altoDisponible) {
    altoMapa = altoDisponible
    anchoMapa = altoMapa * proporcion
  }
  const izquierdaMapa = MARGEN + (anchoUtil - anchoMapa) / 2
  doc.addImage(datos.mapa.toDataURL('image/png'), 'PNG', izquierdaMapa, arribaMapa, anchoMapa, altoMapa)

  // --- La leyenda, en su propia página ---
  // Va aparte a propósito: el mapa aprovecha así la hoja entera (que es lo que
  // se mira durante la partida) y la leyenda se puede tener al lado sin doblar
  // nada.
  doc.addPage('a4', 'landscape')
  doc.setFont('times', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(43, 32, 19)
  doc.text('Orden de batalla', MARGEN, MARGEN + 4)
  doc.setFont('times', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(90, 76, 54)
  doc.text(
    'La referencia es lo que lleva escrito la peana. Cuando dos unidades comparten iniciales, se numeran.',
    MARGEN,
    MARGEN + 9,
  )

  autoTable(doc, {
    startY: MARGEN + 12,
    margin: { left: MARGEN, right: MARGEN },
    head: [['Ref.', 'Nº', 'Unidad', 'Equipo y opciones', 'Pts']],
    body: datos.referencias.map((r) => [r.ref, String(r.cantidad), r.nombre, r.detalle || '--', String(r.puntos)]),
    theme: 'grid',
    styles: { font: 'times', fontSize: 9, cellPadding: 1.6, textColor: [43, 32, 19], lineColor: [138, 113, 63] },
    headStyles: { fillColor: [122, 36, 32], textColor: [246, 239, 220], fontStyle: 'bold', halign: 'center' },
    // Los anchos suman los 273 mm útiles de un A4 apaisado con márgenes de 12.
    columnStyles: {
      0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 80 },
      3: { cellWidth: 145 },
      4: { cellWidth: 18, halign: 'center' },
    },
    // `columnStyles` pisa a `headStyles`, así que la cabecera se vuelve a
    // centrar a mano (el mismo tropiezo que en el PDF de la lista).
    didParseCell: (data) => {
      if (data.section === 'head') data.cell.styles.halign = 'center'
    },
  })

  const nombreArchivo = `despliegue-${datos.nombreLista.replace(/[^\w-]+/g, '-').toLowerCase()}.pdf`
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
