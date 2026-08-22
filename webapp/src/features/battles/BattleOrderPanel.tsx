// ============================================================================
// El orden de batalla de un bando: su lista entera, de solo lectura, agrupada
// por categoría.
//
// POR QUÉ AGRUPADA Y NO EN UNA TIRA SEGUIDA. La lista guarda su propio orden y
// el constructor lo respeta, pero al mirar un ejército enemigo lo que se
// pregunta no es "¿qué puso primero?" sino "¿cuántos personajes trae?, ¿cuántas
// cosas ha metido en Singulares?". El recuento por categoría contesta eso sin
// que nadie tenga que ir contando.
//
// AQUÍ NO HAY PUNTOS POR UNIDAD. Solo el total del ejército, arriba. No es por
// ahorrar espacio: en esta pantalla hay unidades OCULTAS que no se enseñan (ver
// ArmyListEntry.hidden) y el total sí las cuenta, así que detallar el coste de
// cada línea convertía el escondite en una resta. Quien quiera el desglose lo
// tiene en su propia lista, en la sección de Ejércitos, que es donde además
// puede hacer algo con él.
//
// LA INICIAL ES EL PUENTE CON LA MESA. Cada fila desplegada lleva su marca en
// el color de su facción, idéntica a la peana que le corresponde arriba; pasar
// el ratón por una enciende la otra, en los dos sentidos. Las que no están
// desplegadas llevan la marca hueca: se ven, cuentan puntos, pero no están
// sobre el tablero.
// ============================================================================
import { clsx } from 'clsx'
import { categoryInsertRank } from '@/domain/armyValidation'
import { estiloDePeana } from '@/domain/factionColor'
import { categoryShieldMetal } from '@/features/army-lists/categoryShield'
import { EntryDetailCard } from '@/features/army-lists/EntryDetailCard'
import { FactionEmblem } from '@/shared/ui/FactionEmblem'
import { CategoryShield, EyeOffIcon, NameTagIcon, type ShieldMetal } from '@/shared/ui/icons'
import type { ArmyListDetail, ArmyListEntry } from '@/domain/types'

interface GrupoDeCategoria {
  clave: string
  titulo: string
  metal: ShieldMetal | null
  entradas: ArmyListEntry[]
}

/**
 * Agrupa por categoría respetando el orden del organigrama (Personajes,
 * Básicas, Especiales, Singulares, y lo demás al final) y, dentro de cada
 * grupo, el orden que tenga la lista.
 */
function agruparPorCategoria(entradas: ArmyListEntry[]): GrupoDeCategoria[] {
  const grupos = new Map<string, GrupoDeCategoria>()
  for (const entrada of entradas) {
    const categoria = entrada.unit.category
    const clave = categoria?.code ?? '__SIN__'
    let grupo = grupos.get(clave)
    if (!grupo) {
      grupo = {
        clave,
        titulo: categoria?.name ?? 'Sin categoría',
        metal: categoryShieldMetal(categoria?.code),
        entradas: [],
      }
      grupos.set(clave, grupo)
    }
    grupo.entradas.push(entrada)
  }
  return [...grupos.values()].sort((x, y) => categoryInsertRank(x.clave) - categoryInsertRank(y.clave))
}

/**
 * La marca de la unidad: la MISMA PEANA que hay sobre la mesa, en pequeño.
 *
 * Dos decisiones, y las dos vienen de haberlas hecho mal antes:
 *
 *   · EL COLOR ES EL DE LA UNIDAD, no el de la lista. Sobre la mesa cada peana
 *     se pinta con el color de la facción de SU unidad, así que pintar aquí el
 *     de la lista dejaba las marcas de un color y las peanas de otro en cuanto
 *     un ejército llevaba aliados. Una referencia que no coincide con lo que
 *     señala no es una referencia. Y va con `estiloDePeana`, la misma pintura
 *     desgastada: un plano liso al lado de la mesa tampoco se reconoce.
 *
 *   · EL ANCHO ES ELÁSTICO. Las referencias no son una letra: son el alias de
 *     la unidad y, si se repite, su número — "GS1", "CDR2". En un cuadrado fijo
 *     de 28 px eso se salía por los lados. Alto fijo para que la columna no
 *     baile, ancho mínimo para que las cortas no queden ridículas, y que crezca
 *     lo que haga falta.
 */
