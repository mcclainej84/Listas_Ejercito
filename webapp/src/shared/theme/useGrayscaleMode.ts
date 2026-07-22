// ============================================================================
// Preferencia GLOBAL "ver todo el programa en blanco y negro" — un interruptor
// arriba del todo (ver TopNav.tsx), aparte del "Vista color/blanco y negro"
// propio de la sección Fichas (que solo controla la tarjeta y lo que se
// exporta, ver FichasPage.tsx). Este es puramente de PANTALLA: aplica
// `filter:grayscale(100%)` al contenedor raíz de toda la app (ver
// AppShell.tsx), así que afecta a cualquier imagen/emblema en cualquier
// pantalla sin tener que tocar cada componente uno a uno. Se recuerda entre
// sesiones (localStorage) porque es una preferencia de visualización del
// usuario, no un dato de la app.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'wharmy_global_grayscale'

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

// Un Set de listeners simple (sin librería de estado global) para que
// cambiar la preferencia desde CUALQUIER instancia del hook (p.ej. si en el
// futuro hubiera más de un botón) se refleje al instante en todas las demás.
const listeners = new Set<(v: boolean) => void>()
let current = readStored()

function setGlobal(value: boolean) {
  current = value
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // localStorage puede no estar disponible (navegación privada muy
    // restrictiva); en ese caso simplemente no se recuerda entre sesiones.
  }
  listeners.forEach((l) => l(value))
}

export function useGlobalGrayscale(): [boolean, () => void] {
  const [value, setValue] = useState(current)

  useEffect(() => {
    listeners.add(setValue)
    return () => {
      listeners.delete(setValue)
    }
  }, [])

  const toggle = useCallback(() => setGlobal(!current), [])

  return [value, toggle]
}
