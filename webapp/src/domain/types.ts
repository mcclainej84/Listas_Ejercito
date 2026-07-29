// ============================================================================
// Tipos de dominio — reflejan el esquema relacional (db/schema.sql) y son el
// único vocabulario que usan la capa de negocio y la UI. Ningún componente
// de features/ debe construir sus propios tipos "ad hoc" para estas
// entidades: se importan de aquí (Single Source of Truth de tipos).
// ============================================================================

export interface Faction {
  id: number
  name: string
  slug: string
  imagePath: string | null
  description: string | null
  sortOrder: number
  /**
   * URL lista para usar en un <img src>: resuelve emblema personalizado
   * (subido por el usuario, guardado como BLOB) si existe, si no el emblema
   * de fábrica (imagePath), si no null. Calculada por el repositorio, nunca
   * por la UI (ver factionRepository.mapFaction).
   */
  emblemUrl: string | null
  /** true si el usuario ha subido un emblema propio (permite ofrecer "quitar" para volver al de fábrica). */
  hasCustomEmblem: boolean
}

export interface UnitCategory {
  id: number
  code: string
  name: string
  sortOrder: number
}

/**
 * Etiqueta de TIPO de unidad (Infantería, Proyectiles, Caballería, Monstruo,
 * Máquina de guerra...) — puramente informativa, se muestra en la ficha del
 * constructor de listas; no interviene en ninguna validación. Independiente
 * de UnitCategory (el "hueco" de organización de ejército).
 */
export interface UnitTypeTag {
  id: number
  code: string
  name: string
  sortOrder: number
}

/**
 * Perfil de atributos (M, HA, HP, F, R, H, I, A, L). `name` es null cuando es
 * el perfil propio de una unidad (usa el nombre de la unidad); tiene valor
 * cuando es un perfil reutilizable con nombre propio (montura, carro...).
 *
 * Una unidad puede tener VARIOS perfiles asociados a la vez — ver
 * `UnitProfileRole` y `UnitDetail.profiles`. No hay un tipo "Mount" o
 * "Chariot" aparte: son el mismo AttributeProfile con role distinto.
 */
export interface AttributeProfile {
  id: number
  name: string | null
  m: string | null
  ha: string | null
  hp: string | null
  f: string | null
  r: string | null
  h: string | null
  i: string | null
  a: string | null
  l: string | null
  /** Solo relevante para profile_kind = 'montura' (catálogo "Montura/Dotación"): si un personaje puede montarla individualmente. */
  equippableByCharacter: boolean
  /**
   * Si esta montura/dotación aparece como ficha propia en la sección "Fichas"
   * (mismo criterio que `Upgrade.includeInSheets`). Por defecto false: el
   * catálogo tiene muchas cabalgaduras y dotaciones de tropa que no interesa
   * imprimir por separado, y solo se marcan las que sí.
   */
  includeInSheets: boolean
}

export type UnitProfileRole = 'base' | 'montura' | 'carro'

/** Las 9 características editables de un perfil de atributos (sin id/nombre) — usado al crear o editar una ficha. */
export interface AttributeProfileInput {
  m: string | null
  ha: string | null
  hp: string | null
  f: string | null
  r: string | null
  h: string | null
  i: string | null
  a: string | null
  l: string | null
}

export interface SpecialRule {
  id: number
  name: string
  description: string
}

export type EquipmentCategory = 'armadura' | 'escudo' | 'arma_cac' | 'arma_dist'

export interface EquipmentOption {
  id: number
  name: string
  cost: number
  /**
   * Hueco de equipo que ocupa esta pieza (armadura/escudo/arma cuerpo a
   * cuerpo/arma a distancia). Dos piezas asignadas a la misma unidad con la
   * misma categoría son alternativas excluyentes salvo excepción explícita
   * (ver equipment_incompatibilities) — lo aplicará el futuro constructor de
   * listas ("Ejércitos"); aquí solo se muestra como referencia. `null` =
   * sin categoría reconocida, siempre combinable.
   */
  category: EquipmentCategory | null
}

export interface Upgrade {
  id: number
  name: string
  cost: number
  /**
   * Ficha de atributos propia de la opción (p.ej. los "grupos de apoyo"):
   * cuando se elige la opción dentro de una unidad, este perfil se añade a su
   * tabla de características igual que el de una montura. `null` = la opción
   * no tiene ficha (el caso normal).
   */
  profile: AttributeProfile | null
  /** Si la opción debe aparecer además como una ficha más en la sección "Fichas". Solo tiene sentido si lleva perfil. */
  includeInSheets: boolean
}

export type CommandRoleCode = 'MUSICO' | 'PORTAESTANDARTE' | 'CAMPEON'

export interface CommandRole {
  id: number
  code: CommandRoleCode
  name: string
}

export type UnitType = 'tropa' | 'personaje'

