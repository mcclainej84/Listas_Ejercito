// ============================================================================
// Los apéndices de la unidad, DEBAJO de su hoja.
//
// Debajo y no dentro: la hoja de unidad es un formato cerrado —alto máximo fijo
// y lo que se sale se recorta— pensado para exportarse como imagen. Un apéndice
// puede ser media página de texto, así que metido dentro solo conseguiría que
// la hoja se cortara por la mitad. Va a continuación, con la misma tipografía,
// como las páginas de reglas que acompañan a una ficha.
//
// Se pinta solo si hay algo que pintar: una unidad sin apéndices no enseña ni
// el título, para no dejar un hueco vacío bajo cada hoja.
// ============================================================================
import { AppendixRepository } from '@/data/repositories/appendixRepository'
import { tieneTexto } from '@/shared/richText'
import { useAsync } from '@/shared/hooks/useAsync'
import { RichText } from '@/shared/ui/RichTextEditor'

export function SheetAppendices({ unitId, grayscale = false }: { unitId: number; grayscale?: boolean }) {
  // Los ids negativos son fichas sintéticas (opciones y monturas, ver
  // upgradeSheet): no son unidades y no tienen apéndices que buscar.
  const { data } = useAsync(() => (unitId > 0 ? AppendixRepository.listByUnit(unitId) : Promise.resolve([])), [unitId])

  const conTexto = (data ?? []).filter((a) => tieneTexto(a.bodyHtml))
  if (conTexto.length === 0) return null

  return (
    <div className={grayscale ? 'w-full grayscale' : 'w-full'}>
      {conTexto.map((apendice) => (
        <section
          key={apendice.id}
          className="mt-3 border border-rule-dark/40 bg-[#efe6cd] px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,.18)]"
        >
          <h3 className="mb-1.5 border-b border-rule-dark/30 pb-1 font-display text-sm tracking-wide text-ink">
            {apendice.title}
          </h3>
          <RichText html={apendice.bodyHtml} className="text-xs leading-relaxed text-ink" />
        </section>
      ))}
    </div>
  )
}
