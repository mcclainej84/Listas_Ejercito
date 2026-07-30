# Registro de cambios — WHArmy

La versión que se está ejecutando se muestra en el pie de página de la
aplicación. La fuente de verdad del número es `webapp/src/version.ts`.

**Criterio:** cualquier cambio en el frontend sube la versión y actualiza la
fecha y la hora.

El número que va tras el punto es un **contador**, no un decimal: se incrementa
de uno en uno y no vuelca. La secuencia es `0.9` → `0.10` → `0.11` → … → `0.42`
→ … Se pasará a `1.0` solo cuando se pida expresamente. Ojo al ordenar: `0.10`
es posterior a `0.9`, aunque como número decimal sería menor.

---

## 0.68 — 30/07/2026 00:05

- El **lápiz** de un coste retocado ya no es solo un aviso: pinchándolo se
  **deshace el retoque** y la entrada vuelve a su coste calculado. Pinchar el
  número sigue sirviendo para cambiarlo. Son dos botones distintos a propósito:
  juntar «cambiarlo» y «deshacerlo» en el mismo sitio es pedir un borrado sin
  querer.

---

## 0.67 — 29/07/2026 23:45

- **Arreglado: el navegador bloqueaba «Exportar Hojas de unidad».** El permiso
  para abrir una pestaña caduca a los instantes de la pulsación, y generar las
  hojas —fuentes, ilustraciones desde R2 y un canvas por unidad— tardaba más
  que eso. Ahora la pestaña se abre en el mismo clic, con un aviso de
  «Generando el PDF…», y se lleva al documento cuando está listo. Si aun así
  la bloquean, el PDF se descarga en vez de perderse. Lo mismo se aplicó a
  «Exportar Lista», que corría el mismo riesgo aunque tarde menos.

## 0.66 — 29/07/2026 23:15

- En «Unidades en la lista», el **coste se puede escribir a mano**: se pincha
  el número y se teclea. Al lado aparece un **lápiz** que avisa de que ese
  coste ya no sale del cálculo. Dejar la casilla **vacía** vuelve al calculado;
  escribir **0** es un coste a mano válido, no lo mismo que borrarlo.
- El coste escrito a mano **manda a todos los efectos**: total del ejército,
  aviso de límite de puntos, «Composición del ejército», ordenar por coste y
  los dos PDF. Se comprueba en el único sitio por el que pasan todos
  (`computeEntryCost`), para que no haya una pantalla que se olvide.

## 0.65 — 29/07/2026 22:40

- «Exportar PDF» pasa a llamarse **«Exportar Lista»**, y a su lado aparece
  **«Exportar Hojas de unidad»**: un PDF con la hoja de cada unidad del
  ejército, **una por página**, y debajo sus **reglas especiales
  desarrolladas** (nombre y texto), para no necesitar el reglamento al lado.
  Las hojas salen del mismo motor que usan el PNG y el Word de la sección
  Fichas, así que heredan su tipografía y su maquetación exactas: en el PDF
  parecen la misma hoja. También heredan el blanco y negro del interruptor de
  la barra superior.
  Se exporta una hoja por unidad **distinta**: tres regimientos de Arqueros
  comparten hoja, y el orden es el de la lista.

## 0.64 — 29/07/2026 21:55

- El **nombre propio de un personaje sale ya en las cuatro tablas del PDF**.
  Faltaba en «Perfiles y reglas especiales», que era la única que seguía
  poniendo el tipo a secas: ahora dice «Jules el Bretón (Paladín Bretoniano)»
  como el resto. De paso, dos personajes bautizados distinto dejan de pisarse
  al descartar perfiles repetidos, aunque compartan perfil.

## 0.63 — 29/07/2026 21:30

- En «Unidades en la lista», bajo el nombre de cada unidad aparecen dos líneas
  nuevas cuando hay algo que contar: «Montura: Caballo de guerra · Carro:
  Carro bretoniano» (los dos en la misma línea, la montura primero, porque en
  la práctica son excluyentes) y «Sendas: Fuego 2 · Bestias 1». Cada dato va
  rotulado: sin rótulo, un nombre suelto bajo la unidad no dice qué es.
  Van como líneas y no como columnas
  nuevas: solo las lleva una minoría de entradas, y dos columnas vacías en casi
  todas las filas habrían estrechado el resto de la tabla para nada.
- Nueva opción **«Opciones Lista de ejército»** en el menú del usuario, para
  encender o apagar cada una de esas dos líneas. Es preferencia de cada usuario
  —dos personas pueden abrir el mismo ejército y verlo con distinto detalle— y
  **ambas nacen encendidas** para todos.

## 0.62 — 29/07/2026 20:45

- **Nueva sección «Listado de hechizos» en el PDF**, con una cabecera por cada
  personaje que lleve sendas y, bajo ella, sus hechizos agrupados por senda con
  todos sus campos: dificultad, alcance, impactos, daño, si permanece, dónde se
  lanza y sus reglas.
  El **nivel** manda: de cada senda solo se imprimen los hechizos hasta el
  nivel que tenga el mago, para no tener que ir descartando a ojo en plena
  partida. Misma retícula, misma paleta y mismo criterio de alineación que las
  tres tablas anteriores. Si en el ejército no hay magos, la sección no sale.

## 0.61 — 29/07/2026 20:10

- En Ejércitos, la barra de «Añadir unidad» recupera su fondo: el cuerpo del
  marco sigue transparente, pero la barra vuelve a leerse como una barra. Fuera
  el rótulo «Minimizar»/«Desplegar»; queda solo el galón.
- **Alineación de las tablas del PDF, igual en las tres**: todas las cabeceras
  centradas, todos los datos centrados, y a la izquierda solo el texto corrido
  —nombres, equipo, opciones y reglas—, que es lo único que se lee como frase.
  «Coste» pasa de la derecha al centro.
- En «Perfiles y reglas especiales» del PDF, **fuera los perfiles repetidos**:
  tres regimientos de Arqueros repetían tres veces la misma fila. Solo se
  descarta una entrada si produce exactamente las mismas filas que otra, así
  que dos personajes con montura distinta siguen apareciendo los dos.

## 0.60 — 29/07/2026 19:30

- **Las reglas destacadas de una facción son ahora universales.** Dejan de ser
  una preferencia de cada usuario y pasan a formar parte del catálogo: lo que
  se marque en Facciones › Editar › Reglas destacadas lo ve todo el mundo.
  Empiezan **todas vacías**, para volver a meterlas a mano.
  Técnicamente: nueva tabla `faction_featured_rules`. La antigua
  `user_faction_rules` se conserva sin usar, para no destruir lo que hubiera
  marcado cada usuario.
- En edición de unidades, la **T.S.** se muda a la cabecera del cuadro «Perfil
  base», en la misma línea que el título y a la derecha: es un atributo más de
  la miniatura y ahí se lee junto a F, R y H.
- En el ejército, «Magia», las sendas y los grupos van en minúscula con la
  inicial en mayúscula («Fuego», «Elementales») en vez de todo en minúsculas.
- El separador de reglas especiales ya no grita: «De la facción» y «Reglas»
  (antes «DE LA FACCIÓN» y «OTRAS REGLAS»).

## 0.59 — 29/07/2026 18:45

- **La magia depende ahora de la ETIQUETA.** Si un personaje tiene la etiqueta
  «Hechicero» o «Archimago», al añadirlo a un ejército se le pueden elegir
  sendas. Desaparece el tick «Hechicero» de la ficha, que hacía el mismo
  trabajo por duplicado. La comprobación va por código de etiqueta, no por
  nombre, así que renombrarla desde Categorías y Etiquetas no la rompe.
- **Nueva distribución de «Datos generales»**: Nombre · Coste · Categoría en
  una línea, Etiqueta · Equipo en la siguiente, y los tamaños, la T.S. y el 0-1
  debajo. En un personaje esa tercera fila desaparece entera —no tiene tamaños
  ni puede ser 0-1— en vez de quedarse a medias.
- **Orden de los apartados**: Datos generales, Opciones de equipo, Opciones de
  unidad y Reglas especiales.
- En el constructor de ejércitos, «magia» y los nombres de las sendas van en
  **minúsculas**.

## 0.58 — 29/07/2026 18:05

**Arreglado: no se podía guardar una unidad.** Al añadir `is_wizard` en 0.57,
el UPDATE de la ficha pasó a pedir trece valores pero se le seguían pasando
doce. El id de la unidad caía en la columna equivocada y el `WHERE` se quedaba
sin nada, así que guardar fallaba siempre.

La causa de fondo era que ese UPDATE estaba **escrito por duplicado** —en
`updateScalarFields` y dentro de `saveUnitDetail`—: se actualizó la sentencia
en los dos sitios y la lista de parámetros solo en uno. Ahora hay una única
definición, así que ese fallo concreto no puede repetirse. Y el detector de
migraciones pendientes vigila también `is_wizard`, las sendas por entrada y la
selección de puntos.

