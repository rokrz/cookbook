# Meu Caderno de Receitas: plano de implementação com PocketBase

> Versão 2.0 da especificação. Substitui o Supabase por um PocketBase hospedado no PC de casa.
> Data: 28/10/2026.

## 1. O que muda e por quê

A versão 1.0 dependia do Supabase (Auth, Postgres com RLS e Storage privado). A partir desta versão o backend passa a ser um **PocketBase** rodando no PC do Ivan. O PocketBase é um único executável que reúne banco (SQLite), autenticação, armazenamento de arquivos, painel administrativo e API REST/realtime. Para um app pessoal isso significa nenhum custo mensal, nenhum limite de plano gratuito e todos os dados em casa.

A interface (React + TypeScript + Vite + CSS + Lucide) e a identidade visual continuam iguais. Mudam a camada de dados, a autenticação, as fotos, a publicação e o backup.

| Camada | v1.0 (Supabase) | v2.0 (PocketBase) |
|---|---|---|
| Autenticação | Supabase Auth | Coleção de autenticação `users` do PocketBase |
| Banco | PostgreSQL | SQLite embutido no PocketBase (`pb_data/data.db`) |
| Segurança de dados | Row Level Security | **API Rules** por coleção |
| Imagens | Bucket privado + URL assinada | Campo `file` **protegido** + token de arquivo |
| SDK no frontend | `@supabase/supabase-js` | `pocketbase` (SDK JS, 0.28.x hoje) |
| Hospedagem do frontend | Serviço HTTPS externo | Pasta `pb_public` servida pelo próprio PocketBase |
| HTTPS / acesso remoto | Fornecido pelo Supabase | Proxy reverso com HTTPS **já existente** na máquina |
| Backup | Responsabilidade do Supabase | Backup automático do PocketBase + cópia fora do PC |

### Decisões tomadas

1. **PocketBase v0.23 ou superior**, fixando a versão estável mais recente no dia da instalação. A migração deste plano usa a sintaxe JS dessa linha de versões.
2. **Frontend e API na mesma origem.** O build do Vite vai para `pb_public/`, então o app e a API ficam no mesmo endereço, sem CORS e sem variável de URL obrigatória.
3. **Cadastro público fechado.** Como o app é pessoal, a regra de criação da coleção `users` fica bloqueada e as contas são criadas pelo painel. A tela de cadastro some do app (ou fica atrás de uma flag, se um dia houver outra pessoa).
4. **HTTPS pelo setup que já existe na máquina.** O PocketBase entra atrás do proxy reverso atual, em um domínio ou subdomínio próprio. Nenhum serviço novo de acesso remoto é necessário.
5. **PocketBase escuta só em `127.0.0.1`.** Nada fica exposto na rede local ou na internet diretamente; quem publica é o proxy HTTPS.
6. **Backup diário automático + cópia para fora do PC**, com um teste de restauração antes de guardar uma coleção importante.

### Riscos novos que a troca traz

- **O app só funciona com o PC ligado e online.** Desativar suspensão/hibernação, configurar o PocketBase para iniciar com o sistema e, se possível, ligar a opção da BIOS de religar após queda de energia.
- **Os dados ficam em um único disco.** Por isso a cópia de backup fora do PC é obrigatória, não opcional.
- **Sem SMTP, não há e-mail de verificação nem de recuperação de senha.** Para um app pessoal isso é aceitável: senha esquecida é redefinida pelo painel. Se quiser e-mail depois, configurar um SMTP (por exemplo, uma conta de envio do Gmail ou um serviço transacional) em Settings > Mail.

## 2. Arquitetura

```text
Celular / computador (qualquer navegador)
        |
        |  https://receitas.seudominio.com
        v
Proxy reverso já existente (termina o HTTPS)
        |
        |  http://127.0.0.1:8090
        v
PocketBase (um executável, no PC de casa)
  ├── pb_public/      -> app React compilado (PWA)
  ├── /api/...        -> REST + realtime
  ├── /_/             -> painel de superusuário
  └── pb_data/
        ├── data.db   -> SQLite (users, categories, recipes)
        ├── storage/  -> fotos e miniaturas
        └── backups/  -> zips de backup
```

O navegador nunca recebe nenhuma credencial administrativa. O equivalente à `service_role` do Supabase aqui é a conta de **superusuário**, que só deve ser usada no painel `/_/` e em scripts no próprio PC.

