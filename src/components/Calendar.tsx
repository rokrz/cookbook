import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { store, type Recipe } from '../data'
import {
  addPlanEntry,
  dayKey,
  defaultStatus,
  onPlanChange,
  parseDay,
  planEntries,
  removePlanEntry,
  togglePlanEntry,
  todayKey,
  type PlanEntry,
  type PlanStatus,
} from '../data/mealPlan'
import { errorMessage } from '../lib/errors'
import RecipePicker from './RecipePicker'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const STATUS_LABEL: Record<PlanStatus, string> = { todo: 'Para fazer', done: 'Feita' }

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function monthTitle(year: number, month: number) {
  return capitalize(new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))
}

function longDay(key: string) {
  return capitalize(parseDay(key).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))
}

function shortDay(key: string) {
  return parseDay(key).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')
}

// Dias exibidos na grade do mês: semanas completas, de domingo a sábado.
function monthGrid(year: number, month: number): { key: string; inMonth: boolean }[] {
  const first = new Date(year, month, 1, 12)
  const start = new Date(year, month, 1 - first.getDay(), 12)
  const lastDay = new Date(year, month + 1, 0).getDate()
  const total = Math.ceil((first.getDay() + lastDay) / 7) * 7
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12)
    return { key: dayKey(d), inMonth: d.getMonth() === month }
  })
}

interface Props {
  // Dia aberto pela URL (#/calendario/AAAA-MM-DD), se houver.
  initialDay?: string
}

