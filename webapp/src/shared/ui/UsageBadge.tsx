// ============================================================================
// Distintivo de "cuántos la usan" + su lista desplegable. Lo comparten los
// catálogos globales de Editor (Equipo y opciones, Reglas especiales): en
// todos ellos la pregunta es la misma —¿esto lo usa alguien, o es basura que
// puedo borrar?— y conviene que se conteste con el mismo gesto en todos.
//
// El contador es un BOTÓN que despliega la lista debajo de la fila. Antes era
// un `title` nativo del navegador, poco fiable (tardaba en salir y no siempre
// aparecía).
// ============================================================================
import { clsx } from 'clsx'

interface UsageBadgeProps {
  count: number
  expanded: boolean
  onToggle: () => void
  /** Nombre de lo que se cuenta, para que el texto case ("3 unidades", "3 fichas"). */
  noun?: { one: string; many: string }
}

export function UsageBadge({ count, expanded, onToggle, noun = { one: 'unidad', many: 'unidades' } }: UsageBadgeProps) {
  if (count === 0) {
    return (
      <span className="shrink-0 rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-micro font-medium text-danger">
        sin usar
      </span>
    )
  }
  return (
    <button
      onClick={onToggle}
      aria-expanded={expanded}
      className="flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-mini text-ink-soft underline decoration-dotted hover:text-maroon"
    >
      {count} {count === 1 ? noun.one : noun.many}
      <span className={clsx('transition-transform', expanded && 'rotate-90')}>›</span>
    </button>
  )
}

/** Lista desplegada de quién usa el elemento. */
export function UsageList({ items, title = 'La usan estas unidades' }: { items: string[]; title?: string }) {
  return (
    <div className="border-t border-rule-dark/20 bg-parchment/40 px-4 py-2">
      <p className="mb-1 text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">{title}</p>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item} className="truncate text-mini text-ink-soft">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
