import { useEffect, useState } from 'react'
import { CookingPot } from 'lucide-react'
import { store, type ImageSize, type Recipe } from '../data'

interface Props {
  recipe: Recipe
  size: ImageSize
  className?: string
}

// Foto da receita. Se falhar (token do servidor expirado), busca um endereço novo uma vez.
export default function RecipeImage({ recipe, size, className }: Props) {
  const [src, setSrc] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setAttempt(0)
    setFailed(false)
  }, [recipe.id, recipe.image])

  useEffect(() => {
    let release: (() => void) | undefined
    let cancelled = false
    setSrc('')
    store
      .imageSource(recipe, size, attempt > 0)
      .then((source) => {
        if (cancelled) return source?.release?.()
        release = source?.release
        setSrc(source?.src ?? '')
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      release?.()
    }
  }, [recipe.id, recipe.image, size, attempt])

  if (!src || failed) {
    return (
      <div className={`image-placeholder ${className ?? ''}`} aria-hidden>
        <CookingPot size={36} />
      </div>
    )
  }

  return (
    <img
      className={className}
      src={src}
      alt={recipe.title}
      loading="lazy"
      onError={() => (attempt === 0 ? setAttempt(1) : setFailed(true))}
    />
  )
}
