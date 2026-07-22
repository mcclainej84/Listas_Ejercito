import type { SelectHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
}

export function Select({ label, className, id, children, ...props }: SelectProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <label htmlFor={inputId} className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      <select
        id={inputId}
        className={clsx(
          'w-full rounded-sm border border-rule-dark/50 bg-parchment/70 px-3 py-1 text-xs text-ink outline-none transition-colors',
          'focus:border-bronze focus:ring-2 focus:ring-bronze/25',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  )
}
