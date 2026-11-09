# Backup no Google Drive: configuração no Google Cloud

O app guarda os backups no Google Drive **da própria pessoa**, numa pasta escondida que só este app
enxerga (`appDataFolder`, escopo `drive.appdata`). Não existe servidor nosso no meio, e o espaço usado
é o do Drive de quem fez o backup.

Para o Google deixar o app pedir esse acesso, é preciso registrar o app **uma vez** no Google Cloud
Console. Isso só o dono do app (você) pode fazer, com a sua conta Google. Leva uns 10 minutos e é grátis.

Dados que você vai precisar:

| O quê | Valor |
| --- | --- |
| Nome do pacote do APK | `io.github.rokrz.cadernodereceitas` |
| SHA-1 da chave de teste (`android/keystore/caderno-dev.jks`) | `6E:F5:4F:EA:79:3D:CC:17:32:B5:FA:A5:36:4E:71:F4:D1:07:8D:C3` |
| Escopo | `https://www.googleapis.com/auth/drive.appdata` |

> O SHA-1 acima é o da chave que assina todos os APKs gerados pelo GitHub Actions. Para conferir:
> `keytool -list -v -keystore android/keystore/caderno-dev.jks -storepass caderno-dev`

## 1. Criar o projeto

1. Abra <https://console.cloud.google.com/> e entre com a sua conta Google.
2. No seletor de projetos (no alto da página), clique em **Novo projeto**.
3. Nome: `Caderno de Receitas`. Clique em **Criar** e depois selecione o projeto criado.

## 2. Ativar a Google Drive API

1. Menu ☰ → **APIs e serviços** → **Biblioteca**.
2. Procure **Google Drive API**, abra e clique em **Ativar**.

## 3. Configurar a tela de consentimento (Google Auth Platform)

1. Menu ☰ → **APIs e serviços** → **Tela de consentimento OAuth** (ou **Google Auth Platform**). Clique em **Começar**.
2. **Informações do app:** nome `Caderno de Receitas` e o seu e-mail como e-mail de suporte.
3. **Público:** escolha **Externo** (qualquer pessoa com conta Google).
4. **Dados de contato:** o seu e-mail. Aceite a política e clique em **Criar**.
5. Em **Acesso a dados** → **Adicionar ou remover escopos**, marque
   `.../auth/drive.appdata` (procure por "drive.appdata") e salve.
   Esse escopo é classificado pelo Google como **não sensível**, então não precisa de verificação.
6. Em **Público**:
   - Para testar só com a sua conta, deixe **Em teste** e adicione o seu e-mail em **Usuários de teste**.
     Nesse modo o Google pode pedir para autorizar de novo depois de alguns dias.
   - Quando quiser liberar para qualquer pessoa, clique em **Publicar app** (vai para **Em produção**).
     Com escopo não sensível e sem logotipo, não há revisão do Google.

## 4. Criar o cliente OAuth do Android (o que o APK usa)

1. Em **Clientes** (ou **Credenciais** → **Criar credenciais** → **ID do cliente OAuth**), clique em **Criar cliente**.
2. Tipo de aplicativo: **Android**.
3. Nome: `Caderno de Receitas (APK de teste)`.
4. Nome do pacote: `io.github.rokrz.cadernodereceitas`
5. Impressão digital do certificado SHA-1: `6E:F5:4F:EA:79:3D:CC:17:32:B5:FA:A5:36:4E:71:F4:D1:07:8D:C3`
6. Clique em **Criar**.

Pronto: **não precisa colocar nada no código** para o APK. O Google reconhece o app pelo pacote + SHA-1.
Pode levar alguns minutos (às vezes até uma hora) para valer.

## 5. Testar no celular

1. Instale o APK novo (link da release `apk-latest` no README).
2. Abra **Backup** → **Conectar Google Drive**, escolha a conta e autorize.
3. Toque em **Enviar backup agora**. Depois, em **Restaurar do Drive**, o backup deve aparecer na lista.

Para conferir no Drive: drive.google.com → ⚙ **Configurações** → **Gerenciar apps** → "Caderno de Receitas"
aparece com "dados ocultos do app" (os arquivos em si não aparecem nas pastas, é o esperado).

### Se der erro

| Mensagem no app | Causa provável |
| --- | --- |
| "O app ainda não está liberado no Google Cloud (pacote ou SHA-1 não cadastrados)" | Cliente Android não criado, pacote/SHA-1 digitados errado, ou ainda propagando (espere alguns minutos). |
| "A Google Drive API não está ativada…" | Faltou o passo 2. |
| Tela do Google diz "acesso bloqueado" / "app não verificado" | App **Em teste** e o seu e-mail não está em **Usuários de teste** (passo 3.6). |
| "Login no Google cancelado" | A tela do Google foi fechada sem autorizar. |

## Quando publicar na Play Store

A Play Store assina o app com outra chave (Play App Signing). Depois de enviar o app:

1. Play Console → o app → **Configuração** → **Integridade do app** → copie o **SHA-1 da chave de assinatura do app**.
2. No Google Cloud, crie **outro** cliente Android com o mesmo pacote e esse SHA-1.

Os dois clientes podem existir juntos (APK de teste e versão da loja).

## Versão web (opcional)

A versão de navegador (PWA ou servida pelo PocketBase) usa outro tipo de cliente:

1. **Criar cliente** → tipo **Aplicativo da Web**.
2. **Origens JavaScript autorizadas:** o endereço onde o app abre, por exemplo
   `https://bokerzcraft.duckdns.org:PORTA` e, para desenvolvimento, `http://localhost:5173`.
3. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`) para o `.env`:
   ```
   VITE_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
   ```
4. Compile de novo (`npm run build` ou `scripts/deploy.*`).

O client ID não é segredo (vai no código do site), mas só funciona nas origens cadastradas.
Sem essa variável, a parte do Google Drive simplesmente não aparece na versão web.
No navegador o backup automático só roda enquanto a sessão do Google estiver aberta (cerca de 1 hora após entrar).

## Como funciona no código

- `android/app/src/main/java/.../GoogleDrivePlugin.java`: login com a API de autorização do Google Play Services
  (`play-services-auth`), pedindo só o escopo `drive.appdata`. Devolve um token de acesso de curta duração.
- `src/lib/googleDrive.ts`: token (APK ou Google Identity Services no navegador) e chamadas à Drive API
  (listar, enviar em modo *resumable*, baixar, apagar).
- `src/data/driveBackup.ts`: conectar/desconectar, enviar, restaurar, manter os 7 últimos e o backup automático
  diário ao abrir o app (não envia se o caderno estiver vazio, para não empurrar backups bons para fora).
- O arquivo enviado é o mesmo JSON do "Baixar backup" (`src/data/backup.ts`), com fotos.
