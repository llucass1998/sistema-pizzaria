# TEST_COVERAGE_MAP

| Modulo | Teste manual | Teste automatizado | Status | Observacao |
| --- | --- | --- | --- | --- |
| Frente de loja | Pendente em browser real | Sim | Parcial | Smoke cobre resolve-store, config, categorias e produtos |
| Carrinho | Pendente | Sim | Parcial | Totais sem negativo/NaN cobertos indiretamente |
| Checkout entrega | Pendente | Sim | Parcial | Regras de total e status cobertas; fluxo UI pendente |
| Checkout retirada | Pendente | Sim | Parcial | State machine pickup coberta |
| Loja aberta/fechada | Pendente | Sim | Parcial | Config publica `isOpen` coberta; bloqueio UI pendente |
| Pedidos | Pendente | Sim | Parcial | Transicoes cobertas |
| Pedidos Live/KDS | Pendente | Sim | OK backend | Specs existentes cobrem fila e transicoes KDS |
| Admin login/dashboard | Pendente | Nao | Pendente | Requer credencial de teste/browser |
| PDV | Pendente | Sim | Parcial | Regras de status cobertas; checkout API real pendente |
| Produtos | Pendente | Sim | Parcial | Listagem publica e tenant filter cobertos; alias `/api/products` passa na API direta, mas falha via proxy local |
| Categorias | Pendente | Sim | Parcial | Listagem e bloqueio admin sem token cobertos |
| Configuracoes | Pendente | Sim | Parcial | GET publico coberto |
| Estoque | Pendente | Sim | Parcial | Specs existentes de services |
| Fichas tecnicas | Pendente | Sim | Parcial | Specs de manufacturing/inventory existentes |
| Orcamentos | Pendente | Nao | Pendente | CRUD real pendente |
| Contas a receber | Pendente | Nao | Pendente | Baixa parcial/total pendente |
| Equipe/acessos | Pendente | Nao | Pendente | CRUD usuarios/OWNER pendente |
| Backend/API | Sim via contrato local | Sim | Parcial | `test:api` passa |
| Banco/Prisma | Nao destrutivo apenas | Sim | Parcial | Typecheck e specs sem DB real |
| Docker/WSL2 | Pendente | Script criado | Pendente | `scripts/smoke-test.sh` criado |
