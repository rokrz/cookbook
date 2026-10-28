# Meu Caderno de Receitas

App pessoal de receitas (React + TypeScript + Vite) com backend **PocketBase** hospedado em casa.
Endereço de produção: `https://bokerzcraft.duckdns.org:PORTA` (troque `PORTA` pela porta pública do seu proxy HTTPS).

O plano completo está em `docs/plano-implementacao-pocketbase.md` e o passo a passo de instalação em [`docs/instalacao-linux.md`](docs/instalacao-linux.md).

## O que já funciona

- Login por e-mail e senha (sem cadastro público; contas criadas no painel).
- Biblioteca com busca por nome, ingredientes e anotações, filtros por favoritas, testadas e categoria.
- Criar, ver, editar e excluir receitas, com foto protegida (troca e remoção apagam o arquivo antigo).
- Fotos grandes reduzidas no navegador antes do envio (até 2000 px; limite de 5 MB).
- Categorias: criar, renomear, excluir (receitas ficam sem categoria) e adicionar as sugeridas.
- Layout responsivo e manifesto PWA.

## Estrutura

```text
├── src/
│   ├── App.tsx              casca, rotas por hash (#/nova, #/receita/:id …)
│   ├── components/          Login, Biblioteca, Formulário, Detalhe, Categorias
│   └── lib/                 cliente PocketBase, erros, preparo de imagem
├── pocketbase/pb_migrations/ coleções, regras de acesso e configurações do servidor
├── deploy/                  serviço systemd e exemplos de Caddy/nginx
├── scripts/                 deploy.sh (Linux) e deploy.ps1 (Windows)
└── tests/api.test.mjs       teste de privacidade e regras contra um PocketBase de teste
```

## Desenvolvimento local

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
   cp .env.example .env
   npm install
   npm run dev
   ```

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
