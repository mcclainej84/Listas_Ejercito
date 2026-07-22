// ============================================================================
// Historial de versiones del PROGRAMA, para la pestaña "Programa" del Log.
//
// Sale del propio CHANGELOG.md del repositorio, importado como texto en tiempo
// de compilación (?raw, igual que db/schema.sql en localCatalog.ts). Así no hay
// una segunda lista que mantener a mano ni riesgo de que se desincronice: el
// CHANGELOG ya se actualiza en cada cambio, y la pantalla lo refleja.
//
// Es la respuesta a "¿pueden verse también los cambios de Claude?": los suyos
// no son cambios de DATOS —no tocan el catálogo— sino versiones del programa,
// así que viven aquí y no en change_log, que registra quién editó qué en la
// base de datos compartida.
// ============================================================================
// El CHANGELOG vive en la raíz del repositorio, un nivel por encima de
// `webapp/` (de ahí los cinco `..`). Vite necesita además permiso para leer
// fuera de su raíz — ver `server.fs.allow` en vite.config.ts.
import changelogRaw from '../../../../../CHANGELOG.md?raw'

export interface ReleaseNote {
  version: string
  /** Tal y como aparece en el CHANGELOG: "20/07/2026 21:55". */
  date: string
  /** Las líneas del apartado, ya sin la viñeta inicial. */
  changes: string[]
}

/** Cabecera de versión: "## 0.26 — 20/07/2026 21:55". */
const HEADING_RE = /^##\s+(\S+)\s+—\s+(.+)$/

/**
 * Trocea el CHANGELOG en versiones. Se queda con los puntos de lista y con los
 * párrafos sueltos (algunas versiones abren con un resumen en prosa antes de
 * las viñetas), y descarta el preámbulo del principio del archivo.
 */
export function parseChangelog(markdown: string = changelogRaw): ReleaseNote[] {
  const releases: ReleaseNote[] = []
  let currentRelease: ReleaseNote | null = null
  let pendingParagraph: string[] = []

  function flushParagraph() {
    const text = pendingParagraph.join(' ').trim()
    if (text && currentRelease) currentRelease.changes.push(text)
    pendingParagraph = []
  }

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trimEnd()
    const heading = HEADING_RE.exec(line)

    if (heading) {
      flushParagraph()
      currentRelease = { version: heading[1], date: heading[2], changes: [] }
      releases.push(currentRelease)
      continue
    }
    if (!currentRelease) continue

    if (line.startsWith('- ')) {
      flushParagraph()
      currentRelease.changes.push(line.slice(2).trim())
      continue
    }
    // Continuación de la viñeta anterior (el CHANGELOG va justificado a 80
    // columnas, así que casi todas ocupan varias líneas).
    if (line.startsWith('  ') && currentRelease.changes.length > 0 && pendingParagraph.length === 0) {
      currentRelease.changes[currentRelease.changes.length - 1] += ` ${line.trim()}`
      continue
    }
    if (line === '' || line === '---') {
      flushParagraph()
      continue
    }
    pendingParagraph.push(line.trim())
  }
  flushParagraph()

  // Se limpia el marcado que no aporta en pantalla: negritas y `código`.
  return releases.map((r) => ({
    ...r,
    changes: r.changes.map((c) => c.replace(/\*\*/g, '').replace(/`/g, '')),
  }))
}
