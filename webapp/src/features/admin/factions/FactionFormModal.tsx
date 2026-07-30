import { useRef, useState } from 'react'
import { FactionRepository } from '@/data/repositories/factionRepository'
import { UserRepository } from '@/data/repositories/userRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession } from '@/shared/session/useSession'
import { resizeImageFile } from '@/shared/image'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { TextArea } from '@/shared/ui/TextArea'
import { TrashIcon, StarIcon } from '@/shared/ui/icons'
import { FactionFeaturedRulesModal } from '@/features/user/FactionFeaturedRulesModal'
import type { Faction } from '@/domain/types'

function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

interface FactionFormModalProps {
  faction: Faction | null
  onClose: () => void
  onSaved: () => void
}

export function FactionFormModal({ faction, onClose, onSaved }: FactionFormModalProps) {
  const [name, setName] = useState(faction?.name ?? '')
  const [description, setDescription] = useState(faction?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // El emblema se guarda al momento (no espera al botón "Guardar"), porque
  // es una acción independiente de los datos de texto y así el usuario ve el
  // resultado (o el error de una imagen no válida) de inmediato.
  const [emblemUrl, setEmblemUrl] = useState(faction?.emblemUrl ?? null)
  const [hasCustomEmblem, setHasCustomEmblem] = useState(faction?.hasCustomEmblem ?? false)
  const [emblemBusy, setEmblemBusy] = useState(false)
  const [emblemError, setEmblemError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Favorita y reglas destacadas viven aquí (dentro de "Editar") en vez de
  // como botones sueltos sobre la lámina de la facción — una única acción
  // de edición, en vez de tres controles distintos sobre la rejilla.
  const { user } = useSession()
  const { data: favoriteFactionId, reload: reloadFavorite } = useAsync(
    () => (user ? UserRepository.getFavoriteFactionId(user.id) : Promise.resolve(null)),
    [user],
  )
  const isFavorite = faction != null && favoriteFactionId === faction.id
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const [showRules, setShowRules] = useState(false)

  async function handleToggleFavorite() {
    if (!user || !faction) return
    setFavoriteBusy(true)
    try {
      await UserRepository.setFavoriteFactionId(user.id, isFavorite ? null : faction.id)
      reloadFavorite()
    } finally {
      setFavoriteBusy(false)
    }
  }

  async function handleEmblemFile(file: File | undefined) {
    if (!file || !faction) return
    setEmblemBusy(true)
    setEmblemError(null)
    try {
      const { bytes, mime } = await resizeImageFile(file)
      await FactionRepository.setEmblem(faction.id, bytes, mime)
      const refreshed = await FactionRepository.getById(faction.id)
      if (refreshed) {
        setEmblemUrl(refreshed.emblemUrl)
        setHasCustomEmblem(refreshed.hasCustomEmblem)
      }
      onSaved()
    } catch (err) {
      setEmblemError(err instanceof Error ? err.message : String(err))
    } finally {
      setEmblemBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleClearEmblem() {
    if (!faction) return
    setEmblemBusy(true)
    setEmblemError(null)
    try {
      await FactionRepository.clearEmblem(faction.id)
      const refreshed = await FactionRepository.getById(faction.id)
      if (refreshed) {
        setEmblemUrl(refreshed.emblemUrl)
        setHasCustomEmblem(refreshed.hasCustomEmblem)
      }
      onSaved()
    } catch (err) {
      setEmblemError(err instanceof Error ? err.message : String(err))
    } finally {
      setEmblemBusy(false)
    }
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const input = { name: name.trim(), slug: slugify(name), description: description.trim() || null }
      if (faction) {
        await FactionRepository.update(faction.id, input)
      } else {
        await FactionRepository.create(input)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={faction ? 'Editar facción' : 'Nueva facción'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <TextArea
          label="Descripción (opcional)"
          rows={3}
          value={description ?? ''}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Emblema</p>
          {faction ? (
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-rule-dark/40 bg-parchment-dark">
                {emblemUrl ? (
                  <img src={emblemUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-micro text-ink-soft">Sin emblema</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={emblemBusy}
                  >
                    {emblemBusy ? 'Procesando…' : hasCustomEmblem ? 'Cambiar emblema' : 'Subir emblema'}
                  </Button>
                  {hasCustomEmblem && (
                    <button
                      type="button"
                      onClick={handleClearEmblem}
                      disabled={emblemBusy}
                      className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-ink-soft hover:bg-maroon/10 hover:text-maroon disabled:opacity-50"
                      title="Borrar emblema personalizado"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      Borrar
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleEmblemFile(e.target.files?.[0])}
                />
                {emblemError && <p className="text-xs text-danger">{emblemError}</p>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-soft italic">Guarda la facción primero; después podrás subirle un emblema.</p>
          )}
        </div>

        {faction && user && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Preferencias personales</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleToggleFavorite}
                disabled={favoriteBusy}
                className="flex items-center gap-1.5 rounded-sm border border-rule-dark/40 px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-parchment-dark/50 disabled:opacity-50"
              >
                <StarIcon className="h-3.5 w-3.5" filled={isFavorite} />
                {isFavorite ? 'Favorita' : 'Marcar como favorita'}
              </button>
              <button
                type="button"
                onClick={() => setShowRules(true)}
                className="rounded-sm border border-rule-dark/40 px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-parchment-dark/50"
              >
                Reglas destacadas…
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      {showRules && faction && (
        <FactionFeaturedRulesModal
          faction={faction}
          onClose={() => setShowRules(false)}
          onSaved={() => setShowRules(false)}
        />
      )}
    </Modal>
  )
}
