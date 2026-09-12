import type { ReactNode } from 'react'
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom'
import { AppShell } from '@/shared/layout/AppShell'
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
import { BattlesListPage } from '@/features/battles/BattlesListPage'
import { BattlePage } from '@/features/battles/BattlePage'
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

const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Navigate to="/hojas" replace /> },
      {
        path: '/admin/facciones',
        element: (
          <AdminOnly>
            <FactionsListPage />
          </AdminOnly>
        ),
      },
      {
        path: '/admin/reglas',
        element: (
          <AdminOnly>
            <RulesListPage />
          </AdminOnly>
        ),
      },
      {
        path: '/admin/unidades',
        element: (
          <AdminOnly>
            <UnitsListPage />
          </AdminOnly>
        ),
      },
      {
        path: '/admin/unidades/:id',
        element: (
          <AdminOnly>
            <UnitDetailPage />
          </AdminOnly>
        ),
      },
      {
        path: '/admin/monturas',
        element: (
          <AdminOnly>
            <MountsListPage />
          </AdminOnly>
        ),
      },
      {
        path: '/admin/carros',
        element: (
          <AdminOnly>
            <ChariotsListPage />
          </AdminOnly>
        ),
      },
      {
        path: '/admin/opciones',
        element: (
          <AdminOnly>
            <OptionsListPage />
          </AdminOnly>
        ),
      },
      {
        path: '/admin/taxonomia',
        element: (
          <AdminOnly>
            <TaxonomyPage />
          </AdminOnly>
        ),
      },
      {
        path: '/admin/sendas',
        element: (
          <AdminOnly>
            <MagicPathsPage />
          </AdminOnly>
        ),
      },
      {
        path: '/admin/importar',
        element: (
          <AdminOnly>
            <ImportBookPage />
          </AdminOnly>
        ),
      },
      {
        path: '/admin/log',
        element: (
          <AdminOnly>
            <LogPage />
          </AdminOnly>
        ),
      },
      {
        path: '/hojas',
        element: <FichasPage />,
      },
      // La sección se llamaba "Fichas" y su ruta era /fichas. Se mantiene
      // redirigiendo para no romper los enlaces que alguien tuviera guardados.
      { path: '/fichas', element: <Navigate to="/hojas" replace /> },
      {
        // Personajes de Renombre. SIN AdminOnly a propósito: la sección salió
        // de "Editor" y la usa cualquiera (ver PersonajesRenombrePage).
        path: '/renombre',
        element: <PersonajesRenombrePage />,
      },
      // Estuvo en /admin/personajes-especiales mientras vivía dentro de
      // "Editor"; se redirige para no romper enlaces guardados ni el historial.
      { path: '/admin/personajes-especiales', element: <Navigate to="/renombre" replace /> },
      {
        path: '/ejercitos',
        element: <ArmyListsPage />,
      },
      {
        path: '/ejercitos/:id',
        element: <ArmyListBuilderPage />,
      },
      {
        path: '/ejercitos/:id/despliegue',
        element: <DeploymentPage />,
      },
      {
        path: '/batallas',
        element: <BattlesListPage />,
      },
      {
        path: '/batallas/:id',
        element: <BattlePage />,
      },
      {
        path: '/mapas',
        element: <MapsListPage />,
      },
      {
        path: '/mapas/:id',
        element: <MapEditorPage />,
      },
      { path: '*', element: <Navigate to="/hojas" replace /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