**Rehecha la distribución de «Datos generales».** Pasa a una rejilla de doce
columnas con anchos **proporcionales al dato**: un nombre de unidad necesita
sitio, un tamaño son dos dígitos y una T.S. es uno solo. Antes todos los campos
ocupaban lo mismo o el ancho entero.

Las filas se cierran siempre completas, y el reparto cambia según el tipo:

- **Tropa** — Nombre · Categoría · Etiqueta / Coste · mín · máx · def · T.S. /
  Equipo · Unidad única (0-1).
- **Personaje** — Nombre · Categoría · Etiqueta / Coste · T.S. · **Hechicero** /
  Equipo.

Un personaje no tiene tamaños, así que ese hueco lo ocupa «Hechicero» en vez de
caer en una línea suelta con media fila vacía al lado. El 0-1 hace lo mismo
junto a Equipo, y su etiqueta se acorta a «Unidad única (0-1)» con la
explicación en el título emergente.

## 0.57 — 29/07/2026 17:15

**Hechiceros y sus sendas.**

- **Tick «Hechicero»** en la ficha de unidad, solo para personajes. Dice
  únicamente si lanza hechizos.
- **Sección «Magia» al añadir un personaje a un ejército**, solo si está
  marcado como hechicero. Se le añaden varias sendas y **cada una con su
  propio nivel** (1 a 4), porque puede llevar Fuego a 2 y Bestias a 1. Plegable
  y plegada por defecto; la cabecera resume lo que lleva («Fuego 2 · Bestias
  1») para no tener que abrirla.

Las sendas y niveles son de **esa miniatura en esa lista**, no del catálogo: el
mismo Vidente Gris puede llevar sendas distintas en dos ejércitos. Se guardan
con la lista y se copian al duplicarla.

Sobre la composición de la sección: son 30 sendas en el catálogo y un hechicero
lleva dos o tres. Pintar las 30 con su casilla y su selector llenaría la
pantalla de controles apagados, así que solo se ven las elegidas —una línea con
su nivel y su papelera— más un desplegable para añadir la siguiente. El nivel
va en cuatro botones en vez de un desplegable: son cuatro valores y así se ve
sin desplegar nada.

## 0.56 — 29/07/2026 16:10

**Fuera los textos que explican cómo funciona el programa.** Quien usa la
aplicación ya lo sabe; esos párrafos solo ocupaban sitio y desplazaban hacia
abajo lo que de verdad importa. Retirados de: Selección de puntos (los dos),
Nueva opción de unidad, Nombre propio, Hojas de Unidad (subida de imagen y
arrastre), Sendas de magia y el panel de migración de imágenes.

Se conserva lo que **no** es explicación sino información: la vista previa del
nombre según lo vas escribiendo, los avisos de una senda que se sale de la
norma, y el motivo por el que un botón está desactivado.

## 0.55 — 29/07/2026 15:40

**«Selección de puntos»: cuántas unidades exige o permite el ejército.**

Botón nuevo en la pantalla de Ejércitos. Es configuración **común a todos los
ejércitos**, no de cada lista, así que vive en el listado y no dentro de una.

Viene ya configurada con la tabla del reglamento:

| Puntos | Básicas | Especiales | Singulares |
|---|---|---|---|
| < 2.000 | 2+ | 0-3 | 0-1 |
| 2.000 - 2.999 | 3+ | 0-4 | 0-2 |
| 3.000 - 3.999 | 4+ | 0-5 | 0-3 |

**No se guarda esa tabla fila a fila, sino la regla que la genera**: por cada
categoría, si es un mínimo obligatorio o un máximo permitido, su valor base y
cuánto sube por cada 1.000 puntos. Así se extiende sola a 4.000, 5.000… sin
tocar nada, y vale para cualquier categoría que crees en Categorías y
Etiquetas, no solo para esas tres. La ventana enseña una vista previa de la
tabla ya calculada, porque «base 2, +1» no dice nada por sí solo y «2+ / 3+ /
4+» sí.

El tramo lo marca el **límite de puntos de la lista**, no lo gastado: con lo
gastado, los mínimos subirían mientras montas y una lista a medias siempre
parecería incompleta.

**Nunca da error.** Incumplir una regla no impide guardar ni exportar: sale un
aviso —«Básicas: llevas 1 y hacen falta 2 como mínimo», «Especiales: llevas 4 y
el máximo es 3»—. Además la barra de puntos enseña el estado en todo momento
(«Básicas 2/2+ · Especiales 4/0-3», en rojo lo que no cumple), para verlo
mientras montas y no descubrirlo al final.

Ojo al sentido de cada regla, que es lo que más se confunde: **Básicas** es un
mínimo y no tiene tope —llevar diez está bien—; **Especiales** y **Singulares**
son un máximo y son opcionales —llevar cero está bien—.

## 0.54 — 29/07/2026 14:45

- **Los nombres propios son solo para personajes.** Una unidad de tropa son
  veinte miniaturas iguales: «Jules el Bretón (Lanceros)» no significa nada, y
  ofrecerlo solo invitaba a llenar la lista de nombres que no distinguen a
  nadie. Si una tropa ya tuviera nombre puesto de antes, el botón sigue
  apareciendo para poder quitárselo — si no, se quedaría clavado.
- **Los carros pueden llevar reglas especiales**, igual que las monturas. Se
  asignan desde Editor → Carros, y al elegir un carro en el constructor de
  listas sus reglas se suman a las de la unidad, tanto en pantalla como en el
  PDF. Solo las del carro **elegido**: las de uno que no se ha cogido no pintan
  nada.

  En las Hojas de Unidad no aparecen, por el mismo criterio que ya se aplicaba
  a las monturas: son reglas del vehículo, no de quien lo lleva.

## 0.53 — 29/07/2026 14:05

**Fuera el apartado «Magia» de la ficha de unidad.** La ficha vuelve
exactamente a como estaba antes de añadirlo: dos columnas, «Datos generales»
arriba a la izquierda y el «Perfil base» arriba a la derecha. Se deshacen con
él las remaquetaciones de 0.50 y 0.52, que existían solo para hacerle sitio.

Se conservan los dos cambios de esa pantalla que se pidieron por separado y no
tenían nada que ver con la magia: las cabeceras siguen sin sus descripciones, y
se pueden seguir creando opciones de unidad desde el propio buscador.

**Qué NO se ha borrado**, porque no se pidió: la sección **Sendas de magia**
sigue en el Editor con sus 30 sendas y 213 hechizos, y las tablas de la base
(`magic_paths`, `magic_spells`, `unit_magic_paths`, `units.magic_level`) siguen
ahí con sus datos intactos. El nivel de mago deja de escribirse al guardar una
unidad —ya no hay dónde editarlo— pero lo que hubiera guardado se conserva: la
columna sale del `UPDATE`, no se vacía.

## 0.52 — 29/07/2026 13:20

**«Datos generales» pasa a ocupar todo el ancho de la ficha de unidad**, y se
organiza por dentro en tres bandas horizontales separadas por filetes:

1. **Identidad** — nombre, categoría y etiqueta.
2. **Números y equipo** — coste, tamaños, T.S., el 0-1 y el equipo, todo en una
   fila que se reparte a lo ancho.
3. **Perfil base**, y debajo **Magia** (plegable, solo en personajes).

El resto de apartados —reglas, opciones, grupo de mando, montura y carro—
quedan debajo, en las dos columnas de siempre y con su separación restaurada.

**Por qué en bandas y no en dos columnas:** el formulario es estrecho y alto
(campos apilados) y la tabla de atributos es ancha y baja (nueve columnas de un
carácter). Puestos uno al lado del otro, quedaba medio panel vacío bajo la
tabla. En bandas cada cosa ocupa el ancho que pide: los campos se reparten en
vez de amontonarse en media pantalla, el perfil se lee como la línea de
atributos de un libro de ejército —que es lo que es— y las sendas caben en
cinco columnas. La ficha además baja de altura en vez de crecer.

## 0.51 — 29/07/2026 12:50

- **El resumen «Composición del ejército» respeta el orden del catálogo.** Antes
  ordenaba por puntos, y el efecto era que el resumen se reordenaba solo cada
  vez que añadías una unidad: imposible comparar dos listas de un vistazo
  porque las filas no estaban nunca en el mismo sitio. Ahora sigue el orden que
  hayas dado en Editor → Categorías y Etiquetas, así que «Personajes, Básicas,
  Especiales…» sale siempre igual. Lo que no tiene categoría o etiqueta va al
  final.
- Fuera los tres textos explicativos de **Categorías y Etiquetas**.

## 0.50 — 29/07/2026 12:15

