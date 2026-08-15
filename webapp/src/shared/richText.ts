// ============================================================================
// Texto con formato: qué se admite y cómo se limpia lo que llega de fuera.
//
// QUÉ SE ADMITE, Y NADA MÁS: párrafos, salto de línea, negrita, cursiva y
// listas (con puntos o numeradas). Se guarda HTML porque es lo que sabe
// representar eso, pero la lista de etiquetas es CERRADA y todos los atributos
// se tiran: ni estilos, ni clases, ni colores, ni tipos de letra. Un texto
// pegado de un PDF o de Word trae hojas de estilo enteras y, si se dejan
// pasar, la ficha se llena de letras Calibri azules de 14 puntos que ya no hay
// forma de quitar.
//
// Y SOBRE TODO: nada de <script>, <iframe>, <img> ni atributos `on...`. El
// texto se pinta con dangerouslySetInnerHTML —es la única forma de que la
// negrita salga en negrita—, así que lo que entra en la base tiene que estar
// limpio ANTES de guardarse. Este archivo es esa aduana; no hay otra.
//
// La justificación NO se guarda: el texto de un apéndice va justificado
// siempre, por hoja de estilos (ver RichTextEditor y RichText). Guardar
// alineaciones por párrafo solo servía para que unos quedasen desalineados con
// otros.
// ============================================================================

/** Las únicas etiquetas que sobreviven al saneado. */
const PERMITIDAS = new Set(['P', 'BR', 'STRONG', 'EM', 'UL', 'OL', 'LI'])

/**
 * Equivalencias: el navegador y los programas de ofimática escriben lo mismo
 * de varias formas. Se traducen a la forma canónica en vez de tirarlas, que es
 * lo que conserva la negrita de un texto pegado de Word.
 */
const EQUIVALENTES: Record<string, string> = {
  B: 'STRONG',
  I: 'EM',
  U: 'EM',
  H1: 'P',
  H2: 'P',
  H3: 'P',
  H4: 'P',
  H5: 'P',
  H6: 'P',
  DIV: 'P',
  SECTION: 'P',
  ARTICLE: 'P',
  BLOCKQUOTE: 'P',
  PRE: 'P',
}

/** Etiquetas cuyo CONTENIDO también se tira, no solo la etiqueta. */
const VENENOSAS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'HEAD', 'META', 'LINK'])

function limpiarNodo(nodo: Node, doc: Document): Node[] {
  if (nodo.nodeType === Node.TEXT_NODE) {
    return [doc.createTextNode(nodo.textContent ?? '')]
  }
  if (nodo.nodeType !== Node.ELEMENT_NODE) return []

  const el = nodo as Element
  const etiqueta = el.tagName.toUpperCase()
  if (VENENOSAS.has(etiqueta)) return []

  const hijos = Array.from(el.childNodes).flatMap((h) => limpiarNodo(h, doc))
  const destino = PERMITIDAS.has(etiqueta) ? etiqueta : EQUIVALENTES[etiqueta]

  // Una etiqueta desconocida (<span>, <font>, <table>…) desaparece pero su
  // contenido se queda: tirar el texto de una tabla pegada sería perderlo sin
  // avisar.
  if (!destino) return hijos

  const nuevo = doc.createElement(destino)
  for (const hijo of hijos) nuevo.appendChild(hijo)
  return [nuevo]
}

/** ¿Este elemento se puede quitar por no aportar nada? Un <p></p> vacío, sí; un <br>, no. */
function vacio(el: Element): boolean {
  if (el.tagName === 'BR') return false
  return (el.textContent ?? '').trim() === '' && el.querySelector('br') == null
}

/**
 * Deja el HTML en lo permitido: etiquetas de la lista, sin un solo atributo.
 *
 * Se usa en los DOS extremos: al pegar (para no meter basura en el editor) y
 * al guardar (porque nadie garantiza que lo que hay en el editor haya pasado
 * por lo primero). Es idempotente: sanear lo ya saneado no cambia nada.
 */
export function sanearHtml(html: string): string {
  if (!html.trim()) return ''
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const salida = doc.createElement('div')
  for (const hijo of Array.from(doc.body.childNodes)) {
    for (const limpio of limpiarNodo(hijo, doc)) salida.appendChild(limpio)
  }
  // Fuera los párrafos y listas que se han quedado sin nada dentro (los deja
  // el propio saneado al vaciar un <div> de maquetación).
  for (const el of Array.from(salida.querySelectorAll('p, li, ul, ol'))) {
    if (vacio(el)) el.remove()
  }
  return salida.innerHTML.trim()
}

/**
 * Texto plano → HTML. Cada línea en blanco separa un párrafo, que es lo que
 * espera cualquiera que pegue texto sin formato de un correo o de un .txt.
 */
export function textoPlanoAHtml(texto: string): string {
  return texto
    .split(/\n{2,}/)
    .map((parrafo) => parrafo.trim())
    .filter(Boolean)
    .map((parrafo) => `<p>${escapar(parrafo).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function escapar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** ¿Este HTML tiene algo escrito? Sirve para no guardar apéndices en blanco. */
export function tieneTexto(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim().length > 0
  )
}

/**
 * El texto sin etiquetas, para resúmenes y listados.
 *
 * El cierre de cada bloque se cambia por un espacio antes de leer el texto: sin
 * eso, "<p>uno</p><li>dos</li>" se leería como "unodos", que en un resumen de
 * una línea es justo lo que no se entiende.
 */
export function aTextoPlano(html: string): string {
  const separado = html.replace(/<\/(p|li|ul|ol)>|<br\s*\/?>/gi, ' ')
  const doc = new DOMParser().parseFromString(`<body>${separado}</body>`, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}
