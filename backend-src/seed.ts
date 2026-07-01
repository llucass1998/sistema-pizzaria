/**
 * Script de seed para criar dados iniciais e usuarios de teste.
 *
 * Uso: npm run seed
 *
 * Cria:
 *  - Configuracao inicial da loja (upsert)
 *  - 1 administrador de teste
 *  - 1 cliente de teste
 *  - Produtos de exemplo no cardapio (se banco estiver vazio)
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ProductOptionType } from '../generated/prisma/index.js';
import { loadLocalEnv } from './config/loadEnv.js';
import { hashPassword } from './utils/password.js';

loadLocalEnv();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const SAMPLE_CATEGORIES = [
  {
    slug: 'pizzas',
    name: 'Pizzas',
    description: 'Sabores classicos da casa com massa leve e bastante recheio.',
    imageUrl:
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80',
    sortOrder: 10,
    allowSizes: true,
    allowHalfAndHalf: true,
    halfAndHalfGroup: 'pizza-salgada',
  },
  {
    slug: 'pizzas-especiais',
    name: 'Pizzas Especiais',
    description: 'Receitas caprichadas para quem quer sair do basico.',
    imageUrl:
      'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=900&q=80',
    sortOrder: 20,
    allowSizes: true,
    allowHalfAndHalf: true,
    halfAndHalfGroup: 'pizza-salgada',
  },
  {
    slug: 'promocoes',
    name: 'Promocoes',
    description: 'Combos e ofertas para pedir bem sem gastar demais.',
    imageUrl:
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=80',
    sortOrder: 30,
    allowSizes: false,
    allowHalfAndHalf: false,
    halfAndHalfGroup: null,
  },
  {
    slug: 'bebidas',
    name: 'Bebidas',
    description: 'Refrigerantes e bebidas geladas para acompanhar a pizza.',
    imageUrl:
      'https://andinacocacola.vtexassets.com/arquivos/ids/159382-800-auto?aspect=true&height=auto&v=639163193134500000&width=800',
    sortOrder: 40,
    allowSizes: false,
    allowHalfAndHalf: false,
    halfAndHalfGroup: null,
  },
  {
    slug: 'sobremesas',
    name: 'Sobremesas',
    description: 'Doces para fechar o pedido no clima certo.',
    imageUrl:
      'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80',
    sortOrder: 50,
    allowSizes: false,
    allowHalfAndHalf: false,
    halfAndHalfGroup: null,
  },
  {
    slug: 'combos',
    name: 'Combos',
    description: 'Pedidos prontos para dividir com a familia ou amigos.',
    imageUrl:
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
    sortOrder: 60,
    allowSizes: false,
    allowHalfAndHalf: false,
    halfAndHalfGroup: null,
  },
];

// Produtos de exemplo do cardapio.
const SAMPLE_PRODUCTS = [
  {
    name: 'Pizza Margherita',
    category: 'pizzas',
    price: '39.90',
    description: 'Molho de tomate, mussarela e manjericao fresco.',
  },
  {
    name: 'Pizza Calabresa',
    category: 'pizzas',
    price: '42.90',
    description: 'Calabresa fatiada, cebola e azeitonas.',
  },
  {
    name: 'Pizza Quatro Queijos',
    category: 'pizzas',
    price: '46.90',
    description: 'Mussarela, provolone, catupiry e parmesao.',
  },
  {
    name: 'Pizza Portuguesa',
    category: 'pizzas-especiais',
    price: '49.90',
    description: 'Presunto, ovos, cebola, azeitonas e mussarela.',
  },
  {
    name: 'Pizza Frango com Catupiry',
    category: 'pizzas-especiais',
    price: '52.90',
    description: 'Frango desfiado temperado com catupiry cremoso.',
  },
  {
    name: 'Combo Familia 2 Pizzas',
    category: 'combos',
    price: '89.90',
    description: 'Escolha 2 pizzas do cardapio classico.',
  },
  {
    name: 'Combo Pizza + Refrigerante',
    category: 'promocoes',
    price: '59.90',
    description: 'Uma pizza classica + 1 refrigerante lata.',
  },
  {
    name: 'Brownie de Chocolate',
    category: 'sobremesas',
    price: '14.90',
    description: 'Brownie artesanal com calda de chocolate.',
  },
  {
    name: 'Coca-Cola lata 350ml',
    category: 'bebidas',
    price: '7.00',
    description: 'Coca-Cola gelada.',
  },
  {
    name: 'Guarana Antarctica lata 350ml',
    category: 'bebidas',
    price: '7.00',
    description: 'Guarana gelado.',
  },
];

const SAMPLE_INGREDIENTS = [
  { name: 'Mussarela Premium', unit: 'kg', cost: '38.00', stock: '12.50', minStock: '5.00' },
  { name: 'Calabresa Defumada', unit: 'kg', cost: '32.00', stock: '3.00', minStock: '5.00' },
  { name: 'Farinha Italiana 00', unit: 'kg', cost: '7.50', stock: '50.00', minStock: '25.00' },
  { name: 'Molho de Tomate', unit: 'L', cost: '9.00', stock: '8.00', minStock: '10.00' },
  { name: 'Catupiry', unit: 'kg', cost: '24.00', stock: '6.00', minStock: '4.00' },
];

const SAMPLE_OPTIONS = [
  {
    type: ProductOptionType.ADDON,
    name: 'Bacon',
    description: 'Bacon crocante em cubos.',
    price: '5.00',
    sortOrder: 10,
  },
  {
    type: ProductOptionType.ADDON,
    name: 'Cheddar',
    description: 'Porcao extra de cheddar cremoso.',
    price: '4.00',
    sortOrder: 20,
  },
  {
    type: ProductOptionType.ADDON,
    name: 'Queijo extra',
    description: 'Mais mussarela no recheio.',
    price: '4.00',
    sortOrder: 30,
  },
  {
    type: ProductOptionType.ADDON,
    name: 'Calabresa extra',
    description: 'Porcao extra de calabresa.',
    price: '5.00',
    sortOrder: 40,
  },
  {
    type: ProductOptionType.CRUST,
    name: 'Borda Catupiry',
    description: 'Borda recheada com catupiry.',
    price: '8.00',
    sortOrder: 10,
  },
  {
    type: ProductOptionType.CRUST,
    name: 'Borda Cheddar',
    description: 'Borda recheada com cheddar.',
    price: '7.00',
    sortOrder: 20,
  },
  {
    type: ProductOptionType.CRUST,
    name: 'Borda Chocolate',
    description: 'Borda doce recheada com chocolate.',
    price: '9.00',
    sortOrder: 30,
  },
];

const PIZZA_VARIANTS = [
  { code: 'P', name: 'Pequena', offset: 0, sortOrder: 10 },
  { code: 'M', name: 'Media', offset: 8, sortOrder: 20 },
  { code: 'G', name: 'Grande', offset: 16, sortOrder: 30 },
  { code: 'FAMILIA', name: 'Familia', offset: 28, sortOrder: 40 },
];

async function seed() {
  console.log('\n🍕  Iniciando seed da pizzaria...\n');

  // Cria tenant padrao
  let defaultTenant = await prisma.tenant.findFirst();
  if (!defaultTenant) {
    defaultTenant = await prisma.tenant.create({
      data: { name: 'Pizzaria Matriz (Default)', cnpj: '00000000000000' },
    });
  }
  const tId = defaultTenant.id;

  // ─── Configuracoes da loja ──────────────────────────────────────────────────
  const settings = await prisma.storeSetting.upsert({
    where: { tenantId: tId },
    update: {},
    create: {
      tenantId: tId,
      storeName: 'Rio de Janeiro Pizzas',
      hours: '18:00 - 23:30',
      address: 'Av. Principal, 123 – Centro, Rio de Janeiro – RJ',
      phone: '(21) 9999-9999',
      whatsappNumber: '5521999999999',
      pixKey: 'contato@riopizzas.com.br',
      pixMerchantName: 'Rio de Janeiro Pizzas',
      pixCity: 'Rio de Janeiro',
      deliveryFee: '5.00',
      serviceFee: '2.00',
      navbarColor: '#970F0F',
      brandColor: '#970F0F',
    },
  });

  console.log('✅  StoreSetting:', settings.storeName);
  console.log('    Taxa entrega: R$', Number(settings.deliveryFee).toFixed(2));
  console.log('    Taxa servico: R$', Number(settings.serviceFee).toFixed(2));

  // Categorias do cardapio gerenciaveis pelo painel SaaS.
  for (const category of SAMPLE_CATEGORIES) {
    const existingCategory = await prisma.menuCategory.findFirst({
      where: { tenantId: tId, slug: category.slug },
    });

    if (!existingCategory) {
      await prisma.menuCategory.create({
        data: {
          tenantId: tId,
          ...category,
          isActive: true,
        },
      });
    } else if (
      category.allowSizes &&
      !existingCategory.allowSizes &&
      !existingCategory.halfAndHalfGroup
    ) {
      await prisma.menuCategory.update({
        where: { id: existingCategory.id },
        data: {
          allowSizes: category.allowSizes,
          allowHalfAndHalf: category.allowHalfAndHalf,
          halfAndHalfGroup: category.halfAndHalfGroup,
        },
      });
    }
  }

  const menuCategories = await prisma.menuCategory.findMany({
    where: { tenantId: tId },
  });
  const categoryBySlug = new Map(menuCategories.map((category) => [category.slug, category]));

  console.log(`✅  ${menuCategories.length} categoria(s) disponiveis no cardapio.`);

  // Adicionais e bordas gerenciaveis pelo painel.
  for (const option of SAMPLE_OPTIONS) {
    const existingOption = await prisma.productOption.findFirst({
      where: {
        tenantId: tId,
        type: option.type,
        name: option.name,
      },
    });

    if (!existingOption) {
      await prisma.productOption.create({
        data: {
          tenantId: tId,
          ...option,
          isAvailable: true,
        },
      });
    }
  }

  // ─── Administrador permanente ───────────────────────────────────────────────
  const adminEmail = 'admin@riopizzas.com';
  const adminPassword = 'admin123';

  let admin = await prisma.admin.findFirst({ where: { email: adminEmail } });

  if (admin) {
    admin = await prisma.admin.update({
      where: { tenantId_email: { tenantId: tId, email: adminEmail } } as any,
      data: {
        name: 'Administrador ERP',
        passwordHash: await hashPassword(adminPassword),
      },
    });
    console.log('\n♻️   Admin ja existe, senha atualizada:', adminEmail);
  } else {
    admin = await prisma.admin.create({
      data: {
        tenantId: tId,
        name: 'Administrador ERP',
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
      },
    });
    console.log('\n✅  Admin criado:', adminEmail);
  }

  // ─── Cliente de teste ───────────────────────────────────────────────────────
  const customerEmail = 'cliente@teste.com';
  const customerPassword = 'senha123';

  let customer = await prisma.customer.findFirst({ where: { email: customerEmail } });

  if (customer) {
    customer = await prisma.customer.update({
      where: { tenantId_email: { tenantId: tId, email: customerEmail } } as any,
      data: { passwordHash: await hashPassword(customerPassword) },
    });
    console.log('♻️   Cliente ja existe, senha atualizada:', customerEmail);
  } else {
    customer = await prisma.customer.create({
      data: {
        tenantId: tId,
        name: 'João Silva (Teste)',
        email: customerEmail,
        passwordHash: await hashPassword(customerPassword),
        phone: '(21) 98765-4321',
        cpf: '123.456.789-00',
        street: 'Rua das Pizzas',
        neighborhood: 'Copacabana',
        city: 'Rio de Janeiro',
        cep: '22070-010',
      },
    });
    console.log('✅  Cliente criado:', customerEmail);
  }

  // ─── Produtos do cardapio ───────────────────────────────────────────────────
  const existingProductCount = await prisma.product.count();

  if (existingProductCount === 0) {
    for (const product of SAMPLE_PRODUCTS) {
      const category = categoryBySlug.get(product.category);
      await prisma.product.create({
        data: {
          ...product,
          categoryId: category?.id,
          isAvailable: true,
          tenantId: tId,
        },
      });
    }
    console.log(`\n✅  ${SAMPLE_PRODUCTS.length} produtos criados no cardapio.`);
  } else {
    console.log(
      `\nℹ️   Cardapio ja tem ${existingProductCount} produto(s) — nenhum produto criado.`,
    );
  }

  const productsForCategoryLink = await prisma.product.findMany({
    where: { tenantId: tId },
  });

  for (const product of productsForCategoryLink) {
    const normalizedCategory =
      product.category === 'especiais' ? 'pizzas-especiais' : product.category;
    const category = categoryBySlug.get(normalizedCategory);

    if (
      category &&
      (product.categoryId !== category.id || product.category !== normalizedCategory)
    ) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          categoryId: category.id,
          category: normalizedCategory,
        },
      });
    }
  }

  const pizzaProducts = await prisma.product.findMany({
    where: {
      tenantId: tId,
      menuCategory: { allowSizes: true },
    },
    include: { variants: true },
  });

  for (const product of pizzaProducts) {
    if (product.variants.length > 0) {
      continue;
    }

    const basePrice = Number(product.price);
    for (const variant of PIZZA_VARIANTS) {
      await prisma.productVariant.create({
        data: {
          tenantId: tId,
          productId: product.id,
          code: variant.code,
          name: variant.name,
          price: (basePrice + variant.offset).toFixed(2),
          sortOrder: variant.sortOrder,
          isAvailable: true,
        },
      });
    }
  }

  // ─── Insumos de teste ───────────────────────────────────────────────────────
  const existingIngredientCount = await prisma.ingredient.count();

  if (existingIngredientCount === 0) {
    for (const ingredient of SAMPLE_INGREDIENTS) {
      await prisma.ingredient.create({
        data: { ...ingredient, tenantId: tId },
      });
    }
    console.log(`✅  ${SAMPLE_INGREDIENTS.length} insumos criados no estoque.`);
  } else {
    console.log(`ℹ️   Estoque ja tem ${existingIngredientCount} insumo(s) — nenhum insumo criado.`);
  }

  // ─── Pedido demo para KDS e faturamento ────────────────────────────────────
  const existingOrderCount = await prisma.order.count();

  if (existingOrderCount === 0) {
    const demoProducts = await prisma.product.findMany({
      where: { tenantId: tId, isAvailable: true },
      orderBy: { createdAt: 'asc' },
      take: 2,
    });

    if (demoProducts.length > 0) {
      const subtotal = demoProducts.reduce((sum, product) => sum + Number(product.price), 0);

      const order = await prisma.order.create({
        data: {
          tenantId: tId,
          customerId: customer.id,
          fulfillmentType: 'PICKUP',
          status: 'PENDING',
          subtotal: subtotal.toFixed(2),
          deliveryFee: '0.00',
          total: subtotal.toFixed(2),
          notes: 'Balcao | Pedido demo para teste',
          items: {
            create: demoProducts.map((product) => ({
              productId: product.id,
              displayName: product.name,
              imageUrl: product.imageUrl,
              quantity: 1,
              unitPrice: Number(product.price).toFixed(2),
              total: Number(product.price).toFixed(2),
            })),
          },
        },
      });

      await prisma.invoice.create({
        data: {
          tenantId: tId,
          orderId: order.id,
          totalAmount: subtotal.toFixed(2),
          status: 'PAID',
          payments: {
            create: {
              amount: subtotal.toFixed(2),
              method: 'PIX',
              status: 'COMPLETED',
            },
          },
        },
      });

      console.log('✅  Pedido demo criado para KDS/faturamento.');
    }
  } else {
    console.log(`ℹ️   Ja existem ${existingOrderCount} pedido(s) — nenhum pedido demo criado.`);
  }

  // ─── Resumo ─────────────────────────────────────────────────────────────────
  const [
    totalProducts,
    totalCategories,
    totalOptions,
    totalCustomers,
    totalAdmins,
    totalIngredients,
    totalOrders,
  ] = await Promise.all([
    prisma.product.count({ where: { isAvailable: true } }),
    prisma.menuCategory.count({ where: { isActive: true } }),
    prisma.productOption.count({ where: { isAvailable: true } }),
    prisma.customer.count(),
    prisma.admin.count(),
    prisma.ingredient.count(),
    prisma.order.count(),
  ]);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🍕  Banco de dados — Resumo

  Produtos disponiveis : ${totalProducts}
  Categorias ativas    : ${totalCategories}
  Adicionais/bordas    : ${totalOptions}
  Insumos cadastrados  : ${totalIngredients}
  Pedidos cadastrados  : ${totalOrders}
  Clientes cadastrados : ${totalCustomers}
  Administradores      : ${totalAdmins}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔐  Credenciais para teste

  ADMIN
  Email   : ${adminEmail}
  Senha   : ${adminPassword}
  Acesso  : /#/admin

  CLIENTE
  Email   : ${customerEmail}
  Senha   : ${customerPassword}
  Acesso  : Login no site
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

seed()
  .catch((error) => {
    console.error('\n❌  Erro no seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
