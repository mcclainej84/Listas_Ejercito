-- ============================================================================
-- WHArmy · Esquema de datos maestros (Single Source of Truth)
-- ============================================================================
-- Este fichero es la definición canónica del modelo relacional. El binario
-- SQLite servido a la app (public/data/warhammer.db) se genera SIEMPRE a
-- partir de este esquema + scripts/etl_datos_json.py. Nunca se edita el
-- .db a mano ni se guardan datos maestros en otro sitio.
--
-- Convenciones:
--   - Todas las tablas usan "id" entero autoincremental como PK propia
--     (no reutilizamos los IDs del datos.json original, para no acoplarnos
--     a una fuente de importación concreta).
--   - Las tablas de unión (N:M) no tienen PK propia, solo la compuesta.
--   - Los campos de validación (min/max, incompatibilidades, obligatoriedad)
--     existen desde el principio aunque la importación inicial los deje
--     vacíos: se rellenan luego desde el módulo de Administración.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- Facciones
--
-- El emblema tiene dos posibles orígenes, resueltos siempre en este orden:
--   1. emblem_data / emblem_mime — imagen subida por el usuario desde
--      Administración. Al no haber servidor, se guarda como BLOB dentro de
--      la propia base de datos (igual que cualquier otro dato editable).
--      Se redimensiona/comprime en el navegador antes de guardarla (ver
--      shared/image.ts) para no disparar el tamaño de la BBDD, que se
--      reexporta entera en cada escritura.
--   2. image_path — emblema de fábrica incluido en el propio repositorio
--      (public/assets/factions/...), usado como valor por defecto mientras
--      el usuario no suba uno propio.
-- "Borrar el emblema" solo vacía emblem_data/emblem_mime; si la facción
-- tenía una imagen de fábrica, vuelve a mostrarse esa.
-- ----------------------------------------------------------------------------
CREATE TABLE factions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL UNIQUE,
    slug         TEXT NOT NULL UNIQUE,
    image_path   TEXT,               -- emblema de fábrica, dentro de /public/assets/factions
    emblem_data  BLOB,               -- emblema subido por el usuario (anula el de fábrica si existe)
    emblem_mime  TEXT,
    description  TEXT,
    sort_order   INTEGER NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- Categorías de unidad (slot de organización de ejército: Básicas/Especiales/
-- Singulares/Personajes/Asedio/Bestia). Tabla global y editable en vez de un
-- ENUM fijo, para no acoplar el modelo a una organización de ejército
-- concreta (distintas facciones/juegos futuros podrían necesitar categorías
-- propias).
--
-- 'PERSONAJE' agrupa fichas de personaje. 'ASEDIO' y 'BESTIA' agrupan todas
-- las unidades de las facciones "Asedio" y "Bestias" respectivamente — antes
-- no tenían categoría estándar en el origen y quedaban en un cajón genérico
-- '(-)' (SIN_CATEGORIA); esa categoría se eliminó una vez reasignadas todas
-- sus unidades a una categoría real (ver scripts/etl_datos_json.py).
-- ----------------------------------------------------------------------------
CREATE TABLE unit_categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    code       TEXT NOT NULL UNIQUE,   -- 'BASICA', 'ESPECIAL', 'SINGULAR', 'PERSONAJE', 'ASEDIO', 'BESTIA'
    name       TEXT NOT NULL,          -- nombre visible, editable
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- Etiquetas de TIPO de unidad (Infantería, Proyectiles, Caballería, Monstruo,
-- Máquina de guerra...) — un catálogo totalmente distinto e independiente de
-- unit_categories: esta no es el "hueco" de organización de ejército
-- (Básica/Especial/Singular...), sino qué es la unidad sobre la mesa. Es
-- solo informativa (etiqueta visible en la ficha, ver ARCHITECTURE.md), no
-- interviene en ninguna validación de legalidad de lista. Se importó desde
-- "Categoria tropas.xlsx" (columna Etiqueta), emparejando cada fila con
-- units.id por posición (mismo orden de inserción 1:1, ver ARCHITECTURE.md).
-- ----------------------------------------------------------------------------
CREATE TABLE unit_type_tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    code       TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- Perfiles de atributos (M, HA, HP, F, R, H, I, A, L).
--
-- Una unidad NO tiene un único perfil: puede tener varios asociados a la vez
-- (su propio perfil base, y opcionalmente el de su montura y/o el de su
-- carro — hay unidades con los tres a la vez, p.ej. un carro de guerra).
-- Antes existían tres tablas idénticas en forma (attribute_profiles, mounts,
-- chariots) solo porque el origen las traía separadas; se ha unificado en
-- una sola tabla + la relación N:M `unit_profiles` de más abajo, que es la
-- que de verdad decide cuántos perfiles y de qué tipo tiene cada unidad.
--
-- `name` es NULL cuando el perfil es "el perfil propio de su unidad" (usa el
-- nombre de la unidad); tiene valor cuando es un perfil reutilizable con
-- nombre propio (p.ej. una montura "Corcel élfico" usada por varias
-- unidades de varias facciones, o un carro "Carro de Gélidos").
--
-- `profile_kind` distingue explícitamente el tipo de perfil (antes solo se
-- deducía de si tenía `name` o no, y de cómo lo referenciaba unit_profiles).
-- Se necesita como campo propio para que los catálogos "Monturas" y "Carros"
-- (ver `profile_factions`) puedan listar sus fichas sin tener que inferirlo
-- indirectamente. 'unidad' cubre tanto el perfil base de una tropa como el
-- de un Campeón individual (unit_command_options.profile_id) — ambos son
-- "la ficha propia de alguien", no un perfil reutilizable de catálogo.
-- ----------------------------------------------------------------------------
CREATE TABLE attribute_profiles (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT,
    profile_kind TEXT NOT NULL DEFAULT 'unidad' CHECK (profile_kind IN ('unidad', 'montura', 'carro')),
    -- Solo tiene sentido para profile_kind = 'montura' (catálogo
    -- "Montura/Dotación"): si un personaje puede montarla individualmente,
    -- no solo una unidad completa. Por defecto 0/false para todo lo
    -- existente — se marca caso por caso desde Administración > Monturas.
    equippable_by_character INTEGER NOT NULL DEFAULT 0,
    -- Si esta ficha debe aparecer además como una ficha más en la sección
    -- "Fichas" (mismo criterio que upgrades.include_in_sheets). Por defecto
    -- NO: el catálogo de monturas incluye muchas dotaciones y cabalgaduras de
    -- tropa que no interesa imprimir por separado. Se marcan las que sí, una
    -- a una, desde Editor > Montura/Dotación.
    include_in_sheets INTEGER NOT NULL DEFAULT 0,
    m   TEXT,  -- Movimiento   (TEXT porque el origen usa "-" para "no aplica")
    ha  TEXT,  -- Habilidad de Armas
    hp  TEXT,  -- Habilidad de Proyectiles
    f   TEXT,  -- Fuerza
    r   TEXT,  -- Resistencia
    h   TEXT,  -- Heridas
    i   TEXT,  -- Iniciativa
    a   TEXT,  -- Ataques
    l   TEXT   -- Liderazgo
);

