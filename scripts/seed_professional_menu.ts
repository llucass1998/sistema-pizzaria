import { basePrisma as prisma } from '../backend-src/lib/prisma.js';

async function main() {
  console.log('Iniciando script de seed de cardápio profissional...');

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('Nenhum tenant encontrado. Rode a seed de tenant primeiro.');
    process.exit(1);
  }
  const tenantId = tenant.id;

  console.log(`Limpando cardápio e pedidos existentes para o tenant: ${tenant.name}...`);
  // Deletar os pedidos e itens para evitar restrições de chave estrangeira (P2003)
  await prisma.orderItem.deleteMany({ where: { product: { tenantId } } });
  await prisma.order.deleteMany({ where: { tenantId } });
  await prisma.product.deleteMany({ where: { tenantId } });
  await prisma.menuCategory.deleteMany({ where: { tenantId } });

  console.log('Criando categorias de cardápio...');
  const catPizzasSalgadas = await prisma.menuCategory.create({
    data: {
      tenantId,
      name: 'Pizzas Tradicionais',
      slug: 'pizzas-tradicionais',
      sortOrder: 1,
      isActive: true,
      allowHalfAndHalf: true,
      halfAndHalfGroup: 'pizzas',

      prepTimeMinutes: 20
    }
  });

  const catPizzasEspeciais = await prisma.menuCategory.create({
    data: {
      tenantId,
      name: 'Pizzas Especiais',
      slug: 'pizzas-especiais',
      sortOrder: 2,
      isActive: true,
      allowHalfAndHalf: true,
      halfAndHalfGroup: 'pizzas',

      prepTimeMinutes: 25
    }
  });

  const catBebidas = await prisma.menuCategory.create({
    data: {
      tenantId,
      name: 'Bebidas',
      slug: 'bebidas',
      sortOrder: 3,
      isActive: true,
      allowHalfAndHalf: false,

      prepTimeMinutes: 2
    }
  });

  const catSobremesas = await prisma.menuCategory.create({
    data: {
      tenantId,
      name: 'Sobremesas',
      slug: 'sobremesas',
      sortOrder: 4,
      isActive: true,
      allowHalfAndHalf: false,

      prepTimeMinutes: 5
    }
  });

  console.log('Criando produtos reais...');

  const produtos = [
    // PIZZAS TRADICIONAIS
    {
      tenantId,
      categoryId: catPizzasSalgadas.id,
      name: 'Pizza Calabresa',
      description: 'Mussarela, calabresa fatiada, cebola e orégano.',
      price: 45.90,
      category: 'pizzas',

      imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catPizzasSalgadas.id,
      name: 'Pizza Marguerita',
      description: 'Mussarela, tomate fatiado, folhas de manjericão fresco e orégano.',
      price: 42.90,
      category: 'pizzas',

      imageUrl: 'https://images.unsplash.com/photo-1573821663912-569905455b1c?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catPizzasSalgadas.id,
      name: 'Pizza Portuguesa',
      description: 'Mussarela, presunto, ovos, cebola, ervilha, palmito, azeitonas e orégano.',
      price: 48.90,
      category: 'pizzas',

      imageUrl: 'https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catPizzasSalgadas.id,
      name: 'Pizza Frango com Catupiry',
      description: 'Mussarela, frango desfiado temperado, legítimo Catupiry e orégano.',
      price: 47.90,
      category: 'pizzas',

      imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catPizzasSalgadas.id,
      name: 'Pizza Mussarela',
      description: 'Molho de tomate artesanal, mussarela derretida, azeitonas e orégano.',
      price: 40.90,
      category: 'pizzas',

      imageUrl: 'https://images.unsplash.com/photo-1601924582970-9238bcb495d9?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catPizzasSalgadas.id,
      name: 'Pizza Napolitana',
      description: 'Mussarela, tomate, parmesão ralado, alho frito e orégano.',
      price: 44.90,
      category: 'pizzas',

      imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catPizzasSalgadas.id,
      name: 'Pizza Toscana',
      description: 'Calabresa moída, mussarela, cebola, azeitonas e orégano.',
      price: 47.90,
      category: 'pizzas',

      imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catPizzasSalgadas.id,
      name: 'Pizza Bacon',
      description: 'Mussarela, bacon crocante, tomate em cubos e orégano.',
      price: 49.90,
      category: 'pizzas',

      imageUrl: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catPizzasSalgadas.id,
      name: 'Pizza Milho com Catupiry',
      description: 'Mussarela, milho verde, catupiry cremoso e orégano.',
      price: 46.90,
      category: 'pizzas',

      imageUrl: 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=500&auto=format&fit=crop&q=60'
    },
    // PIZZAS ESPECIAIS
    {
      tenantId,
      categoryId: catPizzasEspeciais.id,
      name: 'Pizza Pepperoni Especial',
      description: 'Mussarela, dupla camada de pepperoni, cream cheese e orégano.',
      price: 58.90,
      category: 'pizzas',

      imageUrl: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catPizzasEspeciais.id,
      name: 'Pizza 4 Queijos Premium',
      description: 'Mussarela, provolone, gorgonzola, parmesão e toque de azeite trufado.',
      price: 62.90,
      category: 'pizzas',

      imageUrl: 'https://images.unsplash.com/photo-1588315029754-2dd089d39a1a?w=500&auto=format&fit=crop&q=60'
    },
    // BEBIDAS
    {
      tenantId,
      categoryId: catBebidas.id,
      name: 'Coca-Cola 2L',
      description: 'Refrigerante Coca-Cola Garrafa 2 Litros.',
      price: 14.90,
      category: 'bebidas',

      imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catBebidas.id,
      name: 'Guaraná Antarctica 2L',
      description: 'Refrigerante Guaraná Antarctica Garrafa 2 Litros.',
      price: 12.90,
      category: 'bebidas',

      imageUrl: 'https://images.unsplash.com/photo-1625772299848-391b6a51820e?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catBebidas.id,
      name: 'Fanta Laranja 2L',
      description: 'Refrigerante Fanta Laranja Garrafa 2 Litros.',
      price: 12.90,
      category: 'bebidas',

      imageUrl: 'https://images.unsplash.com/photo-1625772299848-391b6a51820e?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catBebidas.id,
      name: 'Fanta Uva 2L',
      description: 'Refrigerante Fanta Uva Garrafa 2 Litros.',
      price: 12.90,
      category: 'bebidas',

      imageUrl: 'https://images.unsplash.com/photo-1625772299848-391b6a51820e?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catBebidas.id,
      name: 'Sprite 2L',
      description: 'Refrigerante Sprite Garrafa 2 Litros.',
      price: 12.90,
      category: 'bebidas',

      imageUrl: 'https://images.unsplash.com/photo-1625772299848-391b6a51820e?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catBebidas.id,
      name: 'Pepsi 2L',
      description: 'Refrigerante Pepsi Garrafa 2 Litros.',
      price: 13.90,
      category: 'bebidas',

      imageUrl: 'https://images.unsplash.com/photo-1625772299848-391b6a51820e?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catBebidas.id,
      name: 'Heineken Long Neck',
      description: 'Cerveja Heineken 330ml bem gelada.',
      price: 12.00,
      category: 'bebidas',

      imageUrl: 'https://images.unsplash.com/photo-1614316315228-56961cc24a3e?w=500&auto=format&fit=crop&q=60'
    },
    // PIZZAS DOCES
    {
      tenantId,
      categoryId: catSobremesas.id,
      name: 'Pizza Doce de Chocolate com Morango',
      description: 'Massa fina, creme de avelã com cacau e morangos frescos fatiados.',
      price: 52.90,
      category: 'sobremesas',

      imageUrl: 'https://images.unsplash.com/photo-1528137871618-79d2761e3fd5?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catSobremesas.id,
      name: 'Pizza Banana com Canela e Leite Condensado',
      description: 'Banana fatiada, açúcar, canela e leite condensado gratinado.',
      price: 42.90,
      category: 'sobremesas',

      imageUrl: 'https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catSobremesas.id,
      name: 'Pizza Romeu e Julieta',
      description: 'Goiabada cremosa com queijo minas derretido.',
      price: 44.90,
      category: 'sobremesas',

      imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catSobremesas.id,
      name: 'Pizza Prestígio',
      description: 'Chocolate cremoso, coco ralado e leite condensado.',
      price: 46.90,
      category: 'sobremesas',

      imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&auto=format&fit=crop&q=60'
    },
    {
      tenantId,
      categoryId: catSobremesas.id,
      name: 'Pizza Chocolate Branco com Morango',
      description: 'Chocolate branco cremoso, morangos frescos e raspas de chocolate.',
      price: 47.90,
      category: 'sobremesas',

      imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&auto=format&fit=crop&q=60'
    }
  ];

  let count = 0;
  for (const prod of produtos) {
    await prisma.product.create({ data: prod });
    count++;
  }

  console.log(`Sucesso! ${count} produtos profissionais inseridos no banco.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
