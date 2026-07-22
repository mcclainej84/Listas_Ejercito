import { Outlet } from 'react-router-dom'
import { clsx } from 'clsx'
import { TopNav } from '@/shared/layout/TopNav'
import { PendingMigrationsBanner } from '@/shared/layout/PendingMigrationsBanner'
import { useGlobalGrayscale } from '@/shared/theme/useGrayscaleMode'
import { APP_VERSION, formatVersionDate } from '@/version'

export function AppShell() {
  // Preferencia global "ver en blanco y negro" (botón en TopNav, ver
  // useGrayscaleMode.ts). Aplica la clase `grayscale-media` (ver index.css),
  // que desatura SOLO las imágenes (emblemas e ilustraciones) en cualquier
  // pantalla; el resto de la interfaz —pergamino, tipografía, colores— se
  // mantiene a color. (Antes se ponía un `filter:grayscale` sobre todo el
  // árbol, que volvía gris el programa entero; el usuario pidió que el
  // interruptor solo tocara las imágenes.)
  const [grayscale] = useGlobalGrayscale()

  return (
    <div className={clsx('flex min-h-screen flex-col', grayscale && 'grayscale-media')}>
      <TopNav />
      <PendingMigrationsBanner />
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </main>
      {/* Versión visible: sirve de referencia al reportar un fallo y delata
          de inmediato que el navegador está sirviendo una build en caché. */}
      <footer className="border-t border-rule-dark/20 px-6 py-3">
        <div className="mx-auto flex max-w-4xl justify-end">
          <p className="text-mini text-ink-soft">
            WHArmy v{APP_VERSION} · actualizado el {formatVersionDate()}
          </p>
        </div>
      </footer>
    </div>
  )
}
