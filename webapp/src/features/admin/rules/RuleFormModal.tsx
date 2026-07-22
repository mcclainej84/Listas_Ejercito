import { useState } from 'react'
import { RuleRepository } from '@/data/repositories/ruleRepository'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { TextArea } from '@/shared/ui/TextArea'
import type { SpecialRule } from '@/domain/types'

interface RuleFormModalProps {
  rule: SpecialRule | null
  onClose: () => void
  onSaved: () => void
}

export function RuleFormModal({ rule, onClose, onSaved }: RuleFormModalProps) {
  const [name, setName] = useState(rule?.name ?? '')
  const [description, setDescription] = useState(rule?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const input = { name: name.trim(), description: description.trim() }
      if (rule) {
        await RuleRepository.update(rule.id, input)
      } else {
        await RuleRepository.create(input)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={rule ? 'Editar regla especial' : 'Nueva regla especial'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <TextArea
          label="Descripción"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
