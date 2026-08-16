import type { ReactNode } from 'react'
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom'
import { AppShell } from '@/shared/layout/AppShell'
import { PasswordGate } from '@/shared/layout/PasswordGate'
import { useSession } from '@/shared/session/useSession'
import { FactionsListPage } from '@/features/admin/factions/FactionsListPage'
import { RulesListPage } from '@/features/admin/rules/RulesListPage'
import { UnitsListPage } from '@/features/admin/units/UnitsListPage'
import { PersonajesRenombrePage } from '@/features/renombre/PersonajesRenombrePage'
import { UnitDetailPage } from '@/features/admin/units/UnitDetailPage'
import { MountsListPage } from '@/features/admin/mounts/MountsListPage'
import { ChariotsListPage } from '@/features/admin/chariots/ChariotsListPage'
import { OptionsListPage } from '@/features/admin/equipment/OptionsListPage'
import { ImportBookPage } from '@/features/admin/import/ImportBookPage'
import { TaxonomyPage } from '@/features/admin/taxonomy/TaxonomyPage'
import { MagicPathsPage } from '@/features/admin/magic/MagicPathsPage'
import { LogPage } from '@/features/admin/log/LogPage'
import { FichasPage } from '@/features/fichas/FichasPage'
import { ArmyListsPage } from '@/features/army-lists/ArmyListsPage'
import { ArmyListBuilderPage } from '@/features/army-lists/ArmyListBuilderPage'
import { DeploymentPage } from '@/features/army-lists/DeploymentPage'
import { MapsListPage } from '@/features/maps/MapsListPage'
import { MapEditorPage } from '@/features/maps/MapEditorPage'

// HashRouter (en vez de BrowserRouter): GitHub Pages no reescribe rutas del
// lado del servidor, así que cualquier ruta "bonita" con BrowserRouter daría
// 404 al recargar o compartir un enlace directo. El hash ("#/admin/reglas")
// siempre lo resuelve el propio navegador sin tocar el servidor.
//
// Se usa createHashRouter + RouterProvider (data router) en vez del modo
// declarativo <HashRouter><Routes> porque UnitDetailPage necesita
// useBlocker() para avisar de cambios sin guardar al navegar fuera de la
// ficha — ese hook solo funciona con un data router.
/**
 * Las pantallas de edición solo se ven en "modo administrador". No es un
 * permiso (se activa sin contraseña, ver useSession): evita que quien solo
 * quiere consultar fichas y montar ejércitos se encuentre con el editor, y que
 * llegue ahí por un enlace directo.
 */
function AdminOnly({ children }: { children: ReactNode }) {
  const { actingAsAdmin } = useSession()
  if (!actingAsAdmin) return <Navigate to="/hojas" replace />
  return <>{children}</>
}

/** Envoltorio de las rutas de edición: modo administrador + contraseña de grupo. */
function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <AdminOnly>
      <PasswordGate>{children}</PasswordGate>
    </AdminOnly>
  )
}

const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Navigate to="/hojas" replace /> },
      {
        path: '/admin/facciones',
        element: (
          <AdminRoute>
            <FactionsListPage />
          </AdminRoute>
        ),
      },
      {
        path: '/admin/reglas',
        element: (
          <AdminRoute>
            <RulesListPage />
          </AdminRoute>
        ),
      },
      {
        path: '/admin/unidades',
        element: (
          <AdminRoute>
            <UnitsListPage />
          </AdminRoute>
        ),
      },
      {
        path: '/admin/unidades/:id',
        element: (
          <AdminRoute>
            <UnitDetailPage />
          </AdminRoute>
        ),
      },
      {
        path: '/admin/monturas',
        element: (
          <AdminRoute>
            <MountsListPage />
          </AdminRoute>
        ),
      },
      {
        path: '/admin/carros',
        element: (
          <AdminRoute>
            <ChariotsListPage />
          </AdminRoute>
        ),
      },
      {
        path: '/admin/opciones',
        element: (
          <AdminRoute>
            <OptionsListPage />
          </AdminRoute>
        ),
      },
      {
        path: '/admin/taxonomia',
        element: (
          <AdminRoute>
            <TaxonomyPage />
          </AdminRoute>
        ),
      },
      {
        path: '/admin/sendas',
        element: (
          <AdminRoute>
            <MagicPathsPage />
          </AdminRoute>
        ),
      },
      {
        path: '/admin/importar',
        element: (
          <AdminRoute>
            <ImportBookPage />
          </AdminRoute>
        ),
      },
      {
        path: '/admin/log',
        element: (
          <AdminRoute>
            <LogPage />
          </AdminRoute>
        ),
      },
      {
        path: '/hojas',
        element: (
          <PasswordGate>
            <FichasPage />
          </PasswordGate>
        ),
      },
      // La sección se llamaba "Fichas" y su ruta era /fichas. Se mantiene
      // redirigiendo para no romper los enlaces que alguien tuviera guardados.
      { path: '/fichas', element: <Navigate to="/hojas" replace /> },
      {
        // Personajes de Renombre. SIN AdminRoute a propósito: la sección salió
        // de "Editor" y la usa cualquiera (ver PersonajesRenombrePage). Solo
        // queda la contraseña de grupo, como Hojas, Ejércitos y Mapas.
        path: '/renombre',
        element: (
          <PasswordGate>
            <PersonajesRenombrePage />
          </PasswordGate>
        ),
      },
      // Estuvo en /admin/personajes-especiales mientras vivía dentro de
      // "Editor"; se redirige para no romper enlaces guardados ni el historial.
      { path: '/admin/personajes-especiales', element: <Navigate to="/renombre" replace /> },
      {
        path: '/ejercitos',
        element: (
          <PasswordGate>
            <ArmyListsPage />
          </PasswordGate>
        ),
      },
      {
        path: '/ejercitos/:id',
        element: (
          <PasswordGate>
            <ArmyListBuilderPage />
          </PasswordGate>
        ),
      },
      {
        path: '/ejercitos/:id/despliegue',
        element: (
          <PasswordGate>
            <DeploymentPage />
          </PasswordGate>
        ),
      },
      {
        path: '/mapas',
        element: (
          <PasswordGate>
            <MapsListPage />
          </PasswordGate>
        ),
      },
      {
        path: '/mapas/:id',
        element: (
          <PasswordGate>
            <MapEditorPage />
          </PasswordGate>
        ),
      },
      { path: '*', element: <Navigate to="/hojas" replace /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
