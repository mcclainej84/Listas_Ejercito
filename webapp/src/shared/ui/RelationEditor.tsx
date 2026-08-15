import { useMemo, useRef, useState } from 'react'
import { TrashIcon, StarIcon } from '@/shared/ui/icons'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'

export interface RelationItem {
  id: number
  name: string
  cost?: number
  /** Texto largo opcional (p.ej. la descripción de una regla especial). Si existe, se muestra bajo el nombre de cada asignada. */
  description?: string
  /** Texto corto opcional (p.ej. la línea de atributos de un perfil de montura). */
  subtitle?: string
}

interface RelationEditorProps {
  allItems: RelationItem[]
  selectedIds: Set<number>
  onToggle: (itemId: number, enabled: boolean) => void
  addLabel?: string
  emptyLabel?: string
  /** Si es true, quitar un elemento asignado pide confirmación antes de aplicarlo (p. ej. reglas especiales). */
  confirmRemove?: boolean
  /**
   * Si se indica, ofrece "Crear «texto» como opción nueva" cuando la
   * búsqueda no encuentra nada en el catálogo (p. ej. dar de alta una pieza
   * de equipo que todavía no existe). El propio `onCreateNew` es responsable
   * de crearla y asignarla; este componente solo dispara la acción.
   */
  onCreateNew?: (query: string) => void
  createNewLabel?: string
  /**
   * Si se indica, se consulta para cada sugerencia del buscador (no para lo
   * ya asignado, que se sigue mostrando siempre): si devuelve un texto, esa
   * sugerencia se muestra deshabilitada con ese texto como motivo (p. ej.
   * "Incompatible con Lanza") en vez de poder añadirse. Usado por el
   * constructor de listas para que el equipo excluyente entre sí
   * directamente no se pueda seleccionar a la vez, en vez de descubrirlo al
   * guardar.
   */
  getDisabledReason?: (item: RelationItem) => string | null
  /**
   * Si se indica (junto con `onToggleDefault`), cada opción ya asignada
   * muestra una estrella para marcarla como "por defecto": vendrá
   * pre-seleccionada al añadir esta unidad a una lista de ejército (ver
   * unit_equipment_options.is_default / unit_upgrade_options.is_default),
   * sin tener que marcarla cada vez. Usado desde Administración > Unidades
   * en "Opciones de equipo" y "Opciones de unidad".
   */
  defaultIds?: Set<number>
  onToggleDefault?: (itemId: number, isDefault: boolean) => void
  /**
   * Modo "añadir varias de una vez": el buscador NO se cierra ni se vacía al
   * elegir una opción, y aparece un botón "Añadir los N resultados" que añade
   * de golpe todo lo que coincide con la búsqueda. Pensado para las
   * incompatibilidades (p. ej. buscar "marca de" y excluirlas todas de una
   * sola vez); ver `onToggleMany`.
   */
  multiSelect?: boolean
  /**
   * Alta/baja en bloque. Si no se indica, el modo `multiSelect` recurre a
   * llamar `onToggle` una vez por elemento — correcto, pero el padre puede
   * ofrecer una versión que actualice su estado en una sola pasada.
   */
  onToggleMany?: (itemIds: number[], enabled: boolean) => void
}

/** "Marca de Nurgle (25 pts)" — el coste desambigua opciones con el mismo nombre. */
function ItemLabel({ item }: { item: RelationItem }) {
  return (
    <>
      {item.name}
      {item.cost !== undefined && <span className="ml-1 text-ink-soft">({item.cost} pts)</span>}
    </>
  )
}

/**
 * Editor de una relación N:M de una unidad (reglas especiales, equipo,
 * mejoras, perfiles de montura/carro...): muestra primero, bien visibles,
 * las opciones YA asignadas (con su descripción si la tienen, y un botón
 * para quitarlas de un clic), y debajo un buscador para añadir más desde el
 * catálogo. Un único componente reutilizado en toda la ficha en vez de
 * repetir el mismo patrón varias veces.
 */