## 3. Modelo de dados (coleções)

A migração pronta está em [`pb_migrations/1761620000_init_receitas.js`](pb_migrations/1761620000_init_receitas.js). Basta copiá-la para a pasta `pb_migrations/` ao lado do executável; o PocketBase aplica na inicialização.

O PocketBase gera `id` (15 caracteres) automaticamente. Os campos `created` e `updated` são do tipo `autodate`.

### `users` (coleção de autenticação, já existe)

Usada como está: e-mail, senha, nome e avatar opcional. A migração muda só a `createRule` para `null` (ninguém se cadastra sem o superusuário).

### `categories`

| Campo | Tipo | Observação |
|---|---|---|
| `user` | relation → `users`, obrigatório | Dono. `cascadeDelete` ligado: apagar o usuário apaga as categorias |
| `name` | text, 1–80 | Obrigatório |
| `created`, `updated` | autodate | |

Índice único `(user, name COLLATE NOCASE)`: substitui a unicidade por usuário do Postgres e ainda impede "Bolos" e "bolos" duplicados.

### `recipes`

| Campo v1.0 | Campo v2.0 | Tipo | Observação |
|---|---|---|---|
| `id` | `id` | automático | |
| `user_id` | `user` | relation → `users`, obrigatório | Cascata ao apagar usuário |
| `title` | `title` | text, 1–200 | Obrigatório |
| `category_id` | `category` | relation → `categories`, opcional | **Sem cascata** |
| `ingredients` | `ingredients` | text | Um por linha, como antes |
| `instructions` | `instructions` | text | |
| `notes` | `notes` | text | |
| `source_url` | `source_url` | url | Valida o formato |
| `prep_minutes` | `prep_minutes` | number inteiro ≥ 0 | |
| `servings` | `servings` | text | Continua texto livre ("8 fatias") |
| `favorite` | `favorite` | bool | |
| `tested` | `tested` | bool | |
| `image_path` | `image` | file, 1 arquivo, 5 MB, **protegido** | JPEG, PNG, WebP, HEIC; miniaturas 480x360 e 1200x0 |
| `created_at` | `created` | autodate | Mais `updated` |

**Excluir categoria sem apagar receitas.** Como `category` é opcional e sem `cascadeDelete`, o PocketBase remove a referência das receitas quando a categoria é excluída. Isso resolve a dúvida da v1.0 ("depende da restrição configurada no banco"), mas continua no roteiro de testes.

**Fotos antigas e órfãs.** Em um campo `file` de um único arquivo, enviar uma nova foto ou limpar o campo apaga o arquivo anterior, e excluir a receita apaga a foto e as miniaturas. Isso elimina duas limitações listadas na v1.0.

## 4. Regras de API (substituto do RLS)

No PocketBase cada coleção tem cinco regras: `list`, `view`, `create`, `update` e `delete`. Regra `null` = só superusuário; regra vazia `""` = qualquer pessoa; uma expressão = filtro aplicado em toda requisição. Em `list`, registros que não passam na regra simplesmente não aparecem, como no RLS.

| Regra | `categories` e `recipes` |
|---|---|
| list / view / delete | `@request.auth.id != '' && user = @request.auth.id` |
| create | `@request.auth.id != '' && @request.body.user = @request.auth.id` |
| update | dono **e** `@request.body.user` não enviado ou igual ao próprio id (impede transferir o registro) |

Regra extra em `recipes` (create e update): se uma `category` for enviada, ela precisa pertencer ao mesmo usuário (`@request.body.category.user = @request.auth.id`). Assim ninguém consegue associar a receita à categoria de outra conta.

**Fotos protegidas.** Com `protected: true`, o download do arquivo exige um *file token* de curta duração e só funciona para quem passa na `viewRule` da receita. É o equivalente à URL assinada do Supabase.

**Outras proteções do servidor a ligar no painel (Settings):**
- *Rate limiting* (já vem com regras padrão nas versões recentes): manter ligado.
- *MFA/OTP para superusuários*: ligar.
- *Trusted proxy*: informar que o PocketBase está atrás do proxy (cabeçalho `X-Forwarded-For`), para os logs e o rate limit verem o IP real. Detalhes na seção 8.
- *Batch API*: ligar, usado para inserir as categorias sugeridas de uma vez.

## 5. Autenticação no frontend

