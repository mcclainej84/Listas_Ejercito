// ============================================================================
// Salud del esquema: comprueba si la base de datos de verdad (D1) tiene ya
// todo lo que el programa espera.
//
// Por qué hace falta. Las tablas y columnas nuevas se crean con migraciones
// que viven DENTRO del código del Worker (ver worker/src/index.ts#MIGRATIONS),
// así que desplegar solo el frontend no basta: hasta que se despliega el
// Worker, la mitad de una función nueva falla de formas desconcertantes. El
// caso real que motivó esto fue "include_in_sheets" en las monturas:
//
//   · Guardar daba error, porque el UPDATE tocaba una columna inexistente.
//   · Y a la vez desaparecían TODAS las fichas de montura, porque la copia
//     local sí tiene la columna (se crea desde db/schema.sql) pero las filas
//     llegaban del snapshot sin ella, así que todas valían 0 y ninguna estaba
//     marcada para salir en fichas.
//
// Dos síntomas sin relación aparente y una sola causa. En vez de dejar que se
// repita, la aplicación se lo pregunta a sí misma y lo dice.
// ============================================================================
import { query } from '@/data/sqlite/client'

interface SchemaCheck {
  /** Qué deja de funcionar si falta. */
  label: string
  /** SELECT inofensivo que solo puede fallar si la tabla/columna no existe. */
  probe: string
}

