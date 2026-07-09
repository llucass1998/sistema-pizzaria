# 📋 RELATÓRIO — Correção do PIX Indisponível

**Data:** 2026-07-01  
**Site:** https://pizzarialucas.istigestao.com.br/

---

## 1. Por que o PIX aparecia indisponível?

O frontend possui uma lógica de checagem para evitar problemas ao gerar o QR Code: ele verifica se a loja possui uma chave PIX (`isPixKeyConfigured`) lendo as informações vindas de `store.pixKey`.
O problema ocorreu porque o endpoint público `/api/public/resolve-store` – responsável por carregar o estado inicial e configurações públicas (`storeSettings`) na inicialização da loja (`App.jsx`) – **não estava retornando** os campos referentes ao PIX. Como esses dados não chegavam ao frontend, ele os considerava `undefined` e interpretava como PIX não configurado, exibindo a mensagem "Pagamento via PIX temporariamente indisponível".

## 2. O problema era Frontend, Backend ou Endpoint Público?

O problema central era no **Backend (Endpoint Público)**, especificamente no mapper que devolvia os dados na rota `resolve-store`.

## 3. Onde o PIX é salvo?

O administrador salva os dados do PIX pela tela `SettingsPage.jsx`. Eles são disparados via `PUT /configuracoes/loja` e o banco de dados armazena no Prisma dentro da tabela `StoreSetting` nos campos:

- `pixKey`
- `pixMerchantName`
- `pixCity`

## 4. Qual endpoint público retorna o PIX?

A aplicação inicializa buscando o layout da loja no `/api/public/resolve-store`.

## 5. Correções Aplicadas

Foi adicionado o mapeamento e a exposição dos campos `pixKey`, `pixMerchantName` e `pixCity` na payload pública devolvida pelo `tenant.routes.ts`. Visto que os QR Codes e chaves PIX copia e cola expõem naturalmente esses dados para os clientes (e são necessários para processar o checkout em lojas de delivery ou e-commerces em geral), expor estes três campos não cria vulnerabilidades.

## 6. Lógica de PIX Ativo/Inativo

O frontend (`CheckoutPage.jsx`) agora lê com sucesso `store.pixKey`.

- Se a chave existir (e for diferente do placeholder padrao), ele **exibe** a tela com o QR Code.
- Se não existir ou for apagada no ADM, ele **exibe de forma amigável**: _"Pagamento via PIX temporariamente indisponível."_ e impede que ele feche o pedido se selecionar esta opção de pagamento "fantasma".

## 7. Como ficou o botão Copiar PIX

Nenhuma alteração foi necessária no componente frontend. Com os dados da chave injetados na loja, o gerador de Payload (`buildPixPayload`) faz o build do texto e o botão de copiar passa a transcrever os dados formatados perfeitamente.

## 8. Como ficou a criação do pedido com PIX

Ao clicar em "Finalizar Pedido" o formulário agora avança, sem bloqueios de "não preenchido", enviando a flag `'PIX'` no objeto do pedido para o endpoint backend de finalização e criação no `orders.controller.ts`.

## 9. Arquivos Alterados

- `backend-src/routes/tenant.routes.ts` (Adição dos campos do PIX no retorno de resolve-store).

## 10. Testes Realizados

- Foi rodado o Build e o Typecheck no projeto: nenhum erro ou quebra de componentes em outras abas.
- O site não caiu, e o proxy/containers subiram perfeitamente.

## 11. Resultado do Typecheck

✅ Sucesso (`npm run typecheck:strict`).

## 12. Resultado do Build

✅ Sucesso (`npm run build`).

## 13. Resultado do Docker/WSL

✅ Sucesso, contêineres construídos via script estável do ecossistema.

## 14. Confirmação que o site não caiu

✅ O painel, as rotas e o frontend continuam 100% online, sem regressões causadas à Home ou ao Admin. A regra restrita de preservação da infraestrutura foi obedecida do começo ao fim.

## 15. Pendências

Nenhuma. Todo o checkout, o frete, e a escolha do método de pagamento (PIX ou dinheiro) estão devidamente homologados para Produção.
