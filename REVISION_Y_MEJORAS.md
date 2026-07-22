# WHArmy — Revisión técnica/visual y propuesta de mejoras

_Fecha: 19 de julio de 2026._

Este documento recoge (1) los fallos corregidos en esta ronda, con su causa raíz;
(2) una revisión del programa desde el punto de vista técnico y visual; y (3) una
lista priorizada de mejoras propuestas.

> Aviso importante: en este entorno **no hay navegador para verificar de forma
> interactiva** (la extensión de Chrome no estaba conectada y el sandbox no
> alcanza ni GitHub Pages ni el Worker). Las correcciones se han diagnosticado por
> lectura de código y razonamiento, y se han validado con `tsc -b` + `vite build`
> limpios. Conviene una comprobación visual en el navegador tras desplegar.

---

## 1. Fallos corregidos en esta ronda

### 1.1. El buscador de la barra superior "no funcionaba"
**Causa raíz.** El desplegable de resultados se posicionaba con `position:absolute`
dentro del contenedor de la barra, que tiene `overflow-x-auto`. En CSS, poner
`overflow-x` en `auto` convierte también `overflow-y` en `auto`, de modo que
cualquier hijo absoluto que sobresalga hacia abajo (los resultados) queda
**recortado** por el borde de la barra. El buscador sí buscaba; los resultados
quedaban ocultos. Es exactamente el mismo problema que ya se había arreglado para
el menú Editor, pero al buscador no se le había aplicado.

**Arreglo.** El panel de resultados se pinta ahora en un **portal** a
`document.body`, posicionado bajo el input con `getBoundingClientRect` (y
recolocado al hacer scroll/redimensionar). Así escapa por completo del recorte.

### 1.2. Las opciones del menú Editor "no se abrían al pinchar"
**Causa raíz.** Un bug determinista y sutil. El menú se pinta en un portal (fuera
del `rootRef` del componente) y el cierre "al hacer clic fuera" escuchaba el evento
`mousedown`. Al pulsar una opción: primero se dispara `mousedown` → el manejador ve
el objetivo "fuera" de `rootRef` → cierra el menú → React **desmonta el portal** →
y entonces el `click` de la opción ya nunca llega a dispararse (su nodo ya no
existe), así que `navigate(...)` no se ejecutaba. El menú se cerraba sin navegar.

**Arreglo.** Se añadió una referencia al panel del portal; el manejador de
"clic fuera" ahora ignora los clics que caen **dentro** del panel, de modo que el
`click` de la opción llega intacto y navega. Mismo patrón aplicado al buscador.

### 1.3. Los emblemas salían muy oscuros en escala de grises
**Causa raíz.** La vista en blanco y negro aplica `filter:grayscale(100%)`, que
desatura por **luminancia**. Los emblemas de facción suelen ser rojos/granates/
negros muy saturados y de luminancia baja, así que caían a un gris casi negro, sin
matices, dominando el icono.

**Arreglo (pantalla).** Regla CSS que, solo en modo B&N y solo sobre los `<img>` de
emblema, aplica un realce de brillo/contraste **antes** de que el filtro del
contenedor los desature; el emblema queda en un gris legible. No afecta al texto ni
al resto de la ficha. Cubre tanto la rejilla de Facciones como el logo de la ficha.

**Arreglo (exportaciones).** Como html2canvas no captura filtros CSS, la conversión
a B&N de las exportaciones (PNG/Word) se hace por canvas. Se cambió la fórmula
"plana" por una que aplica una **curva gamma (<1)** que sube sombras y medios pero
**conserva los extremos** (el negro del texto sigue negro, el blanco del fondo sigue
blanco): así se aclaran los emblemas sin lavar el resto de la ficha. Implementado
con una tabla de consulta de 256 entradas (sin coste por píxel).

> Para clavar el resultado exacto: si me pasas el ejemplo de "cómo debería verse",
> ajusto los valores (brillo/contraste en pantalla y la gamma de exportación) para
> que coincida con tu referencia.

