import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { FactionRepository } from '@/data/repositories/factionRepository'
import { useFavoriteFactionId } from '@/shared/session/useFavoriteFactionId'
import { UnitRepository, type UnitSummary } from '@/data/repositories/unitRepository'
import { runMigrations } from '@/data/sqlite/client'
import { UnitCategoryRepository } from '@/data/repositories/lookupRepositories'
import { UnitFormModal } from '@/features/admin/units/UnitFormModal'
import { useAsync } from '@/shared/hooks/useAsync'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Select } from '@/shared/ui/Select'
import { FactionMasthead } from '@/shared/ui/FactionMasthead'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Badge } from '@/shared/ui/Badge'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { CopyIcon, DragHandleIcon, TrashIcon } from '@/shared/ui/icons'

const SIN_CATEGORIA_KEY = 'Sin categoría'

// La categoría desplegada se recuerda entre visitas (misma convención que
// useGrayscaleMode): entrar en una unidad y volver atrás desmonta esta
// pantalla, y sin esto el acordeón se reabría siempre por la primera
// categoría — "Personajes" — obligando a volver a bajar hasta donde estabas.
// Es una preferencia de navegación, no un dato de la app, así que va en
// localStorage y no en la URL.
const OPEN_CATEGORY_KEY = 'wharmy_unidades_categoria_abierta'

function readOpenCategory(): string | null {
  try {
    return localStorage.getItem(OPEN_CATEGORY_KEY)
  } catch {
    return null
  }
}

function storeOpenCategory(value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(OPEN_CATEGORY_KEY)
    else localStorage.setItem(OPEN_CATEGORY_KEY, value)
  } catch {
    // localStorage puede no estar disponible; entonces simplemente no se
    // recuerda de una visita a otra.
  }
}

