// ============================================================================
// Puerta de acceso por USUARIO. Mientras no haya sesión, es lo único que se ve.
// DOS modos, y solo dos: entrar y crear usuario.
//
// ESTO YA NO SOLO IDENTIFICA: entrar es también lo que acredita al navegador
// para escribir (ver userRepository y la sección AUTENTICACIÓN del Worker).
//
// POR QUÉ AQUÍ NO SE CAMBIA LA CONTRASEÑA. Estuvo, y estaba mal puesto: desde
// una pantalla a la que llega cualquiera se podía apuntar al usuario que fuera
// con solo escribir su nombre. Pedía la actual, así que no era una puerta
// abierta, pero sí un banco de pruebas cómodo para ir probando contraseñas
// ajenas — y a quien quiere cambiar la suya no le cuesta nada entrar primero.
// Ahora se cambia desde dentro, en el menú del usuario (ver
// features/user/CambiarPasswordModal).
//
// Quien olvide la suya necesita a alguien con acceso a la base de datos. No hay
// recuperación, y es el precio de que la contraseña sirva para algo.
// ============================================================================
import { useState, type FormEvent, type ReactNode } from 'react'
import { UserRepository } from '@/data/repositories/userRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession, signIn } from '@/shared/session/useSession'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'

type Mode = 'entrar' | 'crear'

/** Mínimo de la contraseña al crear el usuario. Corto: es un grupo de amigos. */
const MINIMO = 4

export function UserGate({ children }: { children: ReactNode }) {
  const { user } = useSession()
  const [mode, setMode] = useState<Mode>('entrar')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const { data: users } = useAsync(() => UserRepository.listAll())

  if (user) return <>{children}</>

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (!username.trim()) {
        setError('Escribe tu nombre de usuario.')
        return
      }
      if (!password) {
        setError(mode === 'crear' ? 'Escribe una contraseña.' : 'Escribe tu contraseña.')
        return
      }
      if (mode === 'entrar') {
        const found = await UserRepository.authenticate(username, password)
        if (!found) {
          setError('Usuario o contraseña incorrectos.')
          return
        }
        signIn(found)
      } else {
        if (password.length < MINIMO) {
          setError(`La contraseña tiene que tener al menos ${MINIMO} caracteres.`)
          return
        }
        const created = await UserRepository.create(username, password)
        signIn(created)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'entrar' ? 'Entrar' : 'Crear usuario'
  const action = mode === 'entrar' ? 'Entrar' : 'Crear y entrar'

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-sm border border-rule-dark/40 bg-parchment/80 p-6 shadow-sm shadow-black/10"
      >
        <p className="font-display text-2xl text-ink">WHArmy</p>
        <p className="mt-0.5 mb-5 text-xs text-ink-soft">{title}</p>

        <div className="space-y-3">
          <TextField
            label="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            list={mode === 'entrar' ? 'wharmy-usuarios' : undefined}
          />
          {/* Sugerencias con los usuarios existentes, para no tener que recordar el nombre exacto. */}
          <datalist id="wharmy-usuarios">
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.username} />
            ))}
          </datalist>

          <TextField
            label="Contraseña"
            type="password"
            autoComplete={mode === 'crear' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="mt-3 rounded-sm bg-danger-dark/10 px-2 py-1.5 text-xs text-danger">{error}</p>}
        {info && <p className="mt-3 rounded-sm bg-bronze/10 px-2 py-1.5 text-xs text-ink">{info}</p>}

        <Button type="submit" variant="primary" className="mt-4 w-full justify-center" disabled={busy}>
          {busy ? 'Un momento…' : action}
        </Button>

        {/* Un solo enlace, el del otro modo: con tres, la pantalla parecía un
            menú de opciones cuando lo que se viene a hacer aquí es entrar. */}
        <div className="mt-4 text-xs">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'entrar' ? 'crear' : 'entrar')
              setError(null)
              setInfo(null)
              setPassword('')
            }}
            className="text-ink-soft hover:text-maroon"
          >
            {mode === 'entrar' ? 'Crear un usuario nuevo' : '← Ya tengo usuario'}
          </button>
        </div>

        <p className="mt-5 border-t border-rule-dark/20 pt-3 text-mini leading-relaxed text-ink-soft">
          Tu usuario separa tus ejércitos y tus facciones, y es además lo que te permite guardar cambios: sin entrar se
          puede mirar todo, pero no modificar nada. La contraseña se cambia desde dentro, en el menú de tu nombre. Si la
          olvidas no hay forma de recuperarla: tendrá que cambiártela alguien con acceso a la base de datos.
        </p>
      </form>
    </div>
  )
}
