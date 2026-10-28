# Instalação do PocketBase na máquina Linux

Guia para colocar o **Meu Caderno de Receitas** no ar em `https://bokerzcraft.duckdns.org:PORTA`.
Em todos os comandos, troque **`PORTA`** pela porta pública do seu proxy HTTPS.

O resultado final:

```text
Internet ──HTTPS──> proxy que já existe (bokerzcraft.duckdns.org:PORTA)
                         │
                         └──> 127.0.0.1:8090  PocketBase (serviço systemd, usuário "pocketbase")
                                   ├── pb_public/      app compilado
                                   ├── pb_migrations/  coleções e regras
                                   └── pb_data/        banco, fotos e backups
```

Tempo estimado: 30 a 45 minutos.

---

## 1. Pré-requisitos

Os comandos supõem Debian/Ubuntu (`apt`). Em Fedora/Arch, troque pelo gerenciador equivalente.

```bash
sudo apt update
sudo apt install -y git unzip curl ca-certificates
```

**Node.js 22** (só para compilar o app; o PocketBase não precisa dele):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # precisa ser 20.19+ ou 22.12+
```

## 2. Usuário e pasta do serviço

O PocketBase roda com um usuário próprio, sem login, dono só da pasta `/opt/pocketbase`.
O seu usuário entra no grupo para poder publicar o app sem `sudo`.

```bash
sudo useradd --system --home /opt/pocketbase --shell /usr/sbin/nologin pocketbase
sudo mkdir -p /opt/pocketbase
sudo chown pocketbase:pocketbase /opt/pocketbase
sudo chmod 2775 /opt/pocketbase          # novos arquivos herdam o grupo "pocketbase"
sudo usermod -aG pocketbase "$USER"
```

Saia e entre de novo na sessão (ou rode `newgrp pocketbase`) para o grupo valer.

## 3. Baixar o PocketBase

O app foi testado com a **v0.40.6**. Confira a versão mais recente em <https://github.com/pocketbase/pocketbase/releases>.

```bash
PB_VERSION=0.40.6
case "$(uname -m)" in
  x86_64)  PB_ARCH=amd64 ;;
  aarch64) PB_ARCH=arm64 ;;
  armv7l)  PB_ARCH=armv7 ;;
esac

cd /tmp
curl -fLO "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip"
unzip -o "pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip" pocketbase -d /opt/pocketbase
chmod 775 /opt/pocketbase/pocketbase
/opt/pocketbase/pocketbase --version
```

## 4. Baixar o projeto e publicar o app

```bash
cd ~
git clone https://github.com/rokrz/cookbook.git
cd cookbook
PB_DIR=/opt/pocketbase ./scripts/deploy.sh
```

O script compila o app, copia o resultado para `/opt/pocketbase/pb_public` e as migrações para `/opt/pocketbase/pb_migrations`.
Na primeira vez ele ainda não reinicia nada, porque o serviço não existe; isso é feito no passo 5.

## 5. Serviço systemd

```bash
sudo cp deploy/pocketbase.service /etc/systemd/system/pocketbase.service
sudo sed -i 's/PORTA/SUA_PORTA_AQUI/' /etc/systemd/system/pocketbase.service
sudo systemctl daemon-reload
sudo systemctl enable --now pocketbase
systemctl status pocketbase --no-pager
```

Na primeira inicialização o PocketBase aplica as migrações: cria `categories` e `recipes` com as regras de acesso, fecha o cadastro público e liga Batch API, rate limit e o cabeçalho do proxy.

Confira:

```bash
curl -s http://127.0.0.1:8090/api/health          # {"message":"API is healthy." ...}
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8090/   # 200
journalctl -u pocketbase -n 30 --no-pager           # deve listar "Applied 1761620000_init_receitas.js"
```

Para o `deploy.sh` reiniciar o serviço sem pedir senha nas próximas publicações (opcional):

```bash
echo "$USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart pocketbase" | sudo tee /etc/sudoers.d/pocketbase
sudo chmod 440 /etc/sudoers.d/pocketbase
```

## 6. Superusuário e sua conta

Crie o superusuário pela linha de comando, como o usuário do serviço:

```bash
sudo -u pocketbase /opt/pocketbase/pocketbase superuser upsert seu-email@exemplo.com 'UMA-SENHA-FORTE' --dir /opt/pocketbase/pb_data
```

Como o painel só aceitará acessos da rede de casa (passo 7), abra-o de um computador da rede local, ou por um túnel SSH a partir de qualquer lugar:

```bash
ssh -L 8090:127.0.0.1:8090 usuario@ip-da-maquina
# depois, no seu navegador: http://127.0.0.1:8090/_/
```

No painel:

1. **Collections > users > New record**: crie a sua conta do app (e-mail, senha e nome; o nome aparece como "Caderno de …").
2. **Settings > Application**: confira se *Application URL* ficou `https://bokerzcraft.duckdns.org:PORTA`.
3. **Superusers** (ícone de escudo) **> Options**: ligue **MFA** para o superusuário.

## 7. Proxy HTTPS existente

Encaminhe `bokerzcraft.duckdns.org:PORTA` para `127.0.0.1:8090`. Há modelos prontos no repositório:

- nginx: `deploy/nginx.conf.example`
- Caddy: `deploy/Caddyfile.example`

O que não pode faltar, em qualquer proxy:

