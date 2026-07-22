// ============================================================================
// Contraseña de grupo compartida.
//
// La app no tiene usuarios: cualquier persona con la URL puede leer los
// datos, pero escribir (Admin, constructor de listas) requiere conocer una
// única contraseña de grupo, fijada por quien despliega el Worker
// (`wrangler secret put GROUP_PASSWORD_HASH`). El navegador nunca envía la
// contraseña en claro: solo su hash SHA-256, calculado aquí mismo con
// crypto.subtle. El servidor solo necesita comparar ese hash contra el que
// tiene guardado — ver worker/src/index.ts.
//
// Se guarda en localStorage (no sessionStorage) para no tener que
// reintroducirla en cada pestaña/recarga; si el hash guardado resulta ser
// incorrecto, el primer intento de escritura lo revela (401 -> AuthRequiredError,
// ver data/sqlite/client.ts) y se borra para pedirla de nuevo.
// ============================================================================

const STORAGE_KEY = 'wharmy:group-pw-hash'

// Bus de cambios muy simple para que <PasswordGate> (app/../shared/layout)
// pueda reaccionar en el momento en que se borra la contraseña (p.ej. tras un
// 401 detectado en data/sqlite/client.ts) y volver a pedirla, sin tener que
// sondear localStorage ni depender del evento 'storage' (que el propio
// navegador no dispara en la misma pestaña que hizo el cambio).
const authListeners = new Set<() => void>()

function notifyAuthChange(): void {
  for (const listener of authListeners) listener()
}

/** Se suscribe a cambios en la contraseña guardada (fijada o borrada). Devuelve la función para darse de baja. */
export function onAuthChange(listener: () => void): () => void {
  authListeners.add(listener)
  return () => authListeners.delete(listener)
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function getStoredPasswordHash(): Promise<string | null> {
  return localStorage.getItem(STORAGE_KEY)
}

export function hasStoredPassword(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

export async function setPassword(rawPassword: string): Promise<void> {
  const hash = await sha256Hex(rawPassword)
  localStorage.setItem(STORAGE_KEY, hash)
  notifyAuthChange()
}

/** Borra la contraseña guardada (p.ej. tras un 401, para que se vuelva a pedir). */
export function clearPassword(): void {
  localStorage.removeItem(STORAGE_KEY)
  notifyAuthChange()
}
