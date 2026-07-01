#!/usr/bin/env sh
set -eu

BASE_URL="${SMOKE_BASE_URL:-http://127.0.0.1}"
STORE_HOST="${SMOKE_STORE_HOST:-pizzarialucas.istigestao.com.br}"

curl -f "$BASE_URL/"
curl -f "$BASE_URL/api/status"
curl -f "$BASE_URL/api/public/resolve-store?host=$STORE_HOST&slug="
curl -f "$BASE_URL/api/configuracoes"
curl -f "$BASE_URL/api/categorias"
curl -f "$BASE_URL/api/products"

echo "Smoke fullstack OK: $BASE_URL respondeu aos endpoints criticos."
