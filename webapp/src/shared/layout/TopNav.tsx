import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { GlobalSearch } from '@/shared/layout/GlobalSearch'
import { ChevronDownIcon, ContrastIcon } from '@/shared/ui/icons'
import { useGlobalGrayscale } from '@/shared/theme/useGrayscaleMode'
import { setActingAsAdmin, signOut, useSession } from '@/shared/session/useSession'
import { MyFactionsModal } from '@/features/user/MyFactionsModal'
import { ArmyListOptionsModal } from '@/features/user/ArmyListOptionsModal'
import { CambiarPasswordModal } from '@/features/user/CambiarPasswordModal'

interface NavItem {
  to: string
  label: string
  /**
   * Cómo se llama la sección CUANDO LA BARRA ES ESTRECHA (móvil). Las cinco
   * secciones con su nombre largo no caben en 390 px, y lo que no cabe se queda
   * detrás de un arrastre lateral que nadie descubre: "Batallas" y "Mapas"
   * dejaban de existir en el teléfono. Acortadas, las cinco entran de una vez.
   * El nombre completo sigue saliendo de `sm` en adelante.
   */
  corto?: string
}

// Las 5 secciones de datos maestros (antes sueltas en la barra) viven ahora
// dentro del menú desplegable "Editor": son las que de verdad sirven para
// PREPARAR fichas y ejércitos (dar de alta unidades, reglas, monturas...),
// no para usarlos día a día — de ahí que el usuario pidiera esconderlas
// detrás de un único punto de entrada en vez de ocupar 5 huecos en la barra.
// El menú solo reorganiza la navegación: no cambia quién puede entrar.
const EDITOR_ITEMS: NavItem[] = [
  { to: '/admin/facciones', label: 'Facciones' },
  { to: '/admin/unidades', label: 'Unidades' },
  { to: '/admin/reglas', label: 'Reglas' },
  { to: '/admin/opciones', label: 'Equipo y opciones' },
  { to: '/admin/monturas', label: 'Montura/Dotación' },
  { to: '/admin/carros', label: 'Carros' },
  { to: '/admin/sendas', label: 'Sendas de Magia' },
  { to: '/admin/taxonomia', label: 'Categorías y Etiquetas' },
  { to: '/admin/importar', label: 'Importar desde Libro' },
  { to: '/admin/log', label: 'Log' },
]

// "Personajes de Renombre" está aquí y NO en el menú "Editor": es una sección
// de uso diario, la ve y la edita cualquiera sin modo administrador (ver
// PersonajesRenombrePage). Lo que sigue estando en "Editor" es su ficha de
// unidad —atributos, equipo y coste—, como la de cualquier otra unidad.
const TOOL_ITEMS: NavItem[] = [
  { to: '/hojas', label: 'Hojas de Unidad', corto: 'Hojas' },
  { to: '/ejercitos', label: 'Ejércitos' },
  { to: '/renombre', label: 'Personajes de Renombre', corto: 'Renombre' },
  { to: '/batallas', label: 'Batallas' },
  { to: '/mapas', label: 'Mapas' },
]

function NavLinkItem({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        clsx(
          'border-b-2 px-0.5 pb-1 text-sm font-medium tracking-wide whitespace-nowrap transition-colors',
          isActive ? 'border-maroon text-maroon' : 'border-transparent text-ink-soft hover:text-ink',
        )
      }
      title={item.corto ? item.label : undefined}
    >
      {item.corto ? (
        <>
          <span className="sm:hidden">{item.corto}</span>
          <span className="hidden sm:inline">{item.label}</span>
        </>
      ) : (
        item.label
      )}
    </NavLink>
  )
}

/**
 * Menú desplegable "Editor": agrupa las 5 secciones de datos maestros. Se
 * marca como activo (subrayado) si la ruta actual empieza por `/admin`,
 * igual que haría un NavLink normal con las páginas que agrupa. Se cierra
 * solo al elegir una opción o al hacer clic fuera (no hay librería de
 * menús instalada — bastante sencillo para no traer una dependencia nueva).
 *
 * El panel del desplegable se pinta en un portal a `document.body` (igual
 * que Modal.tsx), posicionado "a mano" con las coordenadas del botón
 * (getBoundingClientRect): la barra de navegación tiene `overflow-x-auto`
 * para poder desplazarse en pantallas estrechas, y eso hace que CUALQUIER
 * hijo con overflow vertical (incluido un `position:absolute` normal) quede
 * recortado por ese mismo contenedor — es lo que impedía ver las opciones
 * del menú. Un portal escapa de ese recorte por completo.
 */
