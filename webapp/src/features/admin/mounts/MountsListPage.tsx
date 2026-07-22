import { MountRepository } from '@/data/repositories/profileCatalogRepository'
import { ProfileCatalogListPage } from '@/features/admin/profiles/ProfileCatalogListPage'

export function MountsListPage() {
  return (
    <ProfileCatalogListPage
      title="Montura/Dotación"
      description="Hojas de montura o dotación reutilizables. Una unidad solo puede añadir a la suya las asociadas a su propia facción. Los monstruos pueden llevar además sus propias reglas especiales, que se suman a las de quien los monte."
      newLabel="Nueva montura/dotación"
      repository={MountRepository}
      showEquippableByCharacter
      showIncludeInSheets
      showSpecialRules
    />
  )
}
