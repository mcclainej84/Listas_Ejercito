// ============================================================================
// El emblema de un EJÉRCITO.
//
// Un emblema de facción es del catálogo: lo comparte todo el que juegue esa
// facción, y cambiarlo se lo cambia a todos. El de un ejército es exactamente
// lo contrario: pertenece a UNA lista y a nadie más. Existe para el caso raro
// —la hueste de un señor concreto, un contingente con su propia enseña— y por
// eso su valor por defecto no es "ninguno" sino "el de mi facción": en la
// inmensa mayoría de los ejércitos nadie va a tocar esto nunca, y lo que se ve
// tiene que ser lo correcto sin que nadie lo elija.
//
// De ahí las dos columnas a null por defecto. Null no es "sin emblema", es
// "el de la facción de la lista".
// ============================================================================
import { imageUrl } from '@/data/network/images'
import type { Faction } from '@/domain/types'

/** Lo que hace falta de una lista para saber qué emblema le toca. */
export interface EmblemaDeLista {
  factionId: number
  emblemFactionId: number | null
  emblemKey: string | null
}

/**
 * La URL del emblema que le corresponde a esta lista, con el orden de
 * preferencia: imagen propia → emblema de otra facción → el de su facción.
 *
 * `facciones` es el catálogo ya cargado (es local, no cuesta una consulta). Si
 * la facción elegida ya no está —se borró, o no la ve este usuario—, se cae a
 * la propia en vez de dejar el hueco: un emblema que desaparece por un motivo
 * que el usuario no puede ver es peor que uno que no es el que eligió.
 */
export function urlDelEmblemaDeLista(lista: EmblemaDeLista, facciones: Faction[]): string | null {
  if (lista.emblemKey) return imageUrl(lista.emblemKey)
  const propia = facciones.find((f) => f.id === lista.factionId) ?? null
  if (lista.emblemFactionId != null) {
    const elegida = facciones.find((f) => f.id === lista.emblemFactionId)
    if (elegida?.emblemUrl) return elegida.emblemUrl
  }
  return propia?.emblemUrl ?? null
}

/** ¿Esta lista usa el emblema de su propia facción, sin más? */
export function usaElEmblemaDeSuFaccion(lista: EmblemaDeLista): boolean {
  return lista.emblemKey == null && lista.emblemFactionId == null
}
