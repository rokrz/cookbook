import { useEffect, useRef, useState } from 'react'
import { ClipboardPaste, Download, ScrollText, Undo2 } from 'lucide-react'
import { describeParsed, hasRecipe, parseCaption, type ParsedCaption } from '../lib/caption'
import { detectPlatform, isValidUrl } from '../lib/links'
import { canFetchCaption, copyHint, fetchCaption } from '../lib/postCaption'
import { errorMessage } from '../lib/errors'

interface Props {
  sourceUrl: string
  // Texto que já veio junto (ex.: do menu Compartilhar).
  initialText?: string
  // Começa aberto (receita salva só com o link, por exemplo).
  open?: boolean
  // Lê o initialText ao abrir a tela, sem mostrar erro se não for receita.
  autoRead?: boolean
  // Devolve o que foi lido; o formulário decide o que preencher.
  onRead: (parsed: ParsedCaption) => void
  // Mostra "Desfazer" depois de preencher.
  onUndo?: () => void
}

// "Ler legenda do post": cola (ou busca, no TikTok) a legenda e separa ingredientes e preparo.
export default function CaptionImport({ sourceUrl, initialText = '', open, autoRead, onRead, onUndo }: Props) {
  const [text, setText] = useState(initialText)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [initial] = useState(() => (autoRead && initialText.trim() ? parseCaption(initialText) : null))
  const autoDone = useRef(false)

  // O texto compartilhado já trazia a receita: preenche uma vez ao abrir.
  useEffect(() => {
    if (autoDone.current || !initial || !hasRecipe(initial)) return
    autoDone.current = true
    onRead(initial)
    setCanUndo(Boolean(onUndo))
    setStatus(`O texto compartilhado tinha ${describeParsed(initial)}. Confira antes de salvar.`)
  }, [initial, onRead, onUndo])

  const platform = isValidUrl(sourceUrl) ? detectPlatform(sourceUrl) : null
  const canFetch = isValidUrl(sourceUrl) && canFetchCaption(sourceUrl)
  const canPaste = typeof navigator.clipboard?.readText === 'function'

  function read(caption: string) {
    setError('')
    setStatus('')
    const parsed = parseCaption(caption)
    if (!hasRecipe(parsed)) {
      setCanUndo(false)
      return setError('Não encontrei ingredientes nem modo de preparo nesse texto. Você pode colar direto nos campos abaixo.')
    }
    onRead(parsed)
    setCanUndo(Boolean(onUndo))
    setStatus(`Encontrei ${describeParsed(parsed)}. Confira antes de salvar.`)
  }

  async function paste() {
    setError('')
    try {
      const clip = (await navigator.clipboard.readText()).trim()
      if (!clip) return setError('A área de transferência está vazia.')
      setText(clip)
      read(clip)
    } catch {
      setError('Não foi possível ler a área de transferência. Cole a legenda no campo.')
    }
  }

  async function fetchFromPost() {
    setBusy(true)
    setError('')
    try {
      const caption = await fetchCaption(sourceUrl)
      setText(caption)
      read(caption)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="caption-import" open={open || Boolean(initial && hasRecipe(initial))}>
      <summary>
        <ScrollText size={18} aria-hidden /> Ler ingredientes e preparo da legenda do post
      </summary>
      <p className="muted small">{copyHint(platform)}</p>
      <textarea
        rows={6}
        placeholder="Cole aqui a legenda do post ou o texto da receita…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Legenda do post"
      />
      <div className="caption-actions">
        {canFetch && (
          <button type="button" onClick={fetchFromPost} disabled={busy}>
            <Download size={18} aria-hidden /> {busy ? 'Buscando…' : 'Buscar legenda no TikTok'}
          </button>
        )}
        {canPaste && (
          <button type="button" onClick={paste} disabled={busy}>
            <ClipboardPaste size={18} aria-hidden /> Colar
          </button>
        )}
        <button type="button" className="primary" onClick={() => read(text)} disabled={busy || !text.trim()}>
          Ler legenda
        </button>
      </div>
      {status && (
        <p className="notice" role="status">
          {status}
          {canUndo && onUndo && (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                onUndo()
                setCanUndo(false)
                setStatus('Preenchimento desfeito.')
              }}
            >
              <Undo2 size={16} aria-hidden /> Desfazer
            </button>
          )}
        </p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </details>
  )
}
