# 🍕 Sistema Pizzaria Lucas — ERP/Delivery Full Stack

Sistema web full stack para pizzarias, restaurantes e operações de delivery, com **frente de loja**, **cardápio digital**, **carrinho**, **checkout**, **acompanhamento de pedidos** e **painel administrativo**.

🔗 **Projeto em produção:** [https://pizzarialucas.istigestao.com.br/](https://pizzarialucas.istigestao.com.br/)

---

## 📌 Sobre o projeto

O **Sistema Pizzaria Lucas** foi desenvolvido como um projeto full stack completo para simular e apoiar a operação de uma pizzaria moderna.

A aplicação permite que o cliente visualize o cardápio, escolha produtos, adicione itens ao carrinho, selecione forma de entrega ou retirada e finalize o pedido. No painel administrativo, a loja pode gerenciar produtos, imagens, preços, dados da loja, pedidos, status e rotinas operacionais.

O projeto também possui estrutura voltada para evolução comercial, incluindo módulos e bases para financeiro, logística/entregadores, campanhas, testes automatizados e deploy com Docker.

---

## 🚀 Funcionalidades

### Frente de loja

- Cardápio digital com categorias.
- Produtos com adicionais.
- Carrinho de compras.
- Taxa de entrega e taxa de serviço.
- Checkout com retirada ou entrega.
- Opções de pagamento: PIX, dinheiro, débito e crédito.
- QR Code PIX e código copia e cola.
- Login e cadastro de cliente.
- Acompanhamento do status do pedido.
- Histórico de pedidos finalizados.
- Botão de WhatsApp e link de localização.
- Modo escuro.

### Painel administrativo

- Conta de administrador.
- Gestão de produtos, imagens, valores e dados da loja.
- Gerenciamento e atualização de status dos pedidos.
- Estrutura para rotinas comerciais e operacionais.
- Base para financeiro, logística, entregadores e campanhas.

### Qualidade e produção

- API REST integrada ao frontend.
- Banco de dados relacional com PostgreSQL.
- ORM com Prisma.
- Validação e tipagem com TypeScript.
- Scripts para build, testes, typecheck e migrations.
- Estrutura Docker para ambiente de deploy.

---

## 🛠️ Tecnologias utilizadas

### Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- React Router DOM
- Zustand
- React Hook Form
- Zod
- Lucide React
- Recharts
- React Hot Toast

### Backend

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT
- Cookie Parser
- Multer
- Node Cron
- QRCode

### Testes e qualidade

- Vitest
- Playwright
- Supertest
- TypeScript Strict Check
- Prettier

### Infraestrutura

- Docker
- Docker Compose
- Nginx/Caddy conforme ambiente
- PostgreSQL em container
- Deploy em domínio próprio

---

## 🧱 Estrutura geral

```text
backend-src/       # API Node.js/Express, rotas, services e regras de negócio
frontend-src/      # Aplicação React/Vite, páginas e componentes
prisma/            # Schema, migrations e configuração do banco
scripts/           # Scripts de suporte, testes e automação
docker-compose.yml # Orquestração dos serviços
```

---

## 📦 Como rodar localmente com Docker/WSL

Clone o repositório:

```bash
git clone https://github.com/llucass1998/sistema-pizzaria.git
cd sistema-pizzaria
```

Este projeto deve rodar Node, npm, Prisma, testes e scripts dentro de containers. Evite executar `npm`, `node`, `npx`, `prisma`, `vite` ou `vitest` diretamente no Windows/PowerShell.

Suba o ambiente de desenvolvimento isolado (`db-dev`, `waha-dev`, `api-dev`, `web-dev`, volumes `pizzaria_dev_*`):

```bash
bash scripts/dev.sh up
```

Execute comandos npm dentro do container `tools`:

```bash
bash scripts/dev.sh npm run typecheck:strict
bash scripts/dev.sh npm run test:api
bash scripts/dev.sh npm run build
bash scripts/dev.sh npm run build:api
```

Execute Prisma dentro do container:

```bash
bash scripts/dev.sh prisma generate
bash scripts/dev.sh prisma migrate deploy
```

Abra um shell Linux isolado do projeto:

```bash
bash scripts/dev.sh shell
```

Para rebuild/redeploy local sem remover banco ou volumes:

```bash
bash scripts/compose-redeploy.sh
```

Nunca use `docker compose down -v` neste projeto sem backup e aprovação explícita.

---

## 🧪 Scripts disponíveis

Rode os scripts sempre via container:

```bash
bash scripts/dev.sh npm run dev                # Inicia o frontend com Vite dentro do container
bash scripts/dev.sh npm run api                # Inicia a API Node.js/Express dentro do container
bash scripts/dev.sh npm run build              # Gera build do frontend
bash scripts/dev.sh npm run build:api          # Compila a API TypeScript
bash scripts/dev.sh npm run typecheck:strict   # Validação TypeScript rigorosa
bash scripts/dev.sh npm run test               # Executa testes com Vitest
bash scripts/dev.sh npm run test:api           # Executa testes da API
bash scripts/dev.sh npm run test:e2e           # Executa testes e2e
bash scripts/dev.sh npm run test:smoke         # Executa smoke tests
bash scripts/dev.sh npm run test:all           # Typecheck + testes + build
bash scripts/dev.sh npm run prisma:generate    # Gera Prisma Client
bash scripts/dev.sh npm run prisma:migrate     # Executa migrations em desenvolvimento
bash scripts/dev.sh npm run prisma:deploy      # Aplica migrations em produção
```

---

## 🔌 Endpoints principais

```text
GET  /api/status
GET  /api/pizzas
POST /api/pizzas
POST /api/pedidos
GET  /api/configuracoes
```

---

## 🧠 Aprendizados aplicados

- Organização de projeto full stack em uma única base.
- Integração entre frontend React e API Express.
- Modelagem relacional com Prisma e PostgreSQL.
- Separação de responsabilidades entre rotas, services e banco de dados.
- Construção de interface administrativa.
- Fluxo de compra com carrinho e checkout.
- Preparação para deploy com Docker.
- Testes e validação de build.

---

## ⚠️ Observação técnica

Este projeto possui estrutura para evolução comercial. Para uso real em produção, módulos como pagamento online, fiscal/NFC-e e webhooks devem ser configurados com provedores reais, credenciais válidas, validação de assinatura e ambiente seguro.

Arquivos sensíveis como `.env`, credenciais, chaves privadas e dados locais não devem ser versionados.

---

## 👨‍💻 Autor

Desenvolvido por **Lucas de Souza Furtado Mendonça**.

- GitHub: [github.com/llucass1998](https://github.com/llucass1998)
- LinkedIn: [Lucas Souza](https://www.linkedin.com/in/lucas-souza-52422b160/)
- Portfólio: [portfolio-lucas-jumw.vercel.app](https://portfolio-lucas-jumw.vercel.app/)
- Projeto online: [pizzarialucas.istigestao.com.br](https://pizzarialucas.istigestao.com.br/)
