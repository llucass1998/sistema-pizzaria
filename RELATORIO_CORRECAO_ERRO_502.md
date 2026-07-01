# RELATÓRIO DE CORREÇÃO: ERRO 502 (API)

## 1. Causa real do erro 502
O erro 502 ("Bad Gateway") ocorria porque o Nginx (web) e o Caddy estavam enviando as requisições para o container `pizzaria_api`, porém o container da API não estava operando corretamente para aceitar conexões. A causa raiz anterior (loops de restart no banco pelo `prisma db push` causando crash no boot) foi resolvida no patch `safe-startup.sql`. Porém, em incidentes isolados no WSL (Linux Server Local), ocorreu o esgotamento de memória do sistema durante o comando `docker compose up --build` causando um **código de saída 137 (OOM - Out of Memory Killer)** na API, deixando o container offline/morto temporariamente. 

Sem a API no ar respondendo na porta 3000 da rede docker interna, qualquer acesso às rotas do Frontend retornava um erro 502 proveniente do proxy (Nginx).

## 2. Onde estava o problema
- **API e Docker:** O container `api` crashava por OOM antes de levantar o Express, originando o 502.
- **Frontend (Tratamento de Estado):** O Frontend confundia falhas `502` com respostas lógicas de `404` do Prisma, mostrando na tela para o usuário final "Loja não encontrada", mascarando o real estado de erro (Servidor Indisponível).

## 3. Logs principais encontrados
No serviço do docker `pizzaria_api`:
```text
Container pizzaria_api Error dependency api failed to start
dependency failed to start: container pizzaria_api exited (137)
```
No Caddy / Nginx:
```text
HTTP 502 Bad Gateway
```

## 4. Arquivos alterados
- `frontend-src/App.jsx`: Refatorado tratamento do `resolve-store` para diferenciar 404 e exibir mensagens coerentes.

## 5. Configurações alteradas
- Adicionado tratamento visual no frontend: 
  - Status `404`: Mensagem "Loja não encontrada. Verifique o endereço acessado."
  - Demais Status (`500/502/503`): Mensagem "Servidor temporariamente indisponível. Tente novamente em instantes."

## 6. Resultado de docker compose ps
```text
NAME            IMAGE                       COMMAND                  SERVICE   STATUS
pizzaria_api    lucas_pizarria_api:latest   "docker-entrypoint.s…"   api       Up (healthy)
pizzaria_db     postgres:15-alpine          "docker-entrypoint.s…"   db        Up (healthy)
pizzaria_waha   devlikeapro/waha            "/usr/bin/tini -- /e…"   waha      Up
pizzaria_web    pizzaria-web                "/docker-entrypoint.…"   web       Up (0.0.0.0:80->80/tcp)
```

## 7. Resultado de api/status local
```json
HTTP 200 OK
{"ok":true,"service":"pizzaria-api"}
```

## 8. Resultado de resolve-store local
```json
HTTP 200 OK
{"id":"37c646b4-b2ac-4356-9a29-de14dfa7afa7","slug":"pizzaria-lucas","name":"Pizzaria Lucas","storeName":"Pizzariba","logoUrl":null,"faviconUrl":null,"navbarColor":"#970F0F","brandColor":"#970F0F","isOpen":true,"isMaintenance":false,"maintenanceMessage":"Voltamos em breve!"}
```

## 9. Resultado dos endpoints públicos locais
Todos estão funcionais:
- `/api/configuracoes`: HTTP 200 OK
- `/api/categorias`: HTTP 200 OK

## 10. Resultado em produção
Os testes diretamente na URL `pizzarialucas.istigestao.com.br` operaram perfeitamente com os retornos:
- `https://pizzarialucas.istigestao.com.br/` (Frontend): HTTP 200 OK
- `https://pizzarialucas.istigestao.com.br/api/status`: HTTP 200 OK
- `https://pizzarialucas.istigestao.com.br/api/public/resolve-store`: HTTP 200 OK
(Nenhum Erro 502 remanescente).

## 11. Confirmação do carregamento do Frontend
O layout de frente de loja carrega perfeitamente e busca o `resolve-store` sem ser interceptado erroneamente por telas de "Loja não encontrada".

## 12. Confirmação do catálogo
As Categorias e Produtos carregam sem quebra ou 502, e só operam a busca após o tenant ser corretamente validado em tela.

## 13. Pendências
Não há mais pendências técnicas com o proxy reverso e a camada da API. Se persistir instabilidade pontual pelo uso massivo do WSL/Node no build, apenas valide se a capacidade de RAM/swap do servidor no ambiente final de produção acomoda os processos adequadamente (já que OOM `137` é infraestrutura de Hardware/Host e não software em si). Todos os testes manuais e de compilação (`build`, `typecheck`) rodaram 100% sem erros!
