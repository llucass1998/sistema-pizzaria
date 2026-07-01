# Relatorio de Correcao - Pagamento e Checkout

Data: 2026-07-01

## 1. Erros encontrados

- Checkout quebrava em runtime por chamada incorreta de toast.
- Metodos de cartao usavam valores `DEBIT` e `CREDIT`, diferentes dos enums tecnicos esperados no fluxo.
- Nome e WhatsApp nao eram validados de forma consistente para cliente logado.
- WhatsApp nao tinha helper visual/limpeza reutilizavel.
- PIX sem chave configurada exibia mensagem administrativa para o cliente.
- QR/copia-e-cola PIX era gerado mesmo com chave placeholder.
- Totais podiam receber valores invalidos e exibiam risco de `NaN`.
- Cupom/desconto podia exceder a base do pedido no resumo visual.
- Retirada nao garantia endereco da loja com fallback.
- Checkout ainda misturava acompanhamento/historico local do navegador.
- Erros de campos ficavam distantes ou genericos.

## 2. Causas

- Regras de UI e calculo estavam concentradas no componente, sem helpers testaveis.
- O componente ainda tinha codigo antigo de acompanhamento de pedido dentro do checkout.
- O frontend enviava labels/ids de pagamento que nao eram o contrato tecnico desejado.
- O PIX publico nao diferenciava configuracao ausente de configuracao real.

## 3. Correcoes aplicadas

- Criado `frontend-src/utils/checkout.js` com `safeNumber`, `formatCurrencySafe`, `cleanPhone`, `formatPhoneBR`, `isValidPhoneBR` e `calculateCheckoutSummary`.
- Corrigido toast para `useToast()`.
- Cartao de debito passou a enviar `DEBIT_CARD`; cartao de credito passou a enviar `CREDIT_CARD`.
- Nome e WhatsApp aparecem e validam sempre, com erro proximo do campo.
- Entrega exige rua, numero e bairro antes de enviar.
- Retirada zera entrega no resumo e exibe fallback de endereco.
- PIX sem chave configurada mostra somente: "Pagamento via PIX temporariamente indisponivel. Escolha outra forma de pagamento."
- QR Code e copia-e-cola PIX aparecem apenas quando a chave esta configurada.
- Totais usam calculo seguro, desconto limitado e total nunca negativo.
- Historico/localStorage/acompanhamento foram removidos do checkout; fica apenas confirmacao curta do pedido recem-criado.

## 4. Fluxo final

1. Resumo do carrinho.
2. Dados do cliente.
3. Entrega ou retirada.
4. Forma de pagamento.
5. Observacoes.
6. Cupom e resumo financeiro no painel lateral.
7. Finalizar pedido.

## 5. Metodos de pagamento

- PIX -> `PIX`.
- Dinheiro -> `CASH`.
- Cartao de debito -> `DEBIT_CARD`.
- Cartao de credito -> `CREDIT_CARD`.
- Cartao online aparece somente quando `storeSettings.gatewayEnabled` esta ativo.

## 6. Testes e validacao

- `npm run typecheck:strict`: passou.
- `npm run build`: passou.
- `npm run test`: passou, 9 arquivos e 56 testes.
- `npm run test:e2e`: passou, 2 arquivos e 8 testes.
- `npm run test:api`: passou, 9 arquivos e 56 testes.
- `npm run lint`: nao executado porque nao existe script `lint` no `package.json`.

Testes automatizados adicionados:

- `tests/e2e/checkout-ui-rules.spec.ts`
  - telefone BR formatado/validado;
  - moeda segura sem `NaN`;
  - desconto limitado sem total negativo;
  - cupom de frete gratis removendo taxa de entrega.

## 7. Docker / WSL2

- `docker compose build api`: passou.
- `docker compose build web`: passou.
- `docker compose up -d --build`: passou.
- `docker compose ps`: `pizzaria_api` healthy, `pizzaria_db` healthy, `pizzaria_web` na porta 80, `pizzaria_waha` running.
- `curl -I http://127.0.0.1/`: HTTP 200.
- `curl -I http://127.0.0.1/api/status`: HTTP 200.
- `curl -i "http://127.0.0.1/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="`: HTTP 200 com loja `Pizzaria Lucas`.

## 8. Arquivos alterados

- `frontend-src/pages/CheckoutPage.jsx`
- `frontend-src/utils/checkout.js`
- `tests/e2e/checkout-ui-rules.spec.ts`
- `RELATORIO_CORRECAO_PAGAMENTO_CHECKOUT.md`

## 9. Infra

Nao foram feitas alteracoes de infra neste trabalho de checkout. Nao editei Docker, Caddy, docker-compose, Dockerfiles, portas, proxy, API_URL, baseURL, DATABASE_URL, env, healthcheck, dominio, SSL ou resolve-store.

Observacao: o worktree ja possui muitas alteracoes preexistentes fora do escopo, inclusive arquivos de infra aparecendo no status global. Elas nao foram criadas nem alteradas para esta correcao de checkout.

## 10. Pendencias

- O backend atual exige cliente autenticado em `POST /pedidos`; por isso, se nao houver token, o checkout valida os dados e abre o fluxo de login/cadastro antes de finalizar.
- Ha aviso de bundle grande no Vite, sem impacto no build.
