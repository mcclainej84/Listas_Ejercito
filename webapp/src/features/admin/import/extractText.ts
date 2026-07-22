// ============================================================================
// Extracción de TEXTO plano de un archivo subido, para el importador de libros
// de ejército (ver armyBookParser.ts). Soporta PDF (pdfjs-dist), Word (.docx,
// mammoth) y texto/Markdown (.md/.txt). Tanto pdfjs como mammoth son pesados y
// solo hacen falta aquí, así que se importan de forma PEREZOSA (dynamic
// import): quedan en su propio chunk y no engordan el bundle inicial de la
// app, igual que jsPDF en la exportación de listas.
// ============================================================================

/** Reconstruye líneas de texto de una página de PDF agrupando los fragmentos por su posición vertical. */
interface TextItemLike {
  str: string
  transform: number[]
}

async function extractPdf(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  // El worker también perezoso; `?url` da la ruta al fichero ya empaquetado.
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const doc = await pdfjs.getDocument({ data }).promise
  const pages: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const items = content.items as TextItemLike[]
    // Agrupa los fragmentos en líneas según su coordenada Y (transform[5]);
    // un salto mayor que un umbral abre una línea nueva. Dentro de cada línea
    // se respeta el orden de lectura que ya trae pdfjs.
    let line = ''
    let lastY: number | null = null
    const lines: string[] = []
    for (const it of items) {
      const y = it.transform[5]
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        lines.push(line)
        line = ''
      }
      line += it.str
      lastY = y
    }
    if (line) lines.push(line)
    pages.push(lines.join('\n'))
  }
  return pages.join('\n')
}

async function extractDocx(data: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer: data })
  return result.value
}

/** Extrae el texto plano de un archivo (PDF, .docx, .md o .txt). Lanza si el tipo no está soportado. */
export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) {
    return extractPdf(await file.arrayBuffer())
  }
  if (name.endsWith('.docx')) {
    return extractDocx(await file.arrayBuffer())
  }
  if (name.endsWith('.md') || name.endsWith('.txt') || name.endsWith('.markdown')) {
    return file.text()
  }
  throw new Error('Formato no soportado. Usa PDF, .docx, .md o .txt.')
}
