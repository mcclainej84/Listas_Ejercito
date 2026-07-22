// ============================================================================
// Exportación a Word ("Word con texto", "Word con imágenes" y "Hoja de
// referencia" de CodexMaker). Se genera con el mismo truco que el programa
// original: un documento HTML con los comentarios/estilos `mso-*` que Word
// reconoce, servido con MIME `application/msword` — Word lo abre como un
// .doc normal y todo el texto/tablas quedan editables de verdad (no son
// imágenes). "Word con imágenes" usa el mismo envoltorio pero incrusta cada
// ficha ya capturada como PNG/JPEG en vez de reconstruir el texto.
//
// CodexMaker además permite "adjuntar un libro existente" (.doc/.docx) para
// insertar las fichas dentro de un documento ya escrito; esa parte no se ha
// replicado aquí porque no encaja en el modelo de datos de WHArmy (no hay
// ningún documento "adjuntado" de por medio, las fichas siempre nacen del
// catálogo) — cada exportación genera siempre un documento nuevo, que es el
// camino por defecto (y el más usado) del programa original.
// ============================================================================
import type { AttributeProfile, UnitDetail, UnitSheet } from '@/domain/types'
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
import { bakeIllustration, grayscaleDataUrl } from '@/features/fichas/imageProcessing'
import { createOffscreenHost, destroyOffscreenHost, renderSheetOffscreen } from '@/features/fichas/offscreenRender'
import { captureUnitCanvas } from '@/features/fichas/exportSheet'
import { CARD_W } from '@/features/fichas/UnitSheetCard'
import { UnitSheetRepository } from '@/data/repositories/unitSheetRepository'

// Ancho útil = 760px de tarjeta menos 26px de margen a cada lado (igual que
// CONTENT_W en index.html y que UnitSheetCard.tsx — ver CARD_W allí).
const CONTENT_W = CARD_W - 52

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function attrVal(v: string | null): string {
  return v || '–'
}

/** 8.5x11in con márgenes de 0.35in (ver wordDocWrapper) deja ~10.3in de alto útil ≈ 989px a 96dpi; se usa un valor algo más conservador de margen de seguridad. */
const PAGE_USABLE_HEIGHT_PX = 940

/**
 * Bin-packing voraz y sencillo, SIN reordenar las fichas (mismo algoritmo
 * que CodexMaker): recorre en el mismo orden que ya tienen, acumulando
 * alturas; en cuanto la siguiente no cabría en el hueco que queda de la
 * página actual, fuerza un salto justo antes y reinicia el conteo. Solo
 * fuerza el salto cuando de verdad no cabe, nunca "por si acaso" — así dos
 * fichas pequeñas pueden compartir página.
 */
export function computeForcedPageBreaks(heights: number[], pageHeightPx = PAGE_USABLE_HEIGHT_PX): boolean[] {
  const breaks = heights.map(() => false)
  let used = 0
  heights.forEach((h, i) => {
    if (i === 0) {
      used = h
      return
    }
    if (used + h > pageHeightPx) {
      breaks[i] = true
      used = h
    } else {
      used += h
    }
  })
  return breaks
}

/**
 * Tabla ÚNICA de características (base + montura + carro en una sola tabla,
 * una fila por perfil) — igual que `buildStatsTableWordHtml(profs)` en
 * index.html, que recibe un array y nunca separa las monturas en tablas
 * aparte. Colores/tamaños copiados literales de esa misma función.
 */
function buildStatsTableWordHtml(rows: Array<{ label: string; profile: AttributeProfile }>): string {
  if (rows.length === 0) return ''
  const cellFont = "font-family:'PT Serif',Georgia,serif;font-size:9.5pt;"
  const thNum = `border:1px solid #1c1a16;padding:2.5px 2px;background:#e6e2d4;font-weight:bold;text-align:center;${cellFont}width:26px;`
  const thName = `border:1px solid #1c1a16;padding:2.5px 7px;background:#e6e2d4;font-weight:bold;text-align:left;${cellFont}`
  const tdNum = `border:1px solid #1c1a16;padding:2.5px 2px;text-align:center;${cellFont}width:26px;`
  const head = `<tr><th style="${thName}"></th>` + ATTRIBUTE_LABELS.map(({ label: l }) => `<th style="${thNum}">${l}</th>`).join('') + '</tr>'
  const body = rows
    .map(
      ({ label, profile }) =>
        `<tr><td style="border:1px solid #1c1a16;padding:2.5px 7px;font-weight:bold;${cellFont}">${escHtml(label)}</td>` +
        ATTRIBUTE_LABELS.map(({ key }) => `<td style="${tdNum}">${escHtml(attrVal(profile[key]))}</td>`).join('') +
        '</tr>',
    )
    .join('')
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;table-layout:fixed;margin-bottom:10px;">${head}${body}</table>`
}

