import { useEffect, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { store } from '../data'
import { backupFileName, exportBackup, importBackup } from '../data/backup'
import { LocalStore } from '../data/localStore'
import { errorMessage } from '../lib/errors'
import { saveFile } from '../lib/files'

interface Props {
  onRestored: () => Promise<void>
}

const LAST_KEY = 'caderno:ultimo-backup'

function lastBackup(): string {
  try {
    return localStorage.getItem(LAST_KEY) ?? ''
  } catch {
    return ''
  }
}

export default function Backup({ onRestored }: Props) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [last, setLast] = useState(lastBackup)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const isLocal = store instanceof LocalStore

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {})
  }, [])

  async function download() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (!(await saveFile(await exportBackup(store), backupFileName()))) return
      const when = new Date().toLocaleString('pt-BR')
      try {
        localStorage.setItem(LAST_KEY, when)
      } catch {
        // ignora
      }
      setLast(when)
      setMessage(
        Capacitor.isNativePlatform()
          ? 'Backup gerado. Se ainda não escolheu, mande o arquivo para o Drive, e-mail ou computador.'
          : 'Backup gerado. Guarde o arquivo num lugar fora do celular (Drive, e-mail, computador).',
      )
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function restore(file: File | undefined) {
    if (!file || !(store instanceof LocalStore)) return
    if (!window.confirm('Restaurar este backup? Receitas com o mesmo registro serão substituídas pela versão do arquivo.')) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await importBackup(store, file)
      await onRestored()
      setMessage(`Backup restaurado: ${result.recipes} receitas e ${result.categories} categorias novas.`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="categories">
      <h1>Backup</h1>
      {isLocal ? (
        <p className="muted">
          Suas receitas ficam guardadas só neste aparelho. Se você limpar os dados do navegador, desinstalar o app ou trocar de
          celular, elas só voltam com um arquivo de backup.
        </p>
      ) : (
        <p className="muted">Baixe uma cópia do caderno, com fotos, para guardar ou levar para a versão que funciona sem internet.</p>
      )}

      <div className="backup-actions">
        <button className="primary" onClick={download} disabled={busy}>
          <Download size={18} aria-hidden /> {busy ? 'Aguarde…' : 'Baixar backup'}
        </button>
        {isLocal && (
          <label className="button">
            <Upload size={18} aria-hidden /> Restaurar backup
            <input
              type="file"
              accept="application/json,.json"
              hidden
              disabled={busy}
              onChange={(e) => {
                restore(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
        )}
      </div>

      <p className="muted small">{last ? `Último backup neste aparelho: ${last}.` : 'Nenhum backup feito neste aparelho ainda.'}</p>
      {isLocal && persisted === false && !Capacitor.isNativePlatform() && (
        <p className="muted small">
          Dica: instale o app na tela inicial para o navegador proteger seus dados contra limpeza automática.
        </p>
      )}

      {message && <p className="notice" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}
