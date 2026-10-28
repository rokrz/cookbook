import { useEffect, useState } from 'react'
import { CookingPot } from 'lucide-react'
import { imageUrl, type Recipe } from '../lib/pb'

interface Props {
  recipe: Recipe
  token: string
  thumb?: string
  onRefreshToken: () => void
  className?: string
}

// Foto protegida; se o token expirar, pede um novo uma vez e tenta de novo.
export default function RecipeImage({ recipe, token, thumb, onRefreshToken, className }: Props) {
  const [failedToken, setFailedToken] = useState('')
  const src = imageUrl(recipe, token, thumb)

  useEffect(() => setFailedToken(''), [recipe.image])

  if (!src || failedToken === token) {
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
      onError={() => {
        if (failedToken !== token) {
          setFailedToken(token)
          onRefreshToken()
        }
      }}
    />
  )
}
