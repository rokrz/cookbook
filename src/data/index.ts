import { LocalStore } from './localStore'
import { PocketBaseStore } from './pocketbaseStore'
import type { Store } from './types'

export * from './types'

// VITE_BACKEND=pocketbase: caderno no servidor (com login). Padrão: tudo no aparelho.
export const store: Store =
  import.meta.env.VITE_BACKEND === 'pocketbase'
    ? new PocketBaseStore(import.meta.env.VITE_PB_URL || window.location.origin)
    : new LocalStore()
