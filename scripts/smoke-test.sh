#!/usr/bin/env sh
set -eu

BASE_URL="${SMOKE_BASE_URL:-http://127.0.0.1}"
STORE_HOST="${SMOKE_STORE_HOST:-pizzarialucas.istigestao.com.br}"

curl -fsS "$BASE_URL/" >/dev/null
curl -fsS "$BASE_URL/api/status" >/dev/null
curl -fsS "$BASE_URL/api/public/resolve-store?host=$STORE_HOST&slug=" >/dev/null
curl -fsS "$BASE_URL/api/configuracoes" >/dev/null
curl -fsS "$BASE_URL/api/categorias" >/dev/null
curl -fsS "$BASE_URL/api/pizzas" >/dev/null
curl -fsS "$BASE_URL/api/products" >/dev/null

echo "Smoke OK: $BASE_URL sem 502 nos endpoints criticos."
