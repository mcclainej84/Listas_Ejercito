# Perfiles huérfanos e incorrectos — para revisar antes de borrar

Análisis hecho directamente contra la base de datos de producción (`wharmy-db`)
el 27/07/2026. **No se ha borrado ni modificado nada.**

Un perfil se considera "en uso" si lo referencia alguna de estas cinco cosas:
`unit_profiles` (ficha base, montura o carro de una unidad), `upgrades.profile_id`
(opción con ficha propia), `unit_command_options.profile_id` (ficha de campeón),
o `army_list_entries.mount_profile_id` / `chariot_profile_id` (una lista de
ejército ya guardada). Todo lo demás es huérfano.

---

## Grupo A — La montura fantasma que has visto (3 filas) ⚠️ REVISAR CON EL LIBRO

Es el caso que reportaste, y afecta a tres personajes Skaven. Los tres apuntan
**al mismo perfil**, el `id 217`, que está mal de raíz:

- No tiene **nombre** (por eso en pantalla sale un hueco vacío).
- Su tipo es `unidad`, no `montura` — está enchufado como montura pero no es
  una montura del catálogo.
- No pertenece a **ninguna facción**.
- Solo tiene tres atributos sueltos: **F5, R6, H6**. Sin M, HA, HP, I, A ni L.
- No es la ficha base de ninguna unidad: no lo "comparte" nadie.

| Unidad | Facción | Puntos que cobra |
|---|---|---|
| Vidente Gris | Skaven | 200 |
| Señor de la Plaga | Skaven | 185 |
| Sacerdote de Plaga | Skaven | **85** |

**Antes de borrar, mira tu libro de ejército.** Esos puntos y esos perfiles
apuntan a que estas tres entradas *sí* deberían poder llevar algo (las monturas
caras de estos personajes en Skaven), y que lo que falló fue la importación, no
el libro. Si borras las tres filas sin más, la opción desaparece del todo y
nadie volverá a echarla en falta hasta que alguien intente montar un Vidente
Gris.

Dos caminos, y el segundo es el que yo elegiría:

1. **Borrar las 3 filas** de `unit_profiles` y el perfil 217. Rápido, deja la
   base limpia, pierdes la opción.
2. **Reconstruirlas**: crear en Editor → Montura/Dotación las monturas de
   verdad (con su nombre, perfil completo y facción Skaven) y reasignarlas a
   los tres personajes con sus puntos. Conservas la información y de paso las
   fichas salen bien.

En el catálogo Skaven hoy existen: Gran Rata Pestilente, Jinete de bestia,
Monjes de plaga, Palanquín de Guerra, Piloto Skryre, Rata Ogro Monstruosa,
Rata Ogro Quebrantahuesos, Rata ogro y Ratas gigantes. Ninguna encaja con esos
200/185/85 puntos, así que habría que crearlas.

---

## Grupo B — Monturas del catálogo que no usa nadie (2) ✅ BORRADO SEGURO

Existen como ficha de montura, tienen facción asignada, pero **ninguna unidad
las ofrece** y ninguna lista de ejército las usa. Son entradas muertas: ocupan
sitio en el desplegable de Editor y no hacen nada.

| id | Nombre | Facción | Perfil (M/HA/HP/F/R/H/I/A/L) | Reglas |
|---|---|---|---|---|
| 290 | Rata ogro | Skaven | –/3/–/5/–/–/3/3/– | 0 |
| 573 | Lechuza boreal | Elfos Silvanos | 20/4/-/5/5/4/4/4/7 | 0 |

Ojo con la **Rata ogro** (290): el catálogo Skaven tiene además *Rata Ogro
Monstruosa* (448) y *Rata Ogro Quebrantahuesos* (447), que sí se usan. La 290
tiene el perfil a medias y parece la versión vieja que quedó suelta al
importar las otras dos. Confírmalo antes de borrarla, no vaya a ser la buena.

La **Lechuza boreal** (573) tiene el perfil completo y de buena pinta: puede que
sea una montura que creaste y todavía no has asignado a nadie. Si es el caso,
no la borres — asígnala.

---

## Grupo C — Fichas de atributos sueltas, sin dueño (49) ✅ BORRADO SEGURO

Fichas de tipo `unidad` que no son la ficha base de ninguna unidad, ni de
ninguna opción, ni de ningún campeón, ni las usa ninguna lista. Son restos de
unidades borradas o de importaciones a medias. **No se ven por ninguna parte de
la aplicación**; solo engordan la base.

Ninguna tiene nombre, facción ni reglas especiales asociadas.

### C.1 — Completamente vacías (19): ids 515 a 533

Sin un solo atributo. Basura pura, sin nada que perder.

### C.2 — Con algún atributo (30)

| id | M/HA/HP/F/R/H/I/A/L |
|---|---|
| 56 | 10/4/3/3/4/1/4/1/8 |
| 213 | 15/3/0/6/4/3/3/3/5 |
| 357 | 10/4/3/3/4/1/4/2/8 |
| 464, 471–474, 479–485, 487, 489, 491 | 12/3/3/3/3/1/4/2/5 *(los 15 idénticos)* |
| 500 | 8/5/3/4/4/1/2/2/9 |
| 507 | 12/6/6/4/3/2/7/3/9 |
| 508 | 10/4/3/3/3/1/3/1/7 |
| 509 | 10/4/3/3/3/1/3/2/7 |
| 534 | 4/4/4/4/4/4/4/4/4 |
| 562 | 10/–/–/–/–/–/–/–/– |
| 563, 564 | 10/2/2/3/3/1/3/1/5 |
| 569 | 10/4/3/4/3/1/4/1/8 |
| 570 | 10/4/3/4/3/1/4/2/8 |
| 579 | 10/3/–/4/4/1/3/2/7 |
| 580 | 10/3/–/3/4/1/3/3/6 |

El bloque de 15 fichas idénticas (12/3/3/3/3/1/4/2/5) y los pares 563/564,
569/570 huelen a duplicados generados por una importación repetida.

La 534 (todo cuatros) es claramente una ficha de prueba.

---

## Lo que está bien

Comprobado y sin problemas, para que sepas que también se ha mirado:

- **No hay referencias rotas de verdad**: ninguna fila apunta a un `profile_id`
  que no exista. La integridad referencial está intacta.
- **Ninguna montura o carro sin nombre** en el catálogo.
- **Ninguna montura o carro sin facción** asignada.
- Las 187 monturas y 38 carros asignados a unidades apuntan todos a fichas del
  tipo correcto, salvo las 3 del Grupo A.
- Salvo esas 3, **ninguna unidad tiene asignada una montura de otra facción**.

---

## Resumen

| Grupo | Qué es | Cuántos | Acción |
|---|---|---|---|
| A | Montura fantasma (perfil 217) | 3 filas + 1 perfil | **Decidir**: borrar o reconstruir |
| B | Monturas que no usa nadie | 2 | Confirmar y borrar |
| C.1 | Fichas vacías sin dueño | 19 | Borrar |
| C.2 | Fichas con atributos sin dueño | 30 | Borrar |

Cuando me digas qué hacer con cada grupo, preparo el borrado. Sugiero hacerlo
desde el propio Editor si son pocos, o con una acción de mantenimiento si
prefieres los 49 de golpe — y en cualquier caso, sacando antes una copia de la
tabla `attribute_profiles` por si acaso.
