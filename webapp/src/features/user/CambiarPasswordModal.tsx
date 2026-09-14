// ============================================================================
// Cambiar la contraseña, DESDE DENTRO de la sesión.
//
// Estuvo en la pantalla de acceso, junto a "entrar" y "crear usuario", y era el
// sitio equivocado por dos razones que se notaron en cuanto la contraseña
// empezó a servir para algo:
//
//   1. Ahí se cambia la contraseña de CUALQUIERA con solo escribir su nombre.
//      Pide la actual, así que no es una puerta abierta, pero sí un banco de
//      pruebas cómodo para adivinar contraseñas ajenas, y a un usuario legítimo
//      no le hace ninguna falta: si quiere cambiar la suya, puede entrar.
//   2. Obligaba a escribir el nombre de usuario para una operación en la que ya
//      se sabe de sobra quién eres.
//
// Aquí no hay campo de usuario: es el de la sesión, y punto.
//
// LAS TRES CASILLAS SON A PROPÓSITO. La actual la exige el servidor (ver
// /auth/password). La nueva repetida no la exige nadie, pero un error de tecleo
// en una contraseña que no se ve deja fuera de la aplicación a quien la escribió
// — y sin forma de recuperarla, porque no hay recuperación. Escribirla dos
// veces cuesta tres segundos y evita eso.
// ============================================================================
import { useState, type FormEvent } from 'react'
import { UserRepository } from '@/data/repositories/userRepository'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import type { User } from '@/domain/types'

/** Mínimo de la contraseña nueva. Corto a propósito: es un grupo de amigos. */
const MINIMO = 4

export function CambiarPasswordModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!actual) return setError('Escribe tu contraseña actual.')
    if (nueva.length < MINIMO) return setError(`La contraseña nueva tiene que tener al menos ${MINIMO} caracteres.`)
    if (nueva !== repetida) return setError('Las dos contraseñas nuevas no coinciden.')
    if (nueva === actual) return setError('La contraseña nueva es igual que la actual.')

    setGuardando(true)
    try {
      await UserRepository.changePassword(user, actual, nueva)
      setHecho(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGuardando(false)
    }
  }

  if (hecho) {
    return (
      <Modal
        title="Cambiar contraseña"
        onClose={onClose}
        widthClassName="max-w-sm"
        footer={
          <Button variant="primary" onClick={onClose}>
            Cerrar
          </Button>
        }
      >
        <p className="text-sm leading-relaxed text-ink">
          Listo, tu contraseña es la nueva. <b>Sigues dentro</b>: no hace falta volver a entrar aquí, pero en los demás
          navegadores donde tengas la sesión abierta habrá que entrar otra vez con ella.
        </p>
      </Modal>
    )
  }

  return (
    <Modal
      title="Cambiar contraseña"
      onClose={onClose}
      widthClassName="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" form="cambiar-password" variant="primary" disabled={guardando}>
            {guardando ? 'Cambiando…' : 'Cambiar'}
          </Button>
        </>
      }
    >
      <form id="cambiar-password" onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-ink-soft">
          Cambias la contraseña de <b className="text-ink">{user.username}</b>, que es con la que entras y con la que se
          guardan tus cambios.
        </p>

        {/* Oculto y solo para el gestor de contraseñas del navegador: sin el
            nombre de usuario delante, no sabe a qué cuenta corresponde lo que
            se está cambiando y ofrece guardarlo suelto. */}
        <input type="text" autoComplete="username" value={user.username} readOnly hidden />

        <TextField
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={actual}
          onChange={(e) => setActual(e.target.value)}
        />
        <TextField
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
        />
        <TextField
          label="Repite la contraseña nueva"
          type="password"
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
        />

        {error && <p className="rounded-sm bg-danger-dark/10 px-2 py-1.5 text-xs text-danger">{error}</p>}

        <p className="border-t border-rule-dark/20 pt-2.5 text-mini leading-relaxed text-ink-soft">
          Apúntala donde sueles: no hay forma de recuperarla desde la aplicación. Si se pierde, tendrá que cambiarla
          alguien con acceso a la base de datos.
        </p>
      </form>
    </Modal>
  )
}
