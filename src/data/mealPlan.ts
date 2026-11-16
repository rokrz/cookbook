// Calendário de receitas: em cada dia, receitas agendadas "para fazer" ou já "feitas".
// Fica neste aparelho (localStorage), separado do caderno, e vai junto no backup.

export type PlanStatus = 'todo' | 'done'

export interface PlanEntry {
  id: string
  // Dia no formato AAAA-MM-DD (data local, sem fuso).
  date: string
  recipeId: string
  // Título guardado para ainda mostrar algo se a receita for apagada.
  recipeTitle: string
  status: PlanStatus
  added: string
}

const KEY = 'caderno:calendario'
const listeners = new Set<() => void>()

function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

function isEntry(x: unknown): x is PlanEntry {
  const e = x as PlanEntry
  return !!e && typeof e.id === 'string' && typeof e.date === 'string' && DAY.test(e.date) && typeof e.recipeId === 'string'
}

function normalize(e: PlanEntry): PlanEntry {
  return { ...e, recipeTitle: typeof e.recipeTitle === 'string' ? e.recipeTitle : '', status: e.status === 'done' ? 'done' : 'todo' }
}

// Data local -> "AAAA-MM-DD".
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// "AAAA-MM-DD" -> Date local (meio-dia, para não escorregar de dia com horário de verão).
export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function todayKey(): string {
  return dayKey(new Date())
}

export function planEntries(): PlanEntry[] {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(data) ? data.filter(isEntry).map(normalize) : []
  } catch {
    return []
  }
}

function save(entries: PlanEntry[]): PlanEntry[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    throw new Error('Não foi possível salvar o calendário neste aparelho.')
  }
  listeners.forEach((cb) => cb())
  return entries
}

export function onPlanChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// Dias passados entram como "feita"; hoje e dias futuros, como "para fazer".
export function defaultStatus(date: string): PlanStatus {
  return date < todayKey() ? 'done' : 'todo'
}

export function addPlanEntry(date: string, recipe: { id: string; title: string }, status: PlanStatus = defaultStatus(date)): PlanEntry[] {
  if (!DAY.test(date)) throw new Error('Escolha um dia válido.')
  const entry: PlanEntry = { id: newId(), date, recipeId: recipe.id, recipeTitle: recipe.title, status, added: new Date().toISOString() }
  return save([...planEntries(), entry])
}

export function setPlanStatus(id: string, status: PlanStatus): PlanEntry[] {
  return save(planEntries().map((e) => (e.id === id ? { ...e, status } : e)))
}

export function togglePlanEntry(id: string): PlanEntry[] {
  return save(planEntries().map((e) => (e.id === id ? { ...e, status: e.status === 'done' ? 'todo' : 'done' } : e)))
}

export function movePlanEntry(id: string, date: string): PlanEntry[] {
  if (!DAY.test(date)) throw new Error('Escolha um dia válido.')
  return save(planEntries().map((e) => (e.id === id ? { ...e, date } : e)))
}

export function removePlanEntry(id: string): PlanEntry[] {
  return save(planEntries().filter((e) => e.id !== id))
}

// Restaurar backup: junta as entradas que ainda não estão no calendário (pelo id). Devolve quantas entraram.
export function mergePlanEntries(entries: unknown): number {
  if (!Array.isArray(entries)) return 0
  const current = planEntries()
  const ids = new Set(current.map((e) => e.id))
  const fresh = entries.filter(isEntry).filter((e) => !ids.has(e.id)).map(normalize)
  if (fresh.length) save([...current, ...fresh])
  return fresh.length
}
