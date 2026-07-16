$ErrorActionPreference = 'Stop'

$distribution = 'Ubuntu'
$expectedAddress = '172.25.20.159'
$deadline = (Get-Date).AddSeconds(45)

# Mantem a distro viva; sem isso o systemd e a tun0 desaparecem quando o WSL encerra.
$task = Get-ScheduledTask -TaskName 'Pizzaria-WSL-VPN-KeepAlive' -ErrorAction Stop
if ($task.State -ne 'Running') {
    Start-ScheduledTask -TaskName 'Pizzaria-WSL-VPN-KeepAlive'
}

do {
    $state = (& wsl.exe -d $distribution -u root -- systemctl is-active openvpn@client.service 2>$null).Trim()
    $address = & wsl.exe -d $distribution -u root -- /bin/sh -lc "ip -4 -o address show dev tun0 2>/dev/null | awk '{print \`$4}' | cut -d/ -f1 | head -n1"
    $address = ($address | Out-String).Trim()

    if ($state -eq 'active' -and $address -eq $expectedAddress) {
        Write-Output "VPN_OK openvpn@client=$state tun0=$address"
        exit 0
    }

    & wsl.exe -d $distribution -u root -- systemctl restart openvpn@client.service | Out-Null
    Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)

throw "VPN obrigatoria indisponivel: openvpn@client=$state tun0=$address. Deploy Docker bloqueado."
