import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { FactionRepository } from '@/data/repositories/factionRepository'
import { ImportRepository, ALL_FIELDS, type ImportDiffItem, type ImportFields } from '@/data/repositories/importRepository'
import { parseArmyBook } from '@/features/admin/import/armyBookParser'
import { extractTextFromFile } from '@/features/admin/import/extractText'
import { useAsync } from '@/shared/hooks/useAsync'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Select } from '@/shared/ui/Select'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { Tooltip } from '@/shared/ui/Tooltip'
import { WarningIcon } from '@/shared/ui/icons'

const ATTR_LABELS: Array<[keyof NonNullable<ImportDiffItem['parsed']['profile']>, string]> = [
  ['m', 'M'],
  ['ha', 'HA'],
  ['hp', 'HP'],
  ['f', 'F'],
  ['r', 'R'],
  ['h', 'H'],
  ['i', 'I'],
  ['a', 'A'],
  ['l', 'L'],
]

/** Campos que el usuario puede elegir actualizar, con su etiqueta. */
const FIELD_LABELS: Array<[keyof ImportFields, string]> = [
  ['name', 'Nombre'],
  ['category', 'Categoría / tipo'],
  ['cost', 'Coste'],
  ['size', 'Tamaño'],
  ['profile', 'Perfil de atributos'],
  ['equipText', 'Equipo básico y T.S.'],
  ['equipmentOptions', 'Opciones de equipo'],
  ['mountsOptions', 'Monturas y opciones'],
  ['command', 'Grupo de mando'],
  ['rules', 'Reglas especiales'],
]

/**
 * "Importar/Editar desde Libro de ejército": el usuario elige una facción y
 * adjunta un archivo (PDF/.docx/.md/.txt) de un libro de ejército. El programa
 * extrae el texto en el propio navegador (ver extractText.ts), lo parsea (ver
 * armyBookParser.ts) y muestra qué unidades son NUEVAS y cuáles se
 * ACTUALIZARÍAN (emparejando por nombre dentro de la facción). El usuario marca
 * las que quiera y pulsa "Aplicar" para darlas de alta/actualizarlas.
 */
