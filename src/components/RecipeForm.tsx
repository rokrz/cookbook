import { useEffect, useState, type FormEvent } from 'react'
import { ImagePlus, Trash2, X } from 'lucide-react'
import { store, type Category, type Recipe, type RecipeFields } from '../data'
import { errorMessage } from '../lib/errors'
import { prepareImage } from '../lib/image'
import { navigate } from '../App'
import CategoryPicker from './CategoryPicker'

interface Props {
  id?: string
  categories: Category[]
  onCategoryCreated: () => Promise<void>
}

interface FormState {
  title: string
  category: string
  servings: string
  prep_minutes: string
  ingredients: string
  instructions: string
  notes: string
  source_url: string
  favorite: boolean
  tested: boolean
}

const EMPTY: FormState = {
  title: '',
  category: '',
  servings: '',
  prep_minutes: '',
  ingredients: '',
  instructions: '',
  notes: '',
  source_url: '',
  favorite: false,
  tested: false,
}

function fromRecipe(r: Recipe): FormState {
  return {
    title: r.title,
    category: r.category,
    servings: r.servings,
    prep_minutes: r.prep_minutes ? String(r.prep_minutes) : '',
    ingredients: r.ingredients,
    instructions: r.instructions,
    notes: r.notes,
    source_url: r.source_url,
    favorite: r.favorite,
    tested: r.tested,
  }
}

export default function RecipeForm({ id, categories, onCategoryCreated }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [original, setOriginal] = useState<Recipe | null>(null)
  const [newImage, setNewImage] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [removeImage, setRemoveImage] = useState(false)
  const [loading, setLoading] = useState(Boolean(id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    store
      .getRecipe(id)
      .then((r) => {
        setOriginal(r)
        setForm(fromRecipe(r))
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!newImage) return setPreview('')
    const url = URL.createObjectURL(newImage)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [newImage])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function pickImage(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      setNewImage(await prepareImage(file))
      setRemoveImage(false)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return setError('Dê um nome para a receita.')
    setBusy(true)
    setError('')
    const data: RecipeFields = {
      ...form,
      title: form.title.trim(),
      source_url: form.source_url.trim(),
      prep_minutes: form.prep_minutes ? Number(form.prep_minutes) : 0,
    }
    const image = newImage ?? (removeImage ? null : undefined)
    try {
      const saved = original
        ? await store.updateRecipe(original.id, data, image)
        : await store.createRecipe(data, image)
      navigate({ name: 'detail', id: saved.id })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  async function remove() {
    if (!original || !window.confirm(`Excluir "${original.title}"? Essa ação não pode ser desfeita.`)) return
    setBusy(true)
    try {
      await store.deleteRecipe(original.id)
      navigate({ name: 'library' })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  if (loading) return <p className="muted">Carregando receita…</p>

  const hasCurrentImage = Boolean(original?.image) && !removeImage && !newImage

  return (
    <form className="recipe-form" onSubmit={submit}>
      <h1>{original ? 'Editar receita' : 'Nova receita'}</h1>

      <fieldset>
        <legend>Sobre a receita</legend>
        <label>
          Nome *
          <input required maxLength={200} value={form.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        <div className="row">
          <div className="field">
            <span>Categoria</span>
            <CategoryPicker
              value={form.category}
              categories={categories}
              onChange={(c) => set('category', c)}
              onCreated={onCategoryCreated}
            />
          </div>
          <label>
            Rendimento
            <input placeholder="Ex.: 8 fatias" maxLength={100} value={form.servings} onChange={(e) => set('servings', e.target.value)} />
          </label>
          <label>
            Preparo (min)
            <input
              type="number"
              min={0}
              max={10000}
              inputMode="numeric"
              value={form.prep_minutes}
              onChange={(e) => set('prep_minutes', e.target.value)}
            />
          </label>
        </div>
        <div className="checks">
          <label className="check">
            <input type="checkbox" checked={form.favorite} onChange={(e) => set('favorite', e.target.checked)} /> Favorita
          </label>
          <label className="check">
            <input type="checkbox" checked={form.tested} onChange={(e) => set('tested', e.target.checked)} /> Já testada
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Foto</legend>
        <div className="photo-field">
          {preview && <img src={preview} alt="Nova foto" className="photo-preview" />}
          {hasCurrentImage && <p className="muted small">A receita já tem uma foto. Envie outra para substituir.</p>}
          {removeImage && <p className="muted small">A foto será removida ao salvar.</p>}
          <div className="photo-actions">
            <label className="button">
              <ImagePlus size={18} aria-hidden /> {original?.image || newImage ? 'Trocar foto' : 'Escolher foto'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                hidden
                onChange={(e) => {
                  pickImage(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            {newImage && (
              <button type="button" className="ghost" onClick={() => setNewImage(null)}>
                <X size={18} aria-hidden /> Descartar nova foto
              </button>
            )}
            {hasCurrentImage && (
              <button type="button" className="ghost" onClick={() => setRemoveImage(true)}>
                <Trash2 size={18} aria-hidden /> Remover foto
              </button>
            )}
          </div>
          <p className="muted small">JPEG, PNG, WebP ou HEIC, até 5 MB. Fotos grandes são reduzidas automaticamente.</p>
        </div>
      </fieldset>

      <fieldset>
        <legend>Preparo</legend>
        <label>
          Ingredientes <span className="muted small">(um por linha)</span>
          <textarea rows={8} value={form.ingredients} onChange={(e) => set('ingredients', e.target.value)} />
        </label>
        <label>
          Modo de preparo
          <textarea rows={10} value={form.instructions} onChange={(e) => set('instructions', e.target.value)} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Anotações e origem</legend>
        <label>
          Anotações pessoais
          <textarea rows={4} placeholder="Ajustes, substituições, o que deu certo…" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
        <label>
          URL da fonte original
          <input type="url" placeholder="https://" value={form.source_url} onChange={(e) => set('source_url', e.target.value)} />
        </label>
      </fieldset>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="form-actions">
        {original && (
          <button type="button" className="danger" onClick={remove} disabled={busy}>
            <Trash2 size={18} aria-hidden /> Excluir
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="ghost" onClick={() => history.back()} disabled={busy}>
          Cancelar
        </button>
        <button className="primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar receita'}
        </button>
      </div>
    </form>
  )
}