**La ficha de unidad, más recogida.**

- **El perfil base y la magia se mudan a «Datos generales».** El perfil de
  atributos es el dato general por excelencia de una unidad y tenerlo en la
  otra columna obligaba a mirar a dos sitios para leer lo mismo. La magia gana
  además el ancho de la columna: las sendas pasan de dos columnas a cuatro, así
  que el bloque crece a lo ancho en vez de a lo alto.
- **«Magia» se pliega, y nace plegada.** La mayoría de personajes no son magos;
  desplegada por defecto estiraba la ficha para no decir nada. La cabecera
  resume lo que hay dentro («Nivel 2 · 3 sendas») para no tener que abrirla solo
  para mirar. No se recuerda entre visitas a propósito: si se recordase
  abierta, se abriría también en los personajes que no tienen magia.
- **Fuera las descripciones bajo las cabeceras.** Reglas especiales, opciones
  de equipo, opciones de unidad, grupo de mando, montura y carro se quedan solo
  con su título.
- **Crear opciones de unidad desde el propio buscador**, igual que ya se podía
  con las de equipo: si la que buscas no existe, se da de alta sin salir de la
  ficha. Pide nombre y coste; el perfil y las reglas propias, si los lleva, se
  añaden luego desde Editor → Equipo y opciones.

## 0.49 — 29/07/2026 11:30

**Magia, taxonomías y nombres propios.**

### Sendas de magia (Editor → Sendas de magia)

Sección nueva con el catálogo de sendas y sus hechizos, cargado del fichero
`Resumen_sendas_20250309.md`: **30 sendas y 213 hechizos** repartidos en cuatro
grupos (Elementales, Místicas, Oscuras y Manuscritos). Se pueden crear, editar
y borrar sendas y hechizos.

**Sobre el número de hechizos por senda.** La instrucción decía 6, pero en el
fichero no hay ni una sola senda con 6: 28 tienen **7** (dos de nivel 1, dos de
nivel 2, dos de nivel 3 y uno de nivel 4), Pergaminos sagrados tiene 13 y
Yunque rúnico 4. Manda el fichero: el tope se pone en 7 y se cargan las 213 tal
cual. Las dos que se salen de la norma se marcan con un aviso ⚠ en vez de
rechazarse — son datos reales, y hacerlos desaparecer para cumplir una regla
habría sido peor que enseñar el aviso. El tope solo impide que una senda
**crezca** por encima de 7; nunca rechaza lo que ya existe.

### Magia en la ficha de unidad

Apartado nuevo, **solo para personajes** (una tropa no lanza hechizos, mismo
criterio que el grupo de mando, que solo existe para tropas): nivel de mago de
1 a 4 y las sendas que conoce, que pueden ser varias. Mientras no se elija
nivel no se ofrecen sendas: asignárselas a quien no puede lanzarlas no
significa nada. Se crean además las etiquetas **Hechicero** y **Archimago**.

### Categorías y Etiquetas (Editor)

Pantalla nueva para las dos taxonomías, que se confunden con facilidad y por
eso comparten pantalla pero no sección: la **categoría** es el hueco de
organización del ejército (Personajes, Básicas…) y la **etiqueta** es qué es la
unidad sobre la mesa (Infantería, Monstruo…). Se pueden crear, renombrar,
borrar y **reordenar arrastrando** — y ese orden es el que manda al agrupar en
Ejércitos. El código interno no se edita nunca: es la referencia con la que el
programa reconoce cada categoría, y dejarlo cambiar convertiría un renombrado
inocente en datos rotos. Al borrar algo en uso, las unidades se quedan sin ella
pero no se borra ninguna unidad.

### Ejércitos

- **Nombres propios.** Un icono en cada fila permite bautizar a una miniatura:
  la lista pasa a mostrar «Jules el Bretón (Paladín Bretoniano)». El tipo no se
  pierde nunca, porque es lo que dice qué reglas se aplican. El nombre es de
  esa miniatura en esa lista, no de la unidad del catálogo, y sale también en
  el PDF, que es donde más falta hace.
- Las reglas **de la facción** y las demás quedan separadas por un filete
  rotulado, en vez de por una línea muda.
- El marco que envuelve «Unidad y opciones» y «Ficha» pierde su fondo: los dos
  paneles de dentro ya traen el suyo y apilar pergamino sobre pergamino
  ensuciaba la pantalla.

## 0.48 — 27/07/2026 12:40

**Seis mejoras en la sección Ejércitos.**

- **El aviso de puntos dice cuánto sobra**, no solo que sobra: «Te pasas por 45
  pts del límite». Con «supera el límite» había que ir a la calculadora para
  saber si te pasabas por 5 puntos o por 300. Cuando cabe, dice lo que queda
  libre; y si estás clavado en el límite, lo confirma.
- **«Añadir unidad» y «Ficha» viven ahora en un marco plegable.** Ocupaban
  permanentemente toda la parte de arriba y empujaban «Unidades en la lista»
  fuera de la pantalla, justo cuando lo que quieres es mirar el ejército
  entero. Plegado cabe de una vez, y al pinchar cualquier unidad de la lista se
  despliega solo y lleva la vista hasta él.
- **Duplicar listas**, para probar variaciones de un mismo ejército sin perder
  el original. Copia todas las entradas con su equipo, opciones, montura y
  grupo de mando, y numera el nombre («(copia)», «(copia 2)»…). Si la copia
  falla a medias se deshace sola, para no dejar una lista vacía y huérfana.
- **Resumen «Composición del ejército»** al pasar el ratón por el título
  «Unidades en la lista»: en qué se han ido los puntos, por etiqueta y por
  categoría, con su porcentaje. Son dos repartos independientes porque
  responden a cosas distintas: de qué está hecho el ejército, y cómo se
  reparte según las reglas de composición.
- **Ordenar la lista** por coste, nombre, etiqueta, categoría o facción, en los
  dos sentidos. Reordena la lista de verdad (es lo que sale en el PDF), así que
  queda pendiente de guardar como cualquier otro cambio. Los criterios de
  agrupación desempatan por coste dentro de cada grupo: al agrupar por
  categoría, dentro de «Personajes» sale primero el caro.
- **Botón «Limpiar»** para vaciar la lista, con confirmación.

## 0.47 — 27/07/2026 10:05

**Los personajes ya no tienen «Grupo de mando» en el Editor.** Un personaje es
una única miniatura: no puede llevar músico, portaestandarte ni campeón, así
que ofrecerle esos puestos era invitar a crear datos imposibles. El panel
desaparece de su ficha, igual que ya pasaba con los tamaños mínimo/máximo. En
las unidades de tropa sigue exactamente igual.

También se ignora la sección de grupo de mando al **importar un libro** si la
entrada es un personaje: si no, el libro podría volver a meter por detrás lo
que el Editor ya no deja crear. (Comprobado en la base actual: ninguno de los
32 personajes tenía opciones de mando, así que no hay nada que limpiar.)

## 0.46 — 27/07/2026 09:30

**El aviso de «falta desplegar el Worker» acusaba en falso.** Salía justo
después de desplegarlo, que es el peor momento posible para un mensaje que
dice que no lo has hecho.

Era una carrera: al arrancar, el aviso y las migraciones salen a la vez desde
`DatabaseGate`. El aviso comprobaba el esquema mientras las migraciones seguían
en vuelo, veía las columnas nuevas ausentes y acusaba. Y como solo comprobaba
una vez, el mensaje se quedaba hasta recargar. Estaba ahí desde que existe el
aviso; las columnas de R2 solo lo hicieron evidente.

- Ahora espera a que las migraciones se hayan intentado antes de mirar (con un
  tope de 8 segundos, por si no hay contraseña o el Worker no responde).
- Y si encuentra algo pendiente, **insiste una vez pasados 3 segundos** antes
  de decir nada: las lecturas de D1 pueden ir a una réplica que todavía no
  tenga aplicado el `ALTER TABLE`, y ese retraso daba exactamente el mismo
  falso positivo.

## 0.45 — 25/07/2026 19:10

**Las imágenes de las hojas salen de la base de datos y pasan a R2.**

El diagnóstico, con números de la base real: de los 31,5 MB de la D1, ~29 MB
eran ilustraciones. Abrir una hoja de Bretonia descargaba la suya entera —de
media 985 KB, que viajaban como ~1,3 MB porque un BLOB tiene que ir en base64
dentro del JSON de la consulta— y volvía a descargarla en cada visita, porque
el navegador no puede cachear algo incrustado en la respuesta de un POST.

Ahora la base guarda solo la CLAVE del archivo y la imagen se pide por su URL
como cualquier otra imagen de la web: el navegador la guarda en su caché de
disco (volver a una hoja ya no cuesta red), la descarga en paralelo con el
resto de la página y no vuelve a molestar al Worker. Las claves incluyen el
hash del contenido, así que se sirven con caché de un año e `immutable` sin
riesgo de quedarse con una versión vieja: cambiar la imagen genera otra clave.

