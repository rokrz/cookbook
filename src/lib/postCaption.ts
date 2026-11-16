import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { detectPlatform, type Platform } from './links'

// Buscar a legenda pelo link. Só o TikTok oferece isso sem login nem chave: o oEmbed público
// (https://www.tiktok.com/oembed) devolve a descrição do vídeo no campo "title".
// Instagram e Facebook exigem token de desenvolvedor e mesmo assim não devolvem a legenda;
// Pinterest e YouTube só devolvem o título. Nesses casos a pessoa cola a legenda.

export function canFetchCaption(url: string): boolean {
  return detectPlatform(url) === 'tiktok'
}

// Como copiar a legenda em cada rede, para quando não dá para buscar.
export function copyHint(platform: Platform | null): string {
  if (platform === 'instagram' || platform === 'facebook')
    return 'O app não deixa copiar a legenda direto. No Android, use “Circule para Pesquisar” ou a opção “Selecionar” na tela de apps recentes, ou abra o post no navegador, e copie o texto.'
  if (platform === 'tiktok') return 'Toque na descrição do vídeo para abrir o texto todo, segure para copiar e cole aqui.'
  if (platform === 'youtube') return 'Abra a descrição do vídeo, segure o texto para copiar e cole aqui.'
  return 'Copie o texto da receita (legenda, descrição ou página) e cole aqui.'
}

async function getJson(url: string): Promise<{ status: number; data: unknown; finalUrl: string }> {
  if (Capacitor.isNativePlatform()) {
    // Pelo app Android a requisição sai pelo sistema, sem a restrição de CORS do navegador.
    const r = await CapacitorHttp.get({ url, responseType: 'json' })
    return { status: r.status, data: r.data, finalUrl: r.url }
  }
  const r = await fetch(url)
  return { status: r.status, data: r.ok ? await r.json() : null, finalUrl: r.url }
}

// Links curtos (vm.tiktok.com/...) redirecionam para o vídeo; o oEmbed precisa do link completo.
async function expandShortLink(url: string): Promise<string> {
  if (!Capacitor.isNativePlatform() || !/\/\/(vm|vt)\.tiktok\.com\//i.test(url)) return url
  try {
    const r = await CapacitorHttp.get({ url, responseType: 'text' })
    return r.url || url
  } catch {
    return url
  }
}

export async function fetchCaption(url: string): Promise<string> {
  if (!canFetchCaption(url)) throw new Error('Só dá para buscar a legenda de vídeos do TikTok. Cole a legenda no campo.')
  let r
  try {
    const full = await expandShortLink(url)
    r = await getJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(full)}`)
  } catch {
    throw new Error('Não foi possível falar com o TikTok. Confira a internet ou cole a legenda no campo.')
  }
  const title = (r.data as { title?: unknown } | null)?.title
  if (r.status !== 200 || typeof title !== 'string' || !title.trim()) {
    throw new Error('O TikTok não devolveu a legenda deste vídeo (pode ser privado ou removido). Cole a legenda no campo.')
  }
  return title.trim()
}
