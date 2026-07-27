// ============================================================================
// Sección "Fichas" — generador visual de fichas de unidad inspirado en
// CodexMaker (ver index.html/README.md adjuntados como referencia), adaptado
// para reutilizar los datos que YA se editan en Editor > Unidades (stats,
// equipo, reglas, grupo de mando, monturas...) en vez de duplicarlos: aquí
// solo se controla la capa de presentación de cada ficha — ver UnitSheet en
// domain/types.ts.
//
// Layout de tres columnas (controles a la izquierda, tarjeta al centro,
// "Tus fichas" a la derecha), con una barra superior de Vista/Marco — mismo
// reparto que el programa de referencia. La tarjeta necesita más ancho del
// que deja el contenedor centrado normal de la app (`AppShell` limita el
// contenido a max-w-4xl), así que esta sección "escapa" de ese límite con un
// wrapper a ancho de pantalla completo — si no, la tarjeta se encoge de golpe
// y todo el contenido se ve amontonado.
//
// ---------------------------------------------------------------------------
// EDICIÓN EN MEMORIA, GUARDADO EXPLÍCITO
// ---------------------------------------------------------------------------
// Antes cada control escribía por red en cuanto se movía: un deslizador de
// tamaño disparaba una petición por paso, el arrastre otra al soltar, el
// escudo otra… La sección se sentía pesada, y un fallo de red dejaba la
// pantalla enseñando algo que no estaba guardado.
//
// Ahora la ficha abierta vive en un BORRADOR en memoria (`draft`): todos los
// controles lo tocan al instante, sin red, y solo el botón "Guardar" escribe
// —una vez, en un único batch (ver UnitSheetRepository.save)—. Las fichas ya
// abiertas se quedan además en una caché de sesión, así que volver a una es
// inmediato. A cambio, hay que proteger lo no guardado: al cambiar de ficha o
// de facción, al navegar fuera (useBlocker) y al cerrar la pestaña
// (beforeunload) se pregunta qué hacer, con el mismo diálogo de tres vías que
// ya usan Unidades y el constructor de listas.
// ============================================================================
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useBlocker, useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { UnitRepository, type UnitSummary } from '@/data/repositories/unitRepository'
import { useVisibleFactions } from '@/shared/session/useVisibleFactions'
import { useFavoriteFactionId } from '@/shared/session/useFavoriteFactionId'
import {
  UnitSheetRepository,
  type SheetImageChange,
  type SheetTarget,
} from '@/data/repositories/unitSheetRepository'
import {
  MAX_SECTION_WIDTH,
  MIN_SECTION_WIDTH,
  SECTION_LABELS,
  sectionWidth,
  type SheetSection,
} from '@/domain/sheetSections'
import {
  compressImageFile,
  formatBytes,
  MAX_EMBLEM_BYTES,
  MAX_ILLUSTRATION_BYTES,
} from '@/shared/image'
import { useAsync } from '@/shared/hooks/useAsync'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Panel } from '@/shared/ui/Panel'
import { Select } from '@/shared/ui/Select'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { FactionEmblem } from '@/shared/ui/FactionEmblem'
import { UnsavedChangesDialog } from '@/shared/ui/UnsavedChangesDialog'
import {
  CheckCircleIcon,
  ContrastIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  FlipHorizontalIcon,
  FrameIcon,
  ImageIcon,
  ShieldIcon,
  SunIcon,
  TrashIcon,
  UndoIcon,
} from '@/shared/ui/icons'
import type { UnitDetail, UnitSheet } from '@/domain/types'
import { UpgradeRepository } from '@/data/repositories/lookupRepositories'
import { MountRepository } from '@/data/repositories/profileCatalogRepository'
import { UnitSheetCard } from '@/features/fichas/UnitSheetCard'
import { commandGroupText, monturaItems, optionsList, unifiedProfileRows } from '@/features/fichas/sheetContent'
import { mountAsUnitDetail, upgradeAsUnitDetail } from '@/features/fichas/upgradeSheet'
import { exportSheetsToPng, type SheetToExport } from '@/features/fichas/exportPng'
import { exportReferenceSheet, exportSheetsToWordImages, exportSheetsToWordText } from '@/features/fichas/exportWord'

const SIN_CATEGORIA_KEY = 'Sin categoría'

/**
 * URL local para ver la imagen recién elegida ANTES de guardarla.
 *
 * Una `blob:` URL y no una `data:` URL: la imagen todavía no se ha subido a
 * R2 (eso pasa al pulsar "Guardar"), y convertir medio mega a base64 solo para
 * enseñarlo un momento en pantalla es trabajo tirado en el hilo principal. El
 * navegador libera estas URLs solo al cerrar la pestaña, y aquí se crea una
 * por imagen elegida, así que no hace falta revocarlas a mano.
 */
function previewUrl(bytes: Uint8Array, mime: string): string {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return URL.createObjectURL(new Blob([buffer], { type: mime }))
}

/** Las tres clases de ficha comparten controles; solo cambia dónde se guardan. */
function targetFromKey(key: string): SheetTarget {
  return {
    kind: key.startsWith('u:') ? 'unidad' : key.startsWith('m:') ? 'montura' : 'opcion',
    id: Number(key.slice(2)),
  }
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1 text-xs font-medium text-ink-soft">{children}</p>
}

// ---------------------------------------------------------------------------
// Los controles de la ficha se agrupan en secciones plegables. Al ir creciendo
// (ilustración, escudo, alto, y ahora un ancho por apartado) la columna pedía
// desplazarse para llegar a lo de abajo, justo cuando lo que interesa es tener
// la tarjeta y sus controles a la vista a la vez.
//
// Qué está abierto se recuerda entre visitas (localStorage, misma convención
// que el acordeón de Unidades): quien trabaja las ilustraciones abre "Imagen" y
// la quiere abierta la próxima vez, no cerrada otra vez.
// ---------------------------------------------------------------------------
const OPEN_PANELS_KEY = 'wharmy_fichas_paneles'
/** Al entrar por primera vez solo se abre "Imagen": el resto a un clic, sin desplazarse. */
const DEFAULT_OPEN_PANELS = ['imagen']

