import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  /**
   * Pieza que va DELANTE del título: un emblema, una miniatura. Opcional y sin
   * estilo propio —lo pone quien la pasa—, para que esto siga siendo una
   * cabecera y no un componente con opciones.
   */
  leading?: ReactNode
}

export function PageHeader({ title, description, actions, leading }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-2">
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-tight text-ink">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 gap-2 pb-1">{actions}</div>}
    </div>
  )
}
