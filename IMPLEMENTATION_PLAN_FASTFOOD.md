# PLANO DE IMPLEMENTAÇÃO EM FASES - Fast-Food Profissional

## FASE 1 — Correções Críticas & Qualidade de Vida (QoL)
**Objetivo:** Polir a estabilidade da interface do carrinho local, certificar que botões não estão vazios e finalizar pendências mínimas que previnem bloqueios do usuário.
- **Arquivos Prováveis:** `App.jsx`, `CheckoutPage.jsx`, `AdminUI.jsx`.
- **Telas:** Modais de aviso de erro, botões de ação final.
- **Testes Obrigatórios:** Testar a renderização com catálogos grandes para verificação de bugs de imagem.
- **Critérios de Aceite:** Console em branco de erros de React, todos os links clicáveis navegam com sucesso.

## FASE 2 — Combos e Modificadores Avançados (Pizza Meio-a-Meio e Adicionais)
**Objetivo:** Permitir montar pizzas de 2 ou mais sabores, escolher bordas obrigatórias, e oferecer "Opcionais pagos" de maneira elegante para o cliente.
- **Models Necessários:** Ajustar `ProductVariant`, e garantir `ProductOption` com campo `maxChoices` e `minChoices`.
- **Endpoints:** `GET /products/options`, `POST /pedidos` (com payloads aninhados ajustados).
- **Telas:** O `ProductModal.jsx` se tornará um multi-step wizard. 
- **Riscos:** Cálculo complexo de preços dinâmicos (a pizza cobra pela metade mais cara ou pela média?).
- **Testes Obrigatórios:** Garantir que o valor final bate com a soma das metades mais caras + opcionais.
- **Critérios de Aceite:** O cliente compra um combo hambúrguer (Hamburguer + Batata obrigatória + Bebida obrigatória) e o carrinho calcula tudo em 1 único "Item".

## FASE 3 — Caixa Blindado (Abertura, Fechamento, Sangria, Suprimento)
**Objetivo:** Transformar o PDV numa máquina comercial real, com controle financeiro diário por operador/atendente.
- **Models Necessários:** `CashRegister`, `CashTransaction` (Sangria/Suprimento), `Shift` (Aprimorar).
- **Endpoints:** `POST /admin/pos/shift/open`, `POST /admin/pos/transaction`, `POST /admin/pos/shift/close`.
- **Telas:** `POS/CaixaDashboard.jsx`. Modal de Fechar Caixa com conferência cega (dinheiro contado vs dinheiro no sistema).
- **Riscos:** Operadores esquecerem caixas abertos de um dia para o outro.
- **Testes Obrigatórios:** Abertura e fechamento com diferença de centavos, verificando o status de "Quebra de Caixa".
- **Critérios de Aceite:** Um recibo Z impresso por turno consolidando cartões, dinheiro e pix.

## FASE 4 — Cozinha KDS (Kitchen Display System)
**Objetivo:** Organizar a fila da cozinha com timers de atraso sonoros.
- **Arquivos Prováveis:** `pages/KDS/KdsDashboard.jsx`, Websockets, `audio/beep.mp3`.
- **Telas:** Quadro Kanban ou Grid de Tickets em tela preta (fácil visão). Cores: Verde (no tempo), Amarelo (prestes a atrasar), Vermelho (atrasado).
- **Endpoints:** Webhooks para atualizar o Frontend automaticamente a cada inserção no Prisma via Redis/Socket.io ou Polling de 5s.
- **Critérios de Aceite:** Cozinheiro toca na tela para dar baixa no prato, e o painel de "Pedidos Live" muda automaticamente para `READY`.

## FASE 5 — Pagamento Online & Webhooks
**Objetivo:** Parar de conferir comprovantes do WhatsApp e deixar o sistema baixar sozinho.
- **Arquivos Prováveis:** `services/PaymentGatewayService.ts`, `routes/webhook.routes.ts`.
- **Endpoints:** `POST /webhooks/mercadopago`, `POST /webhooks/stripe`.
- **Riscos:** Pedidos aprovados não mudarem de status no banco ou falharem na assinatura criptografada.
- **Critérios de Aceite:** Pagamento via QRCode PIX dinâmico do Gateway muda o pedido para "Pago" em tempo real na tela do cliente e avança para a cozinha.

## FASE 6 — Delivery Avançado (Logística e Raio)
**Objetivo:** Adicionar despachos de motoboys e rotas customizadas por polígonos/raio.
- **Models Necessários:** `Driver`, `DeliveryZone` (Polígonos/Bairros).
- **Telas:** "Painel de Despacho" na aba ADM.
- **Critérios de Aceite:** Taxa de entrega muda dinamicamente de acordo com o CEP inserido no Checkout do Frontend.

## FASE 7 — SaaS Avançado (Automação Lojista)
**Objetivo:** Automatizar o onboarding de novas pizzarias no sistema.
- **Endpoints:** Integração com Gateway de Assinaturas (Stripe Billing/Asaas). `POST /tenant/register`.
- **Critérios de Aceite:** O lojista preenche o cartão de crédito e, ao pagar R$100 mensais, o painel `nomedaloja.seudominio.com` é ativado na hora com banco isolado e temas aplicados.
