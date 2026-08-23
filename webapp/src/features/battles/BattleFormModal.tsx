// ============================================================================
// Alta de una batalla: un nombre y dos ejércitos. SOLO alta — una batalla, una
// vez creada, no se edita.
//
// POR QUÉ NO SE EDITA. Una batalla es el acta de una partida: quién trae qué y
// dónde lo pone, acordado entre dos. Cambiarle un ejército después es cambiar
// contra quién se juega sin que el otro se entere, y el nombre es lo único que
// quedaría por tocar en una pantalla entera. Lo que sí se puede es finalizarla
// entre los dos y borrarla; entonces se monta otra. Es lo mismo que ya pasaba
// dentro de la batalla (ver BattlePage, "acta cerrada"), llevado a su listado.
//
// QUÉ EJÉRCITOS SE OFRECEN. Todos los COMPLETADOS del grupo, sean de quien
// sean. Completados, porque una batalla no guarda copia de nada —enseña las
// listas tal y como están— y eso solo se sostiene si ya no pueden cambiar.
//
// Y DE CUALQUIERA, SIN TENER QUE COMPARTIR NADA. Antes solo salían los tuyos y
// los que alguien te hubiera compartido, y eso hacía que montar la partida del
// sábado necesitara dos personas y tres pasos: que el rival se acordara de
// compartirte su ejército, que tú te enteraras, y solo entonces crear la
// batalla. El ejército del rival te lo vas a encontrar delante en la mesa de
// todas formas; lo que aquí se ve para elegirlo es su nombre, su facción, su
// lado y de quién es.
//
// DOS COMPROBACIONES, Y SON DISTINTAS ENTRE SÍ:
//
//   · MESAS DISTINTAS → no se deja crear. Una batalla ocurre en un sitio. Con
//     dos mesas o dos mapas distintos no hay forma honesta de enfrentar los
//     despliegues: habría que estirar uno, recortarlo o inventarse el terreno
//     que falta. Se dice en qué se diferencian y se para ahí.
//
//   · A UN EJÉRCITO LE FALTA EL DESPLIEGUE → se avisa y se pregunta. Eso no
//     rompe nada: la batalla se puede crear igual y ese bando saldrá sin peanas
//     sobre la mesa. Es un descuido muy fácil de cometer —desplegar uno y
//     olvidarse del otro— y muy fácil de arreglar, así que lo que hace falta es
//     enterarse a tiempo, no que el programa decida por ti.
// ============================================================================
import { useEffect, useState } from 'react'
import { ArmyListRepository, type ArmyListSummary } from '@/data/repositories/armyListRepository'
import { BattleRepository } from '@/data/repositories/battleRepository'
import { motivoDeEscenarioDistinto, motivoDeLadoRepetido, nombreDelLado } from '@/domain/battle'
import { useAsync } from '@/shared/hooks/useAsync'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { Spinner } from '@/shared/ui/Spinner'
import { TextField } from '@/shared/ui/TextField'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { WarningIcon } from '@/shared/ui/icons'

interface BattleFormModalProps {
  userId: number
  onClose: () => void
  onSaved: () => void
}

