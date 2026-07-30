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
// SELECCIÓN MÚLTIPLE. Arrastrando sobre la mesa vacía se dibuja un recuadro
// que selecciona todo lo que toca; después, arrastrar cualquiera de las
// seleccionadas mueve el grupo entero manteniendo las distancias. Es lo que
// permite recolocar un flanco sin rehacerlo unidad por unidad.
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
  alinearFrentes,
  limitarAMesa,
  limitarDesplazamiento,
  peanaDentroDelRectangulo,
  redondearCm,
  tamanoDeEntrada,
  type DeploymentPosition,
  type RectanguloCm,
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
  /** Entradas seleccionadas. Se mueven juntas al arrastrar cualquiera de ellas. */
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  /** Recuadro de selección mientras se arrastra sobre la mesa vacía, en cm. */
  const [recuadro, setRecuadro] = useState<RectanguloCm | null>(null)

  useEffect(() => {
    if (guardado) setPosiciones(new Map(guardado.map((p) => [p.entryId, p])))
  }, [guardado])

  const mesaRef = useRef<HTMLDivElement>(null)
  /**
   * Arrastre en curso: dónde estaba el ratón al empezar y dónde estaba CADA
   * peana que se mueve. Se guardan las posiciones de partida en vez de ir
   * acumulando incrementos porque, al recortar el desplazamiento contra el
   * borde, los incrementos acumulados iban perdiendo la formación.
   */
  const agarre = useRef<{ xCm: number; yCm: number; inicio: Map<number, DeploymentPosition> } | null>(null)
  /** Punto donde empezó el recuadro de selección. */
  const inicioRecuadro = useRef<{ xCm: number; yCm: number } | null>(null)

  const esDeOtro = list != null && list.userId != null && user != null && list.userId !== user.id
  const { data: acceso, loading: cargandoComparticion } = useAsync(
    () =>
      esDeOtro && list && user
        ? ArmyListRepository.getShareAccess(list.id, user.id)
        : Promise.resolve({ compartida: false, conDespliegue: false }),
    [esDeOtro, list?.id, user?.id],
  )
  const soloLectura = esDeOtro && acceso?.compartida === true
  /** El despliegue se comparte aparte: puede estar compartida la lista y no él. */
  const puedeVerlo = !esDeOtro || acceso?.conDespliegue === true

  /** Tamaño de peana por entrada, resuelto una vez por render. */
  const tamanoPorEntrada = new Map<number, TamanoCm>((list?.entries ?? []).map((e) => [e.id, tamanoDe(e)]))

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

  function retirar(entryIds: number[]) {
    setPosiciones((prev) => {
      const next = new Map(prev)
      for (const id of entryIds) next.delete(id)
      return next
    })
    setSeleccion(new Set())
    setDirty(true)
  }

  /**
   * Mueve el GRUPO arrastrado. El desplazamiento se recorta una sola vez para
   * todas (ver limitarDesplazamiento), así la formación no se deforma al
   * empujarla contra un borde.
   */
  function moverGrupo(dxCm: number, dyCm: number) {
    const enJuego = agarre.current
    if (!enJuego) return
    const peanas = [...enJuego.inicio.values()].map((p) => ({ ...p, tamano: tamanoPorEntrada.get(p.entryId)! }))
    const d = limitarDesplazamiento(peanas, dxCm, dyCm)
    setPosiciones((prev) => {
      const next = new Map(prev)
      for (const p of peanas) {
        next.set(p.entryId, {
          entryId: p.entryId,
          xCm: redondearCm(p.xCm + d.dxCm),
          yCm: redondearCm(p.yCm + d.dyCm),
        })
      }
      return next
    })
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

  /**
   * Ordena el ejército en frentes de batalla (ver alinearFrentes). No es un
   * "ordenar" global: respeta las x, solo iguala las alturas de las unidades
   * que ya estaban a la par, y puede salir más de una línea.
   */
  function handleAlinear(entradas: ArmyListEntry[]) {
    const enMesa = entradas.filter((e) => posiciones.has(e.id))
    if (enMesa.length < 2) return
    const alineadas = alinearFrentes(
      enMesa.map((entry) => ({ ...posiciones.get(entry.id)!, tamano: tamanoDe(entry) })),
    )
    setPosiciones((prev) => {
      const next = new Map(prev)
      for (const p of alineadas) next.set(p.entryId, p)
      return next
    })
    setDirty(true)
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

  // Dos negativas distintas y con mensajes distintos: no es lo mismo "esta
  // lista no es tuya" que "esta lista sí, pero su despliegue no".
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

  if (!puedeVerlo) {
    return (
      <div>
        <button onClick={() => navigate(`/ejercitos/${list.id}`)} className="mb-3 text-sm text-ink-soft hover:text-ink">
          ← Volver al ejército
        </button>
        <div className="rounded-sm border border-rule-dark/40 bg-parchment/70 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-ink">
            <LockIcon className="h-4 w-4 text-ink-soft" />
            Te han compartido este ejército, pero no su despliegue.
          </p>
        </div>
      </div>
    )
  }

  const entradas = [...list.entries].sort((a, b) => a.sortOrder - b.sortOrder)
  const enReserva = entradas.filter((e) => !posiciones.has(e.id))
  const enMesa = entradas.filter((e) => posiciones.has(e.id))
  const seleccionadas = entradas.filter((e) => seleccion.has(e.id) && posiciones.has(e.id))

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
            {!soloLectura && (
              <Button
                variant="ghost"
                onClick={() => handleAlinear(entradas)}
                disabled={enMesa.length < 2}
                title="Iguala la altura de las unidades que ya están a la par, formando líneas de batalla"
              >
                Alinear unidades
              </Button>
            )}
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
        onPointerDown={(e) => {
          // Solo si se empieza sobre la mesa VACÍA: al pulsar una peana, el
          // evento lo atiende ella y no llega aquí (hace stopPropagation).
          if (soloLectura || e.button !== 0) return
          const p = aCm(e.clientX, e.clientY)
          inicioRecuadro.current = p
          setRecuadro({ x1: p.xCm, y1: p.yCm, x2: p.xCm, y2: p.yCm })
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!inicioRecuadro.current) return
          const p = aCm(e.clientX, e.clientY)
          const origen = inicioRecuadro.current
          setRecuadro({ x1: origen.xCm, y1: origen.yCm, x2: p.xCm, y2: p.yCm })
        }}
        onPointerUp={() => {
          const rect = recuadro
          inicioRecuadro.current = null
          setRecuadro(null)
          if (!rect) return
          // Un recuadro minúsculo es un clic, no un barrido: se interpreta como
          // "deseleccionar todo", que es lo que espera quien pincha en un hueco.
          const esClic = Math.abs(rect.x2 - rect.x1) < 2 && Math.abs(rect.y2 - rect.y1) < 2
          if (esClic) {
            setSeleccion(new Set())
            return
          }
          const dentro = enMesa.filter((entry) =>
            peanaDentroDelRectangulo({ ...posiciones.get(entry.id)!, tamano: tamanoPorEntrada.get(entry.id)! }, rect),
          )
          setSeleccion(new Set(dentro.map((e) => e.id)))
        }}
        className="relative w-full touch-none overflow-hidden rounded-sm border-2 border-ink bg-parchment/60"
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

        {recuadro && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-30 border border-dashed border-maroon bg-maroon/10"
            style={{
              left: `${(Math.min(recuadro.x1, recuadro.x2) / MESA_ANCHO_CM) * 100}%`,
              top: `${(Math.min(recuadro.y1, recuadro.y2) / MESA_ALTO_CM) * 100}%`,
              width: `${(Math.abs(recuadro.x2 - recuadro.x1) / MESA_ANCHO_CM) * 100}%`,
              height: `${(Math.abs(recuadro.y2 - recuadro.y1) / MESA_ALTO_CM) * 100}%`,
            }}
          />
        )}

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
              onPointerDown={(e) => {
                if (soloLectura || e.button !== 0) return
                e.preventDefault()
                // Sin esto, el lienzo empezaría a dibujar un recuadro debajo.
                e.stopPropagation()

                // Pulsar una peana que YA está seleccionada conserva el grupo
                // (es como se arrastra un flanco entero); pulsar una de fuera
                // deja seleccionada solo esa. Con Mayúsculas se van sumando.
                const grupo = e.shiftKey
                  ? new Set(seleccion).add(entry.id)
                  : seleccion.has(entry.id)
                    ? seleccion
                    : new Set([entry.id])
                setSeleccion(grupo)

                const raton = aCm(e.clientX, e.clientY)
                const inicio = new Map<number, DeploymentPosition>()
                for (const id of grupo) {
                  const p = posiciones.get(id)
                  if (p) inicio.set(id, p)
                }
                agarre.current = { xCm: raton.xCm, yCm: raton.yCm, inicio }
                e.currentTarget.setPointerCapture(e.pointerId)
              }}
              onPointerMove={(e) => {
                if (!agarre.current) return
                const raton = aCm(e.clientX, e.clientY)
                moverGrupo(raton.xCm - agarre.current.xCm, raton.yCm - agarre.current.yCm)
              }}
              onPointerUp={() => {
                agarre.current = null
              }}
              onKeyDown={(e) => {
                if (soloLectura) return
                // Las flechas mueven de centímetro en centímetro, y mueven todo
                // lo seleccionado: hay colocaciones que se afinan mejor a
                // teclado que a pulso.
                const paso = e.shiftKey ? 5 : 1
                const delta =
                  e.key === 'ArrowLeft'
                    ? { x: -paso, y: 0 }
                    : e.key === 'ArrowRight'
                      ? { x: paso, y: 0 }
                      : e.key === 'ArrowUp'
                        ? { x: 0, y: -paso }
                        : e.key === 'ArrowDown'
                          ? { x: 0, y: paso }
                          : null
                if (!delta) return
                e.preventDefault()
                const grupo = seleccion.has(entry.id) ? seleccion : new Set([entry.id])
                const inicio = new Map<number, DeploymentPosition>()
                for (const id of grupo) {
                  const p = posiciones.get(id)
                  if (p) inicio.set(id, p)
                }
                agarre.current = { xCm: 0, yCm: 0, inicio }
                moverGrupo(delta.x, delta.y)
                agarre.current = null
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
                seleccion.has(entry.id) ? 'z-20' : 'z-10',
              )}
            >
              {/* La peana ocupa el tamaño REAL, sin nada escrito dentro: a
                  4 × 4 cm cualquier texto saldría ilegible. */}
              <div
                className={clsx(
                  'flex h-full w-full items-center justify-center overflow-hidden rounded-[2px] border bg-parchment/95 shadow-sm shadow-black/30',
                  seleccion.has(entry.id) ? 'border-maroon ring-1 ring-maroon' : 'border-ink/70',
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

                  Se ciñe al ANCHO DE LA PEANA y baja de línea por el siguiente
                  espacio en blanco (`break-words` NO: una palabra suelta más
                  ancha que la peana se sale antes que partirse por la mitad,
                  que es ilegible). El halo de pergamino es lo que lo mantiene
                  legible sobre la retícula. */}
              <span className="pointer-events-none absolute top-full left-1/2 mt-0.5 w-full -translate-x-1/2 text-center text-[11px] leading-tight font-semibold text-ink [text-shadow:0_1px_2px_rgba(235,229,216,.95),0_-1px_2px_rgba(235,229,216,.95),1px_0_2px_rgba(235,229,216,.95),-1px_0_2px_rgba(235,229,216,.95)]">
                {nombreDeLaEntrada(entry)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Barra de lo seleccionado. Retirar va aquí y no como una papelera sobre
          la peana: a 4 × 4 cm, un icono dentro se pulsaría sin querer justo al
          ir a arrastrarla. */}
      {!soloLectura && seleccionadas.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-xs text-ink-soft">
            {seleccionadas.length === 1 ? (
              <>
                <b className="text-ink">{nombreDeLaEntrada(seleccionadas[0])}</b> · peana{' '}
                {tamanoDe(seleccionadas[0]).anchoCm} × {tamanoDe(seleccionadas[0]).altoCm} cm · en (
                {posiciones.get(seleccionadas[0].id)?.xCm}, {posiciones.get(seleccionadas[0].id)?.yCm}) cm
              </>
            ) : (
              <>
                <b className="text-ink">{seleccionadas.length} unidades</b> seleccionadas · se mueven juntas
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => retirar(seleccionadas.map((e) => e.id))}
            className="flex items-center gap-1 rounded-sm border border-maroon/30 px-2 py-1 text-xs font-medium text-maroon hover:bg-maroon/10"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            {seleccionadas.length === 1 ? 'Devolver a la reserva' : 'Devolver todas a la reserva'}
          </button>
          <span className="text-mini text-ink-soft/70">
            Arrastra sobre la mesa para seleccionar varias · Mayúsculas para añadir · las flechas mueven 1 cm (5 con
            Mayúsculas)
          </span>
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
