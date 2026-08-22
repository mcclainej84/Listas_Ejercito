import { useRef, useState } from 'react'
import { ArmyListRepository } from '@/data/repositories/armyListRepository'
import { hashDeContenido, uploadImageAtKey } from '@/data/network/images'
import { urlDelEmblemaDeLista } from '@/domain/armyEmblem'
import {
  PREFIJO_DISENO,
  claveDeDiseno,
  disenoDesdeClave,
  disenoPorDefecto,
  svgDeEmblema,
  urlDeEmblema,
  type DisenoDeEmblema,
} from '@/domain/emblemaDeEjercito'
import { EmblemaDesignerModal } from '@/features/army-lists/EmblemaDesignerModal'
import { useVisibleFactions } from '@/shared/session/useVisibleFactions'
import { compressImageFile, rasterizarSvg } from '@/shared/image'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { TextField } from '@/shared/ui/TextField'
import type { ArmyListDetail } from '@/domain/types'

interface ArmyListSettingsModalProps {
  list: ArmyListDetail
  onClose: () => void
  /** Devuelve los valores ya persistidos para que la página actualice su estado local SIN recargar (una recarga descartaría el borrador de entradas sin guardar). */
  onSaved: (values: {
    name: string
    pointsLimit: number | null
    showSpecialCharacters: boolean
    emblemFactionId: number | null
    emblemKey: string | null
  }) => void
}

