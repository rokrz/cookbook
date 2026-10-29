// Modelo usado pelas telas, independente de onde os dados ficam (aparelho ou PocketBase).

export interface Category {
  id: string
  name: string
}

export interface RecipeFields {
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
}

export interface Recipe extends RecipeFields {
  id: string
  // Identifica a foto atual ('' = sem foto). Muda quando a foto é trocada.
  image: string
  created: string
  updated: string
  categoryName?: string
}

// undefined = manter a foto, null = remover, File = trocar.
export type ImageChange = File | null | undefined

export type LibraryFilter = 'all' | 'favorite' | 'tested' | 'incomplete' | { category: string }

export type ImageSize = 'thumb' | 'full'

export interface ImageSource {
  src: string
  release?: () => void
}

export interface Auth {
  isLoggedIn(): boolean
  userName(): string
  onChange(cb: () => void): () => void
  login(email: string, password: string): Promise<void>
  logout(): void
  refresh(): Promise<void>
}

export interface Store {
  kind: 'local' | 'pocketbase'
  // Só existe quando o caderno fica num servidor com login.
  auth?: Auth

  listCategories(): Promise<Category[]>
  createCategory(name: string): Promise<Category>
  // Devolve a categoria com esse nome (sem diferenciar maiúsculas), criando se não existir.
  ensureCategory(name: string): Promise<Category>
  createCategories(names: string[]): Promise<void>
  renameCategory(id: string, name: string): Promise<void>
  deleteCategory(id: string): Promise<void>

  listRecipes(query: string, filter: LibraryFilter): Promise<Recipe[]>
  getRecipe(id: string): Promise<Recipe>
  findBySourceUrl(url: string): Promise<Recipe | null>
  createRecipe(fields: RecipeFields, image?: ImageChange): Promise<Recipe>
  updateRecipe(id: string, fields: Partial<RecipeFields>, image?: ImageChange): Promise<Recipe>
  deleteRecipe(id: string): Promise<void>

  // fresh = descartar credenciais em cache (foto protegida que falhou ao carregar).
  imageSource(recipe: Recipe, size: ImageSize, fresh?: boolean): Promise<ImageSource | null>
  imageBlob(recipe: Recipe): Promise<Blob | null>
}

export const EMPTY_FIELDS: RecipeFields = {
  title: '',
  category: '',
  ingredients: '',
  instructions: '',
  notes: '',
  source_url: '',
  prep_minutes: 0,
  servings: '',
  favorite: false,
  tested: false,
}

export const SUGGESTED_CATEGORIES = [
  'Bolos e tortas',
  'Doces e sobremesas',
  'Pães e massas',
  'Refeições',
  'Lanches',
  'Bebidas',
  'Molhos e acompanhamentos',
]

// Receita salva só com nome e link: falta ingrediente e modo de preparo.
export function isIncomplete(r: Pick<RecipeFields, 'ingredients' | 'instructions'>): boolean {
  return !r.ingredients.trim() && !r.instructions.trim()
}
