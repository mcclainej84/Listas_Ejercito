// ============================================================================
// Puerta de acceso por USUARIO. Mientras no haya sesión, es lo único que se ve.
// Tres modos: entrar, crear usuario y cambiar la contraseña.
//
// ESTO YA NO SOLO IDENTIFICA: entrar es también lo que acredita al navegador
// para escribir (ver userRepository y la sección AUTENTICACIÓN del Worker). De
// ahí el cambio visible aquí: "he olvidado la contraseña" era un restablecido
// libre, y ahora es un CAMBIO que pide la contraseña actual. Sin eso, cualquiera
// podría apropiarse de cualquier cuenta y, con ella, del permiso de escritura.
//
// Quien de verdad olvide la suya necesita a alguien con acceso a la base de
// datos. Es el precio de que la contraseña sirva para algo.
// ============================================================================
import { useState, type FormEvent, type ReactNode } from 'react'
import { UserRepository } from '@/data/repositories/userRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession, signIn } from '@/shared/session/useSession'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'

type Mode = 'entrar' | 'crear' | 'cambiar'

export function UserGate({ children }: { children: ReactNode }) {
  const { user } = useSession()
  const [mode, setMode] = useState<Mode>('entrar')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  /** Solo en modo "cambiar": la contraseña que se tiene ahora. */
  const [actual, setActual] = useState('')
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
      if (mode === 'entrar') {
        const found = await UserRepository.authenticate(username, password)
        if (!found) {
          setError('Usuario o contraseña incorrectos.')
          return
        }
        signIn(found)
      } else if (mode === 'crear') {
        if (!password) {
          setError('Escribe una contraseña.')
          return
        }
        const created = await UserRepository.create(username, password)
        signIn(created)
      } else {
        if (!actual) {
          setError('Escribe tu contraseña actual.')
          return
        }
        if (!password) {
          setError('Escribe la contraseña nueva.')
          return
        }
        await UserRepository.changePassword(username, actual, password)
        setInfo('Contraseña cambiada. Ya puedes entrar con la nueva.')
        setMode('entrar')
        setPassword('')
        setActual('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'entrar' ? 'Entrar' : mode === 'crear' ? 'Crear usuario' : 'Cambiar la contraseña'
  const action = mode === 'entrar' ? 'Entrar' : mode === 'crear' ? 'Crear y entrar' : 'Cambiar'

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
            list="wharmy-usuarios"
          />
          {/* Sugerencias con los usuarios existentes, para no tener que recordar el nombre exacto. */}
          <datalist id="wharmy-usuarios">
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.username} />
            ))}
          </datalist>

          {mode === 'cambiar' && (
            <TextField
              label="Contraseña actual"
              type="password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
          )}

          <TextField
            label={mode === 'cambiar' ? 'Contraseña nueva' : 'Contraseña'}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="mt-3 rounded-sm bg-danger-dark/10 px-2 py-1.5 text-xs text-danger">{error}</p>}
        {info && <p className="mt-3 rounded-sm bg-bronze/10 px-2 py-1.5 text-xs text-ink">{info}</p>}

        <Button type="submit" variant="primary" className="mt-4 w-full justify-center" disabled={busy}>
          {busy ? 'Un momento…' : action}
        </Button>

        <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs">
          {mode !== 'entrar' && (
            <button type="button" onClick={() => setMode('entrar')} className="text-ink-soft hover:text-maroon">
              ← Entrar
            </button>
          )}
          {mode !== 'crear' && (
            <button type="button" onClick={() => setMode('crear')} className="text-ink-soft hover:text-maroon">
              Crear usuario
            </button>
          )}
          {mode !== 'cambiar' && (
            <button type="button" onClick={() => setMode('cambiar')} className="text-ink-soft hover:text-maroon">
              Cambiar la contraseña
            </button>
          )}
        </div>

        <p className="mt-5 border-t border-rule-dark/20 pt-3 text-mini leading-relaxed text-ink-soft">
          Tu usuario separa tus ejércitos y tus facciones, y es además lo que te permite guardar cambios: sin entrar se
          puede mirar todo, pero no modificar nada. Si olvidas la contraseña no hay forma de recuperarla desde aquí —
          tendrá que cambiártela alguien con acceso a la base de datos.
        </p>
      </form>
    </div>
  )
}
