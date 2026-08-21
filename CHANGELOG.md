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

## 0.141 — 21/08/2026 11:48

- **Encontrado lo del "mapa mal encuadrado": no era el mapa, eran las peanas.**
  Lo que se cortaba contra el marco era una unidad pintada con un tamaño que no
  es el suyo.
  - La causa: la pantalla no esperaba a las **etiquetas de tipo de unidad**, que
    son las que dicen cuánto mide la peana de cada tipo. Mientras no llegaban,
    `tamanoDe` se caía al tamaño genérico —12 × 10 cm, más grande que la mayoría
    de las peanas reales—, y una unidad colocada pegada a un borde se pintaba
    asomando por fuera. Sus posiciones se guardaron para el tamaño de verdad;
    dibujarlas con otro es dibujar una mesa que no existe. Comprobado sobre
    200.000 colocaciones al azar: con el tamaño genérico se sale **el 23 %** de
    las peanas; el giro del bando de arriba, en cambio, no saca ninguna (0 de
    200.000), que era la otra sospecha y queda descartada.
  - Ahora la batalla no pinta hasta saber el tamaño de cada peana.
  - **Y en el Despliegue lo mismo, donde además era peor**: ahí ese tamaño no
    solo se pinta, se GUARDA — al soltar una unidad se la sujeta dentro de la
    mesa usando su tamaño, así que con el genérico la sujeción la dejaba en un
    sitio que no le corresponde y se escribía así. Un dibujo mal se arregla
    repintando; un dato mal guardado, no.
- **Última red en la batalla:** ninguna peana se pinta fuera de la mesa. No
  debería hacer falta nunca —el despliegue ya sujeta cada una dentro—, pero si
  algo llega descuadrado es mejor enseñarla entera en el borde que medio comida
  por el marco, que es exactamente lo que parecía un fallo de encuadre del mapa.
  El PDF aplica la misma red, para que no enseñe una mesa distinta de la que se
  está mirando.

---

## 0.140 — 21/08/2026 11:42

- **Guardar el despliegue avisa si hay unidades pasada la línea central**, dice
  cuáles, y deja continuar. Se mira la PEANA ENTERA y no su centro: una unidad
  cuyo centro está en su mitad pero cuyo frente ya ha cruzado está cruzando
  igual, y es justo el caso que se cuela sin darse cuenta.
  - **Avisa, no prohíbe.** Cruzar no es legal en una partida normal, pero hay
    escenarios y reglas que lo permiten, y este programa dibuja lo que el
    jugador quiere colocar: no arbitra. Un programa que decide por su cuenta
    que algo es imposible se equivoca justo en el caso raro, que es cuando más
    molesta.
- **Emblema propio de cada ejército.** Por defecto el de su facción —el caso
  normal, y por eso las dos columnas nuevas nacen a NULL, que significa
  exactamente eso—, y si se quiere, el de **otra facción** o **una imagen
  propia**. Se cambia en "Editar lista".
  - **No es un emblema de facción y esa es la diferencia importante.** El de
    una facción es del catálogo: lo comparte todo el que la juegue y cambiarlo
    se lo cambia a todos. Este pertenece a UNA lista y a nadie más. Existe para
    la excepción —la hueste de un señor concreto que se presenta a la batalla
    con su propia enseña—, no para renombrar facciones por la puerta de atrás.
  - Se ve en el **listado de Ejércitos**, en la cabecera del **constructor** (en
    pequeño: ahí es una seña de identidad, no el asunto de la pantalla) y en la
    **batalla**, tanto en la cartela como en cada orden de batalla.
  - Mismo recuadro que los emblemas de facción en todas partes; una imagen
    propia se comprime a 480 px, el tamaño con el que se guardan aquellos.
  - Columnas nuevas: `army_lists.emblem_faction_id` y `army_lists.emblem_key`.
    Se escriben siempre las dos a la vez aunque solo cambie una: son
    excluyentes, y guardarlas por separado dejaría estados en los que la
    anterior sigue puesta y sigue mandando.

---

## 0.139 — 21/08/2026 11:27

- **Corregido: la batalla se salía de la pantalla por la izquierda.** La
  pantalla se escapa de la columna de 56rem del programa con un margen
  negativo, y ese margen se calculaba como `(100vw - 56rem)/2` a secas. Eso
  deja el bloque más ancho que el hueco real por dos motivos que se suman:
  `main` tiene su propio `px-6` a cada lado, y `100vw` **incluye la barra de
  desplazamiento**. El sobrante no se puede alcanzar hacia la izquierda —una
  página no scrollea a la izquierda—, así que la mesa aparecía cortada por ese
  lado. Ahora se restan los dos: el padding y un dedo para la barra.
  - La proporción de la mesa nunca estuvo mal: es la misma que en el
    Despliegue. Lo que fallaba era la caja que la contenía.
- **Y se le pone techo al ancho.** Escaparse de la columna no quiere decir
  ocupar todo lo que haya: en una pantalla muy ancha la mesa se estiraba hasta
  un tamaño en el que hay que mover la cabeza para recorrerla, que es lo
  contrario de lo que sirve una vista de conjunto.
- **Todo un punto más pequeño**, para que la batalla entre de una vez en la
  pantalla: la mesa (por el techo y por unas columnas laterales algo más
  estrechas), el texto de los dos órdenes de batalla, sus marcas, y el título y
  los emblemas de la cartela.

---

## 0.138 — 21/08/2026 11:21

- **Los dos órdenes de batalla, a los LADOS de la mesa.** Debajo y en dos
  columnas sobraba media pantalla a izquierda y derecha mientras las listas se
  estiraban a lo ancho sin necesitarlo —una lista es una columna estrecha por
  naturaleza— y la mesa quedaba a una pantalla de scroll de ellas, que es justo
  lo que hay que mirar a la vez. A los lados, las tres cosas caben de una vez y
  cada una ocupa la forma que le corresponde. El del sur a la izquierda y el
  del norte a la derecha, el mismo reparto que la cartela: si el ojo aprende
  que la izquierda es de uno, no puede cambiar dos bloques más abajo.
  - Solo en pantallas anchas. Por debajo se apilan, y **la mesa va primera**:
    es lo que se ha venido a ver.
  - Y la ficha emergente se abre hacia la mesa —a la derecha en el panel
    izquierdo, a la izquierda en el derecho—: es más ancha que su panel, así
    que hacia fuera se saldría de la pantalla.
- **La marca de cada unidad ES SU PEANA, en pequeño.** Antes se pintaba con el
  color de la LISTA mientras la mesa usa el de la facción de cada UNIDAD, así
  que en cuanto un ejército llevaba aliados las marcas decían un color y las
  peanas otro. Una referencia que no coincide con lo que señala no es una
  referencia. Ahora comparten color y también pintura: el mismo `estiloDePeana`
  con su desgaste, porque un plano liso tampoco se reconoce al lado de la mesa.
- **Y deja de salirse el texto.** Las referencias no son una letra: son el
  alias de la unidad y, si se repite, su número —"GS1", "CDR2"—, y en un
  cuadrado fijo de 28 px eso se salía por los lados. Alto fijo para que la
  columna no baile, ancho mínimo para que las cortas no queden ridículas, y que
  crezca lo que haga falta dentro de una celda de ancho fijo, para que los
  nombres sigan alineados.
- **La cabecera de cada orden de batalla, en tres líneas.** Con el panel al
  costado la columna es estrecha y facción + recuentos en el mismo renglón
  acababa en "Bretonia · 18 unidades · 14 en la…": el dato que se cortaba era
  justo el que se venía a mirar.

---

## 0.137 — 21/08/2026 11:15

- **Filtro de estado en Ejércitos: Todos · Completados · Sin completar.** Por
  defecto, todos. Es deliberadamente discreto —tres palabras y un filete, sin
  caja ni fondo—: que un ejército esté completado es un dato de una sola letra
  y no merece un control con presencia. Lo que sí merece es llevar el
  **recuento** al lado de cada opción, para que informe aunque no se toque
  (cuántos llevas cerrados y cuántos te quedan) en vez de ser tres botones
  mudos. Con una sola lista no aparece: elegir entre ella y ella misma es ruido.
- **Los ejércitos se ordenan por FECHA DE CREACIÓN**, del más nuevo al más
  viejo. Iban por fecha de modificación, y eso hacía que el listado se
  reordenara solo: tocabas un ejército y saltaba al principio, así que el sitio
  donde estaba cada uno no significaba nada y había que volver a buscarlo cada
  vez. La fecha de creación no cambia nunca, y un listado estable se aprende de
  memoria. Los tuyos siguen yendo antes que los compartidos contigo.

---

## 0.136 — 21/08/2026 10:49

- **Los dos ejércitos de una batalla tienen que desplegar en lados DISTINTOS.**
  Si los dos han elegido el mismo borde no se están enfrentando: están
  amontonados en el mismo sitio. Se dice y no se deja crear, igual que con las
  mesas distintas. El lado de cada ejército sale ahora en su línea del
  desplegable, que es donde hace falta para elegir bien.
  - Y en la batalla, **quién se gira lo dice el lado, no el orden**: la mesa se
    pinta desde el sur, así que el del sur va tal cual y el del norte se da
    media vuelta. Girar siempre "el segundo" ponía arriba a quien había elegido
    el sur en cuanto alguien creara la batalla al revés. Los rótulos del
    formulario dejan de decir "de abajo" y "de arriba" —eso ya no lo decide el
    orden— y pasan a ser "primer" y "segundo ejército".