| Ação | Supabase (v1.0) | PocketBase (v2.0) |
|---|---|---|
| Login | `supabase.auth.signInWithPassword` | `pb.collection('users').authWithPassword(email, senha)` |
| Cadastro | `supabase.auth.signUp` | Removido (contas pelo painel). Se reabrir: `pb.collection('users').create({...})` |
| Sessão atual | `supabase.auth.getSession` | `pb.authStore.isValid` e `pb.authStore.record` |
| Ouvir mudanças | `onAuthStateChange` | `pb.authStore.onChange(cb, true)` |
| Renovar sessão | automático | `pb.collection('users').authRefresh()` ao abrir o app |
| Sair | `supabase.auth.signOut` | `pb.authStore.clear()` |
| Trocar senha | e-mail de recuperação | Tela "trocar senha" (`update` com `oldPassword`) ou pelo painel |

O SDK guarda o token no `localStorage` automaticamente (`LocalAuthStore`). A duração do token é configurável na coleção `users` (padrão de 7 dias; pode subir para 30 em um app pessoal).

## 6. Mudanças no código do frontend

### 6.1 Dependências e variáveis

```bash
npm uninstall @supabase/supabase-js
npm install pocketbase
npm install -D pocketbase-typegen   # opcional: gera tipos TS a partir das coleções
```

`.env.example` passa a ter só uma variável opcional, usada apenas no `npm run dev`:

```env
# Em desenvolvimento, aponta para o PocketBase local.
# Em produção fica vazio: o app é servido pelo próprio PocketBase (mesma origem).
VITE_PB_URL=http://127.0.0.1:8090
```

### 6.2 Novo arquivo `src/lib/pb.ts`

```ts
import PocketBase, { type RecordModel } from 'pocketbase'

export const pb = new PocketBase(import.meta.env.VITE_PB_URL || window.location.origin)
pb.autoCancellation(false) // evita cancelar buscas paralelas no React (StrictMode, filtros)

export interface Category extends RecordModel {
  user: string
  name: string
}

export interface Recipe extends RecordModel {
  user: string
  title: string
  category: string // '' quando não tem categoria
  ingredients: string
  instructions: string
  notes: string
  source_url: string
  prep_minutes: number
  servings: string
  favorite: boolean
  tested: boolean
  image: string // nome do arquivo, '' quando não tem foto
  created: string
  updated: string
  expand?: { category?: Category }
}

export const recipes = () => pb.collection<Recipe>('recipes')
export const categories = () => pb.collection<Category>('categories')
```

### 6.3 Operações principais

```ts
// Login, sessão e logout
await pb.collection('users').authWithPassword(email, password)
if (pb.authStore.isValid) await pb.collection('users').authRefresh().catch(() => pb.authStore.clear())
const unsubscribe = pb.authStore.onChange(() => setUser(pb.authStore.record), true)
pb.authStore.clear()

// Biblioteca: busca + filtros. pb.filter() escapa o texto digitado.
function buildFilter(q: string, f: 'all' | 'favorite' | 'tested' | { category: string }) {
  const parts: string[] = []
  if (q.trim()) parts.push(pb.filter('(title ~ {:q} || ingredients ~ {:q} || notes ~ {:q})', { q: q.trim() }))
  if (f === 'favorite') parts.push('favorite = true')
  if (f === 'tested') parts.push('tested = true')
  if (typeof f === 'object') parts.push(pb.filter('category = {:c}', { c: f.category }))
  return parts.join(' && ')
}
const list = await recipes().getFullList({ filter: buildFilter(q, f), sort: '-created', expand: 'category' })
// A regra de API já limita aos registros do usuário; não precisa filtrar por user aqui.

// Criar / editar (com ou sem foto). O SDK monta multipart sozinho quando há File.
const userId = pb.authStore.record!.id
await recipes().create({ ...form, user: userId, image: file ?? undefined })
await recipes().update(id, { ...form, image: file })   // nova foto substitui e apaga a antiga
await recipes().update(id, { image: null })            // remove a foto
await recipes().delete(id)                             // apaga também o arquivo

// Fotos protegidas: um token serve para todas as imagens da tela
const token = await pb.files.getToken()
const thumb = pb.files.getURL(recipe, recipe.image, { thumb: '480x360', token })
const full = pb.files.getURL(recipe, recipe.image, { token })

// Categorias
await categories().getFullList({ sort: 'name' })
await categories().create({ user: userId, name })
await categories().update(id, { name })
await categories().delete(id) // receitas ficam sem categoria

// Categorias sugeridas em uma única requisição (exige Batch API ligada)
const batch = pb.createBatch()
for (const name of SUGGESTED) batch.collection('categories').create({ user: userId, name })
await batch.send()
```

