#!/usr/bin/env bash
set -euo pipefail

VPN_SERVICE="openvpn@client.service"
VPN_INTERFACE="tun0"
EXPECTED_IPV4_PREFIX="${EXPECTED_IPV4_PREFIX:-172.25.20.}"
WAIT_SECONDS="${WAIT_SECONDS:-30}"

log() {
  logger -t pizzaria-vpn-watchdog "$*"
  echo "$*"
}

vpn_is_healthy() {
  systemctl is-active --quiet "$VPN_SERVICE" || return 1
  ip link show "$VPN_INTERFACE" >/dev/null 2>&1 || return 1

  local ipv4
  ipv4="$(ip -4 -o address show dev "$VPN_INTERFACE" | awk '{print $4}' | cut -d/ -f1 | head -n 1)"
  [ -n "$ipv4" ] || return 1

  if [ -n "$EXPECTED_IPV4_PREFIX" ] && [[ "$ipv4" != "$EXPECTED_IPV4_PREFIX"* ]]; then
    log "VPN com IP inesperado em $VPN_INTERFACE: $ipv4"
    return 1
  fi

  return 0
}

if vpn_is_healthy; then
  exit 0
fi

log "VPN indisponivel; reiniciando $VPN_SERVICE"
systemctl restart "$VPN_SERVICE"

deadline=$((SECONDS + WAIT_SECONDS))
while [ "$SECONDS" -lt "$deadline" ]; do
  if vpn_is_healthy; then
    log "VPN recuperada em $VPN_INTERFACE"
    exit 0
  fi
  sleep 2
done

log "VPN ainda indisponivel apos ${WAIT_SECONDS}s; tentando novo restart"
systemctl restart "$VPN_SERVICE"

if ! vpn_is_healthy; then
  log "ALERTA: WSL continua sem VPN saudavel. Nao considere a pizzaria online."
  exit 1
fi
