import type { InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function TextField({ label, error, className, id, ...props }: TextFieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <label htmlFor={inputId} className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      <input
        id={inputId}
        className={clsx(
          'w-full rounded-sm border bg-parchment/70 px-3 py-1 text-xs text-ink outline-none transition-colors',
          'focus:border-bronze focus:ring-2 focus:ring-bronze/25',
          error ? 'border-danger' : 'border-rule-dark/50',
          className,
        )}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  )
}
