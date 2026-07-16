$ErrorActionPreference = 'Stop'

$wsl = Join-Path $env:WINDIR 'System32\wsl.exe'
$command = @'
systemctl start openvpn@client.service
systemctl start pizzaria-vpn-watchdog.timer
/usr/local/sbin/pizzaria-vpn-watchdog
'@

& $wsl -d Ubuntu -u root -- bash -lc $command
