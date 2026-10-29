import PocketBase, { ClientResponseError, type RecordModel } from 'pocketbase'
import { normalizeUrl } from '../lib/links'
import type { Auth, Category, ImageChange, ImageSize, LibraryFilter, Recipe, RecipeFields, Store } from './types'

// Caderno guardado num servidor PocketBase, com login (versão hospedada no PC de casa).

interface CategoryRecord extends RecordModel {
  user: string
  name: string
}

interface RecipeRecord extends RecordModel, RecipeFields {
  user: string
  image: string
  created: string
  updated: string
  expand?: { category?: CategoryRecord }
}

const THUMBS: Record<ImageSize, string> = { thumb: '480x360', full: '1200x0' }
// O token de arquivo do PocketBase vale poucos minutos; renova antes disso.
const TOKEN_TTL_MS = 60_000

function toRecipe(r: RecipeRecord): Recipe {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    ingredients: r.ingredients,
    instructions: r.instructions,
    notes: r.notes,
    source_url: r.source_url,
    prep_minutes: r.prep_minutes,
    servings: r.servings,
    favorite: r.favorite,
    tested: r.tested,
    image: r.image,
    created: r.created,
    updated: r.updated,
    categoryName: r.expand?.category?.name,
  }
}

export class PocketBaseStore implements Store {
  kind = 'pocketbase' as const
  auth: Auth
  private pb: PocketBase
  private token = { value: '', at: 0 }

  constructor(url: string) {
    this.pb = new PocketBase(url)
    // Evita que buscas paralelas (filtros, StrictMode) cancelem umas às outras.
    this.pb.autoCancellation(false)
    const pb = this.pb
    this.auth = {
      isLoggedIn: () => pb.authStore.isValid,
      userName: () => (pb.authStore.record?.name as string) || '',
      onChange: (cb) => pb.authStore.onChange(cb),
      login: async (email, password) => {
        await pb.collection('users').authWithPassword(email, password)
      },
      logout: () => pb.authStore.clear(),
      refresh: async () => {
        if (!pb.authStore.isValid) return
        await pb.collection('users').authRefresh().catch(() => pb.authStore.clear())
      },
    }
  }

  private categories() {
    return this.pb.collection<CategoryRecord>('categories')
  }

  private recipes() {
    return this.pb.collection<RecipeRecord>('recipes')
  }

  private userId(): string {
    const id = this.pb.authStore.record?.id
    if (!id) throw new Error('Sessão expirada. Entre novamente.')
    return id
  }

  async listCategories(): Promise<Category[]> {
    const list = await this.categories().getFullList({ sort: 'name' })
    return list.map(({ id, name }) => ({ id, name }))
  }

  async createCategory(name: string): Promise<Category> {
    const c = await this.categories().create({ user: this.userId(), name: name.trim() })
    return { id: c.id, name: c.name }
  }

  async ensureCategory(name: string): Promise<Category> {
    const find = async () => {
      // O índice único ignora maiúsculas (COLLATE NOCASE); o filtro `~` também.
      const list = await this.categories().getFullList({ filter: this.pb.filter('name ~ {:n}', { n: name.trim() }) })
      const target = name.trim().toLocaleLowerCase('pt-BR')
      const hit = list.find((c) => c.name.toLocaleLowerCase('pt-BR') === target)
      return hit ? { id: hit.id, name: hit.name } : null
    }
    const existing = await find()
    if (existing) return existing
    try {
      return await this.createCategory(name)
    } catch (e) {
      // Criada ao mesmo tempo em outro aparelho: usa a que já existe.
      if (e instanceof ClientResponseError && e.status === 400) {
        const again = await find()
        if (again) return again
      }
      throw e
    }
  }

  async createCategories(names: string[]): Promise<void> {
    const user = this.userId()
    const batch = this.pb.createBatch()
    for (const n of names) batch.collection('categories').create({ user, name: n })
    await batch.send()
  }

  async renameCategory(id: string, name: string): Promise<void> {
    await this.categories().update(id, { name: name.trim() })
  }

  async deleteCategory(id: string): Promise<void> {
    await this.categories().delete(id)
  }

  async listRecipes(query: string, filter: LibraryFilter): Promise<Recipe[]> {
    const parts: string[] = []
    const q = query.trim()
    if (q) parts.push(this.pb.filter('(title ~ {:q} || ingredients ~ {:q} || notes ~ {:q})', { q }))
    if (filter === 'favorite') parts.push('favorite = true')
    if (filter === 'tested') parts.push('tested = true')
    if (filter === 'incomplete') parts.push("ingredients = '' && instructions = ''")
    if (typeof filter === 'object') parts.push(this.pb.filter('category = {:c}', { c: filter.category }))
    const list = await this.recipes().getFullList({ filter: parts.join(' && '), sort: '-created', expand: 'category' })
    return list.map(toRecipe)
  }

  async getRecipe(id: string): Promise<Recipe> {
    return toRecipe(await this.recipes().getOne(id, { expand: 'category' }))
  }

  async findBySourceUrl(url: string): Promise<Recipe | null> {
    const clean = normalizeUrl(url)
    if (!clean) return null
    const list = await this.recipes().getList(1, 1, {
      filter: this.pb.filter('source_url = {:u}', { u: clean }),
      expand: 'category',
    })
    return list.items[0] ? toRecipe(list.items[0]) : null
  }

  private body(fields: Partial<RecipeFields>, image: ImageChange): Record<string, unknown> {
    const data: Record<string, unknown> = { ...fields }
    if (fields.title !== undefined) data.title = fields.title.trim()
    if (fields.source_url !== undefined) data.source_url = normalizeUrl(fields.source_url)
    // Trocar a foto ou limpá-la faz o PocketBase apagar o arquivo antigo.
    if (image) data.image = image
    else if (image === null) data.image = null
    return data
  }

  async createRecipe(fields: RecipeFields, image?: ImageChange): Promise<Recipe> {
    const r = await this.recipes().create({ ...this.body(fields, image), user: this.userId() }, { expand: 'category' })
    return toRecipe(r)
  }

  async updateRecipe(id: string, fields: Partial<RecipeFields>, image?: ImageChange): Promise<Recipe> {
    return toRecipe(await this.recipes().update(id, this.body(fields, image), { expand: 'category' }))
  }

  async deleteRecipe(id: string): Promise<void> {
    await this.recipes().delete(id)
  }

  private async fileToken(fresh = false): Promise<string> {
    if (fresh || !this.token.value || Date.now() - this.token.at > TOKEN_TTL_MS) {
      this.token = { value: await this.pb.files.getToken(), at: Date.now() }
    }
    return this.token.value
  }

  // URL de foto protegida. O token é de curta duração e vale para todas as fotos da conta.
  async imageSource(recipe: Recipe, size: ImageSize, fresh = false) {
    if (!recipe.image) return null
    const token = await this.fileToken(fresh)
    return { src: this.pb.files.getURL({ ...recipe, collectionName: 'recipes' }, recipe.image, { token, thumb: THUMBS[size] }) }
  }

  async imageBlob(recipe: Recipe): Promise<Blob | null> {
    if (!recipe.image) return null
    const token = await this.fileToken()
    const res = await fetch(this.pb.files.getURL({ ...recipe, collectionName: 'recipes' }, recipe.image, { token }))
    return res.ok ? res.blob() : null
  }
}
