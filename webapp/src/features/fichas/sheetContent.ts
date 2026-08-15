// ============================================================================
// Contenido "de texto" de una ficha (tamaño de la unidad, montura, opciones,
// grupo de mando, reglas especiales) derivado de UnitDetail — funciones
// puras, sin JSX, para que las use tanto UnitSheetCard.tsx (pantalla) como
// exportWord.ts (documento Word), y así el documento exportado diga
// exactamente lo mismo que se ve en pantalla.
// ============================================================================
import type { AttributeProfile, UnitDetail } from '@/domain/types'

/**
 * Todos los perfiles de atributos de la unidad (base + montura + carro) en
 * el orden en que deben aparecer en la ÚNICA tabla de características de la
 * ficha — CodexMaker (ver capturas de referencia adjuntadas por el usuario)
 * nunca separa "Montura/Dotación" en una tabla aparte: es una sola tabla con
 * una fila por perfil. `label` es el nombre de fila: el de la propia unidad
 * para el perfil base (que no tiene `name` propio, ver AttributeProfile en
 * domain/types.ts), o `profile.name` para monturas/carros.
 */
export function unifiedProfileRows(
  unit: UnitDetail,
  hiddenProfiles: string[] = [],
): Array<{ key: string; label: string; profile: AttributeProfile }> {
  const rows: Array<{ key: string; label: string; profile: AttributeProfile }> = []
  if (unit.profiles.base) {
    rows.push({ key: `base-${unit.profiles.base.id}`, label: unit.name, profile: unit.profiles.base })
  }
  // Ficha del Campeón (si el grupo de mando la trae): va justo debajo del
  // perfil de la unidad y ENCIMA de monturas/carros, como en CodexMaker.
  const champion = unit.commandOptions.find((c) => c.role.code === 'CAMPEON')
  if (champion?.profile) {
    rows.push({
      key: `champion-${champion.profile.id}`,
      label: champion.customName?.trim() || champion.role.name,
      profile: champion.profile,
    })
  }
  for (const p of unit.profiles.montura) {
    rows.push({ key: `montura-${p.id}`, label: p.name ?? 'Montura', profile: p })
  }
  for (const p of unit.profiles.carro) {
    rows.push({ key: `carro-${p.id}`, label: p.name ?? 'Carro', profile: p })
  }
  // Opciones de unidad con ficha propia (p.ej. grupos de apoyo): su perfil se
  // añade a la tabla igual que el de una montura.
  for (const up of unit.upgradeOptions) {
    if (up.profile) {
      rows.push({ key: `upgrade-${up.id}`, label: up.profile.name ?? up.name, profile: up.profile })
    }
  }
  // El filtro va AQUÍ y no en cada consumidor: esta función la usan la
  // tarjeta, el canvas de exportación y el Word, y era la única forma de que
  // los tres oculten exactamente las mismas filas.
  return hiddenProfiles.length === 0 ? rows : rows.filter((r) => !hiddenProfiles.includes(r.key))
}

export function sizeLabel(unit: UnitDetail): string {
  if (unit.minSize == null && unit.maxSize == null) return '–'
  if (unit.minSize != null && unit.maxSize != null) {
    return unit.minSize === unit.maxSize ? String(unit.minSize) : `${unit.minSize}-${unit.maxSize}`
  }
  return String(unit.minSize ?? unit.maxSize)
}

export function commandGroupText(unit: UnitDetail): string {
  return unit.commandOptions
    .filter((c) => c.cost > 0)
    .map((c) => `${c.customName?.trim() || c.role.name} (+${c.cost})`)
    .join(', ')
}

export function monturaItems(unit: UnitDetail): string[] {
  return unit.profiles.montura
    .filter((p) => p.name)
    .map((p) => (p.cost ? `${p.name} (+${p.cost})` : (p.name as string)))
}

/**
 * Lista de opciones de la hoja.
 *
 * Las opciones de EQUIPO que son alternativas entre sí van en una sola línea
 * separadas por " / " — "Lanza (+2) / Arma a dos manos (+2) / Arma de mano
 * adicional (+2)" —, porque eso es lo que son: una elección, no tres cosas que
 * se puedan sumar. Cada una en su renglón daba a entender lo contrario.
 *
 * Las opciones de UNIDAD (mejoras) no se agrupan: van siempre en su propia
 * línea.
 *
 * Se agrupan CLIQUES y no simples grupos conectados: que A sea incompatible
 * con B, y B con C, no significa que A y C sean alternativas entre sí. Solo se
 * juntan las que están todas peleadas con todas; si no, se separarían cosas
 * que sí se pueden llevar juntas.
 */
export function optionsList(unit: UnitDetail): string[] {
  const label = (o: { name: string; cost: number }) => (o.cost ? `${o.name} (+${o.cost})` : o.name)

  // id -> ids con los que es excluyente, para poder preguntarlo en O(1).
  const clash = new Map<number, Set<number>>()
  for (const [a, b] of unit.equipmentExclusivePairs) {
    if (!clash.has(a)) clash.set(a, new Set())
    if (!clash.has(b)) clash.set(b, new Set())
    clash.get(a)!.add(b)
    clash.get(b)!.add(a)
  }

  const pending = [...unit.equipmentOptions]
  const equip: string[] = []
  while (pending.length > 0) {
    const group = [pending.shift()!]
    // Se recorre hacia delante y se añade al final, para conservar el orden
    // del catálogo dentro de la línea. Una opción entra solo si choca con
    // TODAS las del grupo, no únicamente con la primera.
    for (let i = 0; i < pending.length;) {
      const candidate = pending[i]
      if (group.every((g) => clash.get(g.id)?.has(candidate.id))) {
        group.push(candidate)
        pending.splice(i, 1)
      } else {
        i++
      }
    }
    equip.push(group.map(label).join(' / '))
  }

  const upgrades = unit.upgradeOptions.map(label)
  return [...equip, ...upgrades]
}

/**
 * SOLO las reglas propias de la unidad. Las de sus monturas NO se mezclan
 * aquí: cada montura tiene su propia ficha en esta misma sección, y repetir
 * sus reglas en la del jinete daba a entender que las tiene siempre, cuando en
 * realidad solo las tiene si lleva ese monstruo. En el constructor de
 * ejércitos sí se suman, pero allí se sabe qué montura se ha elegido.
 */
export function specialRulesText(unit: UnitDetail): string {
  return unit.specialRules.map((r) => r.name).join(', ')
}

export function pointsLabel(unit: UnitDetail): string {
  // Solo el personaje tiene coste plano, por ser una única miniatura. Una
  // unidad 0-1 NO: sigue siendo un regimiento de varias miniaturas (el 0-1
  // limita cuántas unidades de ese tipo caben en el ejército, no su tamaño),
  // así que su coste es por miniatura como el de cualquier otra tropa.
  const single = unit.unitType === 'personaje'
  return single ? `${unit.baseCost} pts` : `${unit.baseCost} pts/miniatura`
}

/** Nombre de archivo seguro para exportar — mismo criterio que CodexMaker (ver `sanitizeFilename` en index.html de referencia): espacios a "_", fuera los caracteres prohibidos en Windows, sin tocar acentos/ñ. */
export function sanitizeFilename(name: string): string {
  return (
    (name || 'ficha')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[\\/:*?"<>|]/g, '') || 'ficha'
  )
}
