// Links de posts e sites: limpeza, rede de origem e leitura do que vem do menu Compartilhar.

export type Platform = 'instagram' | 'tiktok' | 'facebook' | 'pinterest' | 'youtube' | 'site'

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  pinterest: 'Pinterest',
  youtube: 'YouTube',
  site: 'Site',
}

const PLATFORM_HOSTS: [Platform, RegExp][] = [
  ['instagram', /(^|\.)(instagram\.com|instagr\.am)$/],
  ['tiktok', /(^|\.)tiktok\.com$/],
  ['facebook', /(^|\.)(facebook\.com|fb\.com|fb\.watch)$/],
  ['pinterest', /(^|\.)(pinterest\.[a-z.]+|pin\.it)$/],
  ['youtube', /(^|\.)(youtube\.com|youtu\.be)$/],
]

// Parâmetros de rastreio que só deixam o link diferente para o mesmo post.
const TRACKING = /^(utm_\w+|igsh|igshid|fbclid|gclid|si|_r|_t|share_\w+|mibextid|is_from_webapp|sender_device|feature)$/i

function parse(url: string): URL | null {
  try {
    const u = new URL(url.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null
  } catch {
    return null
  }
}

export function isValidUrl(url: string): boolean {
  return parse(url) !== null
}

// Remove rastreio, fragmento e barra final para comparar links do mesmo post.
export function normalizeUrl(url: string): string {
  const u = parse(url)
  if (!u) return url.trim()
  for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key)
  u.hash = ''
  u.hostname = u.hostname.toLowerCase()
  let out = u.toString()
  if (u.pathname.length > 1 && out.endsWith('/') && !u.search) out = out.slice(0, -1)
  return out
}

export function detectPlatform(url: string): Platform | null {
  const u = parse(url)
  if (!u) return null
  const host = u.hostname.toLowerCase()
  return PLATFORM_HOSTS.find(([, re]) => re.test(host))?.[0] ?? 'site'
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/i

export interface SharedLink {
  url: string
  title: string
}

// Os apps mandam o link em `url`, em `text` ("Veja este post... https://...") ou até em `title`.
export function readShared(params: { title?: string | null; text?: string | null; url?: string | null }): SharedLink | null {
  const fields = [params.url, params.text, params.title].map((v) => v?.trim() ?? '')
  const found = fields.map((f) => f.match(URL_IN_TEXT)?.[0]).find(Boolean)
  if (!found) return null
  const url = found.replace(/[.,;:!?)\]]+$/, '')

  // Nome sugerido: o título compartilhado ou o texto sem o link, na primeira linha.
  const candidates = [params.title, params.text].map((v) => (v ?? '').replace(URL_IN_TEXT, '').trim())
  const firstLine = candidates.map((c) => c.split('\n').map((l) => l.trim()).find(Boolean) ?? '').find(Boolean) ?? ''
  const title = firstLine.length > 200 ? firstLine.slice(0, 197).trimEnd() + '…' : firstLine
  return { url, title }
}
