import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/index.js';
import { loadLocalEnv } from '../backend-src/config/loadEnv.js';
import crypto from 'crypto';

loadLocalEnv();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  console.log('--- Iniciando Seed E2E ---');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'demo' }
  });

  if (!tenant) {
    throw new Error('Tenant demo não encontrado.');
  }

  await prisma.storeSetting.updateMany({
    where: {
      OR: [
        { tenantId: tenant.id },
        { pixKey: 'sua-chave-pix-aqui' }
      ]
    },
    data: { pixKey: 'contato@riopizzas.com.br' }
  });

  const adminEmail = 'e2e_admin_teste@example.com';
  let admin = await prisma.admin.findFirst({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.admin.create({
      data: {
        tenantId: tenant.id,
        name: 'E2E Admin',
        email: adminEmail,
        passwordHash: hashPassword('e2e123'),
        role: 'ADMIN',
      }
    });
    console.log('Admin E2E criado.');
  } else {
    console.log('Admin E2E já existe.');
  }

  let category = await prisma.menuCategory.findFirst({
    where: { tenantId: tenant.id, name: 'E2E_TEST Categoria' }
  });
  if (!category) {
    category = await prisma.menuCategory.create({
      data: {
        tenantId: tenant.id,
        name: 'E2E_TEST Categoria',
        slug: 'e2e-test-categoria',
        sortOrder: 999,
      }
    });
    console.log('Categoria E2E criada.');
  }

  let product = await prisma.product.findFirst({
    where: { tenantId: tenant.id, name: 'E2E_TEST Pizza' }
  });
  if (!product) {
    product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: category.id,
        name: 'E2E_TEST Pizza',
        description: 'Pizza de teste E2E gerada automaticamente.',
        price: 53.90,
        isAvailable: true,
      }
    });
    console.log('Produto E2E criado.');
  }

  let coupon = await prisma.coupon.findFirst({
    where: { tenantId: tenant.id, code: 'E2EPIX10' }
  });
  if (!coupon) {
    coupon = await prisma.coupon.create({
      data: {
        tenantId: tenant.id,
        code: 'E2EPIX10',
        type: 'PERCENTAGE',
        value: 10,
        isActive: true,
      }
    });
    console.log('Cupom E2E criado.');
  }

  console.log('--- Seed E2E Concluído ---');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