function MarcaDeUnidad({ ref_, color, resaltada }: { ref_: string | null; color: string | null; resaltada: boolean }) {
  if (ref_ == null) {
    return (
      <span
        className="inline-flex h-6 min-w-8 items-center justify-center rounded-[2px] border border-dashed border-rule-dark/45 px-1 text-micro text-ink-soft/40"
        title="No está desplegada sobre la mesa"
      >
        —
      </span>
    )
  }
  return (
    <span
      className={clsx(
        'inline-flex h-6 min-w-8 items-center justify-center overflow-hidden rounded-[2px] border px-1 text-micro leading-none font-bold tracking-tight transition-shadow',
        resaltada ? 'border-ink shadow-[0_0_0_2px_var(--color-maroon)]' : 'border-ink/60',
      )}
      style={estiloDePeana(color)}
    >
      {ref_}
    </span>
  )
}

export interface BattleOrderPanelProps {
  lista: ArmyListDetail
  /** El emblema del EJÉRCITO, ya resuelto (ver domain/armyEmblem). */
  emblemUrl: string | null
  color: string
  puntos: number
  /** Iniciales por entrada; sin entrada aquí = no está desplegada. */
  refPorEntrada: Map<number, string>
  /** Entrada sobre la que está el ratón, sea desde aquí o desde la mesa. */
  encima: number | null
  onEncima: (id: number | null) => void
  /**
   * Hacia dónde se abre la ficha emergente. Con los dos órdenes de batalla a
   * los lados de la mesa, la ficha es más ancha que su panel: la del panel
   * izquierdo tiene que crecer hacia la derecha (sobre la mesa) y la del
   * derecho hacia la izquierda. Al revés, se saldría de la pantalla.
   */
  ladoDeLaFicha?: 'izquierda' | 'derecha'
  /**
   * Cuántas unidades de ESTE ejército están ocultas — y solo se pasa distinto de
   * cero cuando el ejército es de quien está mirando.
   *
   * Es un recordatorio para su dueño: sin él, la única forma de comprobar que lo
   * que escondiste sigue escondido era acordarte de cuántas unidades tenías. Al
   * rival no se le dice ni el número: saber que le faltan tres por ver es la
   * mitad de lo que la unidad oculta le está negando.
   */
  ocultasPropias?: number
}

