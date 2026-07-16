# Regras operacionais obrigatorias

## VPN de producao

- A producao depende permanentemente da VPN OpenVPN dentro da distro WSL `Ubuntu`.
- O servico obrigatorio e `openvpn@client.service` e a interface esperada e `tun0`.
- O IP recebido atualmente e `172.25.20.159/24`; o Caddy remoto usa essa VPN para alcancar o Docker/Nginx.
- Sempre que iniciar, reiniciar, diagnosticar ou publicar o sistema, confirme primeiro que a distro esta ativa, que `openvpn@client.service` esta `active` e que `tun0` possui IPv4.
- Nunca finalize a distro `Ubuntu` e a deixe parada. Se um teste exigir `wsl --terminate Ubuntu`, inicie-a novamente e valide o dominio publico antes de concluir.
- Um HTTP 502 publico com endpoints locais em HTTP 200 deve ser tratado primeiro como perda da VPN/WSL.
- Protecoes instaladas: `openvpn@client` com `Restart=always`, `pizzaria-vpn-watchdog.timer` e a tarefa do Windows `Pizzaria-WSL-VPN-KeepAlive`.

