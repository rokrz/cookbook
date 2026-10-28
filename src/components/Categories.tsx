import { useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { categoriesCol, currentUserId, pb, SUGGESTED_CATEGORIES, type Category } from '../lib/pb'
import { errorMessage } from '../lib/errors'

interface Props {
  categories: Category[]
  onChanged: () => Promise<void>
}

export default function Categories({ categories, onChanged }: Props) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      await onChanged()
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (await run(() => categoriesCol().create({ user: currentUserId(), name: trimmed }))) setName('')
  }

  async function rename(e: FormEvent) {
    e.preventDefault()
    if (!editing?.name.trim()) return
    const { id, name: newName } = editing
    if (await run(() => categoriesCol().update(id, { name: newName.trim() }))) setEditing(null)
  }

  function remove(c: Category) {
    if (!window.confirm(`Excluir a categoria "${c.name}"? As receitas dela ficam sem categoria.`)) return
    run(() => categoriesCol().delete(c.id))
  }

  // Cria em lote só as sugeridas que ainda não existem (sem diferenciar maiúsculas).
  function addSuggested() {
    const existing = new Set(categories.map((c) => c.name.toLocaleLowerCase('pt-BR')))
    const missing = SUGGESTED_CATEGORIES.filter((n) => !existing.has(n.toLocaleLowerCase('pt-BR')))
    if (!missing.length) return setError('Todas as categorias sugeridas já existem.')
    run(async () => {
      const user = currentUserId()
      const batch = pb.createBatch()
      for (const n of missing) batch.collection('categories').create({ user, name: n })
      await batch.send()
    })
  }

  return (
    <section className="categories">
      <h1>Categorias</h1>
      <p className="muted">Organize o caderno do seu jeito. Excluir uma categoria não apaga as receitas.</p>

      <form className="inline-form" onSubmit={create}>
        <input placeholder="Nova categoria" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome da nova categoria" />
        <button className="primary" disabled={busy || !name.trim()}>
          <Plus size={18} aria-hidden /> Criar
        </button>
      </form>

      {error && <p className="form-error" role="alert">{error}</p>}

      {categories.length === 0 ? (
        <div className="empty">
          <p className="muted">Você ainda não tem categorias.</p>
        </div>
      ) : (
        <ul className="category-list">
          {categories.map((c) =>
            editing?.id === c.id ? (
              <li key={c.id}>
                <form className="inline-form" onSubmit={rename}>
                  <input
                    autoFocus
                    maxLength={80}
                    value={editing.name}
                    onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                    aria-label="Novo nome"
                  />
                  <button className="icon" disabled={busy} title="Salvar">
                    <Check size={18} />
                  </button>
                  <button type="button" className="icon" onClick={() => setEditing(null)} title="Cancelar">
                    <X size={18} />
                  </button>
                </form>
              </li>
            ) : (
              <li key={c.id}>
                <span>{c.name}</span>
                <span className="spacer" />
                <button className="icon" onClick={() => setEditing({ id: c.id, name: c.name })} title="Renomear">
                  <Pencil size={18} />
                </button>
                <button className="icon" onClick={() => remove(c)} disabled={busy} title="Excluir">
                  <Trash2 size={18} />
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      <button className="ghost" onClick={addSuggested} disabled={busy}>
        <Sparkles size={18} aria-hidden /> Adicionar categorias sugeridas
      </button>
    </section>
  )
}
