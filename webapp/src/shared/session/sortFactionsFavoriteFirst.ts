// ============================================================================
// Pone la facción favorita la primera de la lista (el resto conserva su
// orden). Se usa en TODOS los selectores de facción de la app —
// desplegables, listas de opciones— para que la favorita salga arriba sin
// tener que buscarla entre el resto.
// ============================================================================
export function sortFactionsFavoriteFirst<T extends { id: number }>(
  factions: T[],
  favoriteId: number | null,
): T[] {
  if (favoriteId == null) return factions
  const index = factions.findIndex((f) => f.id === favoriteId)
  if (index <= 0) return factions
  const favorite = factions[index]
  return [favorite, ...factions.slice(0, index), ...factions.slice(index + 1)]
}
