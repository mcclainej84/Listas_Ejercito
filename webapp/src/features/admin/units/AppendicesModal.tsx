// ============================================================================
// "Apéndices" de una unidad: añadir, editar, borrar, reordenar y copiar desde
// otra unidad.
//
// SE GUARDA AL MOMENTO, no con el "Guardar cambios" de la ficha. Un apéndice es
// un texto largo y una ventana aparte: mezclar su suerte con la del borrador de
// la ficha significaría que cerrar la ventana sin darse cuenta tira media
// página escrita. Aquí, lo guardado está guardado.
//
// DOS PANELES: la lista de apéndices a la izquierda y el que se está editando a
// la derecha. Con tres o cuatro apéndices, un acordeón obliga a plegar uno para
// ver otro; así se pasa de uno a otro de un clic y siempre se ve cuántos hay.
// ============================================================================
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { AppendixRepository, type AppendixFromUnit } from '@/data/repositories/appendixRepository'
import { tieneTexto, aTextoPlano } from '@/shared/richText'
import { useAsync } from '@/shared/hooks/useAsync'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { Spinner } from '@/shared/ui/Spinner'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { RichTextEditor } from '@/shared/ui/RichTextEditor'
import { TrashIcon } from '@/shared/ui/icons'
import type { UnitAppendix } from '@/domain/types'

const TITULO_NUEVO = 'Apéndice'

