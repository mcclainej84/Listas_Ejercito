// ============================================================================
// Exportación a PDF — "HOJA DE EJÉRCITO"
// ============================================================================
// Réplica deliberadamente FIEL (misma paleta, misma tipografía, mismos
// tamaños, mismo layout) del PDF que generaba la herramienta original
// standalone ("Hoja de Ejército" — ver HojaEjercito/script.js, función
// exportarPDF y sus funciones auxiliares justo encima). Se tradujo esa
// implementación (jsPDF + jspdf-autotable "a pelo", en español) a
// TypeScript casi literalmente, en vez de reinterpretarla, porque el
// usuario pidió expresamente que el resultado fuera idéntico. Diferencias
// deliberadas, mínimas:
//   - Los datos salen del dominio de esta app (ArmyListDetail) en vez de
//     leerse del DOM de una tabla HTML como hacía el original.
//   - El PDF se abre en una pestaña nueva del navegador (doc.output +
//     window.open) en vez de descargarse directamente — el usuario decide
//     desde ahí si lo guarda, lo imprime o solo lo consulta.
// Todo lo demás (colores, fuentes, tamaños, textos, orden de secciones,
// lógica de salto de página) es una copia 1:1.
// ============================================================================
import { jsPDF } from 'jspdf'
import autoTable, { type CellHookData } from 'jspdf-autotable'
import { computeEntryCost } from '@/domain/armyValidation'
import { mergeSpecialRules } from '@/domain/unitFormat'
import type { ArmyListDetail, ArmyListEntry, AttributeProfile, SpecialRule } from '@/domain/types'

const TEXTURE_URL = `${import.meta.env.BASE_URL}assets/army-sheet/fondo-pergamino.jpg`
const FONT_REGULAR_URL = `${import.meta.env.BASE_URL}assets/army-sheet/fonts/CaslonAntique-Regular.ttf`
const FONT_BOLD_URL = `${import.meta.env.BASE_URL}assets/army-sheet/fonts/CaslonAntique-Bold.ttf`
const FONT_TITULARES = 'CaslonAntique'

// Paleta EXACTA del original (PALETA_PDF en script.js).
const INK = [40, 32, 24] as const // texto principal
const INK_SUAVE = [112, 101, 87] as const // texto secundario / etiquetas
const LINEA = [166, 163, 154] as const // #A6A39A — reglas y separadores
const FONDO_ALT = [217, 209, 193] as const // franja de fila alterna (zebra)
const FONDO_RESPALDO = [235, 229, 216] as const // sólo si la textura no llega a cargar

// Dimensiones reales (px) de la textura — se conserva su proporción real
// (encaje "a sangre completa" tipo cover, no un estirado que la deforme).
const TEXTURA_PX = { ancho: 1054, alto: 1492 }

const MARGEN = 12
const ALTURA_PIE = 18
const ALTURA_MINIMA = 34

/** Copia una paleta `readonly [r,g,b]` a la tupla mutable que esperan los tipos de jspdf-autotable. */
function rgb(color: readonly [number, number, number]): [number, number, number] {
  return [color[0], color[1], color[2]]
}

async function fetchDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`No se pudo cargar ${url}`)
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function fetchFontBase64(url: string): Promise<string | null> {
  const dataUrl = await fetchDataUrl(url)
  if (!dataUrl) return null
  const coma = dataUrl.indexOf(',')
  return coma >= 0 ? dataUrl.slice(coma + 1) : dataUrl
}

/** Registra Caslon Antique (normal y negrita); si falla cualquiera de los dos, se cae a "times" en todo el documento. */
async function registrarFuenteTitulares(doc: jsPDF): Promise<boolean> {
  try {
    const [regular, bold] = await Promise.all([fetchFontBase64(FONT_REGULAR_URL), fetchFontBase64(FONT_BOLD_URL)])
    if (!regular || !bold) return false
    doc.addFileToVFS('CaslonAntique-Regular.ttf', regular)
    doc.addFont('CaslonAntique-Regular.ttf', FONT_TITULARES, 'normal')
    doc.addFileToVFS('CaslonAntique-Bold.ttf', bold)
    doc.addFont('CaslonAntique-Bold.ttf', FONT_TITULARES, 'bold')
    return true
  } catch {
    return false
  }
}

