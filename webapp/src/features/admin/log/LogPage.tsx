// ============================================================================
// "Log" — qué se ha tocado, quién y cuándo.
//
// Dos pestañas, porque son dos cosas distintas y mezclarlas confundiría:
//   · Datos    — ediciones del catálogo hechas desde el Editor por vosotros
//                (ver change_log / changeLogRepository).
//   · Programa — versiones de la propia aplicación, leídas del CHANGELOG.
//
// A propósito NO registra Fichas ni Ejércitos: son trabajo personal de cada
// usuario, no catálogo compartido, y su ruido taparía lo que sí interesa.
// ============================================================================
import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import {
  ChangeLogRepository,
  ACTION_LABELS,
  ENTITY_LABELS,
  type ChangeLogAction,
  type ChangeLogEntity,
} from '@/data/repositories/changeLogRepository'
import { parseChangelog } from '@/features/admin/log/changelog'
import { MigrateImagesPanel } from '@/features/admin/maintenance/MigrateImagesPanel'
import { useAsync } from '@/shared/hooks/useAsync'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Select } from '@/shared/ui/Select'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState'

type Tab = 'datos' | 'programa' | 'mantenimiento'

const PAGE_SIZE = 200

const ACTION_TONES: Record<ChangeLogAction, string> = {
  crear: 'border-success/40 bg-success/10 text-success',
  editar: 'border-bronze/40 bg-bronze/10 text-bronze',
  borrar: 'border-danger/40 bg-danger/10 text-danger',
}

/** "20/07/2026 21:55" en hora local, desde el ISO en UTC que se guarda. */
function formatStamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** Encabezado de día ("hoy", "ayer" o la fecha) para agrupar las entradas. */
function dayLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const today = new Date()
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (isSameDay(date, today)) return 'Hoy'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (isSameDay(date, yesterday)) return 'Ayer'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

export function LogPage() {
  const [tab, setTab] = useState<Tab>('datos')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [user, setUser] = useState<string>('')
  const [entity, setEntity] = useState<string>('')

  const { data: entries, loading } = useAsync(() => ChangeLogRepository.list(limit), [limit])
  const { data: total } = useAsync(() => ChangeLogRepository.count())
  const releases = useMemo(() => parseChangelog(), [])

  // Los desplegables se llenan con lo que de verdad hay en el registro, para
  // no ofrecer filtros que no devuelven nada.
  const usernames = useMemo(
    () => Array.from(new Set((entries ?? []).map((e) => e.username))).sort((a, b) => a.localeCompare(b, 'es')),
    [entries],
  )

  const shown = useMemo(
    () => (entries ?? []).filter((e) => (!user || e.username === user) && (!entity || e.entity === entity)),
    [entries, user, entity],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, typeof shown>()
    for (const e of shown) {
      const key = dayLabel(e.createdAt)
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return Array.from(map.entries())
  }, [shown])

  return (
    <div>
      <PageHeader
        title="Log"
        description="Cambios hechos en el Editor: quién tocó qué y cuándo. No registra Hojas de Unidad ni Ejércitos, que son trabajo personal de cada usuario."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          {(
            [
              ['datos', 'Datos'],
              ['programa', 'Programa'],
              ['mantenimiento', 'Mantenimiento'],
            ] as Array<[Tab, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={clsx(
                'rounded-sm px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors',
                tab === value
                  ? 'bg-maroon text-parchment'
                  : 'border border-rule-dark/40 bg-parchment text-ink-soft hover:bg-parchment-dark',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'datos' && (
          <>
            <div className="w-44">
              <Select label="Usuario" value={user} onChange={(e) => setUser(e.target.value)}>
                <option value="">Todos</option>
                {usernames.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-52">
              <Select label="Tipo" value={entity} onChange={(e) => setEntity(e.target.value)}>
                <option value="">Todo</option>
                {(Object.keys(ENTITY_LABELS) as ChangeLogEntity[]).map((key) => (
                  <option key={key} value={key}>
                    {ENTITY_LABELS[key]}
                  </option>
                ))}
              </Select>
            </div>
          </>
        )}
      </div>

      {tab === 'datos' && (
        <>
          {loading && <Spinner />}

          {!loading && shown.length === 0 && (
            <EmptyState
              title="Todavía no hay cambios registrados"
              description="Aquí irán apareciendo las ediciones del catálogo: facciones, unidades, reglas, equipo, monturas y carros."
            />
          )}

          {!loading && shown.length > 0 && (
            <div className="space-y-5">
              {grouped.map(([day, dayEntries]) => (
                <div key={day}>
                  <p className="mb-2 text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">{day}</p>
                  <div className="divide-y divide-rule-dark/20 overflow-hidden rounded-sm border border-rule-dark/40 bg-parchment/70">
                    {dayEntries.map((e) => (
                      <div key={e.id} className="flex items-baseline gap-3 px-4 py-2.5">
                        <span className="w-12 shrink-0 text-mini text-ink-soft tabular-nums">
                          {formatStamp(e.createdAt).slice(-5)}
                        </span>
                        <span
                          className={clsx(
                            'shrink-0 rounded-full border px-2 py-0.5 text-micro font-medium',
                            ACTION_TONES[e.action],
                          )}
                        >
                          {ACTION_LABELS[e.action]}
                        </span>
                        <span className="min-w-0 flex-1 text-sm text-ink">{e.description}</span>
                        <span className="shrink-0 text-xs font-medium text-ink-soft">{e.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Solo se ofrece cargar más si de verdad queda algo por traer. */}
              {total != null && (entries ?? []).length < total && (
                <div className="flex justify-center">
                  <Button variant="ghost" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                    Cargar más ({(entries ?? []).length} de {total})
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'programa' && (
        <div className="space-y-4">
          <p className="text-xs text-ink-soft">
            Versiones de la aplicación. Estos son cambios de <b>programa</b>, no de datos: no tocan el catálogo, por eso
            van aparte. Salen del CHANGELOG del repositorio.
          </p>
          {releases.map((release) => (
            <div key={release.version} className="rounded-sm border border-rule-dark/40 bg-parchment/70 p-4">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-display text-lg font-bold text-maroon">v{release.version}</span>
                <span className="text-mini text-ink-soft">{release.date}</span>
              </div>
              <div className="my-2 h-px bg-rule-dark/35" />
              <ul className="space-y-1.5">
                {release.changes.map((change, i) => (
                  <li key={i} className="text-xs leading-relaxed text-ink-soft">
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === 'mantenimiento' && (
        <div className="space-y-4">
          <p className="text-xs text-ink-soft">
            Operaciones de una sola vez sobre los datos. No se ejecutan solas al abrir la aplicación: mueven información
            y conviene lanzarlas a conciencia.
          </p>
          <MigrateImagesPanel />
        </div>
      )}
    </div>
  )
}
