# Plano: salvar por link, compartilhar para o app, categorias rápidas e opções de backend

Data: 29/10/2026 · Situação: análise e plano, nada implementado ainda.
Base: app "Meu Caderno de Receitas" (React + TS + Vite, PWA) com PocketBase hospedado no PC do Ivan
(ver `plano-implementacao-pocketbase.md`).

## Resumo e recomendação

| Ideia | Viável? | Esforço | Recomendação |
|---|---|---|---|
| 1. Salvar só nome + link | Sim, o banco já aceita | Pequeno | Fazer primeiro |
| 2. App na lista de compartilhamento | Android e Windows/Chrome: sim. iPhone: não como PWA, só via Atalho | Pequeno/médio | Fazer, com Atalho do iOS como alternativa |
| 3. Link de Instagram/Facebook/TikTok/Pinterest com nome | Sim. Preencher nome/foto automaticamente: parcial, depende da rede | Médio | Fazer com o nome digitado sempre possível; preenchimento automático é bônus |
| 4. Criar categoria na hora de importar/criar | Sim | Pequeno | Fazer junto com 1 |
| 5. Versão 100% local no aparelho | Sim, com perdas (sem sincronizar, risco de perder dados, sem leitura automática do link) | Grande | Não agora. Preparar o código para isso (camada de dados) e decidir depois |
| 6. Firebase gratuito | Sim para receitas/categorias/conta. **Fotos e leitura de links exigem o plano pago (Blaze)** | Grande (outra migração) | Não trocar agora. Manter PocketBase |

Ordem sugerida: **4 → 1 → 2 → 3**, tudo no PocketBase atual. Depois, se fizer sentido, a camada de
dados que abre caminho para o modo local (5). Firebase (6) só se o Ivan quiser parar de manter o PC
ligado como servidor; nesse caso, ver a seção 6 antes.

---

## 1. Salvar receita só com nome e link ("salvar rápido")

**Hoje:** a coleção `recipes` só exige `title`. Uma receita com `title` + `source_url` já é válida
no servidor. O que falta é a experiência no app.

**Proposta**
- Na tela "Nova", um modo **Salvar rápido** com três campos: link, nome e categoria (opcional).
  Botão "Salvar" e, ao lado, "Completar depois".
- Na biblioteca, essas receitas aparecem com selo **"Só o link"** e um filtro "Para completar".
  Não precisa de campo novo: é "sem ingredientes e sem modo de preparo"
  (`ingredients = '' && instructions = ''`). Se depois quisermos marcar manualmente, adicionamos um
  campo `bool` `draft`.
- No detalhe de uma receita só com link: botão grande **"Abrir post original"** e "Completar receita".
- Campo novo opcional `source_platform` (`instagram`, `tiktok`, `facebook`, `pinterest`, `youtube`,
  `site`) preenchido automaticamente a partir do domínio, para mostrar o ícone da rede e filtrar.

**Mudanças**
- Migração nova `pb_migrations/<ts>_quick_save.js`: campo `source_platform` (select, opcional).
- `src/lib/links.ts`: `normalizeUrl()` (remove parâmetros de rastreio como `utm_*`, `igsh`,
  `fbclid`, `si`) e `detectPlatform()`.
- `RecipeForm.tsx`: modo rápido; `Library.tsx`: selo e filtro.
- Evitar duplicata: antes de salvar, procurar `source_url = {:url}` do usuário e avisar
  "Você já salvou este link" com atalho para a receita existente.

## 2. O app aparecer na lista de compartilhamento

**Como funciona:** a API **Web Share Target**. O `manifest.webmanifest` declara `share_target`, e o
sistema mostra o app instalado (PWA) no menu "Compartilhar" de outros apps.

```json
"share_target": {
  "action": "/",
  "method": "GET",
  "params": { "title": "title", "text": "text", "url": "url" }
}
```

O app abre em `/?title=...&text=...&url=...`, lê esses parâmetros na inicialização, limpa a URL e vai
para a tela de **Salvar rápido** com o link e o nome pré-preenchidos.

**Onde funciona**
- **Android (Chrome, Edge, Samsung Internet):** sim, depois de "Instalar app"/"Adicionar à tela
  inicial". É o caso principal.
