# Relatorio UX/UI - Central Operacional iFood

Data: 2026-07-08

## 1. Estado visual anterior

- Pagina funcional, mas ainda com aparencia tecnica.
- Cards de saude simples, sem hierarquia executiva.
- Abas misturavam termos tecnicos e operacionais.
- Fila iFood legivel no desktop, mas sem experiencia mobile forte.
- Credenciais, webhook, catalogo e logs tinham visual basico.

## 2. Melhorias de layout feitas

- Novo header de central operacional com titulo, subtitulo, badge de status e acoes rapidas.
- Cards de saude com icone, valor principal, descricao, badge e skeleton.
- Abas reorganizadas: Visao Geral, Fila iFood, Pedidos, Cardapio, Sync, Loja, Erros & Auditoria, Homologacao, Credenciais e Configuracoes.
- Secoes com cabecalho padronizado, iconografia e microcopy operacional.
- Empty states profissionais para ausencia de credencial, eventos, pedidos e logs.

## 3. Topo

- Titulo: `Integracao iFood`.
- Subtitulo: monitoramento de pedidos, eventos, catalogo, presenca e saude.
- Badge de status geral.
- Metadados rapidos: merchant, ultimo evento, eventos hoje.
- Acoes rapidas:
  - Testar conexao;
  - Polling agora;
  - Ver fila;
  - Homologacao.

## 4. Painel de Saude

- Cards refinados para:
  - Status geral;
  - Presenca iFood;
  - Token;
  - Ultimo polling;
  - Ultimo webhook;
  - Pedidos hoje;
  - Erros 24h;
  - Ultima sync de catalogo.
- Cores sem exagero: verde, amarelo, vermelho, cinza e azul.
- Badges com texto e cor, sem depender apenas da cor.

## 5. Abas

- Abas horizontais com scroll natural em telas menores.
- Aba ativa com destaque forte.
- Nomes orientados para operacao.

## 6. Fila iFood

- Tabela desktop mais clara com horario, tipo, pedido, merchant, status, cliente/total, ultimo erro e acoes.
- Cards mobile para eventos.
- Filtros rapidos: Todos, Pendentes, Processados, Falharam e ACK enviado.
- Busca por eventId, externalOrderId e merchantId.
- Acoes: detalhes, copiar erro e reprocessar.

## 7. Pedidos iFood

- Criada visao visual com cards de resumo:
  - Novos;
  - Em preparo;
  - Prontos/Despacho;
  - Falha de importacao.
- Empty state direcionando para a fila enquanto a listagem dedicada de pedidos iFood fica para fase futura.

## 8. Cardapio/Mapeamento

- Criado painel visual de mapeamento com resumo:
  - Produtos mapeados;
  - Pendentes;
  - Divergentes;
  - Sem imagem;
  - Com erro.
- CTA para preview e abertura da sincronizacao seletiva.

## 9. Preview/Sync

- Nova aba `Sync` com cards para:
  - Precos;
  - Disponibilidade;
  - Fotos;
  - Categorias;
  - Produtos selecionados;
  - Catalogo completo.
- Catalogo completo aparece como acao critica.

## 10. Loja/Status

- Cards para status local, presence iFood e status iFood.
- Acoes de atualizar status, pausar e retomar loja permanecem.

## 11. Erros & Auditoria

- Cards de resumo para erros, eventos com falha, eventos hoje e ultimo ACK.
- Logs ganharam badges e empty state profissional.

## 12. Homologacao

- Checklist visual com progresso estimado.
- Etapas com status:
  - Credencial;
  - Token;
  - Presence;
  - Polling;
  - Webhook;
  - ACK;
  - Duplicidade;
  - Logs sem secrets.

## 13. Credenciais

- Cards com provider, merchantId, clientId mascarado, secret mascarado, token e expiracao.
- Acoes de testar e editar.
- Dados sensiveis seguem mascarados.

## 14. Responsividade

- Cards quebram em grid responsivo.
- Abas usam scroll horizontal.
- Fila tem tabela desktop e cards mobile.
- Modal de detalhes limita altura e permite scroll interno.

## 15. Acessibilidade

- Uso de texto + icone + badge.
- Foco visivel nos controles principais.
- Botao de fechar modal com `aria-label`.
- Labels nos filtros.
- Contraste reforcado em textos e badges.

## 16. Estados loading/erro/vazio

- Skeleton nos cards de saude.
- Card de erro amigavel se dados nao carregarem.
- Empty states para credenciais, fila, pedidos, mapeamento e logs.

## 17. Arquivos alterados

- `frontend-src/pages/admin/IntegrationsPage.jsx`

Este pedido nao alterou infraestrutura, banco ou secrets.

## 18. Testes realizados

- `npm run typecheck:strict`: passou.
- `npm run build`: passou.
- `npx eslint frontend-src/pages/admin/IntegrationsPage.jsx`: sem erros; apenas aviso global da config React.
- `npm run test`: passou, 26 arquivos e 136 testes.
- `npm run test:smoke`: passou.
- `npm run test:e2e`: falhou porque nao existem arquivos em `tests/e2e/**/*.spec.ts`.

## 19. Docker/WSL

- `docker compose ps`: containers rodando.
- `docker compose build api`: passou.
- `docker compose build web`: passou.
- `docker compose up -d --build`: passou.
- `pizzaria_api`: healthy.
- `pizzaria_web`: rodando na porta 80.

## 20. Curls

- `curl -I http://127.0.0.1/`: 200.
- `curl -I http://127.0.0.1/api/status`: 200.
- `curl -i "http://127.0.0.1/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="`: 200.

## 21. Validacao visual

- Login real com `admin@riopizzas.com` abriu `#/admin/integrations`.
- Pagina carregou `Integracao iFood`, cards de saude e abas sem tela branca.
- Captura headless inicial nao registrou erro de console.
- Teste automatizado com sessao injetada navegou parcialmente, mas seletores por texto colidiram com itens da sidebar e geraram 403 fora do fluxo principal; isso foi registrado como limitacao do teste, nao como falha visual confirmada da pagina.

## 22. Confirmacoes

- Secret/token/accessToken/refreshToken nao foram exibidos na interface.
- Nao apareceu `undefined` ou `NaN` nas verificacoes feitas.
- Admin nao quebrou no carregamento da pagina iFood.
- Loja publica e API base seguiram respondendo 200.

## 23. Pendencias

- Criar teste Playwright dedicado para a pagina iFood com seletores `data-testid`.
- Popular listagem dedicada de pedidos iFood quando houver endpoint especifico.
- Implementar mapeamento real local/iFood em fase futura.
- Implementar drawer completo de auditoria com resposta sanitizada quando backend fornecer esse dado.