/** Fondo de pergamino a sangre completa (encaje tipo "cover", sin deformar), o color de respaldo si no cargó. */
function dibujarFondoPagina(doc: jsPDF, texturaDataUrl: string | null) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  if (texturaDataUrl) {
    const escala = Math.max(w / TEXTURA_PX.ancho, h / TEXTURA_PX.alto)
    const anchoFinal = TEXTURA_PX.ancho * escala
    const altoFinal = TEXTURA_PX.alto * escala
    doc.addImage(texturaDataUrl, 'JPEG', (w - anchoFinal) / 2, (h - altoFinal) / 2, anchoFinal, altoFinal, undefined, 'FAST')
  } else {
    doc.setFillColor(...FONDO_RESPALDO)
    doc.rect(0, 0, w, h, 'F')
  }
}

function dibujarFilete(doc: jsPDF, xIzq: number, xDer: number, y: number) {
  doc.setDrawColor(...LINEA)
  doc.setLineWidth(0.3)
  doc.line(xIzq, y, xDer, y)
}

/** Cabecera completa (sólo primera página): título centrado + placa de puntos totales a la derecha. */
function dibujarCabeceraPrincipal(
  doc: jsPDF,
  opts: { fecha: string; numUnidades: number; totalPuntos: number; familiaTitulares: string },
): number {
  const w = doc.internal.pageSize.getWidth()
  const yTitulo = 20

  const tituloTexto = 'HOJA DE EJÉRCITO'
  const tituloCharSpace = 0.5
  doc.setFont(opts.familiaTitulares, 'normal')
  doc.setFontSize(25)
  const anchoTitulo = doc.getTextWidth(tituloTexto) + tituloCharSpace * (tituloTexto.length - 1)
  doc.setTextColor(...INK)
  doc.text(tituloTexto, (w - anchoTitulo) / 2, yTitulo, { charSpace: tituloCharSpace })

  doc.setFont('times', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(...INK_SUAVE)
  doc.text(`Generado el ${opts.fecha} · ${opts.numUnidades} entrada(s) de ejército`, w / 2, yTitulo + 9, {
    align: 'center',
  })

  const anchoPlaca = 42
  const xIzq = w - MARGEN - anchoPlaca
  const xDer = w - MARGEN
  const xCentro = xIzq + anchoPlaca / 2

  const yLinea1 = yTitulo - 6
  const yEtiqueta = yLinea1 + 4.4
  const yLinea2 = yEtiqueta + 2
  const yNumero = yLinea2 + 9

  dibujarFilete(doc, xIzq, xDer, yLinea1)

  doc.setFont('times', 'bold')
  doc.setFontSize(7.2)
  doc.setTextColor(...INK_SUAVE)
  doc.text('PUNTOS TOTALES', xCentro, yEtiqueta, { align: 'center' })

  dibujarFilete(doc, xIzq, xDer, yLinea2)

  doc.setFont(opts.familiaTitulares, 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...INK)
  doc.text(String(opts.totalPuntos || 0), xCentro, yNumero, { align: 'center' })

  return yTitulo + 22
}

/** Cabecera reducida para páginas de continuación: título pequeño + nombre de la lista + filete. */
function dibujarCabeceraContinuacion(doc: jsPDF, opts: { nombreLista: string; familiaTitulares: string }) {
  const w = doc.internal.pageSize.getWidth()

  doc.setTextColor(...INK)
  doc.setFont(opts.familiaTitulares, 'normal')
  doc.setFontSize(12)
  doc.text('HOJA DE EJÉRCITO', MARGEN, 20, { charSpace: 0.35 })

  if (opts.nombreLista) {
    doc.setFont('times', 'italic')
    doc.setFontSize(8.5)
    doc.setTextColor(...INK_SUAVE)
    doc.text(opts.nombreLista, w - MARGEN, 20, { align: 'right' })
  }

  dibujarFilete(doc, MARGEN, w - MARGEN, 23)
}

/** Etiqueta de sección en versalitas espaciadas, con un filete fino debajo. */
function dibujarEtiquetaSeccion(doc: jsPDF, texto: string, y: number, familiaTitulares: string): number {
  const w = doc.internal.pageSize.getWidth()
  doc.setFont(familiaTitulares, 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...INK)
  doc.text(texto.toUpperCase(), MARGEN, y, { charSpace: 0.35 })
  dibujarFilete(doc, MARGEN, w - MARGEN, y + 2)
  return y + 7
}

/** Pie de página minimalista: un filete fino + una línea de texto centrada. */
function dibujarPiePagina(doc: jsPDF, pagina: number, totalPaginas: number, nombreLista: string) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  dibujarFilete(doc, MARGEN, w - MARGEN, h - 14)
  const texto = `${pagina}  ·  HOJA DE EJÉRCITO${nombreLista ? '  ·  ' + nombreLista : ''}  ·  Página ${pagina} de ${totalPaginas}`
  doc.setFont('times', 'normal')
  doc.setFontSize(7.3)
  doc.setTextColor(...INK_SUAVE)
  doc.text(texto, w / 2, h - 9, { align: 'center' })
}

