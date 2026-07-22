// ============================================================================
// Facción favorita del usuario actual (ver users.favorite_faction_id),
// reactiva a los cambios de sesión. Se usa para PRESELECCIONAR una facción
// en las pantallas con selector — Hojas de Unidad, Editor > Unidades y
// Ejércitos > Nueva lista — en vez de caer siempre en "la primera de la
// lista", que no tiene ningún significado para el jugador.
// ============================================================================
import { useEffect, useState } from 'react'
import { UserRepository } from '@/data/repositories/userRepository'
import { useSession } from '@/shared/session/useSession'

export function useFavoriteFactionId(): number | null {
  const { user } = useSession()
  const [favoriteId, setFavoriteId] = useState<number | null>(null)

  useEffect(() => {
    if (!user) {
      setFavoriteId(null)
      return
    }
    let cancelled = false
    void UserRepository.getFavoriteFactionId(user.id).then((id) => {
      if (!cancelled) setFavoriteId(id)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  return favoriteId
}
