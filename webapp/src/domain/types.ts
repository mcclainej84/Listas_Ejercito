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
  /**
   * Color distintivo, "#rrggbb". Es con lo que se pinta cada peana en el
   * Despliegue: a ese tamaño el emblema no se distingue de otro, el color sí.
   * null = sin asignar; la UI cae a COLOR_FACCION_POR_DEFECTO (ver
   * domain/factionColor).
   */
  color: string | null
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
  /** Peana estándar de las unidades con esta etiqueta, en cm de mesa (ver domain/deployment). */
  baseWidthCm: number
  baseHeightCm: number
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
  /**
   * Iniciales con las que se reconoce la unidad DENTRO de su peana en el
   * Despliegue ("RO" para Ratas Ogro), 3 caracteres como mucho.
   *
   * No interviene en NADA más: no se busca por él, no sale en las listas ni en
   * los PDF ni en las hojas de unidad, y dos unidades pueden compartirlo sin
   * que pase nada. Es una etiqueta de dibujo, no un identificador.
   *
   * null = sin poner; en la mesa se cae a las iniciales del nombre
   * (ver aliasDeUnidad en domain/unitAlias).
   */
  alias: string | null
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
   * Si la unidad lanza hechizos. Solo eso: QUÉ sendas lleva y de qué nivel se
   * decide al meterla en un ejército (ver ArmyListEntry.magicPaths), no aquí —
   * el mismo personaje puede llevar sendas distintas en dos listas.
   */
  isWizard: boolean
  /**
   * PERSONAJE DE RENOMBRE: un personaje con nombre propio (Vlad, y no "un
   * Señor Vampiro"), nacido de copiar un personaje de su facción.
   *
   * Es una marca y no una categoría aparte porque a efectos de límites de
   * ejército CUENTAN COMO PERSONAJES, y las reglas de composición miran
   * `categoryId`. Que en el constructor tengan sección propia lo decide la
   * interfaz, no el modelo.
   *
   * Solo tiene sentido con `unitType === 'personaje'`.
   */
  isSpecialCharacter: boolean
  /**
   * Trasfondo del personaje: HTML ya SANEADO (misma lista de etiquetas que los
   * apéndices, ver shared/richText.ts). null = no tiene.
   */
  background: string | null
  /**
   * Clave en R2 de su retrato, propio del personaje de renombre y distinto de
   * la ilustración de su Ficha (que sigue existiendo). null = sin foto.
   */
  portraitKey: string | null
  /**
   * OCULTO: fuera del listado y del constructor de todos menos de su autor.
   *
   * Es la ÚNICA excepción a que los Personajes de Renombre sean comunes —
   * cualquiera los ve, los edita y los usa—, y existe por lo mismo que en los
   * mapas: poder tener uno a medio escribir sin que le estorbe a nadie.
   *
   * Solo se aplica a los personajes de renombre. Para el resto de unidades, lo
   * que decide si se ofrecen es `active`.
   */
  hidden: boolean
  /**
   * Quién lo creó. Solo lo llevan los personajes de renombre (el resto del
   * catálogo es de todos y nadie a la vez), y solo sirve para una cosa: saber
   * a quién le sigue apareciendo si está oculto. null = sin autor conocido,
   * que es lo que traen los creados antes de que existiera esta columna.
   */
  userId: number | null
  /** Equipo básico que la unidad siempre lleva (texto libre; sin dato de origen, se rellena desde Administración). */
  equipmentText: string | null
  /** Tirada de salvación por armadura (T.S.). Vacía por defecto; se rellena desde Administración. */
  armorSave: number | null
  notes: string | null
  sortOrder: number
  /** Activa (true) o desactivada (false): las desactivadas no se ofrecen al montar ejércitos, pero siguen en Administración. Por defecto activa. */
  active: boolean
}

/**
 * APÉNDICE de una unidad: un bloque de texto con formato (reglas propias,
 * trasfondo, aclaraciones) que se escribe a mano y sale al final de su ficha.
 * Una unidad puede tener varios y se ordenan.
 *
 * `bodyHtml` es HTML, pero SANEADO: solo párrafos, negrita, cursiva y listas
 * (ver shared/richText). Nunca se guarda lo que pegue el navegador tal cual.
 */
