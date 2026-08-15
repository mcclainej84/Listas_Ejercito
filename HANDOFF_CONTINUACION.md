# WHArmy — traspaso para continuar en otra conversación

Pega este archivo (o su ruta) al empezar la sesión nueva. Está escrito para que
quien lo lea pueda seguir programando sin volver a preguntar nada de lo ya
decidido.

**Actualizado:** 15/08/2026 · versión del programa **0.115** · último commit
`4dbc5b7` · rama `main`, árbol limpio.

---

## 1. Lo primero que hay que leer

En este orden, antes de tocar código:

1. **`CLAUDE.md`** (raíz) — las reglas de trabajo acordadas con el usuario. Son
   acuerdos, no preferencias: versión y fecha en cada cambio, los cinco sitios
   que hay que tocar al cambiar el esquema, las opciones de Prettier y el
   idioma.
2. **`webapp/ARCHITECTURE.md`** — todas las decisiones técnicas con su motivo,
   en orden cronológico. Es largo; al menos su índice y la sección final de
   deuda conocida.
3. **`CHANGELOG.md`** — qué se hizo y cuándo. Las entradas recientes explican
   el porqué de cada cosa, no solo el qué.

Los archivos de código llevan una cabecera larga explicando **por qué** están
hechos así. Antes de cambiar algo que parezca raro, léela: casi siempre hay un
fallo real detrás.

---

## 2. Qué es el programa

Gestor de listas de ejército de Warhammer Fantasy para un grupo cerrado de
jugadores. Todo en español: interfaz, comentarios, nombres del dominio
(`piezas`, `mesa`, `peana`) y mensajes de commit.

**Stack:** React 19 + TypeScript + Vite (rolldown) + Tailwind v4, desplegado en
GitHub Pages. Backend: Cloudflare Worker + D1 (`wharmy-db`, id
`d4faba12-adf0-4ee9-bcb8-17584667ddaa`) + R2 para imágenes. El catálogo viaja
entero al navegador en un snapshot y se consulta en memoria con sql.js; las
listas de ejército y los mapas van por red.

**Secciones:** Facciones · Unidades (editor) · Fichas (hojas de unidad estilo
CodexMaker) · Ejércitos (constructor de listas + PDF) · Despliegue (colocar el
ejército sobre la mesa) · Mapas (mesas con escenografía) · Categorías y
Etiquetas · Sendas de Magia · Log.

---

## 3. Estado y pendientes REALES

- ✅ Todo compila: `npx tsc -b --force`, `npx oxlint`, `npx vite build`, y
  `npx tsc --noEmit` dentro de `worker/`.
- ✅ `main` y `origin/main` apuntan al mismo commit (`4dbc5b7`).
- ⚠️ **`npx wrangler deploy` en `webapp/worker` SIGUE PENDIENTE.** Es lo más
  importante. Las migraciones nuevas están aplicadas a mano en la D1, pero
  hasta que se despliegue el Worker:
  - el `/snapshot` no devuelve `unit_appendices`, así que los apéndices
    desaparecen al recargar;
  - la subida de imágenes de la biblioteca de escenografía (R2) no funciona;
  - `battle_maps.hidden`, `texture`, `floor_id` y `battle_map_pieces.asset_id`
    existen en D1 pero el Worker desplegado no los conoce.
- El aviso de "faltan migraciones" de la propia app (ver `schemaHealth.ts`) es
  el que delata esto en pantalla.

---

## 4. Reglas de trabajo (resumen de `CLAUDE.md`)

1. **Cada cambio visible sube la versión** en `webapp/src/version.ts`
   (contador: 0.115 → 0.116) **y actualiza la fecha leyéndola del reloj**:
   ```sh
   TZ=Europe/Madrid date '+%Y-%m-%dT%H:%M'
   ```
   Nunca escribirla de memoria — se hizo y el pie de página acabó mintiendo.
   Y anotarlo en `CHANGELOG.md` con esa misma fecha.
