// ============================================================================
// El diseñador de emblemas: figura, contorno, campo y colores.
//
// TODO SE VE MIENTRAS SE ELIGE. El emblema grande se repinta en cada clic —es
// SVG, no cuesta nada— y las miniaturas del catálogo se pintan con los colores
// que están puestos en ese momento, no con unos de muestra. Elegir a ciegas y
// descubrir el resultado al guardar es justo lo que no queremos: un emblema es
// una decisión estética y las decisiones estéticas se toman mirando.
//
// 120 FIGURAS NO CABEN EN UNA REJILLA A PELO. Van agrupadas —bestias, armas,
// calaveras, torres, símbolos, naturaleza— con un buscador al lado, porque
// cuando uno viene a por "un dragón" quiere escribir "dragón", y cuando viene a
// mirar quiere pasear por una categoría. La rejilla tiene su propio scroll para
// que los colores y el contorno no se vayan de la pantalla mientras se busca.
//
// SUBIR, SOLO AL GUARDAR. Mientras se diseña no se toca la red (salvo el
// catálogo de figuras, que se pide una vez). Al aceptar, el SVG se convierte en
// imagen de 480 px y se sube, y a partir de ahí es un emblema normal y
// corriente (ver domain/emblemaDeEjercito).
// ============================================================================
import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import {
  CONTORNOS,
  PALETA_FIGURA,
  PALETA_FONDO,
  PARTICIONES,
  urlDeEmblema,
  urlDeMuestraDeMueble,
  type DisenoDeEmblema,
} from '@/domain/emblemaDeEjercito'
import { GRUPOS_DE_FIGURAS } from '@/domain/emblemaFiguras'
import { useFigurasDeEmblema } from '@/shared/hooks/useFigurasDeEmblema'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'

/** Rótulo de sección: versalita fina con su filete, como el resto del programa. */
function Rotulo({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span className="text-micro font-semibold tracking-[0.18em] text-ink-soft uppercase">{children}</span>
      <span aria-hidden className="h-px flex-1 bg-rule-dark/25" />
      {extra}
    </div>
  )
}

