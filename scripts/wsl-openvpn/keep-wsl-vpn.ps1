$ErrorActionPreference = 'Continue'

$distribution = 'Ubuntu'
$watchCommand = @'
systemctl start openvpn@client.service pizzaria-vpn-watchdog.timer >/dev/null 2>&1 || true

# Este loop precisa permanecer dentro de um unico processo WSL. Alem de validar a
# VPN, o despertar periodico impede o WSL2 de considerar a distro ociosa e
# encerrar o systemd/tun0 entre verificacoes.
while true; do
  if ! systemctl is-active --quiet openvpn@client.service || \
     ! ip -4 -o address show dev tun0 2>/dev/null | grep -q '172\.25\.20\.159/'; then
    systemctl restart openvpn@client.service >/dev/null 2>&1 || true
  fi
  sleep 15
done
'@

& wsl.exe -d $distribution -u root -- /bin/bash -lc $watchCommand
exit $LASTEXITCODE
