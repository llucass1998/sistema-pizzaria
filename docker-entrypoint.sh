#!/bin/sh
set -e

echo "🍕 Pizzaria ERP - Iniciando Container da API..."

# Aguardar um momento para garantir que o banco esteja pronto (o docker-compose usa healthcheck, mas isso e uma seguranca extra)
echo "⌛ Executando Prisma DB Push (sincronizando banco de dados)..."
echo "Aplicando patch seguro de compatibilidade do banco..."
npx prisma db execute --file prisma/safe-startup.sql

echo "Sincronizando schema Prisma..."
npx prisma db push --accept-data-loss

echo "🌱 Executando Prisma Seed (dados iniciais)..."
npx tsx backend-src/seed.ts || echo "Aviso: Seed encontrou um erro ou foi ignorado."
echo "Garantindo admin permanente e limpeza segura de usuarios..."
node dist/resetAdmin.js || echo "Aviso: Reset seguro de admin encontrou um erro ou foi ignorado."

echo "🚀 Iniciando Servidor..."
# Executar o CMD passado para o container
exec "$@"
