// ============================================================================
// La lámina de un Personaje de Renombre: retrato, nombre, trasfondo,
// experiencia y lo que se puede hacer con él.
//
// POR QUÉ ES UNA LÁMINA ANCHA Y NO UNA TARJETA DE REJILLA. La versión anterior
// metía tres por fila con un retrato de 80 px y el trasfondo escondido detrás
// de un botón: el retrato no se veía y la historia —que es justo lo que
// distingue a un personaje con nombre de "un Señor Vampiro"— no existía hasta
// que alguien abría el diálogo de edición. Ahora el retrato ocupa 160 px (el
// doble) y el trasfondo se lee en la propia lámina, plegado a unas líneas con
// un "Seguir leyendo" cuando es largo. Caben dos por fila en pantalla ancha,
// una en el resto.
//
// El RETRATO se prepara igual que una pieza de escenografía
// (shared/image#prepararImagenDeEscenografia): se le quita el fondo liso, se
// recorta al contenido, se le difumina el canto y se reduce a 512 px. No es
// casualidad ni pereza — una foto de personaje recortada sobre blanco puesta
// en una lámina de pergamino canta exactamente igual que una pieza recortada
// sobre la mesa, y el arreglo ya estaba escrito y probado. El marco es doble
// (filete de tinta fuera, hilo de bronce dentro) y lleva una sombra INTERIOR,
// que es lo que impide que la foto parezca un recorte pegado encima del papel.
//
// La EXPERIENCIA solo se puede SUMAR, nunca corregir ni borrar: cada apunte es
// el registro de lo que pasó en una partida. Rectificar es apuntar otra cosa,
// incluso negativa. Ver specialCharacterRepository.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  SpecialCharacterRepository,
  EXPERIENCIA_MAXIMA,
  type ApunteDeExperiencia,
  type PersonajeEspecial,
} from '@/data/repositories/specialCharacterRepository'
import {
  descargarImagenComoBytes,
  ENCUADRE_CENTRADO,
  prepararImagenDeEscenografia,
  recortarRetrato,
  type EncuadreRetrato,
} from '@/shared/image'
import { MarcoDeEncuadre } from '@/features/renombre/MarcoDeEncuadre'
import { aTextoPlano, sanearHtml, tieneTexto } from '@/shared/richText'
import { UnitRepository } from '@/data/repositories/unitRepository'
import { runMigrations } from '@/data/sqlite/client'
import { mensajeDeMigracionPendiente } from '@/data/repositories/schemaHealth'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession } from '@/shared/session/useSession'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { TextField } from '@/shared/ui/TextField'
import { RichTextEditor } from '@/shared/ui/RichTextEditor'
import { Badge } from '@/shared/ui/Badge'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EyeIcon, EyeOffIcon, ImageIcon, PencilIcon, PlusIcon, StarIcon, TrashIcon } from '@/shared/ui/icons'

/**
 * A partir de cuántos caracteres de trasfondo se pliega el texto y aparece el
 * "Seguir leyendo".
 *
 * Se mide sobre el TEXTO PLANO y no midiendo el bloque ya pintado: medir en el
 * navegador obliga a un efecto tras pintar, y con dos o tres docenas de láminas
 * eso es un salto visible al cargar. Con este umbral, un trasfondo de un párrafo
 * corto se enseña entero y no aparece un botón que no plegaría nada.
 */
const TRASFONDO_LARGO = 300

/** Clases del HTML del trasfondo. Es la misma lista cerrada de etiquetas que los apéndices (ver shared/richText). */
const PROSA =
  'text-sm leading-relaxed text-ink-soft [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-ink ' +
  '[&_em]:italic [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5'

/**
 * Barra de experiencia, de 0 a EXPERIENCIA_MAXIMA. Vive aquí y no en la página
 * porque la usan la lámina y su diálogo; tenerla en la página obligaba a que
 * página y lámina se importasen la una a la otra.
 */
