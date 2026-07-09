# Relatório de Auditoria — Fase 6 Backlog Médio

## 1. O que já existe

- **CRM:** A página (`CRMPage.jsx`) já implementa filtros e segmentação (`ALL`, `VIP`, `ATIVO`, `NOVO`, `EM_RISCO`). Os dados estão presentes no array de clientes em memória após carregar do backend.
- **Relatórios:** A página (`ReportsPage.jsx`) já possui diversas métricas carregadas (ABC de produtos, Mix de Pagamentos, Ranking de Entregadores) e possui um método básico genérico `exportToCsv`, porém sem proteção contra CSV Injection ou prefixo de BOM (UTF-8).
- **KDS:** A página (`KDSPage.jsx`) já possui as informações completas dos itens da comanda, as estações para filtro, mas lista os itens da comanda sem agrupamento visual por categorias.
- **Configurações:** A página (`SettingsPage.jsx`) já carrega e salva o objeto completo, permitindo a adição de novos campos no backend de forma transparente no objeto JSON de settings.
- **Estoque:** A página (`InventoryPage.jsx`) já carrega a rota `/summary` com o valor de `purchaseSuggestion` e a lista de insumos com `status` (`OUT`, `CRITICAL`, `LOW`).

## 2. Dados disponíveis

- **CRM:** `filteredCustomers` contém os clientes da aba/filtro ativo.
- **Relatórios:** Arrays de dados já disponíveis em estados como `abcData`, `driverRank`, `payments`. O resumo está em `summary`.
- **KDS:** Em `order.items`, podemos extrair a categoria usando o encadeamento: `item.product?.category?.name`.
- **Configurações:** `form` state e backend aceitam o merge flexível via `PUT /api/admin/settings` ou `PUT /api/configuracoes/loja` (como está hoje).
- **Estoque:** Array de `ingredients` (insumos) permite filtragem direta no front-end para gerar a sugestão.

## 3. Arquivos que serão alterados

- `frontend-src/pages/admin/CRMPage.jsx`
- `frontend-src/pages/admin/ReportsPage.jsx`
- `frontend-src/pages/admin/KDSPage.jsx`
- `frontend-src/pages/admin/SettingsPage.jsx`
- `frontend-src/pages/admin/InventoryPage.jsx`

## 4. Riscos Encontrados

- **SettingsPage:** Atualmente não há sistema de abas na interface, os campos estão empilhados em seções (`<Panel>`). Será necessário refatorar a visualização das configurações para incluir as abas solicitadas sem quebrar as que já existem. O salvamento precisa garantir que o objeto seja mesclado ao invés de sobrescrever.
- **KDSPage:** Agrupar na renderização da comanda precisa ser bem otimizado para não prejudicar a renderização em tempo real (uso de memo).

## 5. Confirmações

- **NÃO será criada migration** no Prisma. Os dados de configurações e opções da interface serão gravados nos campos JSON existentes ou tratados diretamente na apresentação (filtros no front-end).
- **A infraestrutura NÃO será alterada** (sem mudança de Docker, caddy, docker-compose, scripts de build, portas).
