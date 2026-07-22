import { useEffect, useState, type ReactNode } from 'react'
import { ensureReady } from '@/data/sqlite/client'
import { preloadLocalCatalog } from '@/data/sqlite/localCatalog'
import { runCatalogMaintenance } from '@/data/repositories/catalogMaintenance'
import { Spinner } from '@/shared/ui/Spinner'

// Cuánto esperamos, como máximo, a que el catálogo local (sql.js en memoria,
// ver data/sqlite/localCatalog.ts) esté listo antes de renderizar igualmente
// la app. Es solo una ventana de cortesía para evitar el parpadeo de "esto
// está cargando" en la primera página que lee catálogo (que si no, dispararía
// su propia carga bajo demanda igualmente) — NO es una condición para poder
// usar la app: si /snapshot tarda más que esto (red lenta, Worker frío...),
// se muestra la app de todas formas y cada repositorio de catálogo espera su
// propia promesa de carga la primera vez que se le pregunta algo.
const CATALOG_PRELOAD_BUDGET_MS = 4000

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Se asegura de que la API compartida (Cloudflare Worker + D1) responda
 * antes de renderizar el resto de la app. Todas las páginas asumen que
 * pueden llamar a los repositorios de inmediato; este componente es el
 * único responsable de la espera/comprobación inicial.
 *
 * Además, dispara en paralelo la precarga del catálogo local en memoria
 * (facciones/unidades/reglas/equipo/mejoras/perfiles — ver
 * data/sqlite/localCatalog.ts) para que esté listo, si da tiempo, antes de
 * que la primera página lo pida. `ensureReady()` (comprobación real de que
 * la API responde) sigue siendo la única condición que bloquea el arranque;
 * la precarga del catálogo solo se espera hasta CATALOG_PRELOAD_BUDGET_MS.
 */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const apiCheck = ensureReady()
    // Los errores de la precarga del catálogo no deben tumbar el arranque de
    // la app (ensureReady ya cubre "¿responde la API?"): si /snapshot falla
    // aquí, cada repositorio de catálogo reintentará su propia carga la
    // primera vez que se le pregunte algo (ver getLocalDb en localCatalog.ts).
    const catalogPreload = preloadLocalCatalog().catch(() => undefined)

    Promise.all([apiCheck, Promise.race([catalogPreload, wait(CATALOG_PRELOAD_BUDGET_MS)])])
      .then(() => {
        setStatus('ready')
        // Corrige, una vez, las abreviaturas de equipo/opciones que aún queden
        // en el catálogo (ver catalogMaintenance). No bloquea el arranque.
        void runCatalogMaintenance().catch(() => undefined)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
        setStatus('error')
      })
  }, [])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Cargando datos maestros…" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm rounded-sm border border-danger-dark/40 bg-danger-dark/10 p-6 text-center">
          <p className="text-sm font-medium text-danger-dark">No se pudo cargar la base de datos</p>
          <p className="mt-1 text-xs text-danger">{error}</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
