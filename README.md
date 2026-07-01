# Pizzaria

Sistema web para pizzaria com cardapio digital, carrinho, checkout, acompanhamento de pedidos e painel administrativo.

O cliente escolhe pizzas, bebidas, combos e sobremesas, adiciona ao carrinho, finaliza o pedido e acompanha o status. O administrador gerencia produtos, valores, imagens, dados da loja e pedidos.

## Tecnologias

- React
- Vite
- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- Tailwind CSS
- Lucide React

## Funcionalidades

- Cardapio de pizzaria com categorias
- Carrinho com taxa de entrega e taxa de servico
- Adicionais no produto
- Checkout com retirada ou entrega
- Opcoes de pagamento: PIX, dinheiro, debito e credito
- QR Code PIX e copia e cola
- Login e cadastro de cliente
- Conta de administrador
- Painel admin para editar produtos, imagens, valores e dados da loja
- Atualizacao de status do pedido pelo admin
- Acompanhamento do pedido pelo cliente
- Historico de pedidos finalizados
- Botao de WhatsApp e link de localizacao
- Modo escuro

## Como Rodar

Instale as dependencias:

```bash
npm install
```

Crie um `.env` a partir do exemplo:

```bash
cp .env.example .env
```

Configure a URL do banco:

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/pizzaria?schema=public"
```

Gere o Prisma Client:

```bash
npm run prisma:generate
```

Rode as migrations:

```bash
npm run prisma:migrate
```

Suba a API:

```bash
npm run api
```

Suba o frontend em outro terminal:

```bash
npm run dev
```

## Endpoints Principais

- `GET /api/status`
- `GET /api/pizzas`
- `POST /api/pizzas`
- `POST /api/pedidos`
- `GET /api/configuracoes`

## Observacoes

Arquivos sensiveis como `.env` e dados locais nao devem ser versionados.
