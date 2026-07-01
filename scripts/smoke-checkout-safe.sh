#!/bin/bash

# Smoke Test para Validar APIs e Rotas do Checkout
# Sai com erro se qualquer validacao falhar

set -e

echo "========================================="
echo "🚦 Iniciando Smoke Test do Checkout..."
echo "========================================="

echo "[1/5] Testando Home Publica (Frontend)..."
curl -s -f -I http://127.0.0.1/ > /dev/null || (echo "❌ Erro ao acessar a Home" && exit 1)
echo "✅ Home rodando perfeitamente."

echo "[2/5] Testando API Status..."
curl -s -f -I http://127.0.0.1/api/status > /dev/null || (echo "❌ Erro na API (/api/status)" && exit 1)
echo "✅ API rodando perfeitamente."

echo "[3/5] Testando Resolver-Store..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug=")
if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ Rota pública resolve-store respondeu 200 OK."
else
  echo "❌ Rota resolve-store falhou com HTTP $HTTP_CODE"
  exit 1
fi

echo "[4/5] Testando Endpoint de Categorias e Produtos..."
curl -s -f -o /dev/null http://127.0.0.1/api/categorias || (echo "❌ Erro ao carregar categorias" && exit 1)
curl -s -f -o /dev/null http://127.0.0.1/api/products || (echo "❌ Erro ao carregar produtos" && exit 1)
echo "✅ Categorias e Produtos estão acessíveis."

echo "[5/5] Testando Rota de Calculo de Entrega (/api/checkout/calculate-delivery-fee)..."
# Simulando requisicao POST que o frontend faz no checkout
FEE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1/api/checkout/calculate-delivery-fee \
  -H "Content-Type: application/json" \
  -d '{"neighborhood":"Centro","subtotal":50}')

if [ "$FEE_CODE" -eq 200 ] || [ "$FEE_CODE" -eq 400 ]; then
  # 200 = sucesso (bairro com taxa), 400 = (configuração não encontrada ou bairro sem atendimento dependendo do mode, mas NÃO é 401 ou 500)
  echo "✅ Cálculo de entrega operante (HTTP $FEE_CODE, sem 401 Unauthorized)."
else
  echo "❌ Erro na rota de taxa de entrega. HTTP $FEE_CODE (Esperado 200 ou 400 controlados)"
  exit 1
fi

echo "========================================="
echo "✅ Smoke test finalizado com sucesso."
echo "✅ Nenhuma regressao de infraestrutura detectada."
echo "========================================="