### 6.4 Pontos de atenção na migração do `App.tsx`

- **Token de arquivo expira em poucos minutos.** Gerar um token ao carregar a lista e renovar quando a lista recarrega ou quando uma imagem falha (`onError` na `<img>` pede novo token). Mesmo comportamento das URLs assinadas da v1.0.
- **Nome duplicado de categoria** volta como erro 400 com `data.name.code = "validation_not_unique"`. Mostrar "Você já tem uma categoria com esse nome".
- **Erros do SDK** vêm como `ClientResponseError` (`status`, `response.data` por campo). Centralizar uma função `mensagemDeErro(e)`.
- **Validação de imagem no formulário** (tipo e 5 MB) continua no cliente, mas agora o servidor também valida, então não dá para burlar.
- **Fotos de celular grandes**: redimensionar no navegador antes do upload (canvas para ~2000 px, WebP/JPEG) é recomendado para não estourar 5 MB e poupar disco.
- **Realtime (opcional)**: `recipes().subscribe('*', cb)` mantém celular e computador sincronizados sem recarregar.
- Separar o `App.tsx` em `pages/` e `components/` aproveitando a reescrita é desejável, mas não obrigatório.

### 6.5 Build e publicação

```bash
npm run build               # gera dist/
# copiar dist/* para <pasta-do-pocketbase>/pb_public/
```

O PocketBase serve `pb_public/` na raiz. Para o roteamento do React funcionar ao recarregar uma rota interna, iniciar com `--indexFallback` (ligado por padrão nas versões recentes) ou usar roteamento por hash.

## 7. Instalação no PC de casa

Ainda não sabemos se o PC usa Windows ou Linux; seguem os dois caminhos.

### 7.1 Estrutura da pasta

```text
pocketbase/
├── pocketbase(.exe)     <- executável baixado de github.com/pocketbase/pocketbase/releases
├── pb_migrations/
│   └── 1761620000_init_receitas.js
├── pb_public/           <- conteúdo de dist/
└── pb_data/             <- criado automaticamente (NÃO versionar, É O QUE SE FAZ BACKUP)
```

### 7.2 Primeira execução

```bash
./pocketbase superuser upsert seu-email@exemplo.com 'senha-forte'
./pocketbase serve --http=127.0.0.1:8090
```

Abrir `http://127.0.0.1:8090/_/`, conferir que `categories` e `recipes` foram criadas, criar o usuário do Ivan em `users` e ajustar Settings conforme a seção 4.

### 7.3 Iniciar com o sistema

**Linux (systemd)**, arquivo `/etc/systemd/system/pocketbase.service`:

```ini
[Unit]
Description=PocketBase - Caderno de Receitas
After=network-online.target

[Service]
User=ivan
WorkingDirectory=/opt/pocketbase
ExecStart=/opt/pocketbase/pocketbase serve --http=127.0.0.1:8090
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now pocketbase
```

