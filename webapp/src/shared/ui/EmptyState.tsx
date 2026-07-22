import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-rule-dark/40 bg-parchment/50 px-6 py-16 text-center">
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
