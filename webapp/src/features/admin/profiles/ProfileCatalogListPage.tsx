import { useMemo, useState } from 'react'
import type { ProfileCatalogEntry, ProfileCatalogInput } from '@/data/repositories/profileCatalogRepository'
import { FactionRepository } from '@/data/repositories/factionRepository'
import { RuleRepository } from '@/data/repositories/ruleRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { TrashIcon } from '@/shared/ui/icons'
import { AttributeTable } from '@/shared/ui/AttributeTable'
import { ProfileCatalogFormModal } from '@/features/admin/profiles/ProfileCatalogFormModal'

interface ProfileCatalogRepository {
  listAll(): Promise<ProfileCatalogEntry[]>
  create(input: ProfileCatalogInput): Promise<number>
  update(id: number, input: ProfileCatalogInput): Promise<void>
  remove(id: number): Promise<void>
  addFaction(profileId: number, factionId: number): Promise<void>
  removeFaction(profileId: number, factionId: number): Promise<void>
  setSpecialRules(profileId: number, ruleIds: number[]): Promise<void>
}

interface ProfileCatalogListPageProps {
  title: string
  description: string
  newLabel: string
  repository: ProfileCatalogRepository
  /** Solo el catálogo "Monturas" ofrece este campo; los carros no lo usan. */
  showEquippableByCharacter?: boolean
  /** Solo el catálogo "Monturas": permite marcar si la ficha sale en la sección "Hojas de Unidad". */
  showIncludeInSheets?: boolean
  /**
   * Si la ficha puede tener reglas especiales propias. Se activa en
   * "Montura/Dotación" porque ahí están los monstruos, que traen sus propias
   * reglas (Vuela, Miedo…) y se las aportan a quien los monte.
   */
  showSpecialRules?: boolean
}

/**
 * Página genérica de catálogo "Monturas"/"Carros": ambas tienen exactamente
 * la misma forma (ficha de 9 atributos + facciones asociadas), así que se
 * parametriza en vez de duplicar la pantalla dos veces — ver
 * features/admin/mounts y features/admin/chariots para las instancias.
 */
export function ProfileCatalogListPage({
  title,
  description,
  newLabel,
  repository,
  showEquippableByCharacter,
  showIncludeInSheets,
  showSpecialRules,
}: ProfileCatalogListPageProps) {
  const { data: entries, loading, error, reload } = useAsync(() => repository.listAll())
  const { data: factions } = useAsync(() => FactionRepository.listAll())
  const { data: allRules } = useAsync(() => (showSpecialRules ? RuleRepository.listAll() : Promise.resolve([])))
  const [editing, setEditing] = useState<ProfileCatalogEntry | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ProfileCatalogEntry | null>(null)
  // Buscador por nombre — misma idea que en "Equipo y opciones" (ver
  // OptionsListPage), para encontrar una ficha concreta sin desplazarse por
  // todo el catálogo.
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const shownEntries = useMemo(
    () => (entries ?? []).filter((entry) => !q || (entry.profile.name ?? '').toLowerCase().includes(q)),
    [entries, q],
  )

  const factionNameById = new Map((factions ?? []).map((f) => [f.id, f.name]))

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={<Button variant="primary" onClick={() => setEditing('new')}>+ {newLabel}</Button>}
      />

      {!loading && (entries ?? []).length > 0 && (
        <div className="mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            className="h-[30px] w-full max-w-xs rounded-sm border border-rule-dark/50 bg-parchment/70 px-3 text-xs outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/25"
          />
        </div>
      )}

      {loading && <Spinner />}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && (entries ?? []).length === 0 && (
        <EmptyState title="Todavía no hay fichas" description={`Crea la primera con "+ ${newLabel}".`} />
      )}

      {!loading && (entries ?? []).length > 0 && shownEntries.length === 0 && (
        <p className="text-xs text-ink-soft italic">Ninguna ficha coincide con "{search}".</p>
      )}

      {!loading && shownEntries.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shownEntries.map((entry) => (
            <div key={entry.profile.id} className="group rounded-sm border border-rule-dark/40 bg-parchment/70 p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-maroon">{entry.profile.name}</p>
                  {showEquippableByCharacter && entry.profile.equippableByCharacter && (
                    <span className="block text-xs text-ink-soft">Equipable por un personaje</span>
                  )}
                  {showIncludeInSheets && entry.profile.includeInSheets && (
                    <span className="block text-xs text-bronze">Sale en Hojas de Unidad</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                  <button className="text-xs font-medium text-ink-soft hover:text-maroon" onClick={() => setEditing(entry)}>
                    Editar
                  </button>
                  <button
                    className="rounded-sm px-1.5 py-0.5 text-ink-soft hover:bg-maroon/10 hover:text-danger"
                    onClick={() => setDeleting(entry)}
                    aria-label={`Borrar ${entry.profile.name}`}
                    title="Borrar"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <AttributeTable profile={entry.profile} />

              {showSpecialRules && entry.specialRules.length > 0 && (
                <p className="mt-3 text-xs text-ink-soft">
                  <span className="font-medium text-ink">Reglas:</span>{' '}
                  {entry.specialRules.map((r) => r.name).join(', ')}
                </p>
              )}

              <p className="mt-3 text-xs text-ink-soft">
                {entry.factionIds.length === 0
                  ? 'Sin facciones asociadas todavía.'
                  : entry.factionIds.map((id) => factionNameById.get(id) ?? '?').join(', ')}
              </p>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ProfileCatalogFormModal
          title={editing === 'new' ? newLabel : `Editar ${entryName(editing)}`}
          entry={editing === 'new' ? null : editing}
          factions={factions ?? []}
          onSave={async (input) => {
            if (editing === 'new') {
              await repository.create(input)
            } else {
              await repository.update(editing.profile.id, input)
            }
            setEditing(null)
            reload()
          }}
          onToggleFaction={
            editing === 'new'
              ? undefined
              : async (factionId, enabled) => {
                  if (enabled) await repository.addFaction((editing as ProfileCatalogEntry).profile.id, factionId)
                  else await repository.removeFaction((editing as ProfileCatalogEntry).profile.id, factionId)
                  reload()
                }
          }
          onClose={() => setEditing(null)}
          showEquippableByCharacter={showEquippableByCharacter}
          showIncludeInSheets={showIncludeInSheets}
          allRules={showSpecialRules ? (allRules ?? []) : undefined}
          onSetSpecialRules={
            editing === 'new' || !showSpecialRules
              ? undefined
              : async (ruleIds) => {
                  await repository.setSpecialRules((editing as ProfileCatalogEntry).profile.id, ruleIds)
                  reload()
                }
          }
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Borrar ficha"
          message={`Se borrará "${deleting.profile.name}" del catálogo. Las unidades que la tuvieran asignada la perderán. Esta acción no se puede deshacer.`}
          confirmLabel="Borrar definitivamente"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await repository.remove(deleting.profile.id)
            setDeleting(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function entryName(entry: ProfileCatalogEntry): string {
  return entry.profile.name ?? ''
}