- **Una imagen cargada en el Despliegue ahora ES UN MAPA del grupo.** Se le pide
  un nombre al subirla y queda en el listado de Mapas, a la vista de todos.
  - No es un capricho de organización: **era una imposibilidad**. La foto se
    guardaba pegada a la lista de ejército —sin nombre, invisible para los
    demás, fuera del alcance del rival—, y como una batalla exige que los dos
    desplieguen sobre el mismo sitio, jugar sobre una imagen no podía funcionar
    nunca: el otro no tenía forma de elegirla. Convertida en mapa hereda lo que
    un mapa ya es: nombre, listado común y que cualquiera la cargue.
  - La mesa del mapa se calcula con la proporción de la imagen, para que se
    estire sin deformarse; el ancho no se toca.
  - Columna nueva: `battle_maps.image_key`. La imagen manda sobre el suelo y la
    textura y se estira al tablero entero (un suelo se enlosa y se aclara,
    porque es la textura de la mesa; aquí la imagen ES el mapa). Se pinta igual
    en el editor, en el listado, en el Despliegue, en la batalla y en los PDF.
  - **En el editor de mapas se avisa** de que con imagen el suelo elegido queda
    debajo y no se ve: pulsar un control y que no pase nada visible es el peor
    de los silencios.
  - Las listas que ya tenían una imagen suelta la conservan y se sigue pintando,
    pero el desplegable la rotula como lo que es —solo la ves tú— y ofrece
    convertirla en mapa.

---

## 0.135 — 21/08/2026 10:38

- **Corregido: el alta de una batalla avisaba de que a los ejércitos "les falta
  el despliegue" aunque lo tuvieran.** Y avisaba de los dos, siempre. El
  recuento de peanas contaba por `army_list_deployments.army_list_id`, una
  columna **que no existe**: una peana se guarda por ENTRADA (`entry_id`) y a
  la lista se llega por `army_list_entries`, como ya hacía `getDeployment` diez
  líneas más arriba en el mismo archivo. La consulta reventaba entera y el
  recuento se quedaba vacío.
- **Y el aviso no se conformaba con no saber.** "Sin dato todavía" y "cero
  peanas" se estaban tratando como lo mismo, así que un recuento que no llegaba
  —por el fallo de arriba, o por la red— se leía como un hecho comprobado.
  Ahora, mientras no hay recuento no se avisa: un aviso falso sobre algo
  comprobable es peor que no avisar, porque quien lo lee no tiene forma de
  saber que es falso.

---

## 0.134 — 21/08/2026 10:35

- **La ficha emergente de la batalla deja de verse translúcida**, que era un
  descuido y no un efecto: se dibujaba sin fondo ni marco propios, así que a
  través del texto se veían el pergamino y la fila de debajo. Ahora lleva su
  caja —pergamino opaco, filete y sombra—, la misma que ya le ponía el Tooltip
  del Despliegue.
- **Y deja de salir apretada.** Tenía el ancho de lo que ocupara su contenido;
  ahora es fijo y holgado, con el nombre de la unidad a mayor cuerpo: es lo
  primero que se busca al abrirla y salía en el mismo tamaño que el resto.
- **En las últimas filas la ficha se abre hacia arriba.** Abriéndose siempre
  hacia abajo, las unidades del final de la lista —justo las que se miran
  cuando ya la has recorrido entera— sacaban su ficha fuera de la pantalla.
- **La marca de cada unidad, un punto más grande** (24 → 28 px). Es lo que
  empareja la fila con su peana en la mesa, y a ese tamaño quedaba menuda al
  lado del nombre.
- **Fuera el pie "Pasa el ratón por una unidad…".** Una interfaz que necesita
  explicarse con una nota al pie no está explicada; y esta se descubre sola al
  primer movimiento del ratón.

---

## 0.133 — 21/08/2026 10:28

- **La batalla deja de ser una lista con un mapa encima y pasa a ser un
  cartel.** Es la única pantalla del programa donde no se trabaja: se mira. Y
  una pantalla que solo se mira puede permitirse lo que en una de trabajo
  estorbaría.
  - **Cartela de enfrentamiento.** Las dos facciones cara a cara con su
    emblema, su lista, sus unidades y cuántas hay sobre la mesa; en medio, las
    espadas cruzadas y dónde se juega (medidas y mapa). El ancho va contenido a
    propósito: con la pantalla muy ancha los dos bandos se iban a los extremos
    y el enfrentamiento dejaba de leerse como tal.
  - **Balanza de puntos.** Una barra partida por el coste de cada ejército, con
    el fiel clavado en la mitad exacta. "1500 contra 1480" en dos cifras
    sueltas hay que restarlo mentalmente; aquí la ventaja se ve sola, porque lo
    que se compara no son los números sino cuánto se desplaza el color respecto
    al fiel.
  - **Estandartes de borde.** Quién despliega arriba y quién abajo, con su
    color a todo lo alto por el canto, y el aviso de "Sin despliegue" ahí mismo
    si un bando llegó sin desplegar: es la explicación de por qué media mesa
    está vacía y hay que darla donde se mira.
  - **Un solo marco** para estandarte + mesa + estandarte. Antes cada pieza
    llevaba el suyo y el filete exterior de la mesa pasaba por detrás de los
    rótulos, que es lo que los hacía parecer pegados encima.
  - **Cada mitad de la mesa teñida de su dueño**, al 9%: dice de quién es cada
    lado sin competir con el terreno ni con las peanas. Y un rombo en el centro
    exacto, sobre la línea media.
- **El puente lista↔mesa.** Pasar el ratón por una unidad la enciende en el
  tablero, y al revés. Es la única interacción de la pantalla y hace el trabajo
  que en el papel hace señalar con el dedo: con cuarenta peanas y dos listas de
  veinte, leer "C3" y buscarlo a ojo era exactamente lo que sobraba.
- **Los órdenes de batalla, agrupados por categoría** con su escudo y su
  subtotal. La lista guarda su propio orden y el constructor lo respeta, pero
  al mirar un ejército enemigo lo que se pregunta no es "¿qué puso primero?"
  sino "¿cuántos personajes trae?, ¿cuánto ha metido en Singulares?". Las
  unidades sin desplegar llevan la marca hueca y el nombre en cursiva: cuentan
  puntos, pero no están sobre el tablero.
- **Entrada escalonada** (`wh-surgir`, `wh-peana`, `wh-balanza`): el acta se
  levanta y las peanas van cayendo sobre la mesa. Con `prefers-reduced-motion`
  no se mueve nada — el contenido es el mismo.

---

## 0.132 — 21/08/2026 09:42

- **Las batallas son de todos.** El listado ya no filtra por usuario: la ve, la
  abre, la edita y la borra cualquiera del grupo, la montara quien la montara.
  Es la excepción deliberada a que los ejércitos sean privados, y se sostiene
  en que una batalla no se puede tocar por dentro: un acta de solo lectura que
  les interesa a los dos bandos no gana nada bajo llave, y esconderla habría
  obligado a inventar un "compartir batalla" para deshacer el escondite. El
  `user_id` se sigue guardando —dice quién la montó— pero ya no decide quién la
  ve.
- **Editar la batalla de otro ya no enseña dos desplegables en blanco.** El
  formulario ofrece tus ejércitos completados **más los dos que la batalla ya
  tenga puestos**, aunque no sean tuyos (`resumenesPorIds`). Sin eso, "de todos"
  habría sido verdad solo para mirar: al abrir la de otro no se podía ni
  cambiarle el nombre. Esa consulta no descubre nada ajeno por su cuenta —hay
  que traer los ids, y salen de una batalla, que ya es pública.
- **El aviso de borrado lo dice.** "Desaparece también para los demás
  jugadores, la creara quien la creara": quien borra puede no ser quien creó.

---

## 0.131 — 20/08/2026 23:51

- **Las migraciones que fallan ya no se callan.** El bucle que las aplica en el
  Worker tenía el `catch` vacío, con el comentario "ya aplicada, es
  idempotente". Y casi siempre era verdad —"duplicate column name" es el caso
  normal— pero por esa misma rendija se colaba el caso que no lo era: la tabla
  `battles` no llegó a crearse, el Worker contestó `ok: true`, y la pantalla de
  Batallas dijo "no such table" sin que nada apuntara a la causa. Un `catch`
  que se traga los errores de verdad junto con los inocuos no es tolerancia,
  es ceguera.
  - Ahora se filtran por su mensaje los dos casos benignos (`duplicate column
    name`, `already exists`) y **cualquier otro se devuelve** en `failed`, con
    su SQL y su motivo. El cliente los escribe en la consola con `console.error`
    en el momento en que ocurren, no cuando explota la función que dependía de
    ellos.
- **`db/migraciones-manuales.sql`**, salida de emergencia para aplicar a mano lo
  que el Worker no haya podido, con `wrangler d1 execute --remote --file`. Es
  un atajo, no una fuente de verdad: lo que vaya ahí tiene que estar también en
  `MIGRATIONS` y en `db/schema.sql`.

---

## 0.130 — 20/08/2026 23:44

- **Batallas.** Una sección nueva, al lado de Ejércitos, para crear, editar y
  borrar batallas. Una batalla es un nombre y **dos ejércitos completados**
  —propios o compartidos contigo—, y lo que produce es la mesa con los dos
  despliegues enfrentados, las dos listas para consultarlas, y los PDF.
- **Nada se edita dentro de una batalla.** No es una pantalla de solo lectura
  por pereza: es que una batalla es la foto del momento en que dos ejércitos se
  plantan uno frente al otro. Si se pudiera mover una peana desde aquí, dejaría
  de ser eso. Por lo mismo, **un ejército metido en una batalla no se puede
  reabrir**: el sello "Completado" queda deshabilitado y `setReady` lo rechaza
  también desde el repositorio, con el motivo dicho (borra la batalla o
  cámbiale el ejército). Cerrar la puerta solo en la pantalla habría dejado la
  de atrás abierta.
- **Mesas distintas, error y no te deja.** Si los dos ejércitos no despliegan
  sobre el mismo escenario —mapa distinto, o medidas distintas— el formulario
  lo dice y no deja guardar. Enfrentar dos despliegues sobre mesas que no
  coinciden no da una batalla mal dibujada: da una batalla falsa.
- **Un bando sin desplegar sí se admite, pero avisando.** Es normal ir a la
  partida con el despliegue oculto, así que en lugar de prohibirlo se avisa de
  cuál falta y se pregunta si continuar.
