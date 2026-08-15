// ============================================================================
// Cómo se referencia una unidad desplegada.
//
// EL PROBLEMA. Sobre la mesa cada peana lleva tres letras (ver domain/unitAlias)
// y eso se repite constantemente: dos regimientos de Guerreros Skaven son los
// dos "GS", y ni siquiera basta con el nombre, porque uno puede llevar 36
// miniaturas con lanzas y el otro 25 con armas de mano. En una lista impresa,
// "GS" no señala a nadie.
//
// LA SOLUCIÓN. Se numeran SOLO las que se repiten: si un alias lo usa una única
// unidad se queda tal cual ("EST"), y si lo usan varias se les añade un número
// en el orden del ejército ("GS1", "GS2"). Numerarlo todo daría referencias más
// largas sin ganar nada, y no numerar nada dejaría el problema.
//
// La leyenda que acompaña al mapa lleva además CANTIDAD, NOMBRE y EQUIPO, que
// es lo que de verdad distingue dos unidades iguales sobre el papel.
// ============================================================================
import { aliasDeUnidad } from '@/domain/unitAlias'
import type { ArmyListEntry } from '@/domain/types'

export interface ReferenciaDeUnidad {
  entryId: number
  /** Lo que se pinta dentro de la peana: "GS" o "GS1". */
  ref: string
  /** Nombre propio del personaje si lo tiene; si no, el de la unidad. */
  nombre: string
  cantidad: number
  /** Equipo y opciones, ya en una línea: es lo que separa dos unidades idénticas. */
  detalle: string
  puntos: number
}

/**
 * Equipo, opciones, montura y grupo de mando en una sola línea.
 *
 * Es lo que de verdad separa dos unidades del mismo tipo: en la mesa se ven
 * iguales, y en la leyenda una lleva "lanzas, escudos" y la otra no.
 */
function detalleDeEntrada(entry: ArmyListEntry): string {
  const partes: string[] = []
  for (const e of entry.unit.equipmentOptions) {
    if (entry.equipmentIds.includes(e.id)) partes.push(e.name)
  }
  for (const u of entry.unit.upgradeOptions) {
    if (entry.upgradeIds.includes(u.id)) partes.push(u.name)
  }
  const montura = entry.unit.profiles.montura.find((m) => m.id === entry.mountProfileId)
  if (montura?.name) partes.push(montura.name)
  const carro = entry.unit.profiles.carro.find((c) => c.id === entry.chariotProfileId)
  if (carro?.name) partes.push(carro.name)
  const mando = [
    entry.hasStandardBearer ? 'portaestandarte' : '',
    entry.hasMusician ? 'músico' : '',
    entry.hasChampion ? 'campeón' : '',
  ].filter(Boolean)
  if (mando.length > 0) partes.push(mando.join(' + '))
  return partes.filter(Boolean).join(', ')
}

/**
 * Referencias de las unidades desplegadas, en el orden en que se pasen.
 *
 * `costes` trae los puntos ya calculados por entrada (con el retoque a mano si
 * lo hay): este archivo no sabe de precios y no debería.
 */
export function referenciasDeDespliegue(
  entradas: ArmyListEntry[],
  costes: Map<number, number> = new Map(),
): ReferenciaDeUnidad[] {
  const cuantasVecesSaleElAlias = new Map<string, number>()
  for (const entry of entradas) {
    const alias = aliasDeUnidad(entry.unit)
    cuantasVecesSaleElAlias.set(alias, (cuantasVecesSaleElAlias.get(alias) ?? 0) + 1)
  }

  const yaVistas = new Map<string, number>()
  return entradas.map((entry) => {
    const alias = aliasDeUnidad(entry.unit)
    const repetido = (cuantasVecesSaleElAlias.get(alias) ?? 0) > 1
    const n = (yaVistas.get(alias) ?? 0) + 1
    yaVistas.set(alias, n)
    return {
      entryId: entry.id,
      ref: repetido ? `${alias}${n}` : alias,
      nombre: entry.alias ?? entry.unit.name,
      cantidad: entry.quantity,
      detalle: detalleDeEntrada(entry),
      puntos: costes.get(entry.id) ?? 0,
    }
  })
}
