import { useState } from 'react'
import type { ProfileCatalogEntry, ProfileCatalogInput } from '@/data/repositories/profileCatalogRepository'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { RelationEditor } from '@/shared/ui/RelationEditor'
import type { AttributeProfile, Faction, SpecialRule } from '@/domain/types'

const ATTRIBUTE_FIELDS: { key: keyof ProfileCatalogInput; label: string }[] = [
  { key: 'm', label: 'M' },
  { key: 'ha', label: 'HA' },
  { key: 'hp', label: 'HP' },
  { key: 'f', label: 'F' },
  { key: 'r', label: 'R' },
  { key: 'h', label: 'H' },
  { key: 'i', label: 'I' },
  { key: 'a', label: 'A' },
  { key: 'l', label: 'L' },
]

function toInput(profile: AttributeProfile | null): ProfileCatalogInput {
  return {
    name: profile?.name ?? '',
    m: profile?.m ?? null, ha: profile?.ha ?? null, hp: profile?.hp ?? null,
    f: profile?.f ?? null, r: profile?.r ?? null, h: profile?.h ?? null,
    i: profile?.i ?? null, a: profile?.a ?? null, l: profile?.l ?? null,
    equippableByCharacter: profile?.equippableByCharacter ?? false,
    includeInSheets: profile?.includeInSheets ?? false,
  }
}

interface ProfileCatalogFormModalProps {
  title: string
  entry: ProfileCatalogEntry | null
  factions: Faction[]
  onClose: () => void
  onSave: (input: ProfileCatalogInput) => Promise<void>
  /** Solo disponibles cuando se edita una ficha ya existente (necesita su id). */
  onToggleFaction?: (factionId: number, enabled: boolean) => Promise<void>
  /** Solo el catálogo "Monturas" ofrece este campo; los carros no lo usan. */
  showEquippableByCharacter?: boolean
  /** Solo el catálogo "Monturas": si la ficha aparece en la sección "Fichas". */
  showIncludeInSheets?: boolean
  /**
   * Catálogo completo de reglas especiales. Si se indica (junto con
   * `onSetSpecialRules`), la ficha ofrece asignarle reglas propias — es el
   * caso de "Montura/Dotación", donde están los monstruos.
   */
  allRules?: SpecialRule[]
  /** Guarda de golpe las reglas de la ficha. Solo al editar una ya existente (necesita su id). */
  onSetSpecialRules?: (ruleIds: number[]) => Promise<void>
}

