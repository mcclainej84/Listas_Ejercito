import { ChariotRepository } from '@/data/repositories/profileCatalogRepository'
import { ProfileCatalogListPage } from '@/features/admin/profiles/ProfileCatalogListPage'

export function ChariotsListPage() {
  return (
    <ProfileCatalogListPage
      title="Carros"
      description="Hojas de carro reutilizables. Una unidad solo puede añadir a la suya los carros asociados a su propia facción. Los carros pueden llevar además sus propias reglas especiales, que se suman a las de la unidad que los lleve."
      newLabel="Nuevo carro"
      repository={ChariotRepository}
      showSpecialRules
    />
  )
}
