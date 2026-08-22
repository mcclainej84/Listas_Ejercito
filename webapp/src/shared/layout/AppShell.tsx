import { Outlet, useLocation } from 'react-router-dom'
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

  // ==========================================================================
  // EL ANCHO DE LA COLUMNA LO DECIDE EL ARMAZÓN, NO LA PÁGINA.
  //
  // Casi todo el programa cabe en 56rem, pero la batalla necesita más: son dos
  // órdenes de batalla y una mesa, uno al lado del otro. Durante unas cuantas
  // versiones eso se resolvió desde la propia pantalla, escapándose de esta
  // columna con un margen negativo calculado a partir de `100vw`… y ahí no
  // había forma de acertar. `100vw` incluye la barra de desplazamiento, `main`
  // tiene su propio `px-6`, y el resultado era un bloque unos píxeles más ancho
  // que su hueco. Lo que sobra por la derecha se alcanza scrolleando; lo que
  // sobra por la IZQUIERDA no, porque una página no scrollea a la izquierda.
  // Así que la mesa aparecía cortada por ese lado, y cada arreglo era otra
  // cuenta que volvía a adivinar el ancho del navegador.
  //
  // La solución no era afinar la cuenta: era no hacerla. Se ensancha ESTA
  // columna, que ya está centrada con `mx-auto` dentro de un `main` con su
  // padding. El navegador se encarga: el ancho es el que haya, nunca más, y no
  // hay nada que calcular ni nada que se pueda salir.
  // ==========================================================================
  const enBatalla = /^\/batallas\/[^/]+$/.test(useLocation().pathname)

  return (
    <div className={clsx('flex min-h-screen flex-col', grayscale && 'grayscale-media')}>
      <TopNav />
      <PendingMigrationsBanner />
      <main className="flex-1 px-6 py-8">
        <div className={clsx('mx-auto', enBatalla ? 'max-w-[94rem]' : 'max-w-4xl')}>
          <Outlet />
        </div>
      </main>
      {/* Versión visible: sirve de referencia al reportar un fallo y delata
          de inmediato que el navegador está sirviendo una build en caché.

          CENTRADA EN LA PÁGINA, no en la columna de contenido. Antes iba
          pegada a la derecha de un bloque de 56 rem centrado, así que en una
          pantalla ancha quedaba a un tercio del borde: ni centrada ni en la
          esquina, que es lo que se veía raro. */}
      <footer className="border-t border-rule-dark/20 px-6 py-3">
        <p className="text-center text-mini text-ink-soft">
          WHArmy v{APP_VERSION} · actualizado el {formatVersionDate()}
        </p>
      </footer>
    </div>
  )
}
