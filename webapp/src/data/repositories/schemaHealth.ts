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
  { label: 'Monturas en la sección Hojas de Unidad', probe: 'SELECT include_in_sheets FROM attribute_profiles LIMIT 1' },
  { label: 'Unidades activas/inactivas', probe: 'SELECT active FROM units LIMIT 1' },
  { label: 'Opciones de unidad con ficha', probe: 'SELECT profile_id FROM upgrades LIMIT 1' },
  // Presentación de las hojas. Cada vez que se añade una de estas, hay que
  // sumarla AQUÍ: si no, su ajuste falla en silencio (la pantalla lo pinta,
  // la base de datos lo rechaza) y no hay nada que lo delate.
  { label: 'Hojas de montura y de opción', probe: 'SELECT ref_id FROM sheet_presentations LIMIT 1' },
  { label: 'Ancho de los apartados', probe: 'SELECT section_widths FROM unit_sheets LIMIT 1' },
  { label: 'Mostrar u ocultar fichas de atributos', probe: 'SELECT hidden_profiles FROM unit_sheets LIMIT 1' },
  { label: 'Facción favorita', probe: 'SELECT favorite_faction_id FROM users LIMIT 1' },
  { label: 'Reglas destacadas por facción', probe: 'SELECT rule_id FROM user_faction_rules LIMIT 1' },
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
