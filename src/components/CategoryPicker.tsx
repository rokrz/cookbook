import { useState, type KeyboardEvent } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { store, type Category } from '../data'
import { errorMessage } from '../lib/errors'

interface Props {
  value: string[]
  categories: Category[]
  onChange: (ids: string[]) => void
  onCreated: (category: Category) => Promise<void> | void
}

// Escolha de categorias (várias por receita), com a opção de criar uma nova sem sair do formulário.
export default function CategoryPicker({ value, categories, onChange, onCreated }: Props) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function cancel() {
    setCreating(false)
    setName('')
    setError('')
  }

  async function create() {
    if (!name.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      // Se já existir uma com esse nome, ela é selecionada em vez de duplicar.
      const category = await store.ensureCategory(name)
      await onCreated(category)
      if (!value.includes(category.id)) onChange([...value, category.id])
      cancel()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // Enter cria a categoria sem enviar o formulário da receita.
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      create()
    } else if (e.key === 'Escape') {
      cancel()
    }
  }

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div className="category-picker">
      <div className="chips" role="group" aria-label="Categorias">
        {categories.map((c) => {
          const on = value.includes(c.id)
          return (
            <button key={c.id} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(c.id)}>
              {on && <Check size={14} aria-hidden />} {c.name}
            </button>
          )
        })}
        {!creating && (
          <button type="button" className="chip new" onClick={() => setCreating(true)}>
            <Plus size={14} aria-hidden /> Nova categoria
          </button>
        )}
      </div>
      {creating && (
        <div className="inline-form">
          <input
            autoFocus
            maxLength={80}
            placeholder="Nome da nova categoria"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onKey}
            aria-label="Nome da nova categoria"
          />
          <button type="button" className="primary icon-text" onClick={create} disabled={busy || !name.trim()}>
            <Check size={18} aria-hidden /> Criar
          </button>
          <button type="button" className="icon" onClick={cancel} title="Cancelar">
            <X size={18} />
          </button>
        </div>
      )}
      {error && <p className="form-error small" role="alert">{error}</p>}
    </div>
  )
}