function EditorMenu() {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  // El panel vive en un portal a document.body (fuera de `rootRef`). Sin esta
  // referencia, el listener `mousedown` de "clic fuera" cerraría el menú al
  // pulsar una opción ANTES de que su `click` navegara — el portal se
  // desmontaba entre el mousedown y el click y `navigate` nunca se ejecutaba.
  const panelRef = useRef<HTMLDivElement>(null)
  const isActiveSection = location.pathname.startsWith('/admin')

  function handleToggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setCoords({ top: rect.bottom + 8, left: rect.left })
    }
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function handleReposition() {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        setCoords({ top: rect.bottom + 8, left: rect.left })
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-haspopup="true"
        aria-expanded={open}
        className={clsx(
          'flex items-center gap-1 border-b-2 px-0.5 pb-1 text-sm font-medium tracking-wide whitespace-nowrap transition-colors',
          isActiveSection || open ? 'border-maroon text-maroon' : 'border-transparent text-ink-soft hover:text-ink',
        )}
      >
        Editor
        <ChevronDownIcon className={clsx('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-50 w-44 rounded-sm border border-rule-dark/40 bg-parchment shadow-md shadow-black/15"
            style={{ top: coords.top, left: coords.left }}
          >
            <div className="flex flex-col py-1">
              {EDITOR_ITEMS.map((item) => (
                <button
                  key={item.to}
                  onClick={() => {
                    setOpen(false)
                    navigate(item.to)
                  }}
                  className={clsx(
                    'px-3 py-1.5 text-left text-sm transition-colors hover:bg-parchment-dark',
                    location.pathname === item.to ? 'font-semibold text-maroon' : 'text-ink',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

/**
 * Navegación horizontal fija arriba, en una sola línea siempre: el nombre de
 * la app pegado al extremo izquierdo, todas las secciones a continuación, y
 * el interruptor de color + el buscador al extremo derecho. Deja los márgenes
 * izquierdo y derecho de la página libres para el fondo de pergamino, en vez
 * de una barra lateral que reduce el ancho útil de contenido.
 *
 * A propósito, esta barra NO comparte el `max-w-*` centrado del contenido de
 * `AppShell` (que además usa un ancho distinto, `max-w-4xl`): "WHArmy" debe
 * quedar pegado a la esquina real de la ventana, no al borde de una columna
 * de contenido centrada — por eso ocupa el ancho completo con solo un
 * padding pequeño (`px-4`).
 */
/**
 * Botón "arriba del todo" para ver TODO el programa en blanco y negro o a
 * color (ver useGrayscaleMode.ts) — distinto del "Vista" de la sección
 * Fichas, que solo afecta a la tarjeta y a lo que se exporta. Este es un
 * simple interruptor de pantalla, con su propio icono (mismo `ContrastIcon`
 * que ya se usaba en Fichas) para que se entienda de un vistazo qué hace.
 */
function GlobalGrayscaleToggle() {
  const [grayscale, toggle] = useGlobalGrayscale()
  return (
    <button
      type="button"
      onClick={toggle}
      title={grayscale ? 'Ver a color' : 'Ver en blanco y negro'}
      aria-pressed={grayscale}
      className={clsx(
        'flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors sm:px-2.5',
        grayscale ? 'border-maroon/40 bg-maroon/10 text-maroon' : 'border-rule-dark/40 text-ink-soft hover:text-ink',
      )}
    >
      <ContrastIcon className="h-3.5 w-3.5" />
      {/* En el móvil, solo el icono: el rótulo son 90 px de una barra que ya va
          justa, y el icono con su `title` dice lo mismo. */}
      <span className="hidden sm:inline">{grayscale ? 'Blanco y negro' : 'Color'}</span>
    </button>
  )
}

/**
 * Menú del usuario: quién eres, interruptor de "modo administrador" (que solo
 * decide si se ven las opciones de edición — no es un permiso, se activa sin
 * contraseña), acceso a "Mis facciones" y cerrar sesión.
 */
function UserMenu({
  onOpenFactions,
  onOpenArmyListOptions,
  onOpenPassword,
}: {
  onOpenFactions: () => void
  onOpenArmyListOptions: () => void
  onOpenPassword: () => void
}) {
  const { user, actingAsAdmin } = useSession()
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, right: 0 })
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (!user) return null

  function handleToggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setCoords({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
    }
    setOpen((v) => !v)
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-sm border border-rule-dark/40 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-ink hover:bg-parchment-dark"
      >
        {user.username}
        {actingAsAdmin && <span className="rounded-full bg-maroon/15 px-1.5 text-micro text-maroon">admin</span>}
        <ChevronDownIcon className={clsx('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-50 w-60 rounded-sm border border-rule-dark/40 bg-parchment shadow-md shadow-black/15"
            style={{ top: coords.top, right: coords.right }}
          >
            <label className="flex cursor-pointer items-start gap-2 border-b border-rule-dark/20 px-3 py-2.5 text-xs text-ink hover:bg-parchment-dark">
              <input
                type="checkbox"
                className="mt-0.5 accent-maroon"
                checked={actingAsAdmin}
                onChange={(e) => setActingAsAdmin(e.target.checked)}
              />
              <span>
                Actuar como administrador
                <span className="mt-0.5 block text-[10.5px] text-ink-soft">
                  Muestra las opciones de edición y todas las facciones.
                </span>
              </span>
            </label>

            <button
              onClick={() => {
                setOpen(false)
                onOpenFactions()
              }}
              className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-parchment-dark"
            >
              Mis facciones
            </button>
            <button
              onClick={() => {
                setOpen(false)
                onOpenArmyListOptions()
              }}
              className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-parchment-dark"
            >
              Opciones Lista de ejército
            </button>
            <button
              onClick={() => {
                setOpen(false)
                onOpenPassword()
              }}
              className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-parchment-dark"
            >
              Cambiar contraseña
            </button>
            <button
              onClick={() => {
                setOpen(false)
                signOut()
              }}
              className="w-full border-t border-rule-dark/20 px-3 py-2 text-left text-sm text-ink-soft hover:bg-parchment-dark hover:text-maroon"
            >
              Cerrar sesión
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}

export function TopNav() {
  const { user, actingAsAdmin } = useSession()
  const [factionsOpen, setFactionsOpen] = useState(false)
  const [listOptionsOpen, setListOptionsOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  return (
    <header className="border-b-2 border-ink bg-parchment/90 backdrop-blur-sm">
      {/* DOS FILAS EN EL MÓVIL, UNA EN EL ORDENADOR.
          En una sola fila, un teléfono obliga a arrastrar la barra a un lado
          para llegar a "Ejércitos": la navegación queda escondida detrás de un
          gesto que nadie adivina. Por debajo de `sm` la fila se parte —arriba
          la marca, el buscador y el usuario; abajo las secciones, que ahí sí se
          desplazan porque son suyas y se ven de primeras— y de `sm` en adelante
          `flex-nowrap` la devuelve a la línea única de siempre. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2.5 sm:flex-nowrap sm:gap-x-6 sm:overflow-x-auto sm:px-4 sm:py-3">
        <Link to="/" className="shrink-0 transition-opacity hover:opacity-80">
          <p className="font-display text-lg leading-none text-ink">WHArmy</p>
          {/* El subtítulo es decorativo y en el móvil cuesta una línea entera y
              medio ancho de la marca. Se queda en el ordenador. */}
          <p className="hidden text-mini tracking-wide text-ink-soft sm:block">Gestor de listas de ejército</p>
        </Link>

        {/* `order-last` + `w-full`: en el móvil baja a su propia fila. Los
            márgenes negativos la dejan sangrar hasta el borde de la pantalla,
            para que al desplazarla se vea que hay más y no parezca cortada. */}
        <nav className="-mx-3 order-last flex w-full items-center gap-4 overflow-x-auto px-3 pb-0.5 sm:mx-0 sm:order-none sm:w-auto sm:shrink-0 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0">
          {TOOL_ITEMS.map((item) => (
            <NavLinkItem key={item.to} item={item} />
          ))}
          {/* Las opciones de edición solo se muestran en modo administrador. */}
          {actingAsAdmin && (
            <>
              <span className="h-4 w-px shrink-0 bg-rule-dark/40" />
              <EditorMenu />
            </>
          )}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <GlobalGrayscaleToggle />
          <div className="w-28 sm:w-56">
            <GlobalSearch />
          </div>
          <UserMenu
            onOpenFactions={() => setFactionsOpen(true)}
            onOpenArmyListOptions={() => setListOptionsOpen(true)}
            onOpenPassword={() => setPasswordOpen(true)}
          />
        </div>
      </div>

      {passwordOpen && user && <CambiarPasswordModal user={user} onClose={() => setPasswordOpen(false)} />}

      {listOptionsOpen && user && (
        <ArmyListOptionsModal
          userId={user.id}
          onClose={() => setListOptionsOpen(false)}
          onSaved={() => {
            setListOptionsOpen(false)
            // El constructor lee las opciones al montarse; recargar es la forma
            // más simple y fiable de que el cambio se vea ya, esté abierto o no.
            window.location.reload()
          }}
        />
      )}

      {factionsOpen && user && (
        <MyFactionsModal
          userId={user.id}
          onClose={() => setFactionsOpen(false)}
          onSaved={() => {
            setFactionsOpen(false)
            // Las pantallas leen las facciones al montarse; recargar es la forma
            // más simple y fiable de que el cambio se vea en todas a la vez.
            window.location.reload()
          }}
        />
      )}
    </header>
  )
}
