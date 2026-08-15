// ============================================================================
// La BIBLIOTECA: añadir, reemplazar y borrar elementos de escenografía y
// suelos de mesa.
//
// LO QUE HAY QUE ENTENDER AL USARLA, y por eso se dice en pantalla: aquí no se
// modifica nada. Reemplazar la imagen de un bosque crea una versión nueva; los
// mapas ya guardados siguen con la suya y solo cambian los que se hagan (o se
// vuelvan a guardar) a partir de ahora.
//
// BORRAR SÍ ES DEFINITIVO —de la paleta—, y por eso se pregunta antes. En la
// base el elemento sigue existiendo, porque los mapas que lo usaban apuntan a
// su versión y sin ella se quedarían con un hueco; lo que no hay es forma de
// devolverlo a la paleta. Se probó con una lista de "retirados" y un botón de
// recuperar, y se quitó: acaba siendo un cajón de trastos que nadie limpia.
//
// LAS IMÁGENES SE PREPARAN SOLAS al elegirlas: se les quita el fondo liso, se
// recorta el aire que sobra y se reducen a 512 px (ver
// shared/image#prepararImagenDeEscenografia). Sin eso, una foto de 4 MB con
// fondo blanco acaba sobre la mesa como un recorte de papel — que es justo lo
// que pasaba al principio con las ilustraciones que se subían a mano.
// ============================================================================
import { useRef, useState } from 'react'
import { clsx } from 'clsx'
import {
  FloorAssetRepository,
  SceneryAssetRepository,
  type NuevoElemento,
  type NuevoSuelo,
} from '@/data/repositories/sceneryAssetRepository'
import { construirPaleta, type EntradaDePaleta, type FloorAsset, type SceneryAsset } from '@/domain/scenery'
import { compressImageFile, prepararImagenDeEscenografia, type ImagenPreparada } from '@/shared/image'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession } from '@/shared/session/useSession'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { PlusIcon, SwapIcon, TrashIcon } from '@/shared/ui/icons'
import { SceneryShape } from '@/features/maps/SceneryShape'
import { estiloDeSueloDeMapa } from '@/features/maps/tableSurface'

/** Vista previa de la imagen recién elegida, antes de guardarla. */
function useVistaPrevia() {
  const [imagen, setImagen] = useState<ImagenPreparada | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  function poner(preparada: ImagenPreparada | null) {
    setImagen(preparada)
    if (!preparada) {
      setUrl(null)
      return
    }
    const buffer = new ArrayBuffer(preparada.bytes.byteLength)
    new Uint8Array(buffer).set(preparada.bytes)
    setUrl(URL.createObjectURL(new Blob([buffer], { type: preparada.mime })))
  }
  return { imagen, url, poner }
}

