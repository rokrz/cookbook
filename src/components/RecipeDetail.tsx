import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Clock, ExternalLink, Heart, Pencil, Users } from 'lucide-react'
import { isIncomplete, store, type Recipe } from '../data'
import { detectPlatform, PLATFORM_LABELS } from '../lib/links'
import { errorMessage } from '../lib/errors'
import RecipeImage from './RecipeImage'

interface Props {
  id: string
}

function lines(text: string) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean)
}

export default function RecipeDetail({ id }: Props) {
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    store
      .getRecipe(id)
      .then(setRecipe)
      .catch((e) => setError(errorMessage(e)))
  }, [id])

  if (error) return <p className="form-error" role="alert">{error}</p>
  if (!recipe) return <p className="muted">Carregando receita…</p>

  const ingredients = lines(recipe.ingredients)
  const platform = detectPlatform(recipe.source_url)
  const sourceLabel = platform && platform !== 'site' ? `Abrir post no ${PLATFORM_LABELS[platform]}` : 'Abrir receita original'

  return (
    <article className="detail">
      <div className="detail-top">
        <a href="#/" className="ghost button">
          <ArrowLeft size={18} aria-hidden /> Voltar
        </a>
        <a href={`#/editar/${recipe.id}`} className="button">
          <Pencil size={18} aria-hidden /> Editar
        </a>
      </div>

      {recipe.image && (
        <RecipeImage recipe={recipe} size="full" className="detail-image" />
      )}

      <header className="detail-header">
        {recipe.categoryName && <span className="tag">{recipe.categoryName}</span>}
        <h1>{recipe.title}</h1>
        <div className="meta">
          {recipe.prep_minutes > 0 && (
            <span>
              <Clock size={16} aria-hidden /> {recipe.prep_minutes} min
            </span>
          )}
          {recipe.servings && (
            <span>
              <Users size={16} aria-hidden /> {recipe.servings}
            </span>
          )}
          {recipe.favorite && (
            <span className="fav">
              <Heart size={16} fill="currentColor" aria-hidden /> Favorita
            </span>
          )}
          {recipe.tested && (
            <span className="tested">
              <CheckCircle2 size={16} aria-hidden /> Já testada
            </span>
          )}
        </div>
      </header>

      {isIncomplete(recipe) ? (
        <section className="link-only-box">
          <p>Esta receita foi salva só com o link. Abra o post para ver os detalhes e, quando quiser, complete aqui.</p>
          <div className="welcome-actions">
            {recipe.source_url && (
              <a className="button primary" href={recipe.source_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={18} aria-hidden /> {sourceLabel}
              </a>
            )}
            <a className="button" href={`#/editar/${recipe.id}`}>
              <Pencil size={18} aria-hidden /> Completar receita
            </a>
          </div>
        </section>
      ) : (
      <div className="detail-columns">
        <section>
          <h2>Ingredientes</h2>
          {ingredients.length ? (
            <ul className="ingredients">
              {ingredients.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nenhum ingrediente anotado.</p>
          )}
        </section>
        <section>
          <h2>Modo de preparo</h2>
          {recipe.instructions ? <p className="prewrap">{recipe.instructions}</p> : <p className="muted">Sem instruções ainda.</p>}
        </section>
      </div>
      )}

      {recipe.notes && (
        <section className="notes">
          <h2>Anotações</h2>
          <p className="prewrap">{recipe.notes}</p>
        </section>
      )}

      {recipe.source_url && !isIncomplete(recipe) && (
        <a className="source" href={recipe.source_url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} aria-hidden /> Ver fonte original
        </a>
      )}
    </article>
  )
}
