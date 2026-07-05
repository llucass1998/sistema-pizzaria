#!/bin/bash

# Atualiza repositório e reinicia os containers com a versão mais nova.

set -e  # Para imediatamente se qualquer comando falhar

echo "========================================="
echo "🍕 Pizzaria ERP - Script de Atualizacao"
echo "========================================="

# Mensagem do commit (padrao se nao for informada)
COMMIT_MSG=${1:-"Update automatizado via script"}

echo "[1/5] Adicionando alteracoes no Git..."
git add . || true

echo "[2/5] Criando commit..."
git commit -m "$COMMIT_MSG" || true

echo "[3/5] Enviando para o GitHub..."
# git push || true

# Reconstruindo imagens ANTES de derrubar (Zero Downtime Build)
echo "   Build da API..."
echo 'srv' | sudo -S docker build -t lucas_pizarria_api:latest -f Dockerfile.api .

echo "   Build do Frontend (Nginx)..."
echo 'srv' | sudo -S docker build -t pizzaria_web:latest -f Dockerfile.web .

echo "[4/5] Reiniciando os conteineres no Docker..."
# NOTA: Usamos docker cli direto por incompatibilidade de versao do docker-compose no WSL.
# Apaga apenas agora para iniciar as versoes compiladas imediatamente
echo 'srv' | sudo -S docker rm -f pizzaria_db pizzaria_waha pizzaria_api pizzaria_web 2>/dev/null || true
echo 'srv' | sudo -S docker network create sgbi 2>/dev/null || true

# Banco de dados — NAO ALTERE sem necessidade
echo 'srv' | sudo -S docker run -d \
  --name pizzaria_db \
  --network sgbi \
  --restart always \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=pizzaria \
  -p 5433:5432 \
  -v pgdata:/var/lib/postgresql/data \
  postgres:15-alpine

# WhatsApp helper
echo 'srv' | sudo -S docker run -d \
  --name pizzaria_waha \
  --network sgbi \
  --restart always \
  -e WHATSAPP_DEFAULT_ENGINE=WEBJS \
  devlikeapro/waha

# Aguardar banco inicializar
echo "   Aguardando banco de dados inicializar (10s)..."
sleep 10

# Start da API
echo 'srv' | sudo -S docker run -d \
  --name pizzaria_api \
  --network sgbi \
  --restart always \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://postgres:password@pizzaria_db:5432/pizzaria?schema=public \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e WAHA_URL=http://pizzaria_waha:3000/api \
  lucas_pizarria_api:latest

# Start do frontend (Nginx)
echo 'srv' | sudo -S docker run -d \
  --name pizzaria_web \
  --network sgbi \
  --restart always \
  -p 80:80 \
  pizzaria_web:latest

echo "[5/5] Verificando saúde dos containers..."
sleep 5
echo 'srv' | sudo -S docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

# Validação básica local
echo ""
echo "--- Validação rápida ---"
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1/ 2>/dev/null || echo "000")
API_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1/api/status 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ] && [ "$API_CODE" = "200" ]; then
  echo "✅ Frontend: $HTTP_CODE OK"
  echo "✅ API: $API_CODE OK"
  echo ""
  echo "========================================="
  echo "✅ Atualizacao concluida 100%!"
  echo "   Site: https://pizzarialucas.istigestao.com.br/"
  echo "========================================="
else
  echo "❌ Frontend: $HTTP_CODE (esperado 200)"
  echo "❌ API: $API_CODE (esperado 200)"
  echo ""
  echo "========================================="
  echo "⚠️  Atualizacao concluida com AVISOS!"
  echo "   Verifique os logs:"
  echo "   sudo docker logs pizzaria_api --tail 50"
  echo "   sudo docker logs pizzaria_web --tail 30"
  echo "   Ou rode: bash scripts/check-production-health.sh"
  echo "========================================="
  exit 1
fi
