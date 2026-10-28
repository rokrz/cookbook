import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Clock, ExternalLink, Heart, Pencil, Users } from 'lucide-react'
import { recipesCol, type Recipe } from '../lib/pb'
import { errorMessage } from '../lib/errors'
import RecipeImage from './RecipeImage'

interface Props {
  id: string
  fileToken: string
  onRefreshToken: () => void
}

function lines(text: string) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean)
}

export default function RecipeDetail({ id, fileToken, onRefreshToken }: Props) {
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    recipesCol()
      .getOne(id, { expand: 'category' })
      .then(setRecipe)
      .catch((e) => setError(errorMessage(e)))
  }, [id])

  if (error) return <p className="form-error" role="alert">{error}</p>
  if (!recipe) return <p className="muted">Carregando receita…</p>

  const ingredients = lines(recipe.ingredients)

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
        <RecipeImage recipe={recipe} token={fileToken} thumb="1200x0" onRefreshToken={onRefreshToken} className="detail-image" />
      )}

      <header className="detail-header">
        {recipe.expand?.category && <span className="tag">{recipe.expand.category.name}</span>}
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

      {recipe.notes && (
        <section className="notes">
          <h2>Anotações</h2>
          <p className="prewrap">{recipe.notes}</p>
        </section>
      )}

      {recipe.source_url && (
        <a className="source" href={recipe.source_url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} aria-hidden /> Ver fonte original
        </a>
      )}
    </article>
  )
}