export interface UnitAppendix {
  id: number
  unitId: number
  title: string
  bodyHtml: string
  sortOrder: number
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
    /** `specialRules`: las propias del carro (ver profile_special_rules), no las de la unidad que lo lleva. */
    carro: Array<AttributeProfile & { cost: number | null; specialRules: SpecialRule[] }>
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
  /** Medidas de la mesa en el Despliegue, en cm. Solo cuentan si no hay mapa cargado. */
  tableWidthCm: number
  tableHeightCm: number
  /** Mapa cargado en el Despliegue; null = mesa libre. */
  battleMapId: number | null
  /**
   * Si esta lista OFRECE Personajes de Renombre en el constructor.
   *
   * Va por LISTA y no por usuario porque es una decisión de la partida: una
   * campaña narrativa los quiere y un torneo no. Apagado, ni siquiera aparecen
   * en el constructor.
   *
   * NACE ENCENDIDO, y por eso es una columna NUEVA (`show_special_characters`)
   * y no la antigua `include_special_characters`. Aquella era opt-in y sus
   * filas guardan 0; darles la vuelta con un UPDATE en las migraciones es
   * imposible sin que ese mismo UPDATE se repita en cada arranque y le vuelva
   * a encender los personajes a quien los hubiera apagado a mano. Una columna
   * nueva con DEFAULT 1 rellena las filas existentes UNA sola vez, por
   * construcción.
   */
  showSpecialCharacters: boolean
  /**
   * LISTA CERRADA: está terminada y no se toca. El constructor se abre en solo
   * lectura, igual que una lista compartida por otro.
   *
   * No es un permiso ni un camino de ida: se marca y se desmarca las veces que
   * haga falta desde el listado de ejércitos. Lo que evita es el manotazo que
   * cambia una lista dada por buena la víspera de la partida.
   */
  ready: boolean
  /**
   * Lado del tablero desde el que despliega este ejército.
   *
   * Las peanas se colocan SIEMPRE abajo, porque es lo cómodo para quien está
   * sentado delante de la mesa. Lo que cambia con esto es la PERSPECTIVA del
   * terreno: con 'norte', el mapa (su suelo, su imagen y su escenografía) se
   * pinta girado 180°, que es lo que se ve desde el otro lado.
   */
  deploymentSide: LadoDeDespliegue
  /**
   * Clave en R2 de una imagen de fondo propia para el despliegue. Alternativa
   * suelta a los mapas de la sección Mapas. null = sin imagen.
   */
  deploymentImageKey: string | null
  /**
   * EMBLEMA DE ESTE EJÉRCITO, y solo de este. No es un emblema de facción.
   *
   * Casi siempre valdrá el de su facción —por eso los dos campos empiezan a
   * null, que significa exactamente eso— y existen para la excepción: la hueste
   * de un señor concreto que se presenta a la batalla con su propia enseña.
   * `emblemKey` (imagen propia) manda sobre `emblemFactionId` (el de otra
   * facción). Ver domain/armyEmblem.
   */
  emblemFactionId: number | null
  emblemKey: string | null
}

/** Desde qué borde despliega un ejército. Ver ArmyList.deploymentSide. */
export type LadoDeDespliegue = 'sur' | 'norte'

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
  /**
   * Coste escrito a mano que PISA al calculado, para los casos que la fórmula
   * no cubre. null = usar el cálculo. Ojo: 0 NO significa "sin retocar" —
   * es un coste válido.
   */
  costOverride: number | null
  /**
   * Sendas de magia de ESTA miniatura en ESTA lista, cada una con su nivel.
   *
   * El nivel es por senda y no del personaje: puede llevar Fuego a nivel 2 y
   * Bestias a nivel 1. Solo tiene sentido si `unit.isWizard`.
   */
  magicPaths: EntryMagicPath[]
  sortOrder: number
  equipmentIds: number[]
  upgradeIds: number[]
  /**
   * UNIDAD OCULTA: no se le enseña al rival en la sección de Batallas —ni peana
   * sobre la mesa, ni línea en el orden de batalla—. En su propia lista y en su
   * despliegue se ve y se maneja como cualquier otra: esto no la esconde de su
   * dueño, la esconde del contrario.
   *
   * Los puntos del ejército la siguen contando. Es a propósito, y es la razón de
   * que en Batallas no se enseñen los puntos de cada unidad: con el total y las
   * partes a la vista, restar bastaría para saber qué se está escondiendo.
   */
  hidden: boolean
}

/** Una senda conocida por una entrada de lista, con el nivel al que la lanza. */
export interface EntryMagicPath {
  pathId: number
  level: number
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
  /** Coste a mano que pisa al calculado (ver ArmyListEntry.costOverride). */
  costOverride: number | null
  /** Sendas de magia con su nivel (ver ArmyListEntry.magicPaths). */
  magicPaths: EntryMagicPath[]
  equipmentIds: number[]
  upgradeIds: number[]
  /**
   * Oculta al rival en Batallas (ver ArmyListEntry.hidden).
   *
   * Viaja en el input porque guardar el ejército desde el constructor BORRA Y
   * REINSERTA todas las entradas (ver replaceAllEntries): sin esto, tocar
   * cualquier cosa de la lista destapaba en silencio todo lo que estuviera
   * escondido.
   */
  hidden: boolean
}