**Windows**: usar o [NSSM](https://nssm.cc) para registrar como serviço:

```powershell
nssm install PocketBase C:\pocketbase\pocketbase.exe serve --http=127.0.0.1:8090
nssm set PocketBase AppDirectory C:\pocketbase
nssm start PocketBase
```

Alternativa sem instalar nada: Agendador de Tarefas, gatilho "Ao iniciar o sistema", executar mesmo sem usuário logado. Em ambos, desativar suspensão nas Opções de energia.

### 7.4 Atualizações

O PocketBase ainda está antes da 1.0 e pode ter mudanças incompatíveis. Antes de atualizar: fazer backup, ler as notas da versão, testar em uma cópia de `pb_data`. Para atualizar, parar o serviço, trocar o executável (ou `./pocketbase update`) e iniciar de novo.

## 8. HTTPS e acesso remoto (PWA)

A máquina alvo **já tem HTTPS configurado**, então não entra nenhum serviço novo (sem Tailscale, sem túnel). O PocketBase só precisa ficar atrás do proxy reverso que já termina o HTTPS, em um domínio ou subdomínio próprio, por exemplo `https://receitas.seudominio.com`.

### O que o proxy precisa encaminhar

- Todo o tráfego do (sub)domínio para `http://127.0.0.1:8090`, incluindo `/api/` e `/_/`.
- Cabeçalhos `Host`, `X-Forwarded-For` e `X-Forwarded-Proto`.
- **Sem buffering e com timeout longo em `/api/realtime`**: o realtime usa Server-Sent Events, que ficam abertos.
- **Limite de corpo de requisição de pelo menos 10 MB**, para caber a foto de 5 MB com folga no multipart.
- HTTP/2 ligado, se o proxy permitir (o realtime abre conexões longas e o HTTP/1.1 limita a 6 por domínio no navegador).

Exemplo para **Caddy**:

```caddy
receitas.seudominio.com {
    request_body {
        max_size 10MB
    }
    reverse_proxy 127.0.0.1:8090 {
        transport http {
            read_timeout 360s
        }
    }
}
```

Exemplo para **nginx**:

```nginx
server {
    listen 443 ssl http2;
    server_name receitas.seudominio.com;
    # ssl_certificate / ssl_certificate_key já existentes

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_read_timeout 360s;
    }
}
```

Se o proxy for outro (Traefik, IIS, Nginx Proxy Manager, Apache), os mesmos pontos acima valem.

### Endurecimento, já que o app fica acessível pela internet

- Cadastro público fechado (já está na migração).
- Senhas fortes e **MFA no superusuário**.
- Restringir o painel `/_/` por IP ou rede de casa no proxy, ou proteger com autenticação extra do próprio proxy. Exemplo nginx: um `location /_/ { allow 192.168.0.0/24; deny all; proxy_pass ...; }`.
- Em Settings > Application, preencher a **URL do app** com o endereço HTTPS público.
- Em Settings > *Trusted proxy*, cadastrar o cabeçalho `X-Forwarded-For` para o rate limit e os logs enxergarem o IP real.
- O PocketBase continua escutando só em `127.0.0.1:8090`; a porta 8090 nunca é aberta no roteador nem no firewall.

## 9. Backup e recuperação

1. **Backup automático do PocketBase:** Settings > Backups > ligar auto-backup, por exemplo `0 3 * * *` (todo dia às 3h), mantendo os últimos 7. Gera um `.zip` com o banco e as fotos em `pb_data/backups/`.
2. **Cópia para fora do PC (obrigatório):**
   - Mais simples: no mesmo painel, configurar armazenamento S3 para backups (Backblaze B2, Cloudflare R2, Wasabi ou similar, poucos centavos por mês).
   - Ou: `rclone` / Syncthing / OneDrive copiando `pb_data/backups/` para a nuvem ou um HD externo.
3. **Teste de restauração** (antes de cadastrar a coleção de verdade): baixar um backup, subir um PocketBase em outra pasta/porta, restaurar pelo painel e conferir receitas e fotos.
4. **Exportação pelo app** (Etapa 5): botão "Exportar minhas receitas" gerando JSON + fotos em `.zip`, útil para portabilidade e independente do PocketBase.

## 10. Migração de dados existentes

Se já houver receitas no Supabase:

1. Exportar `categories` e `recipes` em CSV/JSON pelo painel do Supabase e baixar as fotos do bucket.
2. Rodar um script Node no PC (usando o SDK autenticado como superusuário) que cria as categorias, guarda o mapa `id antigo → id novo` e cria as receitas com `category` traduzida e a foto anexada.
3. Conferir as contagens e algumas receitas por amostragem.

Se ainda não houver dados reais, pular esta etapa.

## 11. Roteiro atualizado

### Etapa 0 — Infraestrutura (nova)

- Definir o sistema do PC (Windows ou Linux).
- Baixar o PocketBase, aplicar a migração, criar superusuário e usuário.
- Configurar o serviço para iniciar com o sistema.
- Adicionar o (sub)domínio do app no proxy HTTPS existente (seção 8) e testar o acesso pelo celular fora de casa (4G).
- Ligar backup automático, a cópia externa e fazer um teste de restauração.

### Etapa 1 — Adaptar e validar a base

- Trocar o SDK do Supabase pelo do PocketBase (seção 6).
- Remover a tela de cadastro e ajustar login/logout/renovação de sessão.
- Testar CRUD de receitas e categorias, busca e filtros.
- Testar fotos: upload, exibição com token, substituição, remoção e exclusão junto da receita.
- Verificar privacidade com duas contas criadas pelo painel (seção 12).
- Publicar o build em `pb_public` e instalar o PWA no celular.

### Etapa 2 — Experiência de uso

- Tela de detalhe da receita.
- Melhor editor de ingredientes e instruções.
- Redimensionamento de foto no navegador.
- Ordenação (nome, mais recentes, tempo de preparo) e filtros combinados.
- Mensagens de erro e estados de carregamento.
- Sincronização em tempo real entre aparelhos (realtime), opcional.

### Etapa 3 — Importação assistida

- Colar um link e extrair metadados (schema.org `Recipe`, Open Graph). A extração roda **no servidor**, em um hook JS do PocketBase (`pb_hooks/`) com `$http.send`, o que evita problemas de CORS no navegador.
- Enviar fotografias e capturas e usar OCR ou um modelo de IA para sugerir título, ingredientes e instruções, também via hook, com a chave da API guardada só no PC.
- Sempre mostrar o resultado para revisão antes de salvar.

### Etapa 4 — Recursos culinários

- Coleção `ingredients` estruturada (receita, quantidade, unidade, item, ordem).
- Ajuste de quantidades pelo rendimento.
- Coleções `shopping_lists` e `shopping_items` com marcação de comprado/disponível.
- Coleção `recipe_versions` para guardar a original e as adaptações.
- Todas com as mesmas regras de dono da seção 4.

### Etapa 5 — Robustez e portabilidade

- Exportação/importação de backup pelo app.
- Testes automatizados (Vitest para a lógica, Playwright para o fluxo principal contra um PocketBase de teste).
- PWA completo: service worker (por exemplo, `vite-plugin-pwa`), ícones para Android/iOS/desktop.
- Modo offline: cache de leitura das receitas; edição offline com fila de sincronização só se fizer falta.
- Documentar atualização do PocketBase e recuperação de falhas do PC.

## 12. Critérios mínimos de aceite (atualizados)

- [ ] O PocketBase inicia sozinho após reiniciar o PC.
- [ ] O app abre por HTTPS no celular fora da rede de casa.
- [ ] O usuário criado pelo painel consegue entrar e sair; não é possível se cadastrar pelo app nem pela API.
- [ ] Uma receita pode ser criada, visualizada, editada e excluída.
- [ ] A busca encontra receitas pelo nome, ingrediente e anotação.
- [ ] Favoritos, testadas e categorias filtram corretamente.
- [ ] Categorias podem ser criadas, renomeadas e removidas sem apagar receitas; nomes duplicados são recusados.
- [ ] Trocar ou remover a foto apaga o arquivo antigo; excluir a receita apaga a foto.
- [ ] A URL de uma foto não abre sem token, nem com token de outra conta.
- [ ] A conta B não lista, abre, edita, apaga nem associa categorias da conta A (testar também chamando a API direto, por exemplo com `curl`).
- [ ] A interface funciona em telas móveis e de computador e o PWA instala no celular.
- [ ] Existe backup diário com cópia fora do PC e uma restauração foi testada.

## 13. Nova estrutura de arquivos

```text
meu-caderno-de-receitas/          (repositório do frontend)
├── public/
│   ├── manifest.webmanifest
│   └── icons/
├── src/
│   ├── lib/pb.ts                  <- cliente e tipos do PocketBase
│   ├── App.tsx
│   ├── main.tsx
│   └── style.css
├── pocketbase/                    <- versionado junto do app
│   ├── pb_migrations/
│   │   └── 1761620000_init_receitas.js
│   └── pb_hooks/                  <- Etapa 3 em diante
├── scripts/
│   └── deploy.(sh|ps1)            <- build + cópia para pb_public
├── .env.example                   <- VITE_PB_URL (só dev)
├── index.html
├── package.json
├── tsconfig.json
└── README.md
```

`supabase.sql` deixa de existir. `pb_data/` nunca entra no repositório (adicionar ao `.gitignore`).

## 14. Pendências

- Confirmar o sistema operacional do PC.
- Endereço definido: `https://bokerzcraft.duckdns.org:PORTA`. Falta só a porta e confirmar qual proxy reverso a máquina usa.
- Implementação iniciada em 28/10/2026: código em `meu-caderno-de-receitas/` nos arquivos do projeto (Etapa 1 pronta e testada contra PocketBase v0.40.6).
- Escolher o destino da cópia externa do backup.
- A migração foi escrita para PocketBase v0.23+ mas ainda não foi executada; rodá-la na primeira instalação e conferir as coleções no painel faz parte da Etapa 0.
