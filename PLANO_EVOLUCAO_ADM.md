# Plano de Evolução do Painel Administrativo (Pizzaria)

Este documento apresenta uma análise arquitetural profunda do sistema atual, comparação com projetos de referência e o plano de evolução por fases focado no Painel Administrativo.

---

## 1. Resumo do Sistema Atual
Após auditar o repositório, constata-se que o sistema possui uma base técnica muito robusta:
- **Backend:** Construído em Node.js com TypeScript, Express e Prisma ORM. O banco de dados (PostgreSQL) possui uma modelagem de altíssimo nível (Multi-tenant), contemplando funcionalidades complexas como CRM (Cupons, Carrinhos abandonados, Fidelidade), ERP (Estoque, Notas Fiscais), integrações (iFood) e turnos/caixa.
- **Frontend:** Construído em React, Vite, TailwindCSS e Zustand. 
- **Ponto Crítico:** A página administrativa (`AdminPage.jsx`) é um grande arquivo monolítico (~72KB). Em vez de usar roteamento (`react-router-dom`) com páginas separadas, ela gerencia seções via estado local, carregando modais pesados de uma só vez.

---

## 2. Análise dos 4 Projetos de Referência
Os repositórios listados servem como ótimos guias de usabilidade e arquitetura de produto:

1. **Restaurant-Food-Ordering-Management-System (MERN):** 
   - *Forte:* Painel ADM com Dashboard rico em gráficos (receita, pedidos) e gestão de pedidos estilo "Kanban" ou "Live Table". 
   - *Para adaptar:* O layout de dashboard analítico e a divisão clara de rotas administrativas.
2. **food_ordering (Adrian Hajdin):** 
   - *Forte:* UI/UX absurdamente polido e "Premium". Modais elegantes, skeleton screens e transições.
   - *Para adaptar:* O padrão visual (cores consistentes, acessibilidade, feedback de ações).
3. **restaurant-pos (Ahmed Ali):** 
   - *Forte:* Interface dedicada para o Caixa/Atendente (PDV). Atalhos rápidos, grade de produtos na tela, fácil adição ao carrinho e impressão de recibo.
   - *Para adaptar:* A criação de uma rota separada `/admin/pos` voltada para o balconista lançar pedidos presenciais ou de telefone.
4. **react-food-app (Mahmud Alam):** 
   - *Forte:* Simplicidade no fluxo de estado global.
   - *Para adaptar:* Manter a simplicidade no Zustand que já utilizamos.

---

## 3. O que o meu sistema já tem?
- **Backend:** Quase 100% preparado. Já temos tabelas para `Order`, `Product`, `ProductVariant`, `ProductOption`, `Customer`, `Coupon`, `InventoryTransaction`, `Shift`, `IntegrationEventLog`, etc.
- **Frontend ADM:** Tem CRUDs operantes (mas básicos) para Categorias, Produtos, Opções e Cupons. Tem uma tela de configuração geral (nome da loja, PIX, taxas).

---

## 4. O que falta no ADM?
Apesar do backend ser um "Foguete", o frontend administrativo está agindo como um "Triciclo". Faltam:
1. **Roteamento real:** O ADM precisa ser dividido em múltiplas rotas (`/admin/dashboard`, `/admin/orders`, `/admin/products`, etc).
2. **Dashboard Financeiro/Operacional:** Resumo de vendas do dia, ticket médio e pedidos pendentes.
3. **Gestor de Pedidos (KDS/Kanban):** Uma tela auto-atualizável para a cozinha/caixa mudar os status (PENDING -> PREPARING -> DELIVERED).
4. **Tela de PDV (Frente de Caixa):** Para lançar pedidos físicos usando a mesma base de dados.
5. **Gestão Visual de Estoque e Ingredientes:** O Prisma já tem a tabela `Ingredient` e `InventoryTransaction`, mas o painel não mostra.

---

## 5. Comparativo de Funcionalidades

| Funcionalidade | No Sistema Atual | Nos Projetos de Referência | Prioridade | Observação |
| :--- | :--- | :--- | :--- | :--- |
| **Gestão de Produtos** | Sim (Básico) | Sim (Avançado) | Alta | Falta paginação, filtros e controle de estoque associado. |
| **Dashboard** | Não | Sim | Alta | É vital para o dono ver o faturamento diário. |
| **Painel de Pedidos (Live)** | Parcial | Sim | Alta | Falta atualização ágil de status com um clique. |
| **Frente de Caixa (PDV)** | Não | Sim (Em alguns) | Média | O backend está pronto para receber origens "BALCAO". |
| **Cupons e Promoções** | Parcial | Sim | Média | O banco suporta, falta refinar a UI de criação no ADM. |
| **Relatórios / Analytics** | Não | Sim | Média | Exportar vendas (PDF/Excel) e gráficos de itens mais vendidos. |
| **Gestão de Permissões (Roles)** | Não | Sim | Baixa | Hoje todo Admin é superuser. Precisaremos de role "Caixa" e "Gerente". |

---

## 6. Prioridades

**🔴 Prioridade Alta (Operação Crítica)**
- Refatorar o monolito `AdminPage.jsx` dividindo-o em um layout com `react-router-dom` (Sidebar à esquerda, Header, e Content dinâmico).
- Dashboard inicial com KPIs do dia (Faturamento, Qtd Pedidos).
- Painel de Gestão de Pedidos Ágil (mudar status rapidamente).

**🟡 Prioridade Média (Escalabilidade)**
- Interface de PDV / Lançamento manual de pedidos.
- Gestão de Cupons (com limites de uso e validade visíveis).
- Aba de Clientes (CRM visual).
- Relatórios (Listagem de faturamento mensal).