export interface Unit {
  id: number
  factionId: number
  categoryId: number | null
  typeTagId: number | null
  unitType: UnitType
  name: string
  baseCost: number
  minSize: number | null
  maxSize: number | null
  /** Tamaño "de partida" sugerido para precargar la cantidad al añadir la unidad a una lista — no es un límite de validación (ver min_size/max_size). */
  defaultSize: number | null
  /**
   * Unidad "0-1": en el ejército solo cabe UNA unidad de este tipo.
   *
   * NO dice nada sobre el tamaño. La unidad sigue siendo un regimiento
   * corriente, y de hecho casi siempre tendrá más de una miniatura: quien
   * manda en la cantidad son `minSize`/`maxSize`, igual que en cualquier otra
   * tropa. Lo único que impide el 0-1 es meter una segunda unidad del mismo
   * tipo en la misma lista (ver validateEntryInput).
   *
   * Es además un distintivo de TROPAS: en un personaje SIEMPRE llega false,
   * pase lo que pase en la base de datos (ver mapUnit en unitRepository).
   */
  isUnique: boolean
  /**
   * Nivel de mago (1 a 4), o `null` si la unidad no lanza hechizos — que es
   * la inmensa mayoría. Las sendas que conoce viven aparte (unit_magic_paths)
   * porque puede saber varias a la vez; ver domain/magic.ts.
   */
  magicLevel: number | null
  /** Equipo básico que la unidad siempre lleva (texto libre; sin dato de origen, se rellena desde Administración). */
  equipmentText: string | null
  /** Tirada de salvación por armadura (T.S.). Vacía por defecto; se rellena desde Administración. */
  armorSave: number | null
  notes: string | null
  sortOrder: number
  /** Activa (true) o desactivada (false): las desactivadas no se ofrecen al montar ejércitos, pero siguen en Administración. Por defecto activa. */
  active: boolean
}

/** Unidad con todas sus relaciones cargadas — para la ficha de detalle/edición. */
export interface UnitDetail extends Unit {
  faction: Faction
  category: UnitCategory | null
  /** Etiqueta de tipo (Infantería/Caballería/Monstruo...) — ver UnitTypeTag. */
  typeTag: UnitTypeTag | null
  /**
   * Perfiles de atributos de la unidad, agrupados por rol. `base` es
   * siempre 0 o 1; los demás, 0..N. `montura`/`carro` llevan además `cost`
   * (ver unit_profiles.cost en db/schema.sql): coste EXTRA en puntos por
   * llevar esa montura/carro concreto — normalmente `null` (incluida sin
   * coste, como en cualquier unidad de tropa), pero los personajes suelen
   * pagar puntos por su montura.
   */
  profiles: {
    base: AttributeProfile | null
    /** `specialRules`: las propias del monstruo/montura (ver profile_special_rules), no las del jinete. */
    montura: Array<AttributeProfile & { cost: number | null; specialRules: SpecialRule[] }>
    carro: Array<AttributeProfile & { cost: number | null }>
  }
  /**
   * Las reglas propias de la unidad — EXACTAMENTE las filas de
   * unit_special_rules, ni una más.
   *
   * Las que aporta una montura NO se mezclan aquí. Se probó a hacerlo (había
   * un `allSpecialRules` con la suma ya calculada) y era engañoso: daba a
   * entender que la unidad tiene "Vuela" siempre, cuando solo lo tiene si de
   * verdad lleva ese monstruo. Quien necesita la suma es el constructor de
   * ejércitos, porque allí SÍ se sabe qué montura se ha elegido para cada
   * entrada — la compone él con `mergeSpecialRules` y las de
   * `profiles.montura[].specialRules`.
   */
  specialRules: SpecialRule[]
  /** `isDefault`: viene ya marcada al añadir la unidad a una lista (ver unit_equipment_options.is_default). */
  equipmentOptions: Array<EquipmentOption & { isDefault: boolean }>
  /**
   * Parejas de opciones de equipo EXCLUYENTES entre sí, limitadas a las que
   * ofrece esta unidad (ver equipment_incompatibilities). Se cargan con la
   * unidad porque la hoja las necesita para agrupar las alternativas en una
   * sola línea separadas por "/" — y así lo tienen por igual la tarjeta en
   * pantalla y los dos exportadores, sin pasarlo por parámetro.
   */
  equipmentExclusivePairs: Array<[number, number]>
  /** `isDefault`: viene ya marcada al añadir la unidad a una lista (ver unit_upgrade_options.is_default). */
  upgradeOptions: Array<Upgrade & { isDefault: boolean }>
  commandOptions: Array<{
    role: CommandRole
    cost: number
    customName: string | null
    /** Ficha de atributos propia de este miembro del grupo de mando (de momento solo el Campeón la tiene). */
    profile: AttributeProfile | null
  }>
}

import type { SectionWidths } from '@/domain/sheetSections'

// ============================================================================
// Fichas (sección "Fichas", estilo CodexMaker) — ver unit_sheets en
// db/schema.sql. Overrides puramente presentacionales por unidad: nunca
// datos de juego (esos ya están en UnitDetail y se editan en Editor).
// ============================================================================

