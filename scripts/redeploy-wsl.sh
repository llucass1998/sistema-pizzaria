#!/bin/bash
# LEGADO: prefira scripts/compose-redeploy.sh para redeploy via Docker Compose.
# Este script usa docker run manual e deve ser mantido apenas por compatibilidade.
set -e

echo "========================================="
echo "🍕 Pizzaria ERP - WSL Redeploy Script"
echo "========================================="

echo "[1/4] Reconstruindo imagem da API..."
echo 'srv' | sudo -S docker build --no-cache -t lucas_pizarria_api:latest -f Dockerfile.api .

echo "[2/4] Reconstruindo imagem do Web/Frontend..."
echo 'srv' | sudo -S docker build --no-cache -t pizzaria_web:latest -f Dockerfile.web .

echo "[3/4] Reiniciando conteineres no Docker..."
echo 'srv' | sudo -S docker rm -f pizzaria_db pizzaria_waha pizzaria_api pizzaria_web 2>/dev/null || true
echo 'srv' | sudo -S docker network create sgbi 2>/dev/null || true

# Banco de dados
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

# Start do frontend
echo 'srv' | sudo -S docker run -d \
  --name pizzaria_web \
  --network sgbi \
  --restart always \
  -p 80:80 \
  pizzaria_web:latest

echo "[4/4] Verificando conteineres rodando..."
sleep 5
echo 'srv' | sudo -S docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo ""
echo "========================================="
echo "✅ Deploy no WSL concluido com sucesso!"
echo "========================================="