-- ----------------------------------------------------------------------------
-- Facciones que pueden elegir una montura o un carro concreto (catálogos
-- "Monturas" y "Carros" de Administración). Solo tiene sentido para perfiles
-- con profile_kind IN ('montura', 'carro'). Una unidad solo puede añadir a su
-- ficha (unit_profiles) monturas/carros asociados a su propia facción — la
-- UI filtra por esto; el modelo no lo fuerza con una FK compuesta para no
-- acoplar unit_profiles a factions innecesariamente, pero la capa de datos
-- respeta siempre esta restricción.
-- ----------------------------------------------------------------------------
CREATE TABLE profile_factions (
    profile_id INTEGER NOT NULL REFERENCES attribute_profiles(id) ON DELETE CASCADE,
    faction_id INTEGER NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, faction_id)
);

-- ----------------------------------------------------------------------------
-- Reglas especiales — única fuente de verdad para nombre + descripción.
-- Todo el resto de la app referencia esta tabla por id; nunca se copia el
-- texto de una regla en otro sitio.
-- ----------------------------------------------------------------------------
CREATE TABLE special_rules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT ''
);

-- ----------------------------------------------------------------------------
-- Reglas especiales propias de una ficha del catálogo "Montura/Dotación"
-- (N:M), análogo a unit_special_rules pero para attribute_profiles. Existe
-- porque muchas monturas son MONSTRUOS con reglas propias (Vuela, Miedo,
-- Aliento de fuego...) que no pertenecen al jinete: si se guardaran en
-- unit_special_rules habría que repetirlas en cada unidad que pueda montar
-- ese monstruo, y al corregir una se corregiría en un solo sitio dejando el
-- resto mal.
--
-- Se llenan solo para profile_kind = 'montura' (los carros no tienen editor
-- de reglas en la interfaz), pero la tabla no lo restringe: la clave ajena
-- apunta a attribute_profiles a secas, igual que profile_factions.
--
-- Al pintar una unidad, estas reglas se SUMAN a las suyas (sin duplicar)
-- cuando la montura forma parte de su ficha — ver mergeProfileRules en
-- src/domain/rules.ts.
-- ----------------------------------------------------------------------------
CREATE TABLE profile_special_rules (
    profile_id INTEGER NOT NULL REFERENCES attribute_profiles(id) ON DELETE CASCADE,
    rule_id    INTEGER NOT NULL REFERENCES special_rules(id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, rule_id)
);

-- ----------------------------------------------------------------------------
-- Opciones de equipo — piezas ATÓMICAS (arma, armadura, escudo...), ya no
-- paquetes combinados. El origen ("Manuscritos de Nuth") modelaba el equipo
-- como paquetes ya combinados con "/" (p.ej. "2AM / A.Pesada" con su propio
-- coste único). El ETL descompone esos paquetes en sus piezas sueltas
-- siempre que sea seguro hacerlo (ver docstring de
-- scripts/etl_datos_json.py — build_equipment): si todas las piezas de un
-- paquete ya están disponibles por separado para esa misma unidad y su coste
-- combinado coincide exactamente con la suma de las piezas sueltas, el
-- paquete es redundante y se descarta (queda cubierto eligiendo las piezas
-- sueltas). Cuando no se puede descomponer con garantías, el paquete se
-- conserva tal cual como una opción propia (category = NULL).
--
-- `category` agrupa piezas del mismo "hueco" de equipo (armadura, escudo,
-- arma cuerpo a cuerpo, arma a distancia) para poder ofrecer luego
-- exclusividad entre alternativas del mismo hueco (ver
-- equipment_incompatibilities). NULL = pieza sin categoría reconocida
-- (accesorios, mejoras varias...), siempre combinable sin restricción.
-- ----------------------------------------------------------------------------
CREATE TABLE equipment_options (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL,
    cost     INTEGER NOT NULL DEFAULT 0,
    category TEXT   -- 'armadura' | 'escudo' | 'arma_cac' | 'arma_dist' | NULL
);

