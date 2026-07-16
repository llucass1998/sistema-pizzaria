#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VPN_DIR="$PROJECT_DIR/scripts/wsl-openvpn"
OVPN_FILE="$PROJECT_DIR/lucas_pizarria/lucas_pizarria.ovpn"

if [ "$(id -u)" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

if [ ! -f "$OVPN_FILE" ]; then
  echo "Perfil OpenVPN nao encontrado: $OVPN_FILE" >&2
  exit 1
fi

if ! command -v openvpn >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y openvpn
fi

install -d -m 0755 /etc/openvpn
install -d -m 0755 /etc/systemd/system/openvpn@client.service.d

install -m 0600 "$OVPN_FILE" /etc/openvpn/client.conf
install -m 0644 "$VPN_DIR/openvpn-client-override.conf" \
  /etc/systemd/system/openvpn@client.service.d/override.conf
install -m 0755 "$VPN_DIR/pizzaria-vpn-watchdog.sh" /usr/local/sbin/pizzaria-vpn-watchdog
install -m 0644 "$VPN_DIR/pizzaria-vpn-watchdog.service" /etc/systemd/system/pizzaria-vpn-watchdog.service
install -m 0644 "$VPN_DIR/pizzaria-vpn-watchdog.timer" /etc/systemd/system/pizzaria-vpn-watchdog.timer

systemctl daemon-reload
systemctl enable --now openvpn@client.service
systemctl enable --now pizzaria-vpn-watchdog.timer

echo ""
echo "OpenVPN configurado para subir automaticamente com o WSL."
systemctl --no-pager --full status openvpn@client.service || true
systemctl --no-pager --full status pizzaria-vpn-watchdog.timer || true
ip -4 address show dev tun0 || true
