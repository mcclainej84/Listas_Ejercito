// ============================================================================
// Puerta de acceso por USUARIO. Mientras no haya sesión, es lo único que se ve.
// Tres modos: entrar, crear usuario y RESTABLECER la contraseña olvidada.
//
// ESTO YA NO SOLO IDENTIFICA: entrar es también lo que acredita al navegador
// para escribir (ver userRepository y la sección AUTENTICACIÓN del Worker).
//
// CAMBIAR ≠ RESTABLECER, y por eso están en sitios distintos:
//
//   · CAMBIAR la tuya, sabiendo la que tienes, se hace DESDE DENTRO, en el menú
//     de tu nombre (ver features/user/CambiarPasswordModal). Ahí no hace falta
//     nada más, porque demostrar que sabes la actual ya prueba que es tuya.
//
//   · RESTABLECER, sin saber la vieja, se hace AQUÍ —quien la ha olvidado no
//     puede entrar— y exige la CONTRASEÑA DE ADMINISTRADOR, que se comprueba en
//     el servidor y no vive en esta página. Sirve para cualquier usuario, así
//     que quien la conozca puede cambiarle la contraseña a otro; queda anotado
//     en el Log, a la vista de todo el grupo. Es la decisión que se tomó: entre
//     unos pocos amigos, que se vea basta y es mucho más cómodo que rescatar a
//     nadie a mano desde la base de datos.
//
// EN MODO RESTABLECER NO SE OFRECE CREAR USUARIO. Quien viene a recuperar su
// cuenta no quiere una cuenta nueva, y ofrecérsela justo ahí es la forma más
// fácil de acabar con dos cuentas y los ejércitos repartidos entre las dos.
// ============================================================================
import { useState, type FormEvent, type ReactNode } from 'react'
import { UserRepository } from '@/data/repositories/userRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession, signIn } from '@/shared/session/useSession'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'

type Mode = 'entrar' | 'crear' | 'restablecer'

/** Mínimo de la contraseña al crear el usuario. Corto: es un grupo de amigos. */
const MINIMO = 4

export function UserGate({ children }: { children: ReactNode }) {
  const { user } = useSession()
  const [mode, setMode] = useState<Mode>('entrar')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  /** Solo al restablecer: repetición de la nueva y contraseña de administrador. */
  const [repetida, setRepetida] = useState('')
  const [admin, setAdmin] = useState('')
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
        setError('Escribe el nombre de usuario.')
        return
      }
      if (!password) {
        setError(mode === 'entrar' ? 'Escribe tu contraseña.' : 'Escribe una contraseña.')
        return
      }
      if (mode === 'entrar') {
        const found = await UserRepository.authenticate(username, password)
        if (!found) {
          setError('Usuario o contraseña incorrectos.')
          return
        }
        signIn(found)
      } else if (mode === 'crear') {
        if (password.length < MINIMO) {
          setError(`La contraseña tiene que tener al menos ${MINIMO} caracteres.`)
          return
        }
        const created = await UserRepository.create(username, password)
        signIn(created)
      } else {
        if (password.length < MINIMO) {
          setError(`La contraseña tiene que tener al menos ${MINIMO} caracteres.`)
          return
        }
        if (password !== repetida) {
          setError('Las dos contraseñas nuevas no coinciden.')
          return
        }
        if (!admin) {
          setError('Hace falta la contraseña de administrador para restablecer.')
          return
        }
        await UserRepository.resetPassword(username, admin, password)
        setInfo('Contraseña restablecida. Ya puedes entrar con ella.')
        setMode('entrar')
        setPassword('')
        setRepetida('')
        setAdmin('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'entrar' ? 'Entrar' : mode === 'crear' ? 'Crear usuario' : 'Restablecer contraseña'
  const action = mode === 'entrar' ? 'Entrar' : mode === 'crear' ? 'Crear y entrar' : 'Restablecer'

  /** Deja los campos limpios al saltar de un modo a otro. */
  function irA(siguiente: Mode) {
    setMode(siguiente)
    setError(null)
    setInfo(null)
    setPassword('')
    setRepetida('')
    setAdmin('')
  }

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
            list={mode === 'crear' ? undefined : 'wharmy-usuarios'}
          />
          {/* Sugerencias con los usuarios existentes, para no tener que recordar el nombre exacto. */}
          <datalist id="wharmy-usuarios">
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.username} />
            ))}
          </datalist>

          <TextField
            label={mode === 'entrar' ? 'Contraseña' : 'Contraseña nueva'}
            type="password"
            autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {mode === 'restablecer' && (
            <>
              <TextField
                label="Repite la contraseña nueva"
                type="password"
                autoComplete="new-password"
                value={repetida}
                onChange={(e) => setRepetida(e.target.value)}
              />
              <TextField
                label="Contraseña de administrador"
                type="password"
                autoComplete="off"
                value={admin}
                onChange={(e) => setAdmin(e.target.value)}
              />
              <p className="text-mini leading-relaxed text-ink-soft">
                Restablecer queda anotado en el <b className="text-ink">Log</b>, donde lo ve todo el grupo.
              </p>
            </>
          )}
        </div>

        {error && <p className="mt-3 rounded-sm bg-danger-dark/10 px-2 py-1.5 text-xs text-danger">{error}</p>}
        {info && <p className="mt-3 rounded-sm bg-bronze/10 px-2 py-1.5 text-xs text-ink">{info}</p>}

        <Button type="submit" variant="primary" className="mt-4 w-full justify-center" disabled={busy}>
          {busy ? 'Un momento…' : action}
        </Button>

        {/* Desde "entrar" se va a los otros dos; desde ellos solo se vuelve.
            Crear usuario NO se ofrece mientras se restablece: quien viene a
            recuperar su cuenta no quiere una nueva. */}
        <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs">
          {mode === 'entrar' ? (
            <>
              <button type="button" onClick={() => irA('crear')} className="text-ink-soft hover:text-maroon">
                Crear un usuario nuevo
              </button>
              <button type="button" onClick={() => irA('restablecer')} className="text-ink-soft hover:text-maroon">
                He olvidado la contraseña
              </button>
            </>
          ) : (
            <button type="button" onClick={() => irA('entrar')} className="text-ink-soft hover:text-maroon">
              ← Entrar
            </button>
          )}
        </div>

        <p className="mt-5 border-t border-rule-dark/20 pt-3 text-mini leading-relaxed text-ink-soft">
          Tu usuario separa tus ejércitos y tus facciones, y es además lo que te permite guardar cambios: sin entrar se
          puede mirar todo, pero no modificar nada. Si sabes tu contraseña y quieres otra, se cambia desde dentro, en el
          menú de tu nombre; si la has olvidado, se restablece aquí con la contraseña de administrador.
        </p>
      </form>
    </div>
  )
}
