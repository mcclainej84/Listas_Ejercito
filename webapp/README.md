# WHArmy

Gestor de listas de ejército para Warhammer: tablas maestras (facciones, unidades, personajes, reglas, equipo), generador de fichas y constructor de listas, todo alimentado por un único modelo de datos.

App 100% estática (React + SQLite embebido vía sql.js), pensada para desplegarse en GitHub Pages sin backend propio. Ver [`ARCHITECTURE.md`](./ARCHITECTURE.md) para el porqué de cada decisión técnica.

## Requisitos

- Node.js 20+
- Python 3 (solo para regenerar la base de datos desde el origen; no hace falta para desarrollar o desplegar la app)

## Puesta en marcha

```bash
cd webapp
npm install
npm run dev
```

Abre `http://localhost:5173`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Compila TypeScript y genera `dist/` (listo para publicar) |
| `npm run preview` | Sirve `dist/` localmente, para comprobar el build de producción |
| `npm run etl` | Regenera `public/data/warhammer.db` a partir de `../HojaEjercito/datos.json` |
| `npm run lint` | Linter (oxlint) |

## Regenerar los datos maestros

`public/data/warhammer.db` es la única base de datos que usa la app y **se genera siempre** con:

```bash
npm run etl
```

Nunca se edita ese `.db` a mano. Si hace falta corregir algo del origen, se corrige en `scripts/etl_datos_json.py` (o, una vez la app esté en marcha, directamente desde el módulo de Administración) y se vuelve a ejecutar el comando.

## Estado actual del proyecto

- ✅ Modelo de datos relacional + importación completa desde `datos.json` (22 facciones, 439 unidades, 354 reglas especiales, equipo, monturas, carros, grupo de mando).
- ✅ Administración: Facciones (alta/edición/borrado), Reglas especiales (alta/edición/borrado, con aviso de uso antes de borrar), Unidades y personajes (listado por facción, ficha de edición con atributos, reglas, equipo y mejoras, restricciones de tamaño/unicidad/obligatoriedad).
- ✅ Buscador global de unidades y reglas, disponible en toda la app.
- 🚧 Fichas (generador visual) — próxima fase.
- 🚧 Ejércitos (constructor de listas, validación en tiempo real, exportación a PDF) — próxima fase.

## Despliegue en GitHub Pages

El workflow en `.github/workflows/deploy.yml` compila `webapp/` y publica `webapp/dist` en GitHub Pages automáticamente en cada push a `main` que toque la carpeta `webapp/`. Solo hace falta activar GitHub Pages en el repositorio (Settings → Pages → Source: GitHub Actions) una vez.

Para probar el build de producción en local antes de hacer push:

```bash
npm run build && npm run preview
```