/** Filete fino bajo la fila de cabecera de una tabla (theme "plain" no dibuja bordes propios). */
function dibujarBordeInferiorCabecera(data: CellHookData) {
  if (data.section !== 'head') return
  dibujarFilete(data.doc as unknown as jsPDF, data.cell.x, data.cell.x + data.cell.width, data.cell.y + data.cell.height)
}

/** Fila de estadísticas [nombre, M, HA, HP, F, R, H, I, A, L], con "-" para lo que falte (mismo criterio que el original). */
function filaEstadisticas(nombre: string, ficha: AttributeProfile | null): string[] {
  const g = (v: string | null | undefined) => (v !== undefined && v !== null && v !== '' ? v : '-')
  return [nombre, g(ficha?.m), g(ficha?.ha), g(ficha?.hp), g(ficha?.f), g(ficha?.r), g(ficha?.h), g(ficha?.i), g(ficha?.a), g(ficha?.l)]
}

/**
 * Reglas especiales que de verdad tiene esa entrada de la lista: las de la
 * unidad más las del monstruo/montura QUE SE HA ELEGIDO para ella (no las de
 * todas las monturas que podría llevar — aquí sí se sabe cuál lleva, a
 * diferencia de la ficha de catálogo). Sin repetir, ver mergeSpecialRules.
 */
function reglasDeLaEntrada(entry: ArmyListEntry): SpecialRule[] {
  const montura = entry.mountProfileId
    ? entry.unit.profiles.montura.find((p) => p.id === entry.mountProfileId)
    : null
  const carro = entry.chariotProfileId
    ? entry.unit.profiles.carro.find((p) => p.id === entry.chariotProfileId)
    : null
  return mergeSpecialRules(entry.unit.specialRules, montura?.specialRules ?? [], carro?.specialRules ?? [])
}

