#!/usr/bin/env bash
set -e

echo "Running fullstack smoke test..."

curl -f http://127.0.0.1/
curl -f http://127.0.0.1/api/status
curl -f "http://127.0.0.1/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="
curl -f http://127.0.0.1/api/configuracoes
curl -f http://127.0.0.1/api/products
curl -f http://127.0.0.1/api/categorias

echo "Smoke test fullstack OK"
