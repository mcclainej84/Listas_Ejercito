// ============================================================================
// La credencial con la que este navegador escribe.
//
// QUÉ ES. El id del usuario que ha entrado y el SHA-256 de su contraseña. Viaja
// en dos cabeceras (`X-WHArmy-User` y `X-WHArmy-Auth`) en cada escritura, y el
// Worker la comprueba contra la tabla `user_secrets` — ver la sección
// AUTENTICACIÓN de worker/src/index.ts. No hay token ni sesión que caduque: la
// credencial ES la contraseña.
//
// POR QUÉ SE GUARDA EL HASH Y NO LA CONTRASEÑA. Porque es lo que el servidor
// compara, así que la contraseña en claro no hace falta para nada después de
// entrar. Guardar lo mínimo que sirve es gratis y evita que el texto ande por
// localStorage.
//
// LO QUE NO ES. Esto no protege el navegador de nadie que se siente delante:
// quien pueda abrir las herramientas de desarrollo ve el hash, igual que vería
// una cookie de sesión. Lo que cierra es que la URL de la API sea una llave
// maestra para cualquiera que la conozca.
//
// Se guarda junto a la sesión (shared/session/useSession) pero por separado, y
// a propósito: la sesión dice QUIÉN eres —y la lee media aplicación—, esto dice
// con qué te acreditas y solo lo lee la capa de red.
// ============================================================================

const CLAVE = 'wharmy:credencial'

export interface Credencial {
  userId: number
  /** SHA-256 de la contraseña. */
  hash: string
}

let credencial: Credencial | null = leer()

function leer(): Credencial | null {
  try {
    const bruto = localStorage.getItem(CLAVE)
    if (!bruto) return null
    const c = JSON.parse(bruto) as Credencial
    return typeof c?.userId === 'number' && typeof c?.hash === 'string' ? c : null
  } catch {
    return null
  }
}

export function credencialActual(): Credencial | null {
  return credencial
}

export function guardarCredencial(c: Credencial): void {
  credencial = c
  try {
    localStorage.setItem(CLAVE, JSON.stringify(c))
  } catch {
    // Navegación privada muy restrictiva: se podrá escribir en esta pestaña,
    // pero habrá que volver a entrar en la siguiente.
  }
}

export function olvidarCredencial(): void {
  credencial = null
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    // ignorar
  }
}

/**
 * Las cabeceras de acreditación, o un objeto vacío si no hay sesión.
 *
 * Vacío en vez de lanzar: quien escribe sin credencial recibe un 401 del
 * servidor con su mensaje, que es más útil que una excepción distinta según
 * desde dónde se llame.
 */
export function cabecerasDeAcceso(): Record<string, string> {
  if (!credencial) return {}
  return {
    'X-WHArmy-User': String(credencial.userId),
    'X-WHArmy-Auth': credencial.hash,
  }
}
