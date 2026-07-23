import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { ArmyListRepository } from '@/data/repositories/armyListRepository'
import { UnitRepository } from '@/data/repositories/unitRepository'
import { EquipmentRepository, UpgradeRepository } from '@/data/repositories/lookupRepositories'
import { useVisibleFactions } from '@/shared/session/useVisibleFactions'
import { useSession } from '@/shared/session/useSession'
import { UserRepository } from '@/data/repositories/userRepository'
import {
  computeCategoryInsertIndex,
  computeEntryCost,
  computeListTotal,
  reconcileEntries,
  validateEntryInput,
  validateList,
  type EntryReconcileNote,
} from '@/domain/armyValidation'
import { formatArmorSave, mergeSpecialRules } from '@/domain/unitFormat'
import type { ArmyListEntry, ArmyListEntryInput, UnitDetail } from '@/domain/types'
import { useAsync } from '@/shared/hooks/useAsync'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Panel } from '@/shared/ui/Panel'
import { Badge } from '@/shared/ui/Badge'
import { FactionEmblem } from '@/shared/ui/FactionEmblem'
import { Spinner } from '@/shared/ui/Spinner'
import { Tooltip } from '@/shared/ui/Tooltip'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { Select } from '@/shared/ui/Select'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import {
  TrashIcon,
  DragHandleIcon,
  BannerIcon,
  HornIcon,
  SwordIcon,
  CheckIcon,
  CategoryShield,
  WarningIcon,
  type ShieldMetal,
} from '@/shared/ui/icons'
import { AttributeTable } from '@/shared/ui/AttributeTable'
import { ArmyListSettingsModal } from '@/features/army-lists/ArmyListSettingsModal'
import { UnsavedChangesDialog } from '@/shared/ui/UnsavedChangesDialog'

const SIN_CATEGORIA_KEY = 'Sin categoría'

/**
 * Escudo metálico por categoría en la lista de ejército: oro las Singulares,
 * bronce las Básicas y plata las Especiales. Los personajes no llevan escudo
 * (decisión del usuario), y tampoco las categorías sin metal asignado —
 * devolver null es lo correcto ahí, no inventarles uno.
 */
function categoryShieldMetal(categoryCode: string | null | undefined): ShieldMetal | null {
  switch (categoryCode) {
    case 'SINGULAR':
      return 'oro'
    case 'BASICA':
      return 'bronce'
    case 'ESPECIAL':
      return 'plata'
    default:
      return null
  }
}

/**
 * Las tres columnas del grupo de mando. Se declaran una sola vez y se recorren
 * tanto en la cabecera como en cada fila: así el icono de arriba y el check de
 * abajo comparten columna por construcción y no se pueden desalinear.
 */
const COMMAND_COLUMNS: Array<{
  key: string
  label: string
  Icon: (props: { className?: string }) => ReactNode
  has: (entry: ArmyListEntry) => boolean
}> = [
  { key: 'estandarte', label: 'Portaestandarte', Icon: BannerIcon, has: (e) => e.hasStandardBearer },
  { key: 'musico', label: 'Músico', Icon: HornIcon, has: (e) => e.hasMusician },
  { key: 'campeon', label: 'Campeón', Icon: SwordIcon, has: (e) => e.hasChampion },
]

/**
 * Lista directa de opciones (equipo/mejoras) como casillas, en vez del
 * buscador RelationEditor: en el constructor las opciones de cada unidad son
 * pocas, así que se muestran todas de un vistazo y se marcan directamente. Una
 * opción incompatible con otra ya elegida sale deshabilitada con el motivo.
 */
function OptionCheckList({
  items,
  selected,
  onToggle,
  getDisabledReason,
}: {
  items: Array<{ id: number; name: string; cost: number }>
  selected: Set<number>
  onToggle: (id: number, enabled: boolean) => void
  getDisabledReason?: (item: { id: number; name: string }) => string | null
}) {
  if (items.length === 0) return <p className="text-xs italic text-ink-soft">Ninguna.</p>
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((it) => {
        const checked = selected.has(it.id)
        const reason = getDisabledReason?.(it) ?? null
        const disabled = reason != null && !checked
        return (
          <label
            key={it.id}
            title={reason ?? undefined}
            className={clsx('flex items-center gap-2 text-xs', disabled ? 'text-ink-soft/50' : 'text-ink')}
          >
            <input
              type="checkbox"
              className="accent-maroon"
              checked={checked}
              disabled={disabled}
              onChange={(e) => onToggle(it.id, e.target.checked)}
            />
            <span>
              {it.name}
              {it.cost ? <span className="text-ink-soft"> (+{it.cost} pts)</span> : null}
              {disabled && reason ? <span className="italic text-ink-soft/70"> — {reason}</span> : null}
            </span>
          </label>
        )
      })}
    </div>
  )
}

/** Una montura/carro con coste (ver unit_profiles.cost) nunca se auto-selecciona en silencio, aunque sea la única opción — el jugador tiene que elegirla a propósito, ya que cuesta puntos extra. */
function hasCost(p: { cost: number | null }): boolean {
  return (p.cost ?? 0) > 0
}

interface EntryDraft {
  editingEntryId: number | null
  unitId: number | null
  quantity: number
  equipmentIds: Set<number>
  upgradeIds: Set<number>
  hasStandardBearer: boolean
  hasMusician: boolean
  hasChampion: boolean
  mountProfileId: number | null
  chariotProfileId: number | null
}

const EMPTY_DRAFT: EntryDraft = {
  editingEntryId: null,
  unitId: null,
  quantity: 1,
  equipmentIds: new Set(),
  upgradeIds: new Set(),
  hasStandardBearer: false,
  hasMusician: false,
  hasChampion: false,
  mountProfileId: null,
  chariotProfileId: null,
}

/**
 * Constructor de listas. Modelo "borrador en memoria": mientras se añaden,
 * editan, quitan o reordenan unidades NO se toca la red — todo vive en el
 * estado local `entries`. Antes cada una de esas acciones era una escritura al
 * Worker + una recarga completa de la lista, lo que hacía que añadir unidades
 * fuera lento. Ahora solo se persiste al pulsar "Guardar ejército"
 * (ArmyListRepository.replaceAllEntries, que sustituye la lista entera de una
 * vez), y si el usuario intenta salir con cambios sin guardar se le avisa
 * (useBlocker + beforeunload), pudiendo guardar, descartar o seguir editando.
 */
