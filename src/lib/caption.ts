// Lê a legenda de um post (Instagram, TikTok, blog...) e separa ingredientes, modo de preparo,
// dicas, rendimento e tempo. Tudo acontece no aparelho, sem internet: é só uma leitura do texto
// por regras, então o resultado vai para o formulário para a pessoa conferir antes de salvar.

export interface ParsedCaption {
  title: string
  ingredients: string
  instructions: string
  notes: string
  servings: string
  prep_minutes: number
  // Quantidades encontradas, para mostrar "8 ingredientes e 5 passos".
  ingredientCount: number
  stepCount: number
}

type Section = 'ingredients' | 'steps' | 'notes'

// Sem acentos e minúsculo (mesma ideia de lib/text.ts, repetida aqui para o arquivo não ter dependências).
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const HEADERS: [Section, RegExp][] = [
  [
    'ingredients',
    /^(lista de )?ingredientes?\b|^ingredients?\b|^(o que )?(voce )?(vai )?precisar( de)?\b|^o que (voce )?precisa\b|^vai precisar\b|^ingredientes que\b/,
  ],
  [
    'steps',
    /^(modo|forma|maneira) de (preparo|preparar|fazer)\b|^preparo\b|^preparacao\b|^como (fazer|preparar)\b|^passo a passo\b|^instruc(ao|oes)\b|^metodo\b|^procedimento\b|^elaboracion\b|^instructions?\b|^directions?\b|^method\b|^preparation\b|^steps?\b|^how to( make)?\b/,
  ],
  ['notes', /^dicas?\b|^observac(ao|oes)\b|^obs\b|^notas?\b|^tips?\b|^notes?\b|^importante\b/],
]

// Começo de linha que indica quantidade: "2", "1/2", "½", "1,5", "meia", "uma"...
const QUANTITY =
  /^(\d+([.,/]\d+)?|[½¼¾⅓⅔⅛]|meia|meio|uma?|duas|dois|tres|quatro|cinco|seis|sete|oito|nove|dez|doze|algumas?|alguns|pitada|punhado|fio|a gosto)(\s|$|[a-z])/

const STEP_START =
  /^(misture|mistura|bata|bater|adicione|acrescente|coloque|leve|asse|despeje|unte|pre-?aque[cç]a|preaqueca|junte|mexa|cozinhe|refogue|frite|deixe|sirva|corte|pique|derreta|retire|espalhe|cubra|polvilhe|tempere|ferva|aque[cç]a|separe|incorpore|peneire|reserve|transfira|enrole|modele|abra|recheie|finalize|decore|desligue|ligue|doure|escorra|lave|descasque|rale|triture|processe|amasse|sove|hidrate|dissolva|desenforme|em (uma|um)|numa|num|no liquidificador|na batedeira|depois|quando|apos|agora|por (fim|ultimo)|primeiro|em seguida|mix|add|bake|stir|preheat|combine|pour|place|whisk|cook|heat|serve|blend)\b/

const JUNK =
  /^(link na bio|salv[ae] (ess[ae]|este|esta|o post|pra|para)|siga( a| o)? @|segue( a| o)? @|comente|marque|curta|compartilhe|ver traducao|see translation|mais receitas|receita completa no|confira|me (siga|segue)|ativa o sininho|follow)/

const SERVINGS = /^(rende|rendimento|serve|porc(ao|oes)|yield|serves|makes)\b\s*(de|cerca de|aprox\.?|aproximadamente)?\s*:?\s*/
const TIME = /^(tempo( de preparo| total| de forno)?|preparo|total time|prep time|time)\s*:?\s*(?=\d)/

