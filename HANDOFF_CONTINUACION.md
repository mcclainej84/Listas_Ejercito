# WHArmy — Resumen de traspaso para continuar en otra conversación

Este documento es un punto de entrada rápido para retomar el proyecto en un chat nuevo (p. ej. con otro modelo). Pégalo o adjúntalo al empezar la conversación nueva, y pide explícitamente que lea primero `webapp/ARCHITECTURE.md` completo (es el documento vivo con TODAS las decisiones técnicas y su motivo, sección por sección) antes de tocar nada.

## Qué es esto

WHArmy: gestor de listas de ejército de Warhammer Fantasy (facciones, unidades, equipo, reglas, constructor de listas con export a PDF, y una sección "Fichas" de unidad al estilo de un programa de referencia llamado CodexMaker). Frontend React/TypeScript + Tailwind v4, desplegado en GitHub Pages; backend Cloudflare Worker + D1 (SQLite) para que los cambios de un usuario se vean reflejados para los demás, con un snapshot del catálogo cargado en memoria (sql.js) por rendimiento.

## Dónde está todo

- `webapp/` — el código de la app (React/TS). Este es el paquete que se compila y despliega.
- `webapp/ARCHITECTURE.md` — **el documento más importante**: cada decisión de diseño, con su motivo, en orden cronológico (secciones numeradas tipo "8bis", "8ter"... hasta la última ronda). La sección final "## 8. Deuda conocida / próximos pasos" resume lo pendiente.
- `webapp/worker/` — el Cloudflare Worker (API HTTP genérica sobre D1: `/query`, `/mutate`, `/snapshot`, con contraseña compartida para escrituras).
- `webapp/db/schema.sql` — el esquema completo de la base de datos, con comentarios explicando cada tabla.
- `HojaEjercito/` (en la raíz del proyecto, fuera de `webapp/`) — el programa de referencia original ("Hoja de Ejército"/CodexMaker) que se ha usado como especificación visual/funcional a replicar en varias rondas.
- Historial de Git: cada ronda de cambios es un commit local descriptivo (en español, explicando el motivo). **Los commits son SOLO locales — nadie ha hecho `git push` ni `wrangler deploy` todavía en esta sesión de trabajo**; eso queda para que lo haga el usuario cuando quiera.

## Estado actual (todo compilado y commiteado, working tree limpio)

Las 57 tareas de la lista de tareas de esta sesión están `completed`. La app tiene: catálogo completo de facciones/unidades/equipo/reglas/monturas/carros, constructor de listas ("Ejércitos") con validación en tiempo real, drag-and-drop para reordenar unidades/entradas, export a PDF, y la sección "Fichas" (estilo CodexMaker) con ilustración, escudo, alto configurable, vista color/blanco y negro (tanto local a Fichas como un interruptor global "arriba del todo" para toda la app), y exportación a PNG/Word con texto/Word con imágenes/Hoja de referencia.

### Últimas rondas de trabajo (las más recientes primero — ver ARCHITECTURE.md para el detalle completo de cada una)

1. **Fondo feo en Ilustración/Escudo + escudo montado sobre el texto al exportar** (commit `d2d6580`): `resizeImageFile` ahora admite `format: 'image/png'` para conservar transparencia real en Ilustración/Escudo de una ficha (antes forzaba JPEG con fondo sólido). El logo de la barra gris pasó de un `top` en porcentaje (que html2canvas medía mal, montando el escudo sobre el texto SOLO al exportar) a un offset en píxeles fijos. Quitado también el subtítulo de la página Fichas.
2. **Negro al pasar a blanco y negro + interruptor global** (commit `70cb639`): la causa era que subir un escudo/emblema con fondo transparente lo aplanaba a NEGRO puro (JPEG no tiene canal alfa); arreglado rellenando de blanco antes de recomprimir. Añadido un botón "Color/Blanco y negro" en la barra superior que aplica `grayscale` a toda la app.
3. **Exportación PNG/Word desincronizada con la pantalla** (commit `53c1288`): causa = carrera de carga de tipografías (Cinzel/PT Serif no terminaban de cargar antes de que html2canvas capturase); arreglado esperando `document.fonts.ready`. De paso se creó como unidad independiente el "Grupo de Apoyo" de Skaven (4 variantes por arma) sin tocar la mejora/unidad genérica ya existentes.
4. **Bug "Rendered more hooks" en el constructor de listas** (commit `e4e31e5`): hooks de React declarados después de un `return` condicional — regla de los Hooks violada. Arreglado moviéndolos arriba.
5. **Fidelidad visual exacta de la Ficha a CodexMaker + personajes sin cantidad/ordenados por coste + drag-and-drop** (commit `35b2aac`): la ronda más grande — CSS pixel-exacto (`.ficha-sheet` en `index.css`, 760px, Cinzel/PT Serif, etc.), una sola tabla de características en vez de una por perfil, personajes sin campo de cantidad, drag-and-drop en Editor > Unidades y en el constructor de listas.

### ⚠️ Aviso importante para quien continúe

Este entorno de trabajo (sandbox) **no tiene navegador con interfaz gráfica disponible** (no hay permisos de root para instalar las dependencias de sistema de Chromium/Playwright). Todo se ha verificado con `tsc -b` + `vite build` limpios y revisión manual del código, pero **nada de esto se ha podido probar interactivamente en un navegador real**. El usuario ha ido probando en persona y reportando bugs visuales/de exportación en rondas sucesivas — es muy probable que sigan apareciendo detalles así. Si el chat nuevo SÍ tiene acceso a un navegador (Claude in Chrome, computer use, etc.), sería el momento ideal para verificar visualmente en vez de seguir a ciegas.

### Pendiente (ver "## 8. Deuda conocida" en ARCHITECTURE.md para el texto completo y actualizado)

- `min_size`/`max_size`/`equipment_text`/`armor_save` sin rellenar en varias unidades (no vienen del origen).
- 3 unidades (Trebuchet, Carros de guerra, Centigors) con Ataques no numérico: la ficha del Campeón no lleva el +1 automático ahí.
- `faction_construction_rules` sin UI ni motor de validación (reglas de composición de ejército tipo "mínimo 1 Señor").
- "Grupos de Apoyo" (Skaven): coexisten ahora una ficha genérica (unidad independiente, sin mecanismo de "unidad adjunta a otra"), 4 mejoras clásicas, y 4 unidades nuevas por arma — pendiente decidir si conviene retirar la ficha genérica para no duplicar el concepto.
- Nada de la sección Fichas se ha verificado en navegador real (ver aviso de arriba).

## Cómo retomarlo

1. Pide que lean `webapp/ARCHITECTURE.md` entero antes de nada.
2. `git log --oneline` para ver el historial completo de commits (todo en español, descriptivo).
3. Si el usuario reporta un bug visual nuevo, recuerda el patrón que se ha repetido varias veces esta sesión: como no hay navegador de verificación, los bugs se han diagnosticado por lectura de código + razonamiento sobre CSS/html2canvas, no por prueba directa — hay que seguir con el mismo cuidado (o, mejor aún, usar un navegador real si está disponible en el nuevo entorno).
4. Antes de dar nada por terminado: `cd webapp && npx tsc -b && npm run build` debe salir limpio.