export function ArmyListBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const listId = Number(id)
  const navigate = useNavigate()

  const { data: list, loading, error } = useAsync(() => ArmyListRepository.getDetailById(listId), [listId])
  // A diferencia de la ficha de unidad (donde monturas/carros sí quedan
  // restringidos a la facción propia), el constructor de listas permite
  // combinar unidades de cualquier facción en una misma lista: se cargan
  // TODAS las unidades una vez y se filtran en el navegador de abajo por la
  // facción que el usuario elija en cada momento, no por list.factionId (que
  // ahora es solo la "facción principal" de la lista, a efectos de nombre y
  // cabecera del PDF).
  const { data: allUnits } = useAsync(() => UnitRepository.listAll(), [])
  // Solo las facciones que el usuario quiere ver (en modo admin, todas).
  const { factions } = useVisibleFactions()
  const { user } = useSession()
  const { data: incompatiblePairs } = useAsync(() => EquipmentRepository.listIncompatibilities())
  const { data: upgradeIncompatiblePairs } = useAsync(() => UpgradeRepository.listIncompatibilities())

  // --- Estado editable local (el "borrador") ---------------------------------
  // `entries` es la fuente de verdad de la pantalla mientras se edita; se
  // siembra desde la lista cargada y NO se vuelve a tocar la red hasta Guardar.
  const [entries, setEntries] = useState<ArmyListEntry[] | null>(null)
  const [name, setName] = useState('')
  const [pointsLimit, setPointsLimit] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [savingList, setSavingList] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Ids provisionales (negativos) para las entradas nuevas aún sin guardar: solo
  // sirven como clave de React y para arrastrar/editar/quitar; nunca llegan a la
  // BBDD (replaceAllEntries asigna ids reales). Ver ArmyListRepository.
  const tempIdRef = useRef(-1)

  const [draft, setDraft] = useState<EntryDraft>(EMPTY_DRAFT)
  const [selectedUnit, setSelectedUnit] = useState<UnitDetail | null>(null)
  const [loadingUnit, setLoadingUnit] = useState(false)
  // El plegado de "Reglas especiales" se recuerda mientras dure la sesión (no
  // por unidad): es una preferencia de cuánto quieres ver, no un dato. Abierto
  // por defecto para no esconder información sin que se pida.
  const [rulesOpen, setRulesOpen] = useState(true)
  // Reglas destacadas del usuario para la facción de la unidad seleccionada.
  // Se recargan al cambiar de unidad (su facción puede cambiar).
  const [destacadaIds, setDestacadaIds] = useState<Set<number>>(new Set())
  const [entryIssues, setEntryIssues] = useState<string[]>([])
  const [editingSettings, setEditingSettings] = useState(false)
  const [deletingEntry, setDeletingEntry] = useState<ArmyListEntry | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [browseFactionId, setBrowseFactionId] = useState<number | null>(null)
  const [browseCategory, setBrowseCategory] = useState<string | null>(null)
  const [unitSearch, setUnitSearch] = useState('')

  // Arrastrar y soltar para reordenar "Unidades en la lista" (mismo patrón que
  // UnitsListPage.tsx). Declarados aquí arriba, ANTES de los `return`
  // anticipados de carga/error de más abajo: los Hooks no pueden depender de
  // una condición (regla de los Hooks de React).
  const dragEntryId = useRef<number | null>(null)
  const [dragOverEntryId, setDragOverEntryId] = useState<number | null>(null)

  /**
   * Entradas que el catálogo ha dejado tocadas al abrir la lista (opciones
   * borradas o incompatibilidades nuevas) — ver reconcileEntries. Se muestran
   * como aviso arriba y marcan la entrada en la lista.
   */
  const [reconcileNotes, setReconcileNotes] = useState<EntryReconcileNote[]>([])
  /**
   * Entradas cuyas opciones se han desmarcado y siguen pendientes de reelegir.
   * Va aparte de `reconcileNotes` a propósito: el aviso de arriba se puede
   * descartar, pero la marca ⚠ de la entrada debe seguir hasta que el usuario
   * la revise de verdad.
   */
  const [needsReviewIds, setNeedsReviewIds] = useState<Set<number>>(new Set())
  const reconciledListId = useRef<number | null>(null)

  // Siembra el borrador local desde la lista recién cargada (una sola vez por
  // carga; como ya no se recarga tras cada acción, esto corre al abrir).
  //
  // Espera además a tener los pares de incompatibilidad para RECONCILIAR la
  // lista contra el catálogo actual: entre que se guardó y se vuelve a abrir,
  // el editor ha podido borrar opciones o declarar incompatibilidades nuevas.
  // Sin esto, una lista guardada se queda en un estado hoy ilegal y en
  // silencio, porque validateEntryInput solo corre al guardar una entrada.
  useEffect(() => {
    if (!list || !incompatiblePairs || !upgradeIncompatiblePairs) return
    if (reconciledListId.current === list.id) return
    reconciledListId.current = list.id

    const { entries: reconciled, notes, changed } = reconcileEntries(
      list.entries,
      incompatiblePairs,
      upgradeIncompatiblePairs,
    )
    setEntries(reconciled)
    setName(list.name)
    setPointsLimit(list.pointsLimit)
    setReconcileNotes(notes)
    setNeedsReviewIds(new Set(notes.filter((n) => n.conflicts.length > 0).map((n) => n.entryId)))
    // Si algo ha cambiado, el borrador ya no coincide con lo guardado: se
    // marca sucio para que el usuario reelija y guarde (y para que el aviso de
    // salir sin guardar lo proteja).
    setDirty(changed)
  }, [list, incompatiblePairs, upgradeIncompatiblePairs])

  // Avisa de cambios sin guardar al navegar dentro de la app (data router)…
  const blocker = useBlocker(dirty)
  // …y al cerrar/recargar la pestaña (useBlocker no cubre eso).
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

  // Reglas destacadas del usuario para la facción de la unidad que se está
  // viendo. Se cargan aquí y no en handlePickUnit porque también hay que
  // recargarlas al editar una entrada existente (startEditEntry) y al cambiar
  // de usuario — un único efecto cubre los tres casos.
  //
  // IMPORTANTE: este efecto va ANTES de los `return` anticipados de más abajo
  // (carga/privacidad/error) a propósito — los Hooks de React deben correr en
  // el mismo orden en TODOS los renders, y esos `return` solo se alcanzan
  // después de que la lista termine de cargar.
  const selectedFactionId = selectedUnit?.faction.id
  useEffect(() => {
    if (!user || selectedFactionId == null) {
      setDestacadaIds(new Set())
      return
    }
    let cancelled = false
    void UserRepository.getFactionRuleIds(user.id, selectedFactionId).then((ids) => {
      if (!cancelled) setDestacadaIds(new Set(ids))
    })
    return () => {
      cancelled = true
    }
  }, [user, selectedFactionId])

  if (loading) return <Spinner />

  // Los ejércitos son privados: si la lista tiene dueño y no eres tú, no se
  // abre aunque llegues por un enlace directo.
  if (list && list.userId != null && user && list.userId !== user.id) {
    return (
      <div>
        <button onClick={() => navigate('/ejercitos')} className="mb-3 text-sm text-ink-soft hover:text-ink">
          ← Volver a Ejércitos
        </button>
        <div className="rounded-sm border border-rule-dark/40 bg-parchment/70 px-4 py-3">
          <p className="text-sm text-ink">Este ejército es de otro usuario.</p>
          <p className="mt-1 text-xs text-ink-soft">Cada usuario solo puede abrir sus propias listas.</p>
        </div>
      </div>
    )
  }

  if (error || !list) {
    return (
      <div>
        <button onClick={() => navigate('/ejercitos')} className="mb-3 text-sm text-ink-soft hover:text-ink">
          ← Volver a Ejércitos
        </button>
        <div className="rounded-sm border border-danger-dark/40 bg-danger-dark/10 px-4 py-3">
          <p className="text-sm font-medium text-danger-dark">No se pudo cargar esta lista.</p>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
      </div>
    )
  }

  const currentEntries = entries ?? list.entries
  const total = computeListTotal(currentEntries)
  const listIssues = validateList(currentEntries, pointsLimit)
  const overPoints = pointsLimit != null && total > pointsLimit

  const effectiveFactionId = browseFactionId ?? list.factionId
  // Solo unidades ACTIVAS: las desactivadas en Administración no se ofrecen al
  // montar el ejército (ver units.active / UnitsListPage).
  const unitsForFaction = (allUnits ?? []).filter((u) => u.factionId === effectiveFactionId && u.active)
  const categoryNames: string[] = []
  for (const u of unitsForFaction) {
    const key = u.categoryName ?? SIN_CATEGORIA_KEY
    if (!categoryNames.includes(key)) categoryNames.push(key)
  }
  const effectiveCategory = browseCategory != null && categoryNames.includes(browseCategory) ? browseCategory : (categoryNames[0] ?? null)
  const searchLower = unitSearch.trim().toLowerCase()
  const unitsInCategory = unitsForFaction.filter(
    (u) =>
      (u.categoryName ?? SIN_CATEGORIA_KEY) === effectiveCategory &&
      (searchLower === '' || u.name.toLowerCase().includes(searchLower)),
  )

  async function handlePickUnit(unitId: number | null) {
    if (!unitId) {
      setSelectedUnit(null)
      setDraft(EMPTY_DRAFT)
      return
    }
    setLoadingUnit(true)
    const detail = await UnitRepository.getDetailById(unitId)
    setLoadingUnit(false)
    setSelectedUnit(detail)
    if (!detail) return
    setDraft({
      editingEntryId: null,
      unitId,
      // Un personaje siempre es 1 sola miniatura: el campo "cantidad" ni
      // siquiera se muestra en su formulario (ver optionsForm más abajo). Una
      // unidad 0-1 SÍ tiene tamaño normal (el 0-1 limita cuántas unidades de
      // ese tipo caben en el ejército, no cuántas miniaturas la forman), así
      // que arranca en su tamaño habitual como cualquier otro regimiento.
      quantity: detail.unitType === 'personaje' ? 1 : detail.defaultSize ?? detail.minSize ?? 1,
      // Equipo/opciones marcadas como "por defecto" desde Administración
      // (unit_equipment_options.is_default / unit_upgrade_options.is_default)
      // vienen ya seleccionadas, para no tener que marcarlas cada vez.
      equipmentIds: new Set(detail.equipmentOptions.filter((e) => e.isDefault).map((e) => e.id)),
      upgradeIds: new Set(detail.upgradeOptions.filter((u) => u.isDefault).map((u) => u.id)),
      // El grupo de mando entero viene marcado por defecto (el usuario
      // desmarca lo que no quiera en vez de tener que marcarlo todo).
      hasStandardBearer: detail.commandOptions.some((o) => o.role.code === 'PORTAESTANDARTE'),
      hasMusician: detail.commandOptions.some((o) => o.role.code === 'MUSICO'),
      hasChampion: detail.commandOptions.some((o) => o.role.code === 'CAMPEON'),
      // Si hay una única opción y es gratis, se auto-selecciona igual que
      // siempre; si tiene coste, el jugador tiene que elegirla a propósito
      // (ver el Select más abajo, que en ese caso se muestra igualmente en
      // vez de ocultarse).
      mountProfileId:
        detail.profiles.montura.length === 1 && !hasCost(detail.profiles.montura[0])
          ? detail.profiles.montura[0].id
          : null,
      chariotProfileId:
        detail.profiles.carro.length === 1 && !hasCost(detail.profiles.carro[0])
          ? detail.profiles.carro[0].id
          : null,
    })
    setEntryIssues([])
  }

  function startEditEntry(entry: ArmyListEntry) {
    setSelectedUnit(entry.unit)
    setDraft({
      editingEntryId: entry.id,
      unitId: entry.unit.id,
      quantity: entry.unit.unitType === 'personaje' ? 1 : entry.quantity,
      equipmentIds: new Set(entry.equipmentIds),
      upgradeIds: new Set(entry.upgradeIds),
      hasStandardBearer: entry.hasStandardBearer,
      hasMusician: entry.hasMusician,
      hasChampion: entry.hasChampion,
      mountProfileId: entry.mountProfileId,
      chariotProfileId: entry.chariotProfileId,
    })
    setEntryIssues([])
  }

  function cancelEdit() {
    setSelectedUnit(null)
    setDraft(EMPTY_DRAFT)
    setEntryIssues([])
  }

  /** Añade o actualiza una entrada EN EL BORRADOR LOCAL (sin tocar la red). Se persiste al pulsar "Guardar ejército". */
  function handleSaveEntry() {
    if (!list || !selectedUnit || !draft.unitId) return
    const input: ArmyListEntryInput = {
      unitId: draft.unitId,
      quantity: selectedUnit.unitType === 'personaje' ? 1 : draft.quantity,
      mountProfileId: draft.mountProfileId,
      chariotProfileId: draft.chariotProfileId,
      hasStandardBearer: draft.hasStandardBearer,
      hasMusician: draft.hasMusician,
      hasChampion: draft.hasChampion,
      // El nombre del Campeón ya viene definido en la ficha de la unidad
      // (Administración > Unidades > Grupo de mando); aquí no se puede
      // sobrescribir, así que siempre se guarda null (= "usa el nombre de
      // la ficha").
      championName: null,
      equipmentIds: [...draft.equipmentIds],
      upgradeIds: [...draft.upgradeIds],
    }

    const issues = validateEntryInput(
      selectedUnit,
      { quantity: draft.quantity, equipmentIds: input.equipmentIds, upgradeIds: input.upgradeIds },
      incompatiblePairs ?? [],
      currentEntries,
      draft.editingEntryId ?? undefined,
      upgradeIncompatiblePairs ?? [],
    )
    const blocking = issues.filter((i) => i.severity === 'error')
    if (blocking.length > 0) {
      setEntryIssues(blocking.map((i) => i.message))
      return
    }
    setEntryIssues([])

    const entryObj: ArmyListEntry = {
      id: draft.editingEntryId ?? tempIdRef.current--,
      armyListId: list.id,
      unit: selectedUnit,
      quantity: input.quantity,
      mountProfileId: input.mountProfileId,
      chariotProfileId: input.chariotProfileId,
      hasStandardBearer: input.hasStandardBearer,
      hasMusician: input.hasMusician,
      hasChampion: input.hasChampion,
      championName: null,
      sortOrder: 0,
      equipmentIds: input.equipmentIds,
      upgradeIds: input.upgradeIds,
    }

    if (draft.editingEntryId) {
      setEntries(currentEntries.map((e) => (e.id === draft.editingEntryId ? entryObj : e)))
      // Ya se ha revisado: se retira la marca ⚠ de "pendiente de reelegir".
      setNeedsReviewIds((ids) => {
        if (!ids.has(draft.editingEntryId as number)) return ids
        const next = new Set(ids)
        next.delete(draft.editingEntryId as number)
        return next
      })
    } else {
      // Coloca la entrada nueva junto a las de su misma categoría (Personajes,
      // Básicas, Especiales, Singulares, resto), como hacía antes el servidor.
      const insertIndex = computeCategoryInsertIndex(
        currentEntries.map((e) => ({ unit: { category: e.unit.category } })),
        { category: selectedUnit.category },
      )
      const next = currentEntries.slice()
      next.splice(insertIndex, 0, entryObj)
      setEntries(next)
    }
    setDirty(true)
    cancelEdit()
  }

  /** Quita una entrada del borrador local. */
  function handleRemoveEntry(entry: ArmyListEntry) {
    setEntries(currentEntries.filter((e) => e.id !== entry.id))
    if (draft.editingEntryId === entry.id) cancelEdit()
    setDeletingEntry(null)
    setDirty(true)
  }

  /** Arrastrar y soltar: suelta la fila arrastrada justo donde está `targetEntryId` (solo estado local). */
  function handleDropEntry(targetEntryId: number) {
    const draggedId = dragEntryId.current
    dragEntryId.current = null
    setDragOverEntryId(null)
    if (draggedId == null || draggedId === targetEntryId) return
    const ids = currentEntries.map((e) => e.id)
    const from = ids.indexOf(draggedId)
    const to = ids.indexOf(targetEntryId)
    if (from === -1 || to === -1) return
    const next = currentEntries.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setEntries(next)
    setDirty(true)
  }

  /** Persiste TODO el borrador de una vez (botón "Guardar ejército"). Devuelve true si se guardó bien. */
  async function handleSaveList(): Promise<boolean> {
    if (!list) return false
    setSavingList(true)
    setSaveError(null)
    try {
      const inputs: ArmyListEntryInput[] = currentEntries.map((e) => ({
        unitId: e.unit.id,
        quantity: e.quantity,
        mountProfileId: e.mountProfileId,
        chariotProfileId: e.chariotProfileId,
        hasStandardBearer: e.hasStandardBearer,
        hasMusician: e.hasMusician,
        hasChampion: e.hasChampion,
        championName: e.championName,
        equipmentIds: e.equipmentIds,
        upgradeIds: e.upgradeIds,
      }))
      await ArmyListRepository.replaceAllEntries(list.id, inputs)
      setDirty(false)
      return true
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setSavingList(false)
    }
  }

  async function handleExportPdf() {
    if (!list) return
    setExportingPdf(true)
    try {
      // Import perezoso: jsPDF + jspdf-autotable solo hacen falta cuando de
      // verdad se exporta un PDF, así que van en su propio chunk en vez de
      // engordar el bundle inicial de toda la app.
      const { exportArmyListToPdf } = await import('@/features/army-lists/exportArmyListPdf')
      await exportArmyListToPdf({ ...list, name, pointsLimit, entries: currentEntries }, total)
    } finally {
      setExportingPdf(false)
    }
  }

  const commandRoleAvailable = {
    portaestandarte: selectedUnit?.commandOptions.find((o) => o.role.code === 'PORTAESTANDARTE') ?? null,
    musico: selectedUnit?.commandOptions.find((o) => o.role.code === 'MUSICO') ?? null,
    campeon: selectedUnit?.commandOptions.find((o) => o.role.code === 'CAMPEON') ?? null,
  }
  const campeonName = commandRoleAvailable.campeon
    ? (commandRoleAvailable.campeon.customName ?? commandRoleAvailable.campeon.role.name)
    : null

  const equipmentItems = (selectedUnit?.equipmentOptions ?? []).map((e) => ({ id: e.id, name: e.name, cost: e.cost }))
  const upgradeItems = (selectedUnit?.upgradeOptions ?? []).map((u) => ({ id: u.id, name: u.name, cost: u.cost }))

  /**
   * Para cada pieza de equipo TODAVÍA NO seleccionada, dice si entra en
   * conflicto con alguna ya elegida (mismo hueco sin excepción conocida —
   * ver equipment_incompatibilities/8 en ARCHITECTURE.md) y con cuál, para
   * poder deshabilitarla directamente en el buscador en vez de dejar
   * seleccionar piezas incompatibles y descubrirlo solo al guardar.
   */
  function equipmentDisabledReason(item: { id: number; name: string }): string | null {
    for (const [a, b] of incompatiblePairs ?? []) {
      const otherId = a === item.id ? b : b === item.id ? a : null
      if (otherId != null && draft.equipmentIds.has(otherId)) {
        const other = equipmentItems.find((e) => e.id === otherId)
        return `Incompatible con ${other?.name ?? 'otra pieza ya elegida'}`
      }
    }
    return null
  }

  /** Igual que equipmentDisabledReason, pero para "Opciones de unidad" (mejoras) — p.ej. las runas de los Golems: solo una a la vez. */
  function upgradeDisabledReason(item: { id: number; name: string }): string | null {
    for (const [a, b] of upgradeIncompatiblePairs ?? []) {
      const otherId = a === item.id ? b : b === item.id ? a : null
      if (otherId != null && draft.upgradeIds.has(otherId)) {
        const other = upgradeItems.find((u) => u.id === otherId)
        return `Incompatible con ${other?.name ?? 'otra opción ya elegida'}`
      }
    }
    return null
  }

  // Formulario de opciones de la entrada (cantidad, equipo, montura/carro,
  // grupo de mando...) — se reutiliza igual tanto dentro de la tarjeta
  // desplegada de una unidad al añadir, como en el panel "Editar entrada".
  // El "0-1" no toca el tamaño: una unidad 0-1 es un regimiento normal (casi
  // siempre de varias miniaturas) del que solo cabe UNO en el ejército. Su
  // límite de cantidad es, por tanto, el max_size de su ficha como el de
  // cualquier otra unidad.
  const effectiveMaxSize = selectedUnit?.maxSize ?? undefined

  // Un personaje nunca lleva "cantidad" (siempre es 1 sola miniatura, ver
  // handlePickUnit/startEditEntry/handleSaveEntry más arriba): el campo ni
  // siquiera se muestra, sería un dato redundante para el jugador.
  const isPersonaje = selectedUnit?.unitType === 'personaje'

  // Reglas que se muestran en el panel "Ficha": las propias de la unidad más
  // las que aporta la montura ELEGIDA para esta entrada. Una montura no
  // seleccionada todavía no forma parte de la unidad, así que sus reglas no
  // deben aparecer — sería prometer un "Vuela" que la unidad no tiene.
  const reglasBrutas = selectedUnit
    ? mergeSpecialRules(
        selectedUnit.specialRules,
        selectedUnit.profiles.montura.find((p) => p.id === draft.mountProfileId)?.specialRules ?? [],
      )
    : []
  // Las DESTACADAS por el usuario para esta facción van primero (conservando su
  // orden), después el resto. `destacadasCount` marca dónde pintar el filete
  // que las separa. Solo cuentan las que la unidad lleva de verdad: destacar
  // "Odio" no lo añade a una unidad que no lo tiene.
  const reglasDestacadas = reglasBrutas.filter((r) => destacadaIds.has(r.id))
  const reglasResto = reglasBrutas.filter((r) => !destacadaIds.has(r.id))
  const reglasVisibles = [...reglasDestacadas, ...reglasResto]
  const destacadasCount = reglasDestacadas.length

  const optionsForm = selectedUnit && !loadingUnit && (
    <div className="mt-4 space-y-4">
      {/* El 0-1 ya no se explica aquí con una frase: se marca con el distintivo
          que acompaña al nombre de la unidad (ver más arriba), igual que en
          Editor > Unidades y personajes. Esta línea es solo el TAMAÑO, que es
          otra cosa: cuántas miniaturas forman la unidad. */}
      {!isPersonaje && (selectedUnit.minSize != null || selectedUnit.maxSize != null) && (
        <p className="text-xs text-ink-soft">
          Tamaño: {selectedUnit.minSize ?? 0} a {selectedUnit.maxSize ?? 'sin límite'} miniaturas.
        </p>
      )}

      {!isPersonaje && (
        <div className="w-24">
          <TextField
            label="Cantidad"
            type="number"
            min={0}
            max={effectiveMaxSize}
            value={draft.quantity}
            onChange={(e) => {
              const raw = e.target.value
              const parsed = raw === '' ? 0 : Number(raw)
              let next = Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
              // Si se escribe un número mayor que el tamaño máximo de la
              // unidad, se ajusta solo al máximo en vez de dejar guardar (y
              // luego fallar en validación) o dejar un número imposible en el
              // campo.
              if (effectiveMaxSize != null && next > effectiveMaxSize) next = effectiveMaxSize
              setDraft((d) => ({ ...d, quantity: next }))
            }}
          />
        </div>
      )}

      {equipmentItems.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Equipo</p>
          <OptionCheckList
            items={equipmentItems}
            selected={draft.equipmentIds}
            onToggle={(otherId, enabled) =>
              setDraft((d) => {
                const next = new Set(d.equipmentIds)
                if (enabled) next.add(otherId)
                else next.delete(otherId)
                return { ...d, equipmentIds: next }
              })
            }
            getDisabledReason={equipmentDisabledReason}
          />
        </div>
      )}

      {upgradeItems.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Opciones de unidad</p>
          <OptionCheckList
            items={upgradeItems}
            selected={draft.upgradeIds}
            onToggle={(otherId, enabled) =>
              setDraft((d) => {
                const next = new Set(d.upgradeIds)
                if (enabled) next.add(otherId)
                else next.delete(otherId)
                return { ...d, upgradeIds: next }
              })
            }
            getDisabledReason={upgradeDisabledReason}
          />
        </div>
      )}

      {/* El desplegable se muestra si hay más de una opción, o si la única
          opción tiene coste (en ese caso el jugador tiene que poder elegir
          "Sin montura" en vez de que se le cargue el coste en silencio). */}
      {(selectedUnit.profiles.montura.length > 1 ||
        (selectedUnit.profiles.montura.length === 1 && hasCost(selectedUnit.profiles.montura[0]))) && (
        <Select
          label="Montura/Dotación"
          value={draft.mountProfileId ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, mountProfileId: e.target.value ? Number(e.target.value) : null }))}
        >
          <option value="">Sin montura</option>
          {selectedUnit.profiles.montura.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {hasCost(p) ? ` (+${p.cost} pts)` : ''}
            </option>
          ))}
        </Select>
      )}

      {(selectedUnit.profiles.carro.length > 1 ||
        (selectedUnit.profiles.carro.length === 1 && hasCost(selectedUnit.profiles.carro[0]))) && (
        <Select
          label="Carro"
          value={draft.chariotProfileId ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, chariotProfileId: e.target.value ? Number(e.target.value) : null }))}
        >
          <option value="">Sin carro</option>
          {selectedUnit.profiles.carro.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {hasCost(p) ? ` (+${p.cost} pts)` : ''}
            </option>
          ))}
        </Select>
      )}

      {(commandRoleAvailable.portaestandarte || commandRoleAvailable.musico || commandRoleAvailable.campeon) && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Grupo de mando</p>
          <div className="flex flex-nowrap items-center gap-4 overflow-x-auto">
            {commandRoleAvailable.portaestandarte && (
              <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-ink-soft">
                <input
                  type="checkbox"
                  className="accent-maroon"
                  checked={draft.hasStandardBearer}
                  onChange={(e) => setDraft((d) => ({ ...d, hasStandardBearer: e.target.checked }))}
                />
                Portaestandarte (+{commandRoleAvailable.portaestandarte.cost} pts)
              </label>
            )}
            {commandRoleAvailable.musico && (
              <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-ink-soft">
                <input
                  type="checkbox"
                  className="accent-maroon"
                  checked={draft.hasMusician}
                  onChange={(e) => setDraft((d) => ({ ...d, hasMusician: e.target.checked }))}
                />
                Músico (+{commandRoleAvailable.musico.cost} pts)
              </label>
            )}
            {commandRoleAvailable.campeon && (
              <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-ink-soft">
                <input
                  type="checkbox"
                  className="accent-maroon"
                  checked={draft.hasChampion}
                  onChange={(e) => setDraft((d) => ({ ...d, hasChampion: e.target.checked }))}
                />
                {campeonName ?? 'Campeón'} (+{commandRoleAvailable.campeon.cost} pts)
              </label>
            )}
          </div>
        </div>
      )}

      {entryIssues.length > 0 && (
        <div className="rounded-sm border border-danger-dark/40 bg-danger-dark/10 px-3 py-2">
          {entryIssues.map((msg) => (
            <p key={msg} className="text-xs text-danger-dark">
              {msg}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={handleSaveEntry}>
          {draft.editingEntryId
            ? 'Guardar cambios'
            : `+ Añadir a la lista (${computeEntryCost(selectedUnit, {
                quantity: draft.quantity,
                equipmentIds: [...draft.equipmentIds],
                upgradeIds: [...draft.upgradeIds],
                hasStandardBearer: draft.hasStandardBearer,
                hasMusician: draft.hasMusician,
                hasChampion: draft.hasChampion,
                mountProfileId: draft.mountProfileId,
                chariotProfileId: draft.chariotProfileId,
              })} pts)`}
        </Button>
        {draft.editingEntryId && (
          <button onClick={cancelEdit} className="text-xs font-medium text-ink-soft hover:text-ink">
            Cancelar edición
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div>
      <button onClick={() => navigate('/ejercitos')} className="mb-3 text-sm text-ink-soft hover:text-ink">
        ← Volver a Ejércitos
      </button>

      <PageHeader
        title={name}
        description={`Facción principal: ${list.faction.name}${pointsLimit != null ? ` · límite ${pointsLimit} pts` : ' · sin límite de puntos'}`}
        actions={
          <div className="flex items-center gap-3">
            {dirty && <span className="text-xs font-medium text-bronze">● Cambios sin guardar</span>}
            <Button variant="ghost" onClick={() => setEditingSettings(true)}>
              Editar lista
            </Button>
            <Button variant="secondary" onClick={handleExportPdf} disabled={exportingPdf || currentEntries.length === 0}>
              {exportingPdf ? 'Generando…' : '📄 Exportar PDF'}
            </Button>
            <Button variant="primary" onClick={handleSaveList} disabled={!dirty || savingList}>
              {savingList ? 'Guardando…' : 'Guardar ejército'}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-sm border border-rule-dark/40 bg-parchment/70 px-4 py-3">
        <p className="text-sm">
          <span className="font-display text-lg font-semibold text-maroon">{total}</span>{' '}
          <span className="text-ink-soft">pts{pointsLimit != null && <> / {pointsLimit}</>}</span>
        </p>
        {overPoints && (
          <span className="text-xs font-medium text-danger">Supera el límite de puntos de la lista.</span>
        )}
      </div>

      {saveError && (
        <div className="mb-4 rounded-sm border border-danger-dark/40 bg-danger-dark/10 px-4 py-3">
          <p className="text-xs text-danger-dark">No se pudo guardar la lista: {saveError}</p>
        </div>
      )}

      {/* Cambios del editor que han afectado a esta lista al abrirla (ver
          reconcileEntries). Se puede descartar el aviso, pero no deshacer el
          ajuste: la lista ya no era válida con el catálogo actual. */}
      {reconcileNotes.length > 0 && (
        <div className="mb-4 rounded-sm border border-danger-dark/40 bg-danger-dark/10 px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-semibold text-danger-dark">
              El catálogo ha cambiado desde la última vez que guardaste esta lista
            </p>
            <button
              onClick={() => setReconcileNotes([])}
              className="shrink-0 text-mini font-medium text-ink-soft hover:text-maroon"
            >
              Entendido
            </button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {reconcileNotes.map((note) => (
              <li key={note.entryId} className="text-xs text-ink">
                <span className="font-medium">{note.unitName}</span>
                {note.conflicts.length > 0 && (
                  <>
                    : {note.conflicts.join(', ')} ya no se pueden llevar a la vez.{' '}
                    <span className="text-danger-dark">
                      Se han desmarcado todas sus opciones — vuelve a elegirlas.
                    </span>
                  </>
                )}
                {note.conflicts.length === 0 && note.removed.length > 0 && (
                  <>
                    : se {note.removed.length === 1 ? 'ha retirado 1 opción que ya no existe' : `han retirado ${note.removed.length} opciones que ya no existen`}.
                  </>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-mini text-ink-soft">
            Los cambios están solo en pantalla: guarda la lista para consolidarlos.
          </p>
        </div>
      )}

      {listIssues.length > 0 && (
        <div className="mb-4 rounded-sm border border-bronze/50 bg-bronze/10 px-4 py-3">
          {listIssues.map((issue) => (
            <p key={issue.message} className="flex items-start gap-1.5 text-xs text-ink">
              <WarningIcon className="mt-px h-3.5 w-3.5 shrink-0 text-bronze" />
              <span>{issue.message}</span>
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Panel title={draft.editingEntryId ? 'Editar entrada' : 'Añadir unidad'}>
            {draft.editingEntryId ? (
              <div>
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  <span>
                    {selectedUnit?.name}
                    {selectedUnit && <span className="text-ink-soft"> ({selectedUnit.faction.name})</span>}
                  </span>
                  {/* Al editar una entrada no se ve la lista de unidades, así
                      que el distintivo tiene que aparecer también aquí. */}
                  {selectedUnit?.isUnique && <Badge tone="amber">0-1</Badge>}
                </p>
                {optionsForm}
              </div>
            ) : (
              <div>
                <div className="mb-4 flex flex-wrap items-end gap-3">
                  <div className="w-56">
                    <Select
                      label="Facción"
                      value={effectiveFactionId}
                      onChange={(e) => {
                        setBrowseFactionId(Number(e.target.value))
                        setBrowseCategory(null)
                        handlePickUnit(null)
                      }}
                    >
                      {(factions ?? []).map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="min-w-[160px] flex-1">
                    <TextField
                      label="Buscar unidad"
                      placeholder="Nombre…"
                      value={unitSearch}
                      onChange={(e) => setUnitSearch(e.target.value)}
                    />
                  </div>
                </div>

                {categoryNames.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2 border-b border-rule-dark/30 pb-4">
                    {categoryNames.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setBrowseCategory(cat)}
                        className={clsx(
                          'rounded-sm px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors',
                          cat === effectiveCategory
                            ? 'bg-maroon text-parchment'
                            : 'border border-rule-dark/40 bg-parchment text-ink-soft hover:bg-parchment-dark',
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                {unitsInCategory.length === 0 ? (
                  <p className="text-xs italic text-ink-soft">No hay unidades que coincidan.</p>
                ) : (
                  <div className="space-y-2">
                    {unitsInCategory.map((u) => {
                      const isExpanded = selectedUnit?.id === u.id
                      return (
                        <div
                          key={u.id}
                          className={clsx(
                            'rounded-sm border',
                            isExpanded ? 'border-bronze/60 bg-parchment' : 'border-rule-dark/30 bg-parchment/50',
                          )}
                        >
                          <button
                            onClick={() => handlePickUnit(isExpanded ? null : u.id)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                          >
                            {/* El "0-1" se marca con el mismo distintivo que en
                                Editor > Unidades y personajes, en vez de con
                                una frase: se reconoce de un vistazo mientras se
                                recorre la lista. */}
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="text-sm font-medium text-ink">{u.name}</span>
                              {u.isUnique && <Badge tone="amber">0-1</Badge>}
                            </span>
                            <span className="flex shrink-0 items-center gap-3">
                              <span className="text-xs font-medium text-maroon">{u.baseCost} pts</span>
                              <span
                                className={clsx('text-xs text-ink-soft transition-transform', isExpanded && 'rotate-180')}
                              >
                                ▾
                              </span>
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="border-t border-rule-dark/20 px-3 pb-3">
                              {loadingUnit && <p className="mt-3 text-xs text-ink-soft">Cargando ficha…</p>}
                              {optionsForm}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Panel
            title="Ficha"
            /* La etiqueta de tipo y el emblema NO van aquí, en la cabecera del
               Panel: al medir el emblema 96 px, la cabecera crecía y empujaba
               hacia abajo todo el contenido de la izquierda. Van dentro del
               cuerpo, en la misma fila que el nombre de la unidad, de modo que
               el texto arranca arriba del todo y la imagen queda a su derecha. */
          >
            {!selectedUnit ? (
              <EmptyState title="Elige una unidad" description="Su ficha y sus reglas especiales aparecerán aquí." />
            ) : (
              <div className="space-y-4">
                {/* Cabecera de la ficha, con la misma estructura que
                    FactionMasthead en "Unidades y personajes": nombre, filete y
                    línea de detalle a un lado, emblema al otro.

                    Van CENTRADOS entre sí (`items-center`) a propósito. Antes
                    el texto se alineaba arriba y el emblema colgaba debajo de
                    la etiqueta de tipo: el bloque de texto mide ~36 px y esa
                    columna ~128 px, así que ni empezaban ni acababan a la
                    misma altura y parecían dos informaciones sueltas en vez de
                    una cabecera. Centrando los dos lados, el desnivel se
                    reparte y el conjunto lee como una sola pieza.

                    Se indica la facción porque una lista puede combinar
                    unidades de varias; al estar ya escrita aquí, el emblema ya
                    no necesita tooltip que la repita. */}
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg leading-tight font-semibold text-maroon">{selectedUnit.name}</p>
                    <div className="my-1.5 h-px bg-rule-dark/45" />
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-mini text-ink-soft">{selectedUnit.faction.name}</span>
                      {selectedUnit.typeTag && (
                        <span className="rounded-full border border-maroon/30 bg-maroon/10 px-2 py-0.5 text-micro font-medium text-maroon">
                          {selectedUnit.typeTag.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <FactionEmblem faction={selectedUnit.faction} size="lg" />
                </div>
                {selectedUnit.profiles.base && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-ink-soft">{selectedUnit.name}</p>
                    <AttributeTable profile={selectedUnit.profiles.base} />
                  </div>
                )}
                {/* Solo la montura y el carro ELEGIDOS para esta entrada, no
                    todos los que la unidad podría llevar: mientras no se
                    escoge, ese perfil no forma parte de la unidad y verlo en
                    su ficha confunde. Mismo criterio que ya seguían las
                    opciones con ficha propia, justo debajo. */}
                {selectedUnit.profiles.montura
                  .filter((p) => p.id === draft.mountProfileId)
                  .map((p) => (
                    <div key={p.id}>
                      <p className="mb-1 text-xs font-medium text-ink-soft">{p.name}</p>
                      <AttributeTable profile={p} />
                    </div>
                  ))}
                {selectedUnit.profiles.carro
                  .filter((p) => p.id === draft.chariotProfileId)
                  .map((p) => (
                    <div key={p.id}>
                      <p className="mb-1 text-xs font-medium text-ink-soft">{p.name}</p>
                      <AttributeTable profile={p} />
                    </div>
                  ))}
                {/* Opciones con ficha propia (p.ej. grupos de apoyo): su perfil
                    aparece aquí SOLO si la opción está marcada para esta
                    entrada, igual que se añadiría una montura. */}
                {selectedUnit.upgradeOptions
                  .filter((u) => u.profile && draft.upgradeIds.has(u.id))
                  .map((u) => (
                    <div key={`upg-${u.id}`}>
                      <p className="mb-1 text-xs font-medium text-ink-soft">Opción — {u.name}</p>
                      <AttributeTable profile={u.profile!} />
                    </div>
                  ))}

                {selectedUnit.equipmentText && (
                  <p className="text-xs text-ink-soft">
                    <span className="font-semibold tracking-wide text-ink">Equipo</span>{' '}
                    {selectedUnit.equipmentText}
                  </p>
                )}
                {selectedUnit.armorSave != null && (
                  <p className="text-xs text-ink-soft">
                    <span className="font-semibold text-ink">Tirada de salvación:</span>{' '}
                    {formatArmorSave(selectedUnit.armorSave)}
                  </p>
                )}

                {/* Plegable: la lista de reglas con su descripción es larga y,
                    una vez consultada, estorba para seguir montando la lista.
                    Se recuerda entre unidades (no por unidad) porque es una
                    preferencia de cuánto quieres ver, no un dato de la ficha. */}
                <div>
                  <button
                    type="button"
                    onClick={() => setRulesOpen((v) => !v)}
                    aria-expanded={rulesOpen}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <span className="text-xs font-semibold tracking-wide text-ink-soft">
                      Reglas especiales{reglasVisibles.length > 0 && ` (${reglasVisibles.length})`}
                    </span>
                    <span className={clsx('text-sm text-ink-soft transition-transform', rulesOpen && 'rotate-90')}>›</span>
                  </button>
                  {/* Las de la unidad más las del monstruo/montura ELEGIDO
                      para esta entrada (ver reglasVisibles): las de una
                      montura que todavía no se ha escogido no pintan nada
                      aquí. Las destacadas de la facción van primero, separadas
                      del resto por un filete. */}
                  {rulesOpen &&
                    (reglasVisibles.length === 0 ? (
                      <p className="mt-1 text-xs italic text-ink-soft">Ninguna.</p>
                    ) : (
                      <ul className="mt-1.5 space-y-1.5">
                        {reglasVisibles.map((r, i) => (
                          <li key={r.id} className="text-xs">
                            {i === destacadasCount && destacadasCount > 0 && (
                              <span className="mb-1.5 block h-px bg-rule-dark/40" />
                            )}
                            <span className="font-semibold text-ink">{r.name}</span>
                            {r.description && <span className="text-ink-soft"> — {r.description}</span>}
                          </li>
                        ))}
                      </ul>
                    ))}
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-6">
        <Panel title="Unidades en la lista">
          {currentEntries.length === 0 ? (
            <p className="text-xs italic text-ink-soft">Todavía no has añadido ninguna unidad.</p>
          ) : (
            /* `overflow-x-auto` + `min-w-[46rem]`: con emblema, escudo, tres
               columnas de mando y coste, la tabla no cabe en un móvil. Antes se
               aplastaba hasta ser ilegible; ahora se desplaza en horizontal
               manteniendo las proporciones. */
            <div className="overflow-x-auto rounded-sm border border-rule-dark/30">
              <table className="w-full min-w-[46rem] table-fixed border-collapse text-xs">
                <thead>
                  {/* Cada columna con ancho fijo y `align-middle` en todas las
                      celdas: es lo que mantiene el emblema, el escudo, el
                      número y los checks alineados en la misma línea óptica
                      aunque el nombre de la unidad ocupe más alto. */}
                  <tr className="bg-parchment-dark/50 text-ink-soft">
                    <th className="w-6 border-b border-rule-dark/30" />
                    <th className="w-8 border-b border-rule-dark/30" />
                    <th className="w-7 border-b border-rule-dark/30" />
                    <th className="w-10 border-b border-rule-dark/30 py-1.5 text-center align-middle font-semibold">Nº</th>
                    <th className="border-b border-rule-dark/30 py-1.5 text-left align-middle font-semibold">Unidad</th>
                    <th className="border-b border-rule-dark/30 py-1.5 text-left align-middle font-semibold">
                      Equipo / opciones
                    </th>
                    {COMMAND_COLUMNS.map((col) => (
                      <th key={col.key} className="w-8 border-b border-rule-dark/30 py-1.5 align-middle" aria-label={col.label}>
                        <Tooltip label={col.label} className="flex justify-center text-ink-soft">
                          <col.Icon className="h-5 w-5 object-contain" />
                        </Tooltip>
                      </th>
                    ))}
                    <th className="w-16 border-b border-rule-dark/30 py-1.5 text-center align-middle font-semibold">
                      Coste
                    </th>
                    <th className="w-8 border-b border-rule-dark/30" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule-dark/15">
                  {currentEntries.map((entry) => {
                    const cost = computeEntryCost(entry.unit, entry)
                    const equipNames = entry.unit.equipmentOptions
                      .filter((e) => entry.equipmentIds.includes(e.id))
                      .map((e) => e.name)
                    const upgradeNames = entry.unit.upgradeOptions
                      .filter((u) => entry.upgradeIds.includes(u.id))
                      .map((u) => u.name)
                    const combo = [...equipNames, ...upgradeNames].join(', ') || '—'
                    const shieldMetal = categoryShieldMetal(entry.unit.category?.code)
                    return (
                      <tr
                        key={entry.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation()
                          dragEntryId.current = entry.id
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          setDragOverEntryId(entry.id)
                        }}
                        onDragLeave={() => setDragOverEntryId((id) => (id === entry.id ? null : id))}
                        onDrop={(e) => {
                          e.preventDefault()
                          handleDropEntry(entry.id)
                        }}
                        className={clsx(
                          'cursor-pointer hover:bg-parchment-dark/40',
                          draft.editingEntryId === entry.id && 'bg-bronze/10',
                          dragOverEntryId === entry.id && 'bg-bronze/10',
                        )}
                        onClick={() => startEditEntry(entry)}
                      >
                        <td className="py-1.5 text-center align-middle">
                          <span
                            className="inline-flex cursor-grab p-1 text-ink-soft/60"
                            title="Arrastra para reordenar"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DragHandleIcon className="h-3.5 w-3.5" />
                          </span>
                        </td>
                        <td className="py-1.5 text-center align-middle">
                          {entry.unit.faction.emblemUrl && (
                            <Tooltip label={entry.unit.faction.name} className="inline-flex">
                              <img
                                src={entry.unit.faction.emblemUrl}
                                alt=""
                                className="h-5 w-5 rounded-[2px] object-cover shadow-sm shadow-black/20"
                              />
                            </Tooltip>
                          )}
                        </td>
                        <td className="py-1.5 text-center align-middle">
                          {shieldMetal && (
                            <Tooltip label={entry.unit.category?.name ?? ''} className="inline-flex">
                              <CategoryShield metal={shieldMetal} className="h-[18px] w-[18px]" />
                            </Tooltip>
                          )}
                        </td>
                        <td className="py-1.5 text-center align-middle text-ink">{entry.quantity}</td>
                        <td className="py-1.5 align-middle text-ink">
                          {entry.unit.name}
                          {needsReviewIds.has(entry.id) && (
                            <Tooltip
                              label="Sus opciones se desmarcaron por un cambio en el catálogo: vuelve a elegirlas"
                              className="ml-1.5 inline-flex align-text-bottom text-danger-dark"
                            >
                              <WarningIcon className="h-3.5 w-3.5" />
                            </Tooltip>
                          )}
                        </td>
                        <td className="truncate py-1.5 align-middle text-ink-soft" title={combo}>
                          {combo}
                        </td>
                        {COMMAND_COLUMNS.map((col) => (
                          <td key={col.key} className="py-1.5 text-center align-middle">
                            <Tooltip
                              label={`${col.label}: ${col.has(entry) ? 'sí' : 'no'}`}
                              className={col.has(entry) ? 'inline-flex text-maroon' : 'inline-flex text-ink-soft/35'}
                            >
                              {col.has(entry) ? <CheckIcon className="h-3.5 w-3.5" /> : <span aria-hidden>·</span>}
                            </Tooltip>
                          </td>
                        ))}
                        <td className="py-1.5 text-center align-middle font-medium text-ink">{cost}</td>
                        <td className="py-1.5 text-center align-middle">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeletingEntry(entry)
                            }}
                            className="rounded-sm p-1 text-ink-soft hover:bg-maroon/10 hover:text-danger"
                            aria-label={`Quitar ${entry.unit.name}`}
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {editingSettings && (
        <ArmyListSettingsModal
          list={{ ...list, name, pointsLimit, entries: currentEntries }}
          onClose={() => setEditingSettings(false)}
          onSaved={(values) => {
            // Actualiza solo los metadatos en el estado local (ya persistidos
            // por el modal); NO se recarga, para no descartar el borrador de
            // entradas sin guardar.
            setName(values.name)
            setPointsLimit(values.pointsLimit)
            setEditingSettings(false)
          }}
        />
      )}

      {deletingEntry && (
        <ConfirmDialog
          title="Quitar entrada"
          message={`Se quitará "${deletingEntry.unit.name}" de la lista.`}
          confirmLabel="Quitar"
          onCancel={() => setDeletingEntry(null)}
          onConfirm={() => handleRemoveEntry(deletingEntry)}
        />
      )}

      {blocker.state === 'blocked' && (
        <UnsavedChangesDialog
          saving={savingList}
          onKeepEditing={() => blocker.reset()}
          onDiscardAndLeave={() => blocker.proceed()}
          onSaveAndLeave={async () => {
            const ok = await handleSaveList()
            if (ok) blocker.proceed()
            else blocker.reset()
          }}
        />
      )}
    </div>
  )
}