export function BattleOrderPanel({
  lista,
  emblemUrl,
  color,
  puntos,
  refPorEntrada,
  encima,
  onEncima,
  ladoDeLaFicha = 'derecha',
  ocultasPropias = 0,
}: BattleOrderPanelProps) {
  const entradas = [...lista.entries].sort((a, b) => a.sortOrder - b.sortOrder)
  const grupos = agruparPorCategoria(entradas)
  const enMesa = entradas.filter((e) => refPorEntrada.has(e.id)).length

  // Posición de cada fila dentro del panel ya agrupado, para saber cuáles están
  // al final: en esas, la ficha se despliega HACIA ARRIBA. Abriéndose siempre
  // hacia abajo, las últimas unidades —justo las que hay que mirar cuando ya
  // has recorrido la lista— sacaban la ficha fuera de la pantalla.
  const orden = grupos.flatMap((g) => g.entradas)
  const posicionDeFila = new Map(orden.map((e, i) => [e.id, i]))
  const ULTIMAS = 4

  return (
    <section className="relative rounded-sm border border-rule-dark/40 bg-parchment/70">
      {/* Cabecera: el color de la facción a todo lo ancho por arriba, para que
          el panel se identifique con su bando desde el otro lado de la pantalla. */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 rounded-t-sm" style={{ backgroundColor: color }} />

      <header className="flex items-center gap-2.5 border-b border-rule-dark/25 px-3 pt-3 pb-2.5">
        <FactionEmblem faction={{ name: lista.faction.name, emblemUrl }} size="sm" />
        {/* TRES LÍNEAS y no dos. Con el panel al costado de la mesa la columna
            es estrecha, y meter facción y recuentos en el mismo renglón acababa
            en "Bretonia · 18 unidades · 14 en la…", que es peor que no decirlo:
            el dato que se corta es justo el que se venía a mirar. */}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-base leading-tight font-semibold text-ink">{lista.name}</h2>
          <p className="truncate text-mini leading-snug text-ink-soft">{lista.faction.name}</p>
          <p className="truncate text-micro leading-snug text-ink-soft/70">
            {entradas.length} {entradas.length === 1 ? 'unidad' : 'unidades'}
            <span className="text-ink-soft/45"> · </span>
            {enMesa} en la mesa
          </p>
        </div>
        <span className="shrink-0 font-display text-lg leading-none text-maroon tabular-nums">{puntos}</span>
        <span className="-ml-1.5 shrink-0 self-end pb-0.5 text-micro text-ink-soft">pts</span>
      </header>

      <div className="px-3 pt-1 pb-2.5">
        {grupos.map((grupo) => (
          <div key={grupo.clave} className="mt-3 first:mt-1">
            <div className="flex items-center gap-2">
              {grupo.metal ? (
                <CategoryShield metal={grupo.metal} className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <span aria-hidden className="h-1 w-1 shrink-0 rotate-45 bg-rule-dark/50" />
              )}
              <span className="text-micro font-semibold tracking-[0.18em] text-ink-soft uppercase">{grupo.titulo}</span>
              <span className="text-micro text-ink-soft/55 tabular-nums">{grupo.entradas.length}</span>
              <span aria-hidden className="h-px flex-1 bg-rule-dark/20" />
            </div>

            <ul className="mt-1">
              {grupo.entradas.map((entry) => {
                const marca = refPorEntrada.get(entry.id) ?? null
                const resaltada = encima === entry.id
                return (
                  <li
                    key={entry.id}
                    onPointerEnter={() => onEncima(entry.id)}
                    onPointerLeave={() => onEncima(null)}
                    className={clsx(
                      'relative -mx-1.5 flex items-center gap-2 rounded-sm px-1.5 py-0.5 transition-colors',
                      resaltada ? 'bg-bronze/15' : 'hover:bg-bronze/8',
                    )}
                  >
                    {/* Celda de ancho fijo: la marca crece con su texto, pero
                        los nombres tienen que seguir alineados entre filas. */}
                    <span className="flex w-12 shrink-0 justify-start">
                      <MarcaDeUnidad ref_={marca} color={entry.unit.faction.color} resaltada={resaltada} />
                    </span>

                    <span
                      className={clsx(
                        'min-w-0 flex-1 truncate text-xs',
                        marca ? 'text-ink' : 'text-ink-soft/70 italic',
                      )}
                    >
                      {entry.unit.isSpecialCharacter && (
                        <NameTagIcon className="mr-1 inline-block h-3 w-3 -translate-y-px text-bronze" />
                      )}
                      {entry.alias ?? entry.unit.name}
                      {entry.quantity > 1 && <span className="text-ink-soft"> ×{entry.quantity}</span>}
                    </span>

                    {resaltada && (
                      // LA FICHA LLEVA SU PROPIA CAJA, y esto no es adorno: sin
                      // fondo ni marco se veía el pergamino y la fila de debajo
                      // a través del texto, que es lo que la hacía parecer
                      // translúcida. Ancho fijo y holgado —no "lo que ocupe"—
                      // para que el nombre de la unidad no salga apretado en un
                      // recuadro del tamaño justo.
                      <div
                        className={clsx(
                          'pointer-events-none absolute z-50 w-[23rem] max-w-[calc(100vw-3rem)]',
                          ladoDeLaFicha === 'izquierda' ? 'left-0' : 'right-0',
                          (posicionDeFila.get(entry.id) ?? 0) >= orden.length - ULTIMAS
                            ? 'bottom-full pb-1.5'
                            : 'top-full pt-1.5',
                        )}
                      >
                        <div className="overflow-hidden rounded-sm border border-rule-dark/55 bg-parchment shadow-lg shadow-black/30">
                          <EntryDetailCard entry={entry} />
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {ocultasPropias > 0 && (
          <p
            className="mt-3 flex items-center gap-1.5 border-t border-dashed border-rule-dark/30 pt-2 text-micro text-ink-soft/70"
            title="Solo tú ves este aviso: es tu ejército."
          >
            <EyeOffIcon className="h-3.5 w-3.5 shrink-0" />
            {ocultasPropias === 1
              ? 'Tienes 1 unidad oculta: aquí no sale, y el rival no la ve.'
              : `Tienes ${ocultasPropias} unidades ocultas: aquí no salen, y el rival no las ve.`}
          </p>
        )}
      </div>
    </section>
  )
}
