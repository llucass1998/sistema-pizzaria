#!/bin/sh
set -e

echo "🍕 Pizzaria ERP - Iniciando Container da API..."

if [ "${RUN_PRISMA_MIGRATE_DEPLOY:-false}" = "true" ]; then
  echo "Aplicando migrations Prisma..."
  npx prisma migrate deploy
else
  echo "Pulando migrations Prisma automaticas."
fi

if [ "${RUN_SAFE_STARTUP_SQL:-false}" = "true" ]; then
  echo "Aplicando patch seguro de compatibilidade do banco..."
  npx prisma db execute --file prisma/safe-startup.sql
else
  echo "Pulando patch seguro de compatibilidade do banco."
fi

if [ "${RUN_DB_PUSH_ON_STARTUP:-false}" = "true" ]; then
  echo "Executando Prisma DB Push por solicitacao explicita..."
  npx prisma db push --accept-data-loss
else
  echo "Pulando Prisma DB Push no startup."
fi

if [ "${RUN_SEED_ON_STARTUP:-false}" = "true" ]; then
  echo "Executando Prisma Seed por solicitacao explicita..."
  npx tsx backend-src/seed.ts
else
  echo "Pulando seed no startup."
fi

if [ "${RUN_RESET_ADMIN_ON_STARTUP:-false}" = "true" ]; then
  echo "Executando reset seguro de admin por solicitacao explicita..."
  node dist/resetAdmin.js
else
  echo "Pulando reset seguro de admin no startup."
fi

echo "🚀 Iniciando Servidor..."
# Executar o CMD passado para o container
exec "$@"
