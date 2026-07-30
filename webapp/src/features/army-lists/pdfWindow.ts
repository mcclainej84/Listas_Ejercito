// ============================================================================
// Abrir un PDF en una pestaña sin que el navegador lo bloquee.
//
// EL PROBLEMA. Los navegadores solo dejan abrir una pestaña mientras dura la
// "activación por gesto del usuario", que caduca a los pocos instantes de la
// pulsación. "Exportar Lista" tarda poco y solía llegar a tiempo; "Exportar
// Hojas de unidad" carga fuentes e ilustraciones desde R2 y dibuja un canvas
// por unidad, así que para cuando tiene el PDF hecho la activación ya ha
// caducado y la pestaña se bloquea.
//
// LA SOLUCIÓN. Abrir la pestaña VACÍA en el mismo instante del clic —cuando el
// permiso todavía vale— y llevarla al PDF cuando esté listo. Mientras tanto
// enseña un aviso, para que no parezca una pestaña en blanco colgada.
//
// Y si aun así la bloquean (hay quien lo tiene desactivado del todo), se cae a
// descargar el archivo, que no necesita permiso de ningún tipo.
// ============================================================================
import type { jsPDF } from 'jspdf'

/**
 * Se llama SIN await de por medio dentro del manejador del clic. Cualquier
 * `await` antes de esta línea tira por tierra el propósito.
 */
export function abrirPestanaPdf(): Window | null {
  const ventana = window.open('', '_blank')
  if (!ventana) return null
  ventana.document.write(
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Generando el PDF…</title></head>' +
      '<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;' +
      'font:15px Georgia,serif;color:#706557;background:#ebe5d8">Generando el PDF…</body></html>',
  )
  ventana.document.close()
  return ventana
}

/** Lleva la pestaña ya abierta al PDF; si no hay pestaña, lo descarga. */
export function mostrarPdf(ventana: Window | null, doc: jsPDF, nombreArchivo: string): void {
  const url = doc.output('bloburl') as unknown as string
  if (ventana && !ventana.closed) {
    ventana.location.href = url
    return
  }
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Cierra la pestaña de espera cuando la generación falla, para no dejarla colgada con el aviso. */
export function cerrarPestanaPdf(ventana: Window | null): void {
  if (ventana && !ventana.closed) ventana.close()
}
