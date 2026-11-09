import { Capacitor, registerPlugin } from '@capacitor/core'

// Backup no Google Drive do próprio usuário, numa pasta escondida do app (appDataFolder):
// só este app enxerga esses arquivos, e eles contam no espaço do Drive da pessoa.
//
// Login:
// - APK: plugin nativo (GoogleDrivePlugin.java) com a API de autorização do Google Play Services.
//   Não precisa de client ID no código; o Google reconhece o app pelo pacote + assinatura (SHA-1)
//   cadastrados no Google Cloud Console.
// - Navegador: Google Identity Services, com o client ID da Web em VITE_GOOGLE_CLIENT_ID.
// Passo a passo da configuração: docs/google-drive.md

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const PREFIX = 'caderno-de-receitas-'
// Quantos backups manter no Drive (os mais antigos são apagados).
export const KEEP_BACKUPS = 7

interface NativeDrive {
  authorize(options: { interactive: boolean }): Promise<{ accessToken?: string }>
  // Tira o token do cache do Play Services (expirado ou revogado).
  clearToken(options: { token: string }): Promise<void>
}

const NativeDrive = registerPlugin<NativeDrive>('GoogleDrive')

export class DriveError extends Error {
  constructor(message: string, readonly code = '') {
    super(message)
  }
}

export interface DriveBackup {
  id: string
  name: string
  size: number
  createdTime: string
}

const WEB_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? ''

// No APK sempre aparece (a configuração fica no Google Cloud). No navegador, só com client ID.
export function driveAvailable(): boolean {
  return Capacitor.isNativePlatform() || Boolean(WEB_CLIENT_ID)
}

// ------------------------------------------------------------------- token

let cached: { token: string; until: number } | null = null

async function forget(token: string) {
  cached = null
  if (Capacitor.isNativePlatform()) await NativeDrive.clearToken({ token }).catch(() => {})
}

function nativeMessage(e: unknown): DriveError {
  const code = String((e as { code?: unknown })?.code ?? '')
  const text = String((e as { message?: unknown })?.message ?? e)
  if (code === 'CANCELED') return new DriveError('Login no Google cancelado.', code)
  // 10 = DEVELOPER_ERROR: pacote/SHA-1 não cadastrados no Google Cloud ou Drive API desligada.
  if (code === '10') {
    return new DriveError(
      'O app ainda não está liberado no Google Cloud (pacote ou SHA-1 não cadastrados). Veja docs/google-drive.md.',
      code,
    )
  }
  if (code === '7') return new DriveError('Sem conexão com a internet.', code)
  return new DriveError(`Não foi possível entrar no Google: ${text}`, code)
}

// ---- navegador (Google Identity Services)

interface TokenResponse {
  access_token?: string
  expires_in?: number | string
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken(options?: { prompt?: string }): void
}

interface GoogleOAuth {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (r: TokenResponse) => void
    error_callback?: (e: { type?: string; message?: string }) => void
  }): TokenClient
  revoke(token: string, done?: () => void): void
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth } }
  }
}

let gisLoading: Promise<GoogleOAuth> | null = null

function loadGis(): Promise<GoogleOAuth> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2)
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => (window.google?.accounts?.oauth2 ? resolve(window.google.accounts.oauth2) : reject(new DriveError('Falha ao carregar o login do Google.')))
    s.onerror = () => {
      gisLoading = null
      reject(new DriveError('Falha ao carregar o login do Google. Verifique a internet.'))
    }
    document.head.appendChild(s)
  })
  return gisLoading
}

async function webToken(): Promise<{ token: string; expiresIn: number }> {
  if (!WEB_CLIENT_ID) throw new DriveError('Backup no Drive não configurado nesta versão (falta VITE_GOOGLE_CLIENT_ID).')
  const oauth = await loadGis()
  return new Promise((resolve, reject) => {
    const client = oauth.initTokenClient({
      client_id: WEB_CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (r.access_token) resolve({ token: r.access_token, expiresIn: Number(r.expires_in) || 3600 })
        else reject(new DriveError(`Não foi possível entrar no Google: ${r.error_description || r.error || 'erro desconhecido'}`))
      },
      error_callback: (e) =>
        reject(new DriveError(e.type === 'popup_closed' ? 'Login no Google cancelado.' : `Não foi possível entrar no Google: ${e.message ?? e.type}`)),
    })
    client.requestAccessToken()
  })
}