- **Cómo se enfrentan.** El ejército de abajo se pinta tal cual, y el de arriba
  se gira 180° sobre la mesa (`enfrentarPosicion`: `x → ancho − x`,
  `y → alto − y`), que es exactamente lo que pasa cuando el rival se sienta al
  otro lado. Los dos bandos comparten el mismo cuerpo de alias, para que la
  peana «A» de un ejército y la «A» del otro no se confundan en la leyenda.
- **Tres exportaciones.** El PDF de cada lista por separado, y el de la mesa
  —apaisado, con las dos leyendas y una página de orden de batalla por bando.

---

## 0.129 — 20/08/2026 23:15

- **El sello dice "Completado", y lo dice en los dos estados.** Un interruptor
  no se cambia de nombre según esté encendido o apagado: lo que el rótulo dice
  es de QUÉ trata, y si está puesto o no lo dicen el sello frente al contorno de
  trazos, el candado frente al visto, y el `aria-checked` para quien no ve
  ninguno de los dos. Antes ponía "Listo" encendido y "Marcar" apagado, que son
  dos palabras para una sola cosa.
- **Una lista completada tampoco deja editar su despliegue.** Colocar el
  ejército sobre la mesa es parte de llevar esa lista a la partida, así que
  cerrar la lista y dejar la mesa abierta era cerrar media puerta. La pantalla de
  Despliegue se abre en solo lectura, con su distintivo y **su propio "Reabrir"**
  en la cabecera, igual que el constructor.
  - Ojo con lo que NO cambió, que es la misma trampa de la vez anterior: la
    puerta de entrada al despliegue sigue mirando solo si la lista es tuya o te
    han compartido su despliegue. Mezclarla con "completada" habría abierto los
    despliegues ajenos cerrados a cualquiera.

---

## 0.128 — 20/08/2026 23:08

- **"No such column" deja de ser un error y pasa a ser una instrucción.** Cuando
  a la D1 le falta una columna, la pantalla ya no suelta el error crudo
  —`D1_ERROR: no such column: ready: SQLITE_ERROR`, que es exacto y no sirve de
  nada— sino qué hacer: desplegar el Worker, con el comando, y recargar. El
  detalle técnico va detrás, entre paréntesis, para quien vaya a mirarlo.
  - La detección vive en un solo sitio (`schemaHealth#mensajeDeMigracionPendiente`)
    y la usan el sello de "listo", el ocultar un personaje y el guardado del
    despliegue. Este programa despliega el frontend y el Worker por separado a
    propósito, así que esto se va a repetir con cada función que traiga columnas
    nuevas: mejor una función que treinta mensajes escritos a mano.
  - El aviso del listado de ejércitos pasa de línea suelta a recuadro: era una
    frase en rojo perdida sobre el pergamino y se leía como decoración.

---

## 0.127 — 20/08/2026 19:04

- **La marca de "listo" pasa a ser un sello, al final de la fila.** Era una
  casilla pegada delante del nombre, y ahí hacía tres cosas mal: desalineaba la
  columna de nombres, se leía como la casilla de "seleccionar filas" (que
  significa otra cosa) y competía con el propio nombre.
  - Va al FINAL de la fila y no pegada al nombre aunque quede más cerca de él:
    los nombres miden lo que miden, así que ahí el sello bailaría de una fila a
    otra. Al final forman columna y el estado del montón se lee de una pasada.
  - **Ancho fijo para los dos estados**, porque "Listo" y "Marcar" no miden lo
    mismo y sin fijarlo los sellos quedaban escalonados — justo lo que se venía
    a arreglar.
  - Cerrado es un sello de tinta: filete granate, fondo apenas teñido, candado y
    versalita espaciada (el mismo gesto tipográfico que los rótulos del
    Despliegue). Abierto es un contorno de trazos, muy callado, que se enciende
    en bronce al pasar por encima: está ahí cuando se le busca y no llama la
    atención cuando no.
  - La fila cerrada se tiñe un 4 %: se distingue de un vistazo sin parecer
    desactivada.
  - Es un `role="switch"` de verdad, con su `aria-checked`, así que funciona con
    teclado y lo anuncia bien un lector de pantalla.
  - Fuera el candado que salía junto al nombre en las listas cerradas: lo decía
    dos veces.

---

## 0.126 — 20/08/2026 18:39

> **Hace falta desplegar el Worker** (`cd webapp/worker && npx wrangler deploy`).
> Estas tres funciones traen columnas nuevas y, hasta que se despliegue, no se
> guardan. El resto del despliegue —colocar el ejército— sigue guardándose con
> normalidad: lo nuevo se escribe aparte y no puede tumbar lo de siempre. Si
> falla, la pantalla lo dice con esas mismas palabras.

- **Imagen propia como fondo del despliegue.** Tercera opción junto a "Mesa
  libre" y los mapas del grupo, en un solo desplegable porque son excluyentes:
  con dos controles quedaría la duda de qué manda cuando hay mapa Y imagen. Al
  subirla **se ajusta el fondo de la mesa a la proporción de la imagen**
  (respetando el ancho), que es lo que permite estirarla al tablero entero sin
  deformarla y sin que las distancias mientan. La imagen es de esa lista, no del
  grupo, y va a R2 como el resto.
  - No pasa por el preparado de la escenografía, que quita el fondo liso y
    recorta al contenido: eso es lo correcto para una pieza recortada y justo lo
    contrario de lo que necesita la foto de un escenario, donde el fondo ES el
    contenido.
- **Lado de despliegue: Sur o Norte.** Lo que NO hace es mover las peanas: se
  colocan siempre abajo, porque es lo cómodo para quien está sentado delante de
  la mesa y cambiarlo obligaría a desplegar del revés cada dos partidas. Lo que
  cambia es la **perspectiva del terreno**, que gira 180° — que es exactamente
  lo que uno ve cuando le toca el otro borde.
  - Para poder girarlo hubo que sacar el suelo del fondo del tablero y darle una
    capa propia: desde el fondo no se puede girar sin llevarse por delante las
    peanas, que son sus hijas. Dentro de esa capa va todo lo que cambia de
    perspectiva (suelo, imagen y escenografía) y nada más.
  - El PDF del despliegue gira igual. En el lienzo, el giro envuelve suelo,
    retícula, línea central y escenografía, y se deshace antes de las peanas.
- **Marca de "listo" en el listado de ejércitos.** Una casilla por lista,
  siempre visible: es el estado de la lista, no una acción de mantenimiento, y
  hay que poder leer de un vistazo cuáles están cerradas. Marcada, el
  constructor se abre en solo lectura, con el mismo candado que una lista
  compartida — pero este trae **su propio botón de "Reabrir"** en la cabecera,
  porque un pestillo del que hay que salir yendo a otra pantalla deja de ser un
  pestillo y pasa a ser un castigo. Se abre y se cierra las veces que haga falta.
  - Cerrar una lista no toca su fecha de modificación: si la tocara, el orden del
    listado bailaría cada vez que alguien abre y cierra el candado.
  - Ojo con lo que NO cambió: la puerta de entrada al constructor sigue mirando
    solo si la lista es tuya o te la han compartido. Mezclarla con "cerrada"
    habría abierto las listas ajenas cerradas a cualquiera.

---

## 0.125 — 20/08/2026 18:05

- **Se puede borrar un Personaje de Renombre**, con un aviso que dice
  exactamente lo que se lleva por delante: la unidad entera (perfil, equipo,
  reglas, opciones y monturas), el retrato, el trasfondo, toda la experiencia
  apuntada, y su presencia en cualquier lista de ejército que lo llevara. El
  aviso deja claro que **es irreversible**: no hay papelera ni forma de
  recuperarlo, y los apuntes de experiencia no se pueden volver a montar.
  - Lo borra `UnitRepository.remove`, el mismo que ya usaba Editor > Unidades.
    Un personaje de renombre ES una unidad, y dos formas de borrar lo mismo
    acaban divergiendo. El diálogo es el `ConfirmDialog` de siempre, que además
    ya está protegido contra el doble clic.
- **Filtro por facción** sobre el listado, con el número de personajes al lado.
  En el desplegable solo salen las facciones que tienen alguno: con las 22 del
  catálogo, elegir una y encontrarse la pantalla vacía sería lo más probable, y
  el desplegable estaría diciendo que allí hay algo. El filtro se aplica antes de
  agrupar, así que grupos, contadores y mensaje de vacío salen del mismo sitio y
  no pueden contradecirse.
  - Filtrando sin resultados el mensaje lo dice y ofrece quitar el filtro, en vez
    del "todavía no hay ninguno" que sería mentira.
- Fuera el texto "Se le quita el fondo liso, se recorta a lo que hay y se le
  difumina el canto…" del diálogo del retrato. Mientras se encuadra sigue
  saliendo la ayuda del arrastre y el zoom; el resto del tiempo, nada.

---

## 0.124 — 16/08/2026 16:10

- **El retrato de un personaje se encuadra al ponerlo.** Se arrastra la foto
  para moverla y se amplía con la rueda o con una barra (hasta 4×), dentro de un
  cuadro que enseña exactamente lo que va a quedar. Antes el hueco del retrato
  es cuadrado y la foto casi nunca lo es, así que el resultado quedaba a merced
  del archivo: un retrato vertical salía con dos franjas vacías a los lados y la
  cara diminuta en el centro, y la única forma de arreglarlo era recortar la
  foto fuera del programa y volver a subirla.
- **"Reencuadrar esta foto"** hace lo mismo con el retrato que ya tiene puesto,
  sin volver a buscar el archivo. Parte de la imagen ya recortada, así que vale
  para retocar; para un cambio grande sale mejor elegir otra vez la original.
- **Lo que se ve en el cuadro es lo que se guarda.** La vista previa coloca la
  imagen con las mismas cuentas que luego usa el lienzo, en fracciones del lado
  y no en píxeles, así que el cuadro puede medir 224 px en pantalla y 512 px al
  guardar sin una segunda conversión que pueda desviarse. Comprobado poniendo
  las dos una al lado de la otra con tres encuadres distintos.