export function RelationEditor({
  allItems,
  selectedIds,
  onToggle,
  addLabel = 'Añadir…',
  emptyLabel,
  confirmRemove = false,
  onCreateNew,
  createNewLabel = 'Crear',
  getDisabledReason,
  defaultIds,
  onToggleDefault,
  multiSelect = false,
  onToggleMany,
}: RelationEditorProps) {
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [pendingRemoval, setPendingRemoval] = useState<RelationItem | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const assigned = useMemo(() => allItems.filter((item) => selectedIds.has(item.id)), [allItems, selectedIds])

  // Todo lo que coincide con la búsqueda, ya SIN lo que está asignado (lo ya
  // excluido no vuelve a ofrecerse). `suggestions` es solo el recorte que se
  // pinta; el añadir en bloque usa la lista completa.
  const matchedAll = useMemo(() => {
    if (!adding) return []
    const q = query.trim().toLowerCase()
    const available = allItems.filter((item) => !selectedIds.has(item.id))
    return q ? available.filter((item) => item.name.toLowerCase().includes(q)) : available
  }, [adding, query, allItems, selectedIds])

  const suggestions = useMemo(() => matchedAll.slice(0, 30), [matchedAll])

  /** Los que se añadirían en bloque: los que coinciden y no estén deshabilitados. */
  const bulkAddable = useMemo(
    () => matchedAll.filter((item) => (getDisabledReason?.(item) ?? null) == null),
    [matchedAll, getDisabledReason],
  )

  function addMany(items: RelationItem[]) {
    const ids = items.map((item) => item.id)
    if (ids.length === 0) return
    if (onToggleMany) onToggleMany(ids, true)
    else for (const id of ids) onToggle(id, true)
  }

  function handleRemoveClick(item: RelationItem) {
    if (confirmRemove) {
      setPendingRemoval(item)
    } else {
      onToggle(item.id, false)
    }
  }

  if (allItems.length === 0 && !onCreateNew) {
    return (
      <p className="text-xs text-ink-soft">{emptyLabel ?? 'No hay opciones disponibles todavía en el catálogo.'}</p>
    )
  }

  return (
    <div>
      {multiSelect && assigned.length > 0 && (
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <p className="text-mini text-ink-soft">
            {assigned.length} {assigned.length === 1 ? 'seleccionada' : 'seleccionadas'}
          </p>
          <button
            onClick={() => {
              const ids = assigned.map((item) => item.id)
              if (onToggleMany) onToggleMany(ids, false)
              else for (const id of ids) onToggle(id, false)
            }}
            className="text-mini font-medium text-ink-soft hover:text-maroon"
          >
            Quitar todas
          </button>
        </div>
      )}

      {assigned.length === 0 ? (
        <p className="text-xs text-ink-soft italic">Ninguna asignada todavía.</p>
      ) : (
        <ul className="space-y-2">
          {assigned.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-sm border border-rule-dark/30 bg-parchment/60 px-3 py-2"
            >
              <div className="min-w-0">
                <p className={item.description ? 'font-display text-xs text-maroon' : 'text-xs font-medium text-ink'}>
                  <ItemLabel item={item} />
                </p>
                {item.description && <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{item.description}</p>}
                {item.subtitle && <p className="mt-0.5 text-xs text-ink-soft">{item.subtitle}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {onToggleDefault && (
                  <button
                    onClick={() => onToggleDefault(item.id, !(defaultIds?.has(item.id) ?? false))}
                    className={
                      defaultIds?.has(item.id)
                        ? 'rounded-sm p-1 text-bronze hover:bg-bronze/10'
                        : 'rounded-sm p-1 text-ink-soft/50 hover:bg-bronze/10 hover:text-bronze'
                    }
                    aria-label={
                      defaultIds?.has(item.id)
                        ? `Quitar ${item.name} de por defecto`
                        : `Marcar ${item.name} por defecto`
                    }
                    title={defaultIds?.has(item.id) ? 'Por defecto — clic para quitar' : 'Marcar como por defecto'}
                  >
                    <StarIcon filled={defaultIds?.has(item.id) ?? false} />
                  </button>
                )}
                <button
                  onClick={() => handleRemoveClick(item)}
                  className="rounded-sm p-1 text-ink-soft hover:bg-maroon/10 hover:text-maroon"
                  aria-label={`Quitar ${item.name}`}
                  title="Quitar"
                >
                  <TrashIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="relative mt-3">
        {!adding ? (
          <button
            onClick={() => {
              setAdding(true)
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
            className="text-xs font-medium text-bronze hover:text-maroon"
          >
            + {addLabel}
          </button>
        ) : (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => setTimeout(() => setAdding(false), 150)}
            placeholder="Buscar en el catálogo…"
            className="w-full max-w-xs rounded-sm border border-rule-dark/50 bg-parchment/70 px-2.5 py-1 text-xs outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/25"
          />
        )}

        {adding && (
          <div className="absolute z-10 mt-1 max-h-56 w-full max-w-xs overflow-y-auto rounded-sm border border-rule-dark/40 bg-parchment shadow-lg">
            {suggestions.length === 0 && !onCreateNew && (
              <p className="px-3 py-2 text-xs text-ink-soft">Sin coincidencias.</p>
            )}

            {/* Añadir de golpe todo lo que coincide con la búsqueda: escribir
                "marca de" y excluirlas todas de una vez. */}
            {multiSelect && bulkAddable.length > 1 && (
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  addMany(bulkAddable)
                }}
                className="sticky top-0 flex w-full items-center justify-between gap-2 border-b border-rule-dark/30 bg-parchment-dark/80 px-3 py-1.5 text-left text-xs font-medium text-bronze hover:text-maroon"
              >
                <span>+ Añadir los {bulkAddable.length} resultados</span>
                {query.trim() && <span className="truncate text-ink-soft italic">«{query.trim()}»</span>}
              </button>
            )}

            {suggestions.map((item) => {
              const disabledReason = getDisabledReason?.(item) ?? null
              return (
                <button
                  key={item.id}
                  disabled={disabledReason != null}
                  title={disabledReason ?? undefined}
                  onMouseDown={(e) => {
                    if (disabledReason) return
                    e.preventDefault()
                    onToggle(item.id, true)
                    // En modo multiselección se mantiene la búsqueda para
                    // poder seguir marcando de la misma lista; la que se
                    // acaba de elegir desaparece sola de las sugerencias.
                    if (!multiSelect) setQuery('')
                  }}
                  className={
                    disabledReason
                      ? 'flex w-full cursor-not-allowed items-center justify-between gap-2 px-3 py-1.5 text-left text-xs text-ink-soft/50'
                      : 'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-parchment-dark'
                  }
                >
                  <span className={disabledReason ? '' : 'text-ink'}>
                    <ItemLabel item={item} />
                    {disabledReason && <span className="ml-1.5 italic">({disabledReason})</span>}
                  </span>
                </button>
              )
            })}
            {onCreateNew && query.trim() && (
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  onCreateNew(query.trim())
                  setQuery('')
                  setAdding(false)
                }}
                className="flex w-full items-center gap-1.5 border-t border-rule-dark/30 px-3 py-1.5 text-left text-xs font-medium text-bronze hover:bg-parchment-dark hover:text-maroon"
              >
                + {createNewLabel} «{query.trim()}»
              </button>
            )}
          </div>
        )}
      </div>

      {pendingRemoval && (
        <ConfirmDialog
          title="Quitar regla especial"
          message={`¿Seguro que quieres quitar "${pendingRemoval.name}" de esta unidad?`}
          confirmLabel="Quitar"
          onCancel={() => setPendingRemoval(null)}
          onConfirm={() => {
            onToggle(pendingRemoval.id, false)
            setPendingRemoval(null)
          }}
        />
      )}
    </div>
  )
}
