-- ============================================================================
-- COPIA DE SEGURIDAD antes de borrar la "montura fantasma" (perfil 217).
--
-- Fecha del volcado: 27/07/2026
-- Base de datos:     wharmy-db (D1, producción)
--
-- QUÉ SE BORRÓ Y POR QUÉ
-- El perfil 217 estaba enchufado como MONTURA de tres personajes Skaven, pero
-- no era una montura: tipo `unidad`, sin nombre, sin facción y con solo tres
-- atributos sueltos (F5 R6 H6). En pantalla salía como una opción en blanco
-- que cobraba puntos — lo que el usuario vio como "una montura por 85 puntos
-- que no existe" en el Sacerdote de Plaga.
--
-- OJO SI RESTAURAS: esto devuelve el problema tal y como estaba. La razón de
-- guardar este archivo no es volver atrás sin más, sino no perder el dato de
-- QUÉ personajes llevaban montura y POR CUÁNTOS PUNTOS, que es justo lo que
-- hace falta para crear las monturas de verdad en Editor → Montura/Dotación:
--
--     Vidente Gris (unidad 445) ......... 200 puntos
--     Señor de la Plaga (unidad 447) .... 185 puntos
--     Sacerdote de Plaga (unidad 454) .... 85 puntos
--
-- Comprobado antes de borrar: el perfil 217 NO lo usaba ninguna opción de
-- unidad (`upgrades`), ninguna ficha de campeón (`unit_command_options`) ni
-- ninguna lista de ejército guardada (`army_list_entries`), y no tenía filas
-- en `profile_factions` ni en `profile_special_rules`. El borrado no arrastró
-- nada más.
-- ============================================================================

-- La ficha de atributos en sí.
INSERT INTO attribute_profiles
    (id, name, profile_kind, equippable_by_character, include_in_sheets, m, ha, hp, f, r, h, i, a, l)
VALUES
    (217, NULL, 'unidad', 0, 0, NULL, NULL, NULL, '5', '6', '6', NULL, NULL, NULL);

-- Su asignación como montura a los tres personajes.
INSERT INTO unit_profiles (unit_id, profile_id, role, sort_order, cost) VALUES
    (445, 217, 'montura', 0, 200),   -- Vidente Gris
    (447, 217, 'montura', 1, 185),   -- Señor de la Plaga
    (454, 217, 'montura', 0, 85);    -- Sacerdote de Plaga
