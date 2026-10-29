import { useEffect, useState, type FormEvent } from 'react'
import { Check, ClipboardPaste, ExternalLink, Link2, Pencil } from 'lucide-react'
import { EMPTY_FIELDS, store, type Category, type Recipe } from '../data'
import { errorMessage } from '../lib/errors'
import { detectPlatform, isValidUrl, PLATFORM_LABELS, readShared } from '../lib/links'
import { clearShare, peekShare } from '../lib/share'
import CategoryPicker from './CategoryPicker'

interface Props {
  categories: Category[]
  onCategoryCreated: () => Promise<void>
}

// Salvar rápido: só link, nome e categoria. O resto pode ser completado depois.
export default function QuickSave({ categories, onCategoryCreated }: Props) {
  const [url, setUrl] = useState(() => peekShare()?.url ?? '')
  const [title, setTitle] = useState(() => peekShare()?.title ?? '')
  const [category, setCategory] = useState('')
  const [duplicate, setDuplicate] = useState<Recipe | null>(null)
  const [saved, setSaved] = useState<Recipe | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // O link compartilhado já foi lido para o formulário.
  useEffect(() => clearShare(), [])

  useEffect(() => {
    setDuplicate(null)
    if (!isValidUrl(url)) return
    let cancelled = false
    const t = setTimeout(() => {
      store
        .findBySourceUrl(url)
        .then((r) => !cancelled && setDuplicate(r))
        .catch(() => {})
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [url])

  async function paste() {
    setError('')
    try {
      const text = await navigator.clipboard.readText()
      const shared = readShared({ text })
      if (!shared) return setError('Não há um link na área de transferência.')
      setUrl(shared.url)
      if (!title.trim() && shared.title) setTitle(shared.title)
    } catch {
      setError('Não foi possível ler a área de transferência. Cole o link no campo.')
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!isValidUrl(url)) return setError('Cole um link que comece com https://')
    if (!title.trim()) return setError('Dê um nome para a receita.')
    setBusy(true)
    setError('')
    try {
      setSaved(await store.createRecipe({ ...EMPTY_FIELDS, title: title.trim(), source_url: url.trim(), category }))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setSaved(null)
    setUrl('')
    setTitle('')
    setCategory('')
  }

  if (saved) {
    return (
      <section className="recipe-form quick-save">
        <div className="saved-box">
          <Check size={32} aria-hidden className="saved-icon" />
          <h1>Receita salva</h1>
          <p className="muted">
            “{saved.title}” está no seu caderno{saved.categoryName ? ` em ${saved.categoryName}` : ''}. Complete quando quiser.
          </p>
          <div className="welcome-actions">
            <a className="button" href={`#/editar/${saved.id}`}>
              <Pencil size={18} aria-hidden /> Completar agora
            </a>
            <button type="button" className="button" onClick={reset}>
              <Link2 size={18} aria-hidden /> Salvar outro link
            </button>
            <a className="button primary" href="#/">
              Ver minhas receitas
            </a>
          </div>
        </div>
      </section>
    )
  }

  const platform = detectPlatform(url)
  const canPaste = typeof navigator.clipboard?.readText === 'function'

  return (
    <form className="recipe-form quick-save" onSubmit={submit}>
      <div>
        <h1>Salvar link</h1>
        <p className="muted">Guarde o post ou site agora e complete a receita depois.</p>
      </div>

      <fieldset>
        <label>
          Link do post ou site *
          <div className="inline-form">
            <input
              type="url"
              inputMode="url"
              placeholder="https://www.instagram.com/p/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            {canPaste && (
              <button type="button" className="icon-text" onClick={paste} title="Colar link">
                <ClipboardPaste size={18} aria-hidden /> Colar
              </button>
            )}
          </div>
          {platform && platform !== 'site' && <span className="muted small">Post do {PLATFORM_LABELS[platform]}</span>}
        </label>

        {duplicate && (
          <p className="notice" role="status">
            Você já salvou este link como <a href={`#/receita/${duplicate.id}`}>“{duplicate.title}”</a>.
          </p>
        )}

        <label>
          Nome da receita *
          <input
            maxLength={200}
            placeholder="Ex.: Bolo de cenoura da vó"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus={Boolean(url) && !title}
          />
        </label>

        <div className="field">
          <span>Categoria</span>
          <CategoryPicker value={category} categories={categories} onChange={setCategory} onCreated={onCategoryCreated} />
        </div>
      </fieldset>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="form-actions">
        {isValidUrl(url) && (
          <a className="button ghost" href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={18} aria-hidden /> Abrir link
          </a>
        )}
        <span className="spacer" />
        <a className="button ghost" href="#/">
          Cancelar
        </a>
        <button className="primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
