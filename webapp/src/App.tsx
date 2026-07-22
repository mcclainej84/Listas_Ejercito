import { DatabaseGate } from '@/app/DatabaseGate'
import { UserGate } from '@/app/UserGate'
import { AppRouter } from '@/app/AppRouter'
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <DatabaseGate>
        {/* Identificarse va DESPUÉS de comprobar la API: la pantalla de acceso
            necesita consultar la tabla de usuarios. */}
        <UserGate>
          <AppRouter />
        </UserGate>
      </DatabaseGate>
    </ErrorBoundary>
  )
}
