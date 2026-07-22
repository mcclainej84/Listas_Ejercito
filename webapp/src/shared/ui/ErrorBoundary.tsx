import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Frontera de errores de React. Hasta ahora no había ninguna: si CUALQUIER
 * componente lanzaba una excepción al renderizar (un dato inesperado, un bug
 * de una ronda futura...), React desmontaba todo el árbol y el usuario se
 * quedaba con una PÁGINA EN BLANCO, sin pista de qué pasó ni forma de
 * recuperarse salvo recargar a ciegas. Esta frontera atrapa ese error, lo
 * registra en consola (para depurar) y muestra un aviso legible con un botón
 * para reintentar/recargar, en la misma estética de pergamino del resto de la
 * app. Es puramente defensiva: en funcionamiento normal nunca se ve.
 */
interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Queda en consola para poder diagnosticar (no hay servicio de telemetría
    // en esta app; ver "Mejoras propuestas" para añadir uno si se quisiera).
    console.error('Error no controlado en la interfaz:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="max-w-md rounded-sm border border-maroon/40 bg-parchment/80 p-6 text-center shadow-sm shadow-black/10">
            <p className="font-display text-lg text-maroon">Algo ha fallado</p>
            <p className="mt-2 text-sm text-ink-soft">
              Ha ocurrido un error inesperado en la aplicación. Puedes reintentar; si el problema persiste, recarga la
              página.
            </p>
            <p className="mt-3 rounded-sm bg-maroon/10 px-2 py-1.5 text-left text-xs break-words text-maroon">
              {this.state.error.message}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => this.setState({ error: null })}
                className="rounded-sm border border-rule-dark/50 px-3 py-1.5 text-sm text-ink transition-colors hover:bg-parchment-dark"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-sm bg-maroon px-3 py-1.5 text-sm text-parchment transition-colors hover:bg-maroon-dark"
              >
                Recargar
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
