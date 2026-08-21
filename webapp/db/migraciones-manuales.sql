-- ============================================================================
-- Salida de emergencia: migraciones aplicadas A MANO contra la D1 de verdad.
--
-- El camino normal NO es este. Las migraciones viven en el código del Worker
-- (worker/src/index.ts#MIGRATIONS) y se aplican solas en cada carga de la
-- aplicación. Este archivo existe para el día en que ese camino falla y hay
-- que salir del paso sin esperar a diagnosticarlo:
--
--   cd webapp/worker
--   npx wrangler d1 execute wharmy-db --remote --file=../db/migraciones-manuales.sql
--
-- Es idempotente (todo va con IF NOT EXISTS), así que ejecutarlo dos veces no
-- hace daño. Lo que se ponga aquí tiene que estar TAMBIÉN en MIGRATIONS y en
-- db/schema.sql: esto es un atajo, no una fuente de verdad.
--
-- Para ver qué tiene la base de datos ahora mismo:
--   npx wrangler d1 execute wharmy-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
--   npx wrangler d1 execute wharmy-db --remote --command "PRAGMA table_info(army_lists)"
-- ============================================================================

CREATE TABLE IF NOT EXISTS battles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
  army_list_a_id  INTEGER NOT NULL REFERENCES army_lists(id) ON DELETE CASCADE,
  army_list_b_id  INTEGER NOT NULL REFERENCES army_lists(id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_battles_user ON battles(user_id);

-- OJO: esta NO es idempotente. SQLite no tiene "ADD COLUMN IF NOT EXISTS", así
-- que si la columna ya está, esta línea falla con "duplicate column name" y
-- corta el archivo. Si eso pasa, bórrala y vuelve a lanzar el resto.
ALTER TABLE battle_maps ADD COLUMN image_key TEXT;
ALTER TABLE army_lists ADD COLUMN emblem_faction_id INTEGER REFERENCES factions(id);
ALTER TABLE army_lists ADD COLUMN emblem_key TEXT;
