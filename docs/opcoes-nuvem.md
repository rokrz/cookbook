# Opções de nuvem para o cenário inicial

Data: 29/10/2026. Contexto: app Android **local primeiro** (funciona sem internet, dados no aparelho),
poucos usuários no começo, custo zero de preferência, pouca manutenção. A nuvem entra para
**backup automático** e **ver o mesmo caderno em mais de um aparelho**.

## Resumo

| Opção | Custo inicial | Cartão | Manutenção | Esforço no app | Pontos fracos | Nota |
|---|---|---|---|---|---|---|
| **Google Drive do próprio usuário** (pasta oculta do app) | R$ 0, sempre | Não | Nenhuma (não há servidor) | Baixo: reaproveita o backup JSON que já existe | Sincroniza o caderno inteiro, sem tempo real; precisa de conta Google | **Recomendada para começar** |
| **Firebase** (Firestore + Auth) | R$ 0 no Spark | Só para fotos (Blaze) | Quase nenhuma | Médio: sync offline nativo do Firestore | Fotos exigem Blaze (cartão); cotas do Spark são do projeto inteiro (1 GiB, 50 mil leituras/dia) | Boa 2ª etapa |
| **Supabase** (Postgres + Auth + Storage) | R$ 0 | Não | Quase nenhuma | Médio: precisa escrever a sincronização | Projeto grátis **pausa após 1 semana sem uso**; Pro custa US$ 25/mês | Boa se quiser SQL e recursos sociais |
| **PocketBase em VPS** | ~US$ 4–6/mês (ou Oracle Always Free) | Sim | Você atualiza, faz backup e monitora | Baixo/médio: `PocketBaseStore` já existe, falta a sincronização | Servidor é seu problema; Oracle grátis pode suspender conta parada 30 dias | Só se quiser controle total |
| **Cloudflare** (Workers + D1 + R2) | R$ 0 (cotas largas, sem pausa) | Não | Baixa | Alto: login e API escritos do zero | Mais código para manter | Para quando crescer |
| **Appwrite Cloud** | R$ 0 | ? | Quase nenhuma | Médio | Não consegui confirmar os limites do plano grátis; projeto congela ao estourar | Não priorizar |

## Recomendação

1. **Agora: backup e sincronização no Google Drive do usuário** (pasta `appDataFolder`, invisível no Drive).
   - Cada usuário guarda o caderno na própria conta Google: **custo zero para você**, nada para hospedar,
     e você não guarda dados de terceiros (bom para a LGPD e para publicar na Play Store).
   - O escopo `drive.appdata` é classificado pelo Google como **não sensível**: basta a verificação básica do
     OAuth, sem auditoria de segurança.
   - Funciona com o que já existe: o app gera o mesmo JSON do Backup, envia ao Drive quando houver internet, e
     ao abrir em outro aparelho baixa e mescla. A mescla por receita usa o campo `updated` (fica a versão mais
     nova de cada receita); exclusões precisam de uma "lápide" (`deleted: true`) para não voltarem.
   - Limite: não é tempo real e não serve para compartilhar receitas entre pessoas.

2. **Se o app crescer ou quiser contas de verdade** (compartilhar caderno, site, login com e-mail):
   **Firebase**. O Firestore já sincroniza offline sozinho, o login é pronto e não pausa por falta de uso.
   Para fotos, migrar para o Blaze com alerta de orçamento (a cota grátis cobre 5 GB).
   Supabase é a alternativa se preferir SQL, mas a pausa semanal do plano grátis atrapalha um app com poucos
   usuários no começo.

3. **PocketBase** continua bom para o seu uso pessoal no PC, mas para um app publicado ele obriga você a
   manter um servidor. Não recomendo como nuvem pública agora.

## Esforço estimado da opção recomendada (Drive)

- Login com Google no APK (plugin Capacitor de Google Sign-In) e cliente da API do Drive (REST, `fetch`).
- `src/data/sync.ts`: enviar/baixar o backup, mesclar por `updated`, lápides de exclusão.
- Tela Backup: "Conectar Google Drive", último envio, "Sincronizar agora"; envio automático ao salvar
  (com espera de alguns segundos) e ao abrir o app.
- Fotos: no mesmo arquivo (simples) ou como arquivos separados na pasta do app (melhor quando o caderno crescer).

## Fontes (consultadas em 29/10/2026)
- Supabase: https://supabase.com/pricing (Free: 500 MB de banco, 1 GB de arquivos, 5 GB de tráfego, 50 mil MAU, 2 projetos, pausa após 1 semana sem uso)
- Firebase: https://firebase.google.com/pricing e https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- Cloudflare: https://developers.cloudflare.com/r2/pricing/ (10 GB grátis, sem custo de saída), https://developers.cloudflare.com/d1/platform/pricing/ (5 GB, 5 mi leituras/dia), https://developers.cloudflare.com/workers/platform/pricing/ (100 mil requisições/dia)
- Google Drive, escopos: https://developers.google.com/workspace/drive/api/guides/api-specific-auth (`drive.appdata` e `drive.file` não sensíveis)
- Appwrite: https://appwrite.io/pricing (limites do plano grátis não apareceram na página)
- Oracle Cloud Free Tier: https://www.oracle.com/cloud/free/ (cartão para verificação; conta parada 30 dias pode ser suspensa)
