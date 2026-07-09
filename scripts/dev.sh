#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${COMPOSE_PROJECT_NAME:-pizzaria-dev}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.dev.yml --project-name "$PROJECT_NAME")

usage() {
  cat <<'EOF'
Uso: scripts/dev.sh <comando> [args...]

Comandos:
  up              Sobe db-dev, waha-dev, api-dev e web-dev
  up-base         Sobe apenas db-dev e waha-dev
  down            Para containers do projeto dev sem remover volumes
  ps              Mostra containers do projeto dev
  logs [service]  Mostra logs do projeto dev
  shell           Abre shell no container tools
  run <cmd...>    Executa comando dentro do container tools
  npm <args...>   Executa npm dentro do container tools
  npx <args...>   Executa npx dentro do container tools
  prisma <args...> Executa npx prisma dentro do container tools

Exemplos:
  scripts/dev.sh up
  scripts/dev.sh npm run test:api
  scripts/dev.sh npx prisma generate
  scripts/dev.sh run bash scripts/smoke-test.sh
EOF
}

if [ $# -eq 0 ]; then
  usage
  exit 0
fi

case "$1" in
  up)
    "${COMPOSE[@]}" --profile dev up -d db-dev waha-dev api-dev web-dev
    ;;
  up-base)
    "${COMPOSE[@]}" --profile dev up -d db-dev waha-dev
    ;;
  down)
    "${COMPOSE[@]}" --profile dev stop api-dev web-dev tools db-dev waha-dev
    ;;
  ps)
    "${COMPOSE[@]}" --profile dev ps
    ;;
  logs)
    shift
    "${COMPOSE[@]}" --profile dev logs -f --tail=100 "$@"
    ;;
  shell)
    "${COMPOSE[@]}" --profile dev run --rm tools bash
    ;;
  run)
    shift
    "${COMPOSE[@]}" --profile dev run --rm tools "$@"
    ;;
  npm)
    shift
    "${COMPOSE[@]}" --profile dev run --rm tools npm "$@"
    ;;
  npx)
    shift
    "${COMPOSE[@]}" --profile dev run --rm tools npx "$@"
    ;;
  prisma)
    shift
    "${COMPOSE[@]}" --profile dev run --rm tools npx prisma "$@"
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    echo "Comando desconhecido: $1" >&2
    usage
    exit 1
    ;;
esac