export function UnitsListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const factionId = searchParams.get('faccion')

  const { data: factions, loading: loadingFactions } = useAsync(() => FactionRepository.listAll())
  const { data: categories } = useAsync(() => UnitCategoryRepository.listAll())
  const favoriteFactionId = useFavoriteFactionId()
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<UnitSummary | null>(null)
  // Id de la unidad que se está copiando (deshabilita los demás botones de
  // copiar mientras tanto: son varias escrituras seguidas).
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null)
  const [openCategory, setOpenCategoryState] = useState<string | null>(readOpenCategory)

  function setOpenCategory(value: string | null) {
    setOpenCategoryState(value)
    storeOpenCategory(value)
  }

  useEffect(() => {
    if (!factionId && factions && factions.length > 0) {
      // La favorita del usuario si sigue existiendo; si no, la primera.
      const preferred =
        favoriteFactionId != null && factions.some((f) => f.id === favoriteFactionId)
          ? favoriteFactionId
          : factions[0].id
      setSearchParams({ faccion: String(preferred) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factionId, factions, favoriteFactionId])

  const {
    data: units,
    loading: loadingUnits,
    error,
    reload,
  } = useAsync(() => (factionId ? UnitRepository.listByFaction(Number(factionId)) : Promise.resolve([])), [factionId])

  const selectedFaction = (factions ?? []).find((f) => String(f.id) === factionId) ?? null
  // El resumen de la facción cuenta solo unidades ACTIVAS: una desactivada no
  // se puede meter en un ejército, así que sumarla daría una idea falsa de lo
  // que hay disponible. Las desactivadas se siguen viendo en la lista (esta es
  // la pantalla de edición) y se resumen aparte, para no perder el dato.
  const activeUnits = (units ?? []).filter((u) => u.active)
  const inactiveCount = (units ?? []).length - activeUnits.length
  const personajeCount = activeUnits.filter(
    (u) => categories?.find((c) => c.name === u.categoryName)?.code === 'PERSONAJE',
  ).length

  const grouped = useMemo(() => {
    const map = new Map<string, UnitSummary[]>()
    for (const unit of units ?? []) {
      const key = unit.categoryName ?? SIN_CATEGORIA_KEY
      map.set(key, [...(map.get(key) ?? []), unit])
    }
    return map
  }, [units])

  // Solo una categoría abierta a la vez (acordeón). Se respeta la que quedó
  // abierta la última vez (viene de localStorage, ver readOpenCategory); solo
  // se recurre a la primera con unidades cuando no hay ninguna abierta o la
  // recordada no existe en esta facción.
  useEffect(() => {
    const keys = Array.from(grouped.keys())
    if (keys.length === 0) return
    if (openCategory !== null && keys.includes(openCategory)) return
    setOpenCategory(keys[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped])

  // ---------- Arrastrar y soltar para reordenar unidades dentro de una
  // categoría (persistido en units.sort_order, ver reorderWithinCategory).
  // "Personajes" queda fuera a propósito: esa categoría se ordena siempre
  // por coste (ver PERSONAJE_ORDER_EXPR en unitRepository.ts), así que
  // arrastrar ahí no tendría ningún efecto duradero. ----------
  const dragUnitId = useRef<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)

  function isPersonajeCategory(categoryName: string): boolean {
    return categories?.find((c) => c.name === categoryName)?.code === 'PERSONAJE'
  }

  async function handleDrop(categoryUnits: UnitSummary[], targetId: number) {
    const draggedId = dragUnitId.current
    dragUnitId.current = null
    setDragOverId(null)
    if (draggedId == null || draggedId === targetId) return
    const ids = categoryUnits.map((u) => u.id)
    const from = ids.indexOf(draggedId)
    const to = ids.indexOf(targetId)
    if (from === -1 || to === -1) return
    ids.splice(to, 0, ids.splice(from, 1)[0])
    await UnitRepository.reorderWithinCategory(ids)
    reload()
  }

  return (
    <div>
      <PageHeader
        title="Unidades y personajes"
        description="Ficha maestra de cada unidad: atributos, equipo, reglas especiales y restricciones para el constructor de listas."
        actions={
          factionId ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              + Nueva unidad
            </Button>
          ) : undefined
        }
      />

      {!loadingFactions && factions && factions.length > 0 && (
        <FactionMasthead
          faction={selectedFaction}
          subtitle={
            units && units.length > 0
              ? [
                  `${activeUnits.length} ${activeUnits.length === 1 ? 'unidad' : 'unidades'}`,
                  `${personajeCount} ${personajeCount === 1 ? 'personaje' : 'personajes'}`,
                  ...(inactiveCount > 0
                    ? [`${inactiveCount} ${inactiveCount === 1 ? 'desactivada' : 'desactivadas'}`]
                    : []),
                ].join(' · ')
              : 'Sin unidades todavía'
          }
          actions={
            <div className="w-56">
              <Select
                label="Facción"
                value={factionId ?? ''}
                onChange={(e) => setSearchParams({ faccion: e.target.value })}
              >
                {factions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
      )}

      {loadingUnits && <Spinner />}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loadingUnits && units && units.length === 0 && (
        <EmptyState title="Esta facción todavía no tiene unidades" />
      )}

      {!loadingUnits &&
        Array.from(grouped.entries()).map(([category, categoryUnits]) => {
          const isOpen = openCategory === category
          const draggable = !isPersonajeCategory(category)
          return (
            <div key={category} className="mb-3 overflow-hidden rounded-sm border border-rule-dark/40 bg-parchment/70">
              <button
                onClick={() => setOpenCategory(isOpen ? null : category)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-parchment-dark"
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-2.5">
                  <span className="font-display text-xl font-bold text-ink">{category}</span>
                  <span className="text-sm text-ink-soft">({categoryUnits.length})</span>
                </span>
                <span className={clsx('text-lg text-ink-soft transition-transform', isOpen && 'rotate-90')}>›</span>
              </button>

              {isOpen && (
                <div className="divide-y divide-rule-dark/20 border-t border-rule-dark/20">
                  {categoryUnits.map((unit) => (
                    <div
                      key={unit.id}
                      draggable={draggable}
                      onDragStart={() => {
                        dragUnitId.current = unit.id
                      }}
                      onDragOver={(e) => {
                        if (!draggable) return
                        e.preventDefault()
                        setDragOverId(unit.id)
                      }}
                      onDragLeave={() => setDragOverId((id) => (id === unit.id ? null : id))}
                      onDrop={(e) => {
                        e.preventDefault()
                        void handleDrop(categoryUnits, unit.id)
                      }}
                      className={clsx(
                        // El resaltado va en la FILA entera (antes estaba solo en
                        // el botón del nombre, así que el asa de arrastre y los
                        // botones de la derecha se quedaban sin resaltar).
                        'flex w-full items-center gap-2 px-2 transition-colors hover:bg-parchment-dark',
                        dragOverId === unit.id && 'bg-bronze/10',
                        !unit.active && 'opacity-45',
                      )}
                    >
                      {draggable && (
                        <span className="cursor-grab p-1 text-ink-soft/60" title="Arrastra para reordenar">
                          <DragHandleIcon className="h-4 w-4" />
                        </span>
                      )}
                      <button
                        onClick={() => navigate(`/admin/unidades/${unit.id}`)}
                        className="flex flex-1 items-center justify-between gap-4 py-2.5 text-left"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium text-ink">{unit.name}</span>
                          {unit.isUnique === true && unit.unitType !== 'personaje' && <Badge tone="amber">0-1</Badge>}
                          {!unit.active && <span className="text-micro font-medium uppercase tracking-wide text-ink-soft">desactivada</span>}
                        </span>
                        <span className="shrink-0 text-sm text-ink-soft">{unit.baseCost} pts</span>
                      </button>
                      <button
                        onClick={async () => {
                          const next = !unit.active
                          try {
                            await UnitRepository.setActive(unit.id, next)
                            reload()
                          } catch {
                            // Puede que la D1 aún no tenga la columna `active`
                            // (la migración de arranque no llegó a correr).
                            // Se intenta migrar y reintentar una vez.
                            try {
                              await runMigrations()
                              await UnitRepository.setActive(unit.id, next)
                              reload()
                            } catch (err) {
                              alert(
                                'No se pudo cambiar el estado. Falta desplegar el Worker para añadir la columna "active" (cd webapp/worker && npx wrangler deploy).',
                              )
                              console.error(err)
                            }
                          }
                        }}
                        className={clsx(
                          'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-mini font-medium transition-colors',
                          unit.active
                            ? 'border-success/50 bg-success/10 text-success hover:bg-success/20'
                            : 'border-danger/50 bg-danger/10 text-danger hover:bg-danger/20',
                        )}
                        title={unit.active ? 'Activa — clic para desactivar (no aparecerá al montar ejércitos)' : 'Inactiva — clic para activar'}
                      >
                        <span
                          className={clsx(
                            'h-2.5 w-2.5 rounded-full border-2',
                            unit.active ? 'border-success bg-success' : 'border-danger bg-danger',
                          )}
                        />
                        {unit.active ? 'Activa' : 'Inactiva'}
                      </button>
                      <button
                        onClick={async () => {
                          if (duplicatingId != null) return
                          setDuplicatingId(unit.id)
                          try {
                            await UnitRepository.duplicate(unit.id)
                            reload()
                          } catch (err) {
                            alert('No se pudo copiar la unidad.')
                            console.error(err)
                          } finally {
                            setDuplicatingId(null)
                          }
                        }}
                        disabled={duplicatingId != null}
                        className="shrink-0 rounded-sm p-1.5 text-ink-soft hover:bg-bronze/15 hover:text-bronze disabled:opacity-40"
                        aria-label={`Copiar ${unit.name}`}
                        title="Crear una copia de esta unidad"
                      >
                        <CopyIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleting(unit)}
                        className="shrink-0 rounded-sm p-1.5 text-ink-soft hover:bg-maroon/10 hover:text-danger"
                        aria-label={`Borrar ${unit.name}`}
                        title="Borrar unidad"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

      {/* Se espera a tener las categorías: ahora son obligatorias al crear, y
          abrir el formulario con el desplegable vacío no llevaría a ningún
          sitio. */}
      {creating && factionId && categories && categories.length > 0 && (
        <UnitFormModal
          factionId={Number(factionId)}
          categories={categories}
          factions={factions ?? []}
          defaultCategoryId={
            categories?.find((c) => c.name === openCategory)?.id ?? null
          }
          onClose={() => setCreating(false)}
          onCreated={(unitId) => {
            setCreating(false)
            reload()
            navigate(`/admin/unidades/${unitId}`)
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Borrar unidad"
          message={`¿Seguro que quieres borrar "${deleting.name}"? Se eliminará su ficha completa (perfil, equipo, reglas y opciones) y se quitará de cualquier lista de ejército que la usara. Esta acción no se puede deshacer.`}
          confirmLabel="Borrar definitivamente"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await UnitRepository.remove(deleting.id)
            setDeleting(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
