import type { ReactNode } from 'react'
import { clsx } from 'clsx'

const TONES = {
  neutral: 'bg-parchment-dark text-ink-soft',
  amber: 'bg-bronze/20 text-bronze',
  // `green` usaba emerald-800 (verde frío de Tailwind) mientras `red` ya usaba
  // el granate de la paleta: dos criterios distintos en el mismo componente.
  green: 'bg-success/10 text-success',
  red: 'bg-maroon/10 text-maroon',
} as const

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border border-current/20 px-2 py-0.5 text-xs font-medium',
        TONES[tone],
      )}
    >
      {children}
    </span>
  )
}
