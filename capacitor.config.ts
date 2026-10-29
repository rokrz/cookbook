import type { CapacitorConfig } from '@capacitor/cli'

// App Android: empacota o build (dist/) dentro do APK, sem servidor. Os dados ficam no aparelho.
const config: CapacitorConfig = {
  appId: 'io.github.rokrz.cadernodereceitas',
  appName: 'Caderno de Receitas',
  webDir: 'dist',
  android: {
    // Fundo enquanto o app carrega, igual ao do manifesto.
    backgroundColor: '#f7f1e6',
  },
}

export default config