interface BakedUnitAssets {
  illuUrl: string | null
  emblemUrl: string | null
}

/** Genera el bloque HTML de una ficha (título, subbarra, tabla(s) de atributos, equipo/opciones/reglas, ilustración en columna aparte) — misma estructura que `buildUnitWordHtml` de CodexMaker, adaptada a los datos de UnitDetail. */
function buildUnitWordHtml(
  unit: UnitDetail,
  sheet: UnitSheet,
  assets: BakedUnitAssets,
  view: ExportViewOptions,
): string {
  const bodyFont = "font-family:'PT Serif',Georgia,serif;font-size:10pt;color:#1c1a16;"
  const frameBorder = view.showFrame ? 'border:2px solid #1c1a16;' : 'border:2px solid transparent;'
  // La subbarra también se apaga a gris en Vista blanco y negro, igual que
  // CodexMaker (ver `barBg`/`barBorder` en su buildUnitWordHtml). Colores en
  // color = preset "Bretonia" (el único que usa WHArmy — ver .ficha-sheet en index.css).
  const barBg = view.grayscale ? '#d6d6d6' : '#d9d5c6'
  const barBorder = view.grayscale ? '#888888' : '#7d795f'

  const illuColW = 220
  const gapW = 18
  const textColW = CONTENT_W - illuColW - gapW
  const logoImg = assets.emblemUrl ? `<img src="${assets.emblemUrl}" width="46" height="46" style="display:block;">` : ''
  const illuImg = assets.illuUrl ? `<img src="${assets.illuUrl}" width="${illuColW}" style="display:block;">` : ''

  const statTables = buildStatsTableWordHtml(
    unifiedProfileRows(unit, sheet.hiddenProfiles).map(({ label, profile }) => ({ label, profile })),
  )

  const sizeHtml =
    unit.unitType === 'tropa'
      ? `<div style="${bodyFont}margin:0 0 7px;"><b>Tamaño de la unidad:</b> ${escHtml(sizeLabel(unit))}</div>`
      : ''
  const monturas = monturaItems(unit)
  const monturaHtml = monturas.length
    ? `<div style="${bodyFont}font-weight:bold;margin:0 0 4px;">Montura:</div><ul style="${bodyFont}margin:0 0 7px;padding-left:18px;">${monturas
        .map((m) => `<li style="margin-bottom:1px;">${escHtml(m)}</li>`)
        .join('')}</ul>`
    : ''
  const options = optionsList(unit)
  const optionsHtml = options.length
    ? `<div style="${bodyFont}font-weight:bold;margin:0 0 4px;">Opciones:</div><ul style="${bodyFont}margin:0 0 7px;padding-left:18px;">${options
        .map((o) => `<li style="margin-bottom:1px;">${escHtml(o)}</li>`)
        .join('')}</ul>`
    : ''
  const cmdText = commandGroupText(unit)
  const cmdHtml = cmdText ? `<div style="${bodyFont}margin:0 0 7px;"><b>Grupo de mando:</b> ${escHtml(cmdText)}</div>` : ''
  const rulesText = specialRulesText(unit)

  return `
  <table cellpadding="0" cellspacing="0" border="0" style="width:${CONTENT_W + 52}px;${frameBorder}border-collapse:collapse;background:#ffffff;margin-bottom:14px;">
    <tr>
      <td colspan="2" style="border:none;padding:13px 26px 6px 26px;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:21pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#1c1a16;">${escHtml(unit.name)}</div>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="border:none;padding:0 26px 12px 26px;">
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="background:${barBg};border-top:1px solid ${barBorder};border-bottom:1px solid ${barBorder};width:50px;padding:3px 8px;">${logoImg}</td>
            <td style="background:${barBg};border-top:1px solid ${barBorder};border-bottom:1px solid ${barBorder};padding:3px 8px;font-weight:bold;font-size:10pt;font-family:'PT Serif',Georgia,serif;color:#1c1a16;">${escHtml(unit.name)}</td>
            <td style="background:${barBg};border-top:1px solid ${barBorder};border-bottom:1px solid ${barBorder};padding:3px 8px;text-align:right;white-space:nowrap;font-size:9pt;font-family:'PT Serif',Georgia,serif;color:#1c1a16;">${escHtml(pointsLabel(unit))}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="border:none;vertical-align:top;width:${textColW}px;padding:0 0 16px 26px;">
        <div style="${bodyFont}">
          ${statTables}
          ${sizeHtml}
          <div style="${bodyFont}margin:0 0 7px;"><b>Equipo:</b> ${escHtml(unit.equipmentText || '–')}</div>
          ${monturaHtml}
          ${optionsHtml}
          ${cmdHtml}
          <div style="${bodyFont}font-weight:bold;margin:0 0 2px;">Reglas especiales:</div>
          <div style="${bodyFont}font-style:italic;">${escHtml(rulesText || '–')}</div>
        </div>
      </td>
      <td style="border:none;vertical-align:top;width:${illuColW}px;padding:0 26px 16px ${gapW}px;">
        ${illuImg}
      </td>
    </tr>
  </table>
  `
}

