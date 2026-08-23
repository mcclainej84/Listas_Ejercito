// ============================================================================
// Las figuras del emblema, pedidas cuando hacen falta y compartidas por todos.
//
// El catálogo son 650 kB que no tiene sentido descargar en cada visita (ver
// domain/emblemaFiguras). Este enlace lo pide al montar y devuelve null hasta
// que llega; quien lo use tiene que pintar bien con null, que es exactamente lo
// que hace svgDeEmblema: campo, partición y contorno, sin figura.
//
// Después de la primera vez ya está en memoria, así que el `null` inicial solo
// se ve una vez por pestaña.
// ============================================================================
import { useEffect, useState } from 'react'
import { cargarFiguras, figurasEnMemoria, type CatalogoDeFiguras } from '@/domain/emblemaFiguras'

export function useFigurasDeEmblema(): CatalogoDeFiguras | null {
  const [figuras, setFiguras] = useState<CatalogoDeFiguras | null>(figurasEnMemoria)

  useEffect(() => {
    if (figuras) return
    let vivo = true
    void cargarFiguras().then((f) => {
      if (vivo) setFiguras(f)
    })
    return () => {
      vivo = false
    }
  }, [figuras])

  return figuras
}
