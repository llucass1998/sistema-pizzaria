#!/bin/bash
# =======================================================
# check-production-health.sh
# Script de verificaÃ§Ã£o de saÃºde do ambiente de produÃ§Ã£o
# Pizzaria ERP - Rio Pizzas
# =======================================================

DOMAIN="https://pizzarialucas.istigestao.com.br"
DOMAIN_HOST="pizzarialucas.istigestao.com.br"
LOCAL="http://127.0.0.1"
ERRORS=0
WARNINGS=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check() {
  local label="$1"
  local url="$2"
  local expected="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 --max-time 5 "$url")
  if [ "$code" = "$expected" ]; then
    echo -e "${GREEN}âœ… OK${NC} [$code] $label"
  else
    echo -e "${RED}âŒ ERRO${NC} [$code] $label â€” esperado $expected"
    ERRORS=$((ERRORS + 1))
  fi
}

warn() {
  local message="$1"
  echo -e "${YELLOW}AVISO${NC} $message"
  WARNINGS=$((WARNINGS + 1))
}

resolve_domain_ip() {
  if command -v dig >/dev/null 2>&1; then
    dig +short A "$DOMAIN_HOST" | tail -n 1
    return
  fi

  if command -v nslookup >/dev/null 2>&1; then
    nslookup "$DOMAIN_HOST" 2>/dev/null | awk '/^Address: / { ip=$2 } END { print ip }'
    return
  fi

  if command -v getent >/dev/null 2>&1; then
    getent ahostsv4 "$DOMAIN_HOST" 2>/dev/null | awk 'NR == 1 { print $1 }'
    return
  fi

  curl -s --connect-timeout 3 --max-time 5 "https://dns.google/resolve?name=$DOMAIN_HOST&type=A" \
    | sed -n 's/.*"data":"\([0-9.]*\)".*/\1/p' \
    | head -n 1

  echo ""
}

get_public_ip() {
  curl -s --connect-timeout 3 --max-time 5 https://api.ipify.org || true
}

echo ""
echo "========================================="
echo "ðŸ• Pizzaria ERP - Health Check"
echo "========================================="
echo ""

echo "--- DIAGNOSTICO DE ENTRADA PUBLICA ---"
DOMAIN_IP="$(resolve_domain_ip)"
PUBLIC_IP="$(get_public_ip)"
echo "Dominio          : $DOMAIN_HOST"
echo "DNS A            : ${DOMAIN_IP:-nao detectado}"
echo "IP publico atual : ${PUBLIC_IP:-nao detectado}"
if [ -n "$DOMAIN_IP" ] && [ -n "$PUBLIC_IP" ] && [ "$DOMAIN_IP" != "$PUBLIC_IP" ]; then
  warn "DNS do dominio aponta para $DOMAIN_IP, mas este servidor sai como $PUBLIC_IP."
  warn "Se o app esta rodando neste servidor, o cliente acessara outro Caddy/servidor e pode receber 502."
fi

echo ""
echo "--- VERIFICAÃ‡ÃƒO LOCAL (127.0.0.1) ---"
check "Frontend local" "$LOCAL/"
check "API status local" "$LOCAL/api/status"
check "resolve-store local" "$LOCAL/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="
check "configuracoes local" "$LOCAL/api/configuracoes"
check "categorias local" "$LOCAL/api/categorias"
check "pizzas local" "$LOCAL/api/pizzas"

echo ""
echo "--- VERIFICAÃ‡ÃƒO PRODUÃ‡ÃƒO ($DOMAIN) ---"
check "Frontend produÃ§Ã£o" "$DOMAIN/"
check "API status produÃ§Ã£o" "$DOMAIN/api/status"
check "resolve-store produÃ§Ã£o" "$DOMAIN/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="
check "configuracoes produÃ§Ã£o" "$DOMAIN/api/configuracoes"
check "categorias produÃ§Ã£o" "$DOMAIN/api/categorias"
check "pizzas produÃ§Ã£o" "$DOMAIN/api/pizzas"

echo ""
echo "--- STATUS DOS CONTAINERS DOCKER ---"
timeout 15 docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || echo "docker ps indisponivel ou demorou demais."

echo ""
echo "========================================="
if [ "$ERRORS" -eq 0 ]; then
  if [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}CHECKS HTTP PASSARAM COM $WARNINGS AVISO(S). Revise DNS/ingresso antes de concluir deploy.${NC}"
  else
    echo -e "${GREEN}TODOS OS CHECKS PASSARAM - Site saudavel!${NC}"
  fi
else
  echo -e "${RED}$ERRORS ERRO(S) DETECTADO(S) - Verifique os logs!${NC}"
  echo ""
  if [ -n "$DOMAIN_IP" ] && [ -n "$PUBLIC_IP" ] && [ "$DOMAIN_IP" != "$PUBLIC_IP" ]; then
    echo "Diagnostico provavel:"
    echo "  - Containers locais podem estar saudaveis, mas o dominio aponta para outro IP/Caddy."
    echo "  - Atualize o DNS para o IP correto OU faca o Caddy em $DOMAIN_IP apontar para o servidor/app correto."
    echo ""
  fi
  echo "Comandos uteis para diagnostico:"
  echo "  docker logs pizzaria_api --tail 50"
  echo "  docker logs pizzaria_web --tail 30"
  echo "  docker ps -a"
fi
echo "========================================="
echo ""
exit $ERRORS
