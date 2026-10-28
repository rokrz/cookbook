import PocketBase, { type RecordModel } from 'pocketbase'

// Em produção o app é servido pelo próprio PocketBase (mesma origem).
// Em desenvolvimento, VITE_PB_URL aponta para o PocketBase local.
export const pb = new PocketBase(import.meta.env.VITE_PB_URL || window.location.origin)

// Evita que buscas paralelas (filtros, StrictMode) cancelem umas às outras.
pb.autoCancellation(false)

export interface Category extends RecordModel {
  user: string
  name: string
}

export interface Recipe extends RecordModel {
  user: string
  title: string
  category: string
  ingredients: string
  instructions: string
  notes: string
  source_url: string
  prep_minutes: number
  servings: string
  favorite: boolean
  tested: boolean
  image: string
  created: string
  updated: string
  expand?: { category?: Category }
}

export const recipesCol = () => pb.collection<Recipe>('recipes')
export const categoriesCol = () => pb.collection<Category>('categories')

export const SUGGESTED_CATEGORIES = [
  'Bolos e tortas',
  'Doces e sobremesas',
  'Pães e massas',
  'Refeições',
  'Lanches',
  'Bebidas',
  'Molhos e acompanhamentos',
]

export type LibraryFilter = 'all' | 'favorite' | 'tested' | { category: string }

export function buildRecipeFilter(query: string, filter: LibraryFilter): string {
  const parts: string[] = []
  const q = query.trim()
  if (q) parts.push(pb.filter('(title ~ {:q} || ingredients ~ {:q} || notes ~ {:q})', { q }))
  if (filter === 'favorite') parts.push('favorite = true')
  if (filter === 'tested') parts.push('tested = true')
  if (typeof filter === 'object') parts.push(pb.filter('category = {:c}', { c: filter.category }))
  return parts.join(' && ')
}

export function currentUserId(): string {
  const id = pb.authStore.record?.id
  if (!id) throw new Error('Sessão expirada. Entre novamente.')
  return id
}

// URL de foto protegida. O token é de curta duração e vale para todas as fotos da conta.
export function imageUrl(recipe: Recipe, token: string, thumb?: string): string {
  if (!recipe.image || !token) return ''
  return pb.files.getURL(recipe, recipe.image, thumb ? { token, thumb } : { token })
}