export async function exportArmyListToPdf(list: ArmyListDetail, total: number): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const [texturaDataUrl, fuenteOk] = await Promise.all([fetchDataUrl(TEXTURE_URL), registrarFuenteTitulares(doc)])
  const familiaTitulares = fuenteOk ? FONT_TITULARES : 'times'

  const sortedEntries: ArmyListEntry[] = [...list.entries].sort((a, b) => a.sortOrder - b.sortOrder)
  const fecha = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())

  // Garantiza el fondo + cabecera de continuación en TODAS las páginas
  // nuevas, las cree quien las cree (incluidas las que añade
  // automáticamente jspdf-autotable en mitad de una tabla): se intercepta
  // directamente doc.addPage en vez de fiarse de los hooks del plugin.
  const addPageOriginal = doc.addPage.bind(doc)
  doc.addPage = ((...args: Parameters<typeof addPageOriginal>) => {
    const resultado = addPageOriginal(...args)
    dibujarFondoPagina(doc, texturaDataUrl)
    dibujarCabeceraContinuacion(doc, { nombreLista: list.name, familiaTitulares })
    return resultado
  }) as typeof doc.addPage

  // Página 1: ésta ya existe al crear el documento, así que se pinta aparte.
  dibujarFondoPagina(doc, texturaDataUrl)

  let y = dibujarCabeceraPrincipal(doc, {
    fecha,
    numUnidades: sortedEntries.length,
    totalPuntos: total,
    familiaTitulares,
  })
  y = dibujarEtiquetaSeccion(doc, 'Lista de unidades', y + 3, familiaTitulares)

  // --- Tabla 1: Lista de unidades. ---
  const cuerpoLista = sortedEntries.length
    ? sortedEntries.map((entry) => {
        const cost = computeEntryCost(entry.unit, entry)
        const equipNames = entry.unit.equipmentOptions
          .filter((e) => entry.equipmentIds.includes(e.id))
          .map((e) => e.name)
        const upgradeNames = entry.unit.upgradeOptions
          .filter((u) => entry.upgradeIds.includes(u.id))
          .map((u) => u.name)
        return [
          String(entry.quantity),
          // Igual que en pantalla: si la miniatura tiene nombre propio manda
          // el nombre y el tipo va entre paréntesis. El PDF es lo que se lleva
          // a la partida, así que es justo donde más sentido tiene ver
          // "Jules el Bretón (Paladín Bretoniano)".
          entry.alias ? `${entry.alias} (${entry.unit.name})` : entry.unit.name,
          equipNames.join(', ') || '--',
          upgradeNames.join(', ') || '--',
          entry.hasStandardBearer ? 'X' : '',
          entry.hasMusician ? 'X' : '',
          entry.hasChampion ? 'X' : '',
          String(cost),
        ]
      })
    : [
        [
          {
            content: 'No se han añadido unidades a esta lista todavía.',
            colSpan: 8,
            styles: { halign: 'center' as const, fontStyle: 'italic' as const, textColor: rgb(INK_SUAVE) },
          },
        ],
      ]

  autoTable(doc, {
    startY: y,
    margin: { top: 26, bottom: ALTURA_PIE, left: MARGEN, right: MARGEN },
    head: [['Nº', 'TROPA', 'EQUIPO', 'OPCIONES', 'P', 'M', 'C', 'COSTE']],
    body: cuerpoLista,
    theme: 'plain',
    styles: {
      font: 'times',
      fontSize: 7.8,
      textColor: rgb(INK),
      cellPadding: { top: 1.2, bottom: 1.2, left: 2.2, right: 2.2 },
      overflow: 'linebreak',
    },
    headStyles: {
      textColor: rgb(INK_SUAVE),
      fontStyle: 'bold',
      fontSize: 7.4,
      cellPadding: { top: 0.8, bottom: 0.8, left: 2.2, right: 2.2 },
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 'auto', halign: 'left' },
      4: { cellWidth: 8, halign: 'center' },
      5: { cellWidth: 8, halign: 'center' },
      6: { cellWidth: 8, halign: 'center' },
      7: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: rgb(FONDO_ALT) },
    didDrawCell: dibujarBordeInferiorCabecera,
  })

  // --- Tabla 2: Perfiles y reglas especiales (monturas/carros como sub-filas "• "). ---
  let finalYLista = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  if (finalYLista + ALTURA_MINIMA > doc.internal.pageSize.getHeight() - ALTURA_PIE) {
    doc.addPage()
    finalYLista = 26
  }
  const y2 = dibujarEtiquetaSeccion(doc, 'Perfiles y reglas especiales', finalYLista + 8, familiaTitulares)

  interface FilaPerfil {
    datos: string[]
    reglas: string
  }
  const cuerpoPerfiles: FilaPerfil[] = []
  for (const entry of sortedEntries) {
    const unit = entry.unit
    const rulesText = reglasDeLaEntrada(entry).map((r) => r.name).join(', ') || '—'
    cuerpoPerfiles.push({ datos: filaEstadisticas(unit.name, unit.profiles.base), reglas: rulesText })

    const montura = entry.mountProfileId ? unit.profiles.montura.find((p) => p.id === entry.mountProfileId) : null
    if (montura) {
      cuerpoPerfiles.push({ datos: filaEstadisticas(`• ${montura.name ?? 'Montura'}`, montura), reglas: '' })
    }
    const carro = entry.chariotProfileId ? unit.profiles.carro.find((p) => p.id === entry.chariotProfileId) : null
    if (carro) {
      cuerpoPerfiles.push({ datos: filaEstadisticas(`• ${carro.name ?? 'Carro'}`, carro), reglas: '' })
    }
  }

  const filasTabla2 = cuerpoPerfiles.length
    ? cuerpoPerfiles.map((f) => [...f.datos, f.reglas])
    : [
        [
          {
            content: 'No hay perfiles que mostrar.',
            colSpan: 11,
            styles: { halign: 'center' as const, fontStyle: 'italic' as const, textColor: rgb(INK_SUAVE) },
          },
        ],
      ]

  autoTable(doc, {
    startY: y2,
    margin: { top: 26, bottom: ALTURA_PIE, left: MARGEN, right: MARGEN },
    head: [['UNIDAD', 'M', 'HA', 'HP', 'F', 'R', 'H', 'I', 'A', 'L', 'REGLAS ESPECIALES']],
    body: filasTabla2,
    theme: 'plain',
    styles: {
      font: 'times',
      fontSize: 7.1,
      textColor: rgb(INK),
      cellPadding: { top: 1, bottom: 1, left: 2.2, right: 1.8 },
      overflow: 'linebreak',
    },
    headStyles: {
      textColor: rgb(INK_SUAVE),
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: { top: 0.8, bottom: 0.8, left: 2, right: 1.8 },
    },
    columnStyles: {
      0: { cellWidth: 42, halign: 'left' },
      1: { cellWidth: 8, halign: 'center' },
      2: { cellWidth: 8, halign: 'center' },
      3: { cellWidth: 8, halign: 'center' },
      4: { cellWidth: 8, halign: 'center' },
      5: { cellWidth: 8, halign: 'center' },
      6: { cellWidth: 8, halign: 'center' },
      7: { cellWidth: 8, halign: 'center' },
      8: { cellWidth: 8, halign: 'center' },
      9: { cellWidth: 8, halign: 'center' },
      10: { cellWidth: 'auto', halign: 'left' },
    },
    alternateRowStyles: { fillColor: rgb(FONDO_ALT) },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const primeraCelda = Array.isArray(data.row.raw) ? data.row.raw[0] : undefined
      const esSubfila = typeof primeraCelda === 'string' && primeraCelda.startsWith('•')
      if (esSubfila) {
        data.cell.styles.textColor = rgb(INK_SUAVE)
        data.cell.styles.fontSize = 6.7
      }
    },
    didDrawCell: dibujarBordeInferiorCabecera,
  })

  // --- Tabla 3: Resumen de reglas especiales (glosario alfabético). ---
  let finalYPerfiles = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y2
  if (finalYPerfiles + ALTURA_MINIMA > doc.internal.pageSize.getHeight() - ALTURA_PIE) {
    doc.addPage()
    finalYPerfiles = 26
  }
  const y3 = dibujarEtiquetaSeccion(doc, 'Resumen de reglas especiales', finalYPerfiles + 8, familiaTitulares)

  const rulesMap = new Map<number, { name: string; description: string }>()
  for (const entry of list.entries) {
    for (const rule of reglasDeLaEntrada(entry)) {
      if (!rulesMap.has(rule.id)) rulesMap.set(rule.id, rule)
    }
  }
  const listaReglas = [...rulesMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const cuerpoGlosario = listaReglas.length
    ? listaReglas.map((r) => [r.name, r.description || '-'])
    : [
        [
          {
            content: 'Esta lista no utiliza ninguna regla especial.',
            colSpan: 2,
            styles: { halign: 'center' as const, fontStyle: 'italic' as const, textColor: rgb(INK_SUAVE) },
          },
        ],
      ]

  autoTable(doc, {
    startY: y3,
    margin: { top: 26, bottom: ALTURA_PIE, left: MARGEN, right: MARGEN },
    head: [['REGLA', 'DESCRIPCIÓN']],
    body: cuerpoGlosario,
    theme: 'plain',
    styles: {
      font: 'times',
      fontSize: 7.6,
      textColor: rgb(INK),
      cellPadding: { top: 1.4, bottom: 1.4, left: 2.2, right: 2.2 },
      overflow: 'linebreak',
    },
    headStyles: {
      textColor: rgb(INK_SUAVE),
      fontStyle: 'bold',
      fontSize: 7.4,
      cellPadding: { top: 0.8, bottom: 0.8, left: 2.2, right: 2.2 },
    },
    columnStyles: {
      0: { cellWidth: 45, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 'auto', halign: 'left' },
    },
    alternateRowStyles: { fillColor: rgb(FONDO_ALT) },
    didDrawCell: dibujarBordeInferiorCabecera,
  })

  // --- Pie de página en todas las páginas del documento. ---
  const totalPaginas = doc.getNumberOfPages()
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p)
    dibujarPiePagina(doc, p, totalPaginas, list.name)
  }

  // Se abre en una pestaña nueva (en vez de descargar directamente) para
  // que el usuario pueda verlo/imprimirlo desde el propio visor del
  // navegador, en vez de forzar una descarga directa a disco.
  const blobUrl = doc.output('bloburl')
  window.open(blobUrl, '_blank')
}
