// ============================================================================
// Workaround para html2canvas 1.4.1 + Tailwind v4: html2canvas no sabe
// interpretar las funciones de color modernas que genera Tailwind v4
// (oklch(...) de la paleta por defecto, color-mix(...) de los modificadores
// de opacidad tipo `/40`) y aborta la captura entera al toparse con una — es
// justo lo que rompía la exportación a PNG. CodexMaker no tenía este
// problema porque su CSS está escrito a mano con hex/rgba planos.
//
// El navegador SÍ resuelve esas funciones al color final concreto en cuanto
// pinta la página real, así que `getComputedStyle()` del elemento original
// siempre devuelve ese valor ya resuelto (normalmente en rgb()/rgba()),
// nunca la función sin resolver. Aquí se copia ese valor como estilo INLINE
// sobre el nodo CLONADO que arma html2canvas en su `onclone` (mayor
// especificidad que cualquier clase de Tailwind), para que su parser de CSS
// nunca llegue a ver oklch()/color-mix().
// ============================================================================

const COLOR_PROPS = [
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'textDecorationColor',
  'boxShadow',
] as const

function kebabCase(prop: string): string {
  return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

/** `sourceRoot` es el nodo real ya pintado en pantalla; `clonedRoot` es el nodo que html2canvas va a rasterizar (el segundo argumento de su callback `onclone`). */
export function copyResolvedColors(sourceRoot: HTMLElement, clonedRoot: HTMLElement): void {
  const sourceNodes = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll<HTMLElement>('*'))]
  const clonedNodes = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll<HTMLElement>('*'))]
  const len = Math.min(sourceNodes.length, clonedNodes.length)
  for (let i = 0; i < len; i++) {
    const computed = window.getComputedStyle(sourceNodes[i])
    for (const prop of COLOR_PROPS) {
      const value = computed.getPropertyValue(kebabCase(prop))
      if (value) clonedNodes[i].style.setProperty(kebabCase(prop), value)
    }
  }
}
