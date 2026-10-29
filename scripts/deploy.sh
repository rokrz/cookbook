#!/usr/bin/env bash
# Compila o app e publica no PocketBase.
# Uso: PB_DIR=/opt/pocketbase ./scripts/deploy.sh
set -euo pipefail

PB_DIR="${PB_DIR:-/opt/pocketbase}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"
npm ci
# Versão com login, guardando as receitas neste PocketBase.
VITE_BACKEND=pocketbase npm run build

mkdir -p "$PB_DIR/pb_public" "$PB_DIR/pb_migrations"
rm -rf "$PB_DIR/pb_public/"*
cp -r dist/. "$PB_DIR/pb_public/"
cp pocketbase/pb_migrations/*.js "$PB_DIR/pb_migrations/"
[ -d pocketbase/pb_hooks ] && mkdir -p "$PB_DIR/pb_hooks" && cp -r pocketbase/pb_hooks/. "$PB_DIR/pb_hooks/"

# Migrações novas são aplicadas quando o PocketBase reinicia.
if systemctl cat pocketbase.service >/dev/null 2>&1; then
  sudo systemctl restart pocketbase
fi
echo "Publicado em $PB_DIR"
