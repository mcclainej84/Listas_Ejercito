#!/usr/bin/env python3
"""
ETL: HojaEjercito/datos.json  ->  public/data/warhammer.db (SQLite)

Este script es la ÚNICA vía autorizada para generar warhammer.db. La base de
datos servida a la app nunca se edita a mano: si hace falta un cambio en los
datos importados, se corrige aquí (o, mejor aún, luego desde el módulo de
Administración una vez la app esté funcionando) y se vuelve a ejecutar.

Uso:
    python3 scripts/etl_datos_json.py \
        --source ../HojaEjercito/datos.json \
        --schema db/schema.sql \
        --out public/data/warhammer.db

Decisiones de mapeo (documentadas también en ARCHITECTURE.md):
  - Los IDs del datos.json original NO se reutilizan como PK: se generan
    IDs nuevos y se guardan tablas de mapeo en memoria durante el proceso,
    para no acoplar el modelo final a la fuente de importación.
  - attribute_profiles se DEDUPLICA, pero en tres bolsas separadas (perfiles
    "base"/campeón de tropa, "montura", "carro"): dos perfiles con los mismos
    9 valores no se fusionan entre bolsas distintas, porque aunque coincidan
    numéricamente son conceptos distintos (un perfil de tropa no es lo mismo
    que un perfil de montura aunque el azar les dé las mismas estadísticas).
    Dentro de cada bolsa sí se comparte fila, honrando DRY / Single Source
    of Truth. La ficha del Campeón comparte bolsa con los perfiles base
    (profile_kind='unidad'), porque conceptualmente es lo mismo: "la ficha
    propia de alguien", no un perfil de catálogo reutilizable.
  - Una unidad puede tener VARIOS perfiles de atributos asociados a la vez
    (tabla unit_profiles): su perfil base siempre, y opcionalmente el de su
    montura y/o el de su carro — hay unidades con los tres simultáneamente
    (p.ej. las que en el origen aparecen a la vez en montura_tropas y
    carro_tropas). No es una relación 1:1 como en la primera versión de
    este script.
  - equipment_options NO se deduplica: aunque hay ~40 nombres repetidos con
    coste distinto, no hay garantía de que sean el mismo concepto en todas
    las facciones (posible inconsistencia del Excel/JSON original). Se deja
    tal cual y se anota como deuda de datos a revisar desde Admin.
  - Opciones de equipo combinadas ("A2M / A.Pesada"): se descomponen en sus
    piezas atómicas cuando es seguro hacerlo (ver build_equipment). Cada
    pieza atómica se clasifica en una `category` (armadura/escudo/arma
    cuerpo a cuerpo/arma a distancia) para poder derivar automáticamente
    qué combinaciones son excluyentes (equipment_incompatibilities).
  - unit_type: el dataset de origen no distingue tropas de personajes: todas
    las filas de "tropas" se importan como unit_type='tropa'. La distinción
    de personajes se introduce más adelante desde Administración.
  - min_size queda NULL (no existe esa información en el origen); max_size
    se rellena con el campo NUMERO como mejor aproximación disponible, a
    revisar/confirmar manualmente por unidad. equipment_text y armor_save
    tampoco existen en el origen: quedan NULL para todas las unidades y se
    rellenan a mano desde Administración.
"""
from __future__ import annotations

import argparse
import itertools
import json
import re
import sqlite3
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

# Debe coincidir con EXPECTED_SCHEMA_VERSION en src/data/sqlite/client.ts.
# Súbela cada vez que cambie db/schema.sql de forma incompatible (columnas o
# tablas nuevas/renombradas/eliminadas): la app usa este valor para detectar
# y descartar copias desactualizadas guardadas en el navegador del usuario.
SCHEMA_VERSION = "1.7.0"

# Tamaño del emblema de fábrica que se genera a partir de las ilustraciones
# de HojaEjercito/img: lo bastante grande para verse nítido en una tarjeta o
# cabecera, lo bastante pequeño para que 22 facciones no pesen nada al
# cargar (los originales son ilustraciones de ~1024x1024 de varios MB cada
# una). Los emblemas que suba un usuario se recomprimen igual, en el
# navegador, antes de guardarlos (ver src/shared/image.ts).
EMBLEM_MAX_SIZE = 480
EMBLEM_JPEG_QUALITY = 82

