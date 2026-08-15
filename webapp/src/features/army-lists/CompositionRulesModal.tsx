// ============================================================================
// "Selección de puntos" — cuántas unidades de cada categoría exige o permite
// el ejército según sus puntos.
//
// Es configuración GLOBAL, común a todos los ejércitos: se abre desde el
// listado de Ejércitos y afecta a todas las listas, presentes y futuras.
//
// Se configura la REGLA, no la tabla. Por cada categoría: si es un mínimo
// obligatorio o un máximo permitido, su valor base y cuánto sube por cada
// tramo de 1.000 puntos. Con eso, la tabla del reglamento sale sola y se
// extiende a 5.000, 6.000… sin tocar nada:
//
//     Puntos          Básicas   Especiales   Singulares
//     < 2.000           2+         0-3          0-1
//     2.000 - 2.999     3+         0-4          0-2
//     3.000 - 3.999     4+         0-5          0-3
//
// La vista previa de abajo enseña esa tabla ya calculada con lo que hay puesto,
// que es la única forma de comprobar de un vistazo que los números son los que
// se querían: "base 2, +1" no dice nada por sí solo, "2+ / 3+ / 4+" sí.
// ============================================================================
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { UnitCategoryRepository } from '@/data/repositories/lookupRepositories'
import { CompositionRuleRepository } from '@/data/repositories/compositionRuleRepository'
import {
  formatRuleValue,
  ruleValueAt,
  RULE_KIND_LABELS,
  TIER_SIZE_POINTS,
  TIER_START_POINTS,
  type CompositionRule,
  type CompositionRuleKind,
} from '@/domain/armyComposition'
import { useAsync } from '@/shared/hooks/useAsync'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'

/** Los puntos con los que se dibuja la vista previa. */
const PREVIEW_POINTS = [1500, 2000, 3000, 4000]

interface DraftRule {
  enabled: boolean
  kind: CompositionRuleKind
  base: number
  step: number
}

export function CompositionRulesModal({ onClose }: { onClose: () => void }) {
  const { data: categories, loading: loadingCategories } = useAsync(() => UnitCategoryRepository.listAll())
  const { data: savedRules, loading: loadingRules } = useAsync(() => CompositionRuleRepository.listAll())

  const [draft, setDraft] = useState<Record<number, DraftRule>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Se siembra cuando llegan las dos consultas. Cada categoría arranca
  // "sin regla" salvo que ya tuviera una guardada.
  useEffect(() => {
    if (!categories || !savedRules) return
    const byId = new Map(savedRules.map((r) => [r.categoryId, r]))
    setDraft(
      Object.fromEntries(
        categories.map((c) => {
          const saved = byId.get(c.id)
          return [
            c.id,
            saved
              ? { enabled: true, kind: saved.kind, base: saved.base, step: saved.step }
              : { enabled: false, kind: 'max' as CompositionRuleKind, base: 0, step: 0 },
          ]
        }),
      ),
    )
  }, [categories, savedRules])

  function patch(categoryId: number, values: Partial<DraftRule>) {
    setDraft((d) => ({ ...d, [categoryId]: { ...d[categoryId], ...values } }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const rules: CompositionRule[] = Object.entries(draft)
        .filter(([, r]) => r.enabled)
        .map(([categoryId, r]) => ({
          categoryId: Number(categoryId),
          kind: r.kind,
          base: Math.max(0, r.base),
          step: Math.max(0, r.step),
        }))
      await CompositionRuleRepository.replaceAll(rules)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  const activas = (categories ?? []).filter((c) => draft[c.id]?.enabled)

  return (
    <Modal
      title="Selección de puntos"
      widthClassName="max-w-3xl"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || loadingCategories || loadingRules}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      {loadingCategories || loadingRules ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-sm border border-rule-dark/30">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-parchment-dark/50 text-ink-soft">
                  <th className="border-b border-rule-dark/30 px-2 py-1.5 text-left font-semibold">Categoría</th>
                  <th className="w-40 border-b border-rule-dark/30 px-2 py-1.5 text-left font-semibold">Regla</th>
                  <th className="w-20 border-b border-rule-dark/30 px-2 py-1.5 text-center font-semibold">Base</th>
                  <th className="w-24 border-b border-rule-dark/30 px-2 py-1.5 text-center font-semibold">Por tramo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule-dark/15">
                {(categories ?? []).map((category) => {
                  const rule = draft[category.id]
                  if (!rule) return null
                  return (
                    <tr key={category.id} className={clsx(!rule.enabled && 'opacity-60')}>
                      <td className="px-2 py-1.5">
                        <label className="flex cursor-pointer items-center gap-2 text-ink">
                          <input
                            type="checkbox"
                            className="accent-maroon"
                            checked={rule.enabled}
                            onChange={(e) => patch(category.id, { enabled: e.target.checked })}
                          />
                          {category.name}
                        </label>
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={rule.kind}
                          disabled={!rule.enabled}
                          onChange={(e) => patch(category.id, { kind: e.target.value as CompositionRuleKind })}
                          className="w-full rounded-sm border border-rule-dark/40 bg-parchment px-1.5 py-1 text-xs text-ink outline-none focus:border-bronze disabled:opacity-50"
                        >
                          {(Object.keys(RULE_KIND_LABELS) as CompositionRuleKind[]).map((kind) => (
                            <option key={kind} value={kind}>
                              {RULE_KIND_LABELS[kind]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min={0}
                          value={rule.base}
                          disabled={!rule.enabled}
                          onChange={(e) => patch(category.id, { base: Number(e.target.value) || 0 })}
                          className="w-full rounded-sm border border-rule-dark/40 bg-parchment px-1.5 py-1 text-center text-xs text-ink outline-none focus:border-bronze disabled:opacity-50"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min={0}
                          value={rule.step}
                          disabled={!rule.enabled}
                          onChange={(e) => patch(category.id, { step: Number(e.target.value) || 0 })}
                          className="w-full rounded-sm border border-rule-dark/40 bg-parchment px-1.5 py-1 text-center text-xs text-ink outline-none focus:border-bronze disabled:opacity-50"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Vista previa: la tabla del reglamento, ya calculada. */}
          {activas.length > 0 && (
            <div>
              <p className="mb-1 text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">
                Así queda la tabla
              </p>
              <div className="overflow-x-auto rounded-sm border border-rule-dark/30">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-parchment-dark/50 text-ink-soft">
                      <th className="border-b border-rule-dark/30 px-2 py-1.5 text-left font-semibold">Puntos</th>
                      {activas.map((c) => (
                        <th key={c.id} className="border-b border-rule-dark/30 px-2 py-1.5 text-center font-semibold">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-dark/15">
                    {PREVIEW_POINTS.map((points) => (
                      <tr key={points}>
                        <td className="px-2 py-1 text-ink-soft">
                          {points < TIER_START_POINTS
                            ? `< ${TIER_START_POINTS.toLocaleString('es-ES')}`
                            : `${points.toLocaleString('es-ES')} - ${(points + TIER_SIZE_POINTS - 1).toLocaleString('es-ES')}`}
                        </td>
                        {activas.map((c) => {
                          const r = draft[c.id]
                          const rule: CompositionRule = {
                            categoryId: c.id,
                            kind: r.kind,
                            base: r.base,
                            step: r.step,
                          }
                          return (
                            <td key={c.id} className="px-2 py-1 text-center tabular-nums text-ink">
                              {formatRuleValue(r.kind, ruleValueAt(rule, points))}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </Modal>
  )
}