- El encuadre **se aplica al guardar y no se guarda como dato**: lo que sube a
  R2 ya es el cuadrado definitivo, así que no hay columnas nuevas ni una
  transformación que reaplicar cada vez que se pinta la lámina.
- Detalles: el sobrante queda transparente y no de color pergamino (rellenarlo
  devolvería el recorte pegado sobre el papel que el difuminado del canto
  evita); guías en tercios mientras se arrastra; y las URL de objeto de las
  fotos de prueba se sueltan al cambiar de foto, que antes se quedaban
  retenidas hasta recargar.

---

## 0.123 — 16/08/2026 11:26

- **Arreglado: "FOREIGN KEY constraint failed" y la sección de Personajes de
  Renombre vacía.** Eran el mismo fallo, y lo introduje yo en 0.119.

  `units.user_id` (el autor de un personaje de renombre) se declaró con
  `REFERENCES users(id)`. Pero `units` es una tabla de CATÁLOGO: viaja entera en
  el snapshot y el navegador la reconstruye en memoria ejecutando
  `db/schema.sql`, que activa `PRAGMA foreign_keys = ON`. Y `users` **no** viaja
  en el snapshot —ni debe, que ahí van los hash de contraseña—, así que la copia
  local tiene esa tabla vacía. Resultado: en cuanto un personaje tuvo autor, su
  fila dejó de poder insertarse y **la carga del catálogo entero reventaba**.

  Por eso los dos síntomas: Ejércitos enseñaba el error a la cara, y la sección
  de personajes lo tragaba y salía como si no hubiera ninguno. Y por eso empezó
  justo al ocultar el primer personaje, que es cuando se apuntó el primer autor
  — y siguió después de volver a mostrarlo, porque el autor se queda.

  La columna pasa a ser un `INTEGER` a secas, aquí y en la migración del Worker.
  La integridad la guarda la D1, que sí tiene las dos tablas.

  **Regla general, anotada en el esquema:** una tabla de catálogo no puede tener
  una clave ajena exigida contra una tabla que no sea también de catálogo.
  Comprobadas las 27 tablas de catálogo: no queda ninguna otra.
- **Y si vuelve a pasar, el error dirá dónde.** Al insertar el snapshot, un fallo
  ahora nombra la tabla y el id de la fila. "FOREIGN KEY constraint failed" a
  secas no decía ni la tabla, y aparecía en una pantalla que no tenía nada que
  ver con la que fallaba.

---

## 0.122 — 16/08/2026 11:16

- **Un personaje oculto lo dice con todas las letras, no solo con un
  distintivo.** "Oculto: solo lo ves tú. Nadie más lo encuentra, ni puede
  meterlo en su ejército", con el atajo para deshacerlo. Antes eran dos palabras
  en una esquina, y en cuanto cierras la pestaña se olvida: lo siguiente es
  preguntarse por qué los demás no ven a un personaje que, según la propia
  sección, es de todos. El aviso solo lo lee su autor — a los demás no les llega
  la lámina.

---

## 0.121 — 16/08/2026 11:11

- **Los Personajes de Renombre ya no dejan nada en el Log.** Ni al crearlos, ni
  al editar su ficha, ni al apuntarles experiencia, ni al ocultarlos, ni al
  activarlos o borrarlos. El motivo es que se pueden ocultar: un personaje
  oculto solo lo ve su autor, y de poco sirve esconderlo del listado si el Log
  le está contando a todo el mundo que existe, cómo se llama y cuánta
  experiencia lleva — el registro es una pantalla común y no filtra por autor.
- **La decisión se toma en `ChangeLogRepository.record`, no en cada sitio que lo
  llama.** Son treinta y una llamadas repartidas por los repositorios; confiar
  en que cada una se acuerde es garantizar que la próxima se olvide. Se mira la
  marca contra la copia local del catálogo, así que no cuesta red.
  - Dos excepciones que no se pueden resolver ahí y van a mano: **borrar** una
    unidad registra DESPUÉS de borrarla, cuando la fila ya no está para
    consultarla, así que `UnitRepository.remove` mira la marca antes; y
    `degradarAPersonaje` deja de registrar aunque al terminar ya sea una unidad
    normal, porque la entrada diría el nombre de un personaje que hasta hace un
    instante podía estar oculto.
- **Lo ya registrado se queda.** Son cosas que pasaron, y reescribir el
  historial para maquillarlo sería peor que la fuga que se está tapando.
- De paso, arreglado que **editar un apéndice guardaba en el Log el id del
  apéndice** en una entrada de tipo "unidad", donde las de al lado guardan el de
  la unidad. Pasaba desapercibido —la pantalla del Log solo enseña el texto—
  hasta que ese id ha empezado a decidir si la entrada se registra o no.

---

## 0.120 — 16/08/2026 11:02

- **Las secciones del constructor de listas caben en una sola línea.**
  Personajes, Personajes de Renombre, Básicas, Especiales y Singulares se ven
  ahora de una vez: la fila ya no se envuelve, y si a una facción le sobran
  secciones (Bestia, Asedio) se desplaza en horizontal en vez de partirse en dos
  alturas. La pestaña de los de renombre se rotula "★ Renombre" — el nombre
  entero ocupaba él solo un tercio de la fila (el explorador vive en una columna
  de unos 460 px) y era lo que echaba a "Singulares" a la segunda línea; el
  rótulo completo sigue saliendo al pasar el ratón.
- **Ocultar un personaje: dos sentencias en vez de una.** Ocultarlo es lo que se
  ha pedido y va primero, solo; apuntar el autor —un apaño para los personajes
  creados antes de que existiera esa columna— va después y ya no puede llevarse
  por delante lo anterior si falla.
- **Y si aun así falla, se lee el motivo.** El botón reintenta una vez tras
  aplicar las migraciones (igual que el interruptor de activa/inactiva de
  Editor > Unidades) y, si vuelve a fallar, enseña el mensaje real en la propia
  lámina en lugar de un "no se pudo" que no distingue una columna que falta de
  una contraseña caducada.

---

## 0.119 — 16/08/2026 10:38

- **"Personajes especiales" pasa a llamarse "Personajes de Renombre"** en toda
  la interfaz: la barra de navegación, la sección del constructor de listas, los
  avisos y los diálogos.
- **La sección sale de "Editor" y se va a la barra principal**, junto a Hojas de
  Unidad, Ejércitos y Mapas. Ya no hace falta el modo administrador: cualquiera
  ve, crea y edita personajes de renombre, y los mete en su ejército. Lo que
  sigue en "Editor" es su ficha de unidad (atributos, equipo y coste), como la de
  cualquier otra unidad. La ruta antigua redirige a la nueva.
- **Se pueden ocultar, y esa es la única excepción a que sean de todos.** Un
  personaje oculto solo lo ve su autor: desaparece del listado, del constructor
  de listas y del buscador de los demás. Sirve para tener uno a medio escribir
  sin que le estorbe a nadie, igual que en los mapas. Quien oculta uno de los
  creados antes de esta función pasa a ser su autor — si no, se quedaría
  invisible hasta para él.
- **Rediseñada la sección: láminas anchas en vez de tarjetas apretadas.** El
  retrato ocupa ahora 160 px (el doble que antes) con marco doble —filete de
  tinta fuera, hilo de bronce dentro— y sombra interior, para que la foto quede
  asentada en el papel y no como un recorte pegado encima. El **trasfondo se lee
  en la propia lámina**, plegado a unas líneas con un "Seguir leyendo" cuando es
  largo: antes vivía escondido dentro del diálogo de edición, así que un
  personaje se distinguía de otro por la foto y poco más. Cada facción se separa
  con su emblema y una regla, sin la caja dentro de la caja de antes.
- **Fuera el "N con nombre propio"** que iba bajo el nombre de cada facción.
- **Los personajes de renombre ya no salen en Editor > Unidades.** Se mezclaban
  con los genéricos dentro de la categoría "Personajes" —que es justo de donde
  salen— y no había forma de distinguir el Señor Vampiro del catálogo del Vlad
  que alguien creó copiándolo. Tienen su propia sección.
- **En las opciones de la lista de ejército, la casilla pasa a ser "Ver
  Personajes de Renombre", y nace MARCADA.** Antes era opt-in y estaba apagada,
  así que la sección no aparecía en ninguna lista hasta que uno la buscaba en un
  menú. Es una columna nueva (`show_special_characters`, con DEFAULT 1) y no un
  UPDATE sobre la anterior a propósito: las migraciones se ejecutan enteras en
  cada arranque, y un UPDATE le volvería a encender los personajes cada mañana a
  quien los hubiera apagado a mano.
- **Experiencia: "Cuánta" pasa a ser "Experiencia" y "Por qué" pasa a ser
  "Evento".** Fuera también el párrafo que explicaba que un apunte no se puede
  editar ni borrar.
- Esquema: `units.hidden`, `units.user_id` y `army_lists.show_special_characters`,
  aplicadas también en la D1 de verdad.

---

## 0.118 — 16/08/2026 10:06

- **Arreglado: no se podía crear un personaje especial.** Faltaban las columnas
  en la base de datos de verdad; ya están aplicadas (`is_special_character`,
  `background` y `portrait_key` en unidades, `include_special_characters` en las
  listas, y la tabla `unit_experience_log`). Comprobado contra la D1 creando un
  personaje de prueba, apuntándole experiencia y borrándolo después.
- **La experiencia pasa a ir por red, fuera del catálogo.** Cuelga de una
  unidad, pero no es catálogo: el catálogo es lo que casi no cambia y se
  consulta mil veces al pintar, y esto se escribe después de cada partida. Es
  dato de partida, como las listas de ejército, y ahora se trata igual. El
  motivo inmediato es que el Worker desplegado no conoce la tabla, así que
  llegaba vacía en el snapshot y la experiencia parecía borrarse al recargar la
  página.
