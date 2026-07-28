// ============================================================================
// El globo de "Composición del ejército" (ver composition.ts para el cálculo).
//
// Se enseña al pasar el ratón por el título "Unidades en la lista": es
// información de apoyo, no algo que deba ocupar sitio permanentemente en una
// pantalla que ya está llena.
// ============================================================================
import { buildComposition, type CompositionRow } from '@/features/army-lists/composition'
import type { ArmyListEntry } from '@/domain/types'

/** Una de las dos mitades del resumen: título y filas "concepto — puntos (%)". */
function CompositionBlock({ title, rows }: { title: string; rows: CompositionRow[] }) {
  return (
    <div>
      <p className="mb-1 border-b border-parchment/25 pb-0.5 text-mini font-semibold tracking-wide text-parchment/70 uppercase">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-mini text-parchment/60 italic">—</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((row) => (
            <li key={row.label} className="flex items-baseline justify-between gap-3 text-mini">
              <span className="truncate">
                {row.label} <span className="text-parchment/50">×{row.entries}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {row.points} pts <span className="text-parchment/50">({row.percent}%)</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Contenido del globo de "Composición del ejército" (ver buildComposition). */
export function CompositionSummary({ entries, total }: { entries: ArmyListEntry[]; total: number }) {
  if (entries.length === 0) {
    return <span>Todavía no hay unidades en la lista.</span>
  }
  const { byTag, byCategory } = buildComposition(entries, total)
  return (
    <div className="space-y-2 text-left">
      <p className="font-display text-sm font-semibold">Composición del ejército</p>
      <CompositionBlock title="Por etiqueta" rows={byTag} />
      <CompositionBlock title="Por categoría" rows={byCategory} />
      <p className="border-t border-parchment/25 pt-1 text-right text-mini tabular-nums">
        Total <b>{total}</b> pts
      </p>
    </div>
  )
}