- Rutas nuevas en el Worker: `GET /image/<clave>` pública con caché larga,
  `PUT` y `DELETE` con la contraseña de grupo (en cabecera, porque el cuerpo
  son los bytes crudos de la imagen).
- **La transición no rompe nada a medias:** mientras una hoja tenga bytes en la
  base y no tenga clave, se sigue leyendo de ahí. Unas hojas se sirven de una
  forma y otras de la otra sin que se note.
- **Migración de las imágenes ya existentes** en Editor > Registro >
  Mantenimiento: las procesa de una en una, recomprimiéndolas de paso (los PNG
  de ~1 MB salen como WebP de ~110 KB). Es reanudable — si falla a mitad, se
  vuelve a lanzar y sigue por donde iba.
- Las exportaciones a PNG y Word piden las imágenes con CORS. Sin eso, una
  imagen de otro dominio "contamina" el canvas y `toDataURL` lanza una
  excepción de seguridad: habrían dejado de funcionar por completo.

**Además, en Hojas de Unidad:** la marca de completada baja a debajo de la
hoja y pasa a decir «Hoja completada» —es un juicio sobre la hoja que estás
mirando, así que se decide con ella delante—, y la sección «Escudo» pasa a
llamarse «Emblema».

## 0.44 — 25/07/2026 17:55

La normalización de bytes que entró en 0.43 cubre además el caso de un
`Uint8Array` que en algún punto pasó por `JSON.stringify` y llega como objeto
con claves numéricas (`{"0":137,"1":80,…}`). Antes ese envase no daba error
pero producía una imagen vacía, que es peor: falla en silencio.

**Si sigues viendo «bytes.subarray is not a function», es una build antigua en
caché.** El número de versión del pie de página lo confirma: tiene que poner
0.44 o superior. Recarga forzando el vaciado de caché (Ctrl+Mayús+R, o
Cmd+Mayús+R en Mac).

## 0.43 — 25/07/2026 11:20

**Corrección de una regresión de 0.42: «bytes.subarray is not a function».**
Al abrir una ficha que ya tenía ilustración guardada (se vio en Bretonia) la
sección reventaba.

Causa: los bytes de un BLOB no llegan siempre en el mismo envase. El Worker
convierte a `{__b64}` las columnas que D1 le devuelve como `ArrayBuffer` o
`Uint8Array`, pero D1 devuelve algunas como un **array de números normal**, que
no entra en ese caso y llega al navegador tal cual; y desde el catálogo local
(sql.js) llegan como `Uint8Array` de verdad. El `bytesToDataUrl` anterior
recorría los bytes por índice y toleraba las tres formas por accidente; el
nuevo, más rápido, usa `subarray`, que solo existe en los arrays tipados.

Ahora se normaliza el envase explícitamente (`ByteSource` + `byteLength` en
`shared/image.ts`) en vez de dar por hecho el tipo, y se usa en los dos sitios
que leen imágenes de la base: fichas y emblemas de facción.

## 0.42 — 25/07/2026 10:40

**Hojas de Unidad: arrastre, rendimiento y subida de imágenes.** Tres
problemas que venían de la misma raíz — la sección escribía en la base de
datos en cada gesto y guardaba las imágenes sin acotar su peso.

**La imagen se agarra por cualquier punto.** Había dos fallos encadenados:

- La ilustración se pinta en una capa por DEBAJO del texto (`z-index` 1 contra
  2), así que el navegador entregaba el clic al párrafo que hubiera delante:
  solo respondía al arrastre por los trozos de imagen que no pisaba ningún
  texto, que en una ficha con la columna a la derecha son justo los menos.
  Ahora hay una zona de agarre transparente por encima de todo, del tamaño
  exacto de la imagen: el aspecto de la ficha no cambia y vale cualquier
  punto, incluidas las zonas transparentes de un recorte.
- La posición se acotaba a `0 … anchoÚtil - anchoImagen`. En cuanto la
  ilustración ocupaba el ancho de la ficha (a partir de ~68% de zoom) ese
  rango se quedaba en un único punto y la imagen **no se movía ni un píxel**,
  sin explicación. Ahora puede salirse por los bordes tanto como se quiera; lo
  único que se impide es perderla de vista del todo.
- De propina: `preventDefault` en el gesto (antes el navegador lo interpretaba
  a veces como «seleccionar texto» y el arrastre se soltaba a medias), captura
  del puntero en el elemento correcto, y las flechas del teclado mueven la
  imagen píxel a píxel (Mayús, de 10 en 10) con la zona de agarre enfocada.

**Se edita en memoria y se guarda con un botón.** Antes cada control escribía
por red al moverse: un deslizador disparaba una petición por paso. Ahora la
ficha abierta vive en un borrador local —todos los controles responden al
instante, sin red— y solo «Guardar» escribe, una vez y en un único batch. Con
el mismo diálogo de tres vías que ya usan Unidades y las listas (guardar y
salir / descartar y salir / seguir editando) al cambiar de ficha, de facción,
al navegar fuera o al cerrar la pestaña. Las fichas ya visitadas se quedan en
memoria, así que volver a una es inmediato.

**Entrar en la sección ya no descarga todas las ilustraciones.** El listado
«Tus hojas» pedía la fila COMPLETA de cada ficha de la facción —imágenes
incluidas, varios MB en base64— para pintar un tick verde junto a unos
nombres. Ahora pide dos columnas y ni un byte de imagen; la ficha completa se
carga solo al seleccionarla. De paso, el tick de «completada» funciona también
en monturas y opciones, que antes salían siempre sin marcar.

**Las imágenes grandes vuelven a subir.** Se guardaban como PNG de 1200 px: 4-6
MB que, al codificarse en base64 para el Worker, se convertían en ~8 MB de
JSON y reventaban la escritura. Ahora se comprimen en el navegador a WebP con
transparencia (o PNG/JPEG si el navegador no tiene WebP), bajando primero
calidad y después tamaño hasta caber en 600 KB la ilustración y 120 KB el
escudo. La decodificación usa `createImageBitmap`, que aguanta mucho mejor las
fotos enormes. Las exportaciones a Word convierten a PNG antes de incrustar,
porque Word no entiende WebP.

## 0.41 — 21/07/2026 19:55

**Los ajustes de la hoja ya no fallan en silencio.** Los controles que se
aplican al instante (deslizadores, arrastre de la ilustración, visibilidad de
las fichas de atributos, «completada») pintaban el cambio antes de escribirlo y
NO recogían el error: si la escritura fallaba, la pantalla seguía enseñando
algo que no se había guardado y solo se descubría al recargar. Era justo lo que
pasaba con la visibilidad.

- Ahora, si falla, se avisa y se recarga la hoja desde la base de datos, para
  que lo que se ve vuelva a ser la verdad.
- El detector de migraciones pendientes cubre además las tres novedades que le
  faltaban: `sheet_presentations`, `section_widths` y `hidden_profiles`. Sin
  ellas en la lista, el aviso de la cabecera no llegaba a saltar aunque la
  causa fuese esa.

Nota: la causa de fondo casi siempre es la misma — falta desplegar el Worker,
que es donde viven las migraciones. Verificado que, una vez guardado, el filtro
se aplica por igual a la vista previa y a lo exportado (PNG y Word).

## 0.40 — 21/07/2026 19:30

- Las **fichas de atributos** dejan de tener sección propia y pasan a
  **«Tarjeta»**: es una decisión sobre qué enseña la tarjeta, igual que su
  alto, y así se vuelve a cuatro secciones en vez de cinco.
- Cada fila se enciende y se apaga con un **ojo / ojo tachado** en lugar de una
  casilla. Aquí no se está marcando una lista, se está mostrando u ocultando
  algo, y el icono lo dice sin tener que leer.

## 0.39 — 21/07/2026 19:10

- **Hojas de Unidad**: nueva sección plegable **«Fichas de atributos»** con una
  casilla por cada fila de la tabla de características (la unidad, el campeón,
  cada montura, cada carro y las opciones con ficha propia). Desmarcar una la
  quita de la hoja.
- Se guarda por hoja, y vale para unidades, monturas y opciones.
- Se guardan las fichas OCULTAS, no las visibles: así, al añadirle luego una
  montura o un campeón a la unidad, su fila aparece por defecto en vez de
  quedarse invisible sin motivo aparente.
- El filtro vive en `unifiedProfileRows`, que es de donde sacan las filas la
  tarjeta, el canvas de exportación y el Word — la única forma de que los tres
  oculten exactamente lo mismo.
- La sección solo aparece si la hoja tiene más de una ficha: con una sola,
  ocultarla dejaría la tabla vacía.

