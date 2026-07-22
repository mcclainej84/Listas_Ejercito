// ============================================================================
// Capa de negocio — validaciones de dominio.
//
// Todas las reglas del juego deben vivir aquí (o en módulos hermanos dentro
// de domain/), nunca en los componentes de UI ni duplicadas entre features.
// De momento solo cubre la integridad de la ficha maestra de una unidad
// (lo que necesita el módulo de Administración); las validaciones de lista
// de ejército (límite de puntos, mínimos/máximos al añadir unidades,
// mejoras incompatibles, personajes obligatorios...) se añadirán aquí mismo
// cuando se construya el módulo "Ejércitos", reutilizando estas mismas
// funciones sobre los datos de units/equipment/upgrades.
// ============================================================================
import type { UnitScalarInput } from '@/data/repositories/unitRepository'

export interface ValidationIssue {
  field: string
  message: string
}

export function validateUnitScalarInput(input: UnitScalarInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!input.name.trim()) {
    issues.push({ field: 'name', message: 'El nombre no puede estar vacío.' })
  }
  if (input.baseCost < 0) {
    issues.push({ field: 'baseCost', message: 'El coste no puede ser negativo.' })
  }
  if (input.baseCost > 999) {
    issues.push({ field: 'baseCost', message: 'El coste no puede ser mayor de 999.' })
  }
  if (input.minSize !== null && input.minSize < 1) {
    issues.push({ field: 'minSize', message: 'El tamaño mínimo debe ser al menos 1.' })
  }
  if (input.minSize !== null && input.minSize > 99) {
    issues.push({ field: 'minSize', message: 'El tamaño mínimo no puede ser mayor de 99.' })
  }
  if (input.maxSize !== null && input.maxSize < 1) {
    issues.push({ field: 'maxSize', message: 'El tamaño máximo debe ser al menos 1.' })
  }
  if (input.maxSize !== null && input.maxSize > 99) {
    issues.push({ field: 'maxSize', message: 'El tamaño máximo no puede ser mayor de 99.' })
  }
  if (input.minSize !== null && input.maxSize !== null && input.minSize > input.maxSize) {
    issues.push({ field: 'minSize', message: 'El tamaño mínimo no puede ser mayor que el máximo.' })
  }
  if (input.defaultSize !== null && input.defaultSize < 1) {
    issues.push({ field: 'defaultSize', message: 'El tamaño por defecto debe ser al menos 1.' })
  }
  if (input.defaultSize !== null && input.defaultSize > 99) {
    issues.push({ field: 'defaultSize', message: 'El tamaño por defecto no puede ser mayor de 99.' })
  }
  // 0-6, donde 0 = sin salvación por armadura (se muestra como "—").
  // Antes el rango era 2-7 con el 7 como "sin salvación"; ver la migración de
  // ese 7 a 0 en catalogMaintenance.
  if (input.armorSave !== null && (input.armorSave < 0 || input.armorSave > 6)) {
    issues.push({ field: 'armorSave', message: 'La salvación por armadura debe estar entre 0 (—) y 6+.' })
  }

  return issues
}
