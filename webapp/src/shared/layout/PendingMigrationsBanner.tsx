// ============================================================================
// Aviso de "falta desplegar el Worker". Ver data/repositories/schemaHealth.ts
// para el porqué: sin él, una migración pendiente se manifiesta como errores
// sueltos y datos que desaparecen, sin pista de la causa común.
//
// Solo se muestra en modo administrador: es un aviso de mantenimiento y quien
// solo consulta fichas no puede hacer nada con él.
// ============================================================================
import { useEffect, useState } from 'react'
import { findPendingMigrations } from '@/data/repositories/schemaHealth'
import { useSession } from '@/shared/session/useSession'

export function PendingMigrationsBanner() {
  const { actingAsAdmin } = useSession()
  const [pending, setPending] = useState<string[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!actingAsAdmin) return
    let cancelled = false
    void findPendingMigrations().then((list) => {
      if (!cancelled) setPending(list)
    })
    return () => {
      cancelled = true
    }
  }, [actingAsAdmin])

  if (!actingAsAdmin || dismissed || pending.length === 0) return null

  return (
    <div className="border-b border-bronze/40 bg-bronze/10 px-6 py-3">
      <div className="mx-auto flex max-w-4xl items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">
            La base de datos no está al día: falta desplegar el Worker.
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Hasta entonces no funcionan estas partes, y sus datos pueden verse vacíos o dar error al guardar:{' '}
            <b>{pending.join(', ')}</b>.
          </p>
          <p className="mt-1.5 font-mono text-[11px] text-ink-soft">cd webapp/worker &amp;&amp; npx wrangler deploy</p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-sm px-2 py-1 text-xs font-medium text-ink-soft hover:text-maroon"
        >
          Ocultar
        </button>
      </div>
    </div>
  )
}
