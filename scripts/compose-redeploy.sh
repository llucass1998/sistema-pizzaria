#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[0/5] Validando VPN obrigatoria antes do Docker..."
if command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile -ExecutionPolicy Bypass \
    -File "$PROJECT_DIR/scripts/wsl-openvpn/ensure-wsl-vpn.ps1"
else
  systemctl is-active --quiet openvpn@client.service
  ip -4 -o address show dev tun0 | grep -q '172\.25\.20\.159/'
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "Docker Compose não encontrado." >&2
  exit 1
fi

echo "[1/5] Rebuild sem cache da API e Web..."
"${COMPOSE[@]}" build --no-cache api web

echo "[2/5] Recriando apenas API e Web sem remover banco/volumes..."
"${COMPOSE[@]}" up -d --no-deps --force-recreate api web

echo "[3/5] Status dos containers..."
"${COMPOSE[@]}" ps

echo "[4/5] Logs recentes da API..."
"${COMPOSE[@]}" logs --tail=100 api

echo "[5/5] Confirmando VPN apos o deploy..."
if command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile -ExecutionPolicy Bypass \
    -File "$PROJECT_DIR/scripts/wsl-openvpn/ensure-wsl-vpn.ps1"
fi

echo "Deploy Compose concluído sem remover volumes."
