import { hasRecipe, parseCaption } from './caption'
import { readShared } from './links'

// Recebe o que vem do menu Compartilhar do Android (share_target no manifesto):
// o sistema abre /?title=...&text=...&url=... e o app guarda o que veio até a tela abrir.
// Com link: vai para Salvar link. Sem link, mas com uma receita no texto (legenda copiada,
// texto selecionado no "Circule para Pesquisar"...): vai para Nova receita já preenchida.

const KEY = 'caderno:compartilhado'

export interface SharedItem {
  url: string
  title: string
  // Texto que veio junto, sem o link (às vezes é a legenda do post).
  text: string
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/gi

export function captureShare(): void {
  const params = new URLSearchParams(window.location.search)
  if (!['title', 'text', 'url'].some((k) => params.has(k))) return
  const title = params.get('title')
  const text = params.get('text')
  const link = readShared({ title, text, url: params.get('url') })
  const caption = (text ?? '').replace(URL_IN_TEXT, '').trim()

  let shared: SharedItem | null = null
  let page = 'salvar'
  if (link) shared = { ...link, text: caption }
  else if (caption && hasRecipe(parseCaption(caption))) {
    shared = { url: '', title: '', text: caption }
    page = 'nova'
  }
  try {
    if (shared) sessionStorage.setItem(KEY, JSON.stringify(shared))
  } catch {
    // Sem sessionStorage (modo privado restrito): segue sem pré-preencher.
  }
  history.replaceState(null, '', `${window.location.pathname}#/${page}`)
}

export function peekShare(): SharedItem | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<SharedItem>
    return { url: s.url ?? '', title: s.title ?? '', text: s.text ?? '' }
  } catch {
    return null
  }
}

export function clearShare(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignora
  }
}
