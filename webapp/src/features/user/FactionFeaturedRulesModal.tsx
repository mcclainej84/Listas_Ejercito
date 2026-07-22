import { useEffect, useState } from 'react'
import { RuleRepository } from '@/data/repositories/ruleRepository'
import { UserRepository } from '@/data/repositories/userRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import type { Faction } from '@/domain/types'

/**
 * "Reglas destacadas" de una facción: cuáles quiere el usuario ver SIEMPRE
 * primero (separadas del resto por un filete) al montar una lista de esa
 * facción — ver ArmyListBuilderPage > panel "Ficha". Es preferencia
 * personal (ligada al usuario, no al catálogo compartido), por eso vive en
 * user_faction_rules y no en special_rules.
 *
 * Solo se ofrecen las reglas que una unidad de esta facción puede llegar a
 * llevar de verdad (ver RuleRepository.listByFaction): destacar una regla
 * que la facción no usa no cambiaría nada al montar el ejército.
 */
export function FactionFeaturedRulesModal({
  userId,
  faction,
  onClose,
  onSaved,
}: {
  userId: number
  faction: Faction
  onClose: () => void
  onSaved: () => void
}) {
  const { data: rules, loading } = useAsync(() => RuleRepository.listByFaction(faction.id), [faction.id])
  const { data: featured } = useAsync(() => UserRepository.getFactionRuleIds(userId, faction.id), [userId, faction.id])

  const [selected, setSelected] = useState<Set<number> | null>(null)
  useEffect(() => {
    if (featured) setSelected(new Set(featured))
  }, [featured])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await UserRepository.setFactionRuleIds(userId, faction.id, [...selected])
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev ?? [])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Modal
      title={`Reglas destacadas — ${faction.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !selected}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-ink-soft">
        Marca las reglas especiales que quieres ver siempre las primeras al montar una lista de <b>{faction.name}</b>.
        Aparecerán separadas del resto por un filete, y solo si la unidad las lleva de verdad.
      </p>

      {loading || !selected ? (
        <Spinner />
      ) : (rules ?? []).length === 0 ? (
        <p className="text-xs italic text-ink-soft">
          Todavía no hay unidades de esta facción con reglas especiales asignadas.
        </p>
      ) : (
        <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
          {(rules ?? []).map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1 text-sm text-ink hover:bg-parchment-dark/50"
            >
              <input
                type="checkbox"
                className="accent-maroon mt-0.5"
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
              />
              <span>
                <span className="font-medium">{r.name}</span>
                {r.description && <span className="block text-xs text-ink-soft">{r.description}</span>}
              </span>
            </label>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Modal>
  )
}
