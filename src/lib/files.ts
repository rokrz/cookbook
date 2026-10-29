import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

// Entrega um arquivo ao usuário. No navegador, baixa. No APK (WebView não baixa blob:),
// grava no cache do app e abre o menu Compartilhar para mandar ao Drive, e-mail etc.
// Devolve false se o usuário fechou o menu sem escolher.
export async function saveFile(blob: Blob, name: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return true
  }
  const { uri } = await Filesystem.writeFile({
    path: name,
    data: await blob.text(),
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  })
  try {
    await Share.share({ title: name, files: [uri], dialogTitle: 'Guardar backup' })
    return true
  } catch (e) {
    // O plugin rejeita quando o menu é fechado sem escolher.
    if (String(e).toLowerCase().includes('cancel')) return false
    throw e
  }
}
