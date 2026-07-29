// ============================================================================
// Adaptador para que una OPCIÓN DE UNIDAD con ficha propia (los "grupos de
// apoyo" y similares) pueda pintarse con la misma tarjeta que una unidad.
//
// La tarjeta (UnitSheetCard / exportSheet) trabaja siempre con un UnitDetail,
// así que aquí se construye uno "sintético" a partir del upgrade: su nombre,
// su coste, su perfil como perfil base y sus reglas especiales. El resto de
// secciones (equipo, monturas, grupo de mando, tamaño) van vacías porque una
// opción no las tiene.
//
// Se marca como `unitType: 'personaje'` a propósito: es lo que hace que la
// tarjeta NO pinte la línea "Tamaño de la unidad" (una opción no tiene tamaño)
// y que el coste se muestre como "X pts" en vez de "X pts/miniatura".
// ============================================================================
import type { AttributeProfile, Faction, SpecialRule, Upgrade, UnitDetail, UnitSheet } from '@/domain/types'

/**
 * Facción de respaldo. Tanto las opciones como las monturas son catálogos
 * GLOBALES: la misma "Gran Águila" puede pertenecer a varias facciones, así
 * que no tienen una facción propia que consultar.
 *
 * La que se usa al pintar su ficha es la que se está viendo en ese momento en
 * la sección "Fichas" (se pasa por parámetro), y por eso la misma montura sale
 * con el emblema de los Silvanos o con el de los Altos Elfos según desde dónde
 * la mires — que es justo lo que se quiere. Este objeto solo cubre el caso de
 * que no haya ninguna facción seleccionada.
 */
const NO_FACTION: Faction = {
  id: 0,
  name: '',
  slug: '',
  imagePath: null,
  description: null,
  sortOrder: 0,
  emblemUrl: null,
  hasCustomEmblem: false,
}

/** Ficha de presentación en blanco (las opciones no tienen fila propia en unit_sheets). */
export function blankUpgradeSheet(upgradeId: number): UnitSheet {
  return {
    unitId: -upgradeId,
    illuUrl: null,
    illuKey: null,
    illuOriginalName: null,
    illuWidthPct: 34,
    illuPosX: null,
    illuPosY: null,
    illuBrightness: 100,
    illuFlipped: false,
    emblemUrl: null,
    emblemKey: null,
    hasCustomEmblem: false,
    cardMaxHeight: 800,
    completed: false,
    sectionWidths: {},
    hiddenProfiles: [],
  }
}

/**
 * Construye el UnitDetail sintético de una opción con ficha, para poder
 * pintarla como una ficha más. `faction` es la facción desde la que se está
 * mirando: de ella sale el emblema de la ficha.
 */
export function upgradeAsUnitDetail(
  upgrade: Upgrade,
  specialRules: SpecialRule[],
  faction?: Faction | null,
): UnitDetail {
  return {
    // Id negativo para no chocar nunca con el de una unidad real.
    id: -upgrade.id,
    factionId: 0,
    categoryId: null,
    typeTagId: null,
    unitType: 'personaje',
    name: upgrade.name,
    baseCost: upgrade.cost,
    minSize: null,
    maxSize: null,
    defaultSize: null,
    isUnique: false,
    // Ni una opción de unidad ni una montura lanzan hechizos por sí mismas.
    magicLevel: null,
    equipmentText: null,
    armorSave: null,
    notes: null,
    sortOrder: 0,
    active: true,
    faction: faction ?? NO_FACTION,
    category: null,
    typeTag: null,
    profiles: { base: upgrade.profile, montura: [], carro: [] },
    specialRules,
    equipmentOptions: [],
    equipmentExclusivePairs: [],
    upgradeOptions: [],
    commandOptions: [],
  }
}

/**
 * Lo mismo para una MONTURA/DOTACIÓN del catálogo: su ficha propia dentro de
 * la sección "Fichas".
 *
 * Existe porque los monstruos (Estegadón, Gran Águila…) son fichas de pleno
 * derecho —tienen sus atributos y sus reglas especiales— pero no son unidades,
 * así que no salían por ningún lado. Y desde que sus reglas ya no se mezclan
 * en la ficha del jinete (ver sheetContent.specialRulesText), esta es la ÚNICA
 * ficha donde se pueden consultar.
 *
 * El id se hace negativo, igual que en las opciones, para no chocar nunca con
 * el de una unidad real; se desplaza además con MOUNT_KEY_OFFSET para no
 * chocar tampoco con el de una opción.
 */
const MOUNT_KEY_OFFSET = 1_000_000

export function mountAsUnitDetail(
  profile: AttributeProfile,
  specialRules: SpecialRule[],
  faction?: Faction | null,
): UnitDetail {
  return {
    id: -(MOUNT_KEY_OFFSET + profile.id),
    factionId: 0,
    categoryId: null,
    typeTagId: null,
    // 'personaje' por el mismo motivo que en las opciones: sin línea de
    // "Tamaño de la unidad" y con coste plano (que además aquí no se muestra,
    // porque el coste de una montura depende de quién la lleve).
    unitType: 'personaje',
    name: profile.name ?? 'Montura',
    baseCost: 0,
    minSize: null,
    maxSize: null,
    defaultSize: null,
    isUnique: false,
    // Ni una opción de unidad ni una montura lanzan hechizos por sí mismas.
    magicLevel: null,
    equipmentText: null,
    armorSave: null,
    notes: null,
    sortOrder: 0,
    active: true,
    faction: faction ?? NO_FACTION,
    category: null,
    typeTag: null,
    profiles: { base: profile, montura: [], carro: [] },
    specialRules,
    equipmentOptions: [],
    equipmentExclusivePairs: [],
    upgradeOptions: [],
    commandOptions: [],
  }
}

/** Ficha de presentación en blanco para una montura (no tiene fila en unit_sheets). */
export function blankMountSheet(profileId: number): UnitSheet {
  return blankUpgradeSheet(MOUNT_KEY_OFFSET + profileId)
}
