// ============================================================================
// Tabla de las 9 características de un perfil de atributos (M, HA, HP, F, R,
// H, I, A, L). Un único componente compartido para las tres pantallas que
// necesitan mostrarla: la ficha de una unidad (perfil base, montura, carro,
// Campeón) y los catálogos de Administración > Monturas/Carros — antes cada
// una tenía su propia versión (o, en el caso de los catálogos, una simple
// línea de texto), lo que hacía que la misma ficha se viera distinta según
// dónde se mirara.
// ============================================================================
import type { AttributeProfile, AttributeProfileInput } from '@/domain/types'

export const ATTRIBUTE_LABELS: { key: 'm' | 'ha' | 'hp' | 'f' | 'r' | 'h' | 'i' | 'a' | 'l'; label: string }[] = [
  { key: 'm', label: 'M' },
  { key: 'ha', label: 'HA' },
  { key: 'hp', label: 'HP' },
  { key: 'f', label: 'F' },
  { key: 'r', label: 'R' },
  { key: 'h', label: 'H' },
  { key: 'i', label: 'I' },
  { key: 'a', label: 'A' },
  { key: 'l', label: 'L' },
]

/** null/undefined y '' (cadena vacía, como llegan algunos perfiles importados) cuentan igual como "sin dato". */
function displayValue(v: string | null | undefined): string {
  return v || '–'
}

/** Línea compacta "M8 HA4 HP3…" — para subtítulos en listas (p.ej. el buscador del RelationEditor). */
export function profileStatLine(profile: AttributeProfile): string {
  return ATTRIBUTE_LABELS.map(({ key, label }) => `${label}${displayValue(profile[key])}`).join(' ')
}

export function extractProfileInput(profile: AttributeProfile): AttributeProfileInput {
  return {
    m: profile.m, ha: profile.ha, hp: profile.hp, f: profile.f, r: profile.r,
    h: profile.h, i: profile.i, a: profile.a, l: profile.l,
  }
}

/**
 * Ficha en formato "cuadrícula" (una celda con borde por característica),
 * como en los libros de ejército reales — mismo tamaño y formato en
 * cualquier pantalla donde aparezca una ficha.
 */
export function AttributeTable({ profile }: { profile: AttributeProfile }) {
  return (
    <table className="w-full table-fixed border-collapse text-center text-xs">
      <thead>
        <tr>
          {ATTRIBUTE_LABELS.map(({ key, label }) => (
            <th key={key} className="border border-rule-dark/40 bg-parchment-dark/50 py-1 font-semibold text-ink-soft">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {ATTRIBUTE_LABELS.map(({ key }) => (
            <td key={key} className="border border-rule-dark/40 py-1 font-medium text-ink">
              {displayValue(profile[key])}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}

/**
 * Igual que AttributeTable pero editable — se usa para la ficha del Campeón
 * y para el perfil base de una unidad. Componente controlado: el estado
 * vive en el padre (borrador de la ficha) y no se persiste nada aquí — el
 * padre decide cuándo escribir de verdad (botón "Guardar cambios").
 */
export function EditableAttributeTable({
  value,
  onChange,
}: {
  value: AttributeProfileInput
  onChange: (input: AttributeProfileInput) => void
}) {
  return (
    <table className="w-full table-fixed border-collapse text-center text-xs">
      <thead>
        <tr>
          {ATTRIBUTE_LABELS.map(({ key, label }) => (
            <th key={key} className="border border-rule-dark/40 bg-parchment-dark/50 py-1 font-semibold text-ink-soft">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {ATTRIBUTE_LABELS.map(({ key }) => (
            <td key={key} className="border border-rule-dark/40 p-0">
              <input
                value={value[key] ?? ''}
                onChange={(e) => onChange({ ...value, [key]: e.target.value || null })}
                className="w-full bg-transparent py-1 text-center text-xs text-ink outline-none focus:bg-bronze/10"
              />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}
