// ============================================================================
// Piezas heráldicas de la pantalla de Batalla: la cartela de enfrentamiento,
// la balanza de puntos y los estandartes de los dos bordes de la mesa.
//
// Viven aparte de BattlePage porque allí lo que manda es la GEOMETRÍA —girar un
// bando, convertir centímetros en porcentajes, pintar el lienzo del PDF— y
// mezclarlo con el adorno dejaba un archivo donde no se encontraba ni una cosa
// ni la otra.
//
// TODO LO QUE SE DIBUJA AQUÍ ES UN DATO. La cartela enseña las dos facciones
// con su emblema, sus unidades y sus puntos; la balanza dice de un vistazo si
// la partida está igualada y por cuánto; el estandarte dice quién despliega en
// qué borde y avisa si un bando llegó sin desplegar. Nada de esto es relleno:
// es lo que uno mira antes de empezar a jugar.
// ============================================================================
import { clsx } from 'clsx'
import { FactionEmblem } from '@/shared/ui/FactionEmblem'
import type { Faction } from '@/domain/types'

/** Lo que la heráldica necesita de un bando. Menos que el `Bando` de la mesa. */
export interface BandoHeraldico {
  nombreLista: string
  faccion: Pick<Faction, 'name' | 'emblemUrl'>
  color: string
  puntos: number
  unidades: number
  enMesa: number
}

/**
 * Dos espadas cruzadas, dibujadas aquí y no tomadas de `icons.tsx` porque las
 * de allí son imágenes PNG (los iconos de mando): sobre el granate de la
 * cartela hay que teñir el símbolo del color del papel, y un PNG no se tiñe.
 */
