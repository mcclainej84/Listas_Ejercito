-- ============================================================================
-- COPIA DE SEGURIDAD antes de borrar los 49 perfiles huérfanos del "grupo C"
-- (ver REVISION_PERFILES_HUERFANOS.md en la raíz del repositorio).
--
-- Fecha del volcado: 27/07/2026
-- Base de datos:     wharmy-db (D1, producción)
--
-- QUÉ ERAN
-- Fichas de atributos de tipo `unidad` que no eran la ficha base de ninguna
-- unidad, ni de ninguna opción con ficha propia, ni de ningún campeón, y que
-- tampoco usaba ninguna lista de ejército guardada. Restos de unidades
-- borradas y de importaciones repetidas. No se veían por ninguna parte de la
-- aplicación: solo ocupaban sitio.
--
-- Comprobado antes de borrar: ninguna de las 49 tenía nombre, ni filas en
-- `profile_factions`, ni en `profile_special_rules`. El borrado no arrastró
-- nada en cascada.
--
-- PISTAS DE SU ORIGEN, por si alguna vez hay que investigar de dónde salieron:
--   · 515–533 (19 fichas) están completamente vacías, sin un solo atributo.
--   · 464, 471–474, 479–485, 487, 489, 491 son QUINCE fichas idénticas entre
--     sí (12/3/3/3/3/1/4/2/5) — huella de una importación ejecutada dos veces.
--   · 563/564 y 569/570 son pares idénticos, mismo patrón.
--   · 534 es todo cuatros: una ficha de prueba.
--
-- CÓMO RESTAURAR: ejecutar este archivo contra la base. Los ids son
-- explícitos, así que las fichas vuelven con el mismo número y cualquier
-- referencia antigua volvería a encajar.
-- ============================================================================

INSERT INTO attribute_profiles
    (id, name, profile_kind, equippable_by_character, include_in_sheets, m, ha, hp, f, r, h, i, a, l)
VALUES
    (56, NULL, 'unidad', 0, 0, '10', '4', '3', '3', '4', '1', '4', '1', '8'),
    (213, NULL, 'unidad', 0, 0, '15', '3', '0', '6', '4', '3', '3', '3', '5'),
    (357, NULL, 'unidad', 0, 0, '10', '4', '3', '3', '4', '1', '4', '2', '8'),
    (464, NULL, 'unidad', 0, 0, '12', '3', '3', '3', '3', '1', '4', '2', '5'),
    (471, NULL, 'unidad', 0, 0, '12', '3', '3', '3', '3', '1', '4', '2', '5'),
    (472, NULL, 'unidad', 0, 0, '12', '3', '3', '3', '3', '1', '4', '2', '5'),
    (473, NULL, 'unidad', 0, 0, '12', '3', '3', '3', '3', '1', '4', '2', '5'),
    (474, NULL, 'unidad', 0, 0, '12', '3', '3', '3', '3', '1', '4', '2', '5'),
    (479, NULL, 'unidad', 0, 0, '12', '3', '3', '3', '3', '1', '4', '2', '5'),
    (480, NULL, 'unidad', 0, 0, '12', '3', '3', '3', '3', '1', '4', '2', '5'),
    (481, NULL, 'unidad', 0, 0, '12', '3', '3', '3', '3', '1', '4', '2', '5'),
    (482, NULL, 'unidad', 0, 0, '12', '3', '3', '3', '3', '1', '4', '2', '5'),
    (483, NULL, 'unidad', 0, 0, '12', '3', '3', '3', '3', '1', '4', '2', '5'),
    (484, NULL, 'unidad', 0, 0, '12', '3', '3', '3', '3', '1', '4', '2', '5'),
    (485, NULL, 'unidad', 0, 0, '12', '3', '3', '3', '3', '1', '4', '2', '5'),
    (487, NULL, 'unidad', 0, 0, '12', '3', '3', '3', '3', '1', '4', '2', '5'),
    (489, NULL, 'unidad', 0, 0, '12', '3', '3', '3', '3', '1', '4', '2', '5'),
    (491, NULL, 'unidad', 0, 0, '12', '3', '3', '3', '3', '1', '4', '2', '5'),
    (500, NULL, 'unidad', 0, 0, '8', '5', '3', '4', '4', '1', '2', '2', '9'),
    (507, NULL, 'unidad', 0, 0, '12', '6', '6', '4', '3', '2', '7', '3', '9'),
    (508, NULL, 'unidad', 0, 0, '10', '4', '3', '3', '3', '1', '3', '1', '7'),
    (509, NULL, 'unidad', 0, 0, '10', '4', '3', '3', '3', '1', '3', '2', '7'),
    (515, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (516, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (517, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (518, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (519, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (520, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (521, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (522, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (523, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (524, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (525, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (526, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (527, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (528, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (529, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (530, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (531, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (532, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (533, NULL, 'unidad', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (534, NULL, 'unidad', 0, 0, '4', '4', '4', '4', '4', '4', '4', '4', '4'),
    (562, NULL, 'unidad', 0, 0, '10', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (563, NULL, 'unidad', 0, 0, '10', '2', '2', '3', '3', '1', '3', '1', '5'),
    (564, NULL, 'unidad', 0, 0, '10', '2', '2', '3', '3', '1', '3', '1', '5'),
    (569, NULL, 'unidad', 0, 0, '10', '4', '3', '4', '3', '1', '4', '1', '8'),
    (570, NULL, 'unidad', 0, 0, '10', '4', '3', '4', '3', '1', '4', '2', '8'),
    (579, NULL, 'unidad', 0, 0, '10', '3', NULL, '4', '4', '1', '3', '2', '7'),
    (580, NULL, 'unidad', 0, 0, '10', '3', NULL, '3', '4', '1', '3', '3', '6');
