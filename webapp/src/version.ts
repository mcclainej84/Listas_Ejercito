// ============================================================================
// Versión del programa — ÚNICA fuente de verdad. Se muestra en el pie de
// página (ver AppShell) para poder saber de un vistazo qué versión se está
// ejecutando; es también la forma rápida de detectar que el navegador está
// sirviendo una build antigua en caché.
//
// CÓMO SE ACTUALIZA
// CUALQUIER cambio en el frontend sube la versión y actualiza la fecha y hora.
//
// LA FECHA SE SACA DEL RELOJ, NUNCA A OJO. Se mira la hora real de España
// (`TZ=Europe/Madrid date '+%Y-%m-%dT%H:%M'`) y se copia. Durante un tiempo se
// fueron poniendo fechas "aproximadas" escritas de memoria, y el resultado fue
// que el pie de página decía el día anterior y una hora que no había existido:
// justo lo contrario de para lo que está este dato, que es saber si lo que se
// está viendo es lo último. Las entradas del CHANGELOG afectadas se corrigieron
// después con la fecha real de su commit.
//
// El número que va tras el punto es un CONTADOR, no un decimal: se incrementa
// de uno en uno indefinidamente y NUNCA vuelca a 1.0. La secuencia es
// 0.8 → 0.9 → 0.10 → 0.11 → … → 0.42 → … Se pasará a 1.0 solo cuando el
// usuario lo pida expresamente.
//
// Consecuencia a tener en cuenta: como es un contador, 0.10 es POSTERIOR a
// 0.9 (aunque como número decimal sería menor). No ordenar las versiones
// comparándolas como números.
//
// Hay que anotar el cambio también en CHANGELOG.md, en la raíz del repositorio.
// ============================================================================

export const APP_VERSION = '0.113'

/**
 * Fecha y hora de la última actualización, `YYYY-MM-DDTHH:mm` (hora local de
 * España). Se pone a mano al subir la versión; no se genera en la compilación
 * a propósito, para que refleje cuándo se hizo el cambio y no cuándo se
 * compiló por última vez.
 */
export const APP_VERSION_DATE = '2026-08-15T15:32'

/** "20/07/2026 13:13" — fecha y hora tal y como se muestran en pantalla. */
export function formatVersionDate(stamp: string = APP_VERSION_DATE): string {
  const [date, time] = stamp.split('T')
  const [year, month, day] = date.split('-')
  return time ? `${day}/${month}/${year} ${time}` : `${day}/${month}/${year}`
}
