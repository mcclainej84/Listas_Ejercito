// ============================================================================
// El diseñador de emblemas: figura, campo y colores, con el escudo delante.
//
// TODO SE VE MIENTRAS SE ELIGE. El escudo grande se repinta en cada clic —es
// SVG, no cuesta nada— y las miniaturas del catálogo se pintan con los colores
// que están puestos en ese momento, no con unos de muestra. Elegir a ciegas y
// descubrir el resultado al guardar es justo lo que no queremos: un emblema es
// una decisión estética y las decisiones estéticas se toman mirando.
//
// SUBIR, SOLO AL GUARDAR. Mientras se diseña no se toca la red. Al aceptar, el
// SVG se convierte en imagen de 480 px y se sube, y a partir de ahí es un
// emblema normal y corriente (ver domain/emblemaDeEjercito).
// ============================================================================
import { useState } from 'react'
import { clsx } from 'clsx'
import {
  MUEBLES,
  PALETA_FIGURA,
  PALETA_FONDO,
  PARTICIONES,
  urlDeEmblema,
  urlDeMuestraDeMueble,
  type DisenoDeEmblema,
} from '@/domain/emblemaDeEjercito'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'

/** Rótulo de sección: versalita fina con su filete, como el resto del programa. */
function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span className="text-micro font-semibold tracking-[0.18em] text-ink-soft uppercase">{children}</span>
      <span aria-hidden className="h-px flex-1 bg-rule-dark/25" />
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

  return (
    <Modal
      title="Emblema del ejército"
      onClose={onCancel}
      widthClassName="max-w-3xl"
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
        {/* ---------- El escudo, en grande ---------- */}
        <div className="shrink-0 sm:w-44">
          <span className="relative block aspect-square w-40 overflow-hidden rounded-sm shadow-md shadow-black/25 sm:w-44">
            <img src={urlDeEmblema(d)} alt="" className="h-full w-full object-cover" />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-sm"
              style={{ boxShadow: 'inset 0 0 12px rgba(20,14,6,0.35)' }}
            />
          </span>
          {/* A 40 px es como sale en el listado de Ejércitos: si ahí no se
              reconoce, no sirve por bonito que quede en grande. */}
          <div className="mt-2 flex items-center gap-2">
            <img src={urlDeEmblema(d)} alt="" className="h-10 w-10 rounded-sm shadow-sm shadow-black/25" />
            <span className="text-micro leading-tight text-ink-soft/70">
              Así se verá
              <br />
              en el listado
            </span>
          </div>
        </div>

        {/* ---------- Los mandos ---------- */}
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <Rotulo>Figura</Rotulo>
            <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10">
              {Object.entries(MUEBLES).map(([clave, m]) => (
                <Muestra
                  key={clave}
                  activa={d.mueble === clave}
                  onClick={() => cambiar({ mueble: clave })}
                  title={m.nombre}
                  className="aspect-square w-full"
                >
                  <img src={urlDeMuestraDeMueble(clave, d.fondo, d.figura)} alt="" className="h-full w-full" />
                </Muestra>
              ))}
            </div>
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
                  className="h-12 w-12"
                >
                  <img
                    src={urlDeEmblema({ ...d, particion: clave, mueble: 'ninguno', conEscudo: false })}
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
              </div>

              <label className="mt-3 flex items-start gap-2 text-xs text-ink">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-maroon"
                  checked={d.conEscudo}
                  onChange={(e) => cambiar({ conEscudo: e.target.checked })}
                />
                <span>
                  Contorno de escudo
                  <span className="mt-0.5 block text-micro text-ink-soft">
                    Enmarca la figura. Sin él, la figura va suelta sobre el campo.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
