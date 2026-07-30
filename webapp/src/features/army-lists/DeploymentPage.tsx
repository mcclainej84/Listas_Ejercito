// ============================================================================
// "Despliegue" — colocar las unidades de un ejército sobre la mesa (180 × 120
// cm) para tener el plan preparado antes de la partida.
//
// CENTÍMETROS, NO PÍXELES. Todo lo que se guarda y todo lo que se calcula va en
// cm reales de mesa; los píxeles solo aparecen al pintar y al leer el ratón,
// y se convierten en el acto (ver `aCm`). El lienzo se estira con la ventana y
// el plan no cambia.
//
// EL LIENZO MANDA. Ocupa todo el ancho disponible y la reserva va DEBAJO, no
// al lado: una mesa es apaisada (3:2) y robarle una columna para un listado la
// encogía justo en la dirección que más duele.
//
// QUÉ SE VE EN CADA PEANA. El emblema de la facción dentro del cuadro y el
// nombre FUERA, debajo, sobre la mesa. A 4 × 4 cm no cabe un nombre dentro sin
// recortarlo, y el nombre es lo único que hay que poder leer siempre; el resto
// (coste, cantidad) está a un paso en el ejército y aquí solo estorba.
//
// Es un BORRADOR: se edita en memoria y se persiste con "Guardar despliegue",
// igual que el constructor de listas. Así arrastrar veinte veces no son veinte
// escrituras en la base.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { ArmyListRepository } from '@/data/repositories/armyListRepository'
import {
  MESA_ALTO_CM,
  MESA_ANCHO_CM,
  RETICULA_CM,
  limitarAMesa,
  redondearCm,
  tamanoDeEntrada,
  type DeploymentPosition,
  type TamanoCm,
} from '@/domain/deployment'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession } from '@/shared/session/useSession'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { CategoryShield, LockIcon, TrashIcon } from '@/shared/ui/icons'
import { categoryShieldMetal } from '@/features/army-lists/categoryShield'
import type { ArmyListEntry } from '@/domain/types'

function nombreDeLaEntrada(entry: ArmyListEntry): string {
  return entry.alias ?? entry.unit.name
}

/** La peana que le toca a esta entrada, en cm de mesa. */
function tamanoDe(entry: ArmyListEntry): TamanoCm {
  return tamanoDeEntrada({
    unitType: entry.unit.unitType,
    typeTagCode: entry.unit.typeTag?.code,
    llevaCarro: entry.chariotProfileId != null,
  })
}

