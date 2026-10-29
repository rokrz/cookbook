# Compila o app e publica no PocketBase.
# Uso: .\scripts\deploy.ps1 -PbDir C:\pocketbase
param([string]$PbDir = "C:\pocketbase")
$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")
npm ci
# Versão com login, guardando as receitas neste PocketBase.
$env:VITE_BACKEND = "pocketbase"
npm run build
Remove-Item Env:VITE_BACKEND

New-Item -ItemType Directory -Force "$PbDir\pb_public", "$PbDir\pb_migrations" | Out-Null
Remove-Item "$PbDir\pb_public\*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "dist\*" "$PbDir\pb_public" -Recurse
Copy-Item "pocketbase\pb_migrations\*.js" "$PbDir\pb_migrations"
if (Test-Path "pocketbase\pb_hooks") {
  New-Item -ItemType Directory -Force "$PbDir\pb_hooks" | Out-Null
  Copy-Item "pocketbase\pb_hooks\*" "$PbDir\pb_hooks" -Recurse
}

# Migrações novas são aplicadas quando o PocketBase reinicia.
if (Get-Service PocketBase -ErrorAction SilentlyContinue) { Restart-Service PocketBase }
Write-Host "Publicado em $PbDir"
