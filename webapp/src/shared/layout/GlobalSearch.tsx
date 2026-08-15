import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { UnitRepository, type UnitSummary } from '@/data/repositories/unitRepository'
import { RuleRepository } from '@/data/repositories/ruleRepository'
import type { SpecialRule } from '@/domain/types'

/**
 * Buscador global de unidades y reglas especiales. Vive en la barra superior
 * y está disponible en cualquier pantalla, para que "consultar la ficha de
 * una unidad" o "ver la descripción de una regla" nunca esté a más de un
 * clic de distancia, tal y como pide la especificación (todo interconectado).
 *
 * El panel de resultados se pinta en un PORTAL a `document.body`, posicionado
 * a mano bajo el input con `getBoundingClientRect` — igual que el menú Editor
 * (ver TopNav.tsx#EditorMenu). Motivo: la barra superior tiene
 * `overflow-x-auto`, y en CSS eso convierte también `overflow-y` en `auto`,
 * de modo que CUALQUIER hijo con posición absoluta que sobresalga hacia abajo
 * (como el desplegable de resultados) queda RECORTADO por ese contenedor —
 * era justo lo que hacía que el buscador "no funcionara": sí buscaba, pero
 * los resultados quedaban ocultos bajo el borde de la barra. Un portal escapa
 * de ese recorte por completo.
 */
export function GlobalSearch() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [units, setUnits] = useState<UnitSummary[]>([])
  const [rules, setRules] = useState<SpecialRule[]>([])
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const showPanel = open && text.trim().length >= 2

  function reposition() {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }

  // Posiciona el panel ANTES de pintarlo (evita el salto de un frame en
  // 0,0). useLayoutEffect corre síncrono tras el render, con el input ya
  // medible.
  useLayoutEffect(() => {
    if (showPanel) reposition()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPanel])

  useEffect(() => {
    if (!showPanel) return
    function onReposition() {
      reposition()
    }
    // Al desplazar/redimensionar la ventana, el input se mueve: hay que
    // recolocar el panel (o cerrarlo). `true` para capturar scroll de
    // cualquier contenedor, no solo el de la ventana.
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [showPanel])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      // El panel vive en un portal fuera de `containerRef`; sin comprobarlo
      // también, el `mousedown` sobre un resultado cerraría el panel ANTES de
      // que su `click` navegara (el nodo se desmontaría entre medias).
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    const query = text.trim()
    if (query.length < 2) {
      setUnits([])
      setRules([])
      return
    }
    let cancelled = false
    void Promise.all([UnitRepository.search(query), RuleRepository.listAll()]).then(([unitResults, allRules]) => {
      if (cancelled) return
      setUnits(unitResults)
      setRules(allRules.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8))
    })
    return () => {
      cancelled = true
    }
  }, [text])

  const hasResults = units.length > 0 || rules.length > 0

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar unidad o regla…"
        className="w-full rounded-sm border border-rule-dark/50 bg-parchment/70 px-3 py-1 text-xs outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/25"
      />
      {showPanel &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-50 max-h-96 overflow-y-auto rounded-sm border border-rule-dark/40 bg-parchment shadow-lg shadow-black/15"
            style={{ top: coords.top, left: coords.left, width: coords.width }}
          >
            {!hasResults && <p className="px-3 py-3 text-sm text-ink-soft">Sin resultados.</p>}
            {units.length > 0 && (
              <div className="border-b border-rule-dark/20 py-1">
                <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Unidades</p>
                {units.map((u) => (
                  <button
                    key={u.id}
                    className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-parchment-dark"
                    onClick={() => {
                      navigate(`/admin/unidades/${u.id}`)
                      setOpen(false)
                      setText('')
                    }}
                  >
                    <span className="font-medium text-ink">{u.name}</span>
                    <span className="text-xs text-ink-soft">{u.factionName}</span>
                  </button>
                ))}
              </div>
            )}
            {rules.length > 0 && (
              <div className="py-1">
                <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Reglas especiales
                </p>
                {rules.map((r) => (
                  <button
                    key={r.id}
                    className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-parchment-dark"
                    onClick={() => {
                      navigate(`/admin/reglas?q=${encodeURIComponent(r.name)}`)
                      setOpen(false)
                      setText('')
                    }}
                  >
                    <span className="font-medium text-ink">{r.name}</span>
                    <span className="line-clamp-1 text-xs text-ink-soft">{r.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