export function SceneryLibraryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [pestana, setPestana] = useState<'elementos' | 'suelos'>('elementos')

  return (
    <Modal
      title="Biblioteca de escenografía"
      onClose={onClose}
      widthClassName="max-w-3xl"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-sm border border-rule-dark/40">
        {(
          [
            { valor: 'elementos', etiqueta: 'Elementos' },
            { valor: 'suelos', etiqueta: 'Suelos' },
          ] as const
        ).map((p, i) => (
          <button
            key={p.valor}
            type="button"
            onClick={() => setPestana(p.valor)}
            aria-pressed={pestana === p.valor}
            className={clsx(
              'px-2 py-1.5 text-xs font-medium transition-colors',
              i === 0 && 'border-r border-rule-dark/30',
              pestana === p.valor ? 'bg-maroon/10 text-maroon' : 'bg-parchment text-ink hover:bg-parchment-dark',
            )}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <p className="mb-3 text-mini leading-relaxed text-ink-soft/80">
        Lo que cambies aquí vale para este mapa y para los siguientes. Los mapas ya guardados se quedan con la versión
        con la que se hicieron, así que no se estropea ninguno.
      </p>

      {pestana === 'elementos' ? <PanelElementos onSaved={onSaved} /> : <PanelSuelos onSaved={onSaved} />}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Elementos de escenografía
// ---------------------------------------------------------------------------

/**
 * Un tipo de FÁBRICA que todavía no se ha tocado no tiene fila en la
 * biblioteca. Para poder reemplazarlo o borrarlo como a cualquier otro, se
 * finge una "versión cero" con sus datos del código: al guardar nacerá su
 * versión 1 de verdad (ver proximaVersion en el repositorio).
 */
function versionBase(entrada: EntradaDePaleta, asset: SceneryAsset | null): SceneryAsset {
  return (
    asset ?? {
      id: 0,
      slug: entrada.slug,
      version: 0,
      label: entrada.label,
      imageKey: null,
      imageUrl: entrada.imageUrl,
      builtinKind: entrada.kind,
      anchoCm: entrada.anchoCm,
      altoCm: entrada.altoCm,
      retired: false,
      createdAt: '',
    }
  )
}

function PanelElementos({ onSaved }: { onSaved: () => void }) {
  const { user } = useSession()
  const { data: assets, loading, reload } = useAsync(() => SceneryAssetRepository.listVigentes())
  const [editando, setEditando] = useState<SceneryAsset | 'nuevo' | null>(null)
  const [borrando, setBorrando] = useState<SceneryAsset | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const vigentes = assets ?? []
  const paleta = construirPaleta(vigentes)
  const porSlug = new Map(vigentes.map((a) => [a.slug, a]))

  async function conAviso(accion: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await accion()
      await reload()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />

  if (editando) {
    const asset = editando === 'nuevo' ? null : editando
    return (
      <FormularioElemento
        asset={asset}
        onCancel={() => setEditando(null)}
        onGuardar={async (datos, slug) => {
          await conAviso(async () => {
            if (slug) {
              await SceneryAssetRepository.reemplazar(slug, datos, asset?.builtinKind ?? slug, user?.id ?? null)
            } else {
              await SceneryAssetRepository.crear(datos, user?.id ?? null)
            }
            setEditando(null)
          })
        }}
      />
    )
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-ink-soft">{paleta.length} en la paleta</span>
        <Button variant="secondary" onClick={() => setEditando('nuevo')} disabled={busy}>
          <PlusIcon className="h-4 w-4" />
          Nuevo elemento
        </Button>
      </div>

      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {paleta.map((entrada) => {
          const asset = porSlug.get(entrada.slug) ?? null
          return (
            <li
              key={entrada.slug}
              className="flex items-center gap-2 rounded-sm border border-rule-dark/30 bg-parchment/60 p-1.5"
            >
              <SceneryShape
                kind={entrada.kind}
                imagenUrl={entrada.imageUrl}
                ajuste="contener"
                className="h-9 w-9 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-ink">{entrada.label}</span>
                <span className="block text-mini text-ink-soft/70 tabular-nums">
                  {entrada.anchoCm} × {entrada.altoCm} cm{asset ? ` · v${asset.version}` : ''}
                </span>
              </span>
              <span className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditando(versionBase(entrada, asset))}
                  aria-label={`Reemplazar ${entrada.label}`}
                  title="Reemplazar por otra imagen (crea una versión nueva)"
                  className="rounded-sm p-1 text-ink-soft transition-colors hover:bg-parchment-dark hover:text-ink disabled:opacity-40"
                >
                  <SwapIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setBorrando(versionBase(entrada, asset))}
                  aria-label={`Borrar ${entrada.label}`}
                  title="Borrar de la paleta"
                  className="rounded-sm p-1 text-ink-soft transition-colors hover:bg-maroon/10 hover:text-danger disabled:opacity-40"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          )
        })}
      </ul>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {borrando && (
        <ConfirmDialog
          title={`Borrar "${borrando.label}"`}
          message={
            'Desaparece de la paleta y no se puede recuperar. Los mapas que ya lo usan no cambian: siguen ' +
            'pintándolo igual.'
          }
          confirmLabel="Borrar"
          onCancel={() => setBorrando(null)}
          onConfirm={() =>
            conAviso(async () => {
              await SceneryAssetRepository.borrar(borrando, user?.id ?? null)
              setBorrando(null)
            })
          }
        />
      )}
    </div>
  )
}

function FormularioElemento({
  asset,
  onCancel,
  onGuardar,
}: {
  asset: SceneryAsset | null
  onCancel: () => void
  onGuardar: (datos: NuevoElemento, slug: string | null) => Promise<void>
}) {
  const [label, setLabel] = useState(asset?.label ?? '')
  const [anchoCm, setAnchoCm] = useState(asset?.anchoCm ?? 20)
  const [altoCm, setAltoCm] = useState(asset?.altoCm ?? 16)
  const { imagen, url, poner } = useVistaPrevia()
  const [procesando, setProcesando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function elegir(file: File | undefined) {
    if (!file) return
    setProcesando(true)
    setError(null)
    try {
      const preparada = await prepararImagenDeEscenografia(file)
      poner(preparada)
      // El tamaño en cm se ajusta a la proporción de la imagen ya recortada:
      // así la pieza nace sin deformar y solo hay que colocarla.
      setAltoCm(Math.max(2, Math.round(anchoCm / preparada.proporcion)))
      setAviso(
        preparada.fondoQuitado
          ? 'Fondo quitado y recortada al contenido.'
          : 'No tenía un fondo liso que quitar; se ha recortado y reducido.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setProcesando(false)
    }
  }

  const esNuevo = asset == null
  const puedeGuardar = label.trim().length > 0 && (imagen != null || !esNuevo) && !procesando

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-ink">
        {esNuevo ? 'Elemento nuevo' : `Reemplazar "${asset.label}"`}
        {!esNuevo && asset.version > 0 && (
          <span className="ml-1 font-normal text-ink-soft/70">· pasará a ser la versión {asset.version + 1}</span>
        )}
      </p>

      <div className="flex gap-3">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-rule-dark/40 bg-parchment-dark/40">
          {url ? (
            <img src={url} alt="" className="h-full w-full object-contain" />
          ) : asset?.imageUrl ? (
            <img src={asset.imageUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-mini text-ink-soft/60">Sin imagen</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Nombre</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Torre en ruinas"
              className="w-full rounded-sm border border-rule-dark/50 bg-parchment/70 px-2 py-1 text-xs text-ink outline-none focus:border-bronze"
            />
          </label>

          <div className="flex items-end gap-2">
            {[
              { etiqueta: 'Ancho', valor: anchoCm, set: setAnchoCm },
              { etiqueta: 'Fondo', valor: altoCm, set: setAltoCm },
            ].map((eje) => (
              <label key={eje.etiqueta} className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">{eje.etiqueta}</span>
                <input
                  type="number"
                  min={2}
                  max={240}
                  value={eje.valor}
                  onChange={(e) => eje.set(Number(e.target.value) || 2)}
                  className="w-16 rounded-sm border border-rule-dark/50 bg-parchment/70 px-2 py-1 text-center text-xs text-ink tabular-nums outline-none focus:border-bronze"
                />
              </label>
            ))}
            <span className="pb-1.5 text-mini text-ink-soft/70">cm sobre la mesa</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={procesando}>
              {procesando ? 'Preparando…' : url ? 'Cambiar imagen' : 'Elegir imagen'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => elegir(e.target.files?.[0])}
            />
            {aviso && <span className="text-mini text-ink-soft/70">{aviso}</span>}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          disabled={!puedeGuardar}
          onClick={() =>
            onGuardar(
              { label, anchoCm, altoCm, imagen: imagen ? { bytes: imagen.bytes, mime: imagen.mime } : null },
              asset?.slug ?? null,
            )
          }
        >
          {esNuevo ? 'Añadir' : 'Guardar versión nueva'}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Suelos de mesa
// ---------------------------------------------------------------------------
function PanelSuelos({ onSaved }: { onSaved: () => void }) {
  const { user } = useSession()
  const { data: suelos, loading, reload } = useAsync(() => FloorAssetRepository.listVigentes())
  const [editando, setEditando] = useState<FloorAsset | 'nuevo' | null>(null)
  const [borrando, setBorrando] = useState<FloorAsset | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lista = (suelos ?? []).filter((f) => !f.retired)

  async function conAviso(accion: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await accion()
      await reload()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />

  if (editando) {
    const suelo = editando === 'nuevo' ? null : editando
    return (
      <FormularioSuelo
        suelo={suelo}
        onCancel={() => setEditando(null)}
        onGuardar={async (datos) => {
          await conAviso(async () => {
            if (suelo) await FloorAssetRepository.reemplazar(suelo.slug, datos, user?.id ?? null)
            else await FloorAssetRepository.crear(datos, user?.id ?? null)
            setEditando(null)
          })
        }}
      />
    )
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-ink-soft">{lista.length} suelos propios</span>
        <Button variant="secondary" onClick={() => setEditando('nuevo')} disabled={busy}>
          <PlusIcon className="h-4 w-4" />
          Nuevo suelo
        </Button>
      </div>

      {lista.length === 0 ? (
        <p className="text-xs text-ink-soft italic">
          Todavía no hay suelos propios. Los de fábrica (liso y hierba) siguen estando en el editor.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {lista.map((suelo) => (
            <li key={suelo.slug} className="flex items-center gap-2 rounded-sm border border-rule-dark/30 p-1.5">
              <span
                className="h-9 w-16 shrink-0 rounded-sm border border-rule-dark/30"
                style={estiloDeSueloDeMapa('ninguna', suelo, 180, 120)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-ink">{suelo.label}</span>
                <span className="block text-mini text-ink-soft/70 tabular-nums">
                  losa de {suelo.tileCm} cm · {Math.round(suelo.opacity * 100)}% · v{suelo.version}
                </span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditando(suelo)}
                aria-label={`Reemplazar ${suelo.label}`}
                title="Reemplazar por otra imagen (crea una versión nueva)"
                className="rounded-sm p-1 text-ink-soft transition-colors hover:bg-parchment-dark hover:text-ink disabled:opacity-40"
              >
                <SwapIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setBorrando(suelo)}
                aria-label={`Borrar ${suelo.label}`}
                title="Borrar de la lista de suelos"
                className="rounded-sm p-1 text-ink-soft transition-colors hover:bg-maroon/10 hover:text-danger disabled:opacity-40"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {borrando && (
        <ConfirmDialog
          title={`Borrar "${borrando.label}"`}
          message={
            'Desaparece de la lista de suelos y no se puede recuperar. Los mapas que ya lo usan no cambian: ' +
            'siguen con este suelo.'
          }
          confirmLabel="Borrar"
          onCancel={() => setBorrando(null)}
          onConfirm={() =>
            conAviso(async () => {
              await FloorAssetRepository.borrar(borrando, user?.id ?? null)
              setBorrando(null)
            })
          }
        />
      )}
    </div>
  )
}

function FormularioSuelo({
  suelo,
  onCancel,
  onGuardar,
}: {
  suelo: FloorAsset | null
  onCancel: () => void
  onGuardar: (datos: NuevoSuelo) => Promise<void>
}) {
  const [label, setLabel] = useState(suelo?.label ?? '')
  const [tileCm, setTileCm] = useState(suelo?.tileCm ?? 60)
  const [opacity, setOpacity] = useState(suelo?.opacity ?? 0.5)
  const { imagen, url, poner } = useVistaPrevia()
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // La vista previa se hace con el mismo cálculo que la mesa de verdad, sobre
  // un tablero imaginario de 180 × 120: es la única forma de elegir la losa y
  // la opacidad sabiendo cómo va a quedar.
  const previa: FloorAsset = {
    id: suelo?.id ?? 0,
    slug: suelo?.slug ?? 'previa',
    version: 0,
    label,
    imageKey: null,
    imageUrl: url ?? suelo?.imageUrl ?? null,
    tileCm,
    opacity,
    retired: false,
    createdAt: '',
  }

  async function elegir(file: File | undefined) {
    if (!file) return
    setProcesando(true)
    setError(null)
    try {
      // Un suelo se enlosa, así que aquí NO interesa quitar fondos ni recortar:
      // se comprime y punto. `prepararImagenDeEscenografia` no le vendría bien
      // (recortaría los bordes de la losa y se notaría la costura al repetirla).
      const comprimida = await compressImageFile(file, { maxSize: 640, maxBytes: 200 * 1024, keepAlpha: false })
      poner({ ...comprimida, proporcion: 1, fondoQuitado: false })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setProcesando(false)
    }
  }

  const esNuevo = suelo == null
  const puedeGuardar = label.trim().length > 0 && (imagen != null || !esNuevo) && !procesando

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-ink">
        {esNuevo ? 'Suelo nuevo' : `Reemplazar "${suelo.label}"`}
        {!esNuevo && (
          <span className="ml-1 font-normal text-ink-soft/70">· pasará a ser la versión {suelo.version + 1}</span>
        )}
      </p>

      <span
        className="block h-28 w-full rounded-sm border border-rule-dark/40"
        style={estiloDeSueloDeMapa('ninguna', previa.imageUrl ? previa : null, 180, 120)}
      />

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-soft">Nombre</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Tierra batida"
          className="w-full rounded-sm border border-rule-dark/50 bg-parchment/70 px-2 py-1 text-xs text-ink outline-none focus:border-bronze"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-medium text-ink-soft">Losa</span>
            <span className="text-xs text-ink tabular-nums">{tileCm} cm</span>
          </span>
          <input
            type="range"
            min={10}
            max={180}
            step={5}
            value={tileCm}
            onChange={(e) => setTileCm(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-rule-dark/30 accent-maroon"
          />
        </label>
        <label className="block">
          <span className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-medium text-ink-soft">Cuánto se ve</span>
            <span className="text-xs text-ink tabular-nums">{Math.round(opacity * 100)}%</span>
          </span>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={Math.round(opacity * 100)}
            onChange={(e) => setOpacity(Number(e.target.value) / 100)}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-rule-dark/30 accent-maroon"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={procesando}>
          {procesando ? 'Preparando…' : url ? 'Cambiar imagen' : 'Elegir imagen'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => elegir(e.target.files?.[0])}
        />
        <span className="text-mini text-ink-soft/70">Se repite por toda la mesa; mejor una textura sin bordes.</span>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          disabled={!puedeGuardar}
          onClick={() =>
            onGuardar({
              label,
              tileCm,
              opacity,
              imagen: imagen ? { bytes: imagen.bytes, mime: imagen.mime } : null,
            })
          }
        >
          {esNuevo ? 'Añadir' : 'Guardar versión nueva'}
        </Button>
      </div>
    </div>
  )
}
