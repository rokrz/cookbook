import { LocalStore } from './localStore'
import { EMPTY_FIELDS, type Category, type Recipe, type Store } from './types'

// Arquivo de backup: JSON com categorias, receitas e fotos (em data URL).
// Serve também para levar o caderno do PocketBase para a versão local.

const FORMAT = 'meu-caderno-de-receitas'
const VERSION = 1

interface BackupRecipe extends Omit<Recipe, 'categoryName'> {
  photo?: string
}

interface BackupFile {
  format: typeof FORMAT
  version: number
  exportedAt: string
  categories: Category[]
  recipes: BackupRecipe[]
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

export async function exportBackup(store: Store): Promise<Blob> {
  const categories = await store.listCategories()
  const recipes: BackupRecipe[] = []
  for (const r of await store.listRecipes('', 'all')) {
    const { categoryName: _, ...rest } = r
    const blob = await store.imageBlob(r).catch(() => null)
    recipes.push(blob ? { ...rest, photo: await blobToDataUrl(blob) } : rest)
  }
  const file: BackupFile = { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), categories, recipes }
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

export function backupFileName(date = new Date()): string {
  return `caderno-de-receitas-${date.toISOString().slice(0, 10)}.json`
}

export async function importBackup(store: LocalStore, file: Blob) {
  let data: BackupFile
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('Este arquivo não é um backup do caderno.')
  }
  if (data?.format !== FORMAT || !Array.isArray(data.recipes) || !Array.isArray(data.categories)) {
    throw new Error('Este arquivo não é um backup do caderno.')
  }
  if (data.version > VERSION) throw new Error('Backup feito por uma versão mais nova do app. Atualize o app e tente de novo.')

  const recipes = await Promise.all(
    data.recipes.map(async ({ photo, ...r }) => ({
      // Campos que faltarem (backup antigo) recebem o valor padrão.
      recipe: {
        ...EMPTY_FIELDS,
        ...r,
        image: r.image ?? '',
        created: r.created || new Date().toISOString(),
        updated: r.updated || new Date().toISOString(),
      },
      image: photo ? await dataUrlToBlob(photo).catch(() => null) : null,
    })),
  )
  return store.restore(data.categories, recipes)
}
