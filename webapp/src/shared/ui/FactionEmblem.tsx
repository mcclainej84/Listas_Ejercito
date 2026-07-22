import { clsx } from 'clsx'
import type { Faction } from '@/domain/types'

type Size = 'sm' | 'md' | 'lg'

const SIZES: Record<Size, string> = {
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-24 w-24',
}

interface FactionEmblemProps {
  /** Basta con lo que se pinta; se acepta cualquier objeto con estos campos (no hace falta la Faction entera). */
  faction: Pick<Faction, 'name' | 'emblemUrl'> | null | undefined
  size?: Size
  className?: string
}

/**
 * Emblema de facción: la ilustración cuadrada, sin marco.
 *
 * Las imágenes de facción no son logotipos recortados sino ILUSTRACIONES de
 * 480×480 (escenas completas). No llevan borde —con él parecían un parche
 * pegado sobre el pergamino— y en su lugar las asientan dos sombras: una
 * exterior suave que las despega del papel y otra INTERIOR que oscurece
 * ligeramente el filo, de modo que el recorte no quede a cuchillo. La esquina
 * redondeada es la misma `rounded-sm` que usan las tarjetas del resto de la
 * interfaz.
 */
export function FactionEmblem({ faction, size = 'md', className }: FactionEmblemProps) {
  if (!faction?.emblemUrl) return null

  return (
    <span
      className={clsx(
        'relative inline-block shrink-0 overflow-hidden rounded-sm shadow-md shadow-black/25',
        SIZES[size],
        className,
      )}
    >
      <img src={faction.emblemUrl} alt="" className="h-full w-full object-cover" />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-sm"
        style={{ boxShadow: 'inset 0 0 12px rgba(20,14,6,0.35)' }}
      />
    </span>
  )
}
