// ============================================================================
// Facciones que debe ver el usuario actual: todas menos las que haya ocultado
// en "Mis facciones". En modo administrador se ven SIEMPRE todas (así el
// filtro personal nunca esconde datos mientras se edita el catálogo).
//
// Se aplica en Fichas y Ejércitos, que son las pantallas de uso diario; las de
// edición son de administrador y por tanto muestran todo.
// ============================================================================
import { useEffect, useState } from 'react'
import { FactionRepository } from '@/data/repositories/factionRepository'
import { UserRepository } from '@/data/repositories/userRepository'
import { useSession } from '@/shared/session/useSession'
import type { Faction } from '@/domain/types'

export function useVisibleFactions(): { factions: Faction[]; loading: boolean; reload: () => void } {
  const { user, actingAsAdmin } = useSession()
  const [factions, setFactions] = useState<Faction[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      const all = await FactionRepository.listAll()
      let result = all
      if (user && !actingAsAdmin) {
        const hidden = new Set(await UserRepository.getHiddenFactionIds(user.id))
        result = all.filter((f) => !hidden.has(f.id))
      }
      if (!cancelled) {
        setFactions(result)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, actingAsAdmin, tick])

  return { factions, loading, reload: () => setTick((t) => t + 1) }
}