- **Con esto, la sección entera funciona sin esperar al despliegue del Worker.**
  Las columnas nuevas viajan solas en el snapshot por ser de tablas que ya
  estaban (`SELECT *`), y lo demás va por red.

---

## 0.117 — 15/08/2026 23:40

- **Sección nueva: Personajes especiales.** Los que tienen nombre propio (Vlad
  von Carstein) en vez de ser "un Señor Vampiro" del montón. Se crean copiando
  un personaje de su facción, así que nacen con su perfil, sus reglas, su
  equipo, sus opciones, sus monturas con el coste de cada una, su grupo de
  mando y, si es hechicero, sus sendas. **La copia es independiente**: retocarle
  los atributos no toca al genérico del que salió, que es lo que hace falta
  porque un personaje con nombre casi nunca tiene el perfil del común.
- **No son una entidad nueva, son una unidad con una marca.** El esquema avisa
  expresamente de no partir `units` en dos tablas, y con razón: habría que
  duplicar perfiles, equipo, monturas, magia y mando para no ganar nada. Y la
  marca en vez de una categoría propia porque **cuentan como Personajes** para
  los límites del ejército, que se calculan por categoría: así las reglas de
  composición no se enteran de que existen. Que en el constructor tengan
  pestaña aparte es cosa de la pantalla.
- **Retrato y trasfondo.** La foto se prepara con el mismo molino que las
  piezas de escenografía (fondo fuera, recorte y canto difuminado): una foto
  recortada sobre blanco canta en una tarjeta de pergamino igual que sobre la
  mesa. El trasfondo va con formato y saneado, como los apéndices.
- **Experiencia con libro de apuntes, no con contador.** Cada partida se suma
  con su motivo y el total es la suma de los apuntes; se ve el historial
  entero. Un apunte no se edita ni se borra —es lo que pasó en una partida—;
  corregir es apuntar una cantidad negativa diciendo por qué. De momento el
  número solo se guarda y se enseña; más adelante se gastará en habilidades, y
  para eso harán falta los apuntes y no el saldo.
- **Casilla «Incluir personajes especiales»** en las opciones de la lista.
  Apagada, ni aparecen en el constructor. Si se apaga con alguno ya metido, se
  avisa de cuáles son: no se quitan de la lista (tirar entradas que alguien
  montó sin preguntar sería peor), pero dejan de ofrecerse.
- **Arreglado un fallo silencioso de copiar unidades, anterior a todo esto.**
  `duplicar` no copiaba `is_wizard` ni las sendas de magia: la copia salía sin
  magia y con toda la pinta de estar bien. Se vio al montar esto, porque los
  personajes especiales nacen precisamente de una copia — un Vidente Gris
  copiado habría nacido mudo.
- **Y una imagen que ya viene recortada se deja en paz** al prepararla: si hay
  transparencia en su marco no se busca fondo que quitar. Dentro de un canvas
  lo transparente se lee como negro, así que la búsqueda daba "negro" por color
  de fondo y se comía cualquier roca o tejado en sombra pegado al borde.

---

## 0.116 — 15/08/2026 20:26

- **El canto de las piezas de escenografía ya no se ve.** Al juntar varios
  tramos de camino sobre la mesa se leía el recorte de cada uno como una línea
  clara, y la pieza parecía una pegatina puesta encima del terreno. Eran tres
  fallos sumados en la preparación de la imagen, y van los tres:
  - **El recorte era binario**: un píxel estaba dentro (alfa 255) o fuera (alfa
    0), sin nada en medio. Ahora la tolerancia tiene dos escalones y el
    antialias del dibujo original recibe alfa proporcional.
  - **Quedaba un hilo de ribete** del color del fondo viejo: eran justo esos
    píxeles del antialias, que caían fuera de la tolerancia y sobrevivían
    opacos. Esa era la línea que se veía.
  - **El canto conservaba color del fondo.** Medido en Chromium sobre el verde
    de la mesa, se desviaba 45 de media (75 en el peor píxel) del color que
    debía dar; repintado con el del dibujo, 1,7.
- **Y se desvanece la silueta** en sus últimos píxeles, con una curva suave, para
  que la pieza se funda con la mesa. La anchura es proporcional al tamaño de la
  pieza (1,8 % del lado mayor), no un número fijo de píxeles: como todas se
  guardan a 512 px, un valor fijo daría un desvanecido distinto según lo que la
  pieza midiera en centímetros.
- **Esto cuesta bytes, y conviene saberlo**: la pieza terminada pesa un 14 %
  más que con el corte a hacha, porque un canto con cincuenta tonos de alfa es
  información que antes no estaba. A 512 px son unos pocos KB por pieza. (El
  repintado del canto, por su parte, ahorra un 8 % frente a dejarlo teñido: un
  color plano se comprime mejor que un degradado.)
- **Los extremos rectos NO se desvanecen**, solo la silueta. Un canto que llega
  hasta el borde de su propia imagen es un corte deliberado —el tramo de camino
  que se acaba en seco para empalmarlo con el siguiente—, y difuminarlo dejaba
  un claro entre dos tramos pegados. Se probó, y se veía.
- **Botón "Suavizar bordes" en la biblioteca**: baja la imagen de cada pieza, la
  vuelve a preparar y guarda una versión nueva de cada una. Es la forma de
  llevar al canto nuevo lo que ya estaba subido, porque esto se cocina en la
  imagen guardada y no es un ajuste que se pueda cambiar luego. Los mapas ya
  hechos no cambian, como siempre. Si la primera falla se para en seco: el
  motivo suele ser común a todas (el Worker sin desplegar) y no compensa
  encadenar veinte intentos condenados.
- **Una imagen que ya viene recortada se deja en paz**: si hay transparencia en
  su marco, no se busca fondo que quitar. Dentro de un canvas lo transparente se
  lee como negro, así que la búsqueda habría dado "negro" por color de fondo y
  se habría comido cualquier roca o tejado en sombra pegado al borde. Esto ya
  podía pasar antes; ahora no puede.

---

## 0.115 — 15/08/2026 16:45

- **Fuera el rayado de las peanas.** Se leía como lo que era —un patrón que se
  repite—, sobre todo en las grandes. El desgaste queda solo con manchas.
- **Y las manchas, más irregulares**: dieciséis elipses de tamaños y
  proporciones distintas, ninguna redonda, más cuatro motas sueltas que rompen
  del todo la sensación de degradado. Claras arriba a la izquierda (roce),
  oscuras abajo a la derecha (suciedad).

---

## 0.114 — 15/08/2026 16:43

- **Las peanas pasan a tener pintura desgastada** en vez del degradado plano
  con rayas. Cuatro capas: canto de luz arriba y de sombra abajo, grano fino a
  27° —a 45° se leía como cuadrícula—, ocho manchas de roce y suciedad
  repartidas sin simetría, y viñeteado en el borde.
- Las manchas van en tanto por ciento de la peana, así que se ven igual en una
  de personaje de 4 cm que en un regimiento de 12 × 10, y **el PNG y el PDF
  pintan exactamente las mismas**: el canvas de exportación lee la misma lista
  que la pantalla.
- El recuadro de color de la ficha de facción usa ya ese acabado, para que
  enseñe lo que de verdad se va a ver en la mesa.

---

## 0.113 — 15/08/2026 15:32

- **Repartidas las iniciales repetidas dentro de cada facción**: 35 unidades
  tenían las mismas que otra de su ejército y ahora llevan las suyas
  (Montaraces MOS, Matadragones MTD, Guardia Uhn ai GAI, Carro del Caos CCA…).
  Se conserva las suyas la unidad más antigua de cada choque y se buscan
  alternativas legibles para el resto —«Guerreros Sagrados» pasa a GSA, no a
  GS2—. Comprobado: no queda ninguna repetición dentro de ninguna facción.
- Entre facciones distintas SÍ pueden repetirse, y no pasa nada: el color de la
  peana ya las separa.
- **El PDF del despliegue lleva leyenda de facción**: un cuadro con su color y
  su nombre, en las dos hojas. Y la columna de referencia de la tabla va
  pintada de ese mismo color, así que la fila y la peana se reconocen a la vez.

---

## 0.112 — 15/08/2026 15:27

- **El alias sale de «Datos generales» a su propio apartado**, «Alias en el
  Despliegue». No era un dato general de la unidad: es de dibujo, solo existe
  para la mesa, y metido en la fila del nombre descuadraba la rejilla —un campo
  de tres caracteres junto a uno de texto largo—.
- **La fila de tamaños, compacta**: mínimo, máximo e inicial pasan a cajas de
  ancho fijo con las cifras centradas, y el «Unidad única (0-1)» va detrás en
  la misma línea. Antes cada uno ocupaba una cuarta parte del panel para dos
  dígitos.
- La rejilla vuelve a cerrar filas completas: Nombre · Coste · Categoría, y
  Etiqueta · Equipo.

---

## 0.111 — 15/08/2026 11:18

- **Las peanas del Despliegue llevan siempre el mismo cuerpo de letra**: el que
  cabe en una peana de 3,5 × 3,5 cm con tres letras (1,54 cm). Antes se
  calculaba a partir de la peana más pequeña que hubiera puesta, así que el
  mismo ejército se veía con una letra distinta según lo desplegado. Si alguna
  peana fuera aún más pequeña, manda ella y se encoge; nunca crece.
- El PDF del despliegue usa exactamente el mismo cálculo, así que papel y
  pantalla coinciden.
- **Aviso de iniciales repetidas** en la ficha de la unidad. Si las escribes a
  mano y ya las usa otra unidad de la misma facción, sale en rojo diciendo
  cuál y no deja guardar. Si son las automáticas del nombre, avisa en bronce
  pero deja seguir: hay 31 choques heredados en el catálogo y bloquear el
  guardado de todos ellos impediría trabajar.
- El aviso mira solo DENTRO de la facción: un despliegue es un ejército de una
  facción, así que dos unidades de facciones distintas nunca comparten mesa.

---

## 0.110 — 15/08/2026 10:59