- **Windows/ChromeOS (Chrome/Edge com o app instalado):** sim.
- **iPhone/iPad:** **não**. O Safari não implementa Web Share Target para PWAs (pedido aberto no
  WebKit há anos). Alternativa que funciona bem: um **Atalho do iOS** (app Atalhos) que aparece no
  menu Compartilhar, recebe o link e abre
  `https://<endereço do app>/?url=<link>`. Documentamos o passo a passo e deixamos um link
  "Adicionar atalho" na tela de ajuda.
- Em qualquer aparelho: botão **"Colar link"** na tela Salvar rápido (lê a área de transferência
  quando o navegador permite) como plano C.

**Detalhes importantes**
- Instagram, TikTok e outros costumam mandar o link dentro de `text` (ex.: "Veja este post...
  https://..."), não em `url`. O app precisa extrair o primeiro `https://...` de `url`, `text` ou
  `title`, nessa ordem.
- Se o usuário não estiver logado, guardar o link compartilhado em `sessionStorage`, mostrar o login
  e seguir para o Salvar rápido depois.
- O método GET não exige service worker. Só precisaremos de service worker (e POST) se um dia
  quisermos receber **imagens** compartilhadas.
- O manifest precisa de ícones PNG 192×192 e 512×512 (hoje só tem SVG). Sem eles alguns Androids
  não oferecem a instalação completa (WebAPK), e sem instalação não há compartilhamento.

**Mudanças:** `public/manifest.webmanifest` (share_target + ícones PNG), `src/lib/share.ts`
(ler e extrair o link), `App.tsx` (rota de entrada), `docs/` com o Atalho do iOS.

## 3. Importar link de Instagram, Facebook, TikTok, Pinterest

O mínimo que sempre funciona: **link + nome digitado** (itens 1 e 2). Em cima disso, tentar
**preencher nome e foto automaticamente**. Isso precisa ser feito **no servidor**: o navegador não
consegue ler páginas de outros sites (CORS), e as redes bloqueiam isso de propósito.

Com PocketBase dá para fazer isso sem programa extra: um hook JavaScript em `pb_hooks/` cria a rota
`GET /api/link-preview?url=...` (só para usuário logado), que busca os dados com `$http.send`.

O que cada rede entrega hoje:

| Rede | Como | Nome/legenda | Foto | Observação |
|---|---|---|---|---|
| TikTok | oEmbed público `https://www.tiktok.com/oembed?url=` | Sim (legenda do vídeo) | Sim (`thumbnail_url`) | Mais confiável |
| YouTube | oEmbed público | Sim | Sim | Bônus, mesmo caminho |
| Pinterest | Tags `og:title`/`og:image` da página do pin | Geralmente sim | Geralmente sim | Links curtos `pin.it` precisam seguir o redirecionamento |
| Instagram | oEmbed da Meta, sem token desde jun/2026 | Não vem como campo; às vezes dá para extrair do HTML do embed | Não | Página do post exige login; esperar nome digitado |
| Facebook | oEmbed da Meta (post/vídeo), sem token | Idem Instagram | Não | Idem |
| Sites de receita | `og:*` e, quando houver, JSON-LD `Recipe` | Sim | Sim | Pode até trazer ingredientes e preparo (já previsto na "Etapa 3 — Importação assistida") |

**Regras**
- O nome sugerido entra no campo como sugestão editável. Legendas longas são cortadas na primeira
  linha/200 caracteres.
- A foto é **baixada pelo servidor e salva no campo `image`** da receita. Não guardar a URL da rede:
  as de Instagram/TikTok expiram.
- Limites no hook: só `https`, só domínios conhecidos ou páginas HTML, tempo máximo de 8 s, tamanho
  máximo de 2 MB, bloquear endereços internos (127.0.0.1, 192.168.x.x etc.) para o servidor não ser
  usado para acessar a rede de casa.
- Se falhar, o app segue normalmente com o nome digitado. Nada depende disso.

**Mudanças:** `pocketbase/pb_hooks/link_preview.pb.js`, `src/lib/links.ts` (chamada e fallback),
tela Salvar rápido mostrando "Buscando dados do post..." sem travar o botão Salvar.

## 4. Criar categoria na hora de importar/criar

**Proposta:** o seletor de categoria vira uma caixa com busca. Ao digitar um nome que não existe,
aparece a opção **"+ Criar categoria 'Massas'"**. Ao tocar, cria e já seleciona.

- Funciona igual no Salvar rápido, no formulário completo e na edição.
- O índice único `(user, name COLLATE NOCASE)` já impede duplicatas. Se der conflito (ex.: criada em
  outro aparelho), buscar a existente e selecioná-la em vez de mostrar erro.
- Depois de criar, chamar o `reloadCategories` que já existe no `App.tsx`.

**Mudanças:** componente `src/components/CategoryPicker.tsx`, usado por `RecipeForm.tsx`; o
`App.tsx` passa `onCategoryCreated`. Sem mudança no banco.

## 5. Versão 100% local no aparelho

**Como seria:** tudo guardado no navegador do aparelho (IndexedDB, via biblioteca Dexie), fotos como
`Blob`, e um service worker (`vite-plugin-pwa`) para abrir sem internet. Sem conta e sem servidor.

**Vantagens:** funciona offline e sem o PC ligado, zero custo, zero manutenção, nada sai do aparelho.

**Desvantagens reais**
- **Sem sincronização:** receitas do celular não aparecem no computador nem em outro aparelho.
- **Risco de perder tudo:** limpar dados do navegador, desinstalar o app ou trocar de celular apaga o
  caderno. No iPhone, o Safari pode apagar dados de sites não instalados após 7 dias sem uso. Mitiga:
  instalar o app, pedir `navigator.storage.persist()` e ter **Exportar/Importar backup** (arquivo
  `.zip` com JSON + fotos) e lembrete periódico de backup.
- **Sem leitura automática de links** (item 3), porque não há servidor. Fica só "link + nome".
- Compartilhamento (item 2) continua funcionando no Android.

**Como fazer sem duplicar o app:** criar uma **camada de dados** (`src/data/`) com uma interface única
(`listRecipes`, `saveRecipe`, `listCategories`, `createCategory`, `imageUrl`...) e duas
implementações: `PocketBaseStore` e `LocalStore`. A escolha acontece na primeira tela
("Usar só neste aparelho" ou "Entrar na minha conta"). Bônus: "Enviar meu caderno local para a conta"
usando o mesmo formato do backup.

Esta camada também é o que permitiria trocar para Firebase no futuro sem reescrever as telas.

**Recomendação:** não fazer agora. Fazer primeiro a camada de dados (refatoração sem mudança visível)
quando os itens 1–4 estiverem prontos, e decidir o modo local depois de usar o app por um tempo. Se a
motivação for "funcionar sem internet", um **cache offline** em cima do PocketBase (ler receitas já
vistas sem conexão) entrega quase tudo com menos risco.

## 6. Firebase (plano gratuito) para receitas, categorias e conta

**O que o plano gratuito (Spark) cobre, conferido em out/2026**
- Firestore: 1 GiB armazenado, 50 mil leituras/dia, 20 mil gravações/dia. Sobra muito para um
  caderno pessoal.
- Authentication: e-mail/senha e Google, grátis.
- Hosting: 10 GB, 360 MB/dia de tráfego, HTTPS e domínio próprio. Resolveria o servidor no PC.

**O que o plano gratuito NÃO cobre**
- **Fotos (Cloud Storage):** desde 03/02/2026 projetos no Spark não acessam nenhum bucket. É preciso
  o plano **Blaze** (cartão de crédito cadastrado). O Blaze ainda tem cota grátis (5 GB), então na
  prática custaria R$ 0, mas exige cartão e traz risco de cobrança se algo sair do controle (definir
  alerta de orçamento). Alternativa sem Blaze: guardar fotos pequenas (≤ ~700 KB, comprimidas) dentro
  do documento no Firestore; funciona, mas pesa nas leituras e no limite de 1 MiB por documento.
- **Cloud Functions:** só no Blaze. Sem elas, não há servidor para ler links do Instagram/TikTok
  (item 3) nem para tarefas como backup automático.

**Comparação com o PocketBase atual**

| | PocketBase no PC (atual) | Firebase Spark | Firebase Blaze (cota grátis) |
|---|---|---|---|
| Custo | R$ 0 + energia do PC | R$ 0 | R$ 0 dentro da cota, cartão obrigatório |
| PC precisa ficar ligado | Sim | Não | Não |
| Fotos | Sim | Só embutidas e pequenas | Sim |
| Ler links (item 3) | Sim (pb_hooks) | Não | Sim (Functions) |
| Offline / sincronização | Não (só com cache) | Sim, nativo do Firestore | Sim |
| Backup | Automático no PC + cópia externa | Exportação manual ou pago | Exportação agendada é paga |
| Dados ficam com quem | Com o Ivan | Google | Google |
| Trabalho de migração | Já feito | Reescrever acesso a dados, regras e login | Idem |

**Recomendação:** manter o PocketBase. O Firebase só compensa se o problema for **manter o PC ligado e
acessível**; nesse caso, o caminho é Blaze com alerta de orçamento (não Spark), e a migração fica bem
mais simples se a camada de dados da seção 5 já existir. Se quiser seguir por aí, o modelo seria:

```
users/{uid}                      perfil (nome do caderno)
users/{uid}/categories/{id}      { name, nameLower, created }
users/{uid}/recipes/{id}         { title, categoryId, ingredients, ..., sourceUrl, sourcePlatform, imagePath }
storage: users/{uid}/recipes/{id}.webp
regras: request.auth.uid == uid em tudo
```

## 6b. Revisão: o objetivo é publicar o app (resposta do Ivan, 29/10/2026)

O Ivan explicou: a versão local é pensando em **publicar o app** para outras pessoas, e o Firebase é
uma alternativa ao **PC de casa fazendo papel de servidor**. Isso muda a recomendação das seções 5 e 6.

**Por que o PC de casa não serve para um app publicado:** cada usuário novo usa a sua máquina, sua
internet e sua energia; se o PC desliga, o app de todo mundo para; abrir cadastro para estranhos na
rede de casa é risco de segurança; e você vira responsável pelos dados de terceiros (LGPD).

**Modelo recomendado para publicar: "local primeiro, nuvem opcional"**
- Por padrão o app guarda tudo **no aparelho** (IndexedDB). Quem baixa usa sem criar conta, sem custo
  para você por usuário, e funciona offline.
- **Conta opcional** ("Fazer backup e sincronizar") para quem quer o caderno em mais de um aparelho.
  Só esses usuários geram custo de servidor.
- Exportar/Importar backup em arquivo sempre disponível.
- A camada de dados da seção 5 (`src/data/` com `LocalStore` + um store de nuvem) deixa de ser
  opcional e vira a base.

**Qual nuvem para a sincronização**

| | Firebase (Blaze com cota grátis) | PocketBase em servidor alugado (VPS) | PocketBase no PC de casa |
|---|---|---|---|
| Custo inicial | R$ 0 dentro da cota; cartão obrigatório; definir alerta de orçamento | ~US$ 4–6/mês | R$ 0 |
| Manutenção | Quase nenhuma | Atualizar, backup, monitorar | Igual VPS + PC ligado |
| Sincronização e offline | Nativos no Firestore | Precisa programar | Precisa programar |
| Fotos | Cloud Storage (5 GB grátis) | Disco do servidor | Disco do PC |
| Ler links de redes (item 3) | Cloud Functions (cota grátis) | pb_hooks | pb_hooks |
| Login Google/Apple | Pronto | Possível (OAuth2), configurar | Idem |
| Cresce com usuários | Automático, paga por uso | Trocar de plano | Não |

O plano **Spark** (sem cartão) não serve para publicar: sem fotos, sem Functions, e as cotas
(50 mil leituras/dia, 1 GiB) são do projeto inteiro, divididas entre todos os usuários.

**Recomendação para publicar:** local primeiro + **Firebase Blaze** para quem quiser conta, com alerta
de orçamento em US$ 1 e regras de segurança por usuário. O PocketBase pode continuar sendo o servidor
pessoal do Ivan até a migração.

**Publicar onde**
- **Android / Play Store:** empacotar o PWA como TWA (Bubblewrap). Taxa única de US$ 25. O
  compartilhamento (item 2) funciona igual.
- **iPhone / App Store:** exige empacotar com **Capacitor** (US$ 99/ano). Com Capacitor dá para criar
  uma extensão de compartilhamento nativa, resolvendo a limitação do iOS do item 2, e usar SQLite em
  vez de IndexedDB (sem risco de o sistema apagar dados).
- **Só como site/PWA:** custo zero, mas descoberta e instalação mais difíceis, e sem compartilhamento
  no iPhone.

**Antes de publicar, além do código:** política de privacidade (obrigatória nas lojas e pela LGPD),
termos de uso, opção de excluir conta e dados, e cuidado com o item 3: o app só guarda o link e um
nome; não copiar fotos ou textos de posts de terceiros para usuários públicos sem pensar em direitos
autorais (para uso pessoal o risco é baixo; num app publicado, preferir mostrar a prévia sem
armazenar a foto, ou só a miniatura).

## 7. Roteiro proposto

> Revisado pela seção 6b: se o objetivo for publicar, a Etapa C vira obrigatória e passa a ser
> "camada de dados → LocalStore como padrão → FirebaseStore para sincronização → empacotar para as
> lojas". As Etapas A e B continuam iguais e podem ser feitas antes.

**Etapa A — Captura rápida (no PocketBase)**
1. `CategoryPicker` com criação na hora (item 4).
2. Salvar rápido + selo "Só o link" + filtro "Para completar" + aviso de link duplicado (item 1).
3. `share_target` no manifest, ícones PNG e leitura dos parâmetros (item 2). Foco Android; Atalho do iOS fica opcional.

**Etapa B — Preenchimento automático**
4. Hook `link-preview` com TikTok, YouTube, Pinterest e sites (og/JSON-LD); Instagram/Facebook pelo
   oEmbed da Meta, aceitando que muitas vezes virá vazio (item 3).
5. Download da foto do post para o campo `image`.

**Etapa C — Preparar para outros backends (opcional)**
6. Camada `src/data/` com `PocketBaseStore`.
7. Cache offline de leitura (service worker).
8. Só então decidir: `LocalStore` (100% local) e/ou `FirebaseStore`.

**Critérios de aceite da Etapa A**
- No Android, com o app instalado, "Compartilhar → Receitas" a partir do Instagram e do TikTok abre o
  Salvar rápido com o link preenchido.
- É possível salvar com só link + nome, criando uma categoria nova no mesmo passo, em menos de 10 s.
- Compartilhar o mesmo link duas vezes avisa que já existe.

## 8. Respostas e pendências

Respondido pelo Ivan em 29/10/2026:
- **Foco é Android.** O compartilhamento via Web Share Target cobre o caso principal; o Atalho do iOS
  sai da Etapa A (fica como item opcional). Publicação começa pela Play Store via TWA.
- **Local** é pensando em publicar o app; **Firebase** é alternativa ao PC de casa como servidor
  (ver seção 6b).
- **Usar sem internet é um atrativo grande.** Reforça o "local primeiro": o app precisa de service
  worker (vite-plugin-pwa) para abrir offline, e toda leitura e gravação acontece no aparelho; a
  sincronização com a nuvem roda quando houver conexão. Isso também é exigido para o TWA da Play Store
  passar na verificação de qualidade.

**Decisão (29/10/2026): a primeira versão publicada é só local.** Sem conta e sem nuvem; backup por
exportar/importar arquivo. A nuvem (Firebase Blaze ou PocketBase em VPS) fica para uma versão futura.

Consequências para a v1:
- Camada de dados com `LocalStore` (IndexedDB) + service worker para funcionar offline.
- Item 3 (preencher nome/foto a partir do link) não tem servidor na v1: fica só link + nome digitado.
  Exceção possível: tentar o oEmbed do TikTok direto do navegador, se ele aceitar CORS (testar).
- Itens 1, 2 e 4 entram normalmente. Publicação na Play Store via TWA.
- O PocketBase continua como servidor pessoal do Ivan até ele migrar para a versão local.

## Fontes
- Firebase, mudanças no Cloud Storage (Blaze obrigatório desde 03/02/2026):
  https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- Firebase, preços e limites do Spark: https://firebase.google.com/pricing
- Meta, oEmbed sem token (15/06/2026):
  https://developers.facebook.com/blog/post/2026/06/15/tokenless-access-to-meta-oembed-apis/
- WebKit, pedido de suporte a Web Share Target: https://bugs.webkit.org/show_bug.cgi?id=194593
