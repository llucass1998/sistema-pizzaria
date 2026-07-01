# Relatorio de correcao - QR Code PIX

Data: 2026-07-01

## Problema encontrado

O checkout exibia a area do PIX, mas a imagem do QR Code aparecia quebrada com o texto alternativo `QR Code PIX`.

## Causa real

O QR Code era carregado por uma URL externa:

`https://api.qrserver.com/v1/create-qr-code/`

Quando esse servico externo falha, e bloqueado, fica lento ou nao carrega em producao, o navegador mostra a imagem quebrada. O checkout tambem nao exibia o codigo copia-e-cola em texto, entao o cliente ficava sem uma alternativa clara.

## Correcao aplicada

- Adicionada a dependencia `qrcode`.
- Criada a utility `frontend-src/utils/pix.js`.
- O payload PIX EMV/CRC agora fica isolado e testavel.
- O QR Code agora e gerado localmente como `data:image/png;base64`.
- Removida a dependencia de `api.qrserver.com` no checkout.
- Adicionado fallback visual quando a geracao falha.
- O codigo PIX copia-e-cola agora fica visivel em um campo de texto selecionavel.
- A chave placeholder `sua-chave-pix-aqui` continua bloqueada como PIX indisponivel.

## Arquivos alterados

- `package.json`
- `package-lock.json`
- `frontend-src/pages/CheckoutPage.jsx`
- `frontend-src/utils/pix.js`
- `tests/e2e/pix-qrcode.spec.ts`
- `RELATORIO_CORRECAO_QRCODE_PIX.md`

## Testes executados

- `npm run typecheck:strict`: OK
- `npm run test:e2e`: OK, 13 testes
- `npm run test:all`: OK
- `npx playwright test --reporter=line`: OK, 3 testes
- Verificacao direta no DOM:
  - `img[alt="QR Code PIX"]` usa `data:image/png;base64`
  - copia-e-cola PIX gerado com payload de 170 caracteres
- `docker compose build web`: OK
- `docker compose up -d --build`: OK
- `docker compose ps`: `pizzaria_api` healthy, `pizzaria_web` porta 80, banco healthy
- `curl -I http://127.0.0.1/`: HTTP 200
- `curl -I http://127.0.0.1/api/status`: HTTP 200
- WSL atualizado em `/home/srv/lucas/lucas_pizarria`
- Build WSL web `pizzaria-web:wsl-qrcode-pix`: OK

## Resultado

O QR Code PIX nao depende mais de internet externa ou de servico terceiro. Se a imagem nao puder ser gerada, o checkout continua funcional com o codigo copia-e-cola visivel.

## Infraestrutura

Nao foram alterados Docker, Caddy, compose, portas, proxy, env, dominio, SSL, healthcheck, networks, volumes ou `resolve-store`.
