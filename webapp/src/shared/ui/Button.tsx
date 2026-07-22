import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-maroon text-parchment hover:bg-maroon-dark shadow-sm shadow-black/20',
  secondary: 'bg-parchment text-ink border border-rule-dark/60 hover:bg-parchment-dark',
  ghost: 'text-ink-soft hover:bg-parchment-dark/70',
  danger: 'bg-danger text-parchment hover:bg-danger-dark shadow-sm shadow-black/20',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

export function Button({ variant = 'secondary', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        // El anillo de foco es `focus-visible` y no `focus`: solo aparece al
        // navegar con teclado, no al hacer clic con el ratón. Los campos de
        // texto ya lo tenían; los botones no tenían ninguno, así que con el
        // tabulador no se veía dónde estabas.
        'inline-flex items-center justify-center gap-1.5 rounded-sm px-3.5 py-2 text-sm font-medium tracking-wide transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze/50 focus-visible:ring-offset-1 focus-visible:ring-offset-parchment',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
