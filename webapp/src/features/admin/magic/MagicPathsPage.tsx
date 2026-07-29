// ============================================================================
// "Sendas de magia" — catálogo de sendas y sus hechizos.
//
// Dos columnas: a la izquierda las sendas agrupadas por su grupo (Elementales,
// Místicas, Oscuras, Manuscritos), a la derecha los hechizos de la
// seleccionada, ordenados por nivel.
//
// Sobre los AVISOS: la estructura normal de una senda son 7 hechizos (2 de
// nivel 1, 2 de nivel 2, 2 de nivel 3 y 1 de nivel 4) y la cumplen 28 de las
// 30 del catálogo original. Las otras dos vienen así del fichero de origen. Se
// señalan en amarillo, NO se bloquean: son datos reales del usuario y
// esconderlos o rechazarlos sería peor que enseñar el aviso. Lo único que se
// impide es que una senda crezca por encima del tope (ver MAX_SPELLS_PER_PATH).
// ============================================================================
import { useState } from 'react'
import { clsx } from 'clsx'
import { MagicRepository } from '@/data/repositories/magicRepository'
import { toCatalogCode } from '@/data/repositories/lookupRepositories'
import {
  MAGIC_GROUPS,
  MAGIC_GROUP_LABELS,
  MAGIC_LEVELS,
  MAX_SPELLS_PER_PATH,
  pathWarnings,
  type MagicGroup,
  type MagicPathDetail,
  type MagicSpell,
  type MagicSpellInput,
} from '@/domain/magic'
import { useAsync } from '@/shared/hooks/useAsync'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Panel } from '@/shared/ui/Panel'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Select } from '@/shared/ui/Select'
import { TextField } from '@/shared/ui/TextField'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Modal } from '@/shared/ui/Modal'
import { TrashIcon } from '@/shared/ui/icons'

const EMPTY_SPELL: MagicSpellInput = {
  level: 1,
  name: '',
  difficulty: null,
  range: null,
  hits: null,
  damage: null,
  staysActive: false,
  cac: null,
  rules: null,
}

/** Campo de texto que guarda null en vez de cadena vacía: en la base, "sin dato" es NULL. */
function OptionalField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
}) {
  return (
    <TextField
      label={label}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.trim() === '' ? null : e.target.value)}
    />
  )
}

