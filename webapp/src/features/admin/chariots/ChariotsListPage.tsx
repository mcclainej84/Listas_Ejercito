import { ChariotRepository } from '@/data/repositories/profileCatalogRepository'
import { ProfileCatalogListPage } from '@/features/admin/profiles/ProfileCatalogListPage'

export function ChariotsListPage() {
  return (
    <ProfileCatalogListPage
      title="Carros"
      description="Hojas de carro reutilizables. Una unidad solo puede añadir a la suya los carros asociados a su propia facción."
      newLabel="Nuevo carro"
      repository={ChariotRepository}
    />
  )
}
