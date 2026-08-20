// ============================================================================
// PERSONAJES DE RENOMBRE: los que tienen nombre propio (Vlad von Carstein) en
// vez de ser "un Señor Vampiro" del montón.
//
// ESTA SECCIÓN YA NO ES DE EDICIÓN. Vive en la barra principal, junto a Hojas
// de Unidad, Ejércitos y Mapas, y la usa cualquiera: los personajes de renombre
// son comunes —se ven, se editan y se meten en un ejército sin modo
// administrador—. La única excepción es OCULTARLOS, que reserva un personaje
// para su autor (ver specialCharacterRepository).
//
// QUÉ SE EDITA AQUÍ Y QUÉ NO, que es lo que más despista al llegar. Un
// personaje de renombre ES una unidad (ver specialCharacterRepository), así que
// sus atributos, su equipo, sus monturas y su coste se tocan en la ficha de
// unidad de siempre, que sigue estando en "Editor". Esta pantalla se ocupa solo
// de lo que un personaje de renombre tiene y una unidad no: el retrato, el
// trasfondo y la experiencia.
//
// Se montó así a propósito, en vez de replicar aquí medio editor de unidades:
// serían dos sitios para editar lo mismo, y al primer cambio en uno el otro se
// quedaría corto.
// ============================================================================
import { useState } from 'react'
import { SpecialCharacterRepository, type PersonajeEspecial } from '@/data/repositories/specialCharacterRepository'
import { FactionRepository } from '@/data/repositories/factionRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { PageHeader } from '@/shared/ui/PageHeader'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { Select } from '@/shared/ui/Select'
import { TextField } from '@/shared/ui/TextField'
import { FactionEmblem } from '@/shared/ui/FactionEmblem'
import { PlusIcon } from '@/shared/ui/icons'
import { PersonajeRenombreCard } from '@/features/renombre/PersonajeRenombreCard'
import type { Faction } from '@/domain/types'
import type { UnitSummary } from '@/data/repositories/unitRepository'

/**
 * Cabecera de un grupo: emblema, nombre de la facción y una regla que llega
 * hasta el final.
 *
 * Sustituye al <Panel> que envolvía cada facción. El panel metía las láminas
 * dentro de otra caja con borde —caja dentro de caja— y obligaba a poner un
 * subtítulo debajo del nombre, que es donde vivía el "N con nombre propio" que
 * el usuario pidió quitar. Una regla horizontal separa igual de bien y deja
 * todo el ancho a las láminas, que es lo que se ha venido a ver.
 */
function CabeceraDeFaccion({ faccion, cuantos }: { faccion: Pick<Faction, 'name' | 'emblemUrl'>; cuantos: number }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <FactionEmblem faction={faccion} size="sm" />
      <h2 className="font-display text-xl leading-none font-bold tracking-wide text-ink">{faccion.name}</h2>
      <span className="text-sm tabular-nums text-ink-soft/70">{cuantos}</span>
      <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-rule-dark/50 to-transparent" />
    </div>
  )
}

/** Valor del filtro cuando no filtra nada. Es una cadena porque sale de un <select>. */
const TODAS = 'todas'

