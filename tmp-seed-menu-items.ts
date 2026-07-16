import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ProductOptionType } from './generated/prisma/index.js';
import { loadLocalEnv } from './backend-src/config/loadEnv.js';

loadLocalEnv();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const categories = [
  {
    slug: 'pizzas-tradicionais',
    name: 'Pizzas Tradicionais',
    description: 'Sabores tradicionais da casa com massa leve, bastante recheio e molho especial.',
    sortOrder: 10,
    allowSizes: true,
    allowHalfAndHalf: true,
    halfAndHalfGroup: 'pizza-salgada',
  },
  {
    slug: 'pizzas-doces',
    name: 'Pizzas Doces',
    description:
      'Deliciosas receitas doces com ingredientes selecionados para sobremesa ou lanche.',
    sortOrder: 20,
    allowSizes: true,
    allowHalfAndHalf: true,
    halfAndHalfGroup: 'pizza-doce',
  },
  {
    slug: 'refrigerantes',
    name: 'Refrigerantes',
    description: 'Refrigerantes e bebidas geladas na medida certa para acompanhar sua pizza.',
    sortOrder: 30,
    allowSizes: false,
    allowHalfAndHalf: false,
    halfAndHalfGroup: null,
  },
];

const products = [
  {
    name: 'Pizza Mussarela',
    category: 'pizzas-tradicionais',
    price: '40.90',
    description: 'Molho de tomate artesanal, mussarela derretida, azeitonas e orégano.',
  },
  {
    name: 'Pizza Napolitana',
    category: 'pizzas-tradicionais',
    price: '44.90',
    description: 'Mussarela, tomate, parmesão ralado, alho frito e orégano.',
  },
  {
    name: 'Pizza Toscana',
    category: 'pizzas-tradicionais',
    price: '47.90',
    description: 'Calabresa moída, mussarela, cebola, azeitonas e orégano.',
  },
  {
    name: 'Pizza Bacon',
    category: 'pizzas-tradicionais',
    price: '49.90',
    description: 'Mussarela, bacon crocante, tomate em cubos e orégano.',
  },
  {
    name: 'Pizza Milho com Catupiry',
    category: 'pizzas-tradicionais',
    price: '46.90',
    description: 'Mussarela, milho verde, catupiry cremoso e orégano.',
  },
  {
    name: 'Pizza Brigadeiro com Morango',
    category: 'pizzas-doces',
    price: '45.90',
    description:
      'Delicioso creme de brigadeiro artesanal, granulado gourmet e morangos frescos fatiados.',
  },
  {
    name: 'Pizza Banana com Canela e Leite Condensado',
    category: 'pizzas-doces',
    price: '42.90',
    description: 'Fatias de banana com açúcar, canela e leite condensado.',
  },
  {
    name: 'Pizza Romeu e Julieta',
    category: 'pizzas-doces',
    price: '44.90',
    description: 'Goiabada cremosa com generosas fatias de queijo minas.',
  },
  {
    name: 'Pizza Chocolate com Confete',
    category: 'pizzas-doces',
    price: '43.90',
    description: 'Creme de chocolate, confeitos coloridos e finalização com leite condensado.',
  },
  {
    name: 'Pizza Prestígio',
    category: 'pizzas-doces',
    price: '46.90',
    description: 'Chocolate cremoso, coco ralado e leite condensado sobre massa levemente assada.',
  },
  {
    name: 'Pizza Doce de Leite com Banana',
    category: 'pizzas-doces',
    price: '45.90',
    description: 'Doce de leite, banana fatiada, açúcar e canela.',
  },
  {
    name: 'Pizza Chocolate Branco com Morango',
    category: 'pizzas-doces',
    price: '47.90',
    description: 'Chocolate branco cremoso, morangos frescos e raspas de chocolate.',
  },
  {
    name: 'Fanta Laranja lata 350ml',
    category: 'refrigerantes',
    price: '7.00',
    description: 'Refrigerante Fanta Laranja lata 350ml extremamente gelado.',
  },
  {
    name: 'Fanta Uva lata 350ml',
    category: 'refrigerantes',
    price: '7.00',
    description: 'Refrigerante Fanta Uva lata 350ml extremamente gelado.',
  },
  {
    name: 'Sprite lata 350ml',
    category: 'refrigerantes',
    price: '7.00',
    description: 'Refrigerante Sprite lata 350ml extremamente gelado.',
  },
  {
    name: 'Pepsi Garrafa 2L',
    category: 'refrigerantes',
    price: '13.00',
    description: 'Refrigerante Pepsi Garrafa de 2 Litros para acompanhar pizzas grandes.',
  },
];

