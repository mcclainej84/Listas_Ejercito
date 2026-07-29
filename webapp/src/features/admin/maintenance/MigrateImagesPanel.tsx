// ============================================================================
// Panel de la migración de imágenes a R2 (Editor > Registro > Mantenimiento).
//
// Es una operación de una sola vez, así que la interfaz no intenta ser bonita
// sino HONESTA: dice cuántas imágenes quedan antes de empezar, enseña por cuál
// va mientras trabaja, y al terminar da el resultado en cifras (cuántas y
// cuánto peso se ha ahorrado) además de listar los fallos uno a uno en vez de
// resumirlos en un "algo salió mal".
// ============================================================================
import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Panel } from '@/shared/ui/Panel'
import { Spinner } from '@/shared/ui/Spinner'
import { formatBytes } from '@/shared/image'
import { useAsync } from '@/shared/hooks/useAsync'
import {
  listPendingImages,
  migrateSheetImagesToR2,
  type MigrationProgress,
  type MigrationResult,
} from '@/features/admin/maintenance/migrateSheetImages'

export function MigrateImagesPanel() {
  const { data: pending, loading, reload } = useAsync(() => listPendingImages(), [])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<MigrationProgress | null>(null)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      setResult(await migrateSheetImagesToR2(setProgress))
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  const total = pending?.length ?? 0

  return (
    <Panel title="Mover las imágenes de las hojas a R2">
      <div className="space-y-3 text-sm text-ink-soft">
        {loading ? (
          <Spinner />
        ) : total === 0 ? (
          <p className="rounded-sm border border-success/40 bg-success/10 px-3 py-2 text-ink">
            No queda ninguna imagen por migrar.
          </p>
        ) : (
          <p className="rounded-sm border border-rule-dark/40 bg-parchment/70 px-3 py-2 text-ink">
            Quedan <b>{total}</b> {total === 1 ? 'imagen' : 'imágenes'} por migrar.
          </p>
        )}

        <Button variant="primary" onClick={handleRun} disabled={running || total === 0}>
          {running ? 'Migrando…' : 'Migrar imágenes ahora'}
        </Button>

        {progress && (
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-sm bg-parchment-dark">
              <div
                className="h-full bg-maroon transition-all"
                style={{ width: `${progress.total === 0 ? 0 : (progress.done / progress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs">
              {progress.done} de {progress.total} — {progress.current}
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-2 rounded-sm border border-rule-dark/40 bg-parchment/70 px-3 py-2 text-ink">
            <p>
              <b>{result.migradas}</b> {result.migradas === 1 ? 'imagen migrada' : 'imágenes migradas'}.{' '}
              {result.bytesAntes > 0 && (
                <>
                  De {formatBytes(result.bytesAntes)} a <b>{formatBytes(result.bytesDespues)}</b> (
                  {Math.round((1 - result.bytesDespues / result.bytesAntes) * 100)}% menos).
                </>
              )}
            </p>
            {result.errores.length > 0 && (
              <div>
                <p className="text-danger">
                  {result.errores.length} {result.errores.length === 1 ? 'fallo' : 'fallos'}. Vuelve a lanzar la
                  migración para reintentarlos:
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs text-danger">
                  {result.errores.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Panel>
  )
}