function SpellFormModal({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string
  initial: MagicSpellInput
  onClose: () => void
  onSave: (input: MagicSpellInput) => Promise<void>
}) {
  const [draft, setDraft] = useState<MagicSpellInput>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = (values: Partial<MagicSpellInput>) => setDraft((d) => ({ ...d, ...values }))

  async function handleSave() {
    if (!draft.name.trim()) {
      setError('El hechizo necesita un nombre.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ ...draft, name: draft.name.trim() })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Nivel"
            value={String(draft.level)}
            onChange={(e) => patch({ level: Number(e.target.value) })}
          >
            {MAGIC_LEVELS.map((level) => (
              <option key={level} value={level}>
                Nivel {level}
              </option>
            ))}
          </Select>
          <OptionalField
            label="Dificultad"
            value={draft.difficulty}
            onChange={(v) => patch({ difficulty: v })}
            placeholder="6+"
          />
        </div>

        <TextField label="Nombre" value={draft.name} onChange={(e) => patch({ name: e.target.value })} />

        <div className="grid grid-cols-2 gap-3">
          <OptionalField label="Alcance" value={draft.range} onChange={(v) => patch({ range: v })} placeholder="60 cm." />
          <OptionalField label="Impactos" value={draft.hits} onChange={(v) => patch({ hits: v })} placeholder="1D6" />
          <OptionalField label="Daño" value={draft.damage} onChange={(v) => patch({ damage: v })} placeholder="F4" />
          <OptionalField
            label="Distancia / CaC"
            value={draft.cac}
            onChange={(v) => patch({ cac: v })}
            placeholder="Fuera del CaC"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={draft.staysActive}
            onChange={(e) => patch({ staysActive: e.target.checked })}
            className="accent-maroon"
          />
          Permanece activo entre turnos
        </label>

        <div>
          <p className="mb-1 text-xs font-medium text-ink-soft">Resumen de reglas</p>
          <textarea
            value={draft.rules ?? ''}
            onChange={(e) => patch({ rules: e.target.value.trim() === '' ? null : e.target.value })}
            rows={4}
            className="w-full rounded-sm border border-rule-dark/40 bg-parchment px-2 py-1.5 text-sm text-ink outline-none focus:border-bronze"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}

export function MagicPathsPage() {
  const { data: paths, loading, reload } = useAsync(() => MagicRepository.listPathsWithSpells())
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [creatingPath, setCreatingPath] = useState(false)
  const [newPathName, setNewPathName] = useState('')
  const [newPathGroup, setNewPathGroup] = useState<MagicGroup>('ELEMENTALES')
  const [editingSpell, setEditingSpell] = useState<MagicSpell | null>(null)
  const [addingSpell, setAddingSpell] = useState(false)
  const [deletingSpell, setDeletingSpell] = useState<MagicSpell | null>(null)
  const [deletingPath, setDeletingPath] = useState<MagicPathDetail | null>(null)
  const [editingPath, setEditingPath] = useState<MagicPathDetail | null>(null)
  const [editingPathName, setEditingPathName] = useState('')
  const [editingPathGroup, setEditingPathGroup] = useState<MagicGroup>('ELEMENTALES')
  const [error, setError] = useState<string | null>(null)

  const selected = (paths ?? []).find((p) => p.id === selectedId) ?? null
  const warnings = selected ? pathWarnings(selected.spells) : []
  const full = (selected?.spells.length ?? 0) >= MAX_SPELLS_PER_PATH

  async function run(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div>
      <PageHeader
        title="Sendas de magia"
        description="Las sendas que puede conocer un hechicero, con sus hechizos. Se asignan a cada personaje desde el apartado «Magia» de su ficha."
        actions={
          <Button variant="primary" onClick={() => setCreatingPath(true)}>
            + Nueva senda
          </Button>
        }
      />

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {loading && <Spinner />}

      {!loading && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <Panel title="Sendas">
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {MAGIC_GROUPS.map((group) => {
                const groupPaths = (paths ?? []).filter((p) => p.group === group)
                if (groupPaths.length === 0) return null
                return (
                  <div key={group}>
                    <p className="mb-1 text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">
                      {MAGIC_GROUP_LABELS[group]}{' '}
                      <span className="text-ink-soft/60">({groupPaths.length})</span>
                    </p>
                    <ul className="space-y-1">
                      {groupPaths.map((path) => {
                        const issues = pathWarnings(path.spells)
                        return (
                          <li key={path.id}>
                            <button
                              onClick={() => setSelectedId(path.id)}
                              className={clsx(
                                'flex w-full items-center gap-2 rounded-sm border px-2 py-1.5 text-left text-xs transition-colors',
                                path.id === selectedId
                                  ? 'border-maroon bg-bronze/10'
                                  : 'border-rule-dark/30 hover:bg-parchment-dark/50',
                              )}
                            >
                              <span className="flex-1 truncate text-ink">{path.name}</span>
                              {issues.length > 0 && (
                                <span className="shrink-0 text-bronze" title={issues.join(' ')}>
                                  ⚠
                                </span>
                              )}
                              <span className="shrink-0 text-ink-soft">{path.spells.length}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          </Panel>

          {!selected ? (
            <EmptyState title="Elige una senda" description="Sus hechizos aparecerán aquí." />
          ) : (
            <Panel
              title={selected.name}
              subtitle={`${MAGIC_GROUP_LABELS[selected.group]} · ${selected.spells.length} ${selected.spells.length === 1 ? 'hechizo' : 'hechizos'}`}
              headerRight={
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => setAddingSpell(true)} disabled={full}>
                    + Hechizo
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditingPathName(selected.name)
                      setEditingPathGroup(selected.group)
                      setEditingPath(selected)
                    }}
                  >
                    Editar senda
                  </Button>
                  <Button variant="ghost" onClick={() => setDeletingPath(selected)}>
                    Borrar
                  </Button>
                </div>
              }
            >
              {warnings.length > 0 && (
                <div className="mb-3 rounded-sm border border-bronze/40 bg-bronze/10 px-3 py-2">
                  <p className="text-xs font-semibold text-ink">Esta senda se sale de la estructura habitual</p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-ink-soft">
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-mini text-ink-soft">
                    Es solo un aviso: los datos vienen así del fichero original y se respetan tal cual.
                  </p>
                </div>
              )}

              {full && (
                <p className="mb-3 text-xs text-ink-soft">
                  Ya tiene {MAX_SPELLS_PER_PATH} hechizos, el máximo. Para añadir otro, borra uno antes.
                </p>
              )}

              {selected.spells.length === 0 ? (
                <p className="text-xs text-ink-soft italic">Esta senda todavía no tiene hechizos.</p>
              ) : (
                <div className="space-y-4">
                  {MAGIC_LEVELS.map((level) => {
                    const spells = selected.spells.filter((s) => s.level === level)
                    if (spells.length === 0) return null
                    return (
                      <div key={level}>
                        <p className="mb-1 border-b border-rule-dark/25 pb-0.5 text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">
                          Nivel {level}
                        </p>
                        <ul className="divide-y divide-rule-dark/15">
                          {spells.map((spell) => (
                            <li key={spell.id} className="flex items-start gap-3 py-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-ink">
                                  {spell.name}
                                  {spell.difficulty && (
                                    <span className="ml-2 text-xs font-normal text-ink-soft">{spell.difficulty}</span>
                                  )}
                                  {spell.staysActive && (
                                    <span className="ml-2 rounded-sm border border-bronze/40 px-1 text-mini text-bronze">
                                      permanece activo
                                    </span>
                                  )}
                                </p>
                                <p className="mt-0.5 text-mini text-ink-soft">
                                  {[
                                    spell.range && `Alcance ${spell.range}`,
                                    spell.hits && `${spell.hits} impactos`,
                                    spell.damage,
                                    spell.cac,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ') || '—'}
                                </p>
                                {spell.rules && <p className="mt-1 text-xs text-ink-soft">{spell.rules}</p>}
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Button variant="ghost" onClick={() => setEditingSpell(spell)}>
                                  Editar
                                </Button>
                                <button
                                  className="rounded-sm px-1.5 py-0.5 text-ink-soft hover:bg-maroon/10 hover:text-danger"
                                  onClick={() => setDeletingSpell(spell)}
                                  aria-label={`Borrar ${spell.name}`}
                                  title="Borrar"
                                >
                                  <TrashIcon className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </Panel>
          )}
        </div>
      )}

      {creatingPath && (
        <Modal
          title="Nueva senda"
          onClose={() => setCreatingPath(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreatingPath(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                disabled={!newPathName.trim()}
                onClick={() =>
                  run(async () => {
                    // `toCatalogCode` y no un toUpperCase a mano: es la misma
                    // función que usan categorías y etiquetas, y quita tildes
                    // y puntuación. Sin ella, "Señorío" se guardaba como
                    // código "SEÑORÍO" y cualquier comparación posterior
                    // dependía de escribir las tildes igual.
                    await MagicRepository.createPath({
                      code: toCatalogCode(newPathName),
                      name: newPathName.trim(),
                      group: newPathGroup,
                    })
                    setCreatingPath(false)
                    setNewPathName('')
                  })
                }
              >
                Crear
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <TextField label="Nombre" value={newPathName} onChange={(e) => setNewPathName(e.target.value)} />
            <Select
              label="Grupo"
              value={newPathGroup}
              onChange={(e) => setNewPathGroup(e.target.value as MagicGroup)}
            >
              {MAGIC_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {MAGIC_GROUP_LABELS[group]}
                </option>
              ))}
            </Select>
          </div>
        </Modal>
      )}

      {editingPath && (
        <Modal
          title={`Editar ${editingPath.name}`}
          onClose={() => setEditingPath(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditingPath(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                disabled={!editingPathName.trim()}
                onClick={() =>
                  run(async () => {
                    // El CÓDIGO no se toca al renombrar: es la referencia
                    // estable de la senda y cambiarlo rompería cualquier
                    // asignación que dependiera de él.
                    await MagicRepository.updatePath(editingPath.id, {
                      code: editingPath.code,
                      name: editingPathName.trim(),
                      group: editingPathGroup,
                    })
                    setEditingPath(null)
                  })
                }
              >
                Guardar
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <TextField label="Nombre" value={editingPathName} onChange={(e) => setEditingPathName(e.target.value)} />
            <Select
              label="Grupo"
              value={editingPathGroup}
              onChange={(e) => setEditingPathGroup(e.target.value as MagicGroup)}
            >
              {MAGIC_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {MAGIC_GROUP_LABELS[group]}
                </option>
              ))}
            </Select>
            <p className="text-mini text-ink-soft">
              Código interno: <b>{editingPath.code}</b>. No cambia al renombrar.
            </p>
          </div>
        </Modal>
      )}

      {addingSpell && selected && (
        <SpellFormModal
          title={`Nuevo hechizo en ${selected.name}`}
          initial={EMPTY_SPELL}
          onClose={() => setAddingSpell(false)}
          onSave={async (input) => {
            await MagicRepository.addSpell(selected.id, input)
            reload()
          }}
        />
      )}

      {editingSpell && (
        <SpellFormModal
          title={`Editar ${editingSpell.name}`}
          initial={editingSpell}
          onClose={() => setEditingSpell(null)}
          onSave={async (input) => {
            await MagicRepository.updateSpell(editingSpell.id, input)
            reload()
          }}
        />
      )}

      {deletingSpell && (
        <ConfirmDialog
          title="Borrar hechizo"
          message={`Se borrará "${deletingSpell.name}".`}
          confirmLabel="Borrar"
          onCancel={() => setDeletingSpell(null)}
          onConfirm={() =>
            run(async () => {
              await MagicRepository.removeSpell(deletingSpell.id)
              setDeletingSpell(null)
            })
          }
        />
      )}

      {deletingPath && (
        <ConfirmDialog
          title="Borrar senda"
          message={`Se borrará "${deletingPath.name}" con sus ${deletingPath.spells.length} hechizos, y dejará de estar asignada a los personajes que la conocieran.`}
          confirmLabel="Borrar definitivamente"
          onCancel={() => setDeletingPath(null)}
          onConfirm={() =>
            run(async () => {
              await MagicRepository.removePath(deletingPath.id)
              setDeletingPath(null)
              setSelectedId(null)
            })
          }
        />
      )}
    </div>
  )
}