2. **Tocar el esquema son cinco sitios**: `worker/src/index.ts#MIGRATIONS`,
   `webapp/db/schema.sql`, `SNAPSHOT_TABLES`/`CATALOG_TABLES` si es catálogo,
   una sonda en `schemaHealth.ts`, y aplicarlo en la D1 de verdad.
3. **Prettier sin configuración en el repo**, hay que pasarle las opciones:
   ```sh
   npx prettier --no-semi --single-quote --print-width 120 --trailing-comma all --write <archivos>
   ```
4. El usuario **no quiere explicaciones de cómo funciona el programa** en las
   respuestas: ya lo sabe. Resultados, y las decisiones que haya tomado uno.

---

## 5. Lo construido en la última tanda (0.98 → 0.115)

Todo esto es reciente y conviene conocerlo antes de tocar nada cercano.

### Color de facción — `webapp/src/domain/factionColor.ts`
Cada facción tiene un color (`factions.color`) que es su distintivo en el
Despliegue: la peana se pinta entera con él. **Los 22 colores no salen de los
emblemas** (son sepia sobre pergamino; muestreándolos salían 22 marrones
iguales): se eligieron por facción y se comprobó la separación con CIE76 —el
par más parecido está a 17,6, mediana 60—.

El acabado es **pintura desgastada**: canto de luz arriba y sombra abajo,
dieciséis manchas elípticas irregulares (claras arriba-izquierda = roce,
oscuras abajo-derecha = suciedad), cuatro motas sueltas y viñeteado. **Sin
rayas ni tramas**: se probó y se leía como patrón. Las manchas se definen una
sola vez (`DESGASTE`) en porcentajes, y las lee tanto el CSS como el canvas de
exportación, así que pantalla y papel pintan lo mismo.

### Alias de unidad — `webapp/src/domain/unitAlias.ts`
`units.alias`: tres caracteres que se pintan DENTRO de la peana. Si está vacío
se usan las iniciales del nombre. **No se usa para nada más**: ni listas, ni
PDF de ejército, ni búsquedas.

- Las iniciales **no se repiten dentro de una misma facción**: se repartieron a
  mano 35 alias en agosto de 2026 y no queda ninguna colisión. Entre facciones
  distintas **sí** pueden repetirse: el color las separa.
- La ficha de la unidad avisa si chocan dentro de la facción; si el alias se
  escribió a mano, además no deja guardar.
- En la mesa, dos unidades del mismo ejército con el mismo alias se numeran
  (`GS1`, `GS2`) — ver `domain/deploymentRefs.ts`.
- **El cuerpo de letra es fijo**: el que cabe en una peana de 3,5 × 3,5 cm con
  tres letras (1,54 cm). Solo encoge si alguna peana es más pequeña; nunca
  crece.

### Apéndices de unidad — `webapp/src/features/admin/units/AppendicesModal.tsx`
Bloques de texto con formato (negrita, cursiva, listas, justificado) que salen
debajo de la hoja en la sección Fichas. El HTML se **sanea** en
`shared/richText.ts`: lista cerrada de etiquetas, sin atributos, sin scripts —
probado con trece casos. «Copiar de…» duplica un apéndice de otra unidad; es
copia independiente, no enlace.

### Mapas y biblioteca de escenografía — `webapp/src/features/maps/`
- Los mapas son **comunes**: cualquiera los abre, edita y borra. Solo su autor
  puede **ocultarlos** (`battle_maps.hidden`), y entonces desaparecen del
  listado de los demás.
- **Biblioteca versionada** (`scenery_assets`, `floor_assets`): editar un
  elemento **nunca modifica una fila**, inserta una versión nueva del mismo
  `slug`. Cada pieza de un mapa guarda el `asset_id` con el que se colocó, así
  que los mapas antiguos no cambian jamás. Borrar es otra versión con
  `retired`, **no se puede deshacer** y se pregunta antes.
