import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, Heart, Plus, Search } from 'lucide-react'
import { buildRecipeFilter, recipesCol, type Category, type LibraryFilter, type Recipe } from '../lib/pb'
import { errorMessage } from '../lib/errors'
import RecipeImage from './RecipeImage'

interface Props {
  categories: Category[]
  fileToken: string
  onRefreshToken: () => void
}

function filterKey(f: LibraryFilter) {
  return typeof f === 'object' ? `cat:${f.category}` : f
}

function parseFilterKey(key: string): LibraryFilter {
  if (key.startsWith('cat:')) return { category: key.slice(4) }
  return key as LibraryFilter
}

export default function Library({ categories, fileToken, onRefreshToken }: Props) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    let cancelled = false
    setError('')
    recipesCol()
      .getFullList({ filter: buildRecipeFilter(debounced, filter), sort: '-created', expand: 'category' })
      .then((list) => !cancelled && setRecipes(list))
      .catch((e) => !cancelled && setError(errorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [debounced, filter])

  // Novo token sempre que a lista é recarregada, como as URLs assinadas da v1.
  useEffect(() => {
    if (recipes) onRefreshToken()
  }, [recipes, onRefreshToken])

  async function toggle(recipe: Recipe, field: 'favorite' | 'tested') {
    try {
      const updated = await recipesCol().update(recipe.id, { [field]: !recipe[field] }, { expand: 'category' })
      setRecipes((list) => list?.map((r) => (r.id === updated.id ? updated : r)) ?? null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const isEmptyNotebook = recipes?.length === 0 && !debounced && filter === 'all'

  return (
    <section>
      <div className="welcome">
        <div>
          <h1>Suas receitas</h1>
          <p className="muted">Tudo o que você já guardou, num só lugar.</p>
        </div>
        <a className="button primary" href="#/nova">
          <Plus size={18} aria-hidden /> Adicionar receita
        </a>
      </div>

      <div className="toolbar">
        <label className="search">
          <Search size={18} aria-hidden />
          <input
            type="search"
            placeholder="Buscar por nome, ingrediente ou anotação"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar receitas"
          />
        </label>
        <select
          value={filterKey(filter)}
          onChange={(e) => setFilter(parseFilterKey(e.target.value))}
          aria-label="Filtrar receitas"
        >
          <option value="all">Todas</option>
          <option value="favorite">Favoritas</option>
          <option value="tested">Já testadas</option>
          {categories.length > 0 && (
            <optgroup label="Categorias">
              {categories.map((c) => (
                <option key={c.id} value={`cat:${c.id}`}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {recipes === null && !error && <p className="muted">Carregando receitas…</p>}

      {recipes && (
        <p className="muted small count">
          {recipes.length} {recipes.length === 1 ? 'receita' : 'receitas'}
        </p>
      )}

      {isEmptyNotebook && (
        <div className="empty">
          <h2>Seu caderno ainda está em branco</h2>
          <p className="muted">Comece pela receita que você mais faz em casa.</p>
          <a className="button primary" href="#/nova">
            <Plus size={18} aria-hidden /> Primeira receita
          </a>
        </div>
      )}

      {recipes?.length === 0 && !isEmptyNotebook && (
        <div className="empty">
          <h2>Nada encontrado</h2>
          <p className="muted">Tente outra palavra ou outro filtro.</p>
        </div>
      )}

      <div className="grid">
        {recipes?.map((r) => (
          <article key={r.id} className="card">
            <a href={`#/receita/${r.id}`} className="card-link">
              <RecipeImage recipe={r} token={fileToken} thumb="480x360" onRefreshToken={onRefreshToken} className="card-image" />
              <div className="card-body">
                {r.expand?.category && <span className="tag">{r.expand.category.name}</span>}
                <h3>{r.title}</h3>
                {r.prep_minutes > 0 && (
                  <span className="muted small">
                    <Clock size={14} aria-hidden /> {r.prep_minutes} min
                  </span>
                )}
              </div>
            </a>
            <div className="card-actions">
              <button
                className={`icon ${r.favorite ? 'on fav' : ''}`}
                onClick={() => toggle(r, 'favorite')}
                aria-pressed={r.favorite}
                title={r.favorite ? 'Remover dos favoritos' : 'Favoritar'}
              >
                <Heart size={18} fill={r.favorite ? 'currentColor' : 'none'} />
              </button>
              <button
                className={`icon ${r.tested ? 'on tested' : ''}`}
                onClick={() => toggle(r, 'tested')}
                aria-pressed={r.tested}
                title={r.tested ? 'Marcar como não testada' : 'Marcar como testada'}
              >
                <CheckCircle2 size={18} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