## 0.38 — 21/07/2026 18:30

**La sección «Fichas» pasa a llamarse «Hojas de Unidad»**, para que no se
confunda con el panel «Ficha» del constructor de ejércitos.

- Renombrado en toda la interfaz: menú, título, «Tus hojas», avisos, textos de
  Editor («Incluir en hojas de unidad», «Sale en Hojas de Unidad»), Log y «Mis
  facciones».
- La ruta pasa de `#/fichas` a `#/hojas`, con una redirección desde la antigua
  para no romper enlaces guardados.

**Las opciones de equipo excluyentes van juntas en una línea**, separadas por
« / »: «Lanza (+2) / Arma a dos manos (+2) / Arma de mano adicional (+2)». Es
lo que son —una elección, no tres cosas que se sumen—; una por renglón daba a
entender lo contrario. Las que no son excluyentes siguen en su propia línea, y
las opciones de UNIDAD no se agrupan nunca.

- Se agrupan solo **cliques**: que A choque con B, y B con C, no significa que
  A y C sean alternativas. Sin esa comprobación se habrían juntado en la misma
  línea opciones que sí se pueden llevar a la vez.
- Dentro de la línea se respeta el orden del catálogo.
- Las parejas excluyentes viajan ya en `UnitDetail`, así que la agrupación sale
  igual en pantalla y en las dos exportaciones sin pasar nada por parámetro.

## 0.37 — 21/07/2026 17:45

- **Fichas** deja de mostrar las unidades **desactivadas**. Solo se ocultan: su
  ficha (ilustración, escudo, anchos, «completada») sigue guardada tal cual, así
  que al reactivarlas desde el Editor vuelven exactamente como estaban.
- El texto de los apartados **ya no se justifica**, salvo en «Reglas
  especiales». En los cortos («Equipo: Arma de mano, escudo») justificar
  repartía el sobrante entre dos o tres palabras y abría huecos enormes.
- Justificado también en el canvas de exportación, que no tiene `text-align` y
  dibuja el texto a mano: sin ello, «Reglas especiales» habría salido
  justificada en pantalla y con el margen irregular en el PNG y el Word. La
  última línea del párrafo se deja al natural, igual que hace el navegador, y
  si el hueco entre palabras saliera desmesurado no se justifica —queda peor
  que un margen irregular.

## 0.36 — 21/07/2026 17:20

- **Fichas**: los controles de la izquierda se agrupan en cuatro secciones
  plegables —Imagen, Tarjeta, Ancho de los apartados y Escudo— en vez de ir
  uno detrás de otro. La columna había ido creciendo y obligaba a desplazarse
  justo cuando lo que interesa es ver la tarjeta y sus controles a la vez.
- Al entrar solo se abre **Imagen**; el resto está a un clic. Qué secciones
  dejas abiertas se recuerda entre visitas.
- Menos aire entre bloques (de `space-y-6` a `space-y-2`) y relleno más
  ajustado dentro de cada sección.
- «Ficha completada» se queda fuera de las secciones: es una sola línea y
  plegarla no ahorraría nada.

## 0.35 — 21/07/2026 16:50

**Ancho ajustable por apartado en cada ficha.** Cada bloque en negrita
—Tamaño de la unidad, Equipo, Montura, Opciones, Grupo de mando y Reglas
especiales— tiene su propio deslizador de ancho, para estrecharlo y dejarle
sitio a la ilustración sin que se pisen.

- El texto salta de línea al llegar a ese ancho y se **justifica** respecto a
  él, no respecto a la tarjeta.
- Se guarda por ficha, y vale igual para unidades, monturas y opciones.
- La columna de texto pasa a ocupar el ancho completo y es cada apartado el que
  se estrecha. Ese 64% que antes tenía la columna entera es ahora el valor por
  defecto de cada apartado, así que **las fichas ya hechas se ven exactamente
  igual** que antes.
- Aplicado también al **canvas de exportación**, que dibuja la ficha a mano y
  por tanto no hereda nada del CSS: sin esto, el PNG y el Word habrían salido
  con los anchos viejos y se rompería el «exportas lo que ves» de la sección.
- Solo se ofrecen los apartados que esa ficha tiene: la lista se calcula con
  las mismas funciones que usa la tarjeta al pintarla, así que no pueden
  desincronizarse.
- Los anchos se guardan como JSON en una columna nueva. Se tolera cualquier
  dato corrupto (JSON inválido, claves desconocidas, valores no numéricos)
  cayendo al valor por defecto: es una preferencia visual y nunca debe romper
  una ficha.

## 0.34 — 21/07/2026 15:55

Las fichas de **montura y de opción de unidad** ya se pueden editar como las de
unidad: ilustración, encuadre, brillo, volteo, escudo propio, alto y marca de
completada. Antes se mostraban en modo lectura.

- No era un olvido: la presentación se guarda en `unit_sheets`, cuya clave
  ajena apunta a `units`, y una montura no es una unidad. Se añade una tabla
  gemela, `sheet_presentations`, con clave (tipo, id).
- Se descartó meterlas en `unit_sheets`: habría obligado a quitar esa clave
  ajena —y con ella el borrado en cascada que hoy limpia la presentación al
  borrar una unidad— o a inventar ids falsos. Duplicar unas columnas sale más
  barato que degradar la integridad de la tabla principal.
- `UnitSheetRepository` pasa a trabajar con un «destino» `{tipo, id}` y decide
  él solo a qué tabla va cada operación, así que las tres clases de ficha
  comparten el mismo código.
- La exportación (PNG y Word) ya incluye la presentación guardada de monturas y
  opciones; antes se exportaban siempre en blanco.
- La ilustración de una montura es COMPARTIDA entre facciones, a propósito: un
  Gran Águila es la misma bestia la monte quien la monte. Lo que sí cambia por
  facción es el emblema.

## 0.33 — 21/07/2026 15:10

**La aplicación avisa ahora cuando falta desplegar el Worker.** Las tablas y
columnas nuevas se crean con migraciones que viven en el código del Worker, así
que desplegar solo el frontend deja funciones a medias — y se manifiesta de
formas desconcertantes.

El caso que lo motivó: al no existir todavía `include_in_sheets`, guardar una
montura daba error Y al mismo tiempo desaparecían todas las fichas de montura.
Dos síntomas sin relación aparente y una sola causa: la copia local del
catálogo sí tiene la columna (se crea desde `db/schema.sql`), pero las filas
llegan del servidor sin ella, así que todas valían 0 y ninguna montura quedaba
marcada.

- Aviso en la cabecera, solo en modo administrador, con la lista de lo que está
  pendiente y el comando exacto para arreglarlo.
- La comprobación son SELECT inofensivos y solo avisa ante «no such
  table/column»: un fallo de red o de contraseña no dispara un aviso falso.

## 0.32 — 21/07/2026 14:45

- **Fichas**: las de montura y las de opción de unidad ya llevan **emblema**.
  Se construían con una facción vacía, así que no tenían de dónde sacarlo.
- El emblema es el de la **facción desde la que se está mirando**, no uno
  guardado en la montura. Estos son catálogos globales —la misma Gran Águila
  puede ser de varias facciones—, así que la misma ficha sale con el emblema de
  los Silvanos o con el de los Altos Elfos según desde dónde se abra, sin
  duplicar nada ni tener que elegir un dueño.
- Vale igual para lo exportado (PNG y Word), que resuelve el emblema por el
  mismo camino.

## 0.31 — 21/07/2026 14:20

Las **monturas y dotaciones** deciden ahora si salen en fichas, igual que las
opciones de unidad.

- Nueva casilla **«Incluir en fichas»** en Editor → Montura/Dotación, y aviso
  «Sale en Fichas» en la tarjeta de las marcadas. La sección «Fichas» solo
  muestra esas.
- Pasada automática de partida sobre TODAS las facciones: se marcan las
  monturas que monta algún **personaje** y se dejan sin marcar las demás. El
  criterio es el del juego: la montura de un personaje es una elección suya
  que cambia su ficha —y suele ser un monstruo con atributos y reglas
  propios—, mientras que las cabalgaduras y dotaciones de tropa vienen
  incluidas en la unidad y no se consultan por separado.
- Una montura que monten personaje y tropa cuenta como de personaje, y por
  tanto se marca.
- La pasada se aplica una sola vez y no vuelve a pisar la marca: a partir de
  ahí manda lo que se ponga a mano.

## 0.30 — 21/07/2026 13:40

- **Editor → Montura/Dotación**: si falla el guardado de las reglas especiales
  (o de las facciones asociadas), ahora se DESHACE el cambio en pantalla y se
  explica el error. Antes la promesa se dejaba suelta: la regla se quedaba
  marcada aunque no se hubiera guardado nada, y el fallo solo se descubría
  mucho después, al no verla en su ficha. El mensaje avisa además del caso más
  probable — que falte desplegar el Worker con la tabla
  `profile_special_rules`.

