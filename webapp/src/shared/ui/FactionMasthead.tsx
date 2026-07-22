import type { ReactNode } from 'react'
import { FactionEmblem } from '@/shared/ui/FactionEmblem'
import type { Faction } from '@/domain/types'

interface FactionMastheadProps {
  faction: Pick<Faction, 'name' | 'emblemUrl'> | null | undefined
  /** Línea bajo el filete: recuentos, descripción… */
  subtitle?: ReactNode
  /** Controles a la derecha (normalmente el selector de facción). */
  actions?: ReactNode
}

/**
 * Cabecera de facción: medallón a la izquierda y, a su derecha, el nombre en
 * tipografía de display con un filete debajo y una línea de detalle.
 *
 * No es una tarjeta: no lleva marco ni fondo propio, se apoya directamente
 * sobre el pergamino. La página ya tiene su PageHeader con borde grueso encima,
 * y meter aquí otra caja habría dejado dos cabeceras compitiendo.
 *
 * El nombre de la facción va en granate y a buen tamaño porque en estas
 * pantallas es el verdadero contexto de trabajo: el título de la página
 * ("Unidades y personajes") es fijo y dice mucho menos que saber en qué
 * facción estás.
 */
export function FactionMasthead({ faction, subtitle, actions }: FactionMastheadProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-4">
      <FactionEmblem faction={faction} size="lg" />

      <div className="min-w-0 flex-1">
        <h2 className="font-display text-3xl leading-none font-bold tracking-wide text-maroon">
          {faction?.name ?? '—'}
        </h2>
        {/* Filete corto: acompaña al nombre sin cruzar la pantalla entera. */}
        <div className="mt-2 mb-1.5 h-px max-w-md bg-rule-dark/45" />
        {subtitle && <p className="text-xs text-ink-soft">{subtitle}</p>}
      </div>

      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  )
}