function wordDocWrapper(bodyHtml: string): string {
  return `
  <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset="utf-8">
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
  <style>
    body{font-family:'PT Serif', Georgia, serif; color:#1c1a16; background:#fff;}
    table{border-collapse:collapse;}
    @page Section1{size:8.5in 11in;margin:0.35in 0.35in 0.35in 0.35in;}
    div.Section1{page:Section1;}
  </style></head>
  <body><div class="Section1">${bodyHtml}</div></body></html>`
}

const PAGE_BREAK_HTML = '<br clear="all" style="mso-special-character:line-break;page-break-before:always;">'

function downloadWordDoc(bodyHtml: string, fileName: string): void {
  const html = wordDocWrapper(bodyHtml)
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export interface ExportViewOptions {
  grayscale: boolean
  showFrame: boolean
}

/** Ilustración+escudo ya "horneados" (volteo/brillo/blanco-y-negro sobre los píxeles) listos para incrustar tal cual en el documento. */
async function bakeAssetsForWord(unit: UnitDetail, unitId: number, grayscale: boolean): Promise<BakedUnitAssets> {
  const sheet = await UnitSheetRepository.getByUnitId(unitId)
  let illuUrl = await bakeIllustration(sheet.illuUrl, sheet.illuFlipped, sheet.illuBrightness)
  let emblemUrl = sheet.emblemUrl ?? unit.faction.emblemUrl
  if (grayscale) {
    illuUrl = await grayscaleDataUrl(illuUrl)
    emblemUrl = await grayscaleDataUrl(emblemUrl)
  }
  return { illuUrl, emblemUrl }
}

/** "Word con texto": párrafos y tablas de verdad (editable), igual que CodexMaker sin "libro existente" adjuntado. */
export async function exportSheetsToWordText(unitIds: number[], view: ExportViewOptions): Promise<void> {
  const host = createOffscreenHost()
  try {
    const parts: string[] = []
    const heights: number[] = []
    for (const unitId of unitIds) {
      // Se renderiza fuera de pantalla solo para medir el alto real (el
      // texto del documento en sí no depende de cómo se vea en la app).
      const rendered = await renderSheetOffscreen(host, unitId, { grayscale: false, showFrame: view.showFrame })
      if (!rendered) continue
      heights.push(rendered.cardEl.offsetHeight)
      const assets = await bakeAssetsForWord(rendered.unit, unitId, view.grayscale)
      parts.push(buildUnitWordHtml(rendered.unit, rendered.sheet, assets, view))
    }
    if (parts.length === 0) return
    const forcedBreaks = computeForcedPageBreaks(heights)
    let body = ''
    parts.forEach((html, i) => {
      if (forcedBreaks[i]) body += PAGE_BREAK_HTML
      body += html
    })
    downloadWordDoc(body, `fichas_word${view.grayscale ? '_bn' : ''}.doc`)
  } finally {
    destroyOffscreenHost(host)
  }
}

/**
 * "Word con imágenes": cada ficha capturada TAL CUAL se ve en pantalla (ver
 * captureCardCanvas + FichasPage, que captura el elemento real) e incrustada
 * como imagen JPEG. Recibe los canvas ya capturados (a color; el blanco y
 * negro ya se aplicó sobre el canvas si tocaba) y solo construye el documento
 * Word, con el mismo reparto por páginas que CodexMaker.
 */
export async function exportSheetsToWordImages(
  items: Array<{ unit: UnitDetail; sheet: UnitSheet }>,
  view: ExportViewOptions,
): Promise<void> {
  const blocks: string[] = []
  const heights: number[] = []
  // Una línea en blanco encima de cada imagen (un <p> suelto, sin envolver
  // todo en un <div>) para que Word pueda paginar cada bloque por separado y
  // el usuario tenga dónde escribir un título/nota, igual que CodexMaker.
  const blankLine = `<p style="margin:0 0 4px;font-family:'PT Serif',Georgia,serif;font-size:11pt;color:#1c1a16;">&nbsp;</p>`
  const blankLineHeightPx = 20

  for (const { unit, sheet } of items) {
    const canvas = await captureUnitCanvas(unit, sheet, view)
    const imgData = canvas.toDataURL('image/jpeg', 0.92)
    const naturalW = canvas.width / 2
    const naturalH = canvas.height / 2
    const maxW = 700
    const scale = Math.min(1, maxW / naturalW)
    const dispW = Math.round(naturalW * scale)
    const dispH = Math.round(naturalH * scale)
    heights.push(dispH + blankLineHeightPx)
    blocks.push(
      blankLine +
        `<p style="margin:0 0 6px;text-align:center;"><img src="${imgData}" width="${dispW}" height="${dispH}" style="width:${dispW}px;height:${dispH}px;"></p>`,
    )
  }
  if (blocks.length === 0) return
  const forcedBreaks = computeForcedPageBreaks(heights)
  let body = ''
  blocks.forEach((block, i) => {
    if (forcedBreaks[i]) body += PAGE_BREAK_HTML
    body += block
  })
  downloadWordDoc(body, `fichas_imagenes${view.grayscale ? '_bn' : ''}.doc`)
}

// ---------------------------------------------------------------------------
// Hoja de referencia: una tabla compacta por grupo (Personajes/Unidades), una
// fila por perfil (base + montura + carro), con las reglas especiales en una
// columna aparte (una vez por ficha, con rowspan) — igual que CodexMaker.
// ---------------------------------------------------------------------------
function buildReferenceGroupTable(units: UnitDetail[]): string {
  if (units.length === 0) return ''
  const headFont = "font-family:Georgia,'Times New Roman',serif;letter-spacing:.03em;"
  const bodyFontFam = "font-family:'PT Serif',Georgia,serif;"
  const pageWidth = 748
  const nameColWidth = 130
  const statColWidth = 24
  const rulesColWidth = pageWidth - nameColWidth - statColWidth * ATTRIBUTE_LABELS.length
  const thStyle = `border:1px solid #1c1a16;padding:1px 3px;line-height:1.05;background:#ece0c2;font-weight:bold;text-align:center;${headFont}font-size:7.5pt;`

  const colgroup =
    `<colgroup><col style="width:${nameColWidth}px;">` +
    ATTRIBUTE_LABELS.map(() => `<col style="width:${statColWidth}px;">`).join('') +
    `<col style="width:${rulesColWidth}px;"></colgroup>`
  const head =
    `<tr><th style="${thStyle}text-align:left;">Perfil</th>` +
    ATTRIBUTE_LABELS.map(({ label }) => `<th style="${thStyle}">${label}</th>`).join('') +
    `<th style="${thStyle}text-align:left;">Reglas especiales</th></tr>`

  let rows = ''
  units.forEach((unit) => {
    const profiles = [unit.profiles.base, ...unit.profiles.montura, ...unit.profiles.carro].filter((p): p is AttributeProfile => !!p)
    if (profiles.length === 0) return
    const rulesRaw = specialRulesText(unit)
    const rulesHtml = rulesRaw ? escHtml(rulesRaw) : '-'
    profiles.forEach((p, pi) => {
      const isFirst = pi === 0
      const size = isFirst ? '7.2pt' : '6.8pt'
      const topBorder = isFirst ? 'border-top:1.5px solid #1c1a16;' : ''
      const tdStyle = `border:1px solid #1c1a16;${topBorder}padding:${isFirst ? '1.5px 3px' : '0.5px 3px'};line-height:1.05;${bodyFontFam}font-size:${size};`
      const label = p.name ?? unit.name
      rows += `<tr><td style="${tdStyle}font-weight:bold;">${escHtml(label)}</td>` + ATTRIBUTE_LABELS.map(({ key }) => `<td style="${tdStyle}text-align:center;">${escHtml(attrVal(p[key]))}</td>`).join('')
      if (isFirst) {
        rows += `<td style="${tdStyle}font-style:italic;" rowspan="${profiles.length}">${rulesHtml}</td>`
      }
      rows += '</tr>'
    })
  })
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:${pageWidth}px;table-layout:fixed;margin:0 auto 8px auto;">${colgroup}${head}${rows}</table>`
}

function buildReferenceSheetHtml(units: UnitDetail[]): string {
  const headFont = "font-family:Georgia,'Times New Roman',serif;letter-spacing:.03em;"
  const groupTitle = (text: string) =>
    `<div style="${headFont}font-size:12pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#1c1a16;margin:6px 0 4px;text-align:center;">${text}</div>`
  const mainTitle = `<div style="${headFont}font-size:16pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#1c1a16;margin-bottom:10px;text-align:center;">Hoja de referencia</div>`

  const personajes = units.filter((u) => u.unitType === 'personaje')
  const tropas = units.filter((u) => u.unitType !== 'personaje')

  let body = mainTitle
  if (personajes.length) body += groupTitle('Personajes') + buildReferenceGroupTable(personajes)
  if (tropas.length) body += groupTitle('Unidades') + buildReferenceGroupTable(tropas)
  return body
}

export function exportReferenceSheet(units: UnitDetail[]): void {
  if (units.length === 0) return
  downloadWordDoc(buildReferenceSheetHtml(units), 'hoja_de_referencia.doc')
}