## 0.29 — 21/07/2026 13:15

Correcciones en cómo se tratan las **monturas**.

- **Ejércitos**: el perfil y las reglas especiales de una montura (o un carro)
  ya solo aparecen en el panel «Ficha» cuando esa montura está ELEGIDA para la
  entrada. Antes salían todas las que la unidad podía llevar, prometiendo un
  «Vuela» que la unidad todavía no tenía.
- **Fichas**: las reglas de las monturas dejan de mezclarse en la ficha de
  quien las lleva. Solo salen en la ficha de la propia montura, porque un
  jinete solo tiene esas reglas si de verdad monta ese monstruo. Se retira el
  campo `allSpecialRules`, que precalculaba esa mezcla y era engañoso.
- **Fichas**: las «Opciones de unidad» se filtran por facción. El catálogo de
  opciones es global, así que sin filtrar aparecía el «Grupo de apoyo:
  Ametralladora» en todas las facciones. La pertenencia se deduce de qué
  unidades las ofrecen, igual que en el resto del catálogo compartido.
- **Fichas**: nuevo grupo **«Monturas y dotaciones»** con la ficha propia de
  cada montura de la facción — atributos y reglas incluidos. Se pueden ver y
  exportar como una ficha más, y ahora son el único sitio donde consultar las
  reglas de un monstruo.

## 0.28 — 21/07/2026 12:35

**Arreglada la doble confirmación en los borrados.** El Log lo destapó el
primer día: aparecían dos entradas de «Borró la regla especial "Carga ligera"»
para un solo borrado. No fallaba el Log — estaba contando la verdad.

- El borrado real es una petición de red, y el diálogo seguía en pantalla
  mientras iba y venía: dos clics seguidos disparaban dos borrados. El segundo
  no borraba nada (la fila ya no estaba), pero sí dejaba su rastro.
- `ConfirmDialog` se bloquea al confirmar: botones deshabilitados, «Un
  momento…» y sin poder cerrarse con Escape ni pinchando fuera. El guardián es
  un `ref` y no solo estado, porque entre dos clics rápidos el componente
  puede no haberse vuelto a pintar todavía.
- Afecta a los SIETE diálogos de borrado de la aplicación, incluidos los de
  Ejércitos: cualquiera podía dispararse dos veces.
- Segunda barrera en los repositorios: borrar algo que ya no existe no
  registra nada, así que ninguna llamada repetida deja un borrado fantasma.

## 0.27 — 21/07/2026 12:10

Nueva sección **Editor → Log**: qué se ha tocado, quién y cuándo.

- Registra las ediciones del catálogo compartido: facciones, unidades, reglas
  especiales, equipo, opciones de unidad, monturas y carros. Crear, editar,
  borrar, copiar y activar/desactivar.
- **No registra Fichas ni Ejércitos**, por decisión de alcance: son trabajo
  personal de cada usuario, no catálogo del grupo, y su ruido taparía lo que sí
  interesa auditar.
- Una entrada por acción, no por campo. Agrupadas por día, con filtros de
  usuario y de tipo, y carga por páginas.
- El nombre de quien hizo el cambio se guarda **copiado** en cada entrada: el
  registro tiene que seguir diciendo quién fue aunque ese usuario se borre
  después.
- Los nombres se leen ANTES de borrar, para que el registro diga «Borró la
  regla "Odio"» y no «Borró la regla #37».
- Si falla el registro (tabla sin migrar, red caída) NO se rompe la edición: ya
  está guardada, y perder una línea de log es mucho menos grave.
- Pestaña **Programa**: el historial de versiones, leído del propio
  CHANGELOG.md en tiempo de compilación. Es la respuesta a «¿pueden verse
  también los cambios de Claude?» — no son cambios de datos sino del programa,
  así que van aparte y sin una segunda lista que mantener a mano.

## 0.26 — 20/07/2026 21:55

- Los recuentos de unidades **ya no suman las desactivadas**: ni el «24 unidades
  · 6 personajes» de las láminas de Facciones ni el de la cabecera de «Unidades
  y personajes». Una unidad desactivada no se puede meter en un ejército, así
  que contarla daba una idea falsa de lo disponible. Para no perder el dato, la
  cabecera añade «· N desactivadas» cuando las hay.
- **Deshecho el recorte de la 0.25**: bajar la lámina a 5:4 no encogía la
  ilustración, la cortaba por arriba y por abajo. Vuelve a ser cuadrada, como
  el original de 480×480, y el rótulo grande se sostiene haciendo la tarjeta
  algo más alta.
- Quitado el hueco bajo el nombre de facción: reservar siempre dos líneas
  dejaba una vacía en los nombres cortos, que son la mayoría.

## 0.25 — 20/07/2026 21:30

**Arreglado: no se podía añadir grupo de mando a una unidad nueva.** El panel
«Grupo de mando» solo se pintaba si la unidad YA tenía puestos, así que en una
unidad creada desde cero no aparecía nunca: el grupo de mando solo podía llegar
importando de un libro o copiando otra unidad.

- El panel se muestra siempre, con Músico / Portaestandarte / Campeón para
  marcar. El alta y la baja se escriben al momento, como «Crear ficha base».
- Al quitar el Campeón se borra también su ficha de atributos propia, que no
  comparte nadie: el esquema solo desengancha la referencia y quedaba un perfil
  huérfano en el catálogo.
- Añadido «+ Crear ficha del campeón»: un Campeón recién añadido no trae
  perfil, y tampoco había forma de dárselo.

**Reglas especiales duplicadas, unificadas.** 11 grupos que eran la misma regla
escrita en singular y plural (o con sinónimos) se funden en su primer nombre:
Causa miedo, Causa terror, Inflamable, Controlada, Incursores, Guardabosques,
Espíritu del bosque, Inmune a desmoralización, Inmune a psicología, Inmune al
fuego e Inmune al pánico.

- Las unidades, opciones y monturas que llevaban una duplicada pasan a llevar la
  buena; después se borra la sobrante. Quien tuviera las dos a la vez se queda
  con una sola.
- Si la buena no existía pero sí una duplicada, se renombra en vez de crearla,
  para no perder quién la llevaba ni su descripción.
- Se aplica sola al arrancar, con el mecanismo de correcciones únicas que ya
  usaba la app, y es idempotente.

**Facciones**: el nombre sube a `text-lg` y la lámina pasa a 5:4, cediendo alto
de imagen a favor del rótulo. Los nombres largos usan dos líneas de alto fijo,
para que todas las cartelas midan igual.

## 0.24 — 20/07/2026 20:55

- **Facciones**: la rejilla pasa de 3 a **4 columnas**, y a **5** en pantallas
  anchas. Las láminas quedan en ~215/~170 px: siguen siendo 3-4 veces la imagen
  original, pero ahora se ve la colección entera de un vistazo, que es lo que
  se le pide a una pantalla de índice.
- Escalado el detalle a ese ancho, no solo encogida la caja: viñeta interior de
  26 a 18 px (a este tamaño se comía el borde de la escena), nombre a `text-sm`
  para que «Reyes Funerarios» u «Orcos y Goblins» quepan enteros, y cartela,
  botones y degradado más compactos.

## 0.23 — 20/07/2026 20:40

Rediseño de **Facciones**: de rejilla de fichas con un icono a rejilla de
**láminas** de bestiario.

- La ilustración pasa de un cuadrado de 56 px a ocupar la tarjeta entera
  (~285 px). Las imágenes de facción son escenas cuadradas de 480×480, así que
  a 56 px se estaba tirando casi toda la imagen. Se respeta su proporción
  cuadrada en vez de recortarlas.
- El nombre baja a una **cartela** de pergamino bajo la ilustración, con el
  filete de la casa, y debajo el **recuento de unidades y personajes** de la
  facción — dato nuevo: de un vistazo se ve cuáles están trabajadas y cuáles
  siguen vacías.
- La tarjeta entera es el enlace a sus unidades, en vez de un «Ver unidades →»
  de 90 px. Editar y borrar flotan sobre la ilustración y aparecen al acercarse.
- Detalles: viñeta interior reforzada (a este tamaño el recorte se notaba «a
  cuchillo»), degradado que asienta la imagen sobre la cartela, elevación y
  `scale` mínimos al pasar el ratón, y la inicial en tipografía de display
  cuando la facción no tiene emblema.
- La rejilla llega a 3 columnas y no a 4: con el ancho de la app, cuatro
  volverían a empequeñecer la ilustración.

## 0.22 — 20/07/2026 20:10

Alineada la cabecera del panel «Ficha» del constructor, que se leía como dos
informaciones sueltas (texto arriba a la izquierda, emblema colgando abajo a la
derecha) en vez de como una cabecera.

