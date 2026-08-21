// ============================================================================
// Miniatura de un mapa para el listado.
//
// Se dibuja con las MISMAS piezas y a la misma escala que el editor, solo que
// pequeña: así la tarjeta enseña la mesa de verdad y no una ilustración
// genérica. Con seis mapas guardados, la forma del terreno es lo que se
// reconoce; el nombre solo lo confirma.
//
// Carga el detalle por su cuenta (el listado solo trae el recuento de piezas)
// y aguanta perfectamente que falle: se queda el tablero vacío con su
// retícula, que sigue diciendo el tamaño de la mesa.
// ============================================================================
import { MapRepository } from '@/data/repositories/mapRepository'
import { FloorAssetRepository } from '@/data/repositories/sceneryAssetRepository'
import { RETICULA_CM } from '@/domain/deployment'
import { useAsync } from '@/shared/hooks/useAsync'
import { SceneryShape } from '@/features/maps/SceneryShape'
import { estiloDeSueloDeMapa } from '@/features/maps/tableSurface'

export function MapThumbnail({ mapaId, anchoCm, altoCm }: { mapaId: number; anchoCm: number; altoCm: number }) {
  const { data: mapa } = useAsync(() => MapRepository.getById(mapaId), [mapaId])
  // El suelo se pide por su id —la VERSIÓN con la que se guardó el mapa—, no
  // el vigente: la miniatura tiene que enseñar el mapa tal y como es.
  const { data: suelo } = useAsync(
    () => (mapa?.floorId ? FloorAssetRepository.getById(mapa.floorId) : Promise.resolve(null)),
    [mapa?.floorId],
  )

  return (
    <span
      className="relative block w-full overflow-hidden"
      style={{
        aspectRatio: `${anchoCm} / ${altoCm}`,
        ...estiloDeSueloDeMapa(mapa?.textura ?? 'ninguna', suelo ?? null, anchoCm, altoCm, mapa?.imageUrl ?? null),
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(125,121,95,.5) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(125,121,95,.5) 1px, transparent 1px)',
          backgroundSize: `${(RETICULA_CM / anchoCm) * 100}% ${(RETICULA_CM / altoCm) * 100}%`,
        }}
      />
      {(mapa?.piezas ?? []).map((pieza) => (
        <span
          key={pieza.id}
          className="absolute block -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${(pieza.xCm / anchoCm) * 100}%`,
            top: `${(pieza.yCm / altoCm) * 100}%`,
            width: `${(pieza.anchoCm / anchoCm) * 100}%`,
            height: `${(pieza.altoCm / altoCm) * 100}%`,
            transform: `translate(-50%, -50%) rotate(${pieza.rotacion}deg)`,
          }}
        >
          <SceneryShape kind={pieza.kind} imagenUrl={pieza.imageUrl} className="h-full w-full" />
        </span>
      ))}
    </span>
  )
}