-- Incompatibilidades entre opciones de equipo (equipo ilegal / alternativas
-- excluyentes del mismo hueco, p.ej. Alabarda vs Lanza). El ETL las genera
-- automáticamente: dos piezas de la misma `category` disponibles para la
-- misma unidad son incompatibles salvo que el origen las haya ofrecido
-- combinadas alguna vez en algún paquete (evidencia de que sí se pueden
-- llevar juntas, p.ej. Ballesta ligera + Hachas arrojadizas). También se
-- pueden añadir/quitar a mano desde Administración para casos que el
-- análisis automático no capture bien.
CREATE TABLE equipment_incompatibilities (
    equipment_id_a INTEGER NOT NULL REFERENCES equipment_options(id) ON DELETE CASCADE,
    equipment_id_b INTEGER NOT NULL REFERENCES equipment_options(id) ON DELETE CASCADE,
    reason         TEXT,
    PRIMARY KEY (equipment_id_a, equipment_id_b),
    CHECK (equipment_id_a < equipment_id_b)
);

-- ----------------------------------------------------------------------------
-- Mejoras / opciones genéricas de unidad (p.ej. "Arcabuz", "Corcel adicional")
-- Distintas de equipment_options: no son un loadout de combate sino una
-- mejora puntual que se añade a la unidad o a un miembro de ella.
-- ----------------------------------------------------------------------------
CREATE TABLE upgrades (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cost INTEGER NOT NULL DEFAULT 0,

    -- Algunas opciones de unidad tienen FICHA propia (p.ej. los "grupos de
    -- apoyo"): un perfil de atributos que, al elegir la opción dentro de una
    -- unidad, se añade a su tabla de características igual que una montura.
    -- NULL = la opción no tiene ficha (el caso normal).
    profile_id        INTEGER REFERENCES attribute_profiles(id) ON DELETE SET NULL,

    -- Si esta opción debe aparecer además como una ficha más en la sección
    -- "Fichas". Solo tiene sentido en las que llevan perfil propio.
    include_in_sheets INTEGER NOT NULL DEFAULT 0
);

-- Reglas especiales propias de una opción de unidad con ficha (N:M), análogo a
-- unit_special_rules pero para upgrades.
CREATE TABLE upgrade_special_rules (
    upgrade_id INTEGER NOT NULL REFERENCES upgrades(id) ON DELETE CASCADE,
    rule_id    INTEGER NOT NULL REFERENCES special_rules(id) ON DELETE CASCADE,
    PRIMARY KEY (upgrade_id, rule_id)
);

CREATE TABLE upgrade_incompatibilities (
    upgrade_id_a INTEGER NOT NULL REFERENCES upgrades(id) ON DELETE CASCADE,
    upgrade_id_b INTEGER NOT NULL REFERENCES upgrades(id) ON DELETE CASCADE,
    reason       TEXT,
    PRIMARY KEY (upgrade_id_a, upgrade_id_b),
    CHECK (upgrade_id_a < upgrade_id_b)
);

-- ----------------------------------------------------------------------------
-- Roles de grupo de mando (Músico, Portaestandarte, Campeón...) — catálogo
-- global en vez de tres columnas fijas, para poder añadir roles nuevos sin
-- tocar el esquema.
-- ----------------------------------------------------------------------------
CREATE TABLE command_roles (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,   -- 'MUSICO' | 'PORTAESTANDARTE' | 'CAMPEON'
    name TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- Unidades y personajes.
-- Un único tipo de entidad para ambos (unit_type distingue), porque
-- comparten prácticamente todos los atributos y relaciones; separarlos en
-- dos tablas obligaría a duplicar toda esta estructura (viola DRY).
-- ----------------------------------------------------------------------------
CREATE TABLE units (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    faction_id        INTEGER NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    category_id       INTEGER REFERENCES unit_categories(id),
    type_tag_id       INTEGER REFERENCES unit_type_tags(id),  -- etiqueta informativa (Infantería/Caballería/Monstruo...), ver unit_type_tags
    unit_type         TEXT NOT NULL DEFAULT 'tropa' CHECK (unit_type IN ('tropa', 'personaje')),
    name              TEXT NOT NULL,
    base_cost         INTEGER NOT NULL DEFAULT 0,   -- coste por miniatura (o coste único si max_size=1)

    -- --- Campos de validación (constructor de listas) ---
    min_size          INTEGER,              -- tamaño mínimo de la unidad; NULL = sin definir todavía
    max_size          INTEGER,              -- tamaño máximo; NULL = sin límite / sin definir
    -- Tamaño "de partida" sugerido (el campo NUMERO del origen: en el Hoja
    -- de Ejército original solo se usaba para autocompletar el campo
    -- "número" al elegir la tropa — nunca fue un máximo real, ver
    -- ARCHITECTURE.md). Se guarda aparte de min_size/max_size (que siguen
    -- siendo límites de validación, no defaults) para poder precargar la
    -- cantidad al añadir una unidad a una lista sin bloquear cantidades
    -- mayores. NULL = sin sugerencia, se usa min_size o 1.
    default_size      INTEGER,
    -- 0/1 — unidad "0-1": en el ejército solo cabe UNA unidad de este tipo.
    -- No limita su TAMAÑO (eso es min_size/max_size): sigue siendo un
    -- regimiento normal, casi siempre de varias miniaturas. Solo tiene
    -- sentido en tropas; en personajes se ignora al leer (ver mapUnit).
    is_unique         INTEGER NOT NULL DEFAULT 0,

    -- Equipo básico que la unidad siempre lleva (texto libre, no hay campo
    -- equivalente en el origen: se rellena desde Administración). T.S. es
    -- la tirada de salvación por armadura resultante; de momento se deja
    -- vacía para todas las unidades y se completa manualmente.
    equipment_text    TEXT,
    armor_save        INTEGER,

    notes             TEXT,
    sort_order        INTEGER NOT NULL DEFAULT 0,

    -- Unidad activa (1) o desactivada (0): las desactivadas siguen existiendo
    -- y editándose en Administración, pero NO se ofrecen al montar ejércitos.
    -- Por defecto todo activo.
    active            INTEGER NOT NULL DEFAULT 1,

    -- Marca de HECHICERO. Solo dice si la unidad lanza hechizos; qué sendas
    -- lleva y de qué nivel se decide al meterla en un ejército
    -- (army_list_entry_magic_paths), no aquí: dos Videntes Grises de dos
    -- listas distintas pueden llevar sendas distintas.
    is_wizard         INTEGER NOT NULL DEFAULT 0,

    -- Resto de una versión anterior en la que el nivel era de la unidad. Ya no
    -- se escribe desde ningún sitio; se conserva para no perder lo guardado.
    magic_level       INTEGER
);

CREATE INDEX idx_units_faction ON units(faction_id);
CREATE INDEX idx_units_category ON units(category_id);
CREATE INDEX idx_units_type_tag ON units(type_tag_id);

-- Perfiles de atributos asociados a una unidad (N:M) — el corazón de la
-- ficha. `role` indica qué es cada perfil dentro de la unidad; una unidad
-- puede tener varias filas a la vez (típicamente 1 'base' + 0..N 'montura'
-- + 0..N 'carro'). `sort_order` decide el orden de aparición cuando hay
-- varias opciones del mismo rol (p.ej. varias monturas disponibles).
--
-- `cost`: coste EXTRA en puntos por llevar esta montura/carro concreta —
-- solo tiene sentido para role IN ('montura','carro') de PERSONAJES (los
-- Lores/Héroes de Warhammer pagan puntos por su montura; una unidad de
-- tropa normal no — ver ARCHITECTURE.md). NULL = sin coste adicional (el
-- comportamiento de siempre: la montura viene "gratis" incluida, como en
-- todas las unidades de tropa). El mismo perfil de montura puede costar
-- distinto a personajes distintos (p.ej. un Gélido cuesta distinto a un
-- Saurio Viejaestirpe que a un Saurio Escamadura), de ahí que el coste viva
-- aquí (por combinación unidad+perfil) y no en attribute_profiles.
CREATE TABLE unit_profiles (
    unit_id    INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    profile_id INTEGER NOT NULL REFERENCES attribute_profiles(id) ON DELETE CASCADE,
    role       TEXT NOT NULL CHECK (role IN ('base', 'montura', 'carro')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    cost       INTEGER,
    PRIMARY KEY (unit_id, profile_id, role)
);

-- Reglas especiales de una unidad (N:M)
CREATE TABLE unit_special_rules (
    unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    rule_id INTEGER NOT NULL REFERENCES special_rules(id) ON DELETE CASCADE,
    PRIMARY KEY (unit_id, rule_id)
);

-- Opciones de equipo disponibles para una unidad (N:M). `is_default` = viene
-- ya marcada al añadir la unidad a una lista de ejército (ver
-- ArmyListBuilderPage.tsx#handlePickUnit); editable desde Administración.
CREATE TABLE unit_equipment_options (
    unit_id       INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    equipment_id  INTEGER NOT NULL REFERENCES equipment_options(id) ON DELETE CASCADE,
    is_default    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (unit_id, equipment_id)
);

-- Mejoras/opciones disponibles para una unidad (N:M). Mismo `is_default` que
-- unit_equipment_options y mismo motivo.
CREATE TABLE unit_upgrade_options (
    unit_id    INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    upgrade_id INTEGER NOT NULL REFERENCES upgrades(id) ON DELETE CASCADE,
    max_per_unit INTEGER,   -- NULL = sin límite conocido todavía
    is_default   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (unit_id, upgrade_id)
);

-- Coste de cada rol de mando disponible en una unidad. `custom_name` permite
-- que una unidad concreta llame a su campeón/músico/portaestandarte de otra
-- forma (p.ej. "Herrero rúnico" en vez de "Campeón"); NULL = usa el nombre
-- genérico del rol (command_roles.name).
--
-- `profile_id` es la ficha de atributos propia de ese miembro del grupo de
-- mando — de momento solo tiene sentido (y se rellena) para el rol CAMPEON,
-- que sí necesita su propia línea de estadísticas en la ficha de la unidad.
-- Por defecto el ETL genera esa ficha como el perfil base de la unidad con
-- +1 en Ataques (ver bump_attacks en el ETL); es editable después desde
-- Administración igual que cualquier otro perfil. NULL = ese rol no tiene
-- ficha propia (Músico/Portaestandarte usan la de la propia unidad).
CREATE TABLE unit_command_options (
    unit_id         INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    command_role_id INTEGER NOT NULL REFERENCES command_roles(id) ON DELETE CASCADE,
    cost            INTEGER NOT NULL DEFAULT 0,
    custom_name     TEXT,
    profile_id      INTEGER REFERENCES attribute_profiles(id) ON DELETE SET NULL,
    PRIMARY KEY (unit_id, command_role_id)
);

-- ----------------------------------------------------------------------------
-- Fichas (sección "Fichas", estilo CodexMaker): overrides puramente
-- PRESENTACIONALES por unidad, nunca datos de juego (esos ya viven en
-- units/attribute_profiles/unit_special_rules/... y se editan en Editor). Fila
-- 1:1 con units, creada de forma perezosa (INSERT OR IGNORE) la primera vez
-- que se toca algo de la ficha de esa unidad — la mayoría de unidades no
-- tendrán fila aquí nunca.
--
-- Deliberadamente FUERA de CATALOG_TABLES/SNAPSHOT_TABLES (ver
-- localCatalog.ts / worker/src/index.ts): a diferencia del resto del
-- catálogo, esta tabla puede llegar a pesar mucho (una ilustración
-- comprimida por unidad, potencialmente cientos de unidades) y GET /snapshot
-- se pide entero en cada apertura de la app aunque el usuario nunca abra
-- Fichas. Se lee/escribe 100% por red (query/queryOne/exec/execBatch de
-- data/sqlite/client.ts), igual que army_lists, y por el mismo motivo aunque
-- distinto (aquí es tamaño, en army_lists es que cambian constantemente).
--
-- `illu_*`: imagen de la miniatura/unidad, con posición y zoom libres sobre
-- la ficha (arrastrable), brillo y volteo horizontal — replica el
-- comportamiento de CodexMaker. `illu_pos_x`/`illu_pos_y` son NULL hasta que
-- el usuario arrastra la imagen por primera vez (se calcula una posición por
-- defecto en el cliente, igual que el `ensureIlluDefaultPos` del programa de
-- referencia).
--
-- `emblem_*`: escudo/emblema propio de ESTA ficha únicamente, que anula (solo
-- aquí) el emblema de la facción (factions.emblem_data/image_path, resuelto
-- por factionRepository). NULL = usa el de la facción, como siempre.
--
-- `card_max_height`: alto máximo en px de la ficha (300-800, por defecto
-- 800 = "sin límite práctico"); si el contenido no cabe, se recorta por
-- abajo, nunca por arriba.
--
-- `completed`: marca puramente interna ("ya he terminado esta ficha"), nunca
-- se muestra en ningún export ni en el constructor de listas — solo sirve
-- para filtrar/organizar el panel "Tus fichas".
--
-- Lo que CodexMaker trata como ajustes GLOBALES de la sesión (Vista
-- color/blanco-y-negro, Marco sí/no) NO se guarda aquí ni en ningún sitio:
-- son un simple estado de UI de la página Fichas, igual que en el programa
-- original (ver FichasPage.tsx), que se reinicia cada vez que se recarga.
-- ----------------------------------------------------------------------------
-- MAGIA
--
-- Una SENDA agrupa hechizos (Fuego, Nigromancia, Bestias…) y pertenece a uno
-- de cuatro GRUPOS cerrados: ELEMENTALES, MISTICAS, OSCURAS y MANUSCRITOS.
-- El grupo va como texto y no como tabla aparte porque son cuatro, fijos, y no
-- se crean desde la interfaz — ver domain/magic.ts, que es donde vive esa
-- lista y sus etiquetas para pantalla.
--
-- La estructura normal de una senda son 7 hechizos (2 de nivel 1, 2 de nivel
-- 2, 2 de nivel 3 y 1 de nivel 4), pero NO se fuerza en el esquema: dos sendas
-- del catálogo original vienen fuera de esa norma y son datos legítimos. El
-- tope se aplica al editar (MAX_SPELLS_PER_PATH), no al guardar.
-- ----------------------------------------------------------------------------
CREATE TABLE magic_paths (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    code       TEXT NOT NULL UNIQUE,   -- FUEGO, NIGROMANCIA...
    name       TEXT NOT NULL,          -- "Fuego", "Nigromancia"
    group_code TEXT NOT NULL,          -- ELEMENTALES | MISTICAS | OSCURAS | MANUSCRITOS
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- `range_text` y no `range`: RANGE es palabra reservada de SQL.
CREATE TABLE magic_spells (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    path_id      INTEGER NOT NULL REFERENCES magic_paths(id) ON DELETE CASCADE,
    level        INTEGER NOT NULL,   -- 1 a 4
    name         TEXT NOT NULL,
    difficulty   TEXT,               -- "6+", "9+"
    range_text   TEXT,               -- "60 cm.", "Sin límite"
    hits         TEXT,               -- "1D6", "1xFila", "Plantilla"
    damage       TEXT,               -- "F4", "Hiere 5+"
    stays_active INTEGER NOT NULL DEFAULT 0,
    cac          TEXT,               -- "Fuera del CaC", "En CaC", "Dentro o Fuera del CaC"
    rules        TEXT,
    sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_magic_spells_path ON magic_spells(path_id);

-- Sendas que conoce una unidad. Tabla de unión y no una columna porque un
-- hechicero puede conocer VARIAS sendas a la vez.
CREATE TABLE unit_magic_paths (
    unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    path_id INTEGER NOT NULL REFERENCES magic_paths(id) ON DELETE CASCADE,
    PRIMARY KEY (unit_id, path_id)
);

-- ----------------------------------------------------------------------------
CREATE TABLE unit_sheets (
    unit_id            INTEGER PRIMARY KEY REFERENCES units(id) ON DELETE CASCADE,
    -- Las imágenes viven en R2 (ver /image en worker/src/index.ts): aquí solo
    -- se guarda la CLAVE del objeto. Las columnas *_data se conservan porque
    -- las bases creadas antes de esa migración todavía las usan y el cliente
    -- lee de ellas si no hay clave (ver resolveImageUrl en
    -- unitSheetRepository.ts); en una base nueva nacen y se quedan a NULL.
    illu_key           TEXT,
    illu_data          BLOB,
    illu_mime          TEXT,
    illu_original_name TEXT,
    illu_width_pct     INTEGER NOT NULL DEFAULT 34,
    illu_pos_x         REAL,
    illu_pos_y         REAL,
    illu_brightness    INTEGER NOT NULL DEFAULT 100,
    illu_flipped       INTEGER NOT NULL DEFAULT 0,
    emblem_key         TEXT,
    emblem_data        BLOB,
    emblem_mime        TEXT,
    card_max_height    INTEGER NOT NULL DEFAULT 800,
    completed          INTEGER NOT NULL DEFAULT 0,
    -- Ancho de cada apartado de texto, en % del ancho útil de la tarjeta:
    -- {"opciones":45,"reglas":100}. Va como JSON y no en una columna por
    -- apartado porque son seis, casi siempre vacío (todos por defecto) y la
    -- lista puede crecer; ver domain/sheetSections.ts.
    section_widths     TEXT NOT NULL DEFAULT '{}',
    -- Fichas de atributos ocultas en esta hoja: ["montura-9","upgrade-3"].
    -- Se guardan las OCULTAS y no las visibles para que, al añadirle luego una
    -- montura o un campeón a la unidad, su fila aparezca por defecto en vez de
    -- quedarse invisible sin motivo aparente.
    hidden_profiles    TEXT NOT NULL DEFAULT '[]'
);

-- ----------------------------------------------------------------------------
-- Reglas de construcción de lista a nivel de facción (motor de reglas
-- flexible en vez de columnas rígidas: "debe incluir al menos 1 Señor",
-- "máximo 3 unidades Raras", "los Héroes no pueden superar el nº de Señores"...
-- Los `params` se guardan como JSON y los interpreta la capa de dominio.
-- ----------------------------------------------------------------------------
CREATE TABLE faction_construction_rules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    faction_id  INTEGER NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    rule_type   TEXT NOT NULL,   -- p.ej. 'MAX_PERCENT_POINTS', 'MIN_COUNT', 'MAX_COUNT', 'REQUIRES'
    description TEXT NOT NULL,
    params      TEXT NOT NULL DEFAULT '{}'   -- JSON
);

-- ----------------------------------------------------------------------------
-- Constructor de listas ("Ejércitos"): listas de ejército guardadas por el
-- usuario, con sus entradas (unidades añadidas y cómo están equipadas).
-- Vive enteramente en el navegador igual que el resto de la app (ver punto 3
-- de ARCHITECTURE.md) — no hay "usuarios", así que de momento todas las
-- listas guardadas son visibles para quien abra la app, igual que los datos
-- maestros de Administración.
--
-- `attribute_profiles` (monturas/carros) no tiene coste propio — el coste
-- (si lo hay) vive en `unit_profiles.cost`, por combinación unidad+perfil
-- (ver ese comentario): la mayoría de unidades de tropa lo llevan a NULL, ya
-- incluido en su coste base, igual que en el origen; los personajes
-- (Lores/Héroes) sí suelen pagar puntos extra por su montura, y ese coste se
-- suma en `domain/armyValidation.ts#computeEntryCost`. `upgrades`/
-- `equipment_options` siguen sin coste "por elegir" más allá del ya
-- modelado en su propia tabla. `mount_profile_id`/`chariot_profile_id` solo
-- registran CUÁL de las opciones disponibles se ha elegido cuando una unidad
-- ofrece más de una — si solo tiene una, se auto-selecciona (con o sin
-- coste, según tenga o no `unit_profiles.cost`).
-- ----------------------------------------------------------------------------
-- Composición del ejército: cuántas unidades de cada categoría son
-- OBLIGATORIAS (mínimo) o como mucho permitidas (máximo), según los puntos de
-- la lista.
--
-- Configuración GLOBAL: una sola para todos los ejércitos, no por lista ni por
-- facción. Una categoría sin fila aquí simplemente no tiene restricción.
--
-- No se guarda la tabla del reglamento fila a fila, sino la REGLA que la
-- genera: valor base + cuánto sube por cada tramo de puntos (ver
-- TIER_START_POINTS/TIER_SIZE_POINTS en domain/armyComposition.ts). Guardar
-- filas obligaría a añadirlas a mano para 5.000, 6.000… y dejaría fuera
-- cualquier categoría creada desde "Categorías y Etiquetas".
-- ----------------------------------------------------------------------------
CREATE TABLE category_composition_rules (
    category_id INTEGER PRIMARY KEY REFERENCES unit_categories(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK (kind IN ('min', 'max')),
    base        INTEGER NOT NULL DEFAULT 0,   -- valor en el tramo más bajo
    step        INTEGER NOT NULL DEFAULT 0    -- cuánto sube por cada tramo
);

-- ----------------------------------------------------------------------------
CREATE TABLE army_lists (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    faction_id   INTEGER NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    points_limit INTEGER,       -- NULL = sin límite; si tiene valor, solo avisa al superarlo (no bloquea)
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    -- Dueño de la lista: cada usuario ve solo las suyas. NULL = listas creadas
    -- antes de que existieran los usuarios (se muestran a todo el mundo).
    user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_army_lists_faction ON army_lists(faction_id);

-- Una entrada = una línea de la lista ("Nº unidades de Tropa X, con este
-- equipo/opciones/grupo de mando"), igual que una fila de la tabla del Hoja
-- de Ejército original. `quantity` debe respetar units.min_size/max_size —
-- la validación vive en domain/armyValidation.ts, no aquí (SQLite no puede
-- expresar "entre el mínimo y el máximo de otra fila" en un CHECK simple).
CREATE TABLE army_list_entries (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    army_list_id        INTEGER NOT NULL REFERENCES army_lists(id) ON DELETE CASCADE,
    unit_id             INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    quantity            INTEGER NOT NULL DEFAULT 1,
    mount_profile_id    INTEGER REFERENCES attribute_profiles(id) ON DELETE SET NULL,
    chariot_profile_id  INTEGER REFERENCES attribute_profiles(id) ON DELETE SET NULL,
    has_standard_bearer INTEGER NOT NULL DEFAULT 0,
    has_musician        INTEGER NOT NULL DEFAULT 0,
    has_champion        INTEGER NOT NULL DEFAULT 0,
    champion_name       TEXT,    -- NULL = usa el nombre propio/genérico ya definido en la ficha de la unidad
    -- Nombre propio de ESTA miniatura en ESTA lista ("Jules el Bretón"). No
    -- sustituye al nombre de la unidad, se añade: la lista muestra
    -- "Jules el Bretón (Paladín Bretoniano)", porque el tipo sigue haciendo
    -- falta para saber qué reglas se aplican. NULL = sin nombre propio.
    alias               TEXT,
    sort_order          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_army_list_entries_list ON army_list_entries(army_list_id);

-- Sendas de magia de una entrada de lista, cada una con su NIVEL.
--
-- El nivel vive aquí y no en la unidad porque puede ser distinto por senda: un
-- mismo hechicero puede llevar Fuego a nivel 2 y Bestias a nivel 1. Y vive en
-- la ENTRADA y no en el catálogo porque es una decisión de esta lista: el
-- mismo personaje en otro ejército puede llevar otras sendas.
CREATE TABLE army_list_entry_magic_paths (
    entry_id INTEGER NOT NULL REFERENCES army_list_entries(id) ON DELETE CASCADE,
    path_id  INTEGER NOT NULL REFERENCES magic_paths(id) ON DELETE CASCADE,
    level    INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (entry_id, path_id)
);

-- Piezas de equipo elegidas para esta entrada (N:M) — a diferencia del "Hoja
-- de Ejército" original (un único desplegable de equipo por fila), aquí se
-- pueden marcar varias piezas sueltas a la vez, igual que en la ficha de la
-- unidad, respetando equipment_incompatibilities.
CREATE TABLE army_list_entry_equipment (
    entry_id     INTEGER NOT NULL REFERENCES army_list_entries(id) ON DELETE CASCADE,
    equipment_id INTEGER NOT NULL REFERENCES equipment_options(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, equipment_id)
);

-- Opciones de unidad ("mejoras") elegidas para esta entrada (N:M).
CREATE TABLE army_list_entry_upgrades (
    entry_id   INTEGER NOT NULL REFERENCES army_list_entries(id) ON DELETE CASCADE,
    upgrade_id INTEGER NOT NULL REFERENCES upgrades(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, upgrade_id)
);

-- ----------------------------------------------------------------------------
-- Usuarios (PERFILES, no seguridad)
--
-- Sirven para saber QUIÉN eres y personalizar la vista: tus ejércitos y qué
-- facciones quieres ver. NO son una barrera de seguridad y así se decidió a
-- propósito: la API de lectura del Worker es pública, el "modo admin" se activa
-- sin contraseña y restablecer la contraseña no pide comprobación. Es una
-- herramienta de un grupo cerrado, no un producto multiusuario.
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,   -- SHA-256 del texto introducido (ver shared/hash.ts)
    created_at    TEXT NOT NULL,
    -- Facción favorita del usuario: sale preseleccionada en todas las
    -- pantallas con selector de facción (Hojas de Unidad, Ejércitos, Editor).
    -- ON DELETE SET NULL: si se borra la facción, el usuario se queda sin
    -- favorita, no con una referencia rota.
    favorite_faction_id INTEGER REFERENCES factions(id) ON DELETE SET NULL,
    -- Opciones de "Unidades en la lista" en el constructor de ejércitos: si se
    -- ve la línea de montura/carro y la de magia bajo cada unidad. Encendidas
    -- de salida (1) — ver la migración del Worker.
    show_mounts   INTEGER NOT NULL DEFAULT 1,
    show_magic    INTEGER NOT NULL DEFAULT 1
);

-- Reglas destacadas de cada FACCIÓN, iguales para todos los usuarios: forman
-- parte del catálogo compartido. Al montar un ejército, de las reglas que la
-- unidad lleva de verdad, estas salen primero y separadas del resto.
CREATE TABLE faction_featured_rules (
    faction_id INTEGER NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    rule_id    INTEGER NOT NULL REFERENCES special_rules(id) ON DELETE CASCADE,
    PRIMARY KEY (faction_id, rule_id)
);

-- OBSOLETA: la sustituye faction_featured_rules. Ya no se lee ni se escribe;
-- se conserva para no destruir lo que cada usuario hubiera marcado.
CREATE TABLE user_faction_rules (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    faction_id INTEGER NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    rule_id    INTEGER NOT NULL REFERENCES special_rules(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, faction_id, rule_id)
);

-- Facciones que un usuario ha decidido NO ver (en Fichas y Ejércitos). Se
-- guardan las OCULTAS y no las visibles para que, al añadir una facción nueva
-- al catálogo, aparezca por defecto para todo el mundo.
CREATE TABLE user_hidden_factions (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    faction_id INTEGER NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, faction_id)
);

-- ----------------------------------------------------------------------------
-- Metadatos de la importación (trazabilidad: de qué fuente y cuándo)
-- ----------------------------------------------------------------------------
CREATE TABLE import_meta (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    source        TEXT NOT NULL,
    imported_at   TEXT NOT NULL,
    schema_version TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- Registro de cambios del EDITOR (sección "Log"). Quién tocó qué y cuándo, en
-- los datos maestros: facciones, unidades, reglas, equipo, monturas y carros.
--
-- Deliberadamente NO cubre Fichas ni Ejércitos: la presentación de una ficha y
-- las listas de ejército son trabajo personal de cada usuario, no catálogo
-- compartido, y llenarían el registro de ruido tapando lo que sí importa
-- auditar — los cambios que afectan a todo el grupo.
--
-- `username` va COPIADO y no solo referenciado: el registro tiene que seguir
-- diciendo quién hizo el cambio aunque ese usuario se borre después. Por eso
-- `user_id` es ON DELETE SET NULL y el nombre se guarda aparte.
--
-- Esta tabla NO forma parte del snapshot de catálogo (ver worker
-- SNAPSHOT_TABLES): crece sin parar y solo la lee su propia pantalla, así que
-- se consulta por red igual que las listas de ejército.
-- ----------------------------------------------------------------------------
CREATE TABLE change_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL,               -- ISO 8601 en UTC
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username    TEXT NOT NULL,
    entity      TEXT NOT NULL,               -- 'faccion' | 'unidad' | 'regla' | 'equipo' | 'opcion' | 'montura' | 'carro'
    entity_id   INTEGER,                     -- puede quedar apuntando a algo ya borrado: es un registro histórico
    action      TEXT NOT NULL CHECK (action IN ('crear', 'editar', 'borrar')),
    description TEXT NOT NULL
);

CREATE INDEX idx_change_log_created_at ON change_log (created_at DESC);

-- ----------------------------------------------------------------------------
-- Presentación de las fichas que NO son unidades: monturas/dotaciones del
-- catálogo y opciones de unidad con ficha propia (ver sección "Fichas").
--
-- Es gemela de unit_sheets en columnas, pero tabla aparte por una razón
-- concreta: unit_sheets.unit_id es clave ajena a units, y una montura no es
-- una unidad. Meterlas allí obligaría a quitar esa clave ajena —perdiendo el
-- borrado en cascada que hoy limpia la presentación al borrar una unidad— o a
-- inventar ids falsos. Duplicar las columnas sale más barato que degradar la
-- integridad de la tabla principal.
--
-- La clave es (kind, ref_id) porque los ids de montura y de opción son
-- independientes entre sí: puede existir la montura 5 y la opción 5.
--
-- La presentación es COMPARTIDA entre facciones a propósito: la ilustración de
-- un Gran Águila es la misma bestia la monte quien la monte. Lo que sí cambia
-- por facción es el emblema, que no se guarda aquí — se toma de la facción
-- desde la que se mira (ver upgradeSheet.ts).
-- ----------------------------------------------------------------------------
CREATE TABLE sheet_presentations (
    kind               TEXT NOT NULL CHECK (kind IN ('montura', 'opcion')),
    ref_id             INTEGER NOT NULL,
    -- Las imágenes viven en R2 (ver /image en worker/src/index.ts): aquí solo
    -- se guarda la CLAVE del objeto. Las columnas *_data se conservan porque
    -- las bases creadas antes de esa migración todavía las usan y el cliente
    -- lee de ellas si no hay clave (ver resolveImageUrl en
    -- unitSheetRepository.ts); en una base nueva nacen y se quedan a NULL.
    illu_key           TEXT,
    illu_data          BLOB,
    illu_mime          TEXT,
    illu_original_name TEXT,
    illu_width_pct     INTEGER NOT NULL DEFAULT 34,
    illu_pos_x         REAL,
    illu_pos_y         REAL,
    illu_brightness    INTEGER NOT NULL DEFAULT 100,
    illu_flipped       INTEGER NOT NULL DEFAULT 0,
    emblem_key         TEXT,
    emblem_data        BLOB,
    emblem_mime        TEXT,
    card_max_height    INTEGER NOT NULL DEFAULT 800,
    completed          INTEGER NOT NULL DEFAULT 0,
    section_widths     TEXT NOT NULL DEFAULT '{}',
    hidden_profiles    TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (kind, ref_id)
);