const variants = [
  { code: 'P', name: 'Pequena', offset: 0, sortOrder: 10 },
  { code: 'M', name: 'Media', offset: 8, sortOrder: 20 },
  { code: 'G', name: 'Grande', offset: 16, sortOrder: 30 },
  { code: 'FAMILIA', name: 'Familia', offset: 28, sortOrder: 40 },
];

const crusts = [
  {
    name: 'Borda Catupiry',
    description: 'Borda recheada com catupiry.',
    price: '8.00',
    sortOrder: 10,
  },
  {
    name: 'Borda Cheddar',
    description: 'Borda recheada com cheddar.',
    price: '7.00',
    sortOrder: 20,
  },
  {
    name: 'Borda Chocolate',
    description: 'Borda doce recheada com chocolate.',
    price: '9.00',
    sortOrder: 30,
  },
  {
    name: 'Borda Cream Cheese',
    description: 'Borda recheada com cream cheese.',
    price: '9.00',
    sortOrder: 40,
  },
  {
    name: 'Borda Doce de Leite',
    description: 'Borda doce recheada com doce de leite.',
    price: '9.00',
    sortOrder: 50,
  },
];

async function main() {
  const tenant = process.env.SEED_TENANT_ID
    ? await prisma.tenant.findFirst({ where: { id: process.env.SEED_TENANT_ID } })
    : await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!tenant) throw new Error('Nenhum tenant encontrado.');

  const categoryBySlug = new Map<
    string,
    { id: string; slug: string; allowSizes: boolean | null }
  >();
  for (const category of categories) {
    const saved = await prisma.menuCategory.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: category.slug } },
      update: {
        name: category.name,
        description: category.description,
        isActive: true,
        allowSizes: category.allowSizes,
        allowHalfAndHalf: category.allowHalfAndHalf,
        halfAndHalfGroup: category.halfAndHalfGroup,
      },
      create: { tenantId: tenant.id, isActive: true, ...category },
    });
    categoryBySlug.set(saved.slug, saved);
  }

  let createdProducts = 0;
  for (const product of products) {
    const category = categoryBySlug.get(product.category);
    if (!category) throw new Error(`Categoria não encontrada: ${product.category}`);

    const existing = await prisma.product.findFirst({
      where: { tenantId: tenant.id, name: product.name },
    });
    const saved = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: {
            categoryId: category.id,
            category: category.slug,
            description: product.description,
            price: product.price,
            isAvailable: true,
          },
        })
      : await prisma.product.create({
          data: {
            tenantId: tenant.id,
            categoryId: category.id,
            category: category.slug,
            name: product.name,
            description: product.description,
            price: product.price,
            isAvailable: true,
          },
        });

    if (!existing) createdProducts++;

    if (category.allowSizes) {
      for (const variant of variants) {
        await prisma.productVariant.upsert({
          where: { productId_code: { productId: saved.id, code: variant.code } },
          update: {
            name: variant.name,
            price: (Number(product.price) + variant.offset).toFixed(2),
            sortOrder: variant.sortOrder,
            isAvailable: true,
          },
          create: {
            tenantId: tenant.id,
            productId: saved.id,
            code: variant.code,
            name: variant.name,
            price: (Number(product.price) + variant.offset).toFixed(2),
            sortOrder: variant.sortOrder,
            isAvailable: true,
          },
        });
      }
    }
  }

  let createdCrusts = 0;
  for (const crust of crusts) {
    const existing = await prisma.productOption.findFirst({
      where: { tenantId: tenant.id, type: ProductOptionType.CRUST, name: crust.name },
    });
    if (existing) {
      await prisma.productOption.update({
        where: { id: existing.id },
        data: { ...crust, isAvailable: true },
      });
    } else {
      await prisma.productOption.create({
        data: { tenantId: tenant.id, type: ProductOptionType.CRUST, ...crust, isAvailable: true },
      });
      createdCrusts++;
    }
  }

  console.log(
    JSON.stringify(
      {
        tenant: tenant.name,
        createdProducts,
        totalProductsHandled: products.length,
        createdCrusts,
        totalCrustsHandled: crusts.length,
      },
      null,
      2,
    ),
  );
}

main().finally(async () => prisma.$disconnect());
