import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RuleRepository, type RuleUsageRow, type SpecialRuleWithUsage } from '@/data/repositories/ruleRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { UsageBadge, UsageList } from '@/shared/ui/UsageBadge'
import { TrashIcon } from '@/shared/ui/icons'
import { RuleFormModal } from '@/features/admin/rules/RuleFormModal'
import type { SpecialRule } from '@/domain/types'

/** Agrupa las filas de uso por regla: id → ["Saurios (Lagartos)", "Estegadón (Montura/Dotación)", …]. */
function groupUsage(rows: RuleUsageRow[] | null): Map<number, string[]> {
  const map = new Map<number, string[]>()
  for (const r of rows ?? []) {
    map.set(r.ruleId, [...(map.get(r.ruleId) ?? []), `${r.name} (${r.source})`])
  }
  return map
}

export function RulesListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const { data: rules, loading, error, reload } = useAsync(() => RuleRepository.listAllWithUsage())
  const { data: usage, reload: reloadUsage } = useAsync(() => RuleRepository.listUsage())
  const [editing, setEditing] = useState<SpecialRule | 'new' | null>(null)
  const [deleting, setDeleting] = useState<SpecialRuleWithUsage | null>(null)
  const [onlyUnused, setOnlyUnused] = useState(false)
  /** Id de la regla cuya lista de "quién la usa" está desplegada. */
  const [expandedUsage, setExpandedUsage] = useState<number | null>(null)

  const usageMap = useMemo(() => groupUsage(usage), [usage])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rules ?? []).filter(
      (r) =>
        (!q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)) &&
        (!onlyUnused || r.usageCount === 0),
    )
  }, [rules, query, onlyUnused])

  function reloadAll() {
    reload()
    reloadUsage()
  }

  return (
    <div>
      <PageHeader
        title="Reglas especiales"
        description="Catálogo único de reglas. Toda unidad que las use referencia esta misma ficha: editarla aquí actualiza todas las fichas al instante."
        actions={<Button variant="primary" onClick={() => setEditing('new')}>+ Nueva regla</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setSearchParams(e.target.value ? { q: e.target.value } : {})}
          placeholder="Filtrar por nombre o descripción…"
          className="h-[30px] w-full max-w-sm rounded-sm border border-rule-dark/50 bg-parchment/70 px-3 text-xs outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/25"
        />

        <label
          className="flex h-[30px] shrink-0 items-center gap-2 text-xs text-ink"
          title="Muestra solo las reglas que no usa ninguna unidad, opción ni montura, para revisarlas o borrarlas."
        >
          <input
            type="checkbox"
            className="accent-maroon"
            checked={onlyUnused}
            onChange={(e) => setOnlyUnused(e.target.checked)}
          />
          Mostrar reglas sin usar
        </label>
      </div>

      {loading && <Spinner />}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && filtered.length === 0 && (
        <EmptyState
          title="Sin resultados"
          description={
            onlyUnused
              ? 'Todas las reglas están en uso por alguna unidad, opción o montura.'
              : 'No hay reglas que coincidan con el filtro.'
          }
        />
      )}

      {!loading && filtered.length > 0 && (
        <div className="divide-y divide-rule-dark/20 overflow-hidden rounded-sm border border-rule-dark/40 bg-parchment/70">
          {filtered.map((rule) => {
            const expanded = expandedUsage === rule.id
            return (
              <div key={rule.id} className="group">
                <div className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold text-maroon">{rule.name}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">{rule.description || '(sin descripción)'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 pt-0.5">
                    {/* El contador de usos se ve SIEMPRE (no solo al pasar el
                        ratón como Editar/Borrar): es justo el dato que se viene
                        a mirar a esta pantalla. */}
                    <UsageBadge
                      count={rule.usageCount}
                      expanded={expanded}
                      onToggle={() => setExpandedUsage(expanded ? null : rule.id)}
                      noun={{ one: 'ficha', many: 'fichas' }}
                    />
                    <div className="flex gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="text-xs font-medium text-ink-soft hover:text-maroon"
                        onClick={() => setEditing(rule)}
                      >
                        Editar
                      </button>
                      <button
                        className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium text-ink-soft hover:bg-maroon/10 hover:text-danger"
                        onClick={() => setDeleting(rule)}
                        aria-label={`Borrar ${rule.name}`}
                        title="Borrar"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                {expanded && <UsageList items={usageMap.get(rule.id) ?? []} title="La usan estas fichas" />}
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <RuleFormModal
          rule={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reloadAll()
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Borrar regla especial"
          /* El aviso de uso sale del recuento que ya está cargado, así que no
             hace falta consultarlo otra vez al pulsar la papelera. */
          message={
            deleting.usageCount > 0
              ? `"${deleting.name}" está en uso por ${deleting.usageCount} ficha(s) (p.ej. ${(usageMap.get(deleting.id) ?? [])
                  .slice(0, 3)
                  .join(', ')}${deleting.usageCount > 3 ? '…' : ''}). Si la borras, dejará de aparecer en ellas.`
              : `Se borrará "${deleting.name}". No la usa ninguna ficha. Esta acción no se puede deshacer.`
          }
          confirmLabel="Borrar definitivamente"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await RuleRepository.remove(deleting.id)
            setDeleting(null)
            reloadAll()
          }}
        />
      )}
    </div>
  )
}
