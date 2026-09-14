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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b-2 border-ink pb-2 sm:mb-6">
      {/* `basis-full` EN EL MÓVIL: el título y su explicación se quedan la línea
          entera y los botones bajan a la suya. Sin esto, `justify-between` les
          dejaba sitio al lado y la explicación se leía en una columna de cuatro
          palabras de ancho —ocho renglones— con media pantalla en blanco a la
          derecha. */}
      <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-auto">
        {leading}
        <div className="min-w-0">
          <h1 className="font-display text-xl leading-tight text-ink sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{description}</p>}
        </div>
      </div>
      {/* LOS BOTONES SE PARTEN EN VARIAS LÍNEAS SI HACE FALTA. Con `shrink-0` a
          secas, una cabecera con cinco botones (la del constructor) desbordaba
          la pantalla del móvil por la derecha y arrastraba consigo el ancho de
          toda la página. `flex-wrap` los apila; `sm:shrink-0` conserva la fila
          única en cuanto hay sitio. */}
      {actions && <div className="flex flex-wrap gap-2 pb-1 sm:shrink-0">{actions}</div>}
    </div>
  )
}