export function EspadasCruzadas({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 17 19 5" />
      <path d="M4.8 15.8 8.2 19.2" />
      <circle cx="5.4" cy="19.6" r="1" fill="currentColor" stroke="none" />
      <path d="M17 17 5 5" />
      <path d="M19.2 15.8 15.8 19.2" />
      <circle cx="18.6" cy="19.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Cuadradito del color de la facción, el mismo que llevan sus peanas. */
export function Divisa({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx('inline-block h-3 w-3 shrink-0 rounded-[1px] border border-ink/50', className)}
      style={{ backgroundColor: color }}
    />
  )
}

/** Un lado de la cartela: emblema, facción, lista y recuento. */
function LadoDeCartela({ bando, derecha }: { bando: BandoHeraldico; derecha: boolean }) {
  return (
    <div className={clsx('flex min-w-0 items-center gap-3 sm:gap-4', derecha && 'flex-row-reverse text-right')}>
      <FactionEmblem faction={bando.faccion} size="lg" className="hidden shrink-0 sm:block" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-xl leading-tight font-bold text-maroon sm:text-2xl">
          {bando.faccion.name}
        </p>
        <p className="truncate text-sm leading-snug text-ink">{bando.nombreLista}</p>
        <p className={clsx('mt-1.5 flex items-center gap-1.5 text-mini text-ink-soft', derecha && 'flex-row-reverse')}>
          <Divisa color={bando.color} />
          <span className="truncate">
            {bando.unidades} {bando.unidades === 1 ? 'unidad' : 'unidades'}
            <span className="text-ink-soft/60"> · </span>
            {bando.enMesa > 0 ? `${bando.enMesa} en la mesa` : 'sin desplegar'}
          </span>
        </p>
      </div>
    </div>
  )
}

/**
 * La balanza: una barra partida en dos por los puntos de cada bando, con el
 * fiel clavado en la mitad exacta.
 *
 * Es la pieza que más dice de toda la cabecera. "1500 contra 1480" en dos
 * cifras sueltas hay que restarlo mentalmente; aquí se ve solo, porque lo que
 * se compara no son los números sino cuánto se desplaza el color respecto al
 * fiel. Con los dos ejércitos al mismo coste —lo normal— la barra queda
 * perfectamente partida, y eso también es información: nadie tiene ventaja.
 */
export function BalanzaDePuntos({ a, b }: { a: BandoHeraldico; b: BandoHeraldico }) {
  const total = a.puntos + b.puntos
  const pctA = total > 0 ? (a.puntos / total) * 100 : 50
  const diferencia = Math.abs(a.puntos - b.puntos)
  const ventaja = diferencia === 0 ? null : a.puntos > b.puntos ? a : b

  return (
    <div className="border-t border-rule-dark/25 bg-parchment/40 px-4 py-2.5 sm:px-6">
      <div className="mx-auto flex max-w-4xl items-center gap-3">
        <span className="w-16 shrink-0 font-display text-lg leading-none tabular-nums text-ink">{a.puntos}</span>

        <div className="relative h-2.5 flex-1 overflow-hidden rounded-full border border-ink/25 bg-parchment-dark/60">
          <div
            className="wh-balanza absolute inset-y-0 left-0"
            style={{ width: `${pctA}%`, backgroundColor: a.color, ['--wh-origen' as string]: 'left' }}
          />
          <div
            className="wh-balanza absolute inset-y-0 right-0"
            style={{ width: `${100 - pctA}%`, backgroundColor: b.color, ['--wh-origen' as string]: 'right' }}
          />
        </div>

        <span className="w-16 shrink-0 text-right font-display text-lg leading-none tabular-nums text-ink">
          {b.puntos}
        </span>
      </div>

      {/* El fiel va DEBAJO y no encima de la barra: cruzarla con una línea
          partía los dos colores y parecía un tercer tramo. Y en su propia
          fila, no superpuesto al texto, que es donde se le cruzaba encima. */}
      <div className="mx-auto max-w-4xl">
        <div className="relative h-2">
          <span aria-hidden className="absolute top-0 left-1/2 h-2 w-px -translate-x-1/2 bg-ink/45" />
        </div>
        <p className="mt-0.5 text-center text-micro tracking-wide text-ink-soft">
          {ventaja == null ? (
            <span className="text-success">Fuerzas igualadas</span>
          ) : (
            <>
              <b className="font-semibold text-ink">{ventaja.faccion.name}</b> aventaja en{' '}
              <b className="font-semibold text-ink tabular-nums">{diferencia}</b> pts
            </>
          )}
        </p>
      </div>
    </div>
  )
}

/**
 * La cartela: el cartel del enfrentamiento. Nombre de la batalla arriba, los
 * dos bandos enfrentados a izquierda y derecha con las espadas cruzadas en
 * medio, y la balanza cerrando abajo.
 *
 * El doble filete (borde + `outline` desplazado) y las escuadras de las
 * esquinas son los mismos que llevan las láminas de los Personajes de
 * Renombre: es el lenguaje de "documento enmarcado" del programa, y una
 * batalla es justamente eso, un acta.
 */
export function CartelaDeEnfrentamiento({
  titulo,
  a,
  b,
  medidas,
  mapa,
}: {
  titulo: string
  a: BandoHeraldico
  b: BandoHeraldico
  /** "180 × 120 cm". */
  medidas: string
  /** Nombre del mapa, o de qué se está usando en su lugar. */
  mapa: string
}) {
  return (
    <section className="wh-surgir relative mb-4 rounded-sm border border-rule-dark/45 bg-parchment-dark/40 outline outline-1 outline-offset-[3px] outline-rule-dark/25">
      {/* Halo central: separa la cartela del pergamino del fondo sin meter otra
          caja de color plano. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-sm"
        style={{
          backgroundImage: 'radial-gradient(120% 100% at 50% 0%, rgba(246,239,220,.75) 0%, rgba(246,239,220,0) 60%)',
        }}
      />
      <Escuadras />

      <div className="relative px-4 pt-4 sm:px-6">
        <p className="text-center text-micro font-semibold tracking-[0.4em] text-ink-soft/70 uppercase">Batalla</p>
        <h1 className="mt-1 text-center font-display text-3xl leading-none font-bold text-ink sm:text-4xl">{titulo}</h1>
        <div aria-hidden className="mx-auto mt-3 mb-4 flex max-w-md items-center gap-2">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-rule-dark/50" />
          <span className="h-1.5 w-1.5 rotate-45 bg-bronze/70" />
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-rule-dark/50" />
        </div>

        {/* Ancho contenido a propósito: con la pantalla muy ancha, los dos
            bandos se iban a los extremos y el enfrentamiento dejaba de leerse
            como tal. Un cartel de combate junta a los dos contendientes. */}
        <div className="mx-auto grid max-w-4xl grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6">
          <LadoDeCartela bando={a} derecha={false} />

          {/* El centro: las espadas y, debajo, DÓNDE se juega. Ese dato tenía
              que estar en algún sitio y aquí hace doble trabajo — cierra la
              columna del medio, que con solo el rombo quedaba hueca. */}
          <div className="flex w-28 flex-col items-center gap-2 sm:w-36">
            <span className="flex h-11 w-11 rotate-45 items-center justify-center rounded-[3px] border border-rule-dark/50 bg-maroon shadow-[0_2px_6px_rgba(43,32,19,.35)] sm:h-12 sm:w-12">
              <EspadasCruzadas className="h-5 w-5 -rotate-45 text-parchment/95 sm:h-6 sm:w-6" />
            </span>
            <span className="text-center text-mini leading-tight font-semibold text-ink-soft tabular-nums">
              {medidas}
            </span>
            <span className="line-clamp-2 text-center text-micro leading-tight text-ink-soft/70">{mapa}</span>
          </div>

          <LadoDeCartela bando={b} derecha />
        </div>

        <div aria-hidden className="h-4" />
      </div>

      <BalanzaDePuntos a={a} b={b} />
    </section>
  )
}

/** Las cuatro escuadras de esquina. Decoración, pero la del propio programa. */
export function Escuadras({ className = 'text-bronze/50' }: { className?: string }) {
  const comun = 'pointer-events-none absolute h-3.5 w-3.5 border-current'
  return (
    <span aria-hidden className={className}>
      <span className={clsx(comun, 'top-1 left-1 border-t border-l')} />
      <span className={clsx(comun, 'top-1 right-1 border-t border-r')} />
      <span className={clsx(comun, 'bottom-1 left-1 border-b border-l')} />
      <span className={clsx(comun, 'right-1 bottom-1 border-r border-b')} />
    </span>
  )
}

/**
 * El estandarte de un borde de la mesa: quién despliega ahí.
 *
 * Va pegado al canto de la mesa, con el color de la facción a todo lo alto por
 * el lado de fuera, para que se lea como "esta franja es suya" y no como un pie
 * de foto. Si ese bando no tiene despliegue, lo dice aquí mismo: es la
 * explicación de por qué media mesa está vacía, y hay que darla donde se mira.
 */
export function EstandarteDeBando({ bando, posicion }: { bando: BandoHeraldico; posicion: 'arriba' | 'abajo' }) {
  const arriba = posicion === 'arriba'
  return (
    <div
      className={clsx(
        'flex items-stretch bg-parchment/75',
        arriba ? 'border-b border-ink/25' : 'border-t border-ink/25',
      )}
    >
      <span aria-hidden className="w-2 shrink-0" style={{ backgroundColor: bando.color }} />
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5 px-3 py-1.5">
        <span className="truncate font-display text-base leading-tight font-semibold text-ink">
          {bando.nombreLista}
        </span>
        <span className="truncate text-xs text-ink-soft">{bando.faccion.name}</span>
        <span className="text-mini tabular-nums text-ink-soft/70">{bando.puntos} pts</span>
        {bando.enMesa === 0 && (
          <span className="rounded-sm border border-danger/40 bg-danger/10 px-1.5 text-micro font-semibold text-danger">
            Sin despliegue
          </span>
        )}
        <span aria-hidden className="h-px min-w-6 flex-1 self-center bg-rule-dark/25" />
        <span className="shrink-0 text-micro font-semibold tracking-[0.2em] text-ink-soft/60 uppercase">
          {arriba ? 'Despliega arriba' : 'Despliega abajo'}
        </span>
      </div>
    </div>
  )
}