- Las imágenes subidas se preparan solas: se quita el fondo **liso conectado al
  borde** (no "todo lo blanco", que se comería la nieve o un tejado claro), se
  recorta al contenido y se reduce a 512 px WebP. El algoritmo puro está en
  `shared/imageTrim.ts` y se probó fuera del navegador.
- **Suelos de mesa**: textura enlosada cada N cm con opacidad regulable, más
  los de fábrica (liso y hierba).

### Exportación
- **Mapa → PNG** desde el editor, a 8 px/cm.
- **Despliegue → PDF** apaisado: una hoja con el mapa y el ejército colocado y
  otra con el orden de batalla, con leyenda del color de la facción en ambas.
- Los dos **pintan la mesa desde los datos** en un canvas
  (`features/maps/renderTableCanvas.ts`), no capturan la pantalla: capturar el
  DOM reproduce mal los fondos, redondea las rotaciones y arrastra el tamaño de
  la ventana.

---

## 6. Decisiones que NO hay que deshacer sin hablarlo

- **Versionado de la biblioteca**: nada se modifica ni se borra de
  `scenery_assets` / `floor_assets`. Es lo único que sostiene los mapas
  antiguos.
- **Alias único solo por facción**: globalmente hay 80 colisiones (228
  unidades) con tres caracteres; exigir unicidad global obligaría a
  abreviaturas ilegibles.
- **Sin lista de "retirados"** en la biblioteca: se probó y acaba siendo un
  cajón de trastos.
- **Iconos, no glifos de texto** (`shared/ui/icons.tsx`): un "✕" o un "›"
  cambian de forma con la tipografía y no se alinean. Todos los botones de solo
  icono llevan `aria-label` y `title`.
- **Los apéndices se guardan en su ventana**, no con el "Guardar cambios" de la
  ficha: son textos largos.

---

## 7. Trampas conocidas (ya nos han mordido)

- **Márgenes negativos** solo estiran un elemento de ancho AUTO; con `w-full`
  solo lo desplazan. Fue por qué la mesa salía diminuta.
- **`aspect-ratio`** crece de alto sin freno: hay que limitar también por alto
  o la mesa se sale en 1080p.
- **`columnStyles` pisa a `headStyles`** en jspdf-autotable: la cabecera se
  recentra a mano en un `didParseCell`.
- **La pestaña del PDF hay que abrirla en el propio clic** (`pdfWindow.ts`); si
  se abre después de generar, el navegador la bloquea.
- **Imágenes de R2 en canvas**: sin `crossOrigin = 'anonymous'` el canvas queda
  contaminado y falla AL EXPORTAR, no al dibujar.
- **contentEditable "controlado"** por React destruye el cursor: el editor de
  apéndices escribe el `innerHTML` una sola vez.
- **Git**: cada commit deja `.git/index.lock`. Si `rm` falla con "Operation not
  permitted", hay que pedir permiso de borrado sobre la carpeta.
- Un `useEffect` que depende de un array recreado en cada render (`x ?? []`)
  entra en bucle si dentro llama a un `setState` con objeto nuevo.

---

## 8. Por dónde seguir

Pendiente de decidir con el usuario:

1. **Desplegar el Worker** (lo bloquea todo lo demás de la biblioteca).
2. `faction_construction_rules` sigue sin UI ni motor: reglas de composición
   por facción (mínimo 1 Señor, máximo 3 Raras, porcentajes de puntos).
3. Los "Grupos de Apoyo" de Skaven siguen sin mecanismo de "unidad adjunta a
   otra" en el constructor de listas.
4. Quedan preguntas sin respuesta de rondas anteriores: si renombrar «Laguna» a
   «Lago», si retirar «Edificio» ahora que existe «Casa», y qué hacer con la
   pieza huérfana de tipo `rocas`.
5. `min_size`/`max_size`, `equipment_text` y `armor_save` de muchas unidades
   siguen sin revisar uno a uno.
