#!/usr/bin/env bash
set -e

echo "=== Iniciando Smoke Test Fullstack (Site + Admin + API) ==="

echo "1. Validando Frontend Loja Pública (/) ..."
curl -f -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://127.0.0.1/

echo "2. Validando API Status (/api/status) ..."
curl -f -s http://127.0.0.1/api/status | grep -q "ok" && echo "API Status: OK"

echo "3. Validando Resolve Store (/api/public/resolve-store) ..."
curl -f -s "http://127.0.0.1/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug=" | grep -q "id" && echo "Resolve Store: OK"

echo "4. Validando Configurações (/api/configuracoes) ..."
curl -f -s http://127.0.0.1/api/configuracoes | grep -q "storeName" && echo "Configurações: OK"

echo "5. Validando Produtos (/api/products) ..."
curl -f -s http://127.0.0.1/api/products | grep -q "\\[" && echo "Produtos: OK"

echo "6. Validando Categorias (/api/categorias) ..."
curl -f -s http://127.0.0.1/api/categorias | grep -q "\\[" && echo "Categorias: OK"

echo "=== Smoke test fullstack concluído com sucesso! ==="
