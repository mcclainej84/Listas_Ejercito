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

-- Finalizar una batalla: una firma por bando. Sin las dos, no se puede borrar.
ALTER TABLE battles ADD COLUMN finished_a INTEGER NOT NULL DEFAULT 0;
ALTER TABLE battles ADD COLUMN finished_b INTEGER NOT NULL DEFAULT 0;
-- Unidad oculta: no se le enseña al rival en la sección de Batallas.
ALTER TABLE army_list_entries ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;

-- Las contraseñas se mudan a su propia tabla, para que /query (público, admite
-- cualquier SELECT) deje de exponer la credencial con la que se escribe. En
-- este orden: crear, COPIAR, y solo entonces vaciar el original — vaciando solo
-- lo que se comprueba que está copiado. Al revés deja a todos sin contraseña.
CREATE TABLE IF NOT EXISTS user_secrets (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL
);
INSERT OR IGNORE INTO user_secrets (user_id, password_hash)
  SELECT id, password_hash FROM users WHERE password_hash <> '';
UPDATE users SET password_hash = ''
  WHERE password_hash <> '' AND id IN (SELECT user_id FROM user_secrets);