- Misma estructura que `FactionMasthead` en «Unidades y personajes»: nombre,
  filete y línea de detalle a un lado; emblema al otro.
- Los dos lados van **centrados entre sí**. El bloque de texto medía ~36 px y la
  columna del emblema ~128 px, así que ni empezaban ni acababan a la misma
  altura; centrándolos, el desnivel se reparte.
- El nombre sube a `text-lg` y la etiqueta de tipo baja a la línea de detalle,
  junto a la facción: la columna izquierda gana altura y equilibra el emblema
  de 96 px.
- Fuera el tooltip del emblema: repetía la facción, que ahora ya está escrita
  justo al lado.

## 0.21 — 20/07/2026 19:50

- **Ejércitos**: vuelve el emblema de la facción a la derecha del panel
  «Ficha», con la etiqueta de tipo encima. Se había perdido: el comentario del
  panel seguía describiéndolo y hasta quedaba un `import` muerto de
  `FactionEmblem` (retirado en la 0.13).
- Va en el cuerpo del panel, no en su cabecera: ahí el emblema de 96 px hacía
  crecer la cabecera y empujaba hacia abajo todo el contenido de la columna
  izquierda. Es justo lo que ya advertía ese comentario.

## 0.20 — 20/07/2026 19:30

- **Editor → Reglas especiales** gana el mismo control de uso que «Equipo y
  opciones»: casilla «Mostrar reglas sin usar» y, en cada regla, un contador
  que se despliega para ver exactamente quién la usa.
- El recuento suma los **tres** orígenes posibles: unidades, opciones de unidad
  con ficha propia y monturas/monstruos del catálogo. Contar solo las unidades
  habría marcado como huérfana una regla que en realidad lleva un dragón.
- El aviso al borrar una regla usa ese mismo recuento, así que ya avisa también
  cuando la regla solo la usa una montura o una opción.
- `UsageBadge`/`UsageList` pasan a `shared/ui` y los comparten las dos
  pantallas, en vez de estar duplicados.

## 0.19 — 20/07/2026 19:05

- **Arreglado «No se pudo cargar esta unidad.» al crear una unidad.** La causa
  estaba lejos del síntoma: la copia local del catálogo (sql.js) lleva su
  propio contador AUTOINCREMENT, así que el id que devolvía D1 no era el que se
  quedaba en local, y al navegar a la ficha recién creada se pedía un id que en
  local no existía. Ahora la copia local se queda con el MISMO id que asigna
  D1. También arregla, de paso, las filas que se creaban a continuación con ese
  id (el perfil base, entre otras).
- **La categoría es obligatoria** al crear una unidad: fuera la opción «Sin
  categoría».
- Nueva opción **«Crear desde otra unidad»**: se elige facción (la actual por
  defecto) y una unidad suya, y se copia entera —perfil, equipo, reglas,
  opciones, monturas y grupo de mando— con el nombre y la categoría que
  indiques. Sirve entre facciones distintas.
- Quitado el aviso «Los personajes se ordenan automáticamente por coste.».
- **Unidades y personajes** recuerda qué categoría tenías desplegada en vez de
  volver siempre a «Personajes» al entrar en una unidad y entrar de nuevo.

## 0.18 — 20/07/2026 18:35

- **Ejércitos**: el 0-1 deja de explicarse con una frase y pasa a marcarse con
  el mismo distintivo ámbar que en «Unidades y personajes», junto al nombre de
  la unidad. Aparece tanto en la lista de unidades a añadir como al editar una
  entrada ya puesta (donde no se ve la lista).
- La línea de «Tamaño: X a Y miniaturas» se mantiene, que es otra cosa.

## 0.17 — 20/07/2026 18:20

**Corregido el significado de "0-1"** (estaba mal interpretado desde el
principio). 0-1 limita cuántas **unidades** de ese tipo caben en el ejército
—una—, no cuántas **miniaturas** la forman: es un regimiento corriente y su
tamaño casi siempre será mayor que 1.

- El constructor ya no fuerza la cantidad a 1 ni bloquea el campo en una
  unidad 0-1: arranca en su tamaño habitual y se valida con `min_size`/
  `max_size` como cualquier otra tropa.
- La ficha vuelve a mostrar el coste **por miniatura** en las unidades 0-1
  (antes lo daba como coste plano, propio de personajes).
- Se muestran las dos cosas a la vez: el aviso de 0-1 y el rango de tamaño.
- Textos más claros: «Solo una unidad de este tipo en el ejército (0-1)» en la
  ficha de unidad, y el error al repetirla lo explica en esos términos.
- Sigue en pie lo de la 0.15: un personaje nunca es 0-1.

## 0.16 — 20/07/2026 18:05

**Arreglado el fondo de pergamino (y las tipografías) en GitHub Pages.**

- El fondo y las fuentes Caslon Antique se veían en local pero no en el sitio
  desplegado. No era un problema del despliegue: en desarrollo el CSS se
  inyecta como `<style>` y sus rutas relativas se resuelven contra la raíz,
  pero al compilar el CSS acaba dentro de `assets/`, y entonces
  `./assets/backgrounds/parchment.jpg` pasaba a buscarse en
  `assets/assets/backgrounds/` → 404. Venía así desde la 0.7, cuando esas
  rutas pasaron de absolutas a relativas.
- `parchment.jpg` y las dos Caslon Antique del CSS se mueven de `public/` a
  `src/`: ahora las procesa Vite, que las emite junto al CSS y reescribe la
  URL para cada modo. Funciona igual en local y desplegado, con cualquier
  `base`.
- Quedan en `public/` (correctamente) los recursos que se piden por red en
  tiempo de ejecución: fuentes y textura del PDF, iconos de mando, sql-wasm y
  la base de datos.

## 0.15 — 20/07/2026 17:40

Un **personaje nunca es "0-1"**.

- El "0-1" que algunos libros traen pegado al nombre de un personaje ya no se
  importa: 0-1 es un distintivo de tropas. La vista previa de importación
  tampoco lo pinta.
- Al leer una unidad se fuerza `isUnique = false` en los personajes, así que ni
  un dato antiguo puede colar el distintivo en pantalla ni bloquear el añadir
  un segundo personaje igual a una lista.
- Migración que limpia `is_unique` en los personajes ya guardados.
- **Un mismo personaje puede repetirse en una lista**; el límite lo pone la
  organización del ejército, no un 0-1.

## 0.14 — 20/07/2026 17:25

Las **monturas y monstruos pueden tener reglas especiales propias**.

- Nueva tabla `profile_special_rules` (migración idempotente en el Worker, se
  aplica sola al arrancar).
- **Editor → Montura/Dotación**: cada ficha tiene ahora su propio apartado de
  reglas especiales, con el mismo buscador que las unidades. Los carros no lo
  ofrecen.
- Esas reglas se **suman a las de la unidad** que lleve la montura, sin
  repetirse si ya las tenía: se ven así en Fichas, en el panel «Ficha» del
  constructor y en el PDF de la lista (donde solo cuenta la montura elegida
  para esa entrada, no todas las posibles).
- `UnitDetail.specialRules` sigue siendo *solo* lo que edita Editor → Unidades;
  lo que se pinta es el nuevo `UnitDetail.allSpecialRules`. Así, guardar una
  unidad nunca se traga las reglas heredadas del monstruo.

## 0.13 — 20/07/2026 17:00

- **Fichas**: a la derecha de la fila del selector de facción aparecen ahora el
  nombre y el emblema de la facción, la misma ilustración que en «Unidades y
  personajes».
- Retirado un import muerto en `ArmyListBuilderPage` que rompía la compilación
  de TypeScript.

## 0.12 — 20/07/2026 15:50

- El emblema vuelve a ser **cuadrado** (esquina `rounded-sm`, como el resto de
  tarjetas), sin marco: lo asientan la sombra exterior y una viñeta interior
  suave.
- Constructor de ejércitos: el emblema pasa a la **derecha del panel «Ficha»,
  bajo la etiqueta de tipo**, y al mismo tamaño que en «Unidades y personajes».
  Ya no acompaña al nombre de la unidad.
- El emblema de la tabla del ejército vuelve también a cuadrado.

## 0.11 — 20/07/2026 15:41

Rediseño de la presencia de la facción (sustituye al apaño de la 0.10).

- El emblema pasa a ser un **medallón circular sin borde**, con sombra exterior
  y viñeta interior. Las imágenes de facción no son logotipos sino
  ilustraciones cuadradas de 480×480: enmarcadas parecían un parche pegado, y
  sin marco dejaban un cuadrado a pelo. En redondo se leen como un sello.