export function BarraDeExperiencia({ valor, size = 'sm' }: { valor: number; size?: 'sm' | 'md' }) {
  const pct = Math.max(0, Math.min(100, (valor / EXPERIENCIA_MAXIMA) * 100))
  const pasado = valor > EXPERIENCIA_MAXIMA
  return (
    <div className="flex items-center gap-2">
      <div
        className={clsx(
          'flex-1 overflow-hidden rounded-full border border-rule-dark/30 bg-parchment-dark/70',
          size === 'md' ? 'h-2.5' : 'h-2',
        )}
      >
        <div
          className={clsx(
            'h-full rounded-full transition-[width] duration-500',
            pasado ? 'bg-danger' : 'bg-gradient-to-r from-bronze/70 to-bronze',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-mini tabular-nums text-ink-soft">
        {valor} / {EXPERIENCIA_MAXIMA}
      </span>
    </div>
  )
}

/** Distintivo de Personaje de Renombre, para reconocerlos de un vistazo allá donde salgan. */
export function DistintivoEspecial() {
  return (
    <Badge tone="amber">
      <StarIcon className="mr-1 h-3 w-3" filled />
      Renombre
    </Badge>
  )
}

/** El retrato con su marco doble. Sin foto, un hueco con el mismo marco: la rejilla no baila. */
function Retrato({ url, nombre }: { url: string | null; nombre: string }) {
  // `self-start`: el marco tiene que ceñirse a la foto. Sin él, al ser hijo de un
  // flex, se estiraba hasta el alto de la columna de texto y dejaba un rectángulo
  // de pergamino vacío colgando bajo el retrato.
  return (
    <div className="shrink-0 self-start rounded-sm border border-rule-dark/50 bg-parchment-dark/30 p-1 shadow-sm shadow-black/15">
      <div className="relative h-40 w-40 overflow-hidden rounded-[1px] bg-parchment-dark/50">
        {url ? (
          <img src={url} alt={`Retrato de ${nombre}`} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-soft/35">
            <ImageIcon className="h-8 w-8" />
            <span className="text-micro uppercase tracking-widest">Sin retrato</span>
          </div>
        )}
        {/* Hilo de bronce + sombra interior: asientan la foto en el papel en vez
            de dejarla como un recorte pegado encima (mismo recurso que
            FactionEmblem). */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[1px] ring-1 ring-inset ring-bronze/35"
          style={{ boxShadow: 'inset 0 0 16px rgba(20,14,6,0.28)' }}
        />
      </div>
    </div>
  )
}

export function PersonajeRenombreCard({ personaje, onCambio }: { personaje: PersonajeEspecial; onCambio: () => void }) {
  const { user, actingAsAdmin } = useSession()
  const [editando, setEditando] = useState(false)
  const [sumando, setSumando] = useState(false)
  const [desplegado, setDesplegado] = useState(false)
  const [ocultando, setOcultando] = useState(false)
  const [errorOcultar, setErrorOcultar] = useState<string | null>(null)
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)

  const trasfondo = personaje.background ?? ''
  const tieneTrasfondo = tieneTexto(trasfondo)
  const largo = aTextoPlano(trasfondo).length > TRASFONDO_LARGO
  const propio = personaje.userId == null || personaje.userId === user?.id

  /**
   * Ocultar / volver a enseñar.
   *
   * Si falla se REINTENTA una vez después de aplicar las migraciones, igual que
   * el interruptor de activa/inactiva de Editor > Unidades: el motivo típico es
   * que la columna todavía no exista en la D1 porque el Worker no se ha
   * desplegado. Y si vuelve a fallar, se enseña el MENSAJE DE VERDAD en la
   * propia lámina en vez de un "no se pudo" que no dice nada — sin ese texto no
   * hay forma de distinguir una columna que falta de una contraseña caducada.
   */
  async function alternarOculto() {
    setOcultando(true)
    setErrorOcultar(null)
    try {
      await SpecialCharacterRepository.setHidden(personaje.id, !personaje.hidden)
      onCambio()
    } catch (primerErr) {
      try {
        await runMigrations()
        await SpecialCharacterRepository.setHidden(personaje.id, !personaje.hidden)
        onCambio()
      } catch (err) {
        console.error('[WHArmy] No se pudo cambiar la visibilidad:', primerErr, err)
        setErrorOcultar(mensajeDeMigracionPendiente(err) ?? (err instanceof Error ? err.message : String(err)))
      }
    } finally {
      setOcultando(false)
    }
  }

  return (
    <article
      className={clsx(
        'flex h-full flex-col overflow-hidden rounded-sm border bg-parchment/75 transition-shadow',
        personaje.hidden
          ? 'border-dashed border-rule-dark/50 bg-parchment/45'
          : 'border-rule-dark/45 hover:shadow-md hover:shadow-black/10',
      )}
    >
      {/* Filete superior: tinta a los lados, bronce en el centro. Es el mismo
          lenguaje de reglas y filetes que usan las cabeceras del programa. */}
      <span
        aria-hidden
        className="block h-[3px] w-full bg-gradient-to-r from-rule-dark/60 via-bronze/80 to-rule-dark/60"
      />

      <div className="flex flex-1 gap-4 p-4">
        <Retrato url={personaje.portraitUrl} nombre={personaje.name} />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate font-display text-2xl leading-none font-bold tracking-wide text-ink">
              {personaje.name}
            </h3>
            <div className="flex shrink-0 items-center gap-1.5">
              {personaje.hidden && <Badge tone="neutral">Oculto</Badge>}
              <DistintivoEspecial />
            </div>
          </div>

          {/* Filete bajo el nombre: rombo de bronce y regla que se apaga. */}
          <span aria-hidden className="mt-2 flex items-center gap-1.5">
            <span className="h-px w-8 bg-bronze/70" />
            <span className="h-1 w-1 rotate-45 bg-bronze/70" />
            <span className="h-px flex-1 bg-rule-dark/30" />
          </span>

          {/* OCULTO, dicho con todas las letras y no solo con el distintivo.
              Un personaje oculto solo lo ve su autor, así que para el resto del
              grupo sencillamente NO EXISTE: no sale aquí, ni en el constructor
              de listas, ni en el buscador. Con un distintivo de dos palabras en
              una esquina eso se olvida en cuanto cierras la pestaña, y lo
              siguiente es preguntarse por qué los demás no ven al personaje.
              Solo lo lee su autor: a los demás no les llega la lámina. */}
          {personaje.hidden && (
            <p className="mt-2 flex items-start gap-1.5 rounded-sm border border-bronze/40 bg-bronze/10 px-2 py-1.5 text-mini leading-snug text-ink-soft">
              <EyeOffIcon className="mt-px h-3.5 w-3.5 shrink-0 text-bronze" />
              <span>
                <strong className="font-semibold text-ink">Oculto: solo lo ves tú.</strong> Nadie más lo encuentra, ni
                puede meterlo en su ejército. Pulsa el ojo de abajo para que vuelva a verlo todo el grupo.
              </span>
            </p>
          )}

          {/* La FACCIÓN no se repite aquí: ya la dice la cabecera del grupo bajo
              la que cuelga esta lámina, y repetirla en cada una es ruido. */}
          <p className="mt-2 text-xs text-ink-soft">
            <span className="tabular-nums">{personaje.baseCost} pts</span>
            {!personaje.active && (
              <>
                <span className="mx-1.5 text-rule-dark/60">·</span>
                <span className="text-danger">desactivado</span>
              </>
            )}
          </p>

          <div className="mt-3">
            <p className="mb-1 text-micro uppercase tracking-widest text-ink-soft/70">Experiencia</p>
            <BarraDeExperiencia valor={personaje.experiencia} size="md" />
          </div>

          {/* Trasfondo A LA VISTA, y dentro de la misma columna que el nombre —no
              en una banda debajo—. Puesto debajo del retrato dejaba un hueco a su
              derecha del alto del retrato, y la lámina parecía rota por la mitad.
              Antes ni siquiera se veía: vivía dentro del diálogo de edición, así
              que un personaje se distinguía de otro por la foto y poco más. */}
          <div className="mt-3 border-l-2 border-bronze/35 pl-3">
            {tieneTrasfondo ? (
              <>
                <div
                  className={clsx(PROSA, !desplegado && largo && 'max-h-24 overflow-hidden')}
                  // El trasfondo se guarda ya saneado (ver EditarPersonajeModal),
                  // pero se vuelve a sanear al pintarlo: es idempotente y barato, y
                  // así una fila antigua o tocada a mano en la base tampoco puede
                  // colar una etiqueta que no esté en la lista.
                  dangerouslySetInnerHTML={{ __html: sanearHtml(trasfondo) }}
                />
                {largo && (
                  <button
                    type="button"
                    onClick={() => setDesplegado((v) => !v)}
                    className="mt-1 text-xs font-medium text-maroon underline decoration-maroon/30 underline-offset-2 hover:decoration-maroon"
                  >
                    {desplegado ? 'Plegar' : 'Seguir leyendo'}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm italic text-ink-soft/60">Sin trasfondo todavía.</p>
            )}
          </div>
        </div>
      </div>

      {errorOcultar && (
        <p className="mx-4 mb-3 rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          No se pudo cambiar la visibilidad: {errorOcultar}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-rule-dark/25 bg-parchment-dark/25 px-3 py-2">
        <Button variant="secondary" onClick={() => setSumando(true)}>
          <PlusIcon className="h-4 w-4" />
          Experiencia
        </Button>
        <Button variant="ghost" onClick={() => setEditando(true)}>
          <PencilIcon className="h-4 w-4" />
          Retrato y trasfondo
        </Button>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Ocultar es la ÚNICA cosa que no puede hacer cualquiera: un
              personaje oculto solo lo ve su autor, así que solo su autor puede
              ponerlo o quitarlo (los de antes de esta función no tienen autor y
              los puede ocultar quien quiera; ver setHidden). */}
          {propio && (
            <button
              type="button"
              onClick={alternarOculto}
              disabled={ocultando}
              aria-label={personaje.hidden ? `Mostrar ${personaje.name}` : `Ocultar ${personaje.name}`}
              title={
                personaje.hidden
                  ? 'Oculto: solo lo ves tú. Pulsa para que vuelva a verlo todo el mundo.'
                  : 'Ocultarlo: dejará de verlo el resto, y no saldrá en sus listas de ejército.'
              }
              className={clsx(
                'rounded-sm p-1.5 transition-colors disabled:opacity-40',
                personaje.hidden
                  ? 'text-maroon hover:bg-maroon/10'
                  : 'text-ink-soft hover:bg-bronze/15 hover:text-bronze',
              )}
            >
              {personaje.hidden ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
          )}
          {/* Borrar es de todos, como el resto de la sección (mismo criterio que
              los mapas). Lo que evita el accidente no es esconder el botón sino
              el aviso, que enumera lo que se lleva por delante — sobre todo la
              experiencia, que es lo único aquí que no se puede volver a montar
              a mano. */}
          <button
            type="button"
            onClick={() => setConfirmandoBorrado(true)}
            aria-label={`Borrar ${personaje.name}`}
            title="Borrar este personaje"
            className="rounded-sm p-1.5 text-ink-soft transition-colors hover:bg-maroon/10 hover:text-danger"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
          {/* Los atributos, el equipo y el coste se editan en la ficha de
              unidad, que sigue estando en "Editor" y por tanto solo se ofrece en
              modo administrador. */}
          {actingAsAdmin && (
            <Link
              to={`/admin/unidades/${personaje.id}`}
              className="inline-flex items-center rounded-sm px-2 py-1 text-xs font-medium text-ink-soft underline decoration-rule-dark/40 underline-offset-2 transition-colors hover:text-ink"
              title="Atributos, equipo, monturas y coste se editan en la ficha de unidad"
            >
              Ficha de unidad
            </Link>
          )}
        </div>
      </div>

      {editando && (
        <EditarPersonajeModal
          personaje={personaje}
          onClose={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false)
            onCambio()
          }}
        />
      )}

      {confirmandoBorrado && (
        <ConfirmDialog
          title="Borrar Personaje de Renombre"
          message={
            `¿Seguro que quieres borrar a "${personaje.name}"? Se borra la unidad entera —perfil, equipo, reglas, ` +
            'opciones y monturas— junto con su retrato, su trasfondo y toda la experiencia que tenga apuntada, y ' +
            'desaparece de cualquier lista de ejército que lo llevara. ESTO ES IRREVERSIBLE: no hay papelera ni ' +
            'forma de recuperarlo, y los apuntes de experiencia no se pueden volver a montar.'
          }
          confirmLabel="Borrar definitivamente"
          onCancel={() => setConfirmandoBorrado(false)}
          onConfirm={async () => {
            // Lo borra UnitRepository, que ya sabía hacerlo para las unidades y
            // se lleva también las tablas que cuelgan de ella. Aquí no hay una
            // versión propia: un personaje de renombre ES una unidad, y dos
            // formas de borrar lo mismo acaban divergiendo.
            await UnitRepository.remove(personaje.id)
            setConfirmandoBorrado(false)
            onCambio()
          }}
        />
      )}

      {sumando && (
        <ExperienciaModal
          personaje={personaje}
          onClose={() => setSumando(false)}
          onApuntado={() => {
            onCambio()
          }}
        />
      )}
    </article>
  )
}

// ---------------------------------------------------------------------------
// Retrato y trasfondo
// ---------------------------------------------------------------------------

function EditarPersonajeModal({
  personaje,
  onClose,
  onGuardado,
}: {
  personaje: PersonajeEspecial
  onClose: () => void
  onGuardado: () => void
}) {
  const [trasfondo, setTrasfondo] = useState(personaje.background ?? '')
  /**
   * La foto con la que se está trabajando: sus bytes, una URL para verla y sus
   * medidas (que hacen falta para saber cuánto ocupa dentro del cuadro). Sale de
   * elegir un archivo nuevo o de bajar el retrato actual para reencuadrarlo.
   */
  const [fuente, setFuente] = useState<{
    url: string
    bytes: Uint8Array
    mime: string
    ancho: number
    alto: number
  } | null>(null)
  const [encuadre, setEncuadre] = useState<EncuadreRetrato>(ENCUADRE_CENTRADO)
  /**
   * Quitar la foto se APUNTA y se aplica al guardar, no en el propio clic. Si
   * se aplicara al momento habría que cerrar el diálogo para refrescar, y se
   * llevaría por delante el trasfondo que se estuviera escribiendo.
   */
  const [quitarFoto, setQuitarFoto] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Las URL de objeto se sueltan al cambiar de foto y al cerrar. Son punteros a
  // un blob en memoria y el navegador no los recoge solo: sin esto, probar
  // cuatro fotos seguidas deja las cuatro retenidas hasta recargar la página.
  const urlAnterior = useRef<string | null>(null)
  useEffect(() => {
    return () => {
      if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current)
    }
  }, [])

  function ponerFuente(bytes: Uint8Array, mime: string, ancho: number, alto: number, url: string) {
    if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current)
    urlAnterior.current = url
    setFuente({ url, bytes, mime, ancho, alto })
    setEncuadre(ENCUADRE_CENTRADO)
    setQuitarFoto(false)
  }

  /** Mide la imagen ya preparada. Sin sus medidas no se sabe qué parte cae dentro del cuadro. */
  function medir(url: string): Promise<{ ancho: number; alto: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ ancho: img.naturalWidth, alto: img.naturalHeight })
      img.onerror = () => reject(new Error('No se pudo leer la imagen.'))
      img.src = url
    })
  }

  function urlDeBytes(bytes: Uint8Array, mime: string): string {
    const buffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(buffer).set(bytes)
    return URL.createObjectURL(new Blob([buffer], { type: mime }))
  }

  async function elegirFoto(file: File | undefined) {
    if (!file) return
    setPreparando(true)
    setError(null)
    try {
      const preparada = await prepararImagenDeEscenografia(file)
      const url = urlDeBytes(preparada.bytes, preparada.mime)
      const { ancho, alto } = await medir(url)
      ponerFuente(preparada.bytes, preparada.mime, ancho, alto, url)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPreparando(false)
    }
  }

  /**
   * Reencuadrar la foto que ya tiene. Se parte del retrato guardado, que ya está
   * recortado, así que sirve para retocar el encuadre; para un cambio grande sale
   * mejor volver a elegir la foto original.
   */
  async function reencuadrarActual() {
    if (!personaje.portraitUrl) return
    setPreparando(true)
    setError(null)
    try {
      const { bytes, mime } = await descargarImagenComoBytes(personaje.portraitUrl)
      const url = urlDeBytes(bytes, mime)
      const { ancho, alto } = await medir(url)
      ponerFuente(bytes, mime, ancho, alto, url)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPreparando(false)
    }
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      // El retrato va PRIMERO, y no es indiferente: `portrait_key` y
      // `background` son columnas de la misma migración, así que con el Worker
      // sin desplegar fallan las dos. Guardando antes la que además sube un
      // archivo a R2, un fallo deja las dos cosas sin hacer en vez de dejar el
      // trasfondo guardado, la foto perdida y el objeto pagado en R2.
      if (fuente) {
        // El encuadre se aplica AQUÍ, no se guarda como dato: lo que sube a R2 ya
        // es el cuadrado definitivo. Ver la cabecera de shared/image#recortarRetrato.
        const recortado = await recortarRetrato(fuente.bytes, fuente.mime, encuadre)
        await SpecialCharacterRepository.setPortrait(personaje.id, recortado.bytes, recortado.mime)
      } else if (quitarFoto) {
        await SpecialCharacterRepository.clearPortrait(personaje.id)
      }
      // El trasfondo se SANEA antes de guardar, igual que los apéndices: el
      // editor produce HTML y lo que llega a la base tiene que pasar por la
      // lista cerrada de etiquetas, no por la confianza.
      const limpio = sanearHtml(trasfondo)
      await SpecialCharacterRepository.setBackground(personaje.id, tieneTexto(limpio) ? limpio : '')
      onGuardado()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGuardando(false)
    }
  }

  const urlMostrada = quitarFoto ? null : personaje.portraitUrl

  return (
    <Modal
      title={personaje.name}
      onClose={onClose}
      widthClassName="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando || preparando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          {/* Con foto de trabajo se enseña el CUADRO DE ENCUADRE en vez de la
              vista previa quieta: lo que se ve ahí dentro es exactamente lo que
              se guarda, así que no hace falta una segunda miniatura al lado
              diciendo lo mismo. */}
          {fuente ? (
            <MarcoDeEncuadre
              url={fuente.url}
              ancho={fuente.ancho}
              alto={fuente.alto}
              encuadre={encuadre}
              onChange={setEncuadre}
            />
          ) : (
            <Retrato url={urlMostrada} nombre={personaje.name} />
          )}

          <div className="flex flex-col items-start gap-2">
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={preparando || guardando}>
              {preparando ? 'Preparando…' : urlMostrada || fuente ? 'Cambiar foto' : 'Elegir foto'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => elegirFoto(e.target.files?.[0])}
            />
            {personaje.portraitUrl && !fuente && !quitarFoto && (
              <Button variant="secondary" disabled={preparando || guardando} onClick={reencuadrarActual}>
                Reencuadrar esta foto
              </Button>
            )}
            {fuente && (
              <Button
                variant="ghost"
                disabled={guardando}
                onClick={() => setEncuadre(ENCUADRE_CENTRADO)}
                title="Vuelve al encuadre de partida: la foto entera, centrada"
              >
                Centrar
              </Button>
            )}
            {personaje.portraitUrl && !fuente && !quitarFoto && (
              <Button variant="ghost" disabled={guardando} onClick={() => setQuitarFoto(true)}>
                Quitar la foto
              </Button>
            )}
            {quitarFoto && !fuente && <p className="text-mini text-ink-soft">Se quitará al guardar.</p>}
            {fuente && (
              <p className="max-w-xs text-mini leading-relaxed text-ink-soft/80">
                Arrastra la foto para moverla y usa la rueda o la barra para ampliarla. El hueco del retrato es
                cuadrado: lo que quede dentro es lo que se guarda.
              </p>
            )}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-ink-soft">Trasfondo (opcional)</span>
          <RichTextEditor
            value={trasfondo}
            onChange={setTrasfondo}
            valorInicialKey={personaje.id}
            placeholder="Quién es, de dónde sale y qué ha hecho para merecer nombre propio."
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Experiencia
// ---------------------------------------------------------------------------