export function ProfileCatalogFormModal({
  title,
  entry,
  factions,
  onClose,
  onSave,
  onToggleFaction,
  showEquippableByCharacter,
  showIncludeInSheets,
  allRules,
  onSetSpecialRules,
}: ProfileCatalogFormModalProps) {
  const [input, setInput] = useState<ProfileCatalogInput>(() => toInput(entry?.profile ?? null))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [factionIds, setFactionIds] = useState<Set<number>>(new Set(entry?.factionIds ?? []))
  const [ruleIds, setRuleIds] = useState<Set<number>>(new Set((entry?.specialRules ?? []).map((r) => r.id)))

  async function handleSubmit() {
    if (!input.name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(input)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const factionItems = factions.map((f) => ({ id: f.id, name: f.name }))
  const ruleItems = (allRules ?? []).map((r) => ({ id: r.id, name: r.name, description: r.description }))

  return (
    <Modal
      title={title}
      onClose={onClose}
      widthClassName="max-w-xl"
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
      <div className="space-y-4">
        <TextField label="Nombre" value={input.name} onChange={(e) => setInput({ ...input, name: e.target.value })} autoFocus />

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-soft">Ficha de atributos</p>
          <div className="grid grid-cols-9 gap-1.5">
            {ATTRIBUTE_FIELDS.map(({ key, label }) => (
              <label key={key} className="block text-center">
                <span className="mb-1 block text-mini text-ink-soft">{label}</span>
                <input
                  value={(input[key] as string | null) ?? ''}
                  onChange={(e) => setInput({ ...input, [key]: e.target.value || null })}
                  className="w-full rounded-sm border border-rule-dark/50 bg-parchment/70 px-1 py-1 text-center text-xs text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/25"
                />
              </label>
            ))}
          </div>
        </div>

        {showEquippableByCharacter && (
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              className="accent-maroon"
              checked={input.equippableByCharacter}
              onChange={(e) => setInput({ ...input, equippableByCharacter: e.target.checked })}
            />
            Puede ser equipado por un personaje
          </label>
        )}

        {/* Mismo criterio que en las opciones de unidad: tener ficha no
            implica quererla impresa. El catálogo está lleno de cabalgaduras de
            tropa que no interesa sacar por separado. */}
        {showIncludeInSheets && (
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              className="mt-0.5 accent-maroon"
              checked={input.includeInSheets}
              onChange={(e) => setInput({ ...input, includeInSheets: e.target.checked })}
            />
            <span>
              Incluir en hojas de unidad
              <span className="mt-0.5 block text-[10.5px] text-ink-soft">
                Aparecerá como una hoja más en la sección «Hojas de Unidad», con sus atributos y sus reglas.
              </span>
            </span>
          </label>
        )}

        {/* Reglas propias del monstruo/montura: se suman a las del jinete en
            todas las unidades que lo lleven, sin repetirlas una por una. */}
        {allRules && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink-soft">Reglas especiales</p>
            {entry && onSetSpecialRules ? (
              <>
                <p className="mb-2 text-xs text-ink-soft">
                  Son de la propia ficha (p.&nbsp;ej. las de un monstruo). Se añaden a las de cualquier unidad que la
                  lleve, sin tener que repetirlas en cada una.
                </p>
                <RelationEditor
                  allItems={ruleItems}
                  selectedIds={ruleIds}
                  onToggle={(ruleId, enabled) => {
                    const previous = ruleIds
                    const next = new Set(ruleIds)
                    if (enabled) next.add(ruleId)
                    else next.delete(ruleId)
                    setRuleIds(next)
                    // Se marca al momento (la lista responde sola) pero, si la
                    // escritura falla, se DESHACE y se avisa. Antes la promesa
                    // se dejaba suelta: la regla se quedaba marcada en pantalla
                    // aunque no se hubiera guardado nada, y el fallo solo se
                    // descubría al no verla luego en su ficha.
                    void onSetSpecialRules([...next]).catch((err: unknown) => {
                      setRuleIds(previous)
                      setError(
                        `No se pudieron guardar las reglas: ${err instanceof Error ? err.message : String(err)}. Si la base de datos no tiene todavía la tabla "profile_special_rules", hay que desplegar el Worker.`,
                      )
                    })
                  }}
                  addLabel="Añadir regla especial"
                  emptyLabel="No hay reglas especiales en el catálogo todavía."
                  confirmRemove
                />
              </>
            ) : (
              <p className="text-xs text-ink-soft italic">Guarda la ficha primero; después podrás asignarle reglas.</p>
            )}
          </div>
        )}

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-soft">Facciones asociadas</p>
          {entry && onToggleFaction ? (
            <RelationEditor
              allItems={factionItems}
              selectedIds={factionIds}
              onToggle={(factionId, enabled) => {
                const previous = factionIds
                const next = new Set(factionIds)
                if (enabled) next.add(factionId)
                else next.delete(factionId)
                setFactionIds(next)
                // Mismo criterio que con las reglas: si falla, se deshace y se
                // dice, en vez de dejar en pantalla algo que no se guardó.
                void onToggleFaction(factionId, enabled).catch((err: unknown) => {
                  setFactionIds(previous)
                  setError(
                    `No se pudo guardar la facción asociada: ${err instanceof Error ? err.message : String(err)}`,
                  )
                })
              }}
              addLabel="Asociar facción"
              emptyLabel="No hay facciones registradas todavía."
            />
          ) : (
            <p className="text-xs text-ink-soft italic">Guarda la ficha primero; después podrás asociarle facciones.</p>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
