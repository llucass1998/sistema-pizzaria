#!/usr/bin/env bash
set -euo pipefail

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "Docker Compose não encontrado." >&2
  exit 1
fi

echo "[1/4] Rebuild sem cache da API e Web..."
"${COMPOSE[@]}" build --no-cache api web

echo "[2/4] Recriando apenas API e Web sem remover banco/volumes..."
"${COMPOSE[@]}" up -d --no-deps --force-recreate api web

echo "[3/4] Status dos containers..."
"${COMPOSE[@]}" ps

echo "[4/4] Logs recentes da API..."
"${COMPOSE[@]}" logs --tail=100 api

echo "Deploy Compose concluído sem remover volumes."