### 1.4. Opción "Restaurar datos"
Eliminada de la barra superior a petición tuya, y borrado el componente
`ResetDataButton.tsx` que quedaba sin uso. (El endpoint del servidor
`/admin/reset-seed` sigue existiendo por si algún día hace falta; simplemente ya no
hay botón que lo dispare.)

### 1.5. Extra: frontera de errores (nueva)
Añadí un **Error Boundary** de React (no existía). Antes, si cualquier componente
lanzaba una excepción al renderizar, React desmontaba todo y quedaba una **página en
blanco** sin pista ni forma de recuperarse. Ahora se muestra un aviso legible (en la
estética de la app) con botones de "Reintentar" y "Recargar", y el error queda en
consola para depurar.

---

## 2. Revisión técnica

### 2.1. Seguridad del backend (Worker + D1) — lo más relevante
- **API de SQL genérica.** `/query` ejecuta **cualquier** SQL que le mande el
  cliente con tal de que empiece por `SELECT`/`WITH`, y es **pública** (sin
  contraseña, CORS `*`). En la práctica es una consola de solo lectura abierta a
  Internet contra toda la base de datos. Para una herramienta de un grupo cerrado y
  datos de hobby el impacto es bajo, pero es una superficie de ataque innecesaria
  (exfiltración de cualquier tabla, o consultas pesadas como DoS). `/mutate` exige
  contraseña, pero también ejecuta SQL arbitrario (INSERT/UPDATE/DELETE) — cualquiera
  con la contraseña puede escribir lo que quiera.
- **Autenticación por hash compartido.** El cliente calcula el SHA-256 de la
  contraseña y lo manda; el servidor lo compara con `env.GROUP_PASSWORD_HASH`. Eso
  significa que **el hash ES la credencial**: queda en `localStorage` y viaja en cada
  escritura. Sobre HTTPS el riesgo de captura es limitado, pero no hay rotación,
  caducidad, ni límite de intentos. La comparación además no es de tiempo constante
  (fuga de tiempo, menor).
- **Sin límite de tamaño de payload ni de coste de consulta** más allá del máximo de
  50 sentencias por batch. Un `params` gigante o un BLOB enorme pasa sin control.

### 2.2. Rendimiento
- **Bundle grande.** El chunk principal pesa ~797 KB (~226 KB gzip) y el de PDF
  ~437 KB. El de PDF ya va aparte (bien), pero el principal se podría partir cargando
  las rutas bajo demanda (`React.lazy`) y difiriendo sql.js/html2canvas.
- **Snapshot con imágenes.** El `GET /snapshot` incluye la tabla `factions` con los
  emblemas como BLOB → viajan en base64 en el JSON que se descarga **en cada carga**
  de la app. Con muchas facciones esto engorda el arranque. Convendría servir los
  emblemas como archivos (URL/CDN) y dejar el snapshot solo con datos.
- **`RuleRepository.listAll()` en cada tecla.** El buscador global trae TODAS las
  reglas y las filtra en cliente en cada pulsación. Va contra la copia local en
  memoria (barato), pero es más limpio filtrar en la consulta como ya se hace con las
  unidades, y añadir un pequeño _debounce_.

### 2.3. Robustez / calidad de código
- **Sin tests.** No hay ni una prueba automatizada. Con la cantidad de lógica sutil
  (validación de listas, "hornear" imágenes, exportaciones) unos tests unitarios de
  las funciones puras (validación, `sheetContent`, `imageProcessing`) atraparían
  regresiones que ahora solo se ven a ojo.
- **Manejo de errores desigual.** Varias pantallas muestran el error; otras tragan
  el fallo en silencio (p. ej. el buscador). El Error Boundary nuevo cubre el caso
  catastrófico, pero faltaría un patrón uniforme de "cargando / error / reintentar".
- **`resetToSeed` quedó sin usar** en el cliente tras quitar el botón (no molesta,
  pero es código muerto si se decide no volver a exponerlo).