# El campo IMAGEN de datos.json no siempre coincide con el nombre real del
# fichero en HojaEjercito/img (p.ej. "Hombres Lagarto" apunta a
# "HLAGARTO.png", que no existe; el fichero real es "LAGARTOS.png").
# Corrección puntual documentada aquí en vez de renombrar el fichero de
# origen, que no es nuestro.
IMAGE_FILENAME_FIXUPS = {
    "HLAGARTO.png": "LAGARTOS.png",
}

CATEGORY_MAP = {
    "B": ("BASICA", "Básicas"),
    "E": ("ESPECIAL", "Especiales"),
    "S": ("SINGULAR", "Singulares"),
}

# El origen tiene un 4º código, "-", para unidades sin categoría estándar
# (asedio, monstruos sueltos, mercenarios...). Se resuelve por completo en
# esta importación, sin dejar ningún cajón genérico tipo "(-)":
#   - Las unidades de las facciones "Asedio" y "Bestias" (que en el origen
#     son íntegramente de tipo "-") van a sus propias categorías temáticas
#     ASEDIO_CATEGORY_CODE / BESTIA_CATEGORY_CODE.
#   - El resto de unidades sin categoría estándar (8 unidades sueltas de
#     otras facciones) se reasignan una a una a mano, ver
#     UNIT_CATEGORY_OVERRIDE_BY_NAME_AND_FACTION más abajo.
FALLBACK_CATEGORY_TIPO_CODE = "-"

ASEDIO_CATEGORY_CODE = "ASEDIO"
ASEDIO_CATEGORY_NAME = "Asedio"
BESTIA_CATEGORY_CODE = "BESTIA"
BESTIA_CATEGORY_NAME = "Bestia"

# Facciones cuyas unidades van ÍNTEGRAMENTE a una categoría temática propia,
# sin pasar por el tipo B/E/S del origen (todas eran "-" de todos modos).
FACTION_CATEGORY_OVERRIDE = {
    "Asedio": ASEDIO_CATEGORY_CODE,
    "Bestias": BESTIA_CATEGORY_CODE,
}

# Las 8 unidades restantes que quedaban sin categoría estándar en el origen
# y no pertenecen a "Asedio" ni "Bestias": reasignación manual pactada con el
# usuario, identificadas por (nombre ya limpio, facción) para no chocar con
# unidades homónimas de otras facciones.
UNIT_CATEGORY_OVERRIDE_BY_NAME_AND_FACTION: dict[tuple[str, str], str] = {
    ("Enjambre de duendes", "Elfos Silvanos"): "BASICA",
    ("Lobos salvajes", "Elfos Silvanos"): "BASICA",
    ("Buscamuerte", "Enanos"): "ESPECIAL",
    ("Esclavista", "Enanos del Caos"): "PERSONAJE",
    ("Mastines de Khorne", "Hordas del Caos"): "BASICA",
    ("Lobos gigantes", "Norsca"): "BASICA",
    ("Mastines", "Norsca"): "BASICA",
    ("Señor de las alimañas", "Skaven"): "PERSONAJE",
}

# Categoría nueva y vacía por ahora: fichas de personaje propiamente dichas
# (no las "tropas tipo personaje" del origen, que siguen siendo unit_type
# 'tropa'). Se irán creando fichas sueltas aquí desde Administración.
PERSONAJE_CATEGORY_CODE = "PERSONAJE"
PERSONAJE_CATEGORY_NAME = "Personajes"

COMMAND_ROLES = [
    ("MUSICO", "Músico"),
    ("PORTAESTANDARTE", "Portaestandarte"),
    ("CAMPEON", "Campeón"),
]

# ----------------------------------------------------------------------------
# Atomización de opciones de equipo.
#
# El origen modela el equipo como paquetes ya combinados con "/"
# (p.ej. "A2M / A.Pesada / Escudo"), no como piezas sueltas. build_equipment()
# los descompone: cada pieza atómica (sin "/") se clasifica aquí en una
# `category` — el "hueco" de equipo que ocupa — para poder derivar qué
# alternativas del mismo hueco son excluyentes entre sí (no puedes llevar dos
# armaduras a la vez, o un arco Y una ballesta a la vez) frente a piezas de
# huecos distintos, que siempre son combinables (una armadura no compite con
# un arma).
#
# El diccionario cubre los nombres de pieza más frecuentes en datos.json
# (ver análisis en la sesión de desarrollo); cualquier nombre no listado
# aquí queda sin categoría (category=NULL) y por tanto siempre combinable
# sin restricción — es el valor por defecto más seguro para piezas raras o
# ambiguas (accesorios, mejoras, opciones de tropa mal clasificadas como
# "equipo" en el origen), y quedan como deuda de datos revisable a mano
# desde Administración si hiciera falta ajustar alguna.
# ----------------------------------------------------------------------------
EQUIPMENT_CATEGORY: dict[str, str] = {}