- «Unidades y personajes»: nueva cabecera de facción (`FactionMasthead`) con el
  medallón grande a la izquierda, el nombre de la facción en granate y a buen
  tamaño, un filete y el recuento de unidades y personajes. El selector pasa a
  la derecha, como control secundario.
- Constructor de ejércitos: el mismo lenguaje en pequeño dentro del panel
  «Ficha» — medallón a la izquierda del nombre de la unidad, con el nombre de
  la facción debajo.
- El emblema de la tabla del ejército también pasa a redondo, para que sea el
  mismo objeto en miniatura.

## 0.10 — 20/07/2026 15:33

- «Unidades y personajes»: al elegir facción se muestra su emblema junto al
  desplegable.
- Constructor de ejércitos: al seleccionar una unidad, su emblema de facción
  aparece en la cabecera del panel «Ficha», junto a la etiqueta de tipo. Útil
  porque una lista puede combinar unidades de varias facciones.
- Nuevo componente `FactionEmblem` en `shared/ui`, para no repetir el marco del
  emblema en cada pantalla.

## 0.9 — 20/07/2026 15:12

- Los escudos de categoría se mantienen a color aunque se active el modo
  blanco y negro. En ellos el color es el dato (oro = Singular, bronce =
  Básica, plata = Especial), no decoración: desaturados quedaban en tres grises
  casi idénticos y dejaban de distinguirse. Revierte la regla añadida en 0.4.
  Los emblemas y las ilustraciones sí se siguen desaturando.

## 0.8 — 20/07/2026 15:03

- **Corregida la validación de la T.S.**: seguía exigiendo entre `2+` y `7`
  (con el 7 como «sin salvación») y por eso rechazaba el guardado. Ahora acepta
  de 0 a 6, con el `0` como «sin salvación».
- Migración de datos: las unidades guardadas con la convención antigua
  (`armor_save = 7`) pasan a `0`, para que no se vean como «7+» ni fallen al
  guardarlas.
- **Tooltip propio** (`shared/ui/Tooltip`) en lugar del atributo `title`
  nativo: aparece al instante, sin el segundo de espera, se puede consultar
  tocando en móvil, se cierra con Escape y se dibuja en un portal para que no
  lo recorte la tabla. Aplicado en la lista de ejército y en la importación.
- **`WarningIcon`** sustituye al carácter `⚠`, que se dibujaba con la fuente de
  emoji del sistema y cambiaba de aspecto en cada plataforma.

## 0.7 — 20/07/2026 14:56

Repaso de diseño de todo el proyecto.

- **Colores semánticos**: nuevos tokens `danger` y `success`, tirados hacia el
  tierra de la paleta. Sustituyen a los `red-500/600/700/800/900` y a la mezcla
  de `green` y `emerald` que se usaba para lo mismo (25 ficheros).
- **Escala tipográfica**: `text-mini` (11 px) y `text-micro` (10 px) sustituyen
  a los `text-[11px]`, `text-[10px]` y `text-[9px]` sueltos (13 ficheros).
- **`Panel` unificado** en `shared/ui`: estaba duplicado en tres pantallas con
  paddings y tamaños de título distintos.
- **Foco de teclado en los botones**: `Button` no tenía ninguno, mientras los
  campos de texto sí. Ahora lleva anillo `focus-visible`.
- **Tabla del ejército con scroll horizontal** en pantallas estrechas, en vez
  de aplastarse.
- **Rutas de CSS relativas** (`./fonts/…`, `./assets/…`): eran absolutas
  mientras el resto del proyecto usa `BASE_URL`, lo que rompería el despliegue
  en un subdirectorio.

## 0.6 — 20/07/2026 14:50

- T.S.: la opción sin rellenar va en blanco (sin el texto «Sin definir») y el
  `0` se muestra solo como `—`, sin la aclaración entre paréntesis.

## 0.5 — 20/07/2026 14:47

- La T.S. del editor pasa a ser una lista cerrada de 0 a 6. El `0` significa
  «sin salvación por armadura» y se muestra como `—`; el resto como `1+`, `2+`…
  Se distingue de «sin definir» (vacío), que es otra cosa.
- El formato vive en `formatArmorSave`, de modo que el editor y el constructor
  de listas escriben la T.S. igual.
- Los iconos de grupo de mando pasan a ser los PNG originales del usuario
  (carpeta `ico/`), recortados, centrados, reducidos y teñidos con el color de
  la interfaz. Sustituyen a los dibujos aproximados de la 0.4.
- Tooltips al pasar el cursor: «Portaestandarte», «Músico», «Campeón» (con sí
  o no en cada fila) y el nombre de la categoría sobre el escudo.

## 0.4 — 20/07/2026 14:39

- «Unidades en la lista» muestra a la izquierda el emblema de la facción de
  cada unidad y un escudo metálico según su categoría: oro las Singulares,
  bronce las Básicas y plata las Especiales. Los personajes no llevan escudo.
- La cabecera P/M/C se sustituye por los iconos de estandarte, cuerno y espada,
  con una columna propia cada uno y un check en las unidades que lo llevan.
- Toda la tabla queda alineada al centro óptico (`align-middle`) y con las
  columnas de ancho fijo, incluidas las tres de grupo de mando.
- El interruptor de blanco y negro también desatura los escudos de categoría.

## 0.3 — 20/07/2026 13:31

- Al abrir un ejército, la lista se reconcilia con el catálogo actual
  (`reconcileEntries`): hasta ahora las entradas ya guardadas no se volvían a
  validar nunca, así que una combinación que hoy sería ilegal seguía ahí en
  silencio.
- Si una opción se ha borrado del catálogo, se retira sola de la entrada y se
  informa; el resto de la selección se conserva.
- Si una incompatibilidad nueva afecta a una entrada, se desmarcan todas sus
  opciones y se pide volver a elegirlas. Solo se tocan las entradas afectadas.
- Aviso descartable con el detalle por entrada, y marca ⚠ en la lista que
  permanece hasta que la entrada se revisa.

## 0.2 — 20/07/2026 13:16

- Numeración de versiones como contador continuo (`0.9` → `0.10`), sin salto a
  `1.0` hasta que se pida.
- La versión muestra también la hora de la última actualización.

## 0.1 — 20/07/2026 13:13

Primera versión numerada. Recoge todo lo construido hasta la fecha.

### Fichas

- Sección «Fichas» con acordeón independiente por categoría (abrir/cerrar todo).
- Grupo «Opciones de unidad» para las opciones marcadas como «incluir en fichas».
- Atributos del campeón bajo la unidad y sobre las monturas; «0-1» dentro de la
  barra gris; nomenclatura «Montura/Dotación».
- Exportación a PNG y a Word con imágenes **dibujando la ficha directamente en
  canvas**, sin html2canvas, para que el resultado sea idéntico a lo que se ve
  en pantalla.

### Ejércitos

- Constructor con borrador en memoria: no se guarda nada hasta pulsar Guardar,
  con aviso al salir sin guardar.
- Reordenación por arrastrar y soltar (se retiraron los botones de subir/bajar).
- Las opciones con perfil propio (grupos de apoyo) añaden su ficha como una
  montura más.
- Los ejércitos son privados de cada usuario; las fichas siguen siendo públicas.

### Editor

- Pantalla «Equipo y opciones»: alta, edición y borrado de opciones de equipo y
  de unidad, con filtro por facción, búsqueda, «mostrar opciones sin usar» y
  listado de qué unidades usan cada opción.
- Incompatibilidades entre opciones, definibles a mano, con multiselección,
  puntos visibles para distinguir opciones homónimas y grupos excluyentes
  («excluyentes entre sí») para casos como las marcas.
- Importar/actualizar unidades desde un libro de ejército en PDF, Word o
  Markdown, eligiendo por casillas qué unidades y qué campos actualizar.
- Activar/desactivar unidades, duplicar unidades y borrarlas con confirmación.
- Edición de los puntos del grupo de mando (músico, portaestandarte, campeón).

### Usuarios

- Acceso con usuario y contraseña, alta de usuario y restablecimiento.
- Modo administrador (sin contraseña: es un modo de vista, no un permiso) que
  habilita las opciones de edición.
- «Mis facciones» para ocultar facciones de la vista.

### Correcciones

- El buscador global se dibuja en un portal, de modo que ya no lo recorta el
  contenedor con scroll horizontal.
- Los menús del editor ya no se cierran antes de registrar el clic.
- El interruptor de blanco y negro afecta solo a las imágenes, no a toda la
  interfaz.
- Las incompatibilidades se guardan en lotes de 45 sentencias: el Worker
  rechaza los lotes de más de 50, y un grupo grande (las marcas) los superaba y
  abortaba toda la corrección de datos.
- «Equipo y opciones» refresca incompatibilidades, nombres y uso al guardar o
  borrar; antes solo recargaba la lista y los cambios parecían no aplicarse.