export function PersonajesRenombrePage() {
  const { data: personajes, loading, reload } = useAsync(() => SpecialCharacterRepository.listAll())
  const { data: facciones } = useAsync(() => FactionRepository.listAll())
  const [creando, setCreando] = useState(false)
  const [faccionFiltro, setFaccionFiltro] = useState<string>(TODAS)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <Spinner />

  const todos = personajes ?? []
  // El filtro se aplica ANTES de agrupar, así que los grupos, los contadores y
  // el mensaje de "no hay ninguno" salen todos del mismo sitio y no pueden
  // contradecirse (un contador que suma los de todas las facciones sobre una
  // lista filtrada es el fallo clásico de esta pantalla).
  const lista = faccionFiltro === TODAS ? todos : todos.filter((p) => String(p.factionId) === faccionFiltro)
  // Agrupados por facción y en el orden en que vienen las facciones, no
  // alfabético: es el orden que el usuario ya conoce del resto del programa.
  const porFaccion = new Map<number, PersonajeEspecial[]>()
  for (const p of lista) {
    const grupo = porFaccion.get(p.factionId)
    if (grupo) grupo.push(p)
    else porFaccion.set(p.factionId, [p])
  }
  const ordenadas = (facciones ?? []).filter((f) => porFaccion.has(f.id))
  // Personajes cuya facción NO viene en el listado de facciones (desactivada,
  // borrada, o simplemente todavía cargando). Sin esto se quedaban fuera de la
  // pantalla SIN QUE NADA LO DIJERA: contaban para que no saliera el mensaje de
  // "no hay ninguno", pero no se pintaban en ningún grupo, así que no había
  // forma de llegar ni a su ficha para arreglarlos.
  const conocidas = new Set(ordenadas.map((f) => f.id))
  const huerfanos = lista.filter((p) => !conocidas.has(p.factionId))

  // En el desplegable solo las facciones que TIENEN personajes. Con las 22 del
  // catálogo, elegir una y encontrarse la pantalla vacía es lo más probable que
  // podría pasar, y el desplegable estaría diciendo que allí hay algo.
  const conPersonajes = new Set(todos.map((p) => p.factionId))
  const faccionesDelFiltro = (facciones ?? []).filter((f) => conPersonajes.has(f.id))

  return (
    <div>
      <PageHeader
        title="Personajes de Renombre"
        description={
          'Personajes con nombre propio. Nacen copiando un personaje de su facción, así que traen ya sus ' +
          'atributos, su equipo, sus monturas y su coste; a partir de ahí son suyos. Son de todos: cualquiera ' +
          'los edita y los mete en su ejército.'
        }
        actions={
          <Button variant="primary" onClick={() => setCreando(true)}>
            <PlusIcon className="h-4 w-4" />
            Nuevo personaje
          </Button>
        }
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {faccionesDelFiltro.length > 1 && (
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div className="w-64">
            <Select label="Facción" value={faccionFiltro} onChange={(e) => setFaccionFiltro(e.target.value)}>
              <option value={TODAS}>Todas las facciones</option>
              {faccionesDelFiltro.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
          <p className="pb-1.5 text-xs text-ink-soft">
            {lista.length === 1 ? '1 personaje' : `${lista.length} personajes`}
            {faccionFiltro !== TODAS && todos.length !== lista.length && ` de ${todos.length}`}
          </p>
        </div>
      )}

      {lista.length === 0 ? (
        <EmptyState
          title={faccionFiltro === TODAS ? 'Todavía no hay ninguno' : 'Ninguno en esta facción'}
          description={
            faccionFiltro === TODAS
              ? 'Elige un personaje de una facción y se copiará entero para darle nombre e historia.'
              : 'Prueba con otra facción, o quita el filtro para verlos todos.'
          }
          action={
            faccionFiltro === TODAS ? (
              <Button variant="primary" onClick={() => setCreando(true)}>
                <PlusIcon className="h-4 w-4" />
                Nuevo personaje
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setFaccionFiltro(TODAS)}>
                Ver todas las facciones
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-8">
          {ordenadas.map((faccion) => (
            <section key={faccion.id}>
              <CabeceraDeFaccion faccion={faccion} cuantos={porFaccion.get(faccion.id)?.length ?? 0} />
              {/* Una lámina por fila. El contenido de la aplicación va en una
                  columna de 896 px (ver AppShell), así que partirla en dos
                  dejaría el retrato de 160 px con una columna de texto de cuatro
                  palabras de ancho. */}
              <ul className="space-y-4">
                {(porFaccion.get(faccion.id) ?? []).map((p) => (
                  <li key={p.id}>
                    <PersonajeRenombreCard personaje={p} onCambio={reload} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {huerfanos.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="font-display text-xl leading-none font-bold tracking-wide text-ink">
                  Sin facción reconocible
                </h2>
                <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-rule-dark/50 to-transparent" />
              </div>
              <p className="mb-3 text-xs text-ink-soft">
                Su facción no aparece en el listado: puede estar desactivada o haberse borrado.
              </p>
              <ul className="space-y-4">
                {huerfanos.map((p) => (
                  <li key={p.id}>
                    <PersonajeRenombreCard personaje={p} onCambio={reload} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {creando && (
        <CrearPersonajeModal
          onClose={() => setCreando(false)}
          onCreado={() => {
            setCreando(false)
            reload()
          }}
          onError={setError}
        />
      )}
    </div>
  )
}

/**
 * Alta: facción → personaje del que se copia → nombre.
 *
 * El personaje base es OBLIGATORIO y no hay forma de crear uno en blanco. Es
 * deliberado: un personaje de renombre sin perfil, sin equipo y sin coste no
 * sirve para nada y habría que rellenárselo todo a mano; partiendo de un
 * genérico se empieza con algo jugable y solo se retoca lo que cambie.
 */
function CrearPersonajeModal({
  onClose,
  onCreado,
  onError,
}: {
  onClose: () => void
  onCreado: () => void
  onError: (mensaje: string | null) => void
}) {
  const { data: facciones } = useAsync(() => FactionRepository.listAll())
  const [factionId, setFactionId] = useState<number | null>(null)
  const { data: bases, loading: cargandoBases } = useAsync(
    () => (factionId ? SpecialCharacterRepository.listPersonajesBase(factionId) : Promise.resolve([] as UnitSummary[])),
    [factionId],
  )
  const [baseId, setBaseId] = useState<number | null>(null)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  const puedeGuardar = baseId != null && nombre.trim().length > 0 && !guardando

  async function guardar() {
    if (baseId == null) return
    setGuardando(true)
    onError(null)
    try {
      await SpecialCharacterRepository.crearDesdePersonaje(baseId, nombre)
      onCreado()
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
      onClose()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      title="Nuevo Personaje de Renombre"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={!puedeGuardar}>
            {guardando ? 'Copiando…' : 'Crear'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select
          label="Facción"
          value={factionId ?? ''}
          onChange={(e) => {
            setFactionId(e.target.value ? Number(e.target.value) : null)
            setBaseId(null)
          }}
        >
          <option value="">Elige una facción…</option>
          {(facciones ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>

        <Select
          label="Copiar de"
          value={baseId ?? ''}
          disabled={!factionId || cargandoBases}
          onChange={(e) => setBaseId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{cargandoBases ? 'Cargando…' : 'Elige un personaje…'}</option>
          {(bases ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.baseCost} pts
            </option>
          ))}
        </Select>

        <TextField
          label="Nombre del personaje"
          placeholder="Vlad von Carstein"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        {factionId != null && (bases ?? []).length === 0 && !cargandoBases && (
          <p className="text-xs text-ink-soft">
            Esa facción todavía no tiene personajes de los que copiar. Créalo primero en Editor &gt; Unidades.
          </p>
        )}

        <p className="text-mini leading-relaxed text-ink-soft/80">
          Se copia todo: perfil, reglas, equipo, opciones, monturas con su coste, grupo de mando y, si es hechicero, sus
          sendas. La copia es independiente — retocarle los atributos no toca al personaje del que salió.
        </p>
      </div>
    </Modal>
  )
}