- **Fechas de versión corregidas.** Las entradas de 0.98 a 0.109 decían
  14/08/2026 con horas que no habían existido: se escribían de memoria en vez de
  mirar el reloj. Ahora llevan la fecha real, sacada de la de su commit (todas
  esas versiones salieron el 15/08 por la mañana).
- A partir de ahora la fecha se lee del sistema en hora de España cada vez que
  se sube la versión, y así queda escrito en `version.ts` y en un `CLAUDE.md`
  nuevo en la raíz, junto con el resto de acuerdos de trabajo del repositorio.

---

## 0.109 — 15/08/2026 10:54

- **La versión del pie ya sale centrada.** Iba pegada a la derecha de la
  columna de contenido, así que en pantalla ancha quedaba a un tercio del
  borde: ni centrada ni en la esquina. Ahora se centra en la página.
- **Los mapas son comunes de verdad**: cualquiera puede abrirlos, editarlos y
  borrarlos. Antes solo su autor podía, y al abrir el de otro salía «Este mapa
  es de otro usuario» sin poder tocar nada.
- **Botón de ocultar** (el ojo tachado) en cada mapa propio: deja de salir en
  el listado de los demás y lleva un distintivo «Oculto» para que se vea por
  qué. Es para tener uno a medias sin estorbar, no para cerrarlo con llave.
- **Iconos en lugar de símbolos escritos.** Se han sustituido los glifos
  sueltos —«✕» de cerrar, «›» de los desplegables, «▲▼» de ordenar, «+» de
  añadir, «↑↓» del orden— por iconos de trazo del mismo juego que el resto.
  Un carácter de texto cambia de forma con cada tipografía y no se alinea con
  nada; nueve iconos nuevos lo arreglan.
- **Acciones de una fila, en icono y con su rótulo al pasar el ratón**:
  reemplazar y borrar en la biblioteca, exportar PNG en el mapa, exportar el
  despliegue, volver atrás. Todos con `aria-label`, así que se siguen leyendo
  igual con teclado o lector de pantalla.

---

## 0.108 — 15/08/2026 10:42

- En la biblioteca de escenografía, «Retirar» pasa a ser **«Borrar»** y
  **pregunta antes**, diciendo lo que va a pasar: desaparece de la paleta y los
  mapas que ya lo usan siguen igual.
- **Fuera la lista de «Retirados»** y su botón de recuperar, en elementos y en
  suelos. Lo borrado no vuelve.
- En la base de datos el elemento sigue estando, y tiene que seguir: los mapas
  que lo usaban apuntan a su versión y sin ella se quedarían con un hueco. Lo
  que desaparece es de la paleta, no del historial.

---

## 0.107 — 15/08/2026 10:39

- Nuevo elemento de escenografía: **«Meseta»**, la pradera elevada con cantil
  que enviaste. Nace a 45 × 28 cm, la proporción de su ilustración.
- **Exportar el mapa a PNG** desde el editor, a 8 px/cm (1440 × 960 en una mesa
  normal).
- **Exportar el despliegue a PDF**: una hoja apaisada con el mapa y el ejército
  colocado, y otra con el orden de batalla.
- **Y se sabe quién es cada peana.** Cuando dos unidades comparten iniciales se
  numeran («GS1», «GS2»); si no las comparte nadie, se quedan como estaban. La
  leyenda desarrolla cada referencia con su cantidad, su nombre y su equipo,
  que es lo único que separa dos regimientos del mismo tipo con distinto
  armamento. Las peanas de la pantalla usan la misma referencia, así que papel
  y pantalla dicen lo mismo.
- Los dos exportadores **pintan el mapa desde los datos**, no capturando la
  pantalla: sale igual en cualquier ordenador y con cualquier tamaño de
  ventana, con las rotaciones y el suelo exactos.

---

## 0.106 — 15/08/2026 10:33

- **Biblioteca de escenografía, con versionado.** Desde el editor de mapas
  («Escenografía → Editar…») se pueden **añadir** elementos propios,
  **reemplazar** la imagen de cualquiera —también los de fábrica— y
  **retirarlos** de la paleta.
- **Los mapas ya hechos no se estropean.** Editar no modifica nada: crea una
  versión nueva. Cada pieza guarda con qué versión se hizo, así que un mapa de
  la semana pasada sigue viéndose igual, y el que estés editando adopta lo
  nuevo al guardarlo. Retirar tampoco borra: saca el elemento de la paleta y
  deja intactos los mapas que lo usaban. Comprobado contra la base: tras
  reemplazar, la pieza guardada sigue apuntando a la imagen de su versión.
- **Las imágenes se preparan solas**: se les quita el fondo liso —el que toca
  el borde, no "todo lo blanco", para no comerse la nieve ni un tejado claro—,
  se recorta el aire que sobra y se reducen a 512 px. Vale igual con fondo
  blanco que negro, y si no hay fondo plano no toca nada.
- **Suelos de mesa propios**: se sube una textura, se elige cada cuántos
  centímetros se repite y cuánto se ve, con vista previa sobre una mesa de
  180 × 120. Los de fábrica (liso y hierba) siguen donde estaban.

---

## 0.105 — 15/08/2026 10:11

- En el Despliegue, el rótulo de la peana pasa a ser **«36 Guerreros Skaven»**:
  cantidad y nombre, como se dice en voz alta.
- **Ventana de apéndices, rehecha.** «Nuevo» y «Copiar de…» comparten ahora un
  único bloque partido por un filete: mismo alto, mismo cuerpo de letra y el
  mismo ancho exacto. Antes eran dos botones de familias distintas, uno más
  alto que el otro.
- La ventana **ocupa bastante menos**: de 64 a 48 rem de ancho, columna de
  apéndices más estrecha y sin alto mínimo forzado.
- La lista está más tranquila: el apéndice abierto se marca con el filete
  granate que ya usa el orden de batalla, y las flechas de ordenar y la
  papelera solo asoman al pasar por encima (o al llegar con el tabulador).
- Una sola línea de ayuda bajo el editor, y la que toca en cada caso: si está
  vacío, que no saldrá en la ficha; si tiene texto, que se puede pegar.

---

## 0.104 — 15/08/2026 10:11

- **En el Despliegue, posar el ratón sobre una peana dice quién es**: nombre y
  cuántas miniaturas, al momento. Con la mesa llena de cuadros de tres letras
  era la única forma de reconocer una unidad sin ir a buscarla a la lista. Sale
  encima de la peana, o debajo si está pegada al borde de arriba.
- **Los mapas pueden tener suelo de hierba.** En el editor, un apartado
  «Suelo» con dos muestras: Liso (el pergamino de siempre) y Hierba.
- La hierba es deliberadamente **muy suave**: manchas verdes al 10 % y un
  rayado finísimo sobre el mismo pergamino. Encima van la retícula, la línea
  central, el terreno y hasta veinte peanas de colores; un fondo con contraste
  de verdad competiría con todo eso.
- Se ve igual en los tres sitios donde se pinta una mesa: el editor, la
  miniatura del listado y el Despliegue al cargar ese mapa.

---

## 0.103 — 15/08/2026 10:11

- **Apéndices de unidad.** Botón «Apéndices» en la ficha de la unidad, con el
  número que tiene. Desde ahí se añaden, editan, borran y ordenan; una unidad
  puede tener los que haga falta, cada uno con su título.
- **Editor con formato**: negrita, cursiva y listas (con puntos o numeradas).
  El texto va justificado siempre, así que no hay nada que decidir por párrafo.
- **Se puede pegar**, y lo pegado llega limpio: solo sobreviven párrafos,
  negrita, cursiva y listas. Un texto traído de Word o de un PDF pierde sus
  tipografías, colores y tamaños, que era lo que ensuciaba la ficha sin remedio.
- **«Copiar de…»** trae una copia de un apéndice de cualquier otra unidad, con
  buscador por título, unidad o facción. Es una COPIA: a partir de ahí son
  independientes y editar uno no cambia el otro.
- Los apéndices se guardan por su cuenta, no con el «Guardar cambios» de la
  ficha; y cambiar de apéndice con algo escrito sin guardar avisa antes.
- Salen también **debajo de la hoja en la sección Fichas** —debajo y no dentro:
  la hoja tiene alto máximo y recorta lo que se sale, así que un apéndice largo
  la habría partido por la mitad.

---

## 0.102 — 15/08/2026 10:11

- **Arreglada la alineación de «Datos generales»** en la ficha de unidad. Los
  campos se alinean ahora por abajo: un rótulo que se parte en dos líneas
  («Tamaño inicial» en su columna) empujaba su caja y dejaba los tres tamaños a
  tres alturas distintas. Los tres tienen además la misma anchura.
- «Sendas de magia» pasa a **«Sendas de Magia»** (menú y título del editor).
- **En el Despliegue, todas las iniciales van del mismo tamaño.** Antes cada
  una se escribía al tamaño de su peana y la mesa parecía un cartel de
  rebajas. Ahora se calcula el mayor cuerpo que quepa en todas y se usa ese; se
  mide en centímetros de mesa, así que no cambia al redimensionar la ventana.
- **Fuera el nombre debajo de la peana**: con las iniciales dentro sobra, y el
  detalle sigue saliendo al pasar el ratón por la fila del orden de batalla.

---

## 0.101 — 15/08/2026 10:11

- **Categorías y Etiquetas**: fuera el código en mayúsculas de cada fila. Era
  el mismo nombre otra vez (Personajes / PERSONAJE); el código sigue estando y
  sigue sin poder editarse, solo que ya no se enseña.
- «Etiquetas de tipo — peana en el Despliegue» pasa a llamarse **«Etiquetas»**.
- **La peana ahora es una columna, no dos cajitas sueltas**: cabecera de
  columnas (Nombre · Peana · Uso), cifras alineadas y campos que solo se
  dibujan al apuntarlos.
- Y guarda **al salir del campo o con Intro**, no en cada tecla. Antes, cambiar
  12 por 5 escribía tres veces en la base pasando por valores que nadie quiso,
  con la lista recargándose bajo el cursor. Con Escape se descarta.