function readOpenPanels(): string[] {
  try {
    const raw = localStorage.getItem(OPEN_PANELS_KEY)
    return raw ? (JSON.parse(raw) as string[]) : DEFAULT_OPEN_PANELS
  } catch {
    return DEFAULT_OPEN_PANELS
  }
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-rule-dark/30">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 bg-parchment-dark/40 px-2.5 py-1.5 text-left hover:bg-parchment-dark"
      >
        <span className="text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">{title}</span>
        <span className={clsx('text-sm text-ink-soft transition-transform', open && 'rotate-90')}>›</span>
      </button>
      {open && <div className="space-y-3 p-2.5">{children}</div>}
    </div>
  )
}

/** Botón secundario con icono + texto — mismo aspecto en todos los controles de Fichas (Ilustración, Escudo, Vista, Marco...), más cuidado que un botón de solo texto. */
function IconButton({
  icon,
  children,
  onClick,
  disabled,
  danger,
}: {
  icon: ReactNode
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        danger
          ? 'border-maroon/30 text-maroon hover:bg-maroon/10'
          : 'border-rule-dark/50 bg-parchment/70 text-ink hover:border-bronze hover:text-bronze',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function FichasPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const factionId = searchParams.get('faccion')

  // Solo las facciones que el usuario quiere ver (en modo admin, todas).
  const { factions, loading: loadingFactions } = useVisibleFactions()
  const selectedFaction = factions.find((f) => String(f.id) === factionId)
  const favoriteFactionId = useFavoriteFactionId()

  useEffect(() => {
    if (!factionId && factions && factions.length > 0) {
      // La favorita del usuario si sigue siendo visible; si no, la primera.
      const preferred =
        favoriteFactionId != null && factions.some((f) => f.id === favoriteFactionId)
          ? favoriteFactionId
          : factions[0].id
      setSearchParams({ faccion: String(preferred) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factionId, factions, favoriteFactionId])

  // Solo las unidades ACTIVAS. Las desactivadas se ocultan aquí, no se
  // borran: su ficha (ilustración, escudo, anchos…) sigue guardada tal cual en
  // unit_sheets, así que al reactivarlas desde Editor vuelven a aparecer
  // exactamente como estaban.
  const { data: units, loading: loadingUnits } = useAsync(
    () =>
      factionId
        ? UnitRepository.listByFaction(Number(factionId)).then((list) => list.filter((u) => u.active))
        : Promise.resolve([]),
    [factionId],
  )

  // Marca de "completada" de todas las fichas de la facción. Es una consulta
  // de dos columnas, SIN imágenes: lo único que el listado necesita saber de
  // las fichas que no están abiertas (ver getCompletedKeys — antes esto
  // descargaba todas las ilustraciones de la facción y era el grueso de la
  // espera al entrar en la sección).
  const { data: completedKeys, reload: reloadCompletedKeys } = useAsync(
    () => (factionId ? UnitSheetRepository.getCompletedKeys(Number(factionId)) : Promise.resolve(new Set<string>())),
    [factionId],
  )

  // ---------- Vista/Marco: globales de la página, nunca se guardan (igual
  // que en el programa de referencia) — se reinician al recargar. Por
  // defecto en blanco y negro y sin marco, mismos valores por defecto que
  // CodexMaker. Se aplican tanto a la vista previa como a TODO lo que se
  // exporte (PNG/Word), igual que el original: exportas lo que ves. ----------
  const [grayscale, setGrayscale] = useState(true)
  const [showFrame, setShowFrame] = useState(false)
  const [hideCompleted, setHideCompleted] = useState(false)

  // Opciones de unidad marcadas "incluir en fichas": salen como un grupo más
  // en "Tus fichas" y se pueden ver/exportar como una ficha cualquiera. Solo
  // las que usa alguna unidad de ESTA facción — el catálogo de opciones es
  // global y, sin filtrar, aparecían las de todas las facciones a la vez.
  const { data: sheetUpgrades } = useAsync(
    () => (factionId ? UpgradeRepository.listForSheetsByFaction(Number(factionId)) : Promise.resolve([])),
    [factionId],
  )

  // Monturas y dotaciones de la facción MARCADAS para salir en fichas (ver
  // "Incluir en fichas" en Editor > Montura/Dotación). Son la única forma de
  // consultar los atributos y las reglas de un monstruo, ya que sus reglas no
  // se mezclan en la ficha de quien lo monta; pero el catálogo tiene además
  // muchas cabalgaduras de tropa que no interesa imprimir por separado.
  const { data: sheetMounts } = useAsync(
    () => (factionId ? MountRepository.listForSheetsByFaction(Number(factionId)) : Promise.resolve([])),
    [factionId],
  )

  // Las casillas de exportación y la selección usan CLAVES de texto, porque la
  // lista mezcla tres cosas distintas: unidades ("u:12"), opciones ("o:5") y
  // monturas ("m:9").
  const [exportChecks, setExportChecks] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Al cambiar de facción (o cargar la lista por primera vez), se marcan
    // todas las fichas para exportar por defecto — igual que un sheet nuevo
    // en CodexMaker nace con su casilla marcada.
    setExportChecks(
      new Set([
        ...(units ?? []).map((u) => `u:${u.id}`),
        ...(sheetUpgrades ?? []).map((o) => `o:${o.id}`),
        ...(sheetMounts ?? []).map((m) => `m:${m.id}`),
      ]),
    )
  }, [units, sheetUpgrades, sheetMounts])

  const [openPanels, setOpenPanels] = useState<string[]>(readOpenPanels)
  const isPanelOpen = (id: string) => openPanels.includes(id)
  function togglePanel(id: string) {
    setOpenPanels((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
      try {
        localStorage.setItem(OPEN_PANELS_KEY, JSON.stringify(next))
      } catch {
        // localStorage no disponible: no se recuerda, pero funciona igual.
      }
      return next
    })
  }

  // =========================================================================
  // Ficha abierta: borrador en memoria
  // =========================================================================
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<UnitDetail | null>(null)
  /** Lo que se ve y se edita. NO está guardado hasta que se pulsa "Guardar". */
  const [draft, setDraft] = useState<UnitSheet | null>(null)
  /** Imágenes que han cambiado en este borrador y hay que subir al guardar. */
  const [pendingImages, setPendingImages] = useState<SheetImageChange>({})
  const [dirty, setDirtyState] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  /**
   * El mismo "hay cambios sin guardar", pero en una ref además del estado.
   *
   * No es duplicar por duplicar: `useBlocker` tiene que consultarlo en el
   * mismo instante en que se lanza la navegación, y el estado de React todavía
   * no se ha vuelto a pintar cuando se pulsa "Descartar y salir" y acto
   * seguido se cambia de facción — con el estado a secas, el bloqueador seguía
   * viendo `true` y el diálogo volvía a salir en bucle. La ref se actualiza en
   * el acto.
   */
  const dirtyRef = useRef(false)
  function setDirty(value: boolean) {
    dirtyRef.current = value
    setDirtyState(value)
  }

  /**
   * Fichas ya cargadas en esta sesión, tal y como están GUARDADAS. Volver a
   * una ficha ya visitada no vuelve a pedirla por red (que es lo que hacía
   * que ir y venir entre hojas se sintiera lento, porque cada vuelta
   * redescargaba su ilustración en base64). Se actualiza al guardar.
   */
  const sheetCache = useRef(new Map<string, UnitSheet>())
  /** Lo mismo para el contenido de la unidad/montura/opción, que tampoco cambia mientras se está aquí. */
  const detailCache = useRef(new Map<string, UnitDetail>())

  // Al cambiar de facción se vacían las cachés: son de otra facción y el
  // usuario puede haber editado unidades en Editor mientras tanto.
  useEffect(() => {
    sheetCache.current.clear()
    detailCache.current.clear()
    setSelectedKey(null)
    setSelectedDetail(null)
    setDraft(null)
    setPendingImages({})
    setDirty(false)
  }, [factionId])

  const isUpgradeSelected = selectedKey?.startsWith('o:') ?? false
  const isMountSelected = selectedKey?.startsWith('m:') ?? false
  const sheetTarget: SheetTarget | null = selectedKey ? targetFromKey(selectedKey) : null

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  /** Aplica un cambio al borrador y lo marca como pendiente de guardar. */
  function patchDraft(patch: Partial<UnitSheet>) {
    setDraft((s) => (s ? { ...s, ...patch } : s))
    setDirty(true)
  }

  async function buildDetail(key: string): Promise<UnitDetail | null> {
    const cached = detailCache.current.get(key)
    if (cached) return cached
    const { kind, id } = targetFromKey(key)
    let detail: UnitDetail | null = null
    if (kind === 'unidad') {
      detail = await UnitRepository.getDetailById(id)
    } else if (kind === 'montura') {
      const profile = (sheetMounts ?? []).find((p) => p.id === id)
      if (profile) detail = mountAsUnitDetail(profile, await MountRepository.listSpecialRules(id), selectedFaction)
    } else {
      const upgrade = (sheetUpgrades ?? []).find((o) => o.id === id)
      if (upgrade) detail = upgradeAsUnitDetail(upgrade, await UpgradeRepository.listSpecialRules(id), selectedFaction)
    }
    if (detail) detailCache.current.set(key, detail)
    return detail
  }

  /** Abre una ficha. No comprueba cambios sin guardar: de eso se ocupa `guarded`. */
  async function openSheet(key: string) {
    setSelectedKey(key)
    setError(null)
    setPendingImages({})
    setDirty(false)

    // Si ya se visitó, se pinta al instante desde la caché y no hay espera.
    const cachedSheet = sheetCache.current.get(key)
    const cachedDetail = detailCache.current.get(key)
    if (cachedSheet) setDraft(cachedSheet)
    if (cachedDetail) setSelectedDetail(cachedDetail)
    if (cachedSheet && cachedDetail) return

    setLoadingDetail(true)
    try {
      const [detail, sheet] = await Promise.all([
        buildDetail(key),
        cachedSheet ?? UnitSheetRepository.get(targetFromKey(key)),
      ])
      sheetCache.current.set(key, sheet)
      setSelectedDetail(detail)
      setDraft(sheet)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingDetail(false)
    }
  }

  // -------------------------------------------------------------------------
  // Protección de lo no guardado
  // -------------------------------------------------------------------------
  /** Acción aplazada mientras el usuario decide qué hacer con sus cambios. */
  const [pendingAction, setPendingAction] = useState<{ run: () => void } | null>(null)

  /** Ejecuta `action`, o pregunta antes si hay cambios sin guardar. */
  function guarded(action: () => void) {
    if (dirtyRef.current) setPendingAction({ run: action })
    else action()
  }

  // Navegación dentro de la app (data router)…
  const blocker = useBlocker(() => dirtyRef.current)
  // …y cierre/recarga de la pestaña, que useBlocker no cubre.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  const showUnsavedDialog = pendingAction !== null || blocker.state === 'blocked'

  /** Escribe el borrador entero de una vez. Devuelve si salió bien. */
  async function saveDraft(): Promise<boolean> {
    if (!draft || !sheetTarget || !selectedKey) return true
    setSaving(true)
    setError(null)
    try {
      const keys = await UnitSheetRepository.save(sheetTarget, draft, pendingImages)
      // Las claves que devuelve el guardado se incorporan al borrador. Si no,
      // el borrador se quedaría con la clave ANTERIOR y, al cambiar otra vez la
      // imagen, se borraría de R2 el archivo equivocado.
      const saved: UnitSheet = {
        ...draft,
        illuKey: keys.illuKey !== undefined ? keys.illuKey : draft.illuKey,
        emblemKey: keys.emblemKey !== undefined ? keys.emblemKey : draft.emblemKey,
      }
      setDraft(saved)
      sheetCache.current.set(selectedKey, saved)
      setPendingImages({})
      setDirty(false)
      reloadCompletedKeys()
      return true
    } catch (err) {
      setError(
        `No se pudieron guardar los cambios: ${err instanceof Error ? err.message : String(err)}. ` +
          'Nada se ha perdido: siguen aquí, puedes volver a intentarlo.',
      )
      return false
    } finally {
      setSaving(false)
    }
  }

  /** Tira el borrador y vuelve a lo último guardado. */
  function discardDraft() {
    if (!selectedKey) return
    const saved = sheetCache.current.get(selectedKey)
    if (saved) setDraft(saved)
    setPendingImages({})
    setDirty(false)
    setError(null)
  }

  async function handleDialogSaveAndLeave() {
    const ok = await saveDraft()
    if (!ok) return
    const action = pendingAction
    setPendingAction(null)
    if (action) action.run()
    else if (blocker.state === 'blocked') blocker.proceed()
  }

  function handleDialogDiscardAndLeave() {
    discardDraft()
    const action = pendingAction
    setPendingAction(null)
    if (action) action.run()
    else if (blocker.state === 'blocked') blocker.proceed()
  }

  function handleDialogKeepEditing() {
    setPendingAction(null)
    if (blocker.state === 'blocked') blocker.reset()
  }

  // -------------------------------------------------------------------------
  // Controles de presentación — todos tocan SOLO el borrador
  // -------------------------------------------------------------------------
  const illuInputRef = useRef<HTMLInputElement>(null)
  const emblemInputRef = useRef<HTMLInputElement>(null)

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleIlluFile(file: File | undefined) {
    if (!file || !draft) return
    await withBusy(async () => {
      // Se comprime AQUÍ, en el navegador, antes de que la imagen entre
      // siquiera en el borrador: así el peso que se va a guardar está acotado
      // desde el primer momento y una foto de 8 MB no puede reventar la
      // escritura más tarde (ver compressImageFile en shared/image.ts).
      const { bytes, mime } = await compressImageFile(file, {
        maxSize: 1100,
        maxBytes: MAX_ILLUSTRATION_BYTES,
      })
      // Subir una imagen nueva reinicia el encuadre, igual que en CodexMaker.
      setDraft((s) =>
        s
          ? {
              ...s,
              illuUrl: previewUrl(bytes, mime),
              illuOriginalName: file.name,
              illuWidthPct: 34,
              illuPosX: null,
              illuPosY: null,
              illuBrightness: 100,
              illuFlipped: false,
            }
          : s,
      )
      setPendingImages((p) => ({ ...p, illu: { bytes, mime, originalName: file.name } }))
      setDirty(true)
    })
    if (illuInputRef.current) illuInputRef.current.value = ''
  }

  function handleRemoveIllu() {
    if (!draft) return
    if (!confirm('¿Quitar la ilustración de esta ficha?')) return
    setDraft((s) =>
      s
        ? {
            ...s,
            illuUrl: null,
            illuOriginalName: null,
            illuWidthPct: 34,
            illuPosX: null,
            illuPosY: null,
            illuBrightness: 100,
            illuFlipped: false,
          }
        : s,
    )
    setPendingImages((p) => ({ ...p, illu: null }))
    setDirty(true)
  }

  function handleIlluResetFraming() {
    patchDraft({ illuWidthPct: 34, illuPosX: null, illuPosY: null, illuBrightness: 100, illuFlipped: false })
  }

  async function handleEmblemFile(file: File | undefined) {
    if (!file || !draft) return
    await withBusy(async () => {
      const { bytes, mime } = await compressImageFile(file, { maxSize: 480, maxBytes: MAX_EMBLEM_BYTES })
      setDraft((s) => (s ? { ...s, emblemUrl: previewUrl(bytes, mime), hasCustomEmblem: true } : s))
      setPendingImages((p) => ({ ...p, emblem: { bytes, mime } }))
      setDirty(true)
    })
    if (emblemInputRef.current) emblemInputRef.current.value = ''
  }

  function handleEmblemRevert() {
    setDraft((s) => (s ? { ...s, emblemUrl: null, hasCustomEmblem: false } : s))
    setPendingImages((p) => ({ ...p, emblem: null }))
    setDirty(true)
  }

  function handleSectionWidthsReset() {
    patchDraft({ sectionWidths: {} })
  }

  function handleProfileVisibility(profileKey: string, visible: boolean) {
    if (!draft) return
    patchDraft({
      hiddenProfiles: visible
        ? draft.hiddenProfiles.filter((k) => k !== profileKey)
        : [...new Set([...draft.hiddenProfiles, profileKey])],
    })
  }

  /**
   * Apartados que esta ficha muestra de verdad. Se calcula con las MISMAS
   * funciones que usa la tarjeta al pintarla, para que no puedan
   * desincronizarse: si la tarjeta no pinta "Montura", aquí no aparece su
   * control.
   */
  const visibleSections: SheetSection[] = selectedDetail
    ? ([
        selectedDetail.unitType === 'tropa' ? 'tamano' : null,
        'equipo',
        monturaItems(selectedDetail).length > 0 ? 'montura' : null,
        optionsList(selectedDetail).length > 0 ? 'opciones' : null,
        commandGroupText(selectedDetail) ? 'mando' : null,
        'reglas',
      ].filter(Boolean) as SheetSection[])
    : []

  /**
   * Todas las fichas de atributos de la hoja, marcadas o no. Se piden SIN
   * filtrar (lista vacía de ocultas) porque aquí hay que ofrecer también las
   * que están escondidas — si no, una vez ocultas no habría forma de
   * recuperarlas.
   */
  const allProfileRows = selectedDetail ? unifiedProfileRows(selectedDetail) : []

  function toggleExportCheck(key: string) {
    setExportChecks((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const grouped = new Map<string, UnitSummary[]>()
  for (const unit of units ?? []) {
    const key = unit.categoryName ?? SIN_CATEGORIA_KEY
    grouped.set(key, [...(grouped.get(key) ?? []), unit])
  }

  /**
   * ¿Está completada esta ficha? Lo que diga el borrador manda sobre lo
   * guardado: si acabas de marcarla, el tick aparece al momento aunque
   * todavía no hayas guardado.
   */
  function isCompleted(key: string): boolean {
    if (key === selectedKey && draft) return draft.completed
    return completedKeys?.has(key) ?? false
  }

  // Grupos de "Tus fichas": las categorías de unidades + un grupo con las
  // opciones de unidad marcadas "incluir en fichas" + otro con monturas.
  const groups: Array<{ title: string; entries: Array<{ key: string; name: string; completed: boolean }> }> = [
    ...Array.from(grouped.entries()).map(([category, categoryUnits]) => ({
      title: category,
      entries: categoryUnits.map((u) => ({
        key: `u:${u.id}`,
        name: u.name,
        completed: isCompleted(`u:${u.id}`),
      })),
    })),
    ...((sheetUpgrades ?? []).length > 0
      ? [
          {
            title: 'Opciones de unidad',
            entries: (sheetUpgrades ?? []).map((o) => ({
              key: `o:${o.id}`,
              name: o.name,
              completed: isCompleted(`o:${o.id}`),
            })),
          },
        ]
      : []),
    ...((sheetMounts ?? []).length > 0
      ? [
          {
            title: 'Monturas y dotaciones',
            entries: (sheetMounts ?? []).map((m) => ({
              key: `m:${m.id}`,
              name: m.name ?? 'Montura',
              completed: isCompleted(`m:${m.id}`),
            })),
          },
        ]
      : []),
  ]

  // Acordeón por grupo. A diferencia del constructor de ejércitos (donde solo
  // uno puede estar abierto), aquí cada grupo se abre y cierra por su cuenta:
  // se pueden dejar todos abiertos o todos cerrados. `null` = todavía no se ha
  // tocado nada, así que se muestran todos abiertos por defecto.
  const [openGroups, setOpenGroups] = useState<Set<string> | null>(null)
  const isGroupOpen = (title: string) => (openGroups === null ? true : openGroups.has(title))
  function toggleGroup(title: string) {
    setOpenGroups((prev) => {
      const base = prev ?? new Set(groups.map((g) => g.title))
      const next = new Set(base)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  // ---------- Exportaciones: mismos 4 formatos que CodexMaker (PNG / Word
  // con texto / Word con imágenes / Hoja de referencia), sobre las fichas
  // marcadas en "Tus fichas". Un estado de "trabajando" por botón para poder
  // desactivar solo el que está en marcha. ----------
  const [runningExport, setRunningExport] = useState<'png' | 'word-texto' | 'word-imagenes' | 'referencia' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const selectedIds = (units ?? []).filter((u) => exportChecks.has(`u:${u.id}`)).map((u) => u.id)
  const selectedUpgrades = (sheetUpgrades ?? []).filter((o) => exportChecks.has(`o:${o.id}`))
  const selectedMounts = (sheetMounts ?? []).filter((m) => exportChecks.has(`m:${m.id}`))

  /**
   * Presentación de una ficha para exportar. Se prefiere el BORRADOR de la
   * ficha abierta y, si no, la caché de sesión: "exportas lo que ves", que es
   * la regla del programa original. Solo se va a la red por lo que no se ha
   * abierto en esta sesión.
   */
  async function sheetForExport(key: string): Promise<UnitSheet> {
    if (key === selectedKey && draft) return draft
    const cached = sheetCache.current.get(key)
    if (cached) return cached
    const sheet = await UnitSheetRepository.get(targetFromKey(key))
    sheetCache.current.set(key, sheet)
    return sheet
  }

  /** Carga las fichas marcadas (unidades + opciones + monturas) listas para exportar como imagen. */
  async function buildExportItems(): Promise<SheetToExport[]> {
    const items: SheetToExport[] = []
    for (const id of selectedIds) {
      const [unit, sheet] = await Promise.all([UnitRepository.getDetailById(id), sheetForExport(`u:${id}`)])
      if (unit) items.push({ unit, sheet })
    }
    for (const upgrade of selectedUpgrades) {
      const rules = await UpgradeRepository.listSpecialRules(upgrade.id)
      items.push({
        unit: upgradeAsUnitDetail(upgrade, rules, selectedFaction),
        sheet: await sheetForExport(`o:${upgrade.id}`),
      })
    }
    for (const mount of selectedMounts) {
      const rules = await MountRepository.listSpecialRules(mount.id)
      items.push({
        unit: mountAsUnitDetail(mount, rules, selectedFaction),
        sheet: await sheetForExport(`m:${mount.id}`),
      })
    }
    return items
  }

  async function runExport(kind: typeof runningExport, fn: () => Promise<void>) {
    if (selectedIds.length === 0 && selectedUpgrades.length === 0 && selectedMounts.length === 0) {
      setExportError('Marca al menos una hoja para exportar.')
      return
    }
    setRunningExport(kind)
    setExportError(null)
    try {
      await fn()
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunningExport(null)
    }
  }

  const view = { grayscale, showFrame }

  async function handleExportPng() {
    await runExport('png', async () => exportSheetsToPng(await buildExportItems(), view))
  }
  async function handleExportWordText() {
    await runExport('word-texto', () => exportSheetsToWordText(selectedIds, view))
  }
  async function handleExportWordImages() {
    await runExport('word-imagenes', async () => exportSheetsToWordImages(await buildExportItems(), view))
  }
  async function handleExportReference() {
    await runExport('referencia', async () => {
      const details = await Promise.all(selectedIds.map((id) => UnitRepository.getDetailById(id)))
      exportReferenceSheet(details.filter((d): d is UnitDetail => !!d))
    })
  }

  return (
    <div>
      <PageHeader title="Hojas de Unidad" />

      {/* Selector a la izquierda y, al extremo derecho de la misma fila, el
          emblema de la facción elegida — la misma ilustración que se ve en
          Editor > Unidades y personajes, para saber de un vistazo en qué
          facción se está trabajando. */}
      {!loadingFactions && factions && factions.length > 0 && (
        <div className="mb-5 flex items-center gap-4">
          <div className="w-full max-w-xs">
            <Select
              label="Facción"
              value={factionId ?? ''}
              onChange={(e) => {
                const next = e.target.value
                guarded(() => setSearchParams({ faccion: next }))
              }}
            >
              {factions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <p className="font-display text-2xl leading-none font-bold tracking-wide text-maroon">
              {selectedFaction?.name ?? '—'}
            </p>
            <FactionEmblem faction={selectedFaction} size="lg" />
          </div>
        </div>
      )}

      {loadingUnits && <Spinner />}

      {/* "Escape" del ancho centrado de AppShell (max-w-4xl = 896px): la
          tarjeta de ficha necesita 760px por sí sola, más los dos paneles
          laterales — con el límite normal de la app todo quedaría encogido
          a un tercio de su tamaño. */}
      {!loadingUnits && factionId && (
        <div className="relative left-1/2 w-screen -translate-x-1/2 px-4">
          <div className="mx-auto max-w-[1500px] space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-sm border border-rule-dark/40 bg-parchment/70 px-3 py-2">
              <span className="mr-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">Vista</span>
              <IconButton icon={<ContrastIcon />} onClick={() => setGrayscale((v) => !v)}>
                {grayscale ? 'Ver a color' : 'Ver en blanco y negro'}
              </IconButton>
              <IconButton icon={<FrameIcon />} onClick={() => setShowFrame((v) => !v)}>
                {showFrame ? 'Quitar marco' : 'Añadir marco'}
              </IconButton>

              {/* Guardar vive en la barra superior, siempre a la vista: es la
                  única acción que escribe y no debe quedar escondida al final
                  de una columna que hay que desplazar. */}
              {draft && (
                <div className="ml-auto flex items-center gap-2">
                  {dirty && (
                    <span className="text-xs font-medium text-maroon">Cambios sin guardar</span>
                  )}
                  {dirty && (
                    <Button variant="ghost" onClick={discardDraft} disabled={saving}>
                      Descartar
                    </Button>
                  )}
                  <Button variant="primary" onClick={saveDraft} disabled={!dirty || saving}>
                    {saving ? 'Guardando…' : dirty ? 'Guardar' : 'Guardado'}
                  </Button>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr_320px]">
              <Panel title="Ficha">
                {!selectedDetail ? (
                  <EmptyState title="Elige una ficha" description="Selecciónala en «Tus hojas» para editar su presentación." />
                ) : loadingDetail || !draft ? (
                  <Spinner />
                ) : (
                  <div className="space-y-2">
                    <p className="font-display text-base font-semibold text-maroon">{selectedDetail.name}</p>

                    {isUpgradeSelected && (
                      <p className="rounded-sm border border-rule-dark/30 bg-parchment/60 px-3 py-2 text-xs text-ink-soft">
                        Es una <b>opción de unidad</b> con ficha propia. Su perfil y sus reglas se editan en{' '}
                        <b>Editor → Equipo y opciones</b>. Aquí puedes verla y exportarla como una ficha más.
                      </p>
                    )}

                    {isMountSelected && (
                      <p className="rounded-sm border border-rule-dark/30 bg-parchment/60 px-3 py-2 text-xs text-ink-soft">
                        Es una <b>montura o dotación</b>. Su perfil y sus reglas se editan en{' '}
                        <b>Editor → Montura/Dotación</b>. Sus reglas especiales solo salen aquí, no en la ficha de quien
                        la lleva.
                      </p>
                    )}

                    <CollapsibleSection
                      title="Imagen"
                      open={isPanelOpen('imagen')}
                      onToggle={() => togglePanel('imagen')}
                    >
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <IconButton icon={<ImageIcon />} onClick={() => illuInputRef.current?.click()} disabled={busy}>
                            {busy ? 'Procesando…' : draft.illuUrl ? 'Cambiar imagen' : 'Elegir imagen'}
                          </IconButton>
                          {draft.illuUrl && (
                            <IconButton icon={<TrashIcon className="h-3.5 w-3.5" />} onClick={handleRemoveIllu} disabled={busy} danger>
                              Quitar
                            </IconButton>
                          )}
                        </div>
                        <input
                          ref={illuInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleIlluFile(e.target.files?.[0])}
                        />
                        <p className="mt-1.5 text-[10.5px] text-ink-soft">
                          Vale cualquier tamaño: la imagen se reduce y se comprime aquí mismo (hasta{' '}
                          {formatBytes(MAX_ILLUSTRATION_BYTES)}) conservando la transparencia.
                        </p>

                        {draft.illuUrl && (
                          <div className="mt-3 space-y-3">
                            <div>
                              <FieldLabel>Tamaño: {draft.illuWidthPct}% del ancho de la ficha</FieldLabel>
                              <input
                                type="range"
                                min={10}
                                max={90}
                                step={2}
                                value={draft.illuWidthPct}
                                onChange={(e) => patchDraft({ illuWidthPct: Number(e.target.value) })}
                                className="w-full accent-bronze"
                              />
                            </div>
                            <div>
                              <FieldLabel>
                                <span className="inline-flex items-center gap-1">
                                  <SunIcon className="h-3.5 w-3.5" /> Brillo: {draft.illuBrightness}%
                                </span>
                              </FieldLabel>
                              <input
                                type="range"
                                min={40}
                                max={180}
                                step={5}
                                value={draft.illuBrightness}
                                onChange={(e) => patchDraft({ illuBrightness: Number(e.target.value) })}
                                className="w-full accent-bronze"
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <IconButton icon={<FlipHorizontalIcon />} onClick={() => patchDraft({ illuFlipped: !draft.illuFlipped })}>
                                Voltear
                              </IconButton>
                              <IconButton icon={<UndoIcon />} onClick={handleIlluResetFraming}>
                                Restablecer encuadre
                              </IconButton>
                            </div>
                            <p className="text-[10.5px] text-ink-soft">
                              Arrastra la imagen desde cualquier punto para colocarla donde quieras — puede salirse por
                              los bordes. Con la imagen enfocada, las flechas del teclado la mueven píxel a píxel
                              (Mayús, de 10 en 10).
                            </p>
                          </div>
                        )}
                      </div>
                    </CollapsibleSection>

                    <CollapsibleSection
                      title="Tarjeta"
                      open={isPanelOpen('tarjeta')}
                      onToggle={() => togglePanel('tarjeta')}
                    >
                      <div>
                        <FieldLabel>Alto máximo: {draft.cardMaxHeight} px</FieldLabel>
                        <input
                          type="range"
                          min={300}
                          max={800}
                          step={10}
                          value={draft.cardMaxHeight}
                          onChange={(e) => patchDraft({ cardMaxHeight: Number(e.target.value) })}
                          className="w-full accent-bronze"
                        />
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <IconButton icon={<UndoIcon />} onClick={() => patchDraft({ cardMaxHeight: 800 })}>
                            Restablecer
                          </IconButton>
                          {draft.cardMaxHeight <= 480 && (
                            <span
                              className="ficha-two-page-badge"
                              title="480 px o menos es una altura orientativa para que dos hojas quepan cómodamente juntas en una misma página al exportar."
                            >
                              ✓ Ideal para 2 hojas por página
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Visibilidad de cada fila de la tabla de características.
                          Vive aquí, en "Tarjeta", porque es una decisión sobre
                          QUÉ enseña la tarjeta, igual que su alto.

                          Ojo / ojo tachado en vez de casillas: aquí no se está
                          marcando una lista, se está encendiendo y apagando lo
                          que se ve, y el icono lo dice sin leer nada. Solo si hay
                          más de una ficha — con una sola, ocultarla dejaría la
                          tabla vacía. */}
                      {allProfileRows.length > 1 && (
                        <div className="border-t border-rule-dark/20 pt-3">
                          <FieldLabel>Fichas de atributos</FieldLabel>
                          <p className="mb-2 text-[10.5px] text-ink-soft">
                            Qué filas de la tabla de características se ven en esta hoja.
                          </p>
                          <div className="space-y-1">
                            {allProfileRows.map((row) => {
                              const visible = !draft.hiddenProfiles.includes(row.key)
                              return (
                                <button
                                  key={row.key}
                                  type="button"
                                  onClick={() => handleProfileVisibility(row.key, !visible)}
                                  aria-pressed={visible}
                                  title={visible ? `Ocultar ${row.label}` : `Mostrar ${row.label}`}
                                  className={clsx(
                                    'flex w-full items-center gap-2 rounded-sm border px-2 py-1 text-left text-xs transition-colors',
                                    visible
                                      ? 'border-rule-dark/30 text-ink hover:border-bronze hover:text-bronze'
                                      : 'border-rule-dark/20 text-ink-soft/70 hover:text-ink-soft',
                                  )}
                                >
                                  {visible ? (
                                    <EyeIcon className="h-3.5 w-3.5 shrink-0" />
                                  ) : (
                                    <EyeOffIcon className="h-3.5 w-3.5 shrink-0" />
                                  )}
                                  <span className={clsx('truncate', !visible && 'line-through')}>{row.label}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </CollapsibleSection>

                    {/* Un ancho por apartado. Solo se ofrecen los que esta
                        ficha tiene de verdad: enseñar "Montura" en una unidad
                        sin montura sería un control que no hace nada. */}
                    <CollapsibleSection
                      title="Ancho de los apartados"
                      open={isPanelOpen('anchos')}
                      onToggle={() => togglePanel('anchos')}
                    >
                      <div>
                        <p className="mb-2 text-[10.5px] text-ink-soft">
                          Estrecha un apartado para dejarle sitio a la ilustración. El texto salta de línea y se justifica
                          con el ancho que le des.
                        </p>
                        <div className="space-y-2">
                          {visibleSections.map((section) => {
                            const pct = sectionWidth(draft.sectionWidths, section)
                            return (
                              <div key={section}>
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-[10.5px] text-ink-soft">{SECTION_LABELS[section]}</span>
                                  <span className="text-[10.5px] text-ink-soft tabular-nums">{pct}%</span>
                                </div>
                                <input
                                  type="range"
                                  min={MIN_SECTION_WIDTH}
                                  max={MAX_SECTION_WIDTH}
                                  step={1}
                                  value={pct}
                                  onChange={(e) =>
                                    patchDraft({
                                      sectionWidths: { ...draft.sectionWidths, [section]: Number(e.target.value) },
                                    })
                                  }
                                  className="w-full accent-bronze"
                                />
                              </div>
                            )
                          })}
                        </div>
                        <div className="mt-1.5">
                          <IconButton icon={<UndoIcon />} onClick={handleSectionWidthsReset}>
                            Restablecer anchos
                          </IconButton>
                        </div>
                      </div>
                    </CollapsibleSection>

                    {/* El id del panel sigue siendo 'escudo' aunque el título
                        diga "Emblema": es la clave con la que localStorage
                        recuerda si está abierto, y cambiarla haría que a quien
                        ya lo tenía abierto se le cerrase sin motivo. */}
                    <CollapsibleSection
                      title="Emblema"
                      open={isPanelOpen('escudo')}
                      onToggle={() => togglePanel('escudo')}
                    >
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <IconButton icon={<ShieldIcon />} onClick={() => emblemInputRef.current?.click()} disabled={busy}>
                            {draft.hasCustomEmblem ? 'Cambiar emblema de esta hoja' : 'Usar otro emblema en esta hoja'}
                          </IconButton>
                          {draft.hasCustomEmblem && (
                            <IconButton icon={<UndoIcon />} onClick={handleEmblemRevert} disabled={busy}>
                              Volver al de la facción
                            </IconButton>
                          )}
                        </div>
                        <input
                          ref={emblemInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleEmblemFile(e.target.files?.[0])}
                        />
                      </div>
                    </CollapsibleSection>
                  </div>
                )}
              </Panel>

              {/* La hoja, y justo debajo la marca de "completada": es un juicio
                  sobre la hoja que se está mirando ("¿la doy por buena?"), así
                  que se decide con ella delante y no en la columna de
                  controles, donde quedaba perdida entre ajustes de
                  presentación. */}
              <div className="flex flex-col items-center gap-3 overflow-auto">
                {selectedDetail && draft ? (
                  <>
                    <UnitSheetCard
                      unit={selectedDetail}
                      sheet={draft}
                      grayscale={grayscale}
                      showFrame={showFrame}
                      editable
                      onIlluDragEnd={(posX, posY) => patchDraft({ illuPosX: posX, illuPosY: posY })}
                    />
                    <label
                      className={clsx(
                        'flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-xs transition-colors',
                        draft.completed
                          ? 'border-success/60 bg-success/10 text-ink'
                          : 'border-rule-dark/40 bg-parchment/70 text-ink-soft hover:border-bronze',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={draft.completed}
                        onChange={(e) => patchDraft({ completed: e.target.checked })}
                        className="accent-emerald-700"
                      />
                      <CheckCircleIcon className={clsx('h-3.5 w-3.5', draft.completed && 'text-success')} />
                      {draft.completed ? 'Hoja completada' : 'Marcar hoja como completada'}
                    </label>
                  </>
                ) : (
                  <EmptyState title="Sin ficha seleccionada" description="La tarjeta aparecerá aquí." />
                )}
              </div>

              <Panel
                title="Tus hojas"
                headerRight={
                  <button
                    type="button"
                    onClick={() => setHideCompleted((v) => !v)}
                    className="flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-maroon"
                    title={hideCompleted ? 'Mostrar hojas completadas' : 'Ocultar hojas completadas'}
                  >
                    {hideCompleted ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                }
              >
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {groups.map((group) => {
                    const open = isGroupOpen(group.title)
                    const visible = group.entries.filter((e) => !(hideCompleted && e.completed))
                    if (visible.length === 0) return null
                    return (
                      <div key={group.title} className="overflow-hidden rounded-sm border border-rule-dark/30">
                        <button
                          onClick={() => toggleGroup(group.title)}
                          aria-expanded={open}
                          className="flex w-full items-center justify-between gap-2 bg-parchment-dark/40 px-2.5 py-1.5 text-left hover:bg-parchment-dark"
                        >
                          <span className="text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">
                            {group.title} <span className="text-ink-soft/70">({visible.length})</span>
                          </span>
                          <span className={clsx('text-sm text-ink-soft transition-transform', open && 'rotate-90')}>›</span>
                        </button>

                        {open && (
                          <div className="space-y-1 p-1.5">
                            {visible.map((entry) => (
                              <div
                                key={entry.key}
                                onClick={() => {
                                  if (entry.key === selectedKey) return
                                  guarded(() => openSheet(entry.key))
                                }}
                                className={clsx(
                                  'flex cursor-pointer items-center gap-2 rounded-sm border px-2 py-1.5 text-xs transition-colors',
                                  entry.key === selectedKey
                                    ? 'border-maroon bg-bronze/10'
                                    : 'border-rule-dark/30 hover:bg-parchment-dark/50',
                                  entry.completed && 'border-success',
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={exportChecks.has(entry.key)}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => toggleExportCheck(entry.key)}
                                  title="Incluir esta hoja al exportar"
                                />
                                <span className="flex-1 truncate text-ink">{entry.name}</span>
                                {entry.key === selectedKey && dirty && (
                                  <span className="shrink-0 text-[10px] font-semibold text-maroon" title="Cambios sin guardar">
                                    ●
                                  </span>
                                )}
                                {entry.completed && <CheckCircleIcon className="h-3.5 w-3.5 shrink-0 text-success" />}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setExportChecks(new Set(groups.flatMap((g) => g.entries.map((e) => e.key))))}
                  >
                    Marcar todas
                  </Button>
                  <Button variant="ghost" onClick={() => setExportChecks(new Set())}>
                    Desmarcar todas
                  </Button>
                  <Button variant="ghost" onClick={() => setOpenGroups(new Set())}>
                    Cerrar todo
                  </Button>
                  <Button variant="ghost" onClick={() => setOpenGroups(new Set(groups.map((g) => g.title)))}>
                    Abrir todo
                  </Button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="primary" className="justify-center" onClick={handleExportPng} disabled={runningExport !== null}>
                    <DownloadIcon className="h-3.5 w-3.5" />
                    {runningExport === 'png' ? 'Generando…' : 'PNG'}
                  </Button>
                  <Button variant="secondary" className="justify-center" onClick={handleExportWordText} disabled={runningExport !== null}>
                    <DownloadIcon className="h-3.5 w-3.5" />
                    {runningExport === 'word-texto' ? 'Generando…' : 'Word texto'}
                  </Button>
                  <Button variant="secondary" className="justify-center" onClick={handleExportWordImages} disabled={runningExport !== null}>
                    <DownloadIcon className="h-3.5 w-3.5" />
                    {runningExport === 'word-imagenes' ? 'Generando…' : 'Word imág.'}
                  </Button>
                  <Button variant="secondary" className="justify-center" onClick={handleExportReference} disabled={runningExport !== null}>
                    <DownloadIcon className="h-3.5 w-3.5" />
                    {runningExport === 'referencia' ? 'Generando…' : 'Hoja ref.'}
                  </Button>
                </div>
                {exportError && <p className="mt-1 text-xs text-danger">{exportError}</p>}
              </Panel>
            </div>
          </div>
        </div>
      )}

      {showUnsavedDialog && (
        <UnsavedChangesDialog
          saving={saving}
          onSaveAndLeave={handleDialogSaveAndLeave}
          onDiscardAndLeave={handleDialogDiscardAndLeave}
          onKeepEditing={handleDialogKeepEditing}
        />
      )}
    </div>
  )
}