def _register_category(category: str, names: list[str]) -> None:
    for name in names:
        EQUIPMENT_CATEGORY[name] = category


_register_category("armadura", [
    "A.Ligera", "A.ligera", "A.Pesada", "A.pesada", "A.Negra", "A.Ceremoniales",
    "A.Caos", "A.Norsca", "A.Gromril", "Barda", "Barda frontal",
])
_register_category("escudo", ["Escudo"])
_register_category("arma_cac", [
    "2AM", "A2M", "Lanza", "Alabarda", "Mayal", "Naginata", "Puño de hierro",
    "Yari de Caballeria", "Lanza de caballeria", "Daga perforante", "Cuchillas",
])
_register_category("arma_dist", [
    "Arco", "Arco corto", "Arco de hueso", "Arco Kerit", "Honda",
    "Hachas arrojadizas", "Estrella arrojadiza", "Estrella envenenada",
    "Ballesta", "Ballesta ligera", "Ballesta repeticion", "Jabalina",
    "Pistola", "Pistolas",
])


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return re.sub(r"-+", "-", text).strip("-")


def clean_name(text: str) -> str:
    return " ".join(text.strip().split())


def title_es(text: str) -> str:
    """Title-case razonable para nombres de facción en mayúsculas."""
    small = {"de", "del", "la", "las", "el", "los", "y"}
    words = text.strip().lower().split()
    out = []
    for i, w in enumerate(words):
        out.append(w if (w in small and i != 0) else w.capitalize())
    return " ".join(out)


def num_or_null(v):
    """El origen usa cosas como '-' o ' -' para 'no aplica'; se guarda como NULL
    salvo que sea un número real, en cuyo caso se guarda como texto normalizado
    (attribute_profiles.* son TEXT para poder representar '-')."""
    if v is None:
        return None
    s = str(v).strip()
    if s in ("", "-"):
        return None
    return s


def bump_attacks(value: str | None) -> tuple[str | None, bool]:
    """Suma 1 al característica de Ataques para generar la ficha por defecto
    del Campeón a partir del perfil base. Devuelve (nuevo_valor, se_pudo_sumar).
    Si el valor no es un entero limpio (dados, "-", "E"...) se deja tal cual
    y se marca como no sumado, para revisarlo a mano desde Administración."""
    if value is None:
        return None, False
    if re.fullmatch(r"-?\d+", value):
        return str(int(value) + 1), True
    return value, False


def split_equipment_parts(name: str) -> list[str]:
    return [p.strip() for p in name.split("/") if p.strip()]


def build_schema(conn: sqlite3.Connection, schema_path: Path) -> None:
    conn.executescript(schema_path.read_text(encoding="utf-8"))


def prepare_faction_emblem(source_image: Path, dest_dir: Path, slug: str) -> str | None:
    """Redimensiona/recomprime la ilustración de una facción a un emblema
    ligero en dest_dir. Devuelve la ruta relativa (para image_path) o None
    si no hay imagen de origen para esa facción."""
    if not source_image.exists():
        return None
    try:
        from PIL import Image
    except ImportError:
        print(f"  aviso: Pillow no está instalado, se omite el emblema de {slug} (pip install Pillow)")
        return None

    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / f"{slug}.jpg"
    with Image.open(source_image) as img:
        img = img.convert("RGB")
        img.thumbnail((EMBLEM_MAX_SIZE, EMBLEM_MAX_SIZE), Image.LANCZOS)
        img.save(dest_path, "JPEG", quality=EMBLEM_JPEG_QUALITY, optimize=True)
    return f"assets/factions/{slug}.jpg"


