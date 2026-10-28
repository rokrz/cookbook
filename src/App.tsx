import { useCallback, useEffect, useState } from 'react'
import { BookOpen, FolderOpen, LogOut, Plus } from 'lucide-react'
import type { RecordModel } from 'pocketbase'
import { categoriesCol, pb, type Category } from './lib/pb'
import { errorMessage } from './lib/errors'
import LoginScreen from './components/LoginScreen'
import Library from './components/Library'
import RecipeForm from './components/RecipeForm'
import RecipeDetail from './components/RecipeDetail'
import Categories from './components/Categories'

export type View =
  | { name: 'library' }
  | { name: 'new' }
  | { name: 'edit'; id: string }
  | { name: 'detail'; id: string }
  | { name: 'categories' }

// Rotas por hash: funcionam servidas pelo pb_public sem configuração extra no servidor.
function parseHash(): View {
  const [, page, id] = window.location.hash.split('/')
  if (page === 'nova') return { name: 'new' }
  if (page === 'categorias') return { name: 'categories' }
  if (page === 'receita' && id) return { name: 'detail', id }
  if (page === 'editar' && id) return { name: 'edit', id }
  return { name: 'library' }
}

export function navigate(view: View) {
  const hash =
    view.name === 'new' ? '#/nova'
    : view.name === 'categories' ? '#/categorias'
    : view.name === 'detail' ? `#/receita/${view.id}`
    : view.name === 'edit' ? `#/editar/${view.id}`
    : '#/'
  if (window.location.hash !== hash) window.location.hash = hash
}

export default function App() {
  const [user, setUser] = useState<RecordModel | null>(pb.authStore.isValid ? pb.authStore.record : null)
  const [view, setView] = useState<View>(parseHash)
  const [categories, setCategories] = useState<Category[]>([])
  const [fileToken, setFileToken] = useState('')
  const [error, setError] = useState('')

  useEffect(() => pb.authStore.onChange(() => setUser(pb.authStore.isValid ? pb.authStore.record : null)), [])

  useEffect(() => {
    const onHash = () => setView(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Ao abrir o app, renova a sessão salva (ou descarta se o token não vale mais).
  useEffect(() => {
    if (pb.authStore.isValid) pb.collection('users').authRefresh().catch(() => pb.authStore.clear())
  }, [])

  const reloadCategories = useCallback(async () => {
    try {
      setCategories(await categoriesCol().getFullList({ sort: 'name' }))
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])

  const refreshFileToken = useCallback(async () => {
    try {
      setFileToken(await pb.files.getToken())
    } catch {
      setFileToken('')
    }
  }, [])

  useEffect(() => {
    if (!user) return
    reloadCategories()
    refreshFileToken()
  }, [user, reloadCategories, refreshFileToken])

  if (!user) return <LoginScreen />

  const notebookName = (user.name as string) ? `Caderno de ${user.name}` : 'Meu Caderno de Receitas'

  return (
    <div className="app">
      <header className="header">
        <a className="brand" href="#/">
          <BookOpen size={26} aria-hidden />
          <span>{notebookName}</span>
        </a>
        <nav className="nav">
          <a className={view.name === 'library' || view.name === 'detail' ? 'active' : ''} href="#/">
            <BookOpen size={18} aria-hidden /> <span>Receitas</span>
          </a>
          <a className={view.name === 'new' ? 'active' : ''} href="#/nova">
            <Plus size={18} aria-hidden /> <span>Nova</span>
          </a>
          <a className={view.name === 'categories' ? 'active' : ''} href="#/categorias">
            <FolderOpen size={18} aria-hidden /> <span>Categorias</span>
          </a>
          <button className="ghost" onClick={() => pb.authStore.clear()} title="Sair">
            <LogOut size={18} aria-hidden /> <span>Sair</span>
          </button>
        </nav>
      </header>

      {error && (
        <div className="alert" role="alert" onClick={() => setError('')}>
          {error}
        </div>
      )}

      <main className="main">
        {view.name === 'library' && (
          <Library categories={categories} fileToken={fileToken} onRefreshToken={refreshFileToken} />
        )}
        {view.name === 'new' && <RecipeForm categories={categories} />}
        {view.name === 'edit' && <RecipeForm key={view.id} id={view.id} categories={categories} />}
        {view.name === 'detail' && (
          <RecipeDetail key={view.id} id={view.id} fileToken={fileToken} onRefreshToken={refreshFileToken} />
        )}
        {view.name === 'categories' && <Categories categories={categories} onChanged={reloadCategories} />}
      </main>
    </div>
  )
}
