// ============================================================================
// Sesión del usuario: quién ha entrado y si está actuando como administrador.
//
// Vive en localStorage (no hay servidor de sesiones) y se comparte entre todos
// los componentes con un Set de listeners, mismo patrón que useGrayscaleMode.
//
// IMPORTANTE: el "modo admin" es una preferencia de VISTA, no un permiso. Se
// activa y desactiva sin contraseña, por decisión expresa: solo controla si se
// muestran las opciones de edición. No protege nada.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import type { User } from '@/domain/types'

const USER_KEY = 'wharmy_session_user'
const ADMIN_KEY = 'wharmy_session_admin'

export interface Session {
  user: User | null
  actingAsAdmin: boolean
}

function readSession(): Session {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return {
      user: raw ? (JSON.parse(raw) as User) : null,
      actingAsAdmin: localStorage.getItem(ADMIN_KEY) === '1',
    }
  } catch {
    return { user: null, actingAsAdmin: false }
  }
}

const listeners = new Set<(s: Session) => void>()
let current = readSession()

function emit(): void {
  listeners.forEach((l) => l(current))
}

export function signIn(user: User): void {
  current = { user, actingAsAdmin: current.actingAsAdmin }
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // Navegación privada muy restrictiva: la sesión no se recordará.
  }
  emit()
}

export function signOut(): void {
  current = { user: null, actingAsAdmin: false }
  try {
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(ADMIN_KEY)
  } catch {
    // ignorar
  }
  emit()
}

export function setActingAsAdmin(value: boolean): void {
  current = { ...current, actingAsAdmin: value }
  try {
    localStorage.setItem(ADMIN_KEY, value ? '1' : '0')
  } catch {
    // ignorar
  }
  emit()
}

/**
 * Usuario actual FUERA de React. Los hooks no sirven en la capa de datos, y el
 * registro de cambios (ver changeLogRepository) necesita saber quién escribe
 * sin que cada repositorio tenga que recibirlo por parámetro desde la UI.
 */
export function getCurrentUser(): User | null {
  return current.user
}

/** Sesión actual (usuario + modo admin), reactiva en cualquier componente. */
export function useSession(): Session {
  const [session, setSession] = useState(current)
  useEffect(() => {
    listeners.add(setSession)
    return () => {
      listeners.delete(setSession)
    }
  }, [])
  return session
}

/** Atajo: alterna el modo administrador. */
export function useAdminToggle(): [boolean, () => void] {
  const { actingAsAdmin } = useSession()
  const toggle = useCallback(() => setActingAsAdmin(!current.actingAsAdmin), [])
  return [actingAsAdmin, toggle]
}