| Item | Por quê |
|---|---|
| Upload de até 10 MB (`client_max_body_size 10M` no nginx) | Fotos de até 5 MB no multipart |
| `proxy_buffering off` e timeout de leitura ~6 min | Realtime usa conexões abertas (SSE) |
| Cabeçalhos `Host`, `X-Forwarded-For`, `X-Forwarded-Proto` | IP real nos logs e no rate limit |
| `/_/` liberado só para a rede de casa | O painel administrativo não fica exposto |

Ajuste a faixa `192.168.0.0/16` para a da sua rede (por exemplo, `192.168.1.0/24`).
Depois de editar: `sudo nginx -t && sudo systemctl reload nginx` (ou `sudo systemctl reload caddy`).

**Firewall:** a porta 8090 não deve ser aberta. Como o PocketBase escuta só em `127.0.0.1`, ela já não fica acessível de fora; se usar `ufw`, não crie regra para ela.

Teste de fora de casa (4G no celular): abra `https://bokerzcraft.duckdns.org:PORTA`, entre com a sua conta e, no menu do navegador, use **Adicionar à tela inicial** para instalar o app.

## 8. Backup

### 8.1 Backup automático do PocketBase

No painel, **Settings > Backups**:

- Ligue *Auto backups* com o cron `0 3 * * *` (todo dia às 3h).
- *Max auto backups*: `7`.

Os arquivos ficam em `/opt/pocketbase/pb_data/backups/` (zip com banco e fotos).

### 8.2 Cópia fora da máquina (obrigatória)

Escolha **uma** opção:

**a) S3 compatível (mais simples):** em *Settings > Backups > Store backups in S3*, informe um bucket do Backblaze B2, Cloudflare R2 ou similar. O PocketBase passa a enviar os backups direto para lá.

**b) HD externo ou outra máquina com rsync:**

```bash
sudo crontab -e
# todo dia às 4h, depois do backup das 3h:
0 4 * * * rsync -a --delete /opt/pocketbase/pb_data/backups/ /media/hd-externo/receitas-backups/
```

**c) Nuvem com rclone** (Google Drive, OneDrive etc.): configure com `rclone config` e agende `rclone sync /opt/pocketbase/pb_data/backups remoto:receitas-backups`.

### 8.3 Teste de restauração (antes de cadastrar receitas importantes)

```bash
mkdir -p /tmp/restore-teste && cp /opt/pocketbase/pocketbase /tmp/restore-teste/
cd /tmp/restore-teste
unzip /opt/pocketbase/pb_data/backups/<um-backup>.zip -d pb_data
./pocketbase serve --http=127.0.0.1:8099
# Pelo túnel SSH (-L 8099:127.0.0.1:8099), abra http://127.0.0.1:8099/_/ e confira receitas e fotos.
# Ctrl+C para parar e depois: rm -rf /tmp/restore-teste
```

Também é possível restaurar direto pelo painel (*Settings > Backups > Restore*), mas isso substitui os dados em uso.

## 9. Checagem final

Do seu computador, com o código do repositório, rode o teste de privacidade **contra uma instância de teste** (ele cria e apaga as contas `a@test.local` e `b@test.local`). Use a cópia do passo 8.3 ou rode na própria máquina, se ela ainda não tem dados reais:

```bash
PB_URL=http://127.0.0.1:8090 PB_ADMIN_EMAIL=seu-email@exemplo.com PB_ADMIN_PASSWORD='UMA-SENHA-FORTE' \
PB_DATA_DIR=/opt/pocketbase/pb_data npm run test:api
```

Deve terminar com `TODOS OS TESTES PASSARAM`.

Lista de conferência:

- [ ] `systemctl is-enabled pocketbase` responde `enabled` e o app volta sozinho depois de `sudo reboot`.
- [ ] O app abre por HTTPS pelo celular no 4G.
- [ ] `https://bokerzcraft.duckdns.org:PORTA/_/` responde 403 fora de casa.
- [ ] A tela de login não oferece cadastro.
- [ ] Existe pelo menos um backup e a restauração de teste funcionou.
- [ ] O backup é copiado para fora da máquina.

## 10. Atualizações

**Do app** (depois de um `git push` com mudanças):

```bash
cd ~/cookbook
git pull
PB_DIR=/opt/pocketbase ./scripts/deploy.sh   # compila, copia e reinicia
```

**Do PocketBase:**

1. Faça um backup manual pelo painel.
2. Leia as notas da nova versão (mudanças incompatíveis acontecem antes da 1.0).
3. Atualize:
   ```bash
   sudo systemctl stop pocketbase
   sudo -u pocketbase /opt/pocketbase/pocketbase update
   sudo systemctl start pocketbase
   ```

## 11. Problemas comuns

| Sintoma | O que verificar |
|---|---|
| Página 502 no proxy | `systemctl status pocketbase` e `journalctl -u pocketbase -n 50` |
| Página 404 em `/` | `pb_public/` vazio: rode o `deploy.sh` de novo |
| Foto não envia (413) | Limite de upload do proxy abaixo de 10 MB |
| Fotos não aparecem | Relógio da máquina errado (o token de arquivo expira): `timedatectl` |
| Login falha para todo mundo | Conta não criada em *users* ou senha errada; redefina pelo painel |
| `permission denied` no `deploy.sh` | Seu usuário ainda não está no grupo `pocketbase` (saia e entre na sessão) |
| Rate limit bloqueando você mesmo | *Settings > Rate limits* e conferir se o proxy envia `X-Forwarded-For` |
