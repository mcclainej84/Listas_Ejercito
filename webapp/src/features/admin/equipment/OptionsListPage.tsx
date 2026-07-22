import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { FactionRepository } from '@/data/repositories/factionRepository'
import {
  EquipmentRepository,
  UpgradeRepository,
  type EquipmentOptionWithUsage,
  type OptionUsageRow,
  type UpgradeWithUsage,
} from '@/data/repositories/lookupRepositories'
import { useAsync } from '@/shared/hooks/useAsync'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Select } from '@/shared/ui/Select'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { UsageBadge, UsageList } from '@/shared/ui/UsageBadge'
import { TrashIcon } from '@/shared/ui/icons'
import { EquipmentFormModal } from '@/features/admin/equipment/EquipmentFormModal'
import { UpgradeFormModal } from '@/features/admin/equipment/UpgradeFormModal'
import type { EquipmentOption } from '@/domain/types'

const CATEGORY_LABELS: Record<string, string> = {
  armadura: 'Armadura',
  escudo: 'Escudo',
  arma_cac: 'Arma c/c',
  arma_dist: 'Arma dist.',
}

type Tab = 'equipo' | 'opciones'

/** Construye id → nombres de las opciones EXCLUYENTES con ella (en ambos sentidos de la pareja). */
function buildIncompatMap(pairs: Array<[number, number]> | null, names: Map<number, string>): Map<number, string[]> {
  const map = new Map<number, string[]>()
  for (const [a, b] of pairs ?? []) {
    const nameA = names.get(a)
    const nameB = names.get(b)
    if (nameB) map.set(a, [...(map.get(a) ?? []), nameB])
    if (nameA) map.set(b, [...(map.get(b) ?? []), nameA])
  }
  return map
}

/** Agrupa las filas de uso por opción: id → ["Unidad (Facción)", …]. */
function groupUsage(rows: OptionUsageRow[] | null): Map<number, string[]> {
  const map = new Map<number, string[]>()
  for (const r of rows ?? []) {
    const list = map.get(r.optionId) ?? []
    list.push(`${r.unitName} (${r.factionName})`)
    map.set(r.optionId, list)
  }
  return map
}

/**
 * Gestor del catálogo de "Opciones de equipo" (armas/armaduras) y "Opciones de
 * unidad" (mejoras). Ambos son catálogos GLOBALES que las unidades referencian,
 * así que el filtro por facción muestra las que usa al menos una unidad de esa
 * facción — que es lo que hace manejable encontrar algo concreto.
 */
