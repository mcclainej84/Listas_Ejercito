import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { hasStoredPassword, onAuthChange, setPassword } from '@/data/network/auth'
import { Button } from '@/shared/ui/Button'

/**
 * Puerta de contraseña de grupo: envuelve solo las rutas de escritura
 * (Administración y el constructor de listas — ver app/AppRouter.tsx). La
 * navegación de solo lectura no pasa por aquí y funciona sin pedir nada.
 *
 * No valida la contraseña contra el servidor al introducirla — solo la
 * guarda (hasheada, ver data/network/auth.ts) y dejar pasar. Si resulta ser
 * incorrecta, el primer intento de escritura lo revelará (401 ->
 * AuthRequiredError en data/sqlite/client.ts), que borra la contraseña
 * guardada y dispara `onAuthChange`: este componente lo escucha y vuelve a
 * mostrar el formulario, esta vez con un aviso explicando por qué.
 */
export function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => hasStoredPassword())
  const [rejected, setRejected] = useState(false)
  const [value, setValue] = useState('')

  useEffect(() => {
    return onAuthChange(() => {
      const stillHasPassword = hasStoredPassword()
      setUnlocked(stillHasPassword)
      if (!stillHasPassword) setRejected(true)
    })
  }, [])

  if (unlocked) {
    return <>{children}</>
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    await setPassword(value.trim())
    setValue('')
    setRejected(false)
    setUnlocked(true)
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs rounded-sm border border-rule-dark/40 bg-parchment/80 p-6 text-center shadow-sm shadow-black/10"
      >
        <p className="font-display text-lg text-ink">Zona de grupo</p>
        <p className="mt-1 text-xs text-ink-soft">
          Esta sección modifica datos compartidos por todo el grupo. Introduce la contraseña para continuar.
        </p>
        {rejected && (
          <p className="mt-3 rounded-sm bg-danger-dark/10 px-2 py-1.5 text-xs text-danger">
            La contraseña guardada no era correcta (o ha caducado). Vuelve a introducirla.
          </p>
        )}
        <label htmlFor="group-password" className="mt-4 block text-left">
          <span className="mb-1 block text-xs font-medium text-ink-soft">Contraseña de grupo</span>
          <input
            id="group-password"
            type="password"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-sm border border-rule-dark/50 bg-parchment/70 px-3 py-1.5 text-sm text-ink outline-none transition-colors focus:border-bronze focus:ring-2 focus:ring-bronze/25"
          />
        </label>
        <Button type="submit" variant="primary" className="mt-4 w-full justify-center">
          Entrar
        </Button>
      </form>
    </div>
  )
}
