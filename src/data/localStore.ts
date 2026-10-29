import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { makeThumbnail } from '../lib/image'
import { normalizeUrl } from '../lib/links'
import { fold } from '../lib/text'
import {
  isIncomplete,
  type Category,
  type ImageChange,
  type LibraryFilter,
  type Recipe,
  type RecipeFields,
  type Store,
} from './types'

// Tudo fica no próprio aparelho (IndexedDB). Fotos são guardadas como Blob, com miniatura.

interface StoredCategory extends Category {
  key: string
  created: string
  updated: string
}

type StoredRecipe = Omit<Recipe, 'categoryName'>

interface StoredImage {
  id: string
  full: Blob
  thumb: Blob
}

interface CadernoDB extends DBSchema {
  categories: { key: string; value: StoredCategory; indexes: { key: string } }
  recipes: { key: string; value: StoredRecipe; indexes: { source_url: string } }
  images: { key: string; value: StoredImage }
}

export class LocalError extends Error {}

function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

function now(): string {
  return new Date().toISOString()
}

function cleanName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new LocalError('Dê um nome para a categoria.')
  if (trimmed.length > 80) throw new LocalError('O nome da categoria pode ter até 80 caracteres.')
  return trimmed
}

function cleanFields<T extends Partial<RecipeFields>>(fields: T): T {
  const out = { ...fields }
  if (out.title !== undefined) {
    out.title = out.title.trim()
    if (!out.title) throw new LocalError('Dê um nome para a receita.')
    if (out.title.length > 200) throw new LocalError('O nome pode ter até 200 caracteres.')
  }
  if (out.source_url !== undefined) out.source_url = normalizeUrl(out.source_url)
  if (out.prep_minutes !== undefined) out.prep_minutes = Math.max(0, Math.min(10000, Math.round(out.prep_minutes || 0)))
  return out
}

let persistAsked = false

// Pede ao navegador para não apagar os dados quando faltar espaço.
function askPersistence() {
  if (persistAsked) return
  persistAsked = true
  navigator.storage?.persist?.().catch(() => {})
}

export class LocalStore implements Store {
  kind = 'local' as const
  private db: Promise<IDBPDatabase<CadernoDB>>

  constructor(name = 'meu-caderno-de-receitas') {
    this.db = openDB<CadernoDB>(name, 1, {
      upgrade(db) {
        db.createObjectStore('categories', { keyPath: 'id' }).createIndex('key', 'key', { unique: true })
        db.createObjectStore('recipes', { keyPath: 'id' }).createIndex('source_url', 'source_url')
        db.createObjectStore('images', { keyPath: 'id' })
      },
    })
  }

  // ---------------------------------------------------------------- categorias

  async listCategories(): Promise<Category[]> {
    const all = await (await this.db).getAll('categories')
    return all
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
  }

  async createCategory(name: string): Promise<Category> {
    const clean = cleanName(name)
    const db = await this.db
    const key = fold(clean)
    if (await db.getFromIndex('categories', 'key', key)) throw new LocalError('Você já tem uma categoria com esse nome.')
    const record: StoredCategory = { id: newId(), name: clean, key, created: now(), updated: now() }
    await db.add('categories', record)
    askPersistence()
    return { id: record.id, name: record.name }
  }

  async ensureCategory(name: string): Promise<Category> {
    const clean = cleanName(name)
    const existing = await (await this.db).getFromIndex('categories', 'key', fold(clean))
    if (existing) return { id: existing.id, name: existing.name }
    return this.createCategory(clean)
  }

  async createCategories(names: string[]): Promise<void> {
    for (const n of names) await this.ensureCategory(n)
  }

  async renameCategory(id: string, name: string): Promise<void> {
    const clean = cleanName(name)
    const db = await this.db
    const key = fold(clean)
    const other = await db.getFromIndex('categories', 'key', key)
    if (other && other.id !== id) throw new LocalError('Você já tem uma categoria com esse nome.')
    const current = await db.get('categories', id)
    if (!current) throw new LocalError('Categoria não encontrada.')
    await db.put('categories', { ...current, name: clean, key, updated: now() })
  }

  // As receitas da categoria ficam sem categoria.
  async deleteCategory(id: string): Promise<void> {
    const db = await this.db
    const tx = db.transaction(['categories', 'recipes'], 'readwrite')
    const recipes = tx.objectStore('recipes')
    for (const r of await recipes.getAll()) {
      if (r.category === id) await recipes.put({ ...r, category: '', updated: now() })
    }
    await tx.objectStore('categories').delete(id)
    await tx.done
  }

  // ------------------------------------------------------------------ receitas

  private async withCategoryNames(list: StoredRecipe[]): Promise<Recipe[]> {
    const names = new Map((await this.listCategories()).map((c) => [c.id, c.name]))
    return list.map((r) => ({ ...r, categoryName: names.get(r.category) }))
  }

  async listRecipes(query: string, filter: LibraryFilter): Promise<Recipe[]> {
    const q = fold(query)
    const list = (await (await this.db).getAll('recipes')).filter((r) => {
      if (filter === 'favorite' && !r.favorite) return false
      if (filter === 'tested' && !r.tested) return false
      if (filter === 'incomplete' && !isIncomplete(r)) return false
      if (typeof filter === 'object' && r.category !== filter.category) return false
      if (q && ![r.title, r.ingredients, r.notes].some((t) => fold(t).includes(q))) return false
      return true
    })
    list.sort((a, b) => b.created.localeCompare(a.created))
    return this.withCategoryNames(list)
  }

