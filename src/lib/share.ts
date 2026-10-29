import { readShared, type SharedLink } from './links'

// Recebe o que vem do menu Compartilhar do Android (share_target no manifesto):
// o sistema abre /?title=...&text=...&url=... e o app guarda o link até a tela Salvar link abrir.

const KEY = 'caderno:compartilhado'

export function captureShare(): void {
  const params = new URLSearchParams(window.location.search)
  if (!['title', 'text', 'url'].some((k) => params.has(k))) return
  const shared = readShared({ title: params.get('title'), text: params.get('text'), url: params.get('url') })
  try {
    if (shared) sessionStorage.setItem(KEY, JSON.stringify(shared))
  } catch {
    // Sem sessionStorage (modo privado restrito): segue sem pré-preencher.
  }
  history.replaceState(null, '', `${window.location.pathname}#/salvar`)
}

export function peekShare(): SharedLink | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SharedLink) : null
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
