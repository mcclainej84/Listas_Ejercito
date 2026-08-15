# Reglas de trabajo en WHArmy

Notas para quien (o lo que) toque este repositorio. Son acuerdos tomados con el
usuario, no preferencias de estilo.

## Versión y fecha: en CADA cambio, y sacadas del reloj

Cualquier cambio que se vea en el programa —una función nueva, un arreglo, un
retoque visual— lleva, en el mismo cambio:

1. **Subir `APP_VERSION`** en `webapp/src/version.ts`. El número tras el punto es
   un contador: 0.109 → 0.110 → 0.111. No vuelca a 1.0 salvo que se pida.
2. **Actualizar `APP_VERSION_DATE`** con la hora REAL de España, leída del
   sistema:

   ```sh
   TZ=Europe/Madrid date '+%Y-%m-%dT%H:%M'
   ```

3. **Anotarlo en `CHANGELOG.md`**, con esa misma fecha y hora.

**Nunca se escribe la fecha de memoria.** Se hizo durante un tiempo y el pie de
página acabó diciendo el día anterior y horas que no habían existido, que es
justo lo contrario de para lo que sirve ese dato: saber de un vistazo si lo que
se está viendo es lo último o una copia vieja en la caché del navegador.

Si un cambio no se ve en el programa (solo comentarios, un script de
mantenimiento), no hace falta subir la versión.

## Esquema de base de datos

Tocar el esquema son SIEMPRE cinco sitios, y saltarse uno rompe la aplicación de
formas raras (ver la cabecera de `schemaHealth.ts`):

1. `webapp/worker/src/index.ts` → `MIGRATIONS`
2. `webapp/db/schema.sql`
3. `SNAPSHOT_TABLES` (Worker) y `CATALOG_TABLES` (`localCatalog.ts`), si es una
   tabla de catálogo
4. Una sonda en `webapp/src/data/repositories/schemaHealth.ts`
5. Aplicarlo en la D1 de verdad

Y después hace falta `npx wrangler deploy` en `webapp/worker`: mientras no se
haga, el frontend nuevo habla con un Worker viejo.

## Formato del código

Prettier no tiene configuración en el repositorio, así que se le pasan las
opciones a mano o reformatea medio proyecto a otro estilo:

```sh
npx prettier --no-semi --single-quote --print-width 120 --trailing-comma all --write <archivos>
```

Antes de dar algo por terminado: `npx tsc -b --force`, `npx oxlint`,
`npx vite build`, y `npx tsc --noEmit` dentro de `worker/`.

## Idioma

Todo en español: los comentarios, los nombres de las cosas del dominio
(`piezas`, `mesa`, `peana`), los mensajes de la interfaz y los de commit.