export function BattleFormModal({ userId, onClose, onSaved }: BattleFormModalProps) {
  const { data: elegibles, loading } = useAsync(() => ArmyListRepository.listCompletadas(userId), [userId])
  // Cuántas peanas tiene desplegada cada candidata, para poder avisar. Se piden
  // todas de una vez (ver contarDespliegues).
  const { data: despliegues } = useAsync(
    () => ArmyListRepository.contarDespliegues((elegibles ?? []).map((l) => l.id)),
    [elegibles],
  )

  const [name, setName] = useState('')
  const [aId, setAId] = useState<number | null>(null)
  const [bId, setBId] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmarSinDespliegue, setConfirmarSinDespliegue] = useState<string | null>(null)

  // Al elegir el primer ejército se propone un nombre, si no se ha escrito uno.
  // Es el rótulo que uno pondría de todas formas y evita el "Batalla 1".
  const lista = elegibles ?? []
  const a = lista.find((l) => l.id === aId) ?? null
  const b = lista.find((l) => l.id === bId) ?? null
  useEffect(() => {
    if (name.trim() !== '' || !a || !b) return
    setName(`${a.factionName} contra ${b.factionName}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id, b?.id])

  const mismoEjercito = aId != null && aId === bId
  const motivoEscenario = a && b && !mismoEjercito ? motivoDeEscenarioDistinto(a, b) : null
  const motivoLado = a && b && !mismoEjercito ? motivoDeLadoRepetido(a.deploymentSide, b.deploymentSide) : null

  /**
   * "Sin dato todavía" NO es "sin despliegue". Mientras el recuento no ha
   * llegado —o si su consulta falla— no se avisa: avisar de algo que no se sabe
   * es peor que no avisar, porque el aviso se lee como un hecho comprobado.
   */
  function sinDespliegue(l: ArmyListSummary | null): boolean {
    if (l == null || despliegues == null) return false
    return (despliegues.get(l.id) ?? 0) === 0
  }
  const faltanDespliegues = [a, b].filter(sinDespliegue) as ArmyListSummary[]

  const puedeGuardar =
    name.trim().length > 0 &&
    a != null &&
    b != null &&
    !mismoEjercito &&
    motivoEscenario == null &&
    motivoLado == null &&
    !guardando

  async function guardar() {
    if (!puedeGuardar || !a || !b) return
    setGuardando(true)
    setError(null)
    try {
      await BattleRepository.create({ name, armyListAId: a.id, armyListBId: b.id }, userId)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setGuardando(false)
    }
  }

  /** Antes de guardar, si falta algún despliegue se pregunta. Ver la cabecera. */
  function intentarGuardar() {
    if (!puedeGuardar) return
    if (faltanDespliegues.length > 0) {
      setConfirmarSinDespliegue(
        faltanDespliegues.length === 1
          ? `"${faltanDespliegues[0].name}" no tiene despliegue creado: en la batalla saldrá sin ninguna unidad sobre la mesa. Puedes crearlo antes en su pantalla de Despliegue. ¿Continúas de todas formas?`
          : `Ninguno de los dos ejércitos tiene despliegue creado: la mesa de la batalla saldrá vacía. Puedes crearlos antes en su pantalla de Despliegue. ¿Continúas de todas formas?`,
      )
      return
    }
    void guardar()
  }

  return (
    <>
      <Modal
        title="Nueva batalla"
        onClose={onClose}
        widthClassName="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={guardando}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={intentarGuardar} disabled={!puedeGuardar}>
              {guardando ? 'Creando…' : 'Crear batalla'}
            </Button>
          </>
        }
      >
        {loading ? (
          <Spinner />
        ) : lista.length < 2 ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            Hacen falta al menos dos ejércitos <b className="text-ink">completados</b> para montar una batalla, y
            todavía no hay dos en todo el grupo. Marca como completados los que vayan a jugar, en el listado de
            Ejércitos, y vuelve.
          </p>
        ) : (
          <div className="space-y-3">
            <TextField label="Nombre de la batalla" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

            <Select label="Primer ejército" value={aId ?? ''} onChange={(e) => setAId(Number(e.target.value) || null)}>
              <option value="">Elige un ejército…</option>
              {lista.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {l.factionName} · {nombreDelLado(l.deploymentSide)}
                  {l.shared && l.ownerName ? ` (de ${l.ownerName})` : ''}
                </option>
              ))}
            </Select>

            <Select label="Segundo ejército" value={bId ?? ''} onChange={(e) => setBId(Number(e.target.value) || null)}>
              <option value="">Elige un ejército…</option>
              {lista.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {l.factionName} · {nombreDelLado(l.deploymentSide)}
                  {l.shared && l.ownerName ? ` (de ${l.ownerName})` : ''}
                </option>
              ))}
            </Select>

            {mismoEjercito && <p className="text-sm text-danger">Un ejército no puede pelear contra sí mismo.</p>}

            {motivoLado && (
              <p className="rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-ink">
                <b className="text-danger">No se pueden enfrentar:</b> {motivoLado}. Dos ejércitos en el mismo borde no
                se están enfrentando, están amontonados en el mismo sitio. Cambia el lado de uno de los dos en su
                pantalla de Despliegue.
              </p>
            )}

            {motivoEscenario && (
              <p className="rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-ink">
                <b className="text-danger">No se pueden enfrentar:</b> {motivoEscenario}. Una batalla ocurre en un
                sitio, así que los dos ejércitos tienen que desplegar sobre la misma mesa. Cambia el mapa de uno de
                ellos en su pantalla de Despliegue.
              </p>
            )}

            {!motivoEscenario && faltanDespliegues.length > 0 && (
              <p className="flex items-start gap-2 rounded-sm border border-bronze/50 bg-bronze/10 px-3 py-2 text-xs leading-relaxed text-ink">
                <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-bronze" />
                <span>
                  {faltanDespliegues.length === 1 ? (
                    <>
                      <b>{faltanDespliegues[0].name}</b> no tiene despliegue creado: saldrá sin unidades sobre la mesa.
                    </>
                  ) : (
                    <>Ninguno de los dos tiene despliegue creado: la mesa saldrá vacía.</>
                  )}{' '}
                  Se puede crear la batalla igualmente.
                </span>
              </p>
            )}

            <p className="text-mini leading-relaxed text-ink-soft/80">
              Salen todos los ejércitos <b className="text-ink">completados</b> del grupo, sean de quien sean: no hace
              falta que nadie te comparta nada. Mientras estén en una batalla no se podrán reabrir, porque lo que la
              batalla enseña no puede cambiar a espaldas de los dos jugadores. Por lo mismo,{' '}
              <b className="text-ink">una batalla creada ya no se edita</b>: repasa el nombre y los dos ejércitos antes
              de crearla.
            </p>

            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        )}
      </Modal>

      {confirmarSinDespliegue && (
        <ConfirmDialog
          title="Falta un despliegue"
          message={confirmarSinDespliegue}
          confirmLabel="Crear igualmente"
          danger={false}
          onCancel={() => setConfirmarSinDespliegue(null)}
          onConfirm={async () => {
            setConfirmarSinDespliegue(null)
            await guardar()
          }}
        />
      )}
    </>
  )
}