  async getRecipe(id: string): Promise<Recipe> {
    const r = await (await this.db).get('recipes', id)
    if (!r) throw new LocalError('Receita não encontrada.')
    return (await this.withCategoryNames([r]))[0]
  }

  async findBySourceUrl(url: string): Promise<Recipe | null> {
    const clean = normalizeUrl(url)
    if (!clean) return null
    const r = await (await this.db).getFromIndex('recipes', 'source_url', clean)
    return r ? (await this.withCategoryNames([r]))[0] : null
  }

  private async checkCategory(id: string | undefined) {
    if (id && !(await (await this.db).get('categories', id))) throw new LocalError('Categoria não encontrada.')
  }

  // Prepara a foto (e a miniatura) antes de abrir a transação: IndexedDB não espera trabalho assíncrono externo.
  private async prepareImage(id: string, image: ImageChange): Promise<StoredImage | null | undefined> {
    if (!image) return image
    return { id, full: image, thumb: (await makeThumbnail(image)) ?? image }
  }

  async createRecipe(fields: RecipeFields, image?: ImageChange): Promise<Recipe> {
    const clean = cleanFields(fields)
    await this.checkCategory(clean.category)
    const id = newId()
    const stored = await this.prepareImage(id, image)
    const record: StoredRecipe = { ...clean, id, image: stored ? newId() : '', created: now(), updated: now() }
    const db = await this.db
    const tx = db.transaction(['recipes', 'images'], 'readwrite')
    await tx.objectStore('recipes').add(record)
    if (stored) await tx.objectStore('images').put(stored)
    await tx.done
    askPersistence()
    return this.getRecipe(id)
  }

  async updateRecipe(id: string, fields: Partial<RecipeFields>, image?: ImageChange): Promise<Recipe> {
    const clean = cleanFields(fields)
    await this.checkCategory(clean.category)
    const stored = await this.prepareImage(id, image)
    const db = await this.db
    const tx = db.transaction(['recipes', 'images'], 'readwrite')
    const current = await tx.objectStore('recipes').get(id)
    if (!current) throw new LocalError('Receita não encontrada.')
    const next: StoredRecipe = { ...current, ...clean, updated: now() }
    if (stored) {
      next.image = newId()
      await tx.objectStore('images').put(stored)
    } else if (stored === null) {
      next.image = ''
      await tx.objectStore('images').delete(id)
    }
    await tx.objectStore('recipes').put(next)
    await tx.done
    return this.getRecipe(id)
  }

  async deleteRecipe(id: string): Promise<void> {
    const db = await this.db
    const tx = db.transaction(['recipes', 'images'], 'readwrite')
    await tx.objectStore('recipes').delete(id)
    await tx.objectStore('images').delete(id)
    await tx.done
  }

  async imageSource(recipe: Recipe, size: 'thumb' | 'full') {
    if (!recipe.image) return null
    const img = await (await this.db).get('images', recipe.id)
    if (!img) return null
    const src = URL.createObjectURL(size === 'thumb' ? img.thumb : img.full)
    return { src, release: () => URL.revokeObjectURL(src) }
  }

  async imageBlob(recipe: Recipe): Promise<Blob | null> {
    if (!recipe.image) return null
    return (await (await this.db).get('images', recipe.id))?.full ?? null
  }

  // ------------------------------------------------------------------- backup

  // Restaura categorias e receitas mantendo os ids. Registros com o mesmo id são substituídos;
  // categoria com o mesmo nome de uma existente é unificada com ela.
  async restore(
    categories: Category[],
    recipes: { recipe: StoredRecipe; image: Blob | null }[],
  ): Promise<{ categories: number; recipes: number }> {
    const db = await this.db
    const idMap = new Map<string, string>()
    let newCategories = 0
    for (const c of categories) {
      const name = cleanName(c.name)
      const byName = await db.getFromIndex('categories', 'key', fold(name))
      if (byName) {
        idMap.set(c.id, byName.id)
      } else {
        const existing = await db.get('categories', c.id)
        const id = existing ? newId() : c.id
        await db.add('categories', { id, name, key: fold(name), created: now(), updated: now() })
        idMap.set(c.id, id)
        newCategories++
      }
    }

    const prepared = await Promise.all(
      recipes.map(async ({ recipe, image }) => ({
        recipe: { ...recipe, category: idMap.get(recipe.category) ?? '', image: image ? recipe.image || newId() : '' },
        image: image ? await this.prepareImage(recipe.id, new File([image], 'foto', { type: image.type })) : null,
      })),
    )
    const tx = db.transaction(['recipes', 'images'], 'readwrite')
    for (const { recipe, image } of prepared) {
      await tx.objectStore('recipes').put(recipe)
      if (image) await tx.objectStore('images').put(image)
      else await tx.objectStore('images').delete(recipe.id)
    }
    await tx.done
    askPersistence()
    return { categories: newCategories, recipes: prepared.length }
  }
}
