# Roteiro de setup na máquina Linux

Passo a passo, na ordem, para colocar o **Meu Caderno de Receitas** no ar em
`https://bokerzcraft.duckdns.org:PORTA`. Rode tudo **na máquina Linux**, com um usuário que tenha `sudo`.

Antes de começar, tenha em mãos:

- a **porta pública** do seu proxy HTTPS (o `PORTA` do endereço);
- qual proxy a máquina usa (nginx, Caddy, outro);
- um e-mail e uma senha forte para o **administrador** do PocketBase;
- um e-mail e uma senha para a **sua conta** do app.

> O guia detalhado, com explicação de cada item, está em [`instalacao-linux.md`](instalacao-linux.md).
> Este roteiro é a versão para executar.

---

## Passo 1 — Baixar o projeto

```bash
sudo apt update && sudo apt install -y git
cd ~
git clone https://github.com/rokrz/cookbook.git
cd cookbook
```

Se o repositório for privado, o `git clone` pede usuário e um *token* do GitHub
(GitHub > Settings > Developer settings > Personal access tokens) no lugar da senha.

## Passo 2 — Rodar a instalação automática

Troque `8443` pela sua porta:

```bash
PORTA=8443 ./scripts/setup-linux.sh
```

O script faz, nesta ordem:

1. instala `git`, `unzip`, `curl`;
2. instala o Node.js 22, se não houver um igual ou mais novo;
3. cria o usuário de sistema `pocketbase` e a pasta `/opt/pocketbase`;
4. baixa o PocketBase v0.40.6;
5. compila o app e publica em `/opt/pocketbase/pb_public`, junto com as migrações;
6. cria e liga o serviço `pocketbase` (systemd), com `PB_APP_URL=https://bokerzcraft.duckdns.org:PORTA`;
7. pergunta o e-mail e a senha do **administrador** e cria o superusuário.

No fim aparece `Instalação concluída.` Se parar com erro, veja o fim desta página.

Confira:

```bash
systemctl status pocketbase --no-pager          # active (running)
curl -s http://127.0.0.1:8090/api/health        # "API is healthy."
```

Depois **saia e entre de novo** na sessão do Linux (ou rode `newgrp pocketbase`), para seu usuário poder publicar atualizações sem `sudo`.

## Passo 3 — Ligar o proxy HTTPS

O PocketBase só escuta em `127.0.0.1:8090`. O proxy que já tem o certificado do duckdns encaminha a porta pública para ele.

### Se for nginx

Crie `/etc/nginx/sites-available/cookbook` a partir do modelo:

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/cookbook
sudo sed -i 's/PORTA/8443/' /etc/nginx/sites-available/cookbook   # sua porta
sudo nano /etc/nginx/sites-available/cookbook
```

No editor:

- descomente e ajuste `ssl_certificate` e `ssl_certificate_key` com os caminhos dos certificados que você já usa
  (para achar: `sudo grep -R "ssl_certificate" /etc/nginx/`);
- ajuste `allow 192.168.0.0/16;` para a faixa da sua rede de casa (veja com `ip -4 addr`).

Ative e recarregue:

```bash
sudo ln -s /etc/nginx/sites-available/cookbook /etc/nginx/sites-enabled/cookbook
sudo nginx -t && sudo systemctl reload nginx
```

### Se for Caddy

```bash
sed 's/PORTA/8443/' deploy/Caddyfile.example | sudo tee -a /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

### Se for outro proxy

Encaminhe `bokerzcraft.duckdns.org:PORTA` para `http://127.0.0.1:8090` garantindo:
upload de até **10 MB**, **sem buffering** e timeout de leitura de ~6 min (o realtime usa conexões abertas),
cabeçalhos `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, e o caminho `/_/` liberado **só para a rede de casa**.

**Firewall/roteador:** a porta pública já deve estar liberada para o proxy. **Não** abra a 8090.

## Passo 4 — Configurar no painel

Abra o painel **de um computador da rede de casa**: `https://bokerzcraft.duckdns.org:PORTA/_/`
(ou, de fora, por túnel SSH: `ssh -L 8090:127.0.0.1:8090 usuario@maquina` e depois `http://127.0.0.1:8090/_/`).

Entre com o administrador do passo 2 e:

1. **Collections > users > New record**: crie a sua conta do app (e-mail, senha, nome).
2. **Settings > Application**: confira se *Application URL* é `https://bokerzcraft.duckdns.org:PORTA`.
3. **Collections > _superusers > Options > MFA**: ligue o MFA do administrador.
4. **Settings > Backups**:
   - ligue *Auto backups* com `0 3 * * *` e *Max auto backups* `7`;
   - se tiver um bucket S3 (Backblaze B2, Cloudflare R2…), configure em *Store backups in S3*.

## Passo 5 — Cópia do backup fora da máquina

Se não usou S3 no passo 4, copie os backups para um HD externo ou outra máquina, todo dia às 4h:

```bash
sudo crontab -e
# adicione a linha (ajuste o destino):
0 4 * * * rsync -a --delete /opt/pocketbase/pb_data/backups/ /media/hd-externo/receitas-backups/
```

Antes de guardar receitas importantes, faça um backup manual no painel e teste a restauração
(seção 8.3 do [guia completo](instalacao-linux.md)).

## Passo 6 — Testar

1. No celular, **fora do Wi-Fi de casa** (4G), abra `https://bokerzcraft.duckdns.org:PORTA`.
2. Entre com a conta do passo 4 e cadastre uma receita com foto.
3. Instale na tela inicial:
   - **Android (Chrome):** menu ⋮ > *Instalar app* / *Adicionar à tela inicial*;
   - **iPhone (Safari):** Compartilhar > *Adicionar à Tela de Início*.
4. Ainda no 4G, abra `https://bokerzcraft.duckdns.org:PORTA/_/`: deve dar **403** (painel bloqueado fora de casa).
5. Reinicie a máquina (`sudo reboot`) e confira que o app volta sozinho.

Pronto: o app está no ar.

---

## Atualizar o app depois

Quando houver mudanças no GitHub:

```bash
cd ~/cookbook
git pull
PB_DIR=/opt/pocketbase ./scripts/deploy.sh
```

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| `setup-linux.sh` para em "PocketBase não respondeu" | `journalctl -u pocketbase -n 50`; se citar `appURL`, confira a `PORTA` |
| `Permission denied` ao rodar o script | `chmod +x scripts/*.sh` |
| 502 no navegador | PocketBase parado: `sudo systemctl restart pocketbase` |
| 404 na página inicial | `pb_public` vazio: rode `PB_DIR=/opt/pocketbase ./scripts/deploy.sh` |
| Erro 413 ao enviar foto | Limite de upload do proxy abaixo de 10 MB |
| Fotos não aparecem | Relógio da máquina errado: `timedatectl` |
| Esqueceu a senha do administrador | `sudo -u pocketbase /opt/pocketbase/pocketbase superuser upsert EMAIL 'NOVA-SENHA' --dir /opt/pocketbase/pb_data` |
| Esqueceu a senha da sua conta | Painel > *users* > editar o registro > nova senha |
