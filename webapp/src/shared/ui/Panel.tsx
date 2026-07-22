import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  /** Línea explicativa bajo el título. */
  subtitle?: string
  /** Contenido a la derecha del título, en la misma línea (badges, botones pequeños…). */
  headerRight?: ReactNode
  children: ReactNode
}

/**
 * Tarjeta de sección: el bloque con borde y fondo de pergamino que agrupa un
 * apartado dentro de una pantalla ("Ficha", "Unidades en la lista", "Añadir
 * unidad"…).
 *
 * Estaba definido POR TRIPLICADO —en UnitDetailPage, FichasPage y
 * ArmyListBuilderPage— y las tres copias habían divergido: unas con `p-5` y
 * otras con `p-4`, unas con el título en `text-lg` y otras en `text-base`. Al
 * ponerlas una al lado de otra se notaba que no encajaban. Aquí hay una sola
 * definición para que no vuelva a pasar.
 */
export function Panel({ title, subtitle, headerRight, children }: PanelProps) {
  return (
    <section className="rounded-sm border border-rule-dark/40 bg-parchment/70 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>}
        </div>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </div>
      {children}
    </section>
  )
}