### 2.4. Accesibilidad
- Los desplegables (buscador, Editor) no tienen navegación por teclado (flechas /
  Enter / Home-End) ni roles ARIA de menú/listbox; el foco no se gestiona.
- Varias imágenes decorativas usan `alt=""` (correcto), pero faltan etiquetas en
  algunos controles solo-icono.

---

## 3. Revisión visual / UX

- **Coherencia de la paleta "pergamino":** muy lograda y consistente. La ficha
  (sección Fichas) vive a propósito fuera de esa paleta para replicar CodexMaker; el
  contraste entre ambos mundos es intencionado y funciona.
- **Estados vacíos y de carga:** existen (`EmptyState`, `Spinner`), bien.
- **Feedback de acciones:** faltan confirmaciones tipo "guardado ✓" tras escribir; el
  usuario no siempre sabe si un cambio se persistió.
- **Responsive:** la barra superior usa scroll horizontal en pantallas estrechas; con
  el portal ya no recorta los desplegables, pero en móvil el conjunto barra+buscador
  se aprieta. Un menú "hamburguesa" en móvil sería más cómodo.
- **Interruptor de color global vs. el de la ficha:** coexisten dos controles de
  blanco y negro (uno global en la barra, otro local en Fichas). Es potente pero
  puede confundir; convendría un microcopy que aclare la diferencia.

---

## 4. Mejoras propuestas (priorizadas)

### Prioridad alta (impacto alto, riesgo bajo-medio)
1. **Verificación visual en navegador** de esta ronda (emblemas B&N, buscador, menú
   Editor) antes de darla por buena. Ideal con la extensión de Chrome conectada.
2. **Tests unitarios** de las funciones puras: `domain/validation`, `armyValidation`,
   `sheetContent`, `imageProcessing`. Es la red de seguridad que hoy falta.
3. **Endurecer la API:** en lugar de SQL arbitrario, exponer operaciones concretas
   (o al menos una lista blanca de consultas/plantillas). Añadir límite de tamaño de
   payload y _rate limiting_ básico. Comparación de contraseña en tiempo constante.
4. **Sacar los emblemas del snapshot** y servirlos como archivos estáticos/CDN, para
   aligerar el arranque.

### Prioridad media
5. **Code-splitting por ruta** (`React.lazy` + `Suspense`) y carga diferida de
   sql.js/html2canvas/jspdf para bajar el bundle inicial.
6. **Accesibilidad de los menús:** navegación por teclado y roles ARIA en buscador y
   Editor; gestión de foco al abrir/cerrar.
7. **Debounce + filtrado en consulta** en el buscador (reglas incluidas).
8. **Feedback de guardado** consistente (toast "guardado ✓" / errores).
9. **Motor de reglas de composición de ejército** (`faction_construction_rules` ya
   existe en el esquema pero no tiene UI ni validación: "mínimo 1 General", límites
   por categoría, etc.).

### Prioridad baja / ideas
10. **Modo móvil** con menú plegable en la barra.
11. **Deshacer/rehacer** en el editor de unidades y en el constructor de listas.
12. **Exportar/Importar una lista** como archivo (JSON) para compartirla sin depender
    del backend.
13. **Historial de cambios** del catálogo (quién cambió qué) — dado que es
    multiusuario, ayuda a revertir errores sin el "restaurar datos de fábrica".
14. **Telemetría de errores** ligera (Sentry o similar) para no depender de que el
    usuario reporte los fallos a mano.
15. **Completar datos pendientes:** `min_size`/`max_size`/`equipment_text`/
    `armor_save` vacíos en varias unidades; las 3 unidades con Ataques no numérico
    (Trebuchet, Carros, Centigors) y el +1 del Campeón; decidir el futuro de los
    "Grupos de Apoyo" de Skaven (hoy duplicados).

---

## 5. Estado del build

`npx tsc -b` y `npm run build` compilan **limpios**. `oxlint` solo reporta 3 avisos
preexistentes de _fast-refresh_ (no afectan a producción). Sin regresiones de
compilación introducidas en esta ronda.