export function ImportBookPage() {
  const { data: factions, loading: loadingFactions } = useAsync(() => FactionRepository.listAll())
  const [factionId, setFactionId] = useState<number | null>(null)
  const [status, setStatus] = useState<'idle' | 'parsing' | 'ready' | 'applying'>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [items, setItems] = useState<ImportDiffItem[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [fields, setFields] = useState<ImportFields>(ALL_FIELDS)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (factionId == null && factions && factions.length > 0) setFactionId(factions[0].id)
  }, [factions, factionId])

  /** Vuelve la pantalla a su estado inicial (como recién abierta). `keepFlash` conserva el aviso de "importado" tras aplicar. */
  function resetPreview(keepFlash = false) {
    setItems([])
    setSelected(new Set())
    setProgress(null)
    setStatus('idle')
    setFileName(null)
    if (!keepFlash) setFlash(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFile(file: File) {
    if (factionId == null) return
    setError(null)
    setFlash(null)
    setStatus('parsing')
    setFileName(file.name)
    try {
      const text = await extractTextFromFile(file)
      const parsed = parseArmyBook(text)
      if (parsed.length === 0) {
        setError('No se han detectado unidades en el archivo. ¿Tiene el formato de lista de ejército esperado (secciones COMANDANTES/HÉROES/UNIDADES… con perfiles M HA HP…)?')
        setStatus('idle')
        return
      }
      const plan = await ImportRepository.planImport(factionId, parsed)
      setItems(plan)
      setSelected(new Set(plan.map((_, i) => i))) // todo marcado por defecto
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('idle')
    }
  }

  async function handleApply() {
    if (factionId == null) return
    const chosen = items.filter((_, i) => selected.has(i))
    if (chosen.length === 0) return
    setStatus('applying')
    setError(null)
    setProgress({ done: 0, total: chosen.length })
    try {
      const res = await ImportRepository.applyImport(factionId, chosen, fields, (done, total) => setProgress({ done, total }))
      // Al terminar, se vuelve al estado inicial (como al abrir la pantalla),
      // dejando solo un aviso breve de lo importado.
      setFlash(`✓ Importado: ${res.created} nuevas, ${res.updated} actualizadas.`)
      resetPreview(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('ready')
    }
  }

  const newCount = items.filter((it) => it.existingUnitId == null).length
  const updateCount = items.length - newCount
  const selectedCount = selected.size
  const anyFieldSelected = Object.values(fields).some(Boolean)

  function toggle(index: number) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }
  function setAll(value: boolean) {
    setSelected(value ? new Set(items.map((_, i) => i)) : new Set())
  }

  return (
    <div>
      <PageHeader
        title="Importar/Editar desde Libro de ejército"
        description="Adjunta un libro de ejército (PDF, Word, Markdown o texto) y el programa extraerá sus unidades para darlas de alta o actualizarlas en la facción elegida."
      />

      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div className="w-64">
          <Select
            label="Facción de destino"
            value={factionId ?? ''}
            onChange={(e) => {
              setFactionId(Number(e.target.value))
              resetPreview()
            }}
            disabled={status === 'parsing' || status === 'applying'}
          >
            {(factions ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.md,.markdown,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loadingFactions || factionId == null || status === 'parsing' || status === 'applying'}
          className="whitespace-nowrap rounded-sm border border-rule-dark/60 bg-parchment px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-parchment-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {fileName ? '📄 Cambiar archivo' : '📎 Adjuntar archivo'}
        </button>
        {fileName && (
          <span className="max-w-[240px] truncate text-xs text-ink-soft" title={fileName}>
            {fileName}
          </span>
        )}
        {status === 'ready' && (
          <button onClick={() => resetPreview()} className="text-xs font-medium text-ink-soft hover:text-ink">
            Empezar de nuevo
          </button>
        )}
      </div>

      {flash && (
        <div className="mb-4 rounded-sm border border-bronze/50 bg-bronze/10 px-4 py-2.5">
          <p className="text-sm text-ink">{flash}</p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-sm border border-danger-dark/40 bg-danger-dark/10 px-4 py-3">
          <p className="text-xs text-danger-dark">{error}</p>
        </div>
      )}

      {status === 'parsing' && <Spinner label="Analizando el archivo…" />}

      {(status === 'ready' || status === 'applying') && items.length > 0 && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-ink-soft">
              {items.length} unidades detectadas · <span className="font-medium text-success">{newCount} nuevas</span> ·{' '}
              <span className="font-medium text-bronze">{updateCount} a actualizar</span>
            </span>
            <span className="text-ink-soft">|</span>
            <button onClick={() => setAll(true)} className="text-xs text-ink-soft hover:text-ink">
              Marcar todas
            </button>
            <button onClick={() => setAll(false)} className="text-xs text-ink-soft hover:text-ink">
              Desmarcar todas
            </button>
          </div>

          <div className="mb-4 rounded-sm border border-rule-dark/40 bg-parchment/60 px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Qué actualizar de cada unidad</p>
              <div className="flex items-center gap-1 text-mini text-ink-soft">
                <button
                  onClick={() => setFields({ ...ALL_FIELDS })}
                  disabled={status !== 'ready'}
                  className="rounded-sm px-1.5 py-0.5 hover:text-ink disabled:opacity-50"
                >
                  Todo
                </button>
                <span className="text-rule-dark/50">·</span>
                <button
                  onClick={() => setFields(Object.fromEntries(FIELD_LABELS.map(([k]) => [k, false])) as unknown as ImportFields)}
                  disabled={status !== 'ready'}
                  className="rounded-sm px-1.5 py-0.5 hover:text-ink disabled:opacity-50"
                >
                  Nada
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {FIELD_LABELS.map(([key, label]) => {
                const on = fields[key]
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={status !== 'ready'}
                    onClick={() => setFields((f) => ({ ...f, [key]: !f[key] }))}
                    aria-pressed={on}
                    className={clsx(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50',
                      on
                        ? 'border-maroon/50 bg-maroon/10 text-maroon'
                        : 'border-rule-dark/40 bg-parchment text-ink-soft hover:bg-parchment-dark hover:text-ink',
                    )}
                  >
                    <span
                      className={clsx(
                        'flex h-3.5 w-3.5 items-center justify-center rounded-full border text-micro leading-none',
                        on ? 'border-maroon bg-maroon text-parchment' : 'border-rule-dark/50 text-transparent',
                      )}
                    >
                      ✓
                    </span>
                    {label}
                  </button>
                )
              })}
            </div>
            <p className="mt-2.5 text-mini text-ink-soft">
              Solo se tocan los campos marcados; el resto de la ficha se conserva. En las unidades nuevas se crea la ficha
              con los campos marcados (los no marcados quedan vacíos).
            </p>
          </div>

          <div className="overflow-x-auto rounded-sm border border-rule-dark/30">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-parchment-dark/50 text-ink-soft">
                  <th className="w-8 border-b border-rule-dark/30 py-1.5" />
                  <th className="border-b border-rule-dark/30 py-1.5 px-2 text-left font-semibold">Unidad</th>
                  <th className="border-b border-rule-dark/30 py-1.5 px-2 text-left font-semibold">Estado</th>
                  <th className="border-b border-rule-dark/30 py-1.5 px-2 text-left font-semibold">Cat.</th>
                  <th className="border-b border-rule-dark/30 py-1.5 px-2 text-center font-semibold">Coste</th>
                  <th className="border-b border-rule-dark/30 py-1.5 px-2 text-center font-semibold">Tam.</th>
                  <th className="border-b border-rule-dark/30 py-1.5 px-2 text-center font-semibold">Perfil (M·HA·HP·F·R·H·I·A·L)</th>
                  <th className="border-b border-rule-dark/30 py-1.5 px-2 text-center font-semibold">Reglas</th>
                  <th className="border-b border-rule-dark/30 py-1.5 px-2 text-center font-semibold">Opc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule-dark/15">
                {items.map((it, i) => {
                  const p = it.parsed
                  const isNew = it.existingUnitId == null
                  const prof = p.profile ? ATTR_LABELS.map(([k]) => p.profile![k] ?? '–').join(' ') : '—'
                  return (
                    <tr key={i} className={clsx('align-top', selected.has(i) ? 'bg-parchment/40' : 'opacity-60')}>
                      <td className="py-1.5 text-center">
                        <input
                          type="checkbox"
                          className="accent-maroon"
                          checked={selected.has(i)}
                          onChange={() => toggle(i)}
                          disabled={status !== 'ready'}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <span className="font-medium text-ink">{p.name}</span>
                        {p.isUnique && <span className="ml-1 text-micro text-bronze">0-1</span>}
                        {p.warnings.length > 0 && (
                          <Tooltip label={p.warnings.join(' · ')} className="mt-0.5 flex items-start gap-1 text-danger">
                            <WarningIcon className="mt-px h-3 w-3 shrink-0" />
                            <span className="text-micro">{p.warnings[0]}</span>
                          </Tooltip>
                        )}
                      </td>
                      <td className="py-1.5 px-2">
                        {isNew ? (
                          <span className="rounded-sm bg-success/10 px-1.5 py-0.5 font-medium text-success">Nueva</span>
                        ) : (
                          <span className="rounded-sm bg-bronze/15 px-1.5 py-0.5 font-medium text-bronze">Actualizar</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-ink-soft">
                        {p.categoryCode === 'PERSONAJE' ? 'Personaje' : p.categoryCode === 'BASICA' ? 'Básica' : p.categoryCode === 'ESPECIAL' ? 'Especial' : 'Singular'}
                      </td>
                      <td className="py-1.5 px-2 text-center text-ink">
                        {p.baseCost != null ? `${p.baseCost}${p.perModel ? '/m' : ''}` : '—'}
                      </td>
                      <td className="py-1.5 px-2 text-center text-ink-soft">
                        {p.minSize != null ? `${p.minSize}${p.maxSize != null ? `-${p.maxSize}` : '+'}` : '—'}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono text-mini text-ink-soft whitespace-nowrap">{prof}</td>
                      <td className="py-1.5 px-2 text-center text-ink-soft" title={p.specialRules.join(', ')}>
                        {p.specialRules.length || '—'}
                      </td>
                      <td className="py-1.5 px-2 text-center text-ink-soft" title={p.options.map((o) => `${o.name} (+${o.cost}${o.perModel ? '/m' : ''})`).join(' · ')}>
                        {p.options.length || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="sticky bottom-0 z-10 -mx-6 mt-4 flex items-center gap-4 border-t border-rule-dark/40 bg-parchment/95 px-6 py-3 backdrop-blur-sm">
            <Button
              variant="primary"
              onClick={handleApply}
              disabled={status !== 'ready' || selectedCount === 0 || !anyFieldSelected}
            >
              {status === 'applying'
                ? `Aplicando… ${progress ? `${progress.done}/${progress.total}` : ''}`
                : `Aplicar cambios (${selectedCount})`}
            </Button>
            <span className="text-xs text-ink-soft">
              {selectedCount} de {items.length} unidades marcadas
            </span>
            {!anyFieldSelected && status === 'ready' && (
              <span className="text-xs text-danger">· Marca al menos un campo a actualizar.</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