/**
 * Overrides de presentación de la ficha de una unidad. Si la unidad nunca se
 * ha tocado desde Fichas, no existe fila en unit_sheets — el repositorio
 * devuelve estos mismos valores por defecto (ver unitSheetRepository.blank).
 */
export interface UnitSheet {
  unitId: number
  /**
   * URL lista para `<img src>`, o null si no tiene ilustración. Normalmente
   * apunta a R2 (`/image/<clave>`, cacheable por el navegador); en las hojas
   * que la migración a R2 todavía no ha tocado es una data: URL armada a
   * partir del BLOB de siempre — ver resolveImageUrl en unitSheetRepository.
   */
  illuUrl: string | null
  /** Clave del objeto en R2, o null si la imagen todavía vive como BLOB en la base. Hace falta para poder borrar la anterior al reemplazarla. */
  illuKey: string | null
  illuOriginalName: string | null
  /** % del ancho útil de la ficha (10-90). */
  illuWidthPct: number
  /** Posición libre en px sobre la ficha; null = todavía no se ha arrastrado (se calcula una por defecto en el cliente). */
  illuPosX: number | null
  illuPosY: number | null
  /** % de brillo (40-180). */
  illuBrightness: number
  illuFlipped: boolean
  /** Emblema propio de ESTA hoja (anula el de la facción solo aquí); null = usa el de la facción. */
  emblemUrl: string | null
  /** Clave del emblema propio en R2 (ver illuKey). */
  emblemKey: string | null
  hasCustomEmblem: boolean
  /** Alto máximo de la ficha en px (300-800). */
  cardMaxHeight: number
  /** Marca interna "ficha terminada" — nunca se exporta ni se imprime. */
  completed: boolean
  /**
   * Ancho de cada apartado de texto, en % del ancho útil de la tarjeta. Lo que
   * no esté aquí usa DEFAULT_SECTION_WIDTH. Sirve para estrecharlos y dejarle
   * sitio a la ilustración — ver domain/sheetSections.ts.
   */
  sectionWidths: SectionWidths
  /**
   * Claves de las fichas de atributos que NO se muestran en esta hoja (ver
   * parseHiddenProfiles). Vacío = se ven todas.
   */
  hiddenProfiles: string[]
}

export interface FactionConstructionRule {
  id: number
  factionId: number
  ruleType: string
  description: string
  params: Record<string, unknown>
}

// ============================================================================
// Constructor de listas ("Ejércitos") — ver ARCHITECTURE.md.
// ============================================================================

/**
 * Usuario = PERFIL (no seguridad): sirve para saber quién eres y personalizar
 * la vista (tus ejércitos, qué facciones ves). Ver userRepository.
 */
export interface User {
  id: number
  username: string
  createdAt: string
}

export interface ArmyList {
  id: number
  factionId: number
  name: string
  /** null = sin límite. Si tiene valor, superarlo solo genera un aviso (no bloquea). */
  pointsLimit: number | null
  createdAt: string
  updatedAt: string
  /** Dueño de la lista: los ejércitos son privados de cada usuario. null = sin asignar todavía. */
  userId: number | null
}

/**
 * Una entrada de una lista: "N unidades de tal Tropa, con este equipo,
 * opciones, grupo de mando y montura/carro elegidos". Lleva la unidad
 * completa (UnitDetail) resuelta porque tanto el coste como la validación de
 * legalidad necesitan sus reglas (min/max, incompatibilidades, roles de
 * mando disponibles...), no solo su id.
 */
export interface ArmyListEntry {
  id: number
  armyListId: number
  unit: UnitDetail
  quantity: number
  /** Cuál de unit.profiles.montura se ha elegido (si la unidad ofrece más de una); null si no lleva o solo tiene una (implícita). */
  mountProfileId: number | null
  chariotProfileId: number | null
  hasStandardBearer: boolean
  hasMusician: boolean
  hasChampion: boolean
  /** null = usa el nombre ya definido en la ficha de la unidad (propio o "Campeón" genérico). */
  championName: string | null
  /**
   * Nombre propio de ESTA miniatura en ESTA lista ("Jules el Bretón"). No
   * sustituye al nombre de la unidad: la lista muestra
   * "Jules el Bretón (Paladín Bretoniano)", porque el tipo sigue haciendo
   * falta para saber qué reglas se aplican. null = sin nombre propio.
   */
  alias: string | null
  sortOrder: number
  equipmentIds: number[]
  upgradeIds: number[]
}

export interface ArmyListDetail extends ArmyList {
  faction: Faction
  entries: ArmyListEntry[]
}

/** Datos mínimos para crear/editar una entrada — lo que de verdad decide el usuario en el constructor. */
export interface ArmyListEntryInput {
  unitId: number
  quantity: number
  mountProfileId: number | null
  chariotProfileId: number | null
  hasStandardBearer: boolean
  hasMusician: boolean
  hasChampion: boolean
  championName: string | null
  /** Nombre propio de la miniatura en la lista (ver ArmyListEntry.alias). */
  alias: string | null
  equipmentIds: number[]
  upgradeIds: number[]
}
