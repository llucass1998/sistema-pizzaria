# ROADMAP - Fast-Food Profissional & SaaS

## 1. Resumo geral do projeto atual
O projeto já está estruturado como um sólido **ERP/SaaS Multi-tenant**, com fundações profundas no banco de dados (Prisma) cobrindo rotinas como clientes, contas a pagar/receber, PDV, cardápio digital, integração com WhatsApp e estrutura fiscal. O sistema é robusto na separação de lojas (tenants). O nível de maturidade hoje é de um **ERP Básico + Delivery Funcional Multi-loja**, contendo as vias vitais de um sistema moderno.

## 2. O que já está pronto (✅)
- **Multi-tenant Core**: `x-tenant-id`, rotas, middlewares, e domain resolution 100% testados e integrados.
- **Cardápio e E-commerce**: Categorias, produtos, imagens, carrinho de compras e checkout público.
- **Pedidos**: Integração de status em tempo real, pedidos balcão e delivery.
- **Infraestrutura SaaS**: Tabelas para gerenciamento de lojas, regras visuais (`logo`, `brandColor`), banco de dados isolado via chaves.
- **Financeiro & Fiscal Core**: Tabelas de `Invoice`, `Payment`, `Supplier`, `FiscalDocument` e base do serviço fiscal.
- **Estoque & KDS Básico**: Telas iniciais de KDS/PDV implementadas, controle de transações no banco, fichas técnicas de receita (`Recipe`).

## 3. O que está parcialmente pronto (🟡)
- **Combos e Adicionais**: O banco de dados suporta `ProductVariant` e `ProductOption`, mas faltam fluxos elaborados de UX/UI (Escolha 1 obrigatória, metades da pizza, bordas opcionais na mesma jornada).
- **Tela de Cozinha (KDS)**: O roteamento e página inicial do KDS existem, mas precisam de refino comercial (apitos de novos pedidos, piscagem para pedidos atrasados, priorização visual).
- **Pagamento Online**: MockPayment implementado e `IntegrationCredential` estruturado, faltando plugar o Webhook real de um provedor (ex: MercadoPago, Stripe).
- **Dashboard e Relatórios**: O dashboard exibe indicadores simples, mas falta um extrato financeiro denso ou DRE exportável.

## 4. O que falta implementar (🔴)
- **Gestão de Entregadores/Motoboys**: Não existem entidades exclusivas de controle de viagem/entregador, atribuição de rotas e comissão na ponta.
- **Controle de Caixa Detalhado**: Fechamentos, Sangrias, Suprimentos (A tabela `Shift` já faz a fundação, mas o PDV precisa ter as rotinas fiscais conectadas aos botões).
- **Cancelamentos Avançados**: Fluxo de motivo de cancelamento com estorno automático via Gateway e notificação do caixa.

## 5. Bugs Encontrados
- *Nota: Na nossa última auditoria exaustiva E2E resolvemos o Race Condition crítico do Multi-Tenant.*
- Alguns arquivos não utilizados nas pastas (ex: `AdminPage.jsx` vs `AdminUI.jsx`).
- Ajustes menores nas validações estritas do TypeScript (Zod x Prisma). Não há quebras que impeçam o negócio de vender hoje.

## 6. Prioridade Alta
1. **Combos e Modificadores Avançados**: Aumenta o ticket médio (adicionais de borda, bebida no combo).
2. **Abertura/Fechamento de Caixa, Sangria e Suprimento**: Essencial para a confiança financeira do dono da loja física.
3. **KDS/Tela da Cozinha 100% Sonoro e Visual**: Crucial para o fast-food na operação.
4. **Pagamento Online com Webhook Real**: Para reduzir golpes de PIX falso.
5. **Controle de Entregadores**: Visibilidade de despacho de pedidos.

## 7. Prioridade Média
- Estoque de ingredientes atrelado ao módulo de compras com baixa rigorosa por ficha técnica em 100% do catálogo.
- Relatórios financeiros exportáveis em PDF/CSV.
- Cupons e Campanhas de Fidelidade (Módulo `LoyaltyProgram` existe mas falta interface promocional agressiva).
- Histórico rico do cliente e sistema de repetição de pedido (`Repeat Order`).

## 8. Prioridade Baixa
- PWA / App instalável (O site responsivo já cobre a necessidade imediata).
- Avaliações e Reviews de pratos.
- NFC-e / Integração Fiscal (Para os primeiros clientes beta, a nota manual ou MEI já é suficiente, integra-se depois para faturamento em escala).

## 9. Ordem Recomendada de Implementação
**Fase 1** -> UX de Adicionais e Metades (Gera receita direto).
**Fase 2** -> Frente de Caixa blindado (Abertura/Fechamento) e KDS de Alta Performance.
**Fase 3** -> Gateway Webhook e Motoboys (Escala de Delivery).
**Fase 4** -> Fechamento de relatórios ERP (DRE, Conciliação Bancária).
**Fase 5** -> Emissão Fiscal automatizada (NFC-e na tela do POS).

## 10. Módulos que dão mais valor comercial
- **Cardápio Inteligente**: Opções extras claras e sugestão de bebidas.
- **Programa de Fidelidade (Cashback)**.
- **Site Rápido**: O cliente compra sem precisar baixar nada. (Isso você já tem muito bom).

## 11. Módulos que podem ficar para depois
- Emissão NFe complexa de fornecedor.
- Gestão de RH e escalas complexas.
- App Nativo na Apple Store.

## 12. Riscos Técnicos
- O sistema é altamente robusto e possui tabelas gigantes e relacionais (ERP profundo). Inserir muitos dados não testados pode causar orfãos (como os `Items` de um `Order` sem o `Tenant`). Sempre usar transactions no Prisma.
- Conciliação Webhook: Exige túneis (ngrok) para testar no WSL2.

## 13. Sugestão de Próximas Fases
Iniciar a adaptação do Modal de Produto (Front) para abrigar múltiplos "Steps" de adicionais (ex: 1. Escolha a Borda, 2. Escolha os Opcionais, 3. Bebida), consumindo as tabelas de `ProductOption` já criadas.

---
## COMPARAÇÃO COM REFERÊNCIAS
**1. Restaurante Food Ordering (MERN)**
- *O que tem:* Fluxos simples de login e add to cart.
- *Meu Projeto:* Já é amplamente superior. Você já tem arquitetura Prisma e tipagem, enquanto MERN crú é menos escalável.

**2. Food Ordering (Adrian Hajdin)**
- *O que tem:* Design extremamente apurado e micro-animações, integrações Stripe prontas.
- *O que falta em mim:* UI refinada de transição de carrinho e gateway de pagamentos real. *Vale a pena implementar o Gateway Stripe/MercadoPago logo.*

**3. Restaurant POS**
- *O que tem:* Foco total na velocidade de clicar e finalizar uma comanda no PDV físico, e atalhos de teclado.
- *O que falta em mim:* Os atalhos de teclado e interface adaptada para telas touch screen menores no balcão. *Vale a pena mapear shortcuts e tela cheia.*

**4. React Food App**
- *O que tem:* Funcionalidades SPA tradicionais.
- *Meu Projeto:* Seu projeto excede as funcionalidades locais.