// interactive = pode mostrar a tela do Google (escolher conta, autorizar).
// Sem interação, devolve null se ainda precisar que a pessoa autorize.
export async function getToken(interactive: boolean): Promise<string | null> {
  if (cached && Date.now() < cached.until) return cached.token
  if (Capacitor.isNativePlatform()) {
    let result: { accessToken?: string }
    try {
      result = await NativeDrive.authorize({ interactive })
    } catch (e) {
      throw nativeMessage(e)
    }
    if (!result.accessToken) return null
    // O Play Services renova sozinho; guardamos por pouco tempo só para evitar chamadas repetidas.
    cached = { token: result.accessToken, until: Date.now() + 10 * 60_000 }
    return result.accessToken
  }
  // No navegador o login abre uma janela; sem interação, só serve o token que já temos.
  if (!interactive) return null
  const { token, expiresIn } = await webToken()
  cached = { token, until: Date.now() + (expiresIn - 120) * 1000 }
  return token
}

// Esquece o token e revoga o acesso do app ao Drive na conta Google.
export async function disconnect(): Promise<void> {
  const token = cached?.token ?? (await getToken(false).catch(() => null))
  if (!token) return
  await forget(token)
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }).catch(() => {})
}

// ------------------------------------------------------------------- API

async function call(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })
  } catch {
    throw new DriveError('Sem conexão com o Google Drive. Verifique a internet.')
  }
  if (res.ok) return res
  if (res.status === 401) {
    await forget(token)
    throw new DriveError('A autorização do Google expirou. Tente de novo.', '401')
  }
  let detail = ''
  try {
    detail = (await res.json())?.error?.message ?? ''
  } catch {
    // ignora
  }
  if (res.status === 403 && /has not been used|is disabled/i.test(detail)) {
    throw new DriveError('A Google Drive API não está ativada no projeto do Google Cloud. Veja docs/google-drive.md.', '403')
  }
  if (res.status === 403 && /storage quota/i.test(detail)) {
    throw new DriveError('Seu Google Drive está sem espaço.', '403')
  }
  throw new DriveError(`Erro do Google Drive (${res.status})${detail ? `: ${detail}` : ''}`, String(res.status))
}

// Faz a chamada e, se o token tiver expirado, pega outro e tenta mais uma vez.
export async function withDrive<T>(interactive: boolean, fn: (token: string) => Promise<T>): Promise<T | null> {
  const token = await getToken(interactive)
  if (!token) return null
  try {
    return await fn(token)
  } catch (e) {
    if (!(e instanceof DriveError) || e.code !== '401') throw e
    const again = await getToken(interactive)
    return again ? fn(again) : null
  }
}

export async function accountEmail(token: string): Promise<string> {
  try {
    const res = await call(token, `${API}/about?fields=user(emailAddress)`)
    return (await res.json())?.user?.emailAddress ?? ''
  } catch {
    return ''
  }
}

export async function listBackups(token: string): Promise<DriveBackup[]> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name contains '${PREFIX}' and trashed = false`,
    orderBy: 'createdTime desc',
    pageSize: '100',
    fields: 'files(id,name,size,createdTime)',
  })
  const res = await call(token, `${API}/files?${params}`)
  const files: (Omit<DriveBackup, 'size'> & { size?: string })[] = (await res.json()).files ?? []
  return files.map((f) => ({ ...f, size: Number(f.size) || 0 }))
}

// Envio em duas etapas (resumable): aceita arquivos grandes, com muitas fotos.
export async function uploadBackup(token: string, blob: Blob, date = new Date()): Promise<DriveBackup> {
  const name = `${PREFIX}${date.toISOString().slice(0, 19).replace(/:/g, '-')}.json`
  const start = await call(token, `${UPLOAD}/files?uploadType=resumable&fields=id,name,size,createdTime`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/json',
      'X-Upload-Content-Length': String(blob.size),
    },
    body: JSON.stringify({ name, parents: ['appDataFolder'], mimeType: 'application/json' }),
  })
  const location = start.headers.get('Location')
  if (!location) throw new DriveError('O Google Drive não aceitou o envio. Tente de novo.')
  const res = await call(token, location, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: blob })
  const f = await res.json()
  return { ...f, size: Number(f.size) || blob.size }
}

export async function downloadBackup(token: string, id: string): Promise<Blob> {
  return (await call(token, `${API}/files/${encodeURIComponent(id)}?alt=media`)).blob()
}

export async function deleteBackup(token: string, id: string): Promise<void> {
  await call(token, `${API}/files/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// Apaga os backups mais antigos, mantendo os KEEP_BACKUPS mais recentes.
export async function pruneBackups(token: string): Promise<void> {
  const list = await listBackups(token)
  for (const f of list.slice(KEEP_BACKUPS)) await deleteBackup(token, f.id).catch(() => {})
}
