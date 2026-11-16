import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { store, type Recipe } from '../data'
import { errorMessage } from '../lib/errors'

interface Props {
  onPick: (r: Recipe) => void
  onClose: () => void
  // Só mostra as receitas que passam no filtro (ex.: com ingredientes).
  filter?: (r: Recipe) => boolean
  // Texto ao lado do título de cada receita.
  detail?: (r: Recipe) => string
  emptyText?: string
}

export default function RecipePicker({ onPick, onClose, filter, detail, emptyText = 'Nenhuma receita no caderno ainda.' }: Props) {
  const [query, setQuery] = useState('')
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      store
        .listRecipes(query, 'all')
        .then((list) => alive && setRecipes(filter ? list.filter(filter) : list))
        .catch((e) => alive && setError(errorMessage(e)))
    }, 200)
    return () => {
      alive = false
      clearTimeout(t)
    }
    // O filtro é fixo por tela; não precisa refazer a busca quando a função muda de identidade.
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
        <p className="muted">{query ? 'Nenhuma receita encontrada.' : emptyText}</p>
      ) : (
        <ul className="category-list">
          {recipes.map((r) => (
            <li key={r.id}>
              <button className="picker-row" onClick={() => onPick(r)}>
                <span>{r.title}</span>
                {detail && <small className="muted">{detail(r)}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
