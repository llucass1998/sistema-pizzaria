#!/usr/bin/env bash
set -euo pipefail

echo "--- OpenVPN service ---"
systemctl --no-pager --full status openvpn@client.service || true

echo ""
echo "--- Watchdog timer ---"
systemctl --no-pager --full status pizzaria-vpn-watchdog.timer || true

echo ""
echo "--- VPN interface ---"
ip -4 address show dev tun0 || true

echo ""
echo "--- Recent VPN logs ---"
journalctl -u openvpn@client.service -u pizzaria-vpn-watchdog.service --no-pager -n 80 || true
