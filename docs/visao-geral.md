# Caderno de Receitas: visão geral

Atualizado em 31/10/2026.

## O que é

O **Caderno de Receitas** é um app para guardar receitas no celular. A ideia central é capturar receitas
rápido, de onde quer que elas apareçam (Instagram, TikTok, Facebook, Pinterest, sites), e organizá-las
num caderno pessoal com categorias, fotos e anotações.

O foco é **Android** e o app é **local primeiro**: tudo fica no aparelho, funciona sem internet e não
precisa de conta. A nuvem (backup automático e o mesmo caderno em mais de um aparelho) é o próximo passo.

## Funcionalidades

| Funcionalidade | Como funciona |
|---|---|
| **Modo local e offline** | Receitas, categorias e fotos ficam no IndexedDB do aparelho. Sem conta, sem servidor. No navegador, o service worker (`public/sw.js`) guarda o app para abrir sem internet; no APK o app já vai dentro do pacote. |
| **Salvar link** | Tela "Salvar link" (`#/salvar`): basta o link, um nome e a categoria. Links repetidos são avisados, mesmo com parâmetros de rastreio diferentes. Essas receitas aparecem com o selo "Só o link" e no filtro "Para completar". |
| **Menu Compartilhar do Android** | No APK, "Compartilhar → Caderno de Receitas" em outro app abre o Salvar link já preenchido (intent `SEND text/plain`). Na versão web instalada, o mesmo vale pelo `share_target` do manifesto. No iPhone não existe; há o botão "Colar". |
| **Categoria na hora** | "+ Nova categoria…" no seletor do Salvar link e do formulário completo. Se o nome já existe, seleciona a existente. |
| **Receitas completas** | Criar, ver, editar e excluir, com ingredientes, modo de preparo, tempo, porções, observações, favorita e testada. Foto reduzida no aparelho (até 2000 px, limite de 5 MB) com miniatura. |
| **Biblioteca** | Busca sem diferenciar acentos e filtros por favoritas, testadas, para completar e categoria. |
| **Categorias** | Criar, renomear, excluir (as receitas ficam sem categoria) e adicionar categorias sugeridas. |
| **Backup** | Tela "Backup" (`#/backup`): baixa um arquivo `.json` com receitas, categorias e fotos e restaura a partir dele. No APK o arquivo pode ser salvo ou compartilhado. |
| **Modo PocketBase (opcional)** | Com `VITE_BACKEND=pocketbase`, o mesmo app usa um servidor PocketBase com login (uso pessoal, no PC de casa). O backup desse modo serve para levar o caderno para a versão local. |

## Stack

- **Frontend:** React 19 + TypeScript + Vite, como PWA (manifesto, ícones e service worker).
- **Dados no aparelho:** IndexedDB via biblioteca `idb`.
- **Android:** Capacitor 8 (`android/`), appId `io.github.rokrz.cadernodereceitas`. Plugins `@capacitor/filesystem` e `@capacitor/share` para o backup.
- **Servidor opcional:** PocketBase (v0.23 ou superior; testado com v0.40.6), com migrações em `pocketbase/pb_migrations/`.
- **Interface:** ícones `lucide-react`, fontes DM Sans e Playfair Display.
- **CI:** GitHub Actions gera o APK a cada push.

A camada de dados é uma interface única (`Store`, em `src/data/types.ts`) com duas implementações:
`LocalStore` (padrão) e `PocketBaseStore`. As telas não sabem onde os dados ficam, o que facilita
trocar ou somar um backend de nuvem depois.

## Estrutura de pastas

```text
├── src/
│   ├── App.tsx               casca do app e rotas por hash (#/nova, #/salvar, #/receita/:id …)
│   ├── components/           Biblioteca, Salvar link, Formulário, Detalhe, Categorias, Backup, Login
│   ├── data/                 Store: LocalStore (IndexedDB), PocketBaseStore, backup, tipos
│   └── lib/                  links e compartilhamento, arquivos, imagens, texto, erros
├── public/                   manifesto (share_target), ícones e service worker
├── android/                  projeto Android do Capacitor (MainActivity, chave de teste)
├── capacitor.config.ts       configuração do Capacitor
├── .github/workflows/        android.yml: build do APK e release apk-latest
├── pocketbase/pb_migrations/ coleções, regras de acesso e configurações do PocketBase
├── deploy/                   serviço systemd e exemplos de Caddy e nginx
├── scripts/                  deploy.sh, deploy.ps1 e setup-linux.sh (modo PocketBase)
├── tests/api.test.mjs        testes de privacidade e regras contra um PocketBase de teste
└── docs/                     planos, comparação de nuvens e roteiros de instalação
```

## Como rodar

No navegador, modo local (sem servidor):

```bash
npm install
npm run dev
```

Para testar o compartilhamento sem celular, abra
`http://localhost:5173/?text=Olha%20https://www.instagram.com/p/abc/`.
O service worker só é registrado no build (`npm run build && npm run preview`).

O modo PocketBase e a instalação no PC de casa estão no [README](../README.md) e em
[roteiro-setup-linux.md](roteiro-setup-linux.md).

## Como gerar e instalar o APK

**Pelo GitHub (o jeito normal):** cada push na `main` roda o workflow **APK Android** e atualiza a
release `apk-latest`. O APK mais recente da `main` fica sempre neste link fixo:

<https://github.com/rokrz/cookbook/releases/download/apk-latest/caderno-de-receitas.apk>

Em outras branches (`claude/**`), o APK fica em *Actions → APK Android → execução → Artifacts*.

**Na sua máquina** (precisa do Android SDK 36 e Java 21):

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
# APK em android/app/build/outputs/apk/debug/app-debug.apk
```

O APK é assinado com a chave de teste `android/keystore/caderno-dev.jks`, sempre a mesma, para instalar
versões novas por cima sem perder as receitas. Para publicar na Play Store, é preciso gerar outra chave
e guardá-la fora do repositório.

## Próximos passos

1. **Nuvem, etapa 1: Google Drive do usuário** (pasta oculta `appDataFolder`). Cada pessoa guarda o
   caderno na própria conta Google: custo zero, nada para hospedar e nenhum dado de terceiros guardado
   por nós. O app reaproveita o JSON do backup, envia ao Drive quando houver internet e mescla por receita
   usando o campo `updated`, com "lápides" para exclusões. Exige login Google no APK e uma tela
   "Conectar Google Drive" no Backup.
2. **Nuvem, etapa 2: Firebase** (Firestore + Auth), se o app crescer ou precisar de contas de verdade
   e compartilhamento de cadernos. Fotos exigem o plano Blaze.
3. **Publicação na Play Store:** chave de assinatura própria e ficha da loja.
4. **Preenchimento automático de links** (título e foto do post): fica para quando houver um servidor
   ou função na nuvem.

A comparação completa entre Google Drive, Firebase, Supabase, PocketBase em VPS, Cloudflare e Appwrite
está em [opcoes-nuvem.md](opcoes-nuvem.md).

## Outros documentos

- [plano-importacao-link-e-backends.md](plano-importacao-link-e-backends.md): plano de salvar por link, compartilhamento e versão local.
- [opcoes-nuvem.md](opcoes-nuvem.md): opções de nuvem e recomendação.
- [plano-implementacao-pocketbase.md](plano-implementacao-pocketbase.md): servidor PocketBase no PC de casa.
- [roteiro-setup-linux.md](roteiro-setup-linux.md) e [instalacao-linux.md](instalacao-linux.md): instalação do servidor no Linux.
