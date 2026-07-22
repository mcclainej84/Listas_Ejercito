// ============================================================================
// Renombrados de nombres abreviados del origen a su descripción completa
// (a petición del usuario). Módulo "hoja" SIN dependencias, para poder usarlo
// tanto en la capa de datos (mappers, importación, mantenimiento del catálogo)
// como donde haga falta sin crear ciclos de importación.
//
// Se aplican en DOS sitios, y por eso son fiables:
//   - Al LEER (mappers de equipo/opciones): la descripción completa se muestra
//     siempre, aunque en la BBDD siga guardada la abreviatura — así el usuario
//     ve "Arma a dos manos" aunque la fila diga "A2M", sin depender de que se
//     haya ejecutado ninguna migración.
//   - Al MANTENER/IMPORTAR (catalogMaintenance/importRepository): además se
//     reescribe el nombre en la BBDD para ir dejando el catálogo limpio.
// ============================================================================

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Equipo: abreviatura (clave normalizada) → descripción completa. */
export const EQUIPMENT_ALIASES: Record<string, string> = {
  '2am': 'Dos armas de mano',
  'a.caos': 'Armadura del Caos',
  'a.ceremoniales': 'Armadura Ceremonial',
  'a.gromril': 'Armadura de Gromril',
  'a.ligera': 'Armadura Ligera',
  'a.negra': 'Armadura Negra',
  'a.norsca': 'Armadura de Norsca',
  'a.pesada': 'Armadura Pesada',
  a2m: 'Arma a dos manos',
}

/** Opciones de unidad (upgrades): abreviatura → descripción completa. */
export const UPGRADE_ALIASES: Record<string, string> = {
  'arcabuz (1a)': 'Arcabuz (1a fila)',
  'ballesta (1a)': 'Ballesta (1a fila)',
  'mdc khorne': 'Marca de Khorne',
  'mdc nurgle': 'Marca de Nurgle',
  'mdc slaanesh': 'Marca de Slaanesh',
  'mdc tzeentch': 'Marca de Tzeentch',
  'mosquete (1a)': 'Mosquete (1a Fila)',
}

export function expandName(name: string, aliases: Record<string, string>): string {
  return aliases[normalizeName(name)] ?? name
}

/** Descripción completa de una pieza de equipo (o el mismo nombre si no hay alias). */
export function expandEquipmentName(name: string): string {
  return expandName(name, EQUIPMENT_ALIASES)
}

/** Descripción completa de una opción de unidad (o el mismo nombre si no hay alias). */
export function expandUpgradeName(name: string): string {
  return expandName(name, UPGRADE_ALIASES)
}
