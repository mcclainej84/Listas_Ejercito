// Mapeadores de fila SQLite -> tipo de dominio compartidos entre repositorios,
// para no repetir la misma conversión en cada uno (DRY).
import type { AttributeProfile, EquipmentOption, Upgrade } from '@/domain/types'
import { expandEquipmentName, expandUpgradeName } from '@/domain/catalogAliases'

export function mapAttributeProfileRow(row: Record<string, unknown>): AttributeProfile {
  return {
    id: row.id as number,
    name: (row.name as string) ?? null,
    m: (row.m as string) ?? null,
    ha: (row.ha as string) ?? null,
    hp: (row.hp as string) ?? null,
    f: (row.f as string) ?? null,
    r: (row.r as string) ?? null,
    h: (row.h as string) ?? null,
    i: (row.i as string) ?? null,
    a: (row.a as string) ?? null,
    l: (row.l as string) ?? null,
    equippableByCharacter: Boolean(row.equippable_by_character),
    // La columna puede no venir todavía si la D1 no se ha migrado (ver worker
    // MIGRATIONS): en ese caso se asume "no incluir", que es el valor por
    // defecto y el criterio conservador.
    includeInSheets: Boolean(row.include_in_sheets),
  }
}

export function mapEquipmentOptionRow(row: Record<string, unknown>): EquipmentOption {
  return {
    id: row.id as number,
    // Se muestra la descripción completa aunque en la BBDD siga la abreviatura
    // (2AM → "Dos armas de mano"), ver domain/catalogAliases.
    name: expandEquipmentName(row.name as string),
    cost: row.cost as number,
    category: (row.category as EquipmentOption['category']) ?? null,
  }
}

/**
 * Columnas a seleccionar para una opción de unidad junto con su ficha propia
 * (LEFT JOIN a attribute_profiles). Se comparte entre repositorios para que
 * todos devuelvan un `Upgrade` completo — ver mapUpgradeRow.
 */
export const UPGRADE_SELECT_COLUMNS = `
  up.id AS id, up.name AS name, up.cost AS cost, up.include_in_sheets AS include_in_sheets,
  ap.id AS profile_id, ap.name AS profile_name,
  ap.m AS profile_m, ap.ha AS profile_ha, ap.hp AS profile_hp, ap.f AS profile_f,
  ap.r AS profile_r, ap.h AS profile_h, ap.i AS profile_i, ap.a AS profile_a, ap.l AS profile_l`

/** `FROM` correspondiente a UPGRADE_SELECT_COLUMNS. */
export const UPGRADE_FROM_JOIN = 'FROM upgrades up LEFT JOIN attribute_profiles ap ON ap.id = up.profile_id'

function mapUpgradeProfile(row: Record<string, unknown>): AttributeProfile | null {
  const id = row.profile_id as number | null
  if (id == null) return null
  return {
    id,
    name: (row.profile_name as string) ?? null,
    m: (row.profile_m as string) ?? null,
    ha: (row.profile_ha as string) ?? null,
    hp: (row.profile_hp as string) ?? null,
    f: (row.profile_f as string) ?? null,
    r: (row.profile_r as string) ?? null,
    h: (row.profile_h as string) ?? null,
    i: (row.profile_i as string) ?? null,
    a: (row.profile_a as string) ?? null,
    l: (row.profile_l as string) ?? null,
    // Ninguna de las dos marcas aplica al perfil de una OPCIÓN: no es una
    // ficha del catálogo de monturas. Que la opción salga o no en "Fichas" lo
    // decide `upgrades.include_in_sheets`, no esto.
    equippableByCharacter: false,
    includeInSheets: false,
  }
}

export function mapUpgradeRow(row: Record<string, unknown>): Upgrade {
  return {
    id: row.id as number,
    // Igual que el equipo: descripción completa (MdC Nurgle → "Marca de Nurgle").
    name: expandUpgradeName(row.name as string),
    cost: row.cost as number,
    profile: mapUpgradeProfile(row),
    includeInSheets: Boolean(row.include_in_sheets),
  }
}
