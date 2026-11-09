import { useState } from 'react'
import { Cloud, CloudUpload, LogOut, RotateCcw } from 'lucide-react'
import { store } from '../data'
import {
  backupToDrive,
  connectDrive,
  disconnectDrive,
  driveSettings,
  listDriveBackups,
  restoreFromDrive,
  saveDriveSettings,
} from '../data/driveBackup'
import { LocalStore } from '../data/localStore'
import { KEEP_BACKUPS, type DriveBackup as DriveFile } from '../lib/googleDrive'
import { errorMessage } from '../lib/errors'

interface Props {
  onRestored: () => Promise<void>
}

function when(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function size(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// Backup no Google Drive da própria pessoa (pasta escondida do app).
export default function DriveBackup({ onRestored }: Props) {
  const [settings, setSettings] = useState(driveSettings)
  const [files, setFiles] = useState<DriveFile[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canRestore = store instanceof LocalStore

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSettings(driveSettings())
      setBusy(false)
    }
  }

  const connect = () =>
    run(async () => {
      await connectDrive()
      setMessage('Google Drive conectado. Agora é só enviar o primeiro backup.')
    })

  const send = () =>
    run(async () => {
      await backupToDrive(store)
      setMessage('Backup enviado para o seu Google Drive.')
      if (files) setFiles(await listDriveBackups())
    })

  const showFiles = () =>
    run(async () => {
      setFiles(await listDriveBackups())
    })

  const restore = (f: DriveFile) => {
    if (!(store instanceof LocalStore)) return
    const target = store
    if (!window.confirm(`Restaurar o backup de ${when(f.createdTime)}? Receitas com o mesmo registro serão substituídas pela versão do backup.`)) return
    run(async () => {
      const result = await restoreFromDrive(target, f.id)
      await onRestored()
      setMessage(`Backup restaurado: ${result.recipes} receitas e ${result.categories} categorias novas.`)
    })
  }

  const disconnect = () => {
    if (!window.confirm('Desconectar o Google Drive? Os backups que já estão lá continuam guardados.')) return
    run(async () => {
      await disconnectDrive()
      setFiles(null)
    })
  }

  function toggleAuto(auto: boolean) {
    setSettings(saveDriveSettings({ auto }))
  }

  return (
    <div className="drive-box">
      <h2>
        <Cloud size={20} aria-hidden /> Google Drive
      </h2>

      {!settings.connected ? (
        <>
          <p className="muted">
            Guarde cópias do caderno, com fotos, no seu próprio Google Drive. Ficam numa pasta escondida que só este app enxerga, e
            você pode restaurar em outro celular.
          </p>
          <div className="backup-actions">
            <button className="primary" onClick={connect} disabled={busy}>
              <Cloud size={18} aria-hidden /> {busy ? 'Aguarde…' : 'Conectar Google Drive'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted small">
            Conectado{settings.email ? ` como ${settings.email}` : ''}.{' '}
            {settings.lastBackup ? `Último backup no Drive: ${when(settings.lastBackup)}.` : 'Nenhum backup enviado ainda.'}
          </p>

          <div className="backup-actions">
            <button className="primary" onClick={send} disabled={busy}>
              <CloudUpload size={18} aria-hidden /> {busy ? 'Aguarde…' : 'Enviar backup agora'}
            </button>
            {canRestore && (
              <button onClick={showFiles} disabled={busy}>
                <RotateCcw size={18} aria-hidden /> Restaurar do Drive
              </button>
            )}
          </div>

          <label className="check">
            <input type="checkbox" checked={settings.auto} onChange={(e) => toggleAuto(e.target.checked)} />
            Backup automático uma vez por dia (ao abrir o app)
          </label>
          <p className="muted small">O Drive guarda os {KEEP_BACKUPS} backups mais recentes; os mais antigos são apagados.</p>

          {settings.lastError && <p className="form-error small">{settings.lastError}</p>}

          {files && (
            files.length === 0 ? (
              <p className="muted small">Nenhum backup no Drive ainda.</p>
            ) : (
              <ul className="drive-list">
                {files.map((f) => (
                  <li key={f.id}>
                    <span>
                      {when(f.createdTime)} <span className="muted small">· {size(f.size)}</span>
                    </span>
                    <span className="spacer" />
                    <button className="ghost" onClick={() => restore(f)} disabled={busy}>
                      Restaurar
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}

          <button className="ghost" onClick={disconnect} disabled={busy} style={{ justifySelf: 'start' }}>
            <LogOut size={18} aria-hidden /> Desconectar
          </button>
        </>
      )}

      {message && <p className="notice" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}
