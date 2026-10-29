import { useCallback, useEffect, useState } from 'react'
import { BookOpen, FolderOpen, HardDriveDownload, Link2, LogOut, Plus } from 'lucide-react'
import { store, type Category } from './data'
import { errorMessage } from './lib/errors'
import LoginScreen from './components/LoginScreen'
import Library from './components/Library'
import RecipeForm from './components/RecipeForm'
import RecipeDetail from './components/RecipeDetail'
import Categories from './components/Categories'
import QuickSave from './components/QuickSave'
import Backup from './components/Backup'

export type View =
  | { name: 'library' }
  | { name: 'new' }
  | { name: 'quick' }
  | { name: 'edit'; id: string }
  | { name: 'detail'; id: string }
  | { name: 'categories' }
  | { name: 'backup' }

// Rotas por hash: funcionam servidas pelo pb_public ou como arquivos estáticos, sem configuração no servidor.
function parseHash(): View {
  const [, page, id] = window.location.hash.split('/')
  if (page === 'nova') return { name: 'new' }
  if (page === 'salvar') return { name: 'quick' }
  if (page === 'categorias') return { name: 'categories' }
  if (page === 'backup') return { name: 'backup' }
  if (page === 'receita' && id) return { name: 'detail', id }
  if (page === 'editar' && id) return { name: 'edit', id }
  return { name: 'library' }
}

export function navigate(view: View) {
  const hash =
    view.name === 'new' ? '#/nova'
    : view.name === 'quick' ? '#/salvar'
    : view.name === 'categories' ? '#/categorias'
    : view.name === 'backup' ? '#/backup'
    : view.name === 'detail' ? `#/receita/${view.id}`
    : view.name === 'edit' ? `#/editar/${view.id}`
    : '#/'
  if (window.location.hash !== hash) window.location.hash = hash
}

const auth = store.auth

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => auth?.isLoggedIn() ?? true)
  const [view, setView] = useState<View>(parseHash)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState('')

  useEffect(() => auth?.onChange(() => setLoggedIn(auth.isLoggedIn())), [])

  useEffect(() => {
    const onHash = () => setView(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Ao abrir o app, renova a sessão salva (ou descarta se o token não vale mais).
  useEffect(() => {
    auth?.refresh()
  }, [])

  const reloadCategories = useCallback(async () => {
    try {
      setCategories(await store.listCategories())
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])

  useEffect(() => {
    if (loggedIn) reloadCategories()
  }, [loggedIn, reloadCategories])

  if (auth && !loggedIn) return <LoginScreen auth={auth} />

  const userName = auth?.userName()
  const notebookName = userName ? `Caderno de ${userName}` : 'Meu Caderno de Receitas'

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
          <a className={view.name === 'quick' ? 'active' : ''} href="#/salvar">
            <Link2 size={18} aria-hidden /> <span>Link</span>
          </a>
          <a className={view.name === 'new' ? 'active' : ''} href="#/nova">
            <Plus size={18} aria-hidden /> <span>Nova</span>
          </a>
          <a className={view.name === 'categories' ? 'active' : ''} href="#/categorias">
            <FolderOpen size={18} aria-hidden /> <span>Categorias</span>
          </a>
          <a className={view.name === 'backup' ? 'active' : ''} href="#/backup">
            <HardDriveDownload size={18} aria-hidden /> <span>Backup</span>
          </a>
          {auth && (
            <button className="ghost" onClick={() => auth.logout()} title="Sair">
              <LogOut size={18} aria-hidden /> <span>Sair</span>
            </button>
          )}
        </nav>
      </header>

      {error && (
        <div className="alert" role="alert" onClick={() => setError('')}>
          {error}
        </div>
      )}

      <main className="main">
        {view.name === 'library' && <Library categories={categories} />}
        {view.name === 'quick' && <QuickSave categories={categories} onCategoryCreated={reloadCategories} />}
        {view.name === 'new' && <RecipeForm categories={categories} onCategoryCreated={reloadCategories} />}
        {view.name === 'edit' && (
          <RecipeForm key={view.id} id={view.id} categories={categories} onCategoryCreated={reloadCategories} />
        )}
        {view.name === 'detail' && <RecipeDetail key={view.id} id={view.id} />}
        {view.name === 'categories' && <Categories categories={categories} onChanged={reloadCategories} />}
        {view.name === 'backup' && <Backup onRestored={reloadCategories} />}
      </main>
    </div>
  )
}