function Muestra({
  activa,
  onClick,
  title,
  children,
  className,
}: {
  activa: boolean
  onClick: () => void
  title: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={activa}
      onClick={onClick}
      className={clsx(
        'relative overflow-hidden rounded-sm transition-shadow',
        activa
          ? 'shadow-[0_0_0_2px_var(--color-maroon)]'
          : 'shadow-[0_0_0_1px_rgba(138,113,63,.45)] hover:shadow-[0_0_0_2px_var(--color-bronze)]',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Quita tildes y baja a minúsculas: buscar "aguila" tiene que encontrar "Águila". */
function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function EmblemaDesignerModal({
  inicial,
  onCancel,
  onAceptar,
  guardando,
}: {
  inicial: DisenoDeEmblema
  onCancel: () => void
  /** Devuelve el diseño elegido; quien llama se encarga de subirlo. */
  onAceptar: (d: DisenoDeEmblema) => void
  guardando: boolean
}) {
  const [d, setD] = useState<DisenoDeEmblema>(inicial)
  const cambiar = (parche: Partial<DisenoDeEmblema>) => setD((v) => ({ ...v, ...parche }))
  const figuras = useFigurasDeEmblema()
  const [grupo, setGrupo] = useState<string>('todas')
  const [busca, setBusca] = useState('')

  /**
   * Las figuras que se enseñan ahora. El buscador MANDA sobre el grupo: quien
   * escribe "dragón" quiere todos los dragones, no los dragones de la pestaña
   * en la que estaba.
   */
  const visibles = useMemo(() => {
    const todas = Object.entries(figuras ?? {})
    const q = normalizar(busca.trim())
    if (q) return todas.filter(([clave, f]) => normalizar(f.n).includes(q) || clave.includes(q))
    if (grupo === 'todas') return todas
    return todas.filter(([, f]) => f.g === grupo)
  }, [figuras, grupo, busca])

  return (
    <Modal
      title="Emblema del ejército"
      onClose={onCancel}
      widthClassName="max-w-4xl"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => onAceptar(d)} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Usar este emblema'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 sm:flex-row">
        {/* ---------- El emblema, en grande ---------- */}
        <div className="shrink-0 sm:w-44">
          <span className="relative block aspect-square w-40 overflow-hidden rounded-sm sm:w-44">
            <img src={urlDeEmblema(d, figuras)} alt="" className="h-full w-full object-contain" />
          </span>
          {/* A 40 px es como sale en el listado de Ejércitos: si ahí no se
              reconoce, no sirve por bonito que quede en grande. */}
          <div className="mt-2 flex items-center gap-2">
            <img src={urlDeEmblema(d, figuras)} alt="" className="h-10 w-10" />
            <span className="text-micro leading-tight text-ink-soft/70">
              Así se verá
              <br />
              en el listado
            </span>
          </div>

          {/* El CONTORNO va aquí, pegado a la vista grande: es lo que decide la
              silueta del emblema entero, así que se elige mirándola. */}
          <div className="mt-4">
            <Rotulo>Contorno</Rotulo>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(CONTORNOS).map(([clave, c]) => (
                <Muestra
                  key={clave}
                  activa={d.contorno === clave}
                  onClick={() => cambiar({ contorno: clave })}
                  title={c.nombre}
                  className="h-11 w-11 bg-parchment-dark/40"
                >
                  <img src={urlDeEmblema({ ...d, contorno: clave }, figuras)} alt="" className="h-full w-full" />
                </Muestra>
              ))}
            </div>
          </div>
        </div>

        {/* ---------- Los mandos ---------- */}
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <Rotulo
              extra={
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar figura…"
                  aria-label="Buscar figura"
                  className="w-32 rounded-sm border border-rule-dark/40 bg-parchment/70 px-2 py-0.5 text-xs text-ink placeholder:text-ink-soft/50 focus:border-bronze focus:outline-none"
                />
              }
            >
              Figura
            </Rotulo>

            {/* Los grupos se apagan mientras se busca: el buscador ya manda. */}
            <div className={clsx('mb-2 flex flex-wrap gap-1', busca.trim() && 'pointer-events-none opacity-40')}>
              {[{ clave: 'todas', nombre: 'Todas' }, ...GRUPOS_DE_FIGURAS].map((g) => (
                <button
                  key={g.clave}
                  type="button"
                  onClick={() => setGrupo(g.clave)}
                  className={clsx(
                    'rounded-sm px-2 py-0.5 text-micro font-semibold tracking-wide transition-colors',
                    grupo === g.clave && !busca.trim()
                      ? 'bg-maroon/15 text-maroon'
                      : 'text-ink-soft hover:bg-bronze/15 hover:text-ink',
                  )}
                >
                  {g.nombre}
                </button>
              ))}
            </div>

            {figuras == null ? (
              <div className="flex h-40 items-center justify-center rounded-sm border border-rule-dark/25 bg-parchment/40">
                <Spinner />
              </div>
            ) : visibles.length === 0 ? (
              <p className="rounded-sm border border-rule-dark/25 bg-parchment/40 px-3 py-6 text-center text-xs text-ink-soft italic">
                Ninguna figura se llama así.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-sm border border-rule-dark/25 bg-parchment/40 p-1.5">
                <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10">
                  {visibles.map(([clave, f]) => (
                    <Muestra
                      key={clave}
                      activa={d.mueble === clave}
                      onClick={() => cambiar({ mueble: clave })}
                      title={f.n}
                      className="aspect-square w-full"
                    >
                      <img
                        src={urlDeMuestraDeMueble(clave, d.fondo, d.figura, figuras)}
                        alt=""
                        loading="lazy"
                        className="h-full w-full"
                      />
                    </Muestra>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <Rotulo>Campo</Rotulo>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(PARTICIONES).map(([clave, nombre]) => (
                <Muestra
                  key={clave}
                  activa={d.particion === clave}
                  onClick={() => cambiar({ particion: clave })}
                  title={nombre}
                  className="h-11 w-11"
                >
                  {/* Sin figura y en cuadrado: lo que se elige aquí es el campo,
                      y con el dragón encima delante no se ve la partición. */}
                  <img
                    src={urlDeEmblema({ ...d, particion: clave, mueble: '', contorno: 'cuadrado' }, figuras)}
                    alt=""
                    className="h-full w-full"
                  />
                </Muestra>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Rotulo>Color del campo</Rotulo>
              <div className="flex flex-wrap gap-1.5">
                {PALETA_FONDO.map((c) => (
                  <Muestra
                    key={c.color}
                    activa={d.fondo.toLowerCase() === c.color.toLowerCase()}
                    onClick={() => cambiar({ fondo: c.color })}
                    title={c.nombre}
                    className="h-7 w-7"
                  >
                    <span className="block h-full w-full" style={{ backgroundColor: c.color }} />
                  </Muestra>
                ))}
                {/* Cualquier otro color: el de la facción no tiene por qué estar
                    en la paleta, y una lista cerrada obligaría a conformarse. */}
                <label
                  className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-sm shadow-[0_0_0_1px_rgba(138,113,63,.45)]"
                  title="Otro color"
                >
                  <span
                    className="block h-full w-full"
                    style={{
                      backgroundImage: 'conic-gradient(#8c2f2f,#c9a227,#3f7a45,#2f5d8c,#5a3a63,#8c2f2f)',
                    }}
                  />
                  <input
                    type="color"
                    value={d.fondo}
                    onChange={(e) => cambiar({ fondo: e.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>

            <div>
              <Rotulo>Color de la figura</Rotulo>
              <div className="flex flex-wrap gap-1.5">
                {PALETA_FIGURA.map((c) => (
                  <Muestra
                    key={c.color}
                    activa={d.figura.toLowerCase() === c.color.toLowerCase()}
                    onClick={() => cambiar({ figura: c.color })}
                    title={c.nombre}
                    className="h-7 w-7"
                  >
                    <span className="block h-full w-full" style={{ backgroundColor: c.color }} />
                  </Muestra>
                ))}
                <label
                  className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-sm shadow-[0_0_0_1px_rgba(138,113,63,.45)]"
                  title="Otro color"
                >
                  <span
                    className="block h-full w-full"
                    style={{ backgroundImage: 'conic-gradient(#f6efdc,#e8c565,#a83a34,#2b2013,#d8dde2,#f6efdc)' }}
                  />
                  <input
                    type="color"
                    value={d.figura}
                    onChange={(e) => cambiar({ figura: e.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