// Emojis e marcadores no começo de linha ("✅ ", "• ", "- ", "▪️ ", "➡️ ").
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}️‍⃣]/gu
const BULLET = /^[\s\-–—•·▪▫◾◽■□●○◦‣⁃➤→►▶✓✔☑*~>+|_]+/
const NUMBERED = /^(passo\s*)?(\d{1,2})\s*(º|°|[.)\-:]|\s-)\s*/i
const URL = /https?:\/\/\S+|www\.\S+/gi
const TRAILING_TAGS = /(\s+[#@][\p{L}\p{N}_.]+)+\s*$/u
const ONLY_TAGS = /^([#@][\p{L}\p{N}_.]+[\s,.]*)+$/u

interface Line {
  text: string
  numbered: boolean
}

// Prepara as linhas: tira links, hashtags do fim, emojis e marcadores; "1️⃣" vira "1.".
function splitLines(raw: string): Line[] {
  let text = raw.replace(/\r\n?/g, '\n').replace(/(\d)️?⃣/g, '\n$1. ')

  // Legenda numa linha só (comum no TikTok): quebra antes de títulos e de passos numerados.
  text = text
    .split('\n')
    .map((l) => {
      if (l.length < 120) return l
      return l
        .replace(/\s*(ingredientes?|modo de preparo|modo de fazer|preparo|como fazer|dicas?)\s*:/gi, '\n$1:')
        .replace(/\s+(\d{1,2}[.)])\s+(?=\p{L})/gu, '\n$1 ')
        .replace(/\s*[•▪▫◾◽●➡➤►✅✔☑🔸🔹▶]️?\s*/gu, '\n')
    })
    .join('\n')

  const out: Line[] = []
  for (const original of text.split('\n')) {
    let l = original.replace(URL, '').replace(EMOJI, ' ').replace(/\s+/g, ' ').trim()
    l = l.replace(BULLET, '').trim()
    if (!l || ONLY_TAGS.test(l) || /^[.\-_=~*•·]+$/.test(l)) continue
    l = l.replace(TRAILING_TAGS, '').trim()
    if (!l || JUNK.test(fold(l))) continue
    const m = l.match(NUMBERED)
    // "1. Misture..." é passo numerado; "1 xícara" não (sem pontuação depois do número).
    const numbered = Boolean(m && l.length > m[0].length)
    if (numbered) l = l.slice(m![0].length).trim()
    // Negrito do WhatsApp/markdown: *Ingredientes* → Ingredientes
    l = l.replace(/^[*_]+|[*_]+$/g, '').trim()
    if (l) out.push({ text: l, numbered })
  }
  return out
}

function headerOf(text: string): { section: Section; rest: string } | null {
  const f = fold(text).replace(/^[*_\s]+/, '')
  for (const [section, re] of HEADERS) {
    const m = f.match(re)
    if (!m) continue
    const after = text.slice(m[0].length).trim()
    const colon = after.match(/^[^:]{0,30}:\s*(.*)$/)
    if (colon) return { section, rest: colon[1].trim() }
    // "Ingredientes (para 1 forma)" ou "Modo de preparo 👇" sem dois-pontos.
    if (after.length <= 30 && !/[.!?]$/.test(after)) return { section, rest: '' }
    return null
  }
  return null
}

// "Massa:", "Para a cobertura:", "RECHEIO" — título de parte dentro de uma seção.
function isSubheader(text: string): boolean {
  if (text.length > 40 || /\d/.test(text)) return false
  if (/:$/.test(text)) return true
  if (/^para (a|o|as|os) \S+/i.test(text) && text.split(' ').length <= 4) return true
  return text.length >= 4 && text === text.toUpperCase() && /\p{Lu}/u.test(text) && text.split(' ').length <= 3
}

function looksLikeIngredient(text: string): boolean {
  const f = fold(text)
  if (text.length > 90 || STEP_START.test(f)) return false
  if (QUANTITY.test(f)) return true
  // "Sal a gosto", "Óleo para untar", "Canela (opcional)".
  return /\b(a gosto|q\.?b\.?|opcional|para polvilhar|para untar|para decorar)\b/.test(f)
}

function looksLikeStep(line: Line): boolean {
  const f = fold(line.text)
  if (STEP_START.test(f)) return true
  if (line.numbered && !looksLikeIngredient(line.text)) return true
  return line.text.length > 70 && /[.!]$/.test(line.text)
}

// "1h30", "40 min", "1 hora e 20 minutos" → minutos.
export function parseMinutes(text: string): number {
  const f = fold(text)
  const h = f.match(/(\d+)\s*(horas?|hrs?|h)(?![a-z])\s*(e\s*)?(\d+)?/)
  const m = f.match(/(\d+)\s*(minutos?|min)(?![a-z])/)
  let total = 0
  if (h) total += Number(h[1]) * 60 + (h[4] && !m ? Number(h[4]) : 0)
  if (m) total += Number(m[1])
  return total
}

function cleanTitle(text: string): string {
  let t = text.replace(/[:!]+$/, '').trim()
  if (t.length > 80) t = t.split(/(?<=[.!?])\s/)[0]
  if (t.length > 80) t = t.slice(0, 77).trimEnd() + '…'
  return t
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1)
}

// Ingredientes numa linha só: "Ingredientes: 2 ovos, 1 xícara de açúcar e 1,5 xícara de farinha".
function splitInlineList(text: string): string[] {
  return text
    .split(/;|,\s+(?!\d+\s*(?:ml|g|kg)\b)|\s+e\s+(?=\d)/)
    .map((s) => s.trim().replace(/[.;]$/, ''))
    .filter(Boolean)
}

function formatSteps(lines: Line[]): { text: string; count: number } {
  const anyNumbered = lines.some((l) => l.numbered)
  const groups: { header?: string; steps: string[] }[] = [{ steps: [] }]
  for (const l of lines) {
    const current = groups[groups.length - 1]
    if (isSubheader(l.text) && !l.numbered) {
      groups.push({ header: l.text.replace(/:?$/, ':'), steps: [] })
      continue
    }
    // Com passos numerados, linha sem número continua o passo anterior.
    if (anyNumbered && !l.numbered && current.steps.length) {
      current.steps[current.steps.length - 1] += ' ' + l.text
      continue
    }
    current.steps.push(capitalize(l.text))
  }
  const parts: string[] = []
  let count = 0
  for (const g of groups) {
    if (!g.header && !g.steps.length) continue
    const block = g.steps.length > 1 ? g.steps.map((s, i) => `${i + 1}. ${s}`) : g.steps
    count += g.steps.length
    parts.push([g.header, ...block].filter(Boolean).join('\n'))
  }
  return { text: parts.join('\n\n'), count }
}

export function parseCaption(raw: string): ParsedCaption {
  const lines = splitLines(raw)
  let servings = ''
  let prep = 0
  const kept: Line[] = []

  // Rendimento e tempo podem aparecer em qualquer lugar.
  for (const l of lines) {
    const f = fold(l.text)
    if (!servings && SERVINGS.test(f) && l.text.length <= 60) {
      const value = l.text.replace(/^\S+\s*/, '').replace(/^(de|cerca de|aprox\.?|aproximadamente)\s+/i, '').replace(/^:\s*/, '')
      if (value) {
        servings = value.replace(/[.!]$/, '').slice(0, 100)
        continue
      }
    }
    if (!prep && TIME.test(f) && l.text.length <= 60) {
      const minutes = parseMinutes(l.text)
      if (minutes) {
        prep = minutes
        continue
      }
    }
    kept.push(l)
  }

  const buckets: Record<Section, Line[]> = { ingredients: [], steps: [], notes: [] }
  const preamble: Line[] = []
  let section: Section | null = null
  let sawHeader = false

  for (const l of kept) {
    const h = headerOf(l.text)
    if (h && !l.numbered) {
      section = h.section
      sawHeader = true
      if (h.rest) {
        if (section === 'ingredients' && !STEP_START.test(fold(h.rest))) {
          buckets.ingredients.push(...splitInlineList(h.rest).map((text) => ({ text, numbered: false })))
        } else buckets[section].push({ text: h.rest, numbered: false })
      }
      continue
    }
    if (section) {
      // Sem título de modo de preparo: o primeiro passo depois dos ingredientes encerra a lista.
      if (section === 'ingredients' && looksLikeStep(l) && !buckets.steps.length && buckets.ingredients.length) {
        section = 'steps'
      }
      buckets[section].push(l)
    } else preamble.push(l)
  }

  // Sem nenhum título: decide linha a linha pelo jeito do texto.
  if (!sawHeader) {
    preamble.length = 0
    let inSteps = false
    for (const l of kept) {
      if (!inSteps && looksLikeStep(l) && (buckets.ingredients.length || l.numbered)) inSteps = true
      if (inSteps) buckets.steps.push(l)
      else if (looksLikeIngredient(l.text)) buckets.ingredients.push(l)
      else if (buckets.ingredients.length && isSubheader(l.text)) buckets.ingredients.push(l)
      else if (!buckets.ingredients.length) preamble.push(l)
    }
    // Uma linha solta que parece ingrediente não faz uma receita.
    if (buckets.ingredients.length < 2 && !buckets.steps.length) {
      buckets.ingredients = []
    }
  }

  const ingredientLines = buckets.ingredients.map((l) =>
    isSubheader(l.text) ? l.text.replace(/:?$/, ':') : capitalize(l.text.replace(/[;.]$/, '')),
  )
  const steps = formatSteps(buckets.steps)
  const titleLine = preamble.find(
    (l) =>
      l.text.length >= 3 &&
      !looksLikeIngredient(l.text) &&
      !looksLikeStep(l) &&
      !/^(a |minha )?receit(a|inha)( (abaixo|aqui|completa|facil))?[:!.]*$/.test(fold(l.text)),
  )

  return {
    title: titleLine ? cleanTitle(titleLine.text) : '',
    ingredients: ingredientLines.join('\n'),
    instructions: steps.text,
    notes: buckets.notes.map((l) => l.text).join('\n'),
    servings,
    prep_minutes: prep,
    ingredientCount: ingredientLines.filter((l) => !/:$/.test(l)).length,
    stepCount: steps.count,
  }
}

export function hasRecipe(p: ParsedCaption): boolean {
  return p.ingredientCount > 0 || p.stepCount > 0
}

// "8 ingredientes e 5 passos", "1 ingrediente", "o modo de preparo".
export function describeParsed(p: ParsedCaption): string {
  const parts: string[] = []
  if (p.ingredientCount) parts.push(`${p.ingredientCount} ${p.ingredientCount === 1 ? 'ingrediente' : 'ingredientes'}`)
  if (p.stepCount > 1) parts.push(`${p.stepCount} passos`)
  else if (p.stepCount === 1) parts.push('o modo de preparo')
  return parts.join(' e ')
}
