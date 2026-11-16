// Lista de compras: fica neste aparelho (localStorage), separada do caderno, e vai junto no backup.

export interface ShoppingItem {
  id: string
  text: string
  checked: boolean
  // Receita de onde o item veio, quando importado.
  recipeId?: string
  recipeTitle?: string
  added: string
}

const KEY = 'caderno:lista-de-compras'
const listeners = new Set<() => void>()

function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

function isItem(x: unknown): x is ShoppingItem {
  const i = x as ShoppingItem
  return !!i && typeof i.id === 'string' && typeof i.text === 'string'
}

export function shoppingList(): ShoppingItem[] {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(data) ? data.filter(isItem).map((i) => ({ ...i, checked: !!i.checked })) : []
  } catch {
    return []
  }
}

function save(items: ShoppingItem[]): ShoppingItem[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    throw new Error('Não foi possível salvar a lista de compras neste aparelho.')
  }
  listeners.forEach((cb) => cb())
  return items
}

export function onShoppingListChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// Uma linha por item; tira marcadores ("- ", "• ", "1.") e ignora títulos de seção ("Massa:").
export function ingredientLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim().replace(/^([-•*·–—]|\d+[.)])\s+/, '').trim())
    .filter((l) => l && !/:$/.test(l))
}

// Sempre acrescenta ao fim da lista; nunca substitui o que já está lá.
export function addShoppingItems(texts: string[], from?: { id: string; title: string }): ShoppingItem[] {
  const added = new Date().toISOString()
  const fresh = texts
    .map((t) => t.trim().slice(0, 300))
    .filter(Boolean)
    .map((text) => ({ id: newId(), text, checked: false, added, ...(from ? { recipeId: from.id, recipeTitle: from.title } : {}) }))
  return save([...shoppingList(), ...fresh])
}

export function toggleShoppingItem(id: string): ShoppingItem[] {
  return save(shoppingList().map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)))
}

export function removeShoppingItem(id: string): ShoppingItem[] {
  return save(shoppingList().filter((i) => i.id !== id))
}

export function clearShoppingList(): ShoppingItem[] {
  return save([])
}

// Restaurar backup: junta os itens que ainda não estão na lista (pelo id). Devolve quantos entraram.
export function mergeShoppingItems(items: unknown): number {
  if (!Array.isArray(items)) return 0
  const current = shoppingList()
  const ids = new Set(current.map((i) => i.id))
  const fresh = items.filter(isItem).filter((i) => !ids.has(i.id)).map((i) => ({ ...i, checked: !!i.checked }))
  if (fresh.length) save([...current, ...fresh])
  return fresh.length
}
