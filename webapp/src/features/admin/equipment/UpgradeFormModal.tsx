import { useState } from 'react'
import { UpgradeRepository } from '@/data/repositories/lookupRepositories'
import { RuleRepository } from '@/data/repositories/ruleRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { EditableAttributeTable, extractProfileInput } from '@/shared/ui/AttributeTable'
import { RelationEditor } from '@/shared/ui/RelationEditor'
import type { AttributeProfileInput, Upgrade } from '@/domain/types'

const BLANK_STATS: AttributeProfileInput = {
  m: null,
  ha: null,
  hp: null,
  f: null,
  r: null,
  h: null,
  i: null,
  a: null,
  l: null,
}

interface UpgradeFormModalProps {
  upgrade: Upgrade | null
  onClose: () => void
  onSaved: () => void
}

/**
 * Alta o edición de una opción de unidad. Además de descripción y coste,
 * permite darle una FICHA propia (perfil de atributos) y reglas especiales —
 * el caso de los "grupos de apoyo" —, y marcar si debe aparecer como una ficha
 * más en la sección "Fichas".
 */
export function UpgradeFormModal({ upgrade, onClose, onSaved }: UpgradeFormModalProps) {
  const [name, setName] = useState(upgrade?.name ?? '')
  const [cost, setCost] = useState(upgrade ? String(upgrade.cost) : '0')
  const [hasProfile, setHasProfile] = useState(Boolean(upgrade?.profile))
  const [stats, setStats] = useState<AttributeProfileInput>(
    upgrade?.profile ? extractProfileInput(upgrade.profile) : BLANK_STATS,
  )
  const [includeInSheets, setIncludeInSheets] = useState(upgrade?.includeInSheets ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Incompatibilidades con otras opciones de unidad.
  const { data: allUpgrades } = useAsync(() => UpgradeRepository.listAll())
  const { data: currentIncompat } = useAsync(
    () => (upgrade ? UpgradeRepository.listIncompatibleWith(upgrade.id) : Promise.resolve([])),
    [upgrade?.id],
  )
  const [incompatIds, setIncompatIds] = useState<Set<number> | null>(null)
  const selectedIncompat = incompatIds ?? new Set(currentIncompat ?? [])
  const [mutualGroup, setMutualGroup] = useState(false)

  const { data: allRules } = useAsync(() => RuleRepository.listAll())
  const { data: currentRules } = useAsync(
    () => (upgrade ? UpgradeRepository.listSpecialRules(upgrade.id) : Promise.resolve([])),
    [upgrade?.id],
  )
  const [ruleIds, setRuleIds] = useState<Set<number> | null>(null)
  // Se siembra la selección la primera vez que llegan las reglas actuales.
  const selectedRuleIds = ruleIds ?? new Set((currentRules ?? []).map((r) => r.id))

  async function handleSubmit() {
    if (!name.trim()) {
      setError('La descripción es obligatoria.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const input = { name: name.trim(), cost: Number(cost) || 0 }
      const upgradeId = upgrade ? (await UpgradeRepository.update(upgrade.id, input), upgrade.id) : await UpgradeRepository.create(input)

      // Ficha propia: crear/actualizar, o quitarla si se ha desmarcado.
      if (hasProfile) {
        await UpgradeRepository.saveProfile(upgradeId, upgrade?.profile?.id ?? null, stats)
      } else if (upgrade?.profile) {
        await UpgradeRepository.removeProfile(upgradeId, upgrade.profile.id)
      }

      // "Incluir en fichas" solo tiene sentido con ficha propia.
      await UpgradeRepository.setIncludeInSheets(upgradeId, hasProfile && includeInSheets)

      await UpgradeRepository.replaceSpecialRules(upgradeId, [...selectedRuleIds])
      await UpgradeRepository.setIncompatibilities(upgradeId, [...selectedIncompat])
      // Grupo excluyente: además de "esta contra las demás", se enlazan todas
      // las seleccionadas entre sí (lo que hace falta para las marcas).
      if (mutualGroup && selectedIncompat.size > 1) {
        await UpgradeRepository.setExclusiveGroup(
          [upgradeId, ...selectedIncompat],
          `Solo se puede llevar una opción de este grupo (${name.trim()})`,
        )
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  const ruleItems = (allRules ?? []).map((r) => ({ id: r.id, name: r.name, description: r.description }))

  return (
    <Modal
      title={upgrade ? 'Editar opción de unidad' : 'Nueva opción de unidad'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <TextField label="Descripción" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="w-24">
          <TextField label="Coste (pts)" type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>

        <div className="border-t border-rule-dark/20 pt-4">
          <label className="flex items-center gap-2 text-xs text-ink">
            <input
              type="checkbox"
              className="accent-maroon"
              checked={hasProfile}
              onChange={(e) => setHasProfile(e.target.checked)}
            />
            Esta opción tiene ficha propia (perfil de atributos)
          </label>
          <p className="mt-1 text-mini text-ink-soft">
            Para opciones como los grupos de apoyo. Al elegirla dentro de una unidad, su perfil se añade a la tabla de
            características, igual que una montura.
          </p>

          {hasProfile && (
            <div className="mt-3 space-y-3">
              <EditableAttributeTable value={stats} onChange={setStats} />
              <label className="flex items-center gap-2 text-xs text-ink">
                <input
                  type="checkbox"
                  className="accent-maroon"
                  checked={includeInSheets}
                  onChange={(e) => setIncludeInSheets(e.target.checked)}
                />
                Incluir en hojas de unidad (que aparezca como una hoja más en esa sección)
              </label>
            </div>
          )}
        </div>

        <div className="border-t border-rule-dark/20 pt-4">
          <p className="mb-1 text-xs font-medium text-ink-soft">Incompatible con</p>
          <p className="mb-2 text-mini text-ink-soft">
            Al montar un ejército, marcar esta opción deshabilitará las que elijas aquí (y al revés).
          </p>
          <RelationEditor
            allItems={(allUpgrades ?? [])
              .filter((u) => u.id !== upgrade?.id)
              .map((u) => ({ id: u.id, name: u.name, cost: u.cost }))}
            selectedIds={selectedIncompat}
            onToggle={(id, enabled) => {
              const next = new Set(selectedIncompat)
              if (enabled) next.add(id)
              else next.delete(id)
              setIncompatIds(next)
            }}
            onToggleMany={(ids, enabled) => {
              const next = new Set(selectedIncompat)
              for (const id of ids) {
                if (enabled) next.add(id)
                else next.delete(id)
              }
              setIncompatIds(next)
            }}
            multiSelect
            addLabel="Añadir incompatibilidad"
          />
          <label className="mt-3 flex items-start gap-2 text-xs text-ink">
            <input
              type="checkbox"
              className="mt-0.5 accent-maroon"
              checked={mutualGroup}
              onChange={(e) => setMutualGroup(e.target.checked)}
            />
            <span>
              Excluyentes entre sí
              <span className="block text-mini text-ink-soft">
                Además de contra esta, las seleccionadas quedan incompatibles unas con otras. Para grupos como las
                marcas: basta con hacerlo una vez desde cualquiera de ellas.
              </span>
            </span>
          </label>
        </div>

        <div className="border-t border-rule-dark/20 pt-4">
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Reglas especiales de la opción</p>
          <RelationEditor
            allItems={ruleItems}
            selectedIds={selectedRuleIds}
            onToggle={(id, enabled) => {
              const next = new Set(selectedRuleIds)
              if (enabled) next.add(id)
              else next.delete(id)
              setRuleIds(next)
            }}
            addLabel="Añadir regla especial"
            confirmRemove={false}
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