function fechaCorta(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function ExperienciaModal({
  personaje,
  onClose,
  onApuntado,
}: {
  personaje: PersonajeEspecial
  onClose: () => void
  onApuntado: () => void
}) {
  const { data: apuntes, loading, reload } = useAsync(() => SpecialCharacterRepository.listExperiencia(personaje.id))
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mientras cargan los apuntes se usa el total que la lámina ya traía, en vez
  // de un 0. Con 0 se veía parpadear "0 / 100" en un personaje veterano y, peor,
  // si alguien escribía la cantidad antes de que resolviera la consulta, el
  // aviso de pasarse del máximo se calculaba contra 0 y no salía nunca.
  const total = apuntes ? apuntes.reduce((s: number, a: ApunteDeExperiencia) => s + a.amount, 0) : personaje.experiencia
  // Se redondea ANTES de validar, no dentro del repositorio: con 0,4 la
  // validación pasaba, el repositorio redondeaba a 0 y quedaba un apunte de
  // cero puntos —inmutable y sin forma de borrarlo— que además el Log contaba
  // como "Apuntó +0 de experiencia".
  const cantidadNum = Math.round(Number(cantidad))
  const cantidadValida = cantidad.trim() !== '' && Number.isFinite(cantidadNum) && cantidadNum !== 0
  const sePasa = cantidadValida && total + cantidadNum > EXPERIENCIA_MAXIMA

  async function apuntar() {
    if (!cantidadValida) return
    setGuardando(true)
    setError(null)
    try {
      await SpecialCharacterRepository.añadirExperiencia(personaje.id, cantidadNum, motivo)
      setCantidad('')
      setMotivo('')
      reload()
      onApuntado()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      title={`Experiencia · ${personaje.name}`}
      onClose={onClose}
      widthClassName="max-w-lg"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-4">
        <BarraDeExperiencia valor={total} size="md" />

        <div className="rounded-sm border border-rule-dark/30 bg-parchment/60 p-3">
          <div className="flex items-end gap-2">
            <div className="w-28 shrink-0">
              <TextField
                label="Experiencia"
                type="number"
                placeholder="0"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <TextField
                label="Evento"
                placeholder="Aguantó la carga de los Caballeros"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
            <Button variant="primary" onClick={apuntar} disabled={!cantidadValida || guardando}>
              {guardando ? 'Apuntando…' : 'Apuntar'}
            </Button>
          </div>
          {sePasa && (
            <p className="mt-2 text-mini text-amber-700">
              Con esto pasaría de {EXPERIENCIA_MAXIMA}. Se apunta igual —lo que pasó, pasó—, pero conviene saberlo.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {loading ? (
          <Spinner />
        ) : (apuntes ?? []).length === 0 ? (
          <p className="text-xs italic text-ink-soft">Todavía no ha ganado experiencia.</p>
        ) : (
          <ul className="divide-y divide-rule-dark/20">
            {(apuntes ?? []).map((a: ApunteDeExperiencia) => (
              <li key={a.id} className="flex items-baseline gap-3 py-1.5">
                <span className="w-20 shrink-0 text-mini tabular-nums text-ink-soft/70">{fechaCorta(a.createdAt)}</span>
                <span
                  className={`w-10 shrink-0 text-right text-xs font-semibold tabular-nums ${
                    a.amount < 0 ? 'text-danger' : 'text-ink'
                  }`}
                >
                  {a.amount > 0 ? '+' : ''}
                  {a.amount}
                </span>
                <span className="min-w-0 flex-1 text-xs text-ink">
                  {a.note ?? <em className="text-ink-soft">Sin evento</em>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