---

## 0.100 — 15/08/2026 10:11

- Nuevo tipo de escenografía **«Colina rocosa»**: la meseta de cantiles que
  enviaste. Nace a 40 × 29 cm, la proporción de la ilustración. Van once tipos
  por ilustración y seis por vector.

---

## 0.99 — 15/08/2026 10:11

- **Alias de unidad**: las iniciales que se pintan DENTRO de la peana en el
  Despliegue («RO» para Ratas Ogro). Máximo 3 caracteres.
- Se edita en la ficha de la unidad, junto al nombre. **No se usa para nada
  más**: ni al montar el ejército, ni en las listas, ni en los PDF, ni en las
  hojas de unidad. Puede repetirse entre unidades.
- En blanco, la mesa saca **las iniciales del nombre** («Lobos gigantes» → LG,
  «Grifo» → GRI), y son esas las que aparecen en gris en el campo. Así una
  unidad recién creada ya tiene su alias sin tener que escribirlo, y renombrarla
  no deja unas iniciales viejas colgando.
- El texto va en SVG para que **encoja con el recuadro**: cabe igual en una
  peana de personaje de 4 cm que en un carro de 5 × 10, y no hay que recalcular
  nada al cambiar el tamaño de la mesa o de la pantalla. El cuerpo de letra
  depende del número de letras, para no desaprovechar el hueco con una sola.
- El color de las letras sale del color de la facción: claro sobre los oscuros,
  tinta sobre los claros.

---

## 0.98 — 15/08/2026 10:11

- **Cada facción tiene su color.** Se ve —y se cambia— en un recuadro pequeño
  al editar la facción.
- **En el Despliegue, las peanas se pintan de ese color** y ocupan el recuadro
  entero, en lugar del emblema: a 40 px de peana un emblema no se distinguía de
  otro, y dejaba pergamino alrededor. El color no es plano, lleva un entramado
  fino y un degradado para que tenga materia sobre el terreno pintado. El
  nombre se escribe en claro u oscuro según el color, para que se lea también
  sobre los amarillos.
- Los 22 colores **no salen de los emblemas**: son ilustraciones sepia sobre
  pergamino, con los tonos en la franja 23°–47° y nueve de ellos casi grises;
  muestreándolos habrían salido 22 marrones iguales. Se han elegido por lo que
  cada facción es (el rojo del Imperio, el azul de Bretonia, el verde de los
  Orcos) y se ha comprobado que el par más parecido queda a 17,6 de distancia
  perceptiva (CIE76), con mediana 60.

---

## 0.97 — 30/07/2026 12:15

- Nuevo tipo **«Casa cuadrada»**, con la ilustración que enviaste. Van diez
  tipos por ilustración y seis por vector.

---

## 0.96 — 30/07/2026 12:05

- **Arreglado: cambiar el tamaño de una pieza girada no funcionaba.** El
  tirador está en la esquina y gira con la pieza, así que el ratón se mueve en
  los ejes de la mesa mientras lo que se estira son el ancho y el fondo de la
  pieza, que a 40° apuntan a otro sitio. Ahora se deshace el giro antes de
  medir, y redimensionar se comporta igual esté como esté puesta.

---

## 0.95 — 30/07/2026 11:50

- Nuevo tipo de escenografía **«Casa»**, con la ilustración que enviaste. Nace
  con la proporción de la propia imagen, así que sale sin deformar y solo hay
  que colocarla.

---

## 0.94 — 30/07/2026 11:40

- Nuevo botón **«Retirar todas de la mesa»** en el Despliegue: devuelve de
  golpe a la reserva todo lo desplegado. No pide confirmación porque no borra
  nada — basta con no guardar para deshacerlo.
- **La ficha emergente sale ahora a la derecha de la fila** y centrada en
  vertical, en vez de encima: en una columna lateral estrecha se salía por la
  izquierda y aparecía cortada.
- Y **cambia de aspecto**: pergamino en vez de un bloque negro, con cabecera de
  emblema y nombre, y las filas separadas por filetes. Se queda solo con lo que
  se elige al montar la lista —**equipo, montura, mando y opciones**—; fuera el
  perfil, las reglas especiales y los puntos, que no cambian al desplegar.

## 0.93 — 30/07/2026 11:20

- Fuera el botón **«Rocas»** de la paleta, que Peñasco, Roca y Lajas cubren
  mejor. Los mapas que ya tuvieran una pieza de ese tipo la siguen mostrando:
  se deja de ofrecer, no se borra.

---

## 0.92 — 30/07/2026 11:10

- **Tres tipos de piedra nuevos** con sus ilustraciones: **Peñasco**, **Roca** y
  **Lajas**. Venían con fondo negro opaco; el recorte de fondo ahora funciona
  igual con fondos claros y oscuros, deduciendo el color de las esquinas.
- **Los siete tipos que siguen siendo vectoriales —río, rocas, ruinas,
  edificio, muro, puente y camino— se han redibujado al estilo de las
  ilustraciones**: ruedo de hierba irregular alrededor, siluetas trazadas a
  pulso en vez de círculos y rectángulos perfectos, grano de ruido, sombra
  suave, y la paleta muestreada de las propias ilustraciones. No pasan por
  pintados a mano, pero dejan de parecer de otro programa.

---

## 0.91 — 30/07/2026 10:45

- «Campo de cultivo» pasa a llamarse **«Sembrado»** y se dibuja con la
  ilustración que enviaste. Van cinco tipos por ilustración y siete por vector.

---

## 0.90 — 30/07/2026 10:35

- **Colina**, **pantano** y **laguna** pasan a dibujarse con las ilustraciones
  cenitales que enviaste, como ya hacía el bosque. Van cuatro tipos por
  ilustración y ocho por vector.
- **Arreglado el fondo blanco** de la laguna y el pantano: sus archivos venían
  sin transparencia, con el damero de fondo pintado dentro. Se recorta con un
  relleno desde los bordes, que borra solo lo claro conectado con el borde y
  respeta las piedras y la vegetación clara del interior.

---

## 0.86 — 30/07/2026 09:45

- **El despliegue puede usar un mapa.** En el panel de la derecha se elige
  entre «Mesa libre (sin mapa)» —la de siempre, con sus barras de tamaño— o
  cualquiera de los mapas guardados. Con un mapa cargado, **sus medidas mandan**
  (las barras desaparecen) y su **escenografía se pinta de fondo sin poder
  tocarse**: aquí se despliega el ejército, no se rehace el terreno. Solo se
  mueven las tropas.
- **Los mapas son públicos.** En la sección Mapas salen los de todos los
  usuarios y cualquiera puede abrirlos y cargarlos en su despliegue; editarlos
  y borrarlos sigue siendo cosa de su autor, así que la papelera solo aparece
  en los propios.
- Al cambiar de mapa, las unidades que se quedarían fuera se reencajan por el
  borde más cercano: dos mapas no tienen por qué medir lo mismo. Y si alguien
  borra un mapa que estabas usando, la lista vuelve a mesa libre en vez de
  quedarse rota.

## 0.85 — 30/07/2026 09:15

- El tablero de Mapas y Despliegue se dibuja un **5 % más pequeño**.

---

## 0.84 — 30/07/2026 09:00

- **El tablero aprovecha ya toda la pantalla.** Lo que lo estrangulaba no era
  el alto sino un tope de ancho que le había puesto; fuera ese tope, con menos
  alto reservado y las dos columnas laterales algo más estrechas, la mesa gana
  cerca de un 40 % en 1080p.

- El **bosque** de los mapas pasa a dibujarse con la **ilustración cenital** que
  enviaste, en vez del vector. Los tipos que tengan imagen la usan; los demás
  siguen con su silueta, y las dos vías se estiran igual al redimensionar la
  pieza. En el catálogo de la izquierda la muestra se ve sin deformar.

## 0.83 — 30/07/2026 08:35

- En Mapas y Despliegue: **fuera los botones de tamaño de mesa** (180 × 120 y
  240 × 180), que quedan solo las barras; **fuera las barras negras** que
  cortaban la cabecera y los filetes del marcador, sustituidos por un único
  filete fino; y **fuera los textos que explicaban qué hacer** en el panel
  derecho.
- La pantalla es algo **más pequeña**: se centra con un ancho máximo y la mesa
  reserva más alto, así que el tablero encoge.

## 0.82 — 30/07/2026 08:10

- **El tablero se centra y las reglas caen sobre él.** En Mapas y en
  Despliegue, las reglas graduadas ocupaban el ancho entero de la columna
  mientras el tablero —limitado por alto— solo una parte, así que las marcas no
  coincidían con sus líneas y el conjunto quedaba escorado a la izquierda.
  Ahora el ancho lo manda el tablero, reglas incluidas, y el bloque va
  centrado.
- El segundo filete del tablero pasa a dibujarse por fuera, sin ocupar sitio:
  el relleno que lo separaba descuadraba la regla unos píxeles.

## 0.81 — 30/07/2026 07:45

- **Arreglado: el mapa y el despliegue salían diminutos y pegados a la
  izquierda**, con media pantalla vacía. Los márgenes negativos que ensanchan
  estas dos pantallas solo estiran un elemento de ancho automático; con
  `w-full`, el ancho quedaba fijado al del resto del programa y lo único que
  hacían era desplazarlo. Ahora ocupan la ventana entera y la mesa aprovecha
  todo el espacio disponible en 1080p.

## 0.80 — 30/07/2026 07:20

- **Nueva sección «Mapas»** en el menú de arriba: mesas con escenografía,
  independientes de los ejércitos. Se crean, se abren, se renombran y se
  borran, y cada tarjeta del listado enseña una **miniatura del mapa de
  verdad** — con seis mesas guardadas, la forma del terreno es lo que se
  reconoce, no el nombre.
- El **editor de mapas** es hermano del Despliegue y funciona igual: mesa a
  escala con reglas graduadas, tamaño con dos barras (hasta 240 × 180), y
  edición en memoria que se persiste con «Guardar mapa».