export default function Calendar({ initialDay }: Props) {
  const today = todayKey()
  const [selected, setSelected] = useState(initialDay ?? today)
  const [shown, setShown] = useState(() => {
    const d = parseDay(initialDay ?? today)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [entries, setEntries] = useState(planEntries)
  const [titles, setTitles] = useState<Map<string, string> | null>(null)
  const [adding, setAdding] = useState(false)
  const [addStatus, setAddStatus] = useState<PlanStatus>(() => defaultStatus(initialDay ?? today))
  const [error, setError] = useState('')

  useEffect(() => onPlanChange(() => setEntries(planEntries())), [])

  // Títulos atuais das receitas (podem ter sido renomeadas ou apagadas depois de agendadas).
  useEffect(() => {
    store
      .listRecipes('', 'all')
      .then((list) => setTitles(new Map(list.map((r) => [r.id, r.title]))))
      .catch((e) => setError(errorMessage(e)))
  }, [])

  useEffect(() => {
    if (initialDay) selectDay(initialDay)
  }, [initialDay])

  const byDay = useMemo(() => {
    const map = new Map<string, PlanEntry[]>()
    for (const e of entries) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return map
  }, [entries])

  const pending = useMemo(
    () => entries.filter((e) => e.status === 'todo').sort((a, b) => a.date.localeCompare(b.date) || a.added.localeCompare(b.added)),
    [entries],
  )

  function selectDay(key: string) {
    setSelected(key)
    setAddStatus(defaultStatus(key))
    const d = parseDay(key)
    setShown({ year: d.getFullYear(), month: d.getMonth() })
  }

  function moveMonth(delta: number) {
    setShown(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  function run(action: () => void) {
    setError('')
    try {
      action()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  function picked(recipe: Recipe) {
    run(() => {
      addPlanEntry(selected, { id: recipe.id, title: recipe.title }, addStatus)
      setAdding(false)
    })
  }

  function titleOf(e: PlanEntry) {
    return titles?.get(e.recipeId) ?? e.recipeTitle ?? 'Receita'
  }

  const deleted = (e: PlanEntry) => !!titles && !titles.has(e.recipeId)
  const dayEntries = byDay.get(selected) ?? []
  const grid = monthGrid(shown.year, shown.month)

  return (
    <section className="calendar">
      <h1>Calendário</h1>
      <p className="muted">Escolha um dia para agendar receitas ou anotar as que você já fez.</p>

      <div className="cal-box">
        <div className="cal-head">
          <button className="icon" onClick={() => moveMonth(-1)} title="Mês anterior" aria-label="Mês anterior">
            <ChevronLeft size={20} />
          </button>
          <strong aria-live="polite">{monthTitle(shown.year, shown.month)}</strong>
          <button className="icon" onClick={() => moveMonth(1)} title="Próximo mês" aria-label="Próximo mês">
            <ChevronRight size={20} />
          </button>
          <button className="ghost today-btn" onClick={() => selectDay(today)}>
            Hoje
          </button>
        </div>
        <div className="cal-grid" role="grid">
          {WEEKDAYS.map((w) => (
            <span key={w} className="cal-weekday" aria-hidden>
              {w}
            </span>
          ))}
          {grid.map(({ key, inMonth }) => {
            const list = byDay.get(key) ?? []
            const todo = list.filter((e) => e.status === 'todo').length
            const done = list.length - todo
            const cls = ['cal-day', inMonth ? '' : 'out', key === today ? 'today' : '', key === selected ? 'selected' : '']
              .filter(Boolean)
              .join(' ')
            const label = `${longDay(key)}${list.length ? `: ${todo} para fazer, ${done} feitas` : ''}`
            return (
              <button key={key} className={cls} onClick={() => selectDay(key)} aria-label={label} aria-pressed={key === selected}>
                <span>{parseDay(key).getDate()}</span>
                {list.length > 0 && (
                  <span className="cal-dots" aria-hidden>
                    {todo > 0 && <i className={`dot todo${key < today ? ' late' : ''}`}>{todo > 1 ? todo : ''}</i>}
                    {done > 0 && <i className="dot done">{done > 1 ? done : ''}</i>}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div className="cal-legend muted">
          <span><i className="dot todo" /> Para fazer</span>
          <span><i className="dot done" /> Feita</span>
          <span><i className="dot todo late" /> Atrasada</span>
        </div>
      </div>

      <div className="cal-day-panel">
        <div className="cal-day-title">
          <h2>{longDay(selected)}</h2>
          <button className={adding ? 'chip on' : 'primary'} onClick={() => setAdding(!adding)}>
            <Plus size={18} aria-hidden /> Adicionar receita
          </button>
        </div>

        {adding && (
          <>
            <div className="status-choice" role="radiogroup" aria-label="Adicionar como">
              <span className="muted">Adicionar como:</span>
              {(['todo', 'done'] as const).map((s) => (
                <button key={s} role="radio" aria-checked={addStatus === s} className={addStatus === s ? 'chip on' : 'chip'} onClick={() => setAddStatus(s)}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <RecipePicker onPick={picked} onClose={() => setAdding(false)} />
          </>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        {dayEntries.length === 0 ? (
          !adding && <p className="muted">Nenhuma receita neste dia.</p>
        ) : (
          <ul className="shopping-list plan-list">
            {dayEntries.map((e) => (
              <PlanRow key={e.id} entry={e} title={titleOf(e)} deleted={deleted(e)} onError={setError} />
            ))}
          </ul>
        )}
      </div>

      {pending.length > 0 && (
        <div className="cal-pending">
          <h2>Para fazer</h2>
          <ul className="category-list">
            {pending.slice(0, 12).map((e) => (
              <li key={e.id}>
                <button className="picker-row" onClick={() => selectDay(e.date)}>
                  <span>{titleOf(e)}</span>
                  <small className={e.date < today ? 'late-text' : 'muted'}>
                    {e.date === today ? 'hoje' : shortDay(e.date)}
                    {e.date < today && ' · atrasada'}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          {pending.length > 12 && <p className="muted">E mais {pending.length - 12}.</p>}
        </div>
      )}

      {entries.length === 0 && (
        <div className="empty">
          <CalendarDays size={32} aria-hidden className="muted" />
          <p className="muted">Seu calendário está vazio. Escolha um dia e adicione uma receita.</p>
        </div>
      )}
    </section>
  )
}

function PlanRow({ entry, title, deleted, onError }: { entry: PlanEntry; title: string; deleted: boolean; onError: (m: string) => void }) {
  const done = entry.status === 'done'
  function run(action: () => void) {
    try {
      action()
    } catch (e) {
      onError(errorMessage(e))
    }
  }
  return (
    <li className={done ? 'checked' : ''}>
      <button
        className="shopping-item plan-toggle"
        role="checkbox"
        aria-checked={done}
        title={done ? 'Marcar como para fazer' : 'Marcar como feita'}
        onClick={() => run(() => togglePlanEntry(entry.id))}
      >
        <span className="box" aria-hidden>{done && <Check size={16} />}</span>
        <span className={`status-tag ${entry.status}`}>{STATUS_LABEL[entry.status]}</span>
      </button>
      <span className="plan-title">
        {deleted ? (
          <>
            {title} <small className="muted">(receita apagada)</small>
          </>
        ) : (
          <a href={`#/receita/${entry.recipeId}`}>{title}</a>
        )}
      </span>
      <button className="icon" onClick={() => run(() => removePlanEntry(entry.id))} title="Tirar do dia" aria-label={`Tirar ${title} deste dia`}>
        <X size={18} />
      </button>
    </li>
  )
}
