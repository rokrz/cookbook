/// <reference path="../pb_data/types.d.ts" />

// Configurações do servidor que o app precisa. A URL pública vem da variável
// de ambiente PB_APP_URL, por exemplo https://bokerzcraft.duckdns.org:PORTA
migrate((app) => {
  const settings = app.settings()

  settings.meta.appName = "Meu Caderno de Receitas"
  const appURL = $os.getenv("PB_APP_URL")
  if (appURL) settings.meta.appURL = appURL

  // Usada para criar as categorias sugeridas em uma única requisição.
  settings.batch.enabled = true
  settings.batch.maxRequests = 50

  // O PocketBase fica atrás do proxy HTTPS: usar o IP real do visitante nos logs e no rate limit.
  settings.trustedProxy.headers = ["X-Forwarded-For"]
  settings.trustedProxy.useLeftmostIP = false

  settings.rateLimits.enabled = true

  app.save(settings)
}, (app) => {
  const settings = app.settings()
  settings.batch.enabled = false
  settings.trustedProxy.headers = []
  app.save(settings)
})
