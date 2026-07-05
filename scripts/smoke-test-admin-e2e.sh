#!/bin/bash
set -e

echo "=== INICIANDO SMOKE TEST ADMIN E2E ==="

echo "1. Testando raiz /"
curl -f http://127.0.0.1/ > /dev/null
echo "✅ / OK"

echo "2. Testando status da API"
curl -f http://127.0.0.1/api/status > /dev/null
echo "✅ /api/status OK"

echo "3. Testando resolve-store (tenant)"
curl -f "http://127.0.0.1/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug=" > /dev/null
echo "✅ /api/public/resolve-store OK"

echo "4. Testando configuracoes publicas"
curl -f http://127.0.0.1/api/configuracoes > /dev/null
echo "✅ /api/configuracoes OK"

echo "5. Testando catálogo de pizzas"
curl -f http://127.0.0.1/api/pizzas > /dev/null
echo "✅ /api/pizzas OK"

echo "6. Testando categorias"
curl -f http://127.0.0.1/api/categorias > /dev/null
echo "✅ /api/categorias OK"

echo "=== SMOKE TEST CONCLUÍDO COM SUCESSO ==="
