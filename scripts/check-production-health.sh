#!/bin/bash
# =======================================================
# check-production-health.sh
# Script de verificação de saúde do ambiente de produção
# Pizzaria ERP - Rio Pizzas
# =======================================================

DOMAIN="https://pizzarialucas.istigestao.com.br"
LOCAL="http://127.0.0.1"
ERRORS=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check() {
  local label="$1"
  local url="$2"
  local expected="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url")
  if [ "$code" = "$expected" ]; then
    echo -e "${GREEN}✅ OK${NC} [$code] $label"
  else
    echo -e "${RED}❌ ERRO${NC} [$code] $label — esperado $expected"
    ERRORS=$((ERRORS + 1))
  fi
}

echo ""
echo "========================================="
echo "🍕 Pizzaria ERP - Health Check"
echo "========================================="
echo ""

echo "--- VERIFICAÇÃO LOCAL (127.0.0.1) ---"
check "Frontend local" "$LOCAL/"
check "API status local" "$LOCAL/api/status"
check "resolve-store local" "$LOCAL/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="
check "configuracoes local" "$LOCAL/api/configuracoes"
check "categorias local" "$LOCAL/api/categorias"
check "pizzas local" "$LOCAL/api/pizzas"

echo ""
echo "--- VERIFICAÇÃO PRODUÇÃO ($DOMAIN) ---"
check "Frontend produção" "$DOMAIN/"
check "API status produção" "$DOMAIN/api/status"
check "resolve-store produção" "$DOMAIN/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="
check "configuracoes produção" "$DOMAIN/api/configuracoes"
check "categorias produção" "$DOMAIN/api/categorias"
check "pizzas produção" "$DOMAIN/api/pizzas"

echo ""
echo "--- STATUS DOS CONTAINERS DOCKER ---"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo ""
echo "========================================="
if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}✅ TODOS OS CHECKS PASSARAM — Site saudável!${NC}"
else
  echo -e "${RED}❌ $ERRORS ERRO(S) DETECTADO(S) — Verifique os logs!${NC}"
  echo ""
  echo "Comandos úteis para diagnóstico:"
  echo "  docker logs pizzaria_api --tail 50"
  echo "  docker logs pizzaria_web --tail 30"
  echo "  docker ps -a"
fi
echo "========================================="
echo ""
exit $ERRORS