const CHECKS: SchemaCheck[] = [
  { label: 'Log de cambios', probe: 'SELECT id FROM change_log LIMIT 1' },
  { label: 'Reglas especiales de monturas', probe: 'SELECT rule_id FROM profile_special_rules LIMIT 1' },
  {
    label: 'Monturas en la sección Hojas de Unidad',
    probe: 'SELECT include_in_sheets FROM attribute_profiles LIMIT 1',
  },
  { label: 'Unidades activas/inactivas', probe: 'SELECT active FROM units LIMIT 1' },
  { label: 'Opciones de unidad con ficha', probe: 'SELECT profile_id FROM upgrades LIMIT 1' },
  // Presentación de las hojas. Cada vez que se añade una de estas, hay que
  // sumarla AQUÍ: si no, su ajuste falla en silencio (la pantalla lo pinta,
  // la base de datos lo rechaza) y no hay nada que lo delate.
  { label: 'Hojas de montura y de opción', probe: 'SELECT ref_id FROM sheet_presentations LIMIT 1' },
  { label: 'Ancho de los apartados', probe: 'SELECT section_widths FROM unit_sheets LIMIT 1' },
  { label: 'Mostrar u ocultar fichas de atributos', probe: 'SELECT hidden_profiles FROM unit_sheets LIMIT 1' },
  // Imágenes de las hojas en R2. Sin estas columnas, guardar una hoja con
  // imagen falla (el UPDATE toca illu_key/emblem_key) y la migración de
  // Mantenimiento no arranca. Es justo el caso que este detector existe para
  // delatar: frontend desplegado y Worker todavía no.
  // Sin esta columna, GUARDAR una unidad falla entero: el UPDATE de la ficha
  // la toca siempre. Es justo el caso que este detector existe para delatar.
  { label: 'Hechiceros', probe: 'SELECT is_wizard FROM units LIMIT 1' },
  { label: 'Sendas de magia por entrada de lista', probe: 'SELECT path_id FROM army_list_entry_magic_paths LIMIT 1' },
  { label: 'Selección de puntos', probe: 'SELECT kind FROM category_composition_rules LIMIT 1' },
  { label: 'Imágenes de las hojas en R2', probe: 'SELECT illu_key FROM unit_sheets LIMIT 1' },
  { label: 'Imágenes de hojas de montura y opción en R2', probe: 'SELECT illu_key FROM sheet_presentations LIMIT 1' },
  { label: 'Facción favorita', probe: 'SELECT favorite_faction_id FROM users LIMIT 1' },
  { label: 'Opciones de la lista de ejército', probe: 'SELECT show_mounts FROM users LIMIT 1' },
  { label: 'Coste retocado a mano', probe: 'SELECT cost_override FROM army_list_entries LIMIT 1' },
  { label: 'Ejércitos compartidos', probe: 'SELECT user_id FROM army_list_shares LIMIT 1' },
  { label: 'Despliegue sobre la mesa', probe: 'SELECT x_cm FROM army_list_deployments LIMIT 1' },
  { label: 'Compartir el despliegue', probe: 'SELECT share_deployment FROM army_list_shares LIMIT 1' },
  { label: 'Peana estándar por etiqueta', probe: 'SELECT base_width_cm FROM unit_type_tags LIMIT 1' },
  { label: 'Medidas de la mesa', probe: 'SELECT table_width_cm FROM army_lists LIMIT 1' },
  { label: 'Peanas redimensionadas', probe: 'SELECT w_cm FROM army_list_deployments LIMIT 1' },
  { label: 'Color de facción', probe: 'SELECT color FROM factions LIMIT 1' },
  { label: 'Alias de unidad', probe: 'SELECT alias FROM units LIMIT 1' },
  { label: 'Apéndices de unidad', probe: 'SELECT body_html FROM unit_appendices LIMIT 1' },
  { label: 'Mapas', probe: 'SELECT width_cm FROM battle_maps LIMIT 1' },
  { label: 'Mapas ocultos', probe: 'SELECT hidden FROM battle_maps LIMIT 1' },
  { label: 'Textura del mapa', probe: 'SELECT texture FROM battle_maps LIMIT 1' },
  { label: 'Biblioteca de escenografía', probe: 'SELECT image_key FROM scenery_assets LIMIT 1' },
  { label: 'Suelos de mapa', probe: 'SELECT image_key FROM floor_assets LIMIT 1' },
  { label: 'Versión de escenografía en las piezas', probe: 'SELECT asset_id FROM battle_map_pieces LIMIT 1' },
  { label: 'Suelo elegido en el mapa', probe: 'SELECT floor_id FROM battle_maps LIMIT 1' },
  { label: 'Escenografía de los mapas', probe: 'SELECT kind FROM battle_map_pieces LIMIT 1' },
  { label: 'Mapa cargado en el despliegue', probe: 'SELECT battle_map_id FROM army_lists LIMIT 1' },
  { label: 'Reglas destacadas por facción', probe: 'SELECT rule_id FROM faction_featured_rules LIMIT 1' },
  { label: 'Personajes de Renombre', probe: 'SELECT is_special_character FROM units LIMIT 1' },
  { label: 'Trasfondo del personaje', probe: 'SELECT background FROM units LIMIT 1' },
  { label: 'Retrato del personaje de renombre', probe: 'SELECT portrait_key FROM units LIMIT 1' },
  { label: 'Experiencia de los Personajes de Renombre', probe: 'SELECT amount FROM unit_experience_log LIMIT 1' },
  { label: 'Personajes de Renombre ocultos', probe: 'SELECT hidden FROM units LIMIT 1' },
  { label: 'Autor del personaje de renombre', probe: 'SELECT user_id FROM units LIMIT 1' },
  {
    label: 'Personajes de Renombre en las listas',
    probe: 'SELECT show_special_characters FROM army_lists LIMIT 1',
  },
  { label: 'Listas marcadas como listas', probe: 'SELECT ready FROM army_lists LIMIT 1' },
  { label: 'Lado de despliegue', probe: 'SELECT deployment_side FROM army_lists LIMIT 1' },
  { label: 'Imagen de fondo del despliegue', probe: 'SELECT deployment_image_key FROM army_lists LIMIT 1' },
]

/**
 * Devuelve las funciones cuya tabla o columna todavía no existe en D1. Lista
 * vacía = todo al día.
 *
 * Las comprobaciones van en paralelo y ninguna puede romper nada: son SELECT
 * con LIMIT 1. Si falla la red entera, se devuelve lista vacía en vez de
 * asustar con un aviso falso — el objetivo es detectar un despliegue a medias,
 * no diagnosticar la conexión.
 */
export async function findPendingMigrations(): Promise<string[]> {
  const results = await Promise.all(
    CHECKS.map(async (check) => {
      try {
        await query(check.probe, [], () => null)
        return null
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        // "no such table" / "no such column" = falta la migración. Cualquier
        // otro error (401, red caída) no significa eso y no debe avisar.
        return /no such (table|column)/i.test(message) ? check.label : null
      }
    }),
  )
  return results.filter((r): r is string => r !== null)
}
