// ============================================================================
// Ficha emergente de una entrada, para el orden de batalla del Despliegue.
//
// POR QUÉ EXISTE. En la lista solo se ven el nombre y cuántas miniaturas son:
// con veinte unidades, cualquier otra cosa la convierte en un muro de texto
// que no se puede recorrer con la vista. Pero al colocar hace falta saber QUÉ
// LLEVA cada una, así que ese detalle se guarda aquí y sale al pasar el ratón.
//
// SOLO LO QUE SE ELIGE AL MONTAR LA LISTA: equipo, montura, grupo de mando y
// opciones de unidad. Fuera el perfil, las reglas especiales y los puntos —eso
// no cambia al desplegar y está en el ejército y en las hojas—; aquí lo que se
// necesita es distinguir dos regimientos que se llaman igual.
//
// Va sobre pergamino y no sobre el globo oscuro del Tooltip: un bloque grande
// de texto en negativo cansa y desentona con el resto del programa.
// ============================================================================
import type { ArmyListEntry } from '@/domain/types'

/** Una fila del detalle: rótulo en versalita a la izquierda y su contenido. Nada si está vacía. */
function Fila({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  if (children == null || children === '' || children === false) return null
  return (
    <div className="flex gap-2 px-3 py-1.5">
      <span className="w-16 shrink-0 pt-px text-[9px] font-semibold tracking-[0.12em] text-ink-soft/80 uppercase">
        {titulo}
      </span>
      <span className="min-w-0 flex-1 text-xs leading-snug text-ink">{children}</span>
    </div>
  )
}

export function EntryDetailCard({ entry }: { entry: ArmyListEntry }) {
  const unit = entry.unit
  const equipo = unit.equipmentOptions.filter((e) => entry.equipmentIds.includes(e.id)).map((e) => e.name)
  const opciones = unit.upgradeOptions.filter((u) => entry.upgradeIds.includes(u.id)).map((u) => u.name)
  const montura = entry.mountProfileId ? unit.profiles.montura.find((p) => p.id === entry.mountProfileId) : null
  const carro = entry.chariotProfileId ? unit.profiles.carro.find((p) => p.id === entry.chariotProfileId) : null
  const cabalgadura = [montura?.name, carro?.name].filter(Boolean).join(' · ')
  const mando = [
    entry.hasStandardBearer && 'portaestandarte',
    entry.hasMusician && 'músico',
    entry.hasChampion && 'campeón',
  ].filter(Boolean)

  return (
    <span className="block text-left">
      {/* Cabecera con el emblema de la facción: el mismo que lleva la peana en
          la mesa, para atar de un vistazo la ficha con lo que hay puesto. */}
      <span className="flex items-center gap-2 border-b border-rule-dark/30 bg-parchment-dark/60 px-3 py-2">
        {unit.faction.emblemUrl && (
          <img src={unit.faction.emblemUrl} alt="" className="h-7 w-7 shrink-0 rounded-[2px] object-cover" />
        )}
        <span className="min-w-0">
          <span className="block font-display text-lg leading-tight text-maroon">{entry.alias ?? unit.name}</span>
          <span className="block text-[10px] leading-tight text-ink-soft">
            {entry.alias ? `${unit.name} · ` : ''}
            {unit.faction.name}
            {entry.quantity > 1 && ` · ${entry.quantity} miniaturas`}
          </span>
        </span>
      </span>

      <span className="block divide-y divide-rule-dark/15">
        <Fila titulo="Equipo">{[unit.equipmentText, ...equipo].filter(Boolean).join(', ') || null}</Fila>
        <Fila titulo="Montura">{cabalgadura || null}</Fila>
        <Fila titulo="Mando">{mando.join(', ') || null}</Fila>
        <Fila titulo="Opciones">{opciones.join(', ') || null}</Fila>
      </span>
    </span>
  )
}
