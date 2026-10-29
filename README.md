# Meu Caderno de Receitas

App de receitas (React + TypeScript + Vite, PWA) que roda de dois jeitos:

- **Local (padrão, versão para publicar):** tudo fica no aparelho (IndexedDB), sem conta e funcionando sem internet. Backup por arquivo.
- **PocketBase (`VITE_BACKEND=pocketbase`):** receitas no servidor PocketBase hospedado em casa, com login.
  Endereço de produção: `https://bokerzcraft.duckdns.org:PORTA`. Os scripts `scripts/deploy.*` já compilam neste modo.

Planos: `docs/plano-implementacao-pocketbase.md` (servidor) e `docs/plano-importacao-link-e-backends.md` (salvar por link, compartilhamento, versão local). Para instalar o servidor no Linux, siga [`docs/roteiro-setup-linux.md`](docs/roteiro-setup-linux.md).

## O que já funciona

- **Salvar link:** guardar um post do Instagram, TikTok, Facebook, Pinterest ou site só com link, nome e categoria. Links repetidos são avisados (mesmo com parâmetros de rastreio diferentes). Receitas assim aparecem com o selo "Só o link" e no filtro "Para completar".
- **Menu Compartilhar do Android:** com o app instalado ("Adicionar à tela inicial"), "Compartilhar → Receitas" em outro app abre o Salvar link já preenchido (`share_target` no manifesto). No iPhone isso não existe para apps web; use o botão "Colar".
- **Categoria na hora:** "+ Nova categoria…" no seletor do Salvar link e do formulário completo. Nome repetido seleciona a existente.
- **Sem internet:** service worker (`public/sw.js`) guarda o app; no modo local tudo funciona offline.
- **Backup:** baixar um arquivo `.json` com receitas, categorias e fotos; restaurar no modo local. No modo PocketBase, o backup baixado serve para levar o caderno para a versão local.
- Biblioteca com busca (sem diferenciar acentos no modo local), filtros por favoritas, testadas, para completar e categoria.
- Criar, ver, editar e excluir receitas, com foto (reduzida no navegador até 2000 px; limite de 5 MB) e miniatura.
- Categorias: criar, renomear, excluir (receitas ficam sem categoria) e adicionar as sugeridas.
- Login por e-mail e senha só no modo PocketBase (sem cadastro público; contas criadas no painel).

## Estrutura

```text
├── src/
│   ├── App.tsx              casca, rotas por hash (#/nova, #/salvar, #/receita/:id …)
│   ├── components/          Biblioteca, Salvar link, Formulário, Detalhe, Categorias, Backup, Login
│   ├── data/                camada de dados: LocalStore (IndexedDB), PocketBaseStore, backup
│   └── lib/                 links e compartilhamento, erros, imagens
├── public/                  manifesto (share_target), ícones e service worker
├── pocketbase/pb_migrations/ coleções, regras de acesso e configurações do servidor
├── deploy/                  serviço systemd e exemplos de Caddy/nginx
├── scripts/                 deploy.sh (Linux) e deploy.ps1 (Windows)
└── tests/api.test.mjs       teste de privacidade e regras contra um PocketBase de teste
```

## Desenvolvimento local

Modo local (sem servidor):

```bash
npm install
npm run dev
```

Para testar o menu Compartilhar sem celular, abra `http://localhost:5173/?text=Olha%20https://www.instagram.com/p/abc/`.
O service worker só é registrado no build (`npm run build && npm run preview`).

Modo PocketBase:

1. Baixe o PocketBase (v0.23 ou superior; testado com v0.40.6) em <https://github.com/pocketbase/pocketbase/releases> e coloque o executável em `pocketbase/`.
2. Copie as migrações e suba o servidor:
   ```bash
   cd pocketbase
   ./pocketbase superuser upsert seu-email@exemplo.com 'senha-forte'
   ./pocketbase serve --http=127.0.0.1:8090
   ```
   As migrações de `pb_migrations/` são aplicadas na inicialização.