export function OptionsListPage() {
  const [tab, setTab] = useState<Tab>('equipo')
  const [factionId, setFactionId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const { data: factions } = useAsync(() => FactionRepository.listAll())

  const {
    data: equipment,
    loading: loadingEquipment,
    reload: reloadEquipment,
  } = useAsync(
    () => (factionId ? EquipmentRepository.listByFaction(factionId) : EquipmentRepository.listAllWithUsage()),
    [factionId],
  )
  const {
    data: upgrades,
    loading: loadingUpgrades,
    reload: reloadUpgrades,
  } = useAsync(
    () => (factionId ? UpgradeRepository.listByFaction(factionId) : UpgradeRepository.listAllWithUsage()),
    [factionId],
  )

  // Listas completas (sin filtrar por facción) solo para resolver NOMBRES de
  // las opciones incompatibles, que pueden no estar en la lista mostrada.
  const { data: allEquipment, reload: reloadAllEquipment } = useAsync(() => EquipmentRepository.listAll())
  const { data: allUpgrades, reload: reloadAllUpgrades } = useAsync(() => UpgradeRepository.listAll())
  const { data: equipmentPairs, reload: reloadEquipmentPairs } = useAsync(() =>
    EquipmentRepository.listIncompatibilities(),
  )
  const { data: upgradePairs, reload: reloadUpgradePairs } = useAsync(() => UpgradeRepository.listIncompatibilities())

  const equipmentIncompat = useMemo(
    () => buildIncompatMap(equipmentPairs, new Map((allEquipment ?? []).map((e) => [e.id, e.name]))),
    [equipmentPairs, allEquipment],
  )
  const upgradeIncompat = useMemo(
    () => buildIncompatMap(upgradePairs, new Map((allUpgrades ?? []).map((u) => [u.id, u.name]))),
    [upgradePairs, allUpgrades],
  )

  const { data: equipmentUsage, reload: reloadEquipmentUsage } = useAsync(() => EquipmentRepository.listUsage())
  const { data: upgradeUsage, reload: reloadUpgradeUsage } = useAsync(() => UpgradeRepository.listUsage())
  const equipmentUsageMap = useMemo(() => groupUsage(equipmentUsage), [equipmentUsage])
  const upgradeUsageMap = useMemo(() => groupUsage(upgradeUsage), [upgradeUsage])

  /**
   * Recarga TODO lo que se muestra en la pantalla. Guardar una opción puede
   * cambiar sus incompatibilidades (y, con "excluyentes entre sí", las de
   * otras opciones distintas de la editada), así que no basta con recargar la
   * lista: hay que rehacer también los pares y el uso. Si no, los cambios
   * parecen no aplicarse hasta recargar la página entera.
   */
  function reloadAll() {
    reloadEquipment()
    reloadUpgrades()
    reloadAllEquipment()
    reloadAllUpgrades()
    reloadEquipmentPairs()
    reloadUpgradePairs()
    reloadEquipmentUsage()
    reloadUpgradeUsage()
  }

  const [onlyUnused, setOnlyUnused] = useState(false)
  // Clave de la opción cuya lista de unidades está desplegada ("equipo:12").
  const [expandedUsage, setExpandedUsage] = useState<string | null>(null)
  const [editingEquipment, setEditingEquipment] = useState<EquipmentOption | 'new' | null>(null)
  const [editingUpgrade, setEditingUpgrade] = useState<UpgradeWithUsage | 'new' | null>(null)
  const [deleting, setDeleting] = useState<
    { kind: Tab; id: number; name: string; usageCount: number } | null
  >(null)

  const q = search.trim().toLowerCase()
  const shownEquipment = useMemo(
    () =>
      (equipment ?? []).filter(
        (e) => (!q || e.name.toLowerCase().includes(q)) && (!onlyUnused || e.usageCount === 0),
      ),
    [equipment, q, onlyUnused],
  )
  const shownUpgrades = useMemo(
    () =>
      (upgrades ?? []).filter((u) => (!q || u.name.toLowerCase().includes(q)) && (!onlyUnused || u.usageCount === 0)),
    [upgrades, q, onlyUnused],
  )

  const loading = tab === 'equipo' ? loadingEquipment : loadingUpgrades
  const count = tab === 'equipo' ? shownEquipment.length : shownUpgrades.length

  function rowActions(kind: Tab, item: EquipmentOptionWithUsage | UpgradeWithUsage) {
    return (
      <div className="flex shrink-0 items-center gap-3 pt-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          className="text-xs font-medium text-ink-soft hover:text-maroon"
          onClick={() =>
            kind === 'equipo'
              ? setEditingEquipment(item as EquipmentOptionWithUsage)
              : setEditingUpgrade(item as UpgradeWithUsage)
          }
        >
          Editar
        </button>
        <button
          className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium text-ink-soft hover:bg-maroon/10 hover:text-danger"
          onClick={() => setDeleting({ kind, id: item.id, name: item.name, usageCount: item.usageCount })}
          aria-label={`Borrar ${item.name}`}
          title="Borrar"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Equipo y opciones"
        description="Catálogo único de opciones de equipo (armas, armaduras…) y opciones de unidad (mejoras). Editar aquí una opción la actualiza en todas las unidades que la usan."
        actions={
          <Button
            variant="primary"
            onClick={() => (tab === 'equipo' ? setEditingEquipment('new') : setEditingUpgrade('new'))}
          >
            {tab === 'equipo' ? '+ Nueva opción de equipo' : '+ Nueva opción de unidad'}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          {(
            [
              ['equipo', 'Opciones de equipo'],
              ['opciones', 'Opciones de unidad'],
            ] as Array<[Tab, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={clsx(
                'rounded-sm px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors',
                tab === value
                  ? 'bg-maroon text-parchment'
                  : 'border border-rule-dark/40 bg-parchment text-ink-soft hover:bg-parchment-dark',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-56">
          <Select
            label="Facción"
            value={factionId ?? ''}
            onChange={(e) => setFactionId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Todas las facciones</option>
            {(factions ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por descripción…"
          className="h-[30px] min-w-[180px] flex-1 rounded-sm border border-rule-dark/50 bg-parchment/70 px-3 text-xs outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/25"
        />

        <label
          className="flex h-[30px] shrink-0 items-center gap-2 text-xs text-ink"
          title="Muestra solo las opciones que no usa ninguna unidad, para revisarlas o borrarlas."
        >
          <input
            type="checkbox"
            className="accent-maroon"
            checked={onlyUnused}
            onChange={(e) => setOnlyUnused(e.target.checked)}
          />
          Mostrar opciones sin usar
        </label>
      </div>

      {factionId != null && (
        <p className="mb-3 text-xs text-ink-soft">
          Mostrando solo las opciones usadas por alguna unidad de esta facción.
        </p>
      )}

      {loading && <Spinner />}

      {!loading && count === 0 && (
        <EmptyState
          title="Sin resultados"
          description="No hay opciones que coincidan con el filtro. Prueba con otra facción o quita el buscador."
        />
      )}

      {!loading && count > 0 && (
        <div className="divide-y divide-rule-dark/20 overflow-hidden rounded-sm border border-rule-dark/40 bg-parchment/70">
          {tab === 'equipo'
            ? shownEquipment.map((item) => {
                const key = `equipo:${item.id}`
                const expanded = expandedUsage === key
                return (
                  <div key={item.id}>
                    <div className="group flex items-start justify-between gap-4 px-4 py-2.5">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="truncate text-sm font-medium text-ink">{item.name}</span>
                          {item.category && (
                            <span className="shrink-0 rounded-full border border-rule-dark/40 px-2 py-0.5 text-micro text-ink-soft">
                              {CATEGORY_LABELS[item.category] ?? item.category}
                            </span>
                          )}
                          <span className="shrink-0 text-xs text-maroon">{item.cost} pts</span>
                          <UsageBadge
                            count={item.usageCount}
                            expanded={expanded}
                            onToggle={() => setExpandedUsage(expanded ? null : key)}
                          />
                        </div>
                        {(equipmentIncompat.get(item.id) ?? []).length > 0 && (
                          <p className="mt-0.5 text-mini text-ink-soft">
                            <span className="font-medium">Excluyente con:</span>{' '}
                            {(equipmentIncompat.get(item.id) ?? []).join(', ')}
                          </p>
                        )}
                      </div>
                      {rowActions('equipo', item)}
                    </div>
                    {expanded && <UsageList items={equipmentUsageMap.get(item.id) ?? []} />}
                  </div>
                )
              })
            : shownUpgrades.map((item) => {
                const key = `opciones:${item.id}`
                const expanded = expandedUsage === key
                return (
                  <div key={item.id}>
                    <div className="group flex items-start justify-between gap-4 px-4 py-2.5">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="truncate text-sm font-medium text-ink">{item.name}</span>
                          <span className="shrink-0 text-xs text-maroon">{item.cost} pts</span>
                          {item.profile && (
                            <span className="shrink-0 rounded-full border border-bronze/50 bg-bronze/10 px-2 py-0.5 text-micro font-medium text-bronze">
                              con ficha
                            </span>
                          )}
                          {item.includeInSheets && (
                            <span className="shrink-0 rounded-full border border-success/50 bg-success/10 px-2 py-0.5 text-micro font-medium text-success">
                              en Hojas de Unidad
                            </span>
                          )}
                          <UsageBadge
                            count={item.usageCount}
                            expanded={expanded}
                            onToggle={() => setExpandedUsage(expanded ? null : key)}
                          />
                        </div>
                        {(upgradeIncompat.get(item.id) ?? []).length > 0 && (
                          <p className="mt-0.5 text-mini text-ink-soft">
                            <span className="font-medium">Excluyente con:</span>{' '}
                            {(upgradeIncompat.get(item.id) ?? []).join(', ')}
                          </p>
                        )}
                      </div>
                      {rowActions('opciones', item)}
                    </div>
                    {expanded && <UsageList items={upgradeUsageMap.get(item.id) ?? []} />}
                  </div>
                )
              })}
        </div>
      )}

      {editingEquipment && (
        <EquipmentFormModal
          equipment={editingEquipment === 'new' ? null : editingEquipment}
          onClose={() => setEditingEquipment(null)}
          onSaved={() => {
            setEditingEquipment(null)
            reloadAll()
          }}
        />
      )}

      {editingUpgrade && (
        <UpgradeFormModal
          upgrade={editingUpgrade === 'new' ? null : editingUpgrade}
          onClose={() => setEditingUpgrade(null)}
          onSaved={() => {
            setEditingUpgrade(null)
            reloadAll()
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={deleting.kind === 'equipo' ? 'Borrar opción de equipo' : 'Borrar opción de unidad'}
          message={
            deleting.usageCount > 0
              ? `"${deleting.name}" la usan ${deleting.usageCount} unidad(es). Si la borras, desaparecerá de todas ellas. Esta acción no se puede deshacer.`
              : `Se borrará "${deleting.name}". Esta acción no se puede deshacer.`
          }
          confirmLabel="Borrar definitivamente"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            // Borrar arrastra por cascada sus incompatibilidades y su uso, así
            // que también hay que refrescarlo todo.
            if (deleting.kind === 'equipo') await EquipmentRepository.remove(deleting.id)
            else await UpgradeRepository.remove(deleting.id)
            reloadAll()
            setDeleting(null)
          }}
        />
      )}
    </div>
  )
}