- **Doce tipos de escenografía** vistos desde arriba: bosque, colina, río,
  laguna, pantano, rocas, ruinas, edificio, campo de cultivo, muro, puente y
  camino. Cada uno **dibujado con su forma y su color** —curvas de nivel para
  la colina, surcos para el campo, bloques angulosos para las rocas— para
  distinguirlos de un vistazo sin leer etiquetas. Nacen con el tamaño que
  suelen tener de verdad, así que se colocan y ya está.
- Cada pieza se **arrastra, se gira, se cambia de tamaño** con el tirador de la
  esquina, se duplica, se le puede poner nombre propio y se quita. Las flechas
  la mueven al centímetro.

## 0.79 — 30/07/2026 06:45

- El Despliegue **cabe en una pantalla de 1080p sin desplazarse**. La página se
  planta en 84 rem en vez de estirarse hasta el borde del monitor, y la mesa se
  limita también **por alto** conservando su proporción: antes, un tablero de
  240 × 180 se salía por abajo.
- En el orden de batalla, cada fila enseña solo **el nombre y cuántas
  miniaturas son**. Fuera el tamaño de peana, el equipo y los puntos: en una
  lista de veinte unidades, cada dato de más es una línea que hay que saltarse.
- Todo eso pasa a una **ficha emergente al pasar el ratón** con el detalle
  completo: facción, categoría y etiqueta, miniaturas y puntos, perfil, equipo,
  opciones, grupo de mando, montura, carro y reglas especiales (las de la
  montura elegida incluidas).

## 0.78 — 30/07/2026 06:10

- **El orden de batalla ya no se vacía.** Desplegar una unidad la deja en la
  lista: lo que cambia es su marca de estado —cuadro relleno si está en la
  mesa, hueco si sigue en reserva—. Con medio ejército puesto, antes no había
  forma de ver qué llevabas.
- **La lista y la mesa están unidas en los dos sentidos**: elegir una peana
  marca su fila y la trae a la vista; pulsar una fila ya desplegada elige su
  peana (sin recolocarla).
- Cada fila muestra ahora **peana en cm, cantidad, puntos y equipo**, que es lo
  único que distingue cuatro regimientos con el mismo emblema. El tamaño sale
  en bronce cuando está ajustado a mano.
- El **tamaño de la mesa se ajusta con dos barras** en vez de casillas, con su
  cifra al lado y atajos para 180 × 120 y 240 × 180.
- **Rediseño de la pantalla**: cabecera entre filetes con marcador de unidades
  y puntos desplegados, reglas graduadas cada 30 cm en los bordes del tablero,
  línea central a trazos, mesa con doble filete y sombra interior, y rótulos de
  sección en versalitas.

## 0.77 — 30/07/2026 05:30

- **Despliegue rehecho.** Ocupa ahora **todo el ancho de la ventana**, con las
  unidades a la izquierda, la mesa en el centro y un panel de ajustes a la
  derecha. Encerrada en la columna del resto del programa, la mesa quedaba del
  tamaño de un sello.
- **Las medidas de la mesa se configuran** por ejército: 180 × 120 de salida y
  hasta 240 × 180. Hay atajos para los dos tamaños más comunes. Al encoger la
  mesa, lo que se quedaría fuera se reencaja por el borde más cercano en vez de
  perderse.
- **Cada peana se puede redimensionar** arrastrando el cuadrito de su esquina
  inferior derecha (aparece al seleccionarla). Crece desde el centro, así que
  no se desplaza mientras se estira. Un botón la devuelve al tamaño de su
  etiqueta.
- En **Categorías y Etiquetas**, cada etiqueta tiene ahora su **peana estándar
  en cm**, editable. Vienen con lo que había escrito en el código: 12 × 10 la
  tropa, 5 × 10 los carros y 4 × 4 personajes, hechiceros, máquinas de guerra y
  asedio. El tamaño de una peana sale, por este orden, de lo que se haya puesto
  a mano, del estándar de su etiqueta, y por último del tipo de unidad.

## 0.76 — 30/07/2026 04:40

- Los **personajes se ordenan por coste de MAYOR a MENOR**, tanto al añadirlos
  en Ejércitos como en el listado de la facción. Antes iban de menor a mayor.
  El resto de categorías siguen con su orden manual arrastrable.

## 0.75 — 30/07/2026 04:15

- El **interruptor de blanco y negro de la barra superior manda ahora en los
  dos PDF**. Cada uno lo interpreta como le corresponde:
  - **Hojas de unidad**: en escala de grises, tal y como se ven en pantalla.
  - **Hoja de ejército**: se **quita el fondo de pergamino** y los grises se
    separan —negro casi puro para el texto, medio para lo secundario, claro
    para filetes y zebra—. No es el PDF de color desaturado: un fondo a sangre
    en cada página gasta media impresora y deja el texto sobre un gris sucio.
    En blanco y negro la textura ni se descarga.

## 0.74 — 30/07/2026 03:45

- Al compartir un ejército, ahora se elige **por persona** si además ve el
  **despliegue**. El diálogo tiene dos casillas: «Ejército» y «Despliegue».
  Enseñarle la lista a un rival para que la revise antes de la partida no
  debería enseñarle dónde vas a colocar; a un compañero de equipo sí.
- La casilla del despliegue **nace apagada**, también en las listas ya
  compartidas: lo que se comparte sin querer no se puede des-ver. Se enciende
  en un clic.
- A quien tiene la lista pero no el despliegue, el botón «Despliegue» ni le
  aparece, y si llega por un enlace directo se encuentra un aviso claro en vez
  de un error.

## 0.73 — 30/07/2026 03:10

- **Selección múltiple en el despliegue.** Arrastrando sobre la mesa vacía se
  dibuja un recuadro que selecciona todo lo que toca; después, arrastrar
  cualquiera de las seleccionadas **mueve el grupo entero** manteniendo las
  distancias. Con Mayúsculas se van sumando unidades a la selección, y las
  flechas del teclado también mueven todo lo seleccionado.
- El grupo se mueve **como un bloque**: al empujarlo contra un borde deja de
  avanzar entero en vez de que las de fuera se paren y las de dentro sigan. Un
  frente no se deforma solo por haber arrastrado un poco de más.
- «Devolver a la reserva» retira todas las seleccionadas de una vez.

## 0.72 — 30/07/2026 02:35

- En el lienzo, el **nombre de la unidad se ciñe al ancho de su peana** y baja
  de línea por el siguiente espacio en blanco. Una palabra suelta más ancha que
  la peana se sale antes que partirse por la mitad, que sería ilegible.
- Nuevo botón **«Alinear unidades»**: forma **líneas de batalla**. Toma la
  unidad más adelantada, sube a su altura todas las que se solapen con ella en
  vertical, y repite con las que quedan — así salen tantos frentes como haga
  falta, no uno solo. Las `x` no se tocan.
  Se igualan los **frentes**, no los centros: una peana de personaje tiene 4 cm
  de fondo y un regimiento 10, así que igualando centros el personaje quedaría
  3 cm por detrás de la línea.

## 0.71 — 30/07/2026 02:05

- El **lienzo del despliegue ocupa todo el ancho** y la reserva pasa **debajo**,
  en horizontal. Una mesa es apaisada: robarle una columna para un listado la
  encogía justo en la dirección que más duele.
- Cada peana lleva ahora el **emblema de la facción** dentro del cuadro y el
  **nombre fuera**, debajo, flotando sobre la mesa sin caja ni fondo. El nombre
  es lo único que hay que poder leer siempre; una etiqueta opaca por unidad
  taparía justo el terreno que se está planificando.
- **Peanas a escala real**: 12 × 10 cm un regimiento, 5 × 10 un carro (la peana
  de 50 × 100 mm) y 4 × 4 los personajes, máquinas de guerra y asedio. Al ir a
  escala, dos unidades pegadas en el lienzo están pegadas de verdad sobre la
  mesa.

## 0.70 — 30/07/2026 01:30

- **Nueva pantalla «Despliegue»**, con su botón dentro de cada ejército. Un
  lienzo con la mesa a escala (**180 × 120 cm**, con su retícula de 30 cm y la
  línea central) y, al lado, la **reserva** con las unidades que aún no has
  colocado. Al pinchar una, sale a la mesa como un estandarte con su nombre,
  cantidad y coste, y se arrastra a donde quieras.
- Las posiciones se guardan **en centímetros reales de mesa**, no en píxeles:
  el mismo plan se ve igual en cualquier pantalla y las distancias siguen
  significando algo. El estandarte no se sale del tablero y se puede afinar con
  las flechas del teclado (1 cm, o 5 cm con Mayúsculas).
- Se edita en memoria y se persiste con **«Guardar despliegue»**, como el
  constructor de listas. Un ejército compartido contigo se puede consultar
  pero no recolocar.
- Todos los estandartes miden lo mismo: es un esquema de colocación, no una
  medición. La base de datos no guarda el tamaño de peana, y un plan que
  parezca medido sin estarlo engaña más de lo que ayuda.

## 0.69 — 30/07/2026 00:40

- **Los ejércitos se pueden compartir.** En el listado, cada lista tuya tiene
  un botón «Compartir» donde eliges con qué usuarios. A ellos les aparece en su
  sección de Ejércitos, marcada con un **candado** y con el nombre de quien se
  la compartió.
- Una lista compartida contigo es de **solo lectura**: se abre, se consulta y
  se exporta a PDF, pero no se edita. En ella no se pinta el marco de añadir
  unidades ni salen los botones de guardar, ordenar, limpiar, renombrar,
  arrastrar, borrar ni tocar el coste — no es que estén apagados, es que no
  existen. En la cabecera hay un distintivo «Solo lectura» con el mismo
  candado.
- Un ejército sigue teniendo **un solo dueño**: si dos personas pudieran
  editarlo, el borrador de cada una pisaría el de la otra al guardar y no
  habría forma de saber cuál era el bueno.

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