/** Renombrar la lista y/o cambiar su límite de puntos. La facción no se puede cambiar (las entradas dependen de ella). */
export function ArmyListSettingsModal({ list, onClose, onSaved }: ArmyListSettingsModalProps) {
  const [name, setName] = useState(list.name)
  const [pointsLimit, setPointsLimit] = useState(list.pointsLimit != null ? String(list.pointsLimit) : '')
  const [mostrarRenombre, setMostrarRenombre] = useState(list.showSpecialCharacters)
  // Los Personajes de Renombre que la lista YA lleva. Apagar la casilla no los
  // quita —tirar entradas que alguien montó sin preguntar sería mucho peor—,
  // pero sí deja de ofrecerlos, así que se avisa: si no, uno los ve en su lista
  // y no entiende por qué no puede añadir otro ni volver a poner el que borre.
  const yaMetidos = list.entries.filter((e) => e.unit.isSpecialCharacter)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ---- Emblema del ejército -------------------------------------------------
  // Tres estados y no dos: "el de mi facción" NO es lo mismo que "el de la
  // facción X que resulta ser la mía". El primero sigue a la facción si algún
  // día le cambian el emblema; el segundo la congela. Casi todos los ejércitos
  // se quedan en el primero para siempre, así que tiene que ser el que está
  // puesto y el que se entiende sin leer nada.
  const { factions } = useVisibleFactions()
  const [emblemFactionId, setEmblemFactionId] = useState<number | null>(list.emblemFactionId)
  const [emblemKey, setEmblemKey] = useState<string | null>(list.emblemKey)
  const [subiendoEmblema, setSubiendoEmblema] = useState(false)
  const archivoRef = useRef<HTMLInputElement>(null)
  /**
   * Diseño a la espera de guardarse. Se previsualiza como SVG —es instantáneo,
   * así que el diseñador puede repintar en cada clic— y solo al aceptar se
   * convierte en imagen y se sube. Subir a cada cambio sería una petición por
   * capricho.
   */
  const [diseno, setDiseno] = useState<DisenoDeEmblema | null>(null)
  const [disenando, setDisenando] = useState(false)
  // Los diseñados se guardan bajo `emblemas/gen-…` y con su diseño dentro del
  // nombre, para poder reconocerlos Y REABRIRLOS: si no, un emblema diseñado
  // reaparecería como "imagen propia" y habría que rehacerlo desde cero para
  // cambiarle un color.
  const disenoGuardado = disenoDesdeClave(emblemKey)
  const esDisenado = (emblemKey ?? '').startsWith(PREFIJO_DISENO)
  const origen: 'faccion' | 'otra' | 'imagen' | 'disenado' =
    diseno != null || esDisenado ? 'disenado' : emblemKey ? 'imagen' : emblemFactionId != null ? 'otra' : 'faccion'
  const colorDeLaFaccion = (factions ?? []).find((f) => f.id === list.factionId)?.color ?? null
  const urlDelEmblema =
    diseno != null
      ? urlDeEmblema(diseno)
      : urlDelEmblemaDeLista({ factionId: list.factionId, emblemFactionId, emblemKey }, factions ?? [])

  /** Rasteriza el emblema diseñado y lo sube. Devuelve su clave en R2. */
  async function subirEmblemaDisenado(d: DisenoDeEmblema): Promise<string> {
    const imagen = await rasterizarSvg(svgDeEmblema(d), 480)
    const ext = imagen.mime === 'image/webp' ? 'webp' : imagen.mime === 'image/png' ? 'png' : 'jpg'
    const clave = claveDeDiseno(d, await hashDeContenido(imagen.bytes), ext)
    await uploadImageAtKey(clave, imagen.bytes, imagen.mime)
    return clave
  }

  async function subirEmblema(file: File | undefined) {
    if (!file) return
    setSubiendoEmblema(true)
    setError(null)
    try {
      // Cuadrado y con el mismo tamaño que los emblemas de facción (480 px):
      // el recuadro es el mismo en todas partes, así que la imagen tiene que
      // llegar preparada para ese recuadro y no al revés.
      const comprimida = await compressImageFile(file, { maxSize: 480, keepAlpha: true })
      const ext = comprimida.mime === 'image/png' ? 'png' : comprimida.mime === 'image/jpeg' ? 'jpg' : 'webp'
      const key = `emblemas/${await hashDeContenido(comprimida.bytes)}.${ext}`
      await uploadImageAtKey(key, comprimida.bytes, comprimida.mime)
      setEmblemKey(key)
      setEmblemFactionId(null)
      setDiseno(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubiendoEmblema(false)
    }
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError('El nombre de la lista es obligatorio.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const nextName = name.trim()
      const nextPointsLimit = pointsLimit.trim() ? Number(pointsLimit) : null
      // ORDEN A PROPÓSITO: primero la que puede no existir todavía en la base.
      // `show_special_characters` es de una migración reciente, y si el Worker
      // no está desplegado este UPDATE falla con "no such column". Yendo la
      // última, el nombre y los puntos ya se habrían guardado y el usuario
      // leería un error que le hace creer que no se guardó nada, con la
      // pantalla enseñándole todavía los valores viejos. Yendo la primera, o se
      // guarda todo o no se guarda nada.
      await ArmyListRepository.setShowSpecialCharacters(list.id, mostrarRenombre)
      // El diseñado se sube AQUÍ, al guardar la lista, no al diseñarlo.
      const claveFinal = diseno != null ? await subirEmblemaDisenado(diseno) : emblemKey
      await ArmyListRepository.setEmblem(list.id, emblemFactionId, claveFinal)
      await ArmyListRepository.rename(list.id, nextName)
      await ArmyListRepository.setPointsLimit(list.id, nextPointsLimit)
      onSaved({
        name: nextName,
        pointsLimit: nextPointsLimit,
        showSpecialCharacters: mostrarRenombre,
        emblemFactionId,
        emblemKey: claveFinal,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Editar lista"
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
        <TextField label="Nombre de la lista" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <TextField
          label="Límite de puntos (opcional)"
          type="number"
          placeholder="Sin límite"
          value={pointsLimit}
          onChange={(e) => setPointsLimit(e.target.value)}
        />
        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="mt-0.5 accent-maroon"
            checked={mostrarRenombre}
            onChange={(e) => setMostrarRenombre(e.target.checked)}
          />
          <span>
            Ver Personajes de Renombre
            <span className="mt-0.5 block text-xs text-ink-soft">
              Les da su propia sección en el constructor. Cuentan como Personajes para los límites del ejército.
              Desmarcado, no se ofrecen en esta lista.
            </span>
          </span>
        </label>
        {!mostrarRenombre && yaMetidos.length > 0 && (
          <p className="rounded-sm border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-ink">
            Esta lista ya lleva{' '}
            {yaMetidos.length === 1 ? 'un Personaje de Renombre' : `${yaMetidos.length} Personajes de Renombre`} (
            {yaMetidos.map((e) => e.unit.name).join(', ')}). No se quitan al desmarcar, pero dejarán de ofrecerse: si
            los borras de la lista, no podrás volver a añadirlos sin marcar esto otra vez.
          </p>
        )}
        {/* ---- Emblema del ejército ---- */}
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">Emblema del ejército</p>
          <div className="flex items-start gap-3">
            {/* El MISMO recuadro que los emblemas de facción: cuadrado, esquina
                suave y las dos sombras. Si aquí se viera de otra forma, el
                usuario no reconocería lo que va a ver luego en la batalla. */}
            <span className="relative inline-block h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-parchment-dark/40 shadow-md shadow-black/25">
              {urlDelEmblema ? (
                <img src={urlDelEmblema} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-micro text-ink-soft/60">sin emblema</span>
              )}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-sm"
                style={{ boxShadow: 'inset 0 0 12px rgba(20,14,6,0.35)' }}
              />
            </span>

            <div className="min-w-0 flex-1 space-y-2">
              <Select
                label=""
                value={origen}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === 'faccion') {
                    setEmblemKey(null)
                    setEmblemFactionId(null)
                    setDiseno(null)
                  } else if (v === 'otra') {
                    setEmblemKey(null)
                    setEmblemFactionId(list.faction.id)
                    setDiseno(null)
                  } else if (v === 'disenado') {
                    setEmblemFactionId(null)
                    setDisenando(true)
                  } else {
                    archivoRef.current?.click()
                  }
                }}
              >
                <option value="faccion">El de su facción ({list.faction.name})</option>
                <option value="disenado">Diseñar uno…</option>
                <option value="otra">El de otra facción…</option>
                <option value="imagen">Una imagen propia…</option>
              </Select>

              {origen === 'disenado' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={subiendoEmblema}
                    onClick={() => setDisenando(true)}
                    className="rounded-sm border border-rule-dark/40 bg-parchment px-2 py-1 text-xs font-medium text-ink hover:bg-parchment-dark disabled:opacity-50"
                  >
                    Cambiar el diseño…
                  </button>
                  {diseno != null && <span className="text-micro text-ink-soft/70">Se guardará este</span>}
                </div>
              )}

              {origen === 'otra' && (
                <Select
                  label=""
                  value={emblemFactionId ?? ''}
                  onChange={(e) => setEmblemFactionId(Number(e.target.value) || null)}
                >
                  {(factions ?? []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              )}

              {origen === 'imagen' && (
                <button
                  type="button"
                  disabled={subiendoEmblema}
                  onClick={() => archivoRef.current?.click()}
                  className="rounded-sm border border-rule-dark/40 bg-parchment px-2 py-1 text-xs text-ink hover:bg-parchment-dark disabled:opacity-50"
                >
                  {subiendoEmblema ? 'Subiendo…' : 'Cambiar la imagen'}
                </button>
              )}

              <p className="text-xs leading-snug text-ink-soft">
                Es de <b className="text-ink">este ejército</b> y de ningún otro: no toca el emblema de la facción, que
                es común. Se ve en el listado de Ejércitos y en las batallas.
              </p>
            </div>
          </div>

          <input
            ref={archivoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              subirEmblema(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {/* El diseñador va sobre este diálogo. Al aceptar NO sube nada: deja el
            diseño apuntado y se sube al guardar la lista, con todo lo demás. */}
        {disenando && (
          <EmblemaDesignerModal
            inicial={diseno ?? disenoGuardado ?? disenoPorDefecto(colorDeLaFaccion)}
            guardando={false}
            onCancel={() => setDisenando(false)}
            onAceptar={(d) => {
              setDiseno(d)
              setEmblemKey(null)
              setEmblemFactionId(null)
              setDisenando(false)
            }}
          />
        )}
      </div>
    </Modal>
  )
}
