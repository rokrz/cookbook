import { ClientResponseError } from 'pocketbase'

const FIELD_LABELS: Record<string, string> = {
  title: 'Nome',
  name: 'Nome',
  image: 'Foto',
  source_url: 'URL da fonte',
  prep_minutes: 'Tempo de preparo',
  category: 'Categoria',
}

export function errorMessage(err: unknown): string {
  if (err instanceof ClientResponseError) {
    if (err.status === 0) return 'Não foi possível falar com o servidor. Verifique a conexão.'
    const data = (err.response?.data ?? {}) as Record<string, { code?: string; message?: string }>
    if (data.name?.code === 'validation_not_unique') return 'Você já tem uma categoria com esse nome.'
    const field = Object.keys(data)[0]
    if (field) return `${FIELD_LABELS[field] ?? field}: ${data[field]?.message ?? 'valor inválido'}`
    if (err.status === 400 && err.url.includes('auth-with-password')) return 'E-mail ou senha incorretos.'
    if (err.status === 401 || err.status === 403) return 'Sessão expirada ou sem permissão. Entre novamente.'
    if (err.status === 404) return 'Registro não encontrado.'
    return err.message || 'Algo deu errado.'
  }
  // IndexedDB: nome repetido ou armazenamento cheio.
  if (err instanceof DOMException && err.name === 'ConstraintError') return 'Já existe um registro com esse nome.'
  if (err instanceof DOMException && err.name === 'QuotaExceededError') return 'Sem espaço no aparelho. Libere espaço ou remova fotos.'
  if (err instanceof Error) return err.message
  return 'Algo deu errado.'
}
