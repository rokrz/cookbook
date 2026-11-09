import { Capacitor } from '@capacitor/core'
import { exportBackup, importBackup } from './backup'
import { LocalStore } from './localStore'
import type { Store } from './types'
import {
  accountEmail,
  disconnect,
  downloadBackup,
  listBackups,
  pruneBackups,
  uploadBackup,
  withDrive,
  type DriveBackup,
} from '../lib/googleDrive'

// Estado do backup no Google Drive, guardado neste aparelho.

export interface DriveSettings {
  connected: boolean
  email: string
  // Backup automático: uma vez por dia, ao abrir o app.
  auto: boolean
  lastBackup: string
  lastError: string
}

const KEY = 'caderno:drive'
const DAY_MS = 24 * 60 * 60 * 1000

const DEFAULTS: DriveSettings = { connected: false, email: '', auto: true, lastBackup: '', lastError: '' }

export function driveSettings(): DriveSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveDriveSettings(patch: Partial<DriveSettings>): DriveSettings {
  const next = { ...driveSettings(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // ignora
  }
  return next
}

export async function connectDrive(): Promise<DriveSettings> {
  const email = await withDrive(true, accountEmail)
  if (email === null) throw new Error('Login no Google cancelado.')
  return saveDriveSettings({ connected: true, email, lastError: '' })
}

export async function disconnectDrive(): Promise<DriveSettings> {
  await disconnect()
  return saveDriveSettings({ connected: false, email: '', lastError: '' })
}

async function send(store: Store, interactive: boolean): Promise<DriveBackup | null> {
  const blob = await exportBackup(store)
  const sent = await withDrive(interactive, async (token) => {
    const file = await uploadBackup(token, blob)
    await pruneBackups(token).catch(() => {})
    return file
  })
  if (sent) saveDriveSettings({ connected: true, lastBackup: new Date().toISOString(), lastError: '' })
  return sent
}

export async function backupToDrive(store: Store): Promise<DriveBackup> {
  const sent = await send(store, true)
  if (!sent) throw new Error('Login no Google cancelado.')
  return sent
}

export async function listDriveBackups(): Promise<DriveBackup[]> {
  return (await withDrive(true, listBackups)) ?? []
}

export async function restoreFromDrive(store: LocalStore, id: string) {
  const blob = await withDrive(true, (token) => downloadBackup(token, id))
  if (!blob) throw new Error('Login no Google cancelado.')
  return importBackup(store, blob)
}

// Chamado ao abrir o app: se o backup automático estiver ligado e o último tiver mais de um dia,
// envia um novo em segundo plano, sem mostrar a tela do Google. Erros ficam guardados para a tela de Backup.
let running = false

export async function autoBackupIfDue(store: Store): Promise<void> {
  const s = driveSettings()
  if (running || !s.connected || !s.auto) return
  if (s.lastBackup && Date.now() - new Date(s.lastBackup).getTime() < DAY_MS) return
  if (!navigator.onLine) return
  running = true
  try {
    // Caderno vazio (por exemplo, app recém-instalado): não envia, para não empurrar os backups bons para fora.
    if ((await store.listRecipes('', 'all')).length === 0) return
    const sent = await send(store, false)
    // No navegador o login sempre abre uma janela; o automático só roda enquanto a sessão do Google estiver ativa.
    if (!sent && Capacitor.isNativePlatform()) saveDriveSettings({ lastError: 'O backup automático precisa que você entre no Google de novo.' })
  } catch (e) {
    saveDriveSettings({ lastError: `Backup automático falhou: ${e instanceof Error ? e.message : String(e)}` })
  } finally {
    running = false
  }
}