def compute_compatible_pairs(equipo_rows: list[dict]) -> set[frozenset[str]]:
    """Dos piezas de la MISMA category que el origen haya ofrecido combinadas
    en algún paquete (en cualquier unidad) quedan marcadas como "compatibles
    conocidas": hay evidencia real de que sí se pueden llevar juntas (p.ej.
    Ballesta ligera + Hachas arrojadizas), así que NO se tratarán como
    alternativas excluyentes aunque compartan hueco. Sin esta evidencia, dos
    piezas del mismo hueco se consideran excluyentes por defecto (ver
    build_incompatibilities_for_unit)."""
    compatible: set[frozenset[str]] = set()
    for row in equipo_rows:
        parts = split_equipment_parts(row["EQUIPO"])
        if len(parts) < 2:
            continue
        for a, b in itertools.combinations(parts, 2):
            cat_a, cat_b = EQUIPMENT_CATEGORY.get(a), EQUIPMENT_CATEGORY.get(b)
            if cat_a and cat_a == cat_b:
                compatible.add(frozenset((a, b)))
    return compatible


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--schema", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument(
        "--images-dir", type=Path, default=None,
        help="Carpeta con las ilustraciones originales de cada facción (HojaEjercito/img). Opcional.",
    )
    parser.add_argument(
        "--images-out", type=Path, default=None,
        help="Carpeta destino para los emblemas ya redimensionados (public/assets/factions). Requerido si se pasa --images-dir.",
    )
    args = parser.parse_args()

    data = json.loads(args.source.read_text(encoding="utf-8"))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    if args.out.exists():
        args.out.unlink()

    conn = sqlite3.connect(args.out)
    conn.execute("PRAGMA foreign_keys = OFF")  # off during bulk load, data is trusted post-hoc
    build_schema(conn, args.schema)
    cur = conn.cursor()

    # ---- factions -----------------------------------------------------
    faction_id_map: dict[int, int] = {}
    for row in data["ejercitos"]:
        name = title_es(clean_name(row["EJERCITOS"]))
        slug = slugify(name)

        image_path = None
        if args.images_dir and args.images_out:
            filename = IMAGE_FILENAME_FIXUPS.get(row["IMAGEN"], row["IMAGEN"])
            image_path = prepare_faction_emblem(args.images_dir / filename, args.images_out, slug)

        cur.execute(
            "INSERT INTO factions (name, slug, image_path, sort_order) VALUES (?,?,?,?)",
            (name, slug, image_path, row["IDejercito"]),
        )
        faction_id_map[row["IDejercito"]] = cur.lastrowid

    # ---- unit_categories ------------------------------------------------
    category_id_map: dict[int, int] = {}
    category_new_id_by_tipo_code: dict[str, int] = {}
    tipo_code_by_id = {t["IDtipo"]: t["TIPO"] for t in data["tipo"]}

    for i, (tipo_code, (code, name)) in enumerate(CATEGORY_MAP.items()):
        cur.execute(
            "INSERT INTO unit_categories (code, name, sort_order) VALUES (?,?,?)",
            (code, name, i),
        )
        category_new_id_by_tipo_code[tipo_code] = cur.lastrowid

    cur.execute(
        "INSERT INTO unit_categories (code, name, sort_order) VALUES (?,?,?)",
        (PERSONAJE_CATEGORY_CODE, PERSONAJE_CATEGORY_NAME, len(CATEGORY_MAP)),
    )
    personaje_category_id = cur.lastrowid

    cur.execute(
        "INSERT INTO unit_categories (code, name, sort_order) VALUES (?,?,?)",
        (ASEDIO_CATEGORY_CODE, ASEDIO_CATEGORY_NAME, len(CATEGORY_MAP) + 1),
    )
    asedio_category_id = cur.lastrowid

    cur.execute(
        "INSERT INTO unit_categories (code, name, sort_order) VALUES (?,?,?)",
        (BESTIA_CATEGORY_CODE, BESTIA_CATEGORY_NAME, len(CATEGORY_MAP) + 2),
    )
    bestia_category_id = cur.lastrowid

    # Mapa code -> id nuevo, para las reasignaciones manuales y por facción
    # de más abajo (FACTION_CATEGORY_OVERRIDE,
    # UNIT_CATEGORY_OVERRIDE_BY_NAME_AND_FACTION), que trabajan con el code
    # TEXT en vez del tipo_code de una letra del origen.
    category_id_by_code: dict[str, int] = {
        code: category_new_id_by_tipo_code[tipo_code] for tipo_code, (code, _name) in CATEGORY_MAP.items()
    }
    category_id_by_code[PERSONAJE_CATEGORY_CODE] = personaje_category_id
    category_id_by_code[ASEDIO_CATEGORY_CODE] = asedio_category_id
    category_id_by_code[BESTIA_CATEGORY_CODE] = bestia_category_id

    faction_name_by_old_id = {e["IDejercito"]: title_es(clean_name(e["EJERCITOS"])) for e in data["ejercitos"]}

    for old_tipo_id, tipo_code in tipo_code_by_id.items():
        if tipo_code in category_new_id_by_tipo_code:
            category_id_map[old_tipo_id] = category_new_id_by_tipo_code[tipo_code]
        # tipo_code == "-" (FALLBACK_CATEGORY_TIPO_CODE) se queda sin entrada
        # aquí a propósito: se resuelve unidad a unidad en el bucle de
        # "units" de más abajo, vía FACTION_CATEGORY_OVERRIDE /
        # UNIT_CATEGORY_OVERRIDE_BY_NAME_AND_FACTION — ya no existe una
        # categoría fallback genérica tipo "(-)".

    # ---- attribute_profiles (base de tropa, montura y carro) --------------
    # Perfiles "base" (uno por ficha del origen, sin nombre propio: usan el
    # nombre de su unidad). Se deduplican por valor, solo entre sí. Esta
    # misma bolsa ("unidad") se reutiliza más abajo para las fichas de
    # Campeón derivadas del perfil base + 1 Ataque.
    base_profile_id_map: dict[int, int] = {}
    base_profile_key_to_new_id: dict[tuple, int] = {}

    def get_or_create_unit_profile(key: tuple) -> int:
        if key not in base_profile_key_to_new_id:
            cur.execute(
                "INSERT INTO attribute_profiles (name,profile_kind,m,ha,hp,f,r,h,i,a,l) "
                "VALUES (NULL,'unidad',?,?,?,?,?,?,?,?,?)",
                key,
            )
            base_profile_key_to_new_id[key] = cur.lastrowid
        return base_profile_key_to_new_id[key]

    for row in data["ficha"]:
        key = tuple(num_or_null(row[k]) for k in ["M", "Ha", "Hp", "F", "R", "H", "I", "A", "L"])
        base_profile_id_map[row["IDficha"]] = get_or_create_unit_profile(key)

    # Perfiles de montura: entidades con nombre propio, reutilizables entre
    # unidades y facciones (p.ej. "Corcel élfico"). No se deduplican contra
    # los perfiles base ni contra los de carro (ver docstring del módulo).
    mount_profile_id_map: dict[int, int] = {}
    for row in data["montura"]:
        cur.execute(
            "INSERT INTO attribute_profiles (name,profile_kind,m,ha,hp,f,r,h,i,a,l) VALUES (?,'montura',?,?,?,?,?,?,?,?,?)",
            (
                clean_name(row["MONTURA_DOTACION"]),
                num_or_null(row["M"]), num_or_null(row["Ha"]), num_or_null(row["Hp"]),
                num_or_null(row["F"]), num_or_null(row["R"]), num_or_null(row["H"]),
                num_or_null(row["I"]), num_or_null(row["A"]), num_or_null(row["L"]),
            ),
        )
        mount_profile_id_map[row["IDmontura"]] = cur.lastrowid

    # Perfiles de carro: mismo tratamiento que las monturas.
    chariot_profile_id_map: dict[int, int] = {}
    for row in data["carro"]:
        cur.execute(
            "INSERT INTO attribute_profiles (name,profile_kind,m,ha,hp,f,r,h,i,a,l) VALUES (?,'carro',?,?,?,?,?,?,?,?,?)",
            (
                clean_name(row["CARRO"]),
                num_or_null(row["M"]), num_or_null(row["Ha"]), num_or_null(row["Hp"]),
                num_or_null(row["F"]), num_or_null(row["R"]), num_or_null(row["H"]),
                num_or_null(row["I"]), num_or_null(row["A"]), num_or_null(row["L"]),
            ),
        )
        chariot_profile_id_map[row["IDcarro"]] = cur.lastrowid

    # ---- special_rules ------------------------------------------------
    rule_id_map: dict[int, int] = {}
    for row in data["reglas"]:
        cur.execute(
            "INSERT INTO special_rules (name, description) VALUES (?,?)",
            (clean_name(row["REGLA"]), (row.get("DESCRIPCION") or "").strip()),
        )
        rule_id_map[row["IDRegla"]] = cur.lastrowid

    # ---- equipment_options (solo piezas atómicas) -----------------------
    # Los paquetes combinados del origen ("A2M / A.Pesada") ya no se
    # registran como fila propia: quedan totalmente descompuestos en sus
    # piezas sueltas (ver split_equipment_parts) y esas piezas son las que
    # se ofrecen y asignan a cada unidad más abajo. Un paquete solo
    # aparecía como catálogo separado por ser redundante con sus piezas
    # sueltas combinadas libremente, así que se omite su inserción.
    equipment_id_map: dict[int, int] = {}
    equipment_name_by_id: dict[int, str] = {}
    equipment_cost_by_id: dict[int, int] = {}
    for row in data["equipo"]:
        name = clean_name(row["EQUIPO"])
        parts = split_equipment_parts(name)
        if len(parts) > 1:
            continue  # paquete combinado: no se inserta, solo sus piezas sueltas
        category = EQUIPMENT_CATEGORY.get(name)
        cur.execute(
            "INSERT INTO equipment_options (name, cost, category) VALUES (?,?,?)",
            (name, row["COSTE"], category),
        )
        new_id = cur.lastrowid
        equipment_id_map[row["IDequipo"]] = new_id
        equipment_name_by_id[new_id] = name
        equipment_cost_by_id[new_id] = row["COSTE"]

    compatible_name_pairs = compute_compatible_pairs(data["equipo"])

    # ---- upgrades -------------------------------------------------------
    upgrade_id_map: dict[int, int] = {}
    for row in data["unidad"]:
        cur.execute(
            "INSERT INTO upgrades (name, cost) VALUES (?,?)",
            (clean_name(row["UNIDAD"]), row["COSTE"]),
        )
        upgrade_id_map[row["IDunidad"]] = cur.lastrowid

    # ---- command_roles ----------------------------------------------------
    command_role_id: dict[str, int] = {}
    for code, name in COMMAND_ROLES:
        cur.execute("INSERT INTO command_roles (code, name) VALUES (?,?)", (code, name))
        command_role_id[code] = cur.lastrowid

    # ---- units (tropas) -----------------------------------------------
    unit_id_map: dict[int, int] = {}
    unit_faction_new_id: dict[int, int] = {}
    unresolved_category_units: list[str] = []

    for i, row in enumerate(data["tropas"]):
        old_id = row["IDtropa"]
        new_faction_id = faction_id_map[row["IDejercito"]]
        faction_name = faction_name_by_old_id[row["IDejercito"]]
        unit_name = clean_name(row["TROPA"])

        override_code = UNIT_CATEGORY_OVERRIDE_BY_NAME_AND_FACTION.get((unit_name, faction_name))
        if override_code:
            category_id = category_id_by_code[override_code]
        elif faction_name in FACTION_CATEGORY_OVERRIDE:
            category_id = category_id_by_code[FACTION_CATEGORY_OVERRIDE[faction_name]]
        else:
            category_id = category_id_map.get(row["IDtipo"])

        if category_id is None:
            # No debería pasar ya (las 33 unidades sin categoría estándar del
            # origen quedan cubiertas por FACTION_CATEGORY_OVERRIDE o
            # UNIT_CATEGORY_OVERRIDE_BY_NAME_AND_FACTION), pero se deja este
            # aviso como red de seguridad por si el origen cambia en el
            # futuro y aparece alguna unidad nueva sin cubrir.
            unresolved_category_units.append(f"{unit_name} ({faction_name})")

        cur.execute(
            """INSERT INTO units
               (faction_id, category_id, unit_type, name,
                base_cost, min_size, max_size, default_size, equipment_text, armor_save, sort_order)
               VALUES (?,?,?,?,?,?,?,?,NULL,NULL,?)""",
            (
                new_faction_id,
                category_id,
                "tropa",
                unit_name,
                row["COSTE"],
                # min_size/max_size: el origen no tiene límites reales, solo
                # NUMERO (ver default_size más abajo) — se quedan sin definir
                # y son editables a mano desde Administración si se conoce
                # el límite real de esa unidad.
                None,
                None,
                # NUMERO en el origen NO es un máximo: el script.js original
                # lo usaba solo para "autocompletar" el campo número al
                # elegir la tropa (comentario "🔥 AUTOCOMPLETAR NÚMERO"), el
                # jugador podía escribir cualquier otro valor después. Se
                # guarda como default_size, no como max_size.
                row.get("NUMERO"),
                i,
            ),
        )
        unit_id_map[old_id] = cur.lastrowid
        unit_faction_new_id[cur.lastrowid] = new_faction_id

    # ---- unit_profiles: perfil base (siempre 1) + montura/carro (0..N) ----
    unit_base_key: dict[int, tuple] = {}
    for row in data["ficha_tropas"]:
        uid = unit_id_map.get(row["IDtropa"])
        pid = base_profile_id_map.get(row["IDficha"])
        if uid and pid:
            cur.execute(
                "INSERT OR IGNORE INTO unit_profiles (unit_id, profile_id, role, sort_order) VALUES (?,?,'base',0)",
                (uid, pid),
            )
            ficha_row = next((f for f in data["ficha"] if f["IDficha"] == row["IDficha"]), None)
            if ficha_row:
                unit_base_key[uid] = tuple(
                    num_or_null(ficha_row[k]) for k in ["M", "Ha", "Hp", "F", "R", "H", "I", "A", "L"]
                )

    for row in data["montura_tropas"]:
        uid = unit_id_map.get(row["IDtropa"])
        pid = mount_profile_id_map.get(row["IDmontura"])
        if uid and pid:
            cur.execute(
                "INSERT OR IGNORE INTO unit_profiles (unit_id, profile_id, role, sort_order) VALUES (?,?,'montura',0)",
                (uid, pid),
            )
            # La montura queda asociada a la facción de esta unidad (catálogo "Monturas" de Administración).
            cur.execute(
                "INSERT OR IGNORE INTO profile_factions (profile_id, faction_id) VALUES (?,?)",
                (pid, unit_faction_new_id[uid]),
            )

    for row in data["carro_tropas"]:
        uid = unit_id_map.get(row["IDtropa"])
        pid = chariot_profile_id_map.get(row["IDcarro"])
        if uid and pid:
            cur.execute(
                "INSERT OR IGNORE INTO unit_profiles (unit_id, profile_id, role, sort_order) VALUES (?,?,'carro',0)",
                (uid, pid),
            )
            cur.execute(
                "INSERT OR IGNORE INTO profile_factions (profile_id, faction_id) VALUES (?,?)",
                (pid, unit_faction_new_id[uid]),
            )

    # ---- junction tables ------------------------------------------------
    for row in data["reglas_tropas"]:
        uid, rid = unit_id_map.get(row["IDtropa"]), rule_id_map.get(row["IDRegla"])
        if uid and rid:
            cur.execute(
                "INSERT OR IGNORE INTO unit_special_rules (unit_id, rule_id) VALUES (?,?)",
                (uid, rid),
            )

    # ---- unit_equipment_options: piezas sueltas por unidad ----------------
    # Cada unidad recibe directamente sus piezas sueltas (los paquetes
    # combinados del origen ya no existen en equipment_id_map, así que
    # quedan excluidos automáticamente aquí sin lógica adicional: la unidad
    # podía comprar cualquier combinación de sus piezas sueltas, así que no
    # se pierde ninguna configuración real).
    incompatibility_pairs_created = 0

    equipo_tropas_by_unit: dict[int, list[dict]] = {}
    for row in data["equipo_tropas"]:
        equipo_tropas_by_unit.setdefault(row["IDtropa"], []).append(row)

    for old_uid, rows in equipo_tropas_by_unit.items():
        uid = unit_id_map.get(old_uid)
        if not uid:
            continue

        resolved = [
            (equipment_id_map[r["IDequipo"]], equipment_name_by_id[equipment_id_map[r["IDequipo"]]],
             equipment_cost_by_id[equipment_id_map[r["IDequipo"]]])
            for r in rows if r["IDequipo"] in equipment_id_map
        ]
        singles = {name: cost for (_id, name, cost) in resolved}
        single_ids_by_name = {name: _id for (_id, name, cost) in resolved}

        assigned_ids: set[int] = set(single_ids_by_name.values())

        for eid in assigned_ids:
            cur.execute(
                "INSERT OR IGNORE INTO unit_equipment_options (unit_id, equipment_id) VALUES (?,?)",
                (uid, eid),
            )

        # Incompatibilidades: piezas sueltas asignadas del mismo hueco
        # (category) sin evidencia de que el origen las haya combinado nunca.
        assigned_singles = [(single_ids_by_name[n], n) for n in singles]
        by_category: dict[str, list[tuple[int, str]]] = {}
        for eid, name in assigned_singles:
            cat = EQUIPMENT_CATEGORY.get(name)
            if cat:
                by_category.setdefault(cat, []).append((eid, name))

        for cat, items in by_category.items():
            for (id_a, name_a), (id_b, name_b) in itertools.combinations(items, 2):
                if frozenset((name_a, name_b)) in compatible_name_pairs:
                    continue
                lo, hi = (id_a, id_b) if id_a < id_b else (id_b, id_a)
                cur.execute(
                    "INSERT OR IGNORE INTO equipment_incompatibilities (equipment_id_a, equipment_id_b, reason) VALUES (?,?,?)",
                    (lo, hi, f"Mismo hueco de equipo ({cat}): alternativas excluyentes."),
                )
                if cur.rowcount:
                    incompatibility_pairs_created += 1

    for row in data["unidad_tropas"]:
        uid, upid = unit_id_map.get(row["IDtropa"]), upgrade_id_map.get(row["IDunidad"])
        if uid and upid:
            cur.execute(
                "INSERT OR IGNORE INTO unit_upgrade_options (unit_id, upgrade_id) VALUES (?,?)",
                (uid, upid),
            )

    # ---- grupo de mando: coste + ficha propia del Campeón ------------------
    tropa_name_by_old_id = {t["IDtropa"]: clean_name(t["TROPA"]) for t in data["tropas"]}
    champion_profile_review: list[str] = []
    for role_code, table in (("CAMPEON", "campeon"), ("PORTAESTANDARTE", "portaestandarte"), ("MUSICO", "musico")):
        for row in data[table]:
            uid = unit_id_map.get(row["IDtropa"])
            if not uid:
                continue

            profile_id = None
            if role_code == "CAMPEON":
                base_key = unit_base_key.get(uid)
                if base_key:
                    bumped_attacks, ok = bump_attacks(base_key[7])
                    champion_key = base_key[:7] + (bumped_attacks,) + base_key[8:]
                    profile_id = get_or_create_unit_profile(champion_key)
                    if not ok:
                        champion_profile_review.append(tropa_name_by_old_id.get(row["IDtropa"], f"unidad #{uid}"))

            cur.execute(
                """INSERT OR IGNORE INTO unit_command_options
                   (unit_id, command_role_id, cost, profile_id) VALUES (?,?,?,?)""",
                (uid, command_role_id[role_code], row["COSTE"], profile_id),
            )

    # ---- import_meta ------------------------------------------------------
    cur.execute(
        "INSERT INTO import_meta (source, imported_at, schema_version) VALUES (?,?,?)",
        (str(args.source), datetime.now(timezone.utc).isoformat(), SCHEMA_VERSION),
    )

    conn.commit()

    # ---- sanity report ------------------------------------------------
    def count(table: str) -> int:
        return cur.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]

    def count_where(table: str, where: str) -> int:
        return cur.execute(f"SELECT COUNT(*) FROM {table} WHERE {where}").fetchone()[0]

    print("ETL completado ->", args.out)
    for t in [
        "factions", "unit_categories", "attribute_profiles", "profile_factions",
        "special_rules", "equipment_options", "equipment_incompatibilities", "upgrades",
        "command_roles", "units", "unit_profiles", "unit_special_rules",
        "unit_equipment_options", "unit_upgrade_options", "unit_command_options",
    ]:
        print(f"  {t:28s} {count(t)}")
    base_role_clause = "role = 'base'"
    montura_role_clause = "role = 'montura'"
    carro_role_clause = "role = 'carro'"
    print(f"  {'  unit_profiles (base)':28s} {count_where('unit_profiles', base_role_clause)}")
    print(f"  {'  unit_profiles (montura)':28s} {count_where('unit_profiles', montura_role_clause)}")
    print(f"  {'  unit_profiles (carro)':28s} {count_where('unit_profiles', carro_role_clause)}")
    print(f"\n  Incompatibilidades de equipo generadas automáticamente: {incompatibility_pairs_created}")

    if unresolved_category_units:
        print(
            f"\nAviso: {len(unresolved_category_units)} unidades se quedaron sin categoría (category_id NULL) "
            f"porque no encajan en FACTION_CATEGORY_OVERRIDE ni en UNIT_CATEGORY_OVERRIDE_BY_NAME_AND_FACTION. "
            f"Asignarles una categoría a mano desde Administración > Unidades:"
        )
        for name in unresolved_category_units:
            print(f"  - {name}")

    if champion_profile_review:
        print(
            f"\nAviso: {len(champion_profile_review)} unidades tienen una característica de Ataques en su perfil "
            f'base que no es un entero simple (dados, "-", "E"...), así que la ficha del Campeón se generó IGUAL '
            f"al perfil base (sin sumar +1) y necesita revisión manual desde Administración:"
        )
        for name in champion_profile_review:
            print(f"  - {name}")

    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