**🟢 Prioridade Baixa (Avançado)**
- Gestão de Fichas Técnicas (Ingredientes vs Receita).
- Impressão térmica automática para cozinha.
- Níveis de acesso de usuários.

---

## 7. Plano de Implementação por Fases

### **Fase 1: Fundação e Dashboard (Refatoração)**
- **Objetivo:** Quebrar o `AdminPage.jsx` e criar a estrutura visual profissional com Sidebar.
- **Telas:** Layout Base ADM, Dashboard (Resumo).
- **Backend:** Criar endpoint `GET /api/admin/reports/daily-summary`.

### **Fase 2: Motor de Pedidos (Live Orders)**
- **Objetivo:** O coração da pizzaria. Visualização clara do fluxo dos pedidos (Novo -> Preparando -> Entrega).
- **Telas:** Kanban de Pedidos ou Lista Otimizada. Modais de detalhes do pedido.
- **Backend:** Polling ou WebSocket para pedidos. Rotas de mudança rápida de status (`PATCH /api/admin/orders/:id/status`).

### **Fase 3: Refino de Cardápio e CRM**
- **Objetivo:** Separar as abas de produtos, adicionais, categorias e criar a aba de Cupons e Clientes reais.
- **Telas:** Lista de Produtos (paginada), Tela de Clientes (histórico), Tela de Cupons detalhada.

### **Fase 4: Operação de Caixa (PDV)**
- **Objetivo:** Permitir que o telefone/balcão use o sistema para gerar pedidos sem o cliente precisar acessar o site.
- **Telas:** Rota `/admin/pos` (Layout de grid com produtos à esquerda e cupom fiscal virtual à direita).

---

## 8. Telas Sugeridas (Sidebar Administrativa)

```text
📦 ADMIN PANEL
 ┣ 🏠 Dashboard
 ┣ 📋 Pedidos (Live)
 ┣ 🖥️ PDV (Frente de Caixa)
 ┣ 🍕 Cardápio
 ┃  ┣ Produtos
 ┃  ┣ Categorias
 ┃  ┗ Opções & Bordas
 ┣ 👥 CRM & Clientes
 ┣ 🎟️ Cupons
 ┣ 📊 Relatórios financeiros
 ┗ ⚙️ Configurações da Loja
```

---

## 9. Proposta de Models / Banco de Dados
A modelagem atual (`schema.prisma`) foi exaustivamente revisada. Ela é **excepcional** e suporta 95% do que foi planejado sem nenhuma alteração.
*Não é necessária NENHUMA MIGRATION na Fase 1, 2 ou 3.* 

A única sugestão futura seria adicionar na tabela `Admin` o campo `role String @default("MANAGER") // CASHIER, MANAGER, ADMIN` para suportar diferentes acessos.

---

## 10. Endpoints Sugeridos

**Novos endpoints consolidados (pois os CRUDs já existem):**
- `GET /api/admin/dashboard/summary` (Retorna `totalRevenue`, `pendingOrders`, `completedOrders` do dia).
- `GET /api/admin/orders/live` (Lista rápida apenas de pedidos não finalizados).
- `PATCH /api/admin/orders/:id/status` (Avança status do pedido).
- `POST /api/admin/pos/checkout` (Gera pedido oriundo do balcão).

---

## 11. Padrão Visual (UI/UX)
- Usaremos a biblioteca `lucide-react` já existente.
- Adoção do padrão **Shadcn UI (simulado com Tailwind)**: Bordas sutis (`border-slate-200`), fundos limpos (`bg-slate-50`), e componentes como modais deslizando de forma suave.
- Tabelas com "Sticky Header" e cores de status (Verde para Concluído, Amarelo para Preparando, Vermelho para Cancelado).
- Tudo perfeitamente ajustado para Dark Mode (`dark:bg-slate-900`).

---

## 12. Segurança do ADM
- **Frontend Guard:** Envolver as rotas `/admin/*` num componente `<AdminRoute>` que verifica se existe um token JWT válido.
- **Backend:** O `authenticateAdmin` precisa garantir não apenas o token, mas que o `tenantId` esteja isolado (evitando que um admin acesse dados de outra loja).

---

## 13. Riscos Técnicos
1. **Quebra do Monolito:** Como todo o estado atual de `AdminPage.jsx` está no mesmo escopo, separá-lo em várias rotas pode introduzir bugs nos modais antigos se não transferirmos o Zustand corretamente.
2. **Atualização em Tempo Real:** O painel de pedidos pode desincronizar se o cliente fizer pedido e a tela não atualizar. Se não tivermos WebSocket, usaremos *Long Polling* ou re-fetch a cada 10 segundos.

---

## 14. Ordem Recomendada
1. Refatorar `App.jsx` adicionando `react-router-dom` para a área `/admin`.
2. Criar a `AdminLayout.jsx` com a Sidebar lateral.
3. Migrar o componente monolítico para dentro das respectivas sub-páginas (`/admin/products`, `/admin/settings`).
4. Desenvolver o `Dashboard` financeiro.
5. Desenvolver a gestão de Status de Pedidos (Live Orders).
6. Desenvolver o PDV (POS).

---

## 15. Critérios de Aceite
A reestruturação será considerada um sucesso quando:
- O painel administrativo carregar de forma instantânea por página (sem carregar modais ocultos atoa).
- O administrador conseguir ver o faturamento do dia de forma gráfica e imediata ao logar.
- O caixa conseguir mudar o status de um pedido de "Pendente" para "Preparando" com um único clique.
- O painel for 100% responsivo para gerentes utilizarem via iPad/Tablet na loja.
