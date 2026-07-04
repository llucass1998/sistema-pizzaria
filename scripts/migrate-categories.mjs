import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/index.js';
import dotenv from 'dotenv';
dotenv.config();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔄 Iniciando migração de categorias para os 3 pilares principais...');

  const tenants = await prisma.tenant.findMany();
  for (const tenant of tenants) {
    const tId = tenant.id;
    console.log(`\n🏢 Processando tenant: ${tenant.name} (${tId})`);

    const existingCats = await prisma.menuCategory.findMany({ where: { tenantId: tId } });
    const catBySlug = new Map(existingCats.map((c) => [c.slug, c]));

    // 1. Pizzas Tradicionais
    let catTradicionais = catBySlug.get('pizzas-tradicionais');
    if (!catTradicionais) {
      const catPizzas = catBySlug.get('pizzas');
      if (catPizzas) {
        console.log('   -> Renomeando categoria "pizzas" para "pizzas-tradicionais"...');
        catTradicionais = await prisma.menuCategory.update({
          where: { id: catPizzas.id },
          data: {
            slug: 'pizzas-tradicionais',
            name: 'Pizzas Tradicionais',
            description: 'Sabores tradicionais da casa com massa leve, bastante recheio e molho especial.',
            allowSizes: true,
            allowHalfAndHalf: true,
            halfAndHalfGroup: 'pizza-salgada',
            sortOrder: 10,
            isActive: true,
          },
        });
      } else {
        console.log('   -> Criando categoria "pizzas-tradicionais"...');
        catTradicionais = await prisma.menuCategory.create({
          data: {
            tenantId: tId,
            slug: 'pizzas-tradicionais',
            name: 'Pizzas Tradicionais',
            description: 'Sabores tradicionais da casa com massa leve, bastante recheio e molho especial.',
            imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80',
            allowSizes: true,
            allowHalfAndHalf: true,
            halfAndHalfGroup: 'pizza-salgada',
            sortOrder: 10,
            isActive: true,
          },
        });
      }
    }

    // 2. Pizzas Doces
    let catDoces = catBySlug.get('pizzas-doces');
    if (!catDoces) {
      const catSobremesas = catBySlug.get('sobremesas');
      if (catSobremesas) {
        console.log('   -> Renomeando categoria "sobremesas" para "pizzas-doces"...');
        catDoces = await prisma.menuCategory.update({
          where: { id: catSobremesas.id },
          data: {
            slug: 'pizzas-doces',
            name: 'Pizzas Doces',
            description: 'Deliciosa seleção de pizzas doces para sobremesa ou lanche.',
            allowSizes: true,
            allowHalfAndHalf: true,
            halfAndHalfGroup: 'pizza-doce',
            sortOrder: 20,
            isActive: true,
          },
        });
      } else {
        console.log('   -> Criando categoria "pizzas-doces"...');
        catDoces = await prisma.menuCategory.create({
          data: {
            tenantId: tId,
            slug: 'pizzas-doces',
            name: 'Pizzas Doces',
            description: 'Deliciosa seleção de pizzas doces para sobremesa ou lanche.',
            imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80',
            allowSizes: true,
            allowHalfAndHalf: true,
            halfAndHalfGroup: 'pizza-doce',
            sortOrder: 20,
            isActive: true,
          },
        });
      }
    }

    // 3. Refrigerantes
    let catRefrigerantes = catBySlug.get('refrigerantes');
    if (!catRefrigerantes) {
      const catBebidas = catBySlug.get('bebidas');
      if (catBebidas) {
        console.log('   -> Renomeando categoria "bebidas" para "refrigerantes"...');
        catRefrigerantes = await prisma.menuCategory.update({
          where: { id: catBebidas.id },
          data: {
            slug: 'refrigerantes',
            name: 'Refrigerantes',
            description: 'Refrigerantes gelados na medida certa para acompanhar sua pizza.',
            allowSizes: false,
            allowHalfAndHalf: false,
            halfAndHalfGroup: null,
            sortOrder: 30,
            isActive: true,
          },
        });
      } else {
        console.log('   -> Criando categoria "refrigerantes"...');
        catRefrigerantes = await prisma.menuCategory.create({
          data: {
            tenantId: tId,
            slug: 'refrigerantes',
            name: 'Refrigerantes',
            description: 'Refrigerantes gelados na medida certa para acompanhar sua pizza.',
            imageUrl: 'https://andinacocacola.vtexassets.com/arquivos/ids/159382-800-auto?aspect=true&height=auto&v=639163193134500000&width=800',
            allowSizes: false,
            allowHalfAndHalf: false,
            halfAndHalfGroup: null,
            sortOrder: 30,
            isActive: true,
          },
        });
      }
    }

    // Recarregar categorias após possíveis criações/renomeações
    const allCatsNow = await prisma.menuCategory.findMany({ where: { tenantId: tId } });
    const catNowMap = new Map(allCatsNow.map((c) => [c.slug, c]));
    const tradId = catNowMap.get('pizzas-tradicionais')?.id;
    const docesId = catNowMap.get('pizzas-doces')?.id;
    const refriId = catNowMap.get('refrigerantes')?.id;

    // Atualizar produtos existentes para se alinharem às 3 categorias principais
    const products = await prisma.product.findMany({ where: { tenantId: tId } });
    for (const prod of products) {
      if (['pizzas', 'especiais', 'pizzas-especiais'].includes(prod.category) && tradId) {
        await prisma.product.update({
          where: { id: prod.id },
          data: { category: 'pizzas-tradicionais', categoryId: tradId },
        });
      } else if (['sobremesas', 'doces'].includes(prod.category) && docesId) {
        await prisma.product.update({
          where: { id: prod.id },
          data: { category: 'pizzas-doces', categoryId: docesId },
        });
      } else if (['bebidas'].includes(prod.category) && refriId) {
        await prisma.product.update({
          where: { id: prod.id },
          data: { category: 'refrigerantes', categoryId: refriId },
        });
      }
    }

    // Remover categorias que não fazem parte das 3 principais e seus produtos obsoletos de exemplo
    for (const c of allCatsNow) {
      if (!['pizzas-tradicionais', 'pizzas-doces', 'refrigerantes'].includes(c.slug)) {
        console.log(`   -> Removendo produtos e categoria antiga: ${c.name} (${c.slug})`);
        await prisma.productVariant.deleteMany({ where: { product: { categoryId: c.id } } }).catch(() => {});
        await prisma.product.deleteMany({ where: { categoryId: c.id } }).catch(() => {});
        await prisma.product.deleteMany({ where: { category: c.slug } }).catch(() => {});
        await prisma.menuCategory.delete({ where: { id: c.id } }).catch(() => {});
      }
    }

    // Criar Contas a Pagar iniciais se não existirem
    const payablesCount = await prisma.accountPayable.count({ where: { tenantId: tId } });
    if (payablesCount === 0) {
      console.log('   -> Criando Contas a Pagar de exemplo...');
      const samplePayables = [
        {
          description: 'Fornecedor Laticínios & Frios Premium',
          category: 'SUPPLIER',
          amount: '1450.00',
          paidAmount: '0.00',
          remainingAmount: '1450.00',
          dueDate: new Date(Date.now() + 86400000 * 5),
          status: 'PENDING',
        },
        {
          description: 'Aluguel do Imóvel Comercial',
          category: 'RENT',
          amount: '2800.00',
          paidAmount: '0.00',
          remainingAmount: '2800.00',
          dueDate: new Date(Date.now() + 86400000 * 10),
          status: 'PENDING',
        },
        {
          description: 'Energia Elétrica (Concessionária Local)',
          category: 'ENERGY',
          amount: '620.00',
          paidAmount: '620.00',
          remainingAmount: '0.00',
          dueDate: new Date(Date.now() - 86400000 * 2),
          status: 'PAID',
        },
      ];

      for (const p of samplePayables) {
        await prisma.accountPayable.create({
          data: {
            tenantId: tId,
            description: p.description,
            category: p.category,
            amount: p.amount,
            paidAmount: p.paidAmount,
            remainingAmount: p.remainingAmount,
            dueDate: p.dueDate,
            status: p.status,
            recurrenceType: 'NONE',
          },
        });
      }
    }
  }

  console.log('\n✅ Migração de categorias concluída com sucesso!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
