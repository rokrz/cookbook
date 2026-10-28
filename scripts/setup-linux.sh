#!/usr/bin/env bash
# Instalação inicial do Meu Caderno de Receitas numa máquina Linux (Debian/Ubuntu).
# Rode como seu usuário normal (com sudo), de dentro da pasta do repositório:
#   PORTA=8443 ./scripts/setup-linux.sh
# Pode ser rodado de novo sem problema: cada passo confere se já foi feito.
set -euo pipefail

PORTA="${PORTA:?Defina a porta pública do proxy HTTPS. Ex.: PORTA=8443 ./scripts/setup-linux.sh}"
DOMINIO="${DOMINIO:-bokerzcraft.duckdns.org}"
PB_VERSION="${PB_VERSION:-0.40.6}"
PB_DIR="${PB_DIR:-/opt/pocketbase}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_URL="https://${DOMINIO}:${PORTA}"

passo() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

passo "1/7 Pacotes básicos"
sudo apt-get update -qq
sudo apt-get install -y -qq git unzip curl ca-certificates >/dev/null

passo "2/7 Node.js (para compilar o app)"
NODE_MAJOR=0
command -v node >/dev/null && NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null
  sudo apt-get install -y -qq nodejs >/dev/null
fi
echo "node $(node -v)"

passo "3/7 Usuário e pasta do serviço ($PB_DIR)"
id pocketbase >/dev/null 2>&1 || sudo useradd --system --home "$PB_DIR" --shell /usr/sbin/nologin pocketbase
sudo mkdir -p "$PB_DIR"
sudo chown pocketbase:pocketbase "$PB_DIR"
sudo chmod 2775 "$PB_DIR"
sudo usermod -aG pocketbase "$USER"

passo "4/7 PocketBase v$PB_VERSION"
case "$(uname -m)" in
  x86_64) PB_ARCH=amd64 ;;
  aarch64) PB_ARCH=arm64 ;;
  armv7l) PB_ARCH=armv7 ;;
  *) echo "Arquitetura não suportada: $(uname -m)"; exit 1 ;;
esac
if ! "$PB_DIR/pocketbase" --version 2>/dev/null | grep -q "$PB_VERSION"; then
  TMP="$(mktemp -d)"
  curl -fsSL -o "$TMP/pb.zip" "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip"
  unzip -q -o "$TMP/pb.zip" pocketbase -d "$TMP"
  sudo install -o pocketbase -g pocketbase -m 775 "$TMP/pocketbase" "$PB_DIR/pocketbase"
  rm -rf "$TMP"
fi
"$PB_DIR/pocketbase" --version

passo "5/7 Compilar e publicar o app"
cd "$ROOT"
npm ci --no-audit --no-fund
npm run build
sudo mkdir -p "$PB_DIR/pb_public" "$PB_DIR/pb_migrations"
sudo rm -rf "$PB_DIR/pb_public/"*
sudo cp -r dist/. "$PB_DIR/pb_public/"
sudo cp pocketbase/pb_migrations/*.js "$PB_DIR/pb_migrations/"
sudo chown -R pocketbase:pocketbase "$PB_DIR"
sudo chmod -R g+w "$PB_DIR/pb_public" "$PB_DIR/pb_migrations"

passo "6/7 Serviço systemd (PB_APP_URL=$APP_URL)"
sed -e "s#^Environment=PB_APP_URL=.*#Environment=PB_APP_URL=${APP_URL}#" \
    -e "s#/opt/pocketbase#${PB_DIR}#g" \
    deploy/pocketbase.service | sudo tee /etc/systemd/system/pocketbase.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable pocketbase >/dev/null 2>&1
sudo systemctl restart pocketbase

for _ in $(seq 1 20); do
  curl -fs http://127.0.0.1:8090/api/health >/dev/null && break
  sleep 1
done
curl -fs http://127.0.0.1:8090/api/health >/dev/null || { echo "PocketBase não respondeu. Veja: journalctl -u pocketbase -n 50"; exit 1; }
echo "PocketBase no ar em 127.0.0.1:8090"

passo "7/7 Superusuário (administrador do painel)"
if [ -n "${PB_ADMIN_EMAIL:-}" ]; then
  ADMIN_EMAIL="$PB_ADMIN_EMAIL"
else
  read -rp "E-mail do administrador: " ADMIN_EMAIL
fi
read -rsp "Senha do administrador (mín. 10 caracteres): " ADMIN_PASS; echo
sudo -u pocketbase "$PB_DIR/pocketbase" superuser upsert "$ADMIN_EMAIL" "$ADMIN_PASS" --dir "$PB_DIR/pb_data"
unset ADMIN_PASS

cat <<FIM

Instalação concluída.
  App (depois do proxy):  ${APP_URL}
  Painel (local/SSH):     http://127.0.0.1:8090/_/

Próximos passos manuais (veja docs/roteiro-setup-linux.md):
  - configurar o proxy HTTPS para ${DOMINIO}:${PORTA} -> 127.0.0.1:8090
  - criar sua conta do app no painel e ligar MFA do administrador
  - ligar o backup automático e a cópia fora da máquina
Saia e entre de novo na sessão para o grupo "pocketbase" valer no seu usuário.
FIM
