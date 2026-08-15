// ============================================================================
// "Categorías y Etiquetas" — el catálogo de las dos taxonomías de unidad.
//
// Son dos cosas DISTINTAS que se confunden con facilidad, y por eso comparten
// pantalla pero no sección:
//
//   · CATEGORÍA  = el hueco de organización del ejército (Personajes, Básicas,
//                  Especiales, Singulares…). Manda en cómo se agrupan las
//                  unidades al montar una lista.
//   · ETIQUETA   = qué es la unidad sobre la mesa (Infantería, Caballería,
//                  Monstruo, Hechicero…). Es informativa.
//
// El ORDEN importa: es el que se usa para agrupar y ordenar en la sección
// Ejércitos, así que se puede reordenar arrastrando y el cambio se guarda.
//
// El CÓDIGO no se edita nunca. Es la referencia estable con la que el resto
// del programa reconoce una categoría ("¿es esta la de Personajes?"), y
// dejarlo cambiar convertiría un renombrado inocente en datos rotos. Se
// renombra lo visible; el código se queda como nació. Tampoco se MUESTRA: es
// el mismo nombre en mayúsculas (Personajes / PERSONAJE), así que en pantalla
// solo era la misma palabra dos veces.
// ============================================================================
import { useState } from 'react'
import { clsx } from 'clsx'
import { UnitCategoryRepository, UnitTypeTagRepository } from '@/data/repositories/lookupRepositories'
import { useAsync } from '@/shared/hooks/useAsync'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Panel } from '@/shared/ui/Panel'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DragHandleIcon, TrashIcon } from '@/shared/ui/icons'

interface TaxonomyItem {
  id: number
  code: string
  name: string
  sortOrder: number
  /** Solo las etiquetas: peana estándar en cm para el Despliegue. */
  baseWidthCm?: number
  baseHeightCm?: number
}

interface TaxonomySectionProps {
  title: string
  items: TaxonomyItem[]
  usage: Map<number, number>
  /** Qué se dice al borrar algo que todavía usan unidades. */
  usageNoun: string
  onCreate: (name: string) => Promise<void>
  onRename: (id: number, name: string) => Promise<void>
  onRemove: (id: number) => Promise<void>
  onReorder: (orderedIds: number[]) => Promise<void>
  /**
   * Solo las etiquetas: cambiar la peana estándar. Si no se pasa, la columna
   * de medidas no se pinta — las categorías no tienen tamaño.
   */
  onSetBaseSize?: (id: number, widthCm: number, heightCm: number) => Promise<void>
}

/**
 * La peana estándar de una etiqueta: "12 × 10 cm".
 *
 * Escribe en la base al SALIR del campo (o con Intro), no en cada tecla. Antes
 * guardaba en cada pulsación, y eso significa que al cambiar 12 por 5 pasaba
 * antes por el 1 y por el 12 5: tres escrituras, dos de ellas de un valor que
 * nadie quiso, y la lista recargándose bajo el cursor. Con Escape se vuelve a
 * lo que había.
 */
function MedidaPeana({
  anchoCm,
  altoCm,
  etiqueta,
  onCommit,
}: {
  anchoCm: number
  altoCm: number
  etiqueta: string
  onCommit: (anchoCm: number, altoCm: number) => void
}) {
  const [borrador, setBorrador] = useState<{ ancho: string; alto: string } | null>(null)
  const ancho = borrador?.ancho ?? String(anchoCm)
  const alto = borrador?.alto ?? String(altoCm)

  function confirmar() {
    if (!borrador) return
    const a = Number(borrador.ancho)
    const b = Number(borrador.alto)
    setBorrador(null)
    // Un 0, un negativo o un campo vacío no son una peana: se descartan y
    // queda lo que había.
    if (!(a > 0) || !(b > 0)) return
    if (a === anchoCm && b === altoCm) return
    onCommit(a, b)
  }

  // Sin las flechitas del <input type="number">: a este ancho se comen la
  // cifra en cuanto el ratón pasa por encima, y una medida se teclea, no se
  // sube de una en una. El campo solo se dibuja al apuntarlo o al escribir en
  // él, para que la lista se lea como una tabla y no como un formulario.
  const campo =
    'w-9 rounded-sm border border-transparent bg-transparent py-0.5 text-center text-mini tabular-nums text-ink ' +
    'outline-none hover:border-rule-dark/30 focus:border-bronze focus:bg-parchment ' +
    '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

  return (
    <span
      className="flex w-28 shrink-0 items-center justify-end gap-0.5"
      title={`Peana estándar de ${etiqueta} en el Despliegue: ancho × fondo, en cm`}
    >
      <input
        type="number"
        min={1}
        step={0.5}
        value={ancho}
        onChange={(e) => setBorrador({ ancho: e.target.value, alto })}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setBorrador(null)
        }}
        aria-label={`Ancho de la peana de ${etiqueta} en cm`}
        className={campo}
      />
      <span className="text-mini text-ink-soft/50">×</span>
      <input
        type="number"
        min={1}
        step={0.5}
        value={alto}
        onChange={(e) => setBorrador({ ancho, alto: e.target.value })}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setBorrador(null)
        }}
        aria-label={`Fondo de la peana de ${etiqueta} en cm`}
        className={campo}
      />
      <span className="w-5 text-mini text-ink-soft/50">cm</span>
    </span>
  )
}

