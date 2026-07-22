// ============================================================================
// Puerta de acceso por USUARIO (perfil). Mientras no haya sesión, es lo único
// que se ve. Tres modos: entrar, crear usuario y restablecer contraseña.
//
// Recordatorio: esto identifica, no protege (ver userRepository). Restablecer
// la contraseña no pide ninguna comprobación, por decisión expresa del usuario.
// ============================================================================
import { useState, type FormEvent, type ReactNode } from 'react'
import { UserRepository } from '@/data/repositories/userRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession, signIn } from '@/shared/session/useSession'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'

type Mode = 'entrar' | 'crear' | 'restablecer'

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
        const found = await UserRepository.findByUsername(username)
        if (!found) {
          setError('No existe ningún usuario con ese nombre.')
          return
        }
        if (!password) {
          setError('Escribe la contraseña nueva.')
          return
        }
        await UserRepository.resetPassword(found.id, password)
        setInfo('Contraseña restablecida. Ya puedes entrar con ella.')
        setMode('entrar')
        setPassword('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'entrar' ? 'Entrar' : mode === 'crear' ? 'Crear usuario' : 'Restablecer contraseña'
  const action = mode === 'entrar' ? 'Entrar' : mode === 'crear' ? 'Crear y entrar' : 'Restablecer'

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

          <TextField
            label={mode === 'restablecer' ? 'Contraseña nueva' : 'Contraseña'}
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
          {mode !== 'restablecer' && (
            <button type="button" onClick={() => setMode('restablecer')} className="text-ink-soft hover:text-maroon">
              He olvidado la contraseña
            </button>
          )}
        </div>

        <p className="mt-5 border-t border-rule-dark/20 pt-3 text-mini leading-relaxed text-ink-soft">
          Los usuarios sirven para separar tus ejércitos y tus facciones, no como medida de seguridad: cualquiera puede
          restablecer una contraseña y el modo administrador se activa sin pedir nada.
        </p>
      </form>
    </div>
  )
}
