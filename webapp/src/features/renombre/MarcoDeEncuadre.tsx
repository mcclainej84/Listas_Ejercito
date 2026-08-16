// ============================================================================
// Encuadre del retrato: arrastrar para mover, rueda o barra para ampliar.
//
// El hueco del retrato es CUADRADO y una foto casi nunca lo es, así que sin
// esto el resultado quedaba a merced del archivo: un retrato vertical salía con
// dos franjas vacías a los lados y la cara diminuta en el centro, y la única
// forma de arreglarlo era recortar la foto fuera del programa y volver a
// subirla.
//
// LO QUE SE VE AQUÍ ES EXACTAMENTE LO QUE SE GUARDA. La vista previa coloca la
// imagen con las mismas cuentas que luego usa el lienzo
// (shared/image#medidasDelEncuadre), en fracciones del lado del cuadro y no en
// píxeles: así el cuadro puede medir 224 px en pantalla y 512 px al guardar sin
// que haya una segunda conversión que pueda desviarse de la primera.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import {
  limitarEncuadre,
  medidasDelEncuadre,
  ZOOM_RETRATO_MAX,
  ZOOM_RETRATO_MIN,
  type EncuadreRetrato,
} from '@/shared/image'

interface MarcoDeEncuadreProps {
  /** URL de la imagen de trabajo (la ya preparada, con el fondo quitado). */
  url: string
  /** Medidas originales, para saber cuánto ocupa dentro del cuadro. */
  ancho: number
  alto: number
  encuadre: EncuadreRetrato
  onChange: (encuadre: EncuadreRetrato) => void
}

export function MarcoDeEncuadre({ url, ancho, alto, encuadre, onChange }: MarcoDeEncuadreProps) {
  const cuadroRef = useRef<HTMLDivElement>(null)
  const [arrastrando, setArrastrando] = useState(false)
  // Punto donde se agarró y encuadre en ese momento. Se guarda en una ref y no
  // en el estado: cambia en cada `pointermove` y no tiene que repintar nada.
  const agarre = useRef<{ px: number; py: number; x: number; y: number } | null>(null)

  const { fw, fh } = medidasDelEncuadre(ancho, alto, encuadre.zoom)

  /** Lado del cuadro en pantalla. Hace falta para pasar píxeles de ratón a fracciones. */
  function ladoEnPantalla(): number {
    return cuadroRef.current?.getBoundingClientRect().width ?? 1
  }

  function alBajarPuntero(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    agarre.current = { px: e.clientX, py: e.clientY, x: encuadre.x, y: encuadre.y }
    setArrastrando(true)
  }

  function alMoverPuntero(e: React.PointerEvent<HTMLDivElement>) {
    const inicio = agarre.current
    if (!inicio) return
    const lado = ladoEnPantalla()
    onChange(
      limitarEncuadre(
        {
          zoom: encuadre.zoom,
          x: inicio.x + (e.clientX - inicio.px) / lado,
          y: inicio.y + (e.clientY - inicio.py) / lado,
        },
        ancho,
        alto,
      ),
    )
  }

  function alSoltarPuntero(e: React.PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    agarre.current = null
    setArrastrando(false)
  }

  function cambiarZoom(zoom: number) {
    onChange(limitarEncuadre({ ...encuadre, zoom }, ancho, alto))
  }

  // La rueda se escucha a mano y NO con `onWheel` de React, que registra el
  // oyente como pasivo y entonces `preventDefault` no hace nada: la página
  // entera se desplazaba mientras intentabas ampliar el retrato.
  useEffect(() => {
    const nodo = cuadroRef.current
    if (!nodo) return
    function alRodar(e: WheelEvent) {
      e.preventDefault()
      cambiarZoom(encuadre.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12))
    }
    nodo.addEventListener('wheel', alRodar, { passive: false })
    return () => nodo.removeEventListener('wheel', alRodar)
  })

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={cuadroRef}
        onPointerDown={alBajarPuntero}
        onPointerMove={alMoverPuntero}
        onPointerUp={alSoltarPuntero}
        onPointerCancel={alSoltarPuntero}
        className={clsx(
          'relative h-56 w-56 shrink-0 touch-none overflow-hidden rounded-sm border border-rule-dark/50 bg-parchment-dark/40 select-none',
          arrastrando ? 'cursor-grabbing' : 'cursor-grab',
        )}
        role="application"
        aria-label="Encuadre del retrato: arrastra para mover, rueda para ampliar"
      >
        <img
          src={url}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{
            width: `${fw * 100}%`,
            height: `${fh * 100}%`,
            left: `${(0.5 - fw / 2 + encuadre.x) * 100}%`,
            top: `${(0.5 - fh / 2 + encuadre.y) * 100}%`,
          }}
        />
        {/* Guías en tercios, solo mientras se arrastra: ayudan a centrar la
            cara y desaparecen para no ensuciar la vista previa. */}
        {arrastrando && (
          <span aria-hidden className="pointer-events-none absolute inset-0">
            <span className="absolute inset-y-0 left-1/3 w-px bg-parchment/50" />
            <span className="absolute inset-y-0 left-2/3 w-px bg-parchment/50" />
            <span className="absolute inset-x-0 top-1/3 h-px bg-parchment/50" />
            <span className="absolute inset-x-0 top-2/3 h-px bg-parchment/50" />
          </span>
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-sm ring-1 ring-inset ring-bronze/35"
          style={{ boxShadow: 'inset 0 0 16px rgba(20,14,6,0.28)' }}
        />
      </div>

      <label className="flex items-center gap-2">
        <span className="text-micro uppercase tracking-widest text-ink-soft/70">Zoom</span>
        <input
          type="range"
          className="w-40 accent-maroon"
          min={ZOOM_RETRATO_MIN}
          max={ZOOM_RETRATO_MAX}
          step={0.01}
          value={encuadre.zoom}
          onChange={(e) => cambiarZoom(Number(e.target.value))}
          aria-label="Ampliar el retrato"
        />
        <span className="w-10 shrink-0 text-mini tabular-nums text-ink-soft">{encuadre.zoom.toFixed(1)}×</span>
      </label>
    </div>
  )
}