export function AppendicesModal({
  unitId,
  unitName,
  onClose,
  onChanged,
}: {
  unitId: number
  unitName: string
  onClose: () => void
  onChanged?: () => void
}) {
  const { data: apendices, loading, reload } = useAsync(() => AppendixRepository.listByUnit(unitId), [unitId])
  const [elegidoId, setElegidoId] = useState<number | null>(null)
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  /** Lo guardado, para saber si hay cambios sin guardar sin preguntárselo a la base. */
  const [guardado, setGuardado] = useState({ titulo: '', cuerpo: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [borrando, setBorrando] = useState<UnitAppendix | null>(null)
  /** Apéndice que se quiere abrir pero que espera a resolver lo que hay sin guardar. */
  const [pendiente, setPendiente] = useState<UnitAppendix | null>(null)
  const [copiando, setCopiando] = useState(false)

  const lista = apendices ?? []
  const elegido = lista.find((a) => a.id === elegidoId) ?? null
  const sucio = elegido != null && (titulo !== guardado.titulo || cuerpo !== guardado.cuerpo)

  // Al abrir (o tras copiar/borrar) se muestra el primero, para que la ventana
  // no salga vacía teniendo contenido que enseñar.
  //
  // Ojo con las dependencias: van `apendices` (la referencia que devuelve
  // useAsync, estable entre renders) y NO `lista`, que es un array nuevo cada
  // vez. Y con la salida de arriba: sin ella, con la unidad sin apéndices esto
  // llamaría a setGuardado con un objeto nuevo en cada render y el componente
  // se quedaría dando vueltas.
  useEffect(() => {
    if (!apendices) return
    if (elegidoId != null && apendices.some((a) => a.id === elegidoId)) return
    const primero = apendices[0] ?? null
    if (!primero) {
      if (elegidoId != null) setElegidoId(null)
      return
    }
    setElegidoId(primero.id)
    setTitulo(primero.title)
    setCuerpo(primero.bodyHtml)
    setGuardado({ titulo: primero.title, cuerpo: primero.bodyHtml })
  }, [apendices, elegidoId])

  function abrir(a: UnitAppendix) {
    // Cambiar de apéndice con algo escrito sin guardar tiraría el texto sin
    // decir nada. Se pregunta antes; el que se iba a abrir queda esperando en
    // `pendiente` hasta que se decida.
    if (sucio && a.id !== elegidoId) {
      setPendiente(a)
      return
    }
    setElegidoId(a.id)
    setTitulo(a.title)
    setCuerpo(a.bodyHtml)
    setGuardado({ titulo: a.title, cuerpo: a.bodyHtml })
    setError(null)
  }

  function descartarYAbrir(a: UnitAppendix) {
    setPendiente(null)
    setElegidoId(a.id)
    setTitulo(a.title)
    setCuerpo(a.bodyHtml)
    setGuardado({ titulo: a.title, cuerpo: a.bodyHtml })
    setError(null)
  }

  async function run(accion: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await accion()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function crear() {
    await run(async () => {
      const id = await AppendixRepository.create(unitId, { title: TITULO_NUEVO, bodyHtml: '' })
      await reload()
      setElegidoId(id)
      setTitulo(TITULO_NUEVO)
      setCuerpo('')
      setGuardado({ titulo: TITULO_NUEVO, cuerpo: '' })
      onChanged?.()
    })
  }

  async function guardar() {
    if (!elegido) return
    if (!titulo.trim()) {
      setError('El apéndice necesita un título.')
      return
    }
    await run(async () => {
      await AppendixRepository.update(elegido.id, { title: titulo, bodyHtml: cuerpo })
      setGuardado({ titulo, cuerpo })
      await reload()
      onChanged?.()
    })
  }

  async function borrar(a: UnitAppendix) {
    await run(async () => {
      await AppendixRepository.remove(a.id)
      setBorrando(null)
      setElegidoId(null)
      await reload()
      onChanged?.()
    })
  }

  return (
    <>
      <Modal
        title={`Apéndices de ${unitName}`}
        onClose={onClose}
        widthClassName="max-w-3xl"
        footer={
          <>
            {sucio && <span className="mr-auto text-xs font-medium text-bronze">● Cambios sin guardar</span>}
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cerrar
            </Button>
            <Button variant="primary" onClick={guardar} disabled={busy || !elegido || !sucio}>
              {busy ? 'Guardando…' : 'Guardar apéndice'}
            </Button>
          </>
        }
      >
        {loading ? (
          <Spinner />
        ) : (
          <div className="flex gap-4">
            {/* -------- Izquierda: los apéndices de esta unidad -------- */}
            <div className="flex w-48 shrink-0 flex-col">
              {/* Las dos acciones comparten un único bloque partido por un
                  filete: mismo alto, mismo cuerpo de letra y mismo ancho
                  exacto (grid de dos columnas). Antes eran dos botones de
                  familias distintas, uno más alto que el otro, y la esquina se
                  veía descuadrada. */}
              <div className="mb-2 grid grid-cols-2 overflow-hidden rounded-sm border border-rule-dark/40">
                <button
                  type="button"
                  onClick={crear}
                  disabled={busy}
                  className="border-r border-rule-dark/30 bg-parchment px-2 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-parchment-dark disabled:opacity-50"
                >
                  Nuevo
                </button>
                <button
                  type="button"
                  onClick={() => setCopiando(true)}
                  disabled={busy}
                  title="Traer una copia de un apéndice de otra unidad"
                  className="bg-parchment px-2 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-parchment-dark disabled:opacity-50"
                >
                  Copiar de…
                </button>
              </div>

              {lista.length === 0 ? (
                <p className="text-xs leading-relaxed text-ink-soft italic">Esta unidad no tiene apéndices todavía.</p>
              ) : (
                <ul className="divide-y divide-rule-dark/15 overflow-hidden rounded-sm border border-rule-dark/30">
                  {lista.map((a, indice) => (
                    <li
                      key={a.id}
                      className={clsx(
                        // El elegido se marca con un filete granate a la
                        // izquierda, igual que la fila desplegada del orden de
                        // batalla: es el mismo gesto en todo el programa.
                        'group flex items-center border-l-2 transition-colors',
                        a.id === elegidoId
                          ? 'border-l-maroon bg-maroon/5'
                          : 'border-l-transparent hover:bg-parchment-dark/40',
                      )}
                    >
                      <button type="button" onClick={() => abrir(a)} className="min-w-0 flex-1 px-2 py-1.5 text-left">
                        <span className="block truncate text-xs font-medium text-ink">{a.title}</span>
                        <span className="block truncate text-mini text-ink-soft/70">
                          {aTextoPlano(a.bodyHtml) || 'Sin texto'}
                        </span>
                      </button>

                      {/* Ordenar y borrar solo asoman al pasar por encima (o al
                          llegar con el tabulador): con tres apéndices, seis
                          controles siempre visibles pesan más que la propia
                          lista. Reordenar va con flechas y no arrastrando
                          porque una lista de tres se ordena antes a golpe de
                          flecha que buscando el sitio con el ratón. */}
                      <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                        <span className="flex flex-col">
                          <button
                            type="button"
                            disabled={busy || indice === 0}
                            onClick={() =>
                              run(async () => {
                                const ids = lista.map((x) => x.id)
                                ;[ids[indice - 1], ids[indice]] = [ids[indice], ids[indice - 1]]
                                await AppendixRepository.reorder(ids)
                                await reload()
                              })
                            }
                            aria-label={`Subir ${a.title}`}
                            className="px-1 text-[9px] leading-none text-ink-soft/70 hover:text-ink disabled:opacity-20"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={busy || indice === lista.length - 1}
                            onClick={() =>
                              run(async () => {
                                const ids = lista.map((x) => x.id)
                                ;[ids[indice], ids[indice + 1]] = [ids[indice + 1], ids[indice]]
                                await AppendixRepository.reorder(ids)
                                await reload()
                              })
                            }
                            aria-label={`Bajar ${a.title}`}
                            className="px-1 text-[9px] leading-none text-ink-soft/70 hover:text-ink disabled:opacity-20"
                          >
                            ▼
                          </button>
                        </span>
                        <button
                          type="button"
                          onClick={() => setBorrando(a)}
                          aria-label={`Borrar ${a.title}`}
                          title="Borrar"
                          className="rounded-sm px-1.5 py-1 text-ink-soft hover:bg-maroon/10 hover:text-danger"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* -------- Derecha: el que se está editando -------- */}
            <div className="min-w-0 flex-1">
              {elegido ? (
                <div className="space-y-3">
                  <TextField label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                  <div>
                    <p className="mb-1 text-xs font-medium text-ink-soft">Texto</p>
                    <RichTextEditor
                      value={cuerpo}
                      valorInicialKey={elegido.id}
                      onChange={setCuerpo}
                      placeholder="Escribe o pega aquí el texto del apéndice…"
                    />
                    {/* Una sola línea de ayuda, y solo la que hace falta: si el
                        apéndice está vacío, lo que importa es que no va a salir
                        en la ficha; si tiene texto, lo que importa es que se
                        puede pegar sin arrastrar formato. */}
                    <p className="mt-1 text-mini text-ink-soft/70">
                      {tieneTexto(cuerpo)
                        ? 'Se puede pegar texto: llega limpio de tipografías y colores.'
                        : 'Vacío no sale en la ficha. Escribe o pega el texto.'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ink-soft italic">Elige un apéndice de la izquierda o crea uno nuevo.</p>
              )}
              {error && <p className="mt-2 text-xs text-danger">{error}</p>}
            </div>
          </div>
        )}
      </Modal>

      {pendiente && (
        <ConfirmDialog
          title="Hay cambios sin guardar"
          message={`Estás editando "${titulo || 'este apéndice'}" y no lo has guardado. Si abres otro, se pierde lo escrito.`}
          confirmLabel="Descartar y abrir el otro"
          onCancel={() => setPendiente(null)}
          onConfirm={() => descartarYAbrir(pendiente)}
        />
      )}

      {borrando && (
        <ConfirmDialog
          title={`Borrar "${borrando.title}"`}
          message="Se borra solo de esta unidad. Si lo copiaste a otra, allí sigue igual."
          confirmLabel="Borrar"
          onCancel={() => setBorrando(null)}
          onConfirm={() => borrar(borrando)}
        />
      )}

      {copiando && (
        <CopiarApendiceModal
          unitId={unitId}
          onClose={() => setCopiando(false)}
          onCopiado={async () => {
            setCopiando(false)
            setElegidoId(null)
            await reload()
            onChanged?.()
          }}
        />
      )}
    </>
  )
}

/**
 * "Copiar de…": el buscador de apéndices del resto del programa.
 *
 * Se filtra por texto porque con veinte unidades con apéndices, una lista
 * plana no se recorre; y se enseña de qué unidad y facción es cada uno porque
 * el mismo título repetido no distingue nada.
 */
function CopiarApendiceModal({
  unitId,
  onClose,
  onCopiado,
}: {
  unitId: number
  onClose: () => void
  onCopiado: () => void
}) {
  const { data, loading } = useAsync(() => AppendixRepository.listCopiables(unitId), [unitId])
  const [busqueda, setBusqueda] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const termino = busqueda.trim().toLowerCase()
  const encontrados = (data ?? []).filter(
    (a) =>
      !termino ||
      a.title.toLowerCase().includes(termino) ||
      a.unitName.toLowerCase().includes(termino) ||
      a.factionName.toLowerCase().includes(termino),
  )

  async function copiar(a: AppendixFromUnit) {
    setBusy(true)
    setError(null)
    try {
      await AppendixRepository.copyTo(a.id, unitId)
      onCopiado()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Copiar un apéndice de otra unidad"
      onClose={onClose}
      widthClassName="max-w-xl"
      footer={
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cerrar
        </Button>
      }
    >
      <TextField
        label="Buscar"
        placeholder="Título, unidad o facción"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        autoFocus
      />
      <p className="mt-1 mb-3 text-mini text-ink-soft/70">
        Se copia el texto tal y como está ahora; después son dos apéndices independientes.
      </p>

      {loading ? (
        <Spinner />
      ) : encontrados.length === 0 ? (
        <p className="text-xs text-ink-soft italic">
          {data && data.length > 0
            ? 'Ningún apéndice coincide con la búsqueda.'
            : 'Todavía no hay apéndices en otras unidades.'}
        </p>
      ) : (
        <ul className="divide-y divide-rule-dark/15 overflow-hidden rounded-sm border border-rule-dark/30">
          {encontrados.map((a) => (
            <li key={a.id} className="group flex items-center gap-2 px-2 py-1.5 hover:bg-parchment-dark/40">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-ink">{a.title}</span>
                <span className="block truncate text-mini text-ink-soft/70">
                  {a.unitName} · {a.factionName}
                </span>
              </span>
              {/* Mismo control que las acciones de la lista: caja fina y letra
                  pequeña. Un botón de tamaño normal por fila convertía la
                  ventana en una columna de botones con texto al lado. */}
              <button
                type="button"
                disabled={busy}
                onClick={() => copiar(a)}
                className="shrink-0 rounded-sm border border-rule-dark/40 bg-parchment px-2 py-1 text-xs font-medium text-ink transition-colors hover:bg-parchment-dark disabled:opacity-50"
              >
                Copiar aquí
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </Modal>
  )
}