3. Em `http://127.0.0.1:8090/_/`, crie seu usuário na coleção `users`.
4. Na raiz do projeto:
   ```bash
   cp .env.example .env   # e defina VITE_BACKEND=pocketbase
   npm install
   npm run dev
   ```

## APK Android

O app Android usa Capacitor: o build (`dist/`) vai dentro do APK, funciona sem internet e os dados ficam no aparelho.
Ele aparece no menu Compartilhar para links e textos (intent `SEND text/plain` em `MainActivity.java`).

- **Pelo GitHub:** cada push em `main` ou `claude/**` roda o workflow **APK Android** (`.github/workflows/android.yml`).
  O APK fica em *Actions → APK Android → execução → Artifacts → caderno-de-receitas-apk* (um `.zip` com `caderno-de-receitas.apk`).
- **Na sua máquina** (precisa do Android SDK 36 e Java 21):
  ```bash
  npm run build && npx cap sync android
  cd android && ./gradlew assembleDebug
  # APK em android/app/build/outputs/apk/debug/app-debug.apk
  ```

O APK é assinado com a chave de teste `android/keystore/caderno-dev.jks` (senha `caderno-dev`), sempre a mesma, para
instalar versões novas por cima sem perder as receitas. Para a Play Store, gere outra chave e guarde fora do repositório.

## Produção (PC de casa)

1. Coloque o executável do PocketBase em `/opt/pocketbase` (Linux) ou `C:\pocketbase` (Windows).
2. Publique o app e as migrações:
   - Linux: `PB_DIR=/opt/pocketbase ./scripts/deploy.sh`
   - Windows: `.\scripts\deploy.ps1 -PbDir C:\pocketbase`
3. Defina a variável `PB_APP_URL=https://bokerzcraft.duckdns.org:PORTA` para o serviço (já está em `deploy/pocketbase.service`) e inicie o PocketBase sempre com `--http=127.0.0.1:8090`.
   - Linux: copie `deploy/pocketbase.service` para `/etc/systemd/system/`, ajuste `User`, `PORTA` e rode `sudo systemctl enable --now pocketbase`.
   - Windows (NSSM):
     ```powershell
     nssm install PocketBase C:\pocketbase\pocketbase.exe serve --http=127.0.0.1:8090
     nssm set PocketBase AppDirectory C:\pocketbase
     nssm set PocketBase AppEnvironmentExtra PB_APP_URL=https://bokerzcraft.duckdns.org:PORTA
     nssm start PocketBase
     ```
4. No proxy HTTPS que já existe, encaminhe `bokerzcraft.duckdns.org:PORTA` para `127.0.0.1:8090`. Veja `deploy/Caddyfile.example` e `deploy/nginx.conf.example` (upload de até 10 MB, realtime sem buffer, painel `/_/` só da rede de casa).
5. Crie o superusuário (`./pocketbase superuser upsert …`), ligue MFA para ele no painel e crie o seu usuário em `users`.
6. Em Settings > Backups, ligue o backup automático (por exemplo `0 3 * * *`) e configure uma cópia fora do PC.

A migração `1761620100_settings.js` já liga a Batch API (categorias sugeridas), o rate limit e o cabeçalho `X-Forwarded-For` do proxy.

## Testes

Contra um PocketBase de **teste** (o script cria e apaga `a@test.local` e `b@test.local`):

```bash
PB_ADMIN_EMAIL=… PB_ADMIN_PASSWORD=… PB_DATA_DIR=pocketbase/pb_data npm run test:api
```

Verifica: cadastro bloqueado, isolamento entre duas contas (listar, abrir, editar, excluir, associar categoria, transferir), fotos sem token ou com token de outra conta, limpeza de fotos antigas, categoria excluída sem apagar receitas e nomes duplicados.