function TaxonomySection({
  title,
  items,
  usage,
  usageNoun,
  onCreate,
  onRename,
  onRemove,
  onReorder,
  onSetBaseSize,
}: TaxonomySectionProps) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deleting, setDeleting] = useState<TaxonomyItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragId, setDragId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleDrop(targetId: number) {
    const from = items.findIndex((i) => i.id === dragId)
    const to = items.findIndex((i) => i.id === targetId)
    setDragId(null)
    setDragOverId(null)
    if (from === -1 || to === -1 || from === to) return
    const next = items.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    await run(() => onReorder(next.map((i) => i.id)))
  }

  return (
    <Panel title={title}>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newName.trim()) {
              void run(async () => {
                await onCreate(newName)
                setNewName('')
              })
            }
          }}
          placeholder="Nombre nuevo"
          className="min-w-0 flex-1 rounded-sm border border-rule-dark/40 bg-parchment px-2 py-1.5 text-sm text-ink outline-none focus:border-bronze"
        />
        <Button
          variant="secondary"
          disabled={busy || !newName.trim()}
          onClick={() =>
            run(async () => {
              await onCreate(newName)
              setNewName('')
            })
          }
        >
          + Añadir
        </Button>
      </div>

      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      {items.length === 0 ? (
        <p className="text-xs text-ink-soft italic">Todavía no hay ninguna.</p>
      ) : (
        <ul className="divide-y divide-rule-dark/15 overflow-hidden rounded-sm border border-rule-dark/30">
          {/* Cabecera de columnas. Los anchos son LOS MISMOS que los de la
              fila (w-28 la peana, w-20 el uso, y los dos huecos del tirador y
              de la papelera), que es lo único que mantiene los rótulos sobre
              su columna. */}
          <li className="flex items-center gap-2 bg-parchment-dark/40 px-2 py-1 text-micro font-semibold tracking-[0.12em] text-ink-soft/70 uppercase">
            <span className="w-[22px] shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">Nombre</span>
            {onSetBaseSize && <span className="w-28 shrink-0 text-right">Peana</span>}
            <span className="w-20 shrink-0 text-right">Uso</span>
            <span className="w-[26px] shrink-0" aria-hidden />
          </li>
          {items.map((item) => {
            const used = usage.get(item.id) ?? 0
            return (
              <li
                key={item.id}
                draggable={editingId !== item.id}
                onDragStart={() => setDragId(item.id)}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverId(item.id)
                }}
                onDragLeave={() => setDragOverId((id) => (id === item.id ? null : id))}
                onDrop={(e) => {
                  e.preventDefault()
                  void handleDrop(item.id)
                }}
                className={clsx(
                  'flex items-center gap-2 px-2 py-1.5 text-sm',
                  dragOverId === item.id && 'bg-bronze/10',
                )}
              >
                <span className="w-[22px] shrink-0 cursor-grab p-1 text-ink-soft/60" title="Arrastra para reordenar">
                  <DragHandleIcon className="h-3.5 w-3.5" />
                </span>

                {editingId === item.id ? (
                  <>
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditingId(null)
                        if (e.key === 'Enter' && editingName.trim()) {
                          void run(async () => {
                            await onRename(item.id, editingName)
                            setEditingId(null)
                          })
                        }
                      }}
                      className="min-w-0 flex-1 rounded-sm border border-bronze bg-parchment px-2 py-1 text-sm text-ink outline-none"
                    />
                    <Button
                      variant="ghost"
                      disabled={busy || !editingName.trim()}
                      onClick={() =>
                        run(async () => {
                          await onRename(item.id, editingName)
                          setEditingId(null)
                        })
                      }
                    >
                      Guardar
                    </Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <button
                      className="min-w-0 flex-1 truncate text-left text-ink hover:text-maroon"
                      onClick={() => {
                        setEditingId(item.id)
                        setEditingName(item.name)
                      }}
                      title="Renombrar"
                    >
                      {item.name}
                    </button>
                    {/* Peana estándar de la etiqueta, en cm de mesa: es lo que
                        mide una unidad con esta etiqueta al desplegarla (ver
                        DeploymentPage). Se escribe aquí y no en cada unidad
                        porque es una propiedad del TIPO, no de la ficha. */}
                    {onSetBaseSize && (
                      <MedidaPeana
                        anchoCm={item.baseWidthCm ?? 12}
                        altoCm={item.baseHeightCm ?? 10}
                        etiqueta={item.name}
                        onCommit={(a, b) => void run(() => onSetBaseSize(item.id, a, b))}
                      />
                    )}
                    <span className="w-20 shrink-0 text-right text-mini tabular-nums text-ink-soft/80">
                      {used === 0 ? '—' : `${used} ${used === 1 ? 'unidad' : 'unidades'}`}
                    </span>
                    <button
                      className="shrink-0 rounded-sm px-1.5 py-0.5 text-ink-soft hover:bg-maroon/10 hover:text-danger"
                      onClick={() => setDeleting(item)}
                      aria-label={`Borrar ${item.name}`}
                      title="Borrar"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Borrar "${deleting.name}"`}
          message={
            (usage.get(deleting.id) ?? 0) > 0
              ? `La usan ${usage.get(deleting.id)} ${usageNoun}. Si la borras, esas unidades se quedarán sin ella (no se borra ninguna unidad).`
              : 'No la usa ninguna unidad, así que se puede borrar sin consecuencias.'
          }
          confirmLabel="Borrar"
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            run(async () => {
              await onRemove(deleting.id)
              setDeleting(null)
            })
          }
        />
      )}
    </Panel>
  )
}

export function TaxonomyPage() {
  const {
    data: categories,
    loading: loadingCategories,
    reload: reloadCategories,
  } = useAsync(() => UnitCategoryRepository.listAll())
  const { data: categoryUsage, reload: reloadCategoryUsage } = useAsync(() => UnitCategoryRepository.usageByCategory())
  const { data: tags, loading: loadingTags, reload: reloadTags } = useAsync(() => UnitTypeTagRepository.listAll())
  const { data: tagUsage, reload: reloadTagUsage } = useAsync(() => UnitTypeTagRepository.usageByTag())

  function refreshCategories() {
    reloadCategories()
    reloadCategoryUsage()
  }
  function refreshTags() {
    reloadTags()
    reloadTagUsage()
  }

  return (
    <div>
      <PageHeader title="Categorías y Etiquetas" />

      {loadingCategories || loadingTags ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <TaxonomySection
            title="Categorías"
            items={categories ?? []}
            usage={categoryUsage ?? new Map()}
            usageNoun="unidades"
            onCreate={async (name) => {
              await UnitCategoryRepository.create(name)
              refreshCategories()
            }}
            onRename={async (id, name) => {
              await UnitCategoryRepository.rename(id, name)
              refreshCategories()
            }}
            onRemove={async (id) => {
              await UnitCategoryRepository.remove(id)
              refreshCategories()
            }}
            onReorder={async (ids) => {
              await UnitCategoryRepository.reorder(ids)
              refreshCategories()
            }}
          />

          <TaxonomySection
            title="Etiquetas"
            items={tags ?? []}
            usage={tagUsage ?? new Map()}
            usageNoun="unidades"
            onCreate={async (name) => {
              await UnitTypeTagRepository.create(name)
              refreshTags()
            }}
            onRename={async (id, name) => {
              await UnitTypeTagRepository.rename(id, name)
              refreshTags()
            }}
            onRemove={async (id) => {
              await UnitTypeTagRepository.remove(id)
              refreshTags()
            }}
            onSetBaseSize={async (id, widthCm, heightCm) => {
              await UnitTypeTagRepository.setBaseSize(id, widthCm, heightCm)
              refreshTags()
            }}
            onReorder={async (ids) => {
              await UnitTypeTagRepository.reorder(ids)
              refreshTags()
            }}
          />
        </div>
      )}
    </div>
  )
}
