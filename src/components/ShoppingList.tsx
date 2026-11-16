import { useEffect, useState, type FormEvent } from 'react'
import { BookOpen, Check, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import { store, type Recipe } from '../data'
import {
  addShoppingItems,
  clearShoppingList,
  ingredientLines,
  onShoppingListChange,
  removeShoppingItem,
  shoppingList,
  toggleShoppingItem,
} from '../data/shoppingList'
import { errorMessage } from '../lib/errors'

export default function ShoppingList() {
  const [items, setItems] = useState(shoppingList)
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => onShoppingListChange(() => setItems(shoppingList())), [])

  function run(action: () => void) {
    setError('')
    try {
      action()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  function add(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    run(() => {
      addShoppingItems([text])
      setText('')
      setMessage('')
    })
  }

  function clear() {
    if (!window.confirm('Limpar a lista de compras? Todos os itens serão apagados.')) return
    run(() => {
      clearShoppingList()
      setMessage('')
    })
  }

  function imported(recipe: Recipe) {
    const lines = ingredientLines(recipe.ingredients)
    run(() => {
      addShoppingItems(lines, { id: recipe.id, title: recipe.title })
      setImporting(false)
      setMessage(`${lines.length} ${lines.length === 1 ? 'ingrediente adicionado' : 'ingredientes adicionados'} de "${recipe.title}".`)
    })
  }

  const done = items.filter((i) => i.checked).length

  return (
    <section className="shopping">
      <h1>Lista de compras</h1>
      <p className="muted">
        Toque num item para marcar.
        {items.length > 0 && ` ${done} de ${items.length} ${items.length === 1 ? 'item marcado' : 'itens marcados'}.`}
      </p>

      <form className="inline-form" onSubmit={add}>
        <input placeholder="Adicionar item" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} aria-label="Novo item" />
        <button className="primary" disabled={!text.trim()}>
          <Plus size={18} aria-hidden /> Adicionar
        </button>
      </form>

      <div className="shopping-actions">
        <button className={importing ? 'chip on' : 'ghost'} onClick={() => setImporting(!importing)}>
          <BookOpen size={18} aria-hidden /> Importar de receita
        </button>
        <button className="danger" onClick={clear} disabled={!items.length}>
          <Trash2 size={18} aria-hidden /> Limpar lista
        </button>
      </div>

      {importing && <RecipePicker onPick={imported} onClose={() => setImporting(false)} />}

      {message && <p className="notice" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {items.length === 0 ? (
        <div className="empty">
          <ShoppingCart size={32} aria-hidden className="muted" />
          <p className="muted">Sua lista está vazia. Adicione itens ou importe os ingredientes de uma receita.</p>
        </div>
      ) : (
        <ul className="shopping-list">
          {items.map((i) => (
            <li key={i.id} className={i.checked ? 'checked' : ''}>
              <button
                className="shopping-item"
                role="checkbox"
                aria-checked={i.checked}
                onClick={() => run(() => toggleShoppingItem(i.id))}
              >
                <span className="box" aria-hidden>{i.checked && <Check size={16} />}</span>
                <span className="text">
                  {i.text}
                  {i.recipeTitle && <small className="muted">{i.recipeTitle}</small>}
                </span>
              </button>
              <button className="icon" onClick={() => run(() => removeShoppingItem(i.id))} title="Remover item" aria-label={`Remover ${i.text}`}>
                <X size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RecipePicker({ onPick, onClose }: { onPick: (r: Recipe) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      store
        .listRecipes(query, 'all')
        .then((list) => alive && setRecipes(list.filter((r) => ingredientLines(r.ingredients).length > 0)))
        .catch((e) => alive && setError(errorMessage(e)))
    }, 200)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query])

  return (
    <div className="recipe-picker">
      <div className="inline-form">
        <div className="search">
          <Search size={18} aria-hidden />
          <input autoFocus placeholder="Buscar receita" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar receita" />
        </div>
        <button className="icon" onClick={onClose} title="Fechar">
          <X size={18} />
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!recipes ? (
        <p className="muted">Carregando receitas…</p>
      ) : recipes.length === 0 ? (
        <p className="muted">{query ? 'Nenhuma receita com ingredientes encontrada.' : 'Nenhuma receita tem ingredientes anotados ainda.'}</p>
      ) : (
        <ul className="category-list">
          {recipes.map((r) => (
            <li key={r.id}>
              <button className="picker-row" onClick={() => onPick(r)}>
                <span>{r.title}</span>
                <small className="muted">{ingredientLines(r.ingredients).length} ingredientes</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