export function DeploymentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useSession()
  const listId = Number(id)

  const { data: list, loading } = useAsync(() => ArmyListRepository.getDetailById(listId), [listId])
  const { data: guardado, loading: cargandoPlan } = useAsync(() => ArmyListRepository.getDeployment(listId), [listId])

  /** Posiciones EN CENTÍMETROS, por id de entrada. Sin clave = en la reserva. */
  const [posiciones, setPosiciones] = useState<Map<number, DeploymentPosition>>(new Map())
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seleccionada, setSeleccionada] = useState<number | null>(null)

  useEffect(() => {
    if (guardado) setPosiciones(new Map(guardado.map((p) => [p.entryId, p])))
  }, [guardado])

  const mesaRef = useRef<HTMLDivElement>(null)
  /** Desfase entre el punto donde se agarró y el centro de la peana, en cm. */
  const agarre = useRef<{ dx: number; dy: number } | null>(null)

  const esDeOtro = list != null && list.userId != null && user != null && list.userId !== user.id
  const { data: compartida, loading: cargandoComparticion } = useAsync(
    () => (esDeOtro && list && user ? ArmyListRepository.isSharedWith(list.id, user.id) : Promise.resolve(false)),
    [esDeOtro, list?.id, user?.id],
  )
  const soloLectura = esDeOtro && compartida === true

  /** Píxeles del lienzo → centímetros de mesa. Es la única conversión del archivo. */
  function aCm(clientX: number, clientY: number): { xCm: number; yCm: number } {
    const caja = mesaRef.current?.getBoundingClientRect()
    if (!caja) return { xCm: 0, yCm: 0 }
    return {
      xCm: ((clientX - caja.left) / caja.width) * MESA_ANCHO_CM,
      yCm: ((clientY - caja.top) / caja.height) * MESA_ALTO_CM,
    }
  }

  function colocar(entry: ArmyListEntry, xCm: number, yCm: number) {
    const dentro = limitarAMesa(xCm, yCm, tamanoDe(entry))
    setPosiciones((prev) => {
      const next = new Map(prev)
      next.set(entry.id, { entryId: entry.id, xCm: redondearCm(dentro.xCm), yCm: redondearCm(dentro.yCm) })
      return next
    })
    setDirty(true)
  }

  function retirar(entryId: number) {
    setPosiciones((prev) => {
      const next = new Map(prev)
      next.delete(entryId)
      return next
    })
    setSeleccionada((sel) => (sel === entryId ? null : sel))
    setDirty(true)
  }

  /**
   * Al añadir desde la reserva, la unidad cae en tu borde de la mesa y
   * escalonada, para que dos unidades seguidas no se tapen la una a la otra y
   * haya que separarlas a ciegas.
   */
  function desplegarDesdeReserva(entry: ArmyListEntry, yaPuestas: number) {
    const columna = yaPuestas % 10
    const fila = Math.floor(yaPuestas / 10)
    colocar(entry, 12 + columna * 17, MESA_ALTO_CM - 12 - fila * 13)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await ArmyListRepository.saveDeployment(listId, [...posiciones.values()])
      setDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading || cargandoPlan || cargandoComparticion) return <Spinner />

  if (!list) {
    return (
      <div>
        <button onClick={() => navigate('/ejercitos')} className="mb-3 text-sm text-ink-soft hover:text-ink">
          ← Volver a Ejércitos
        </button>
        <p className="text-sm text-ink">No se ha encontrado este ejército.</p>
      </div>
    )
  }

  if (esDeOtro && !soloLectura) {
    return (
      <div>
        <button onClick={() => navigate('/ejercitos')} className="mb-3 text-sm text-ink-soft hover:text-ink">
          ← Volver a Ejércitos
        </button>
        <div className="rounded-sm border border-rule-dark/40 bg-parchment/70 px-4 py-3">
          <p className="text-sm text-ink">Este ejército es de otro usuario.</p>
        </div>
      </div>
    )
  }

  const entradas = [...list.entries].sort((a, b) => a.sortOrder - b.sortOrder)
  const enReserva = entradas.filter((e) => !posiciones.has(e.id))
  const enMesa = entradas.filter((e) => posiciones.has(e.id))
  const entradaSeleccionada = seleccionada != null ? entradas.find((e) => e.id === seleccionada) : undefined

  return (
    <div>
      <PageHeader
        title={`Despliegue — ${list.name}`}
        description={`Mesa de ${MESA_ANCHO_CM} × ${MESA_ALTO_CM} cm · ${enMesa.length} de ${entradas.length} unidades desplegadas`}
        actions={
          <div className="flex items-center gap-3">
            {soloLectura && (
              <span className="flex items-center gap-1.5 rounded-sm border border-rule-dark/40 px-2 py-1 text-xs font-medium text-ink-soft">
                <LockIcon className="h-3.5 w-3.5" />
                Solo lectura
              </span>
            )}
            {dirty && <span className="text-xs font-medium text-bronze">● Cambios sin guardar</span>}
            <Button variant="ghost" onClick={() => navigate(`/ejercitos/${list.id}`)}>
              Volver al ejército
            </Button>
            {!soloLectura && (
              <Button variant="primary" onClick={handleSave} disabled={!dirty || saving}>
                {saving ? 'Guardando…' : 'Guardar despliegue'}
              </Button>
            )}
          </div>
        }
      />

      {error && <p className="mb-3 text-sm text-danger">No se pudo guardar: {error}</p>}

      {/* El lienzo, a todo el ancho y con la proporción real de la mesa (3:2)
          se dibuje al tamaño que se dibuje: si se deformara, el plan dejaría
          de parecerse a la mesa de verdad. */}
      <div
        ref={mesaRef}
        style={{ aspectRatio: `${MESA_ANCHO_CM} / ${MESA_ALTO_CM}` }}
        onClick={() => setSeleccionada(null)}
        className="relative w-full overflow-hidden rounded-sm border-2 border-ink bg-parchment/60"
      >
        {/* Retícula cada 30 cm (las 12" del reglamento), como referencia para
            medir a ojo distancias de despliegue. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(125,121,95,.45) 1px, transparent 1px),' +
              'linear-gradient(to bottom, rgba(125,121,95,.45) 1px, transparent 1px)',
            backgroundSize: `${(RETICULA_CM / MESA_ANCHO_CM) * 100}% ${(RETICULA_CM / MESA_ALTO_CM) * 100}%`,
          }}
        />
        {/* Línea central: la referencia que de verdad se usa al desplegar. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-maroon/40" />

        {enMesa.map((entry) => {
          const pos = posiciones.get(entry.id)!
          const tamano = tamanoDe(entry)
          const emblema = entry.unit.faction.emblemUrl
          const metal = categoryShieldMetal(entry.unit.category?.code)
          return (
            <div
              key={entry.id}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                setSeleccionada(entry.id)
              }}
              onPointerDown={(e) => {
                if (soloLectura) return
                e.preventDefault()
                e.stopPropagation()
                setSeleccionada(entry.id)
                const raton = aCm(e.clientX, e.clientY)
                // Se guarda el desfase respecto al CENTRO para que la peana no
                // dé un salto al empezar a arrastrar.
                agarre.current = { dx: pos.xCm - raton.xCm, dy: pos.yCm - raton.yCm }
                e.currentTarget.setPointerCapture(e.pointerId)
              }}
              onPointerMove={(e) => {
                if (!agarre.current) return
                const raton = aCm(e.clientX, e.clientY)
                colocar(entry, raton.xCm + agarre.current.dx, raton.yCm + agarre.current.dy)
              }}
              onPointerUp={() => {
                agarre.current = null
              }}
              onKeyDown={(e) => {
                if (soloLectura) return
                // Las flechas mueven de centímetro en centímetro: hay
                // colocaciones que se afinan mejor a teclado que a pulso.
                const paso = e.shiftKey ? 5 : 1
                if (e.key === 'ArrowLeft') colocar(entry, pos.xCm - paso, pos.yCm)
                else if (e.key === 'ArrowRight') colocar(entry, pos.xCm + paso, pos.yCm)
                else if (e.key === 'ArrowUp') colocar(entry, pos.xCm, pos.yCm - paso)
                else if (e.key === 'ArrowDown') colocar(entry, pos.xCm, pos.yCm + paso)
                else return
                e.preventDefault()
              }}
              title={`${nombreDeLaEntrada(entry)} — ${tamano.anchoCm} × ${tamano.altoCm} cm en (${pos.xCm}, ${pos.yCm})`}
              style={{
                left: `${(pos.xCm / MESA_ANCHO_CM) * 100}%`,
                top: `${(pos.yCm / MESA_ALTO_CM) * 100}%`,
                width: `${(tamano.anchoCm / MESA_ANCHO_CM) * 100}%`,
                height: `${(tamano.altoCm / MESA_ALTO_CM) * 100}%`,
              }}
              className={clsx(
                'absolute -translate-x-1/2 -translate-y-1/2 touch-none select-none',
                soloLectura ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
                seleccionada === entry.id ? 'z-20' : 'z-10',
              )}
            >
              {/* La peana ocupa el tamaño REAL, sin nada escrito dentro: a
                  4 × 4 cm cualquier texto saldría ilegible. */}
              <div
                className={clsx(
                  'flex h-full w-full items-center justify-center overflow-hidden rounded-[2px] border bg-parchment/95 shadow-sm shadow-black/30',
                  seleccionada === entry.id ? 'border-maroon ring-1 ring-maroon' : 'border-ink/70',
                )}
              >
                {emblema ? (
                  <img src={emblema} alt="" draggable={false} className="h-full w-full object-contain p-[2px]" />
                ) : metal ? (
                  <CategoryShield metal={metal} className="h-3/4 w-3/4" />
                ) : null}
              </div>

              {/* El NOMBRE va fuera del cuadro, flotando sobre la mesa. Sin
                  caja ni fondo: lo único que se pide del lienzo es poder leer
                  qué unidad es cada peana, y una etiqueta opaca por unidad
                  taparía justo el terreno que se está intentando planificar.
                  `whitespace-nowrap` + centrado: el nombre puede ser más ancho
                  que su peana y no pasa nada. */}
              <span className="pointer-events-none absolute top-full left-1/2 mt-0.5 -translate-x-1/2 whitespace-nowrap text-[11px] leading-none font-semibold text-ink [text-shadow:0_1px_2px_rgba(235,229,216,.95),0_-1px_2px_rgba(235,229,216,.95),1px_0_2px_rgba(235,229,216,.95),-1px_0_2px_rgba(235,229,216,.95)]">
                {nombreDeLaEntrada(entry)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Barra de la unidad elegida. Retirar va aquí y no como una papelera
          sobre la peana: a 4 × 4 cm, un icono dentro se pulsaría sin querer
          justo al ir a arrastrarla. */}
      {!soloLectura && entradaSeleccionada && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-xs text-ink-soft">
            <b className="text-ink">{nombreDeLaEntrada(entradaSeleccionada)}</b> · peana{' '}
            {tamanoDe(entradaSeleccionada).anchoCm} × {tamanoDe(entradaSeleccionada).altoCm} cm · en (
            {posiciones.get(entradaSeleccionada.id)?.xCm}, {posiciones.get(entradaSeleccionada.id)?.yCm}) cm
          </span>
          <button
            type="button"
            onClick={() => retirar(entradaSeleccionada.id)}
            className="flex items-center gap-1 rounded-sm border border-maroon/30 px-2 py-1 text-xs font-medium text-maroon hover:bg-maroon/10"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Devolver a la reserva
          </button>
          <span className="text-mini text-ink-soft/70">Las flechas mueven 1 cm; con Mayúsculas, 5 cm.</span>
        </div>
      )}

      {/* La reserva, DEBAJO y en horizontal: así el lienzo se queda con todo el
          ancho de la pantalla, que es lo que hacía falta para leerlo. */}
      <div className="mt-4 rounded-sm border border-rule-dark/40 bg-parchment/70 p-3">
        <p className="mb-2 text-xs font-semibold tracking-wide text-ink-soft">Reserva ({enReserva.length})</p>
        {entradas.length === 0 ? (
          <p className="text-xs italic text-ink-soft">Este ejército todavía no tiene unidades.</p>
        ) : enReserva.length === 0 ? (
          <p className="text-xs italic text-ink-soft">Todo el ejército está sobre la mesa.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {enReserva.map((entry) => {
              const metal = categoryShieldMetal(entry.unit.category?.code)
              return (
                <button
                  key={entry.id}
                  type="button"
                  disabled={soloLectura}
                  onClick={() => desplegarDesdeReserva(entry, posiciones.size)}
                  title={`Poner ${nombreDeLaEntrada(entry)} sobre la mesa`}
                  className="flex items-center gap-1.5 rounded-sm border border-rule-dark/40 px-2 py-1 text-xs text-ink hover:border-bronze hover:bg-parchment-dark/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {metal && <CategoryShield metal={metal} className="h-3.5 w-3.5 shrink-0" />}
                  {nombreDeLaEntrada(entry)}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
