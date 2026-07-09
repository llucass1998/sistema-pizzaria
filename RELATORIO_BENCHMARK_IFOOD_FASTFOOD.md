# Relatorio de Benchmark - Central Operacional iFood Fast Food

Data: 2026-07-08

## 1. O que meu projeto ja tem

- SaaS multi-tenant com `tenantGuard`, contexto por tenant e modelos Prisma com `tenantId`.
- Loja publica, checkout, carrinho, admin, PDV, pedidos live, KDS, despacho, estoque, financeiro, fiscal/NFC-e mock e pagamentos.
- `IntegrationCredential` para credenciais por tenant/provider/merchantId.
- `IntegrationEventLog` para eventos externos com `eventId`, `externalOrderId`, payload, status, erro e timestamps de processamento/ACK.
- Pedido externo com `Order.origin`, `externalId` e `externalMerchantId`.
- Ingestao de pedido externo via `ExternalOrderIngestionService`, criando pedido local, cliente externo, produtos importados e itens com estacao KDS.
- Integracao iFood com worker de polling, webhook publico, preview/sync de catalogo, merchant status e sincronizacao de status do pedido.

## 2. O que a pagina iFood ja tem

- Aba de credenciais com mascaramento do secret.
- Polling manual.
- Webhook com URL publica para configuracao.
- Preview e sync de catalogo.
- Controle basico de status da loja.
- Logs simples dos ultimos eventos.
- RBAC para `OWNER`, `ADMIN`, `MANAGER` e `INTEGRATION_MANAGER`.

## 3. O que falta para virar central operacional

- Painel de saude consolidando token, presence, polling, webhook, ACK, erros e importacoes do dia.
- Fila iFood paginada com filtros, detalhes, payload sanitizado e status operacional claro.
- Reprocessamento seguro por evento, com bloqueio para evento ja processado salvo confirmacao explicita.
- Corrigir ACK: evento com falha nao deve ser confirmado como consumido.
- Melhorar auditoria com payload sanitizado, erro copiavel e metricas de falha.
- Evoluir catalogo para mapeamento local/iFood e sync seletivo com preview de impacto.
- Checklist de homologacao iFood.
- Dashboard executivo de vendas, erros, ticket medio e comparativo por canal.

## 4. Ideias uteis encontradas nos repositorios de referencia

- `CDTN_A45987_NguyenThanhTung_ERP_NhaHangThucAnNhanh`: separa modulos de dashboard, KDS, expo/entrega, POS modifier e tipo de pedido. Ideia aproveitada: central operacional deve separar saude, fila, catalogo e auditoria em abas objetivas.
- `ERP_System_For_Restaurant_mini`: fluxo visual simples para garcom receber pedido e cozinha acompanhar. Ideia aproveitada: pedidos importados precisam entrar no fluxo normal e aparecer com origem clara.
- `Automated-Revenue-Reconciliation-System`: foco em carga incremental e audit log com contagem de inserts/updates/status. Ideia aproveitada: logs de integracao devem ter contadores, status e reprocessamento rastreavel.
- `Fast-Food-Control-ERP`: foco em interface operacional com paginas separadas. Ideia aproveitada: UI deve ser escaneavel, com cards de status e tabelas filtraveis.
- `xtreme-fast-food-erp`: repositorio indisponivel/sem conteudo util no clone analisado. Mantido apenas como referencia descartada.

## 5. Ideias descartadas e motivo

- Copiar telas, assets ou codigo dos repositorios: descartado por regra etica/licenca.
- Criar uma stack nova de BI/Power BI agora: valor alto, mas fora do escopo da central iFood inicial.
- Migration grande para todos os estados recomendados do evento: descartado nesta fase para reduzir risco em banco real; a fila usa os status atuais e documenta estados futuros.
- Sync real completo de catalogo iFood: descartado nesta fase porque precisa credenciais/homologacao e preview robusto para nao sobrescrever cardapio.

## 6. Comparacao entre meu sistema e os repositorios

| Area              | Meu projeto            | Referencias                           | Leitura                                              |
| ----------------- | ---------------------- | ------------------------------------- | ---------------------------------------------------- |
| Multi-tenant SaaS | Forte                  | Geralmente ausente                    | Meu projeto e superior em SaaS.                      |
| KDS/Despacho      | Ja existe              | Varios repos focam nisso              | Falta integrar visualmente origem iFood e alertas.   |
| Auditoria         | Existe em logs/eventos | Reconciliacao usa audit log forte     | Precisa virar ferramenta operacional, nao so tabela. |
| Catalogo          | Preview/sync basico    | POS modifiers aparecem em referencias | Precisa mapeamento local/iFood.                      |
| Financeiro        | Ja tem ERP financeiro  | Reconciliacao destaca BI              | Futuro: conciliacao iFood por repasse/comissao.      |

## 7. Lacunas do meu sistema

- ACK de polling precisa respeitar processamento seguro.
- Health endpoint iFood nao existia.
- Fila iFood nao era paginada nem filtravel.
- Reprocessamento por evento nao existia.
- Painel nao mostrava presence, token, ACK, webhook e contadores diarios.
- Payload sanitizado nao tinha visualizacao operacional.

## 8. Plano de implementacao por fases

1. Painel de Saude iFood.
2. Fila iFood paginada com filtros e payload sanitizado.
3. Reprocessamento seguro e idempotente.
4. Integracao visual com Pedidos Live/KDS/Despacho.
5. Mapeamento basico de catalogo.
6. Preview/sync seletivo.
7. Controle operacional da loja.
8. Erros & Auditoria.
9. Homologacao guiada.
10. Dashboard executivo.

## 9. Mudancas que exigem backend

- `GET /api/admin/integrations/ifood/health`.
- `GET /api/admin/integrations/ifood/events`.
- `POST /api/admin/integrations/ifood/events/:eventId/reprocess`.
- Regras de sanitizacao de payload e erro.
- Ajuste do ACK para nao confirmar evento falho.

## 10. Mudancas apenas frontend

- Cards de saude no topo.
- Aba `Fila iFood`.
- Filtros de fila, paginacao, modal de payload sanitizado e botao de reprocessar.
- Melhor UX de estado vazio/sem credencial.

## 11. Mudancas que exigem banco/migration

- Fase atual evita migration grande.
- Futuro recomendado: adicionar tentativa de processamento, origem do evento, ultimo erro sanitizado, duracao de processamento, usuario de reprocessamento e status adicionais (`PROCESSING`, `IGNORED_DUPLICATE`, `REPROCESS_REQUESTED`).

## 12. Mudancas futuras

- Mapeamento local/iFood com historico.
- Sync seletivo por preco, disponibilidade, foto, categoria e produtos selecionados.
- Checklist de homologacao guiado.
- Regras comerciais por canal.
- Conciliacao financeira iFood.

## Fontes oficiais iFood consideradas

- iFood Developer - Event polling: polling recorrente, filtros por merchant e ACK.
- iFood Developer - Presence: merchant fica online quando a integracao recebe/processa eventos.
- iFood Developer - Order workflow: ACK somente apos processamento seguro.
- iFood Developer - Catalog workflow/endpoints: usar PATCH para alteracoes pontuais; PUT pode substituir estrutura completa.
- iFood Developer - Generate test order: pedido teste deve ser validado no fluxo oficial de homologacao.
