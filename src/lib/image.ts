export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MAX_SIDE = 2000

// Valida e, quando possível, reduz a foto no navegador antes do upload.
export async function prepareImage(file: File): Promise<File> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('Formato de imagem não suportado. Use JPEG, PNG, WebP ou HEIC.')
  }

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Alguns navegadores não decodificam HEIC; envia o original se couber.
  }

  if (bitmap && (Math.max(bitmap.width, bitmap.height) > MAX_SIDE || file.size > 1.5 * 1024 * 1024)) {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (blob && blob.size < file.size) {
      const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
      file = new File([blob], name, { type: 'image/jpeg' })
    }
  } else {
    bitmap?.close()
  }

  if (file.size > MAX_IMAGE_BYTES) throw new Error('A foto deve ter no máximo 5 MB.')
  return file
}
