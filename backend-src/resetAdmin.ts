/**
 * Reset seguro do acesso administrativo.
 *
 * Mantem produtos, pedidos, estoque, faturas e configuracoes.
 * Garante um admin permanente e limpa somente usuarios tecnicos/de teste.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/index.js';
import { loadLocalEnv } from './config/loadEnv.js';
import { hashPassword } from './utils/password.js';

loadLocalEnv();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = 'admin@riopizzas.com';
const ADMIN_PASSWORD = 'admin123';
const POS_CUSTOMER_EMAIL = 'balcao@pos.local';

async function ensureDefaultTenant() {
  const existingTenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (existingTenant) {
    return existingTenant;
  }

  return prisma.tenant.create({
    data: {
      name: 'Pizzaria Matriz (Default)',
      cnpj: '00000000000000',
    },
  });
}

async function resetAdminAccess() {
  console.log('\nIniciando reset seguro de admin...\n');

  const tenant = await ensureDefaultTenant();
  const tenantId = tenant.id;
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  const existingAdmin = await prisma.admin.findFirst({
    where: { tenantId, email: ADMIN_EMAIL },
  });

  const permanentAdmin = existingAdmin
    ? await prisma.admin.update({
        where: { id: existingAdmin.id },
        data: {
          name: 'Administrador ERP',
          passwordHash,
        },
      })
    : await prisma.admin.create({
        data: {
          tenantId,
          name: 'Administrador ERP',
          email: ADMIN_EMAIL,
          passwordHash,
        },
      });

  const reassignedShifts = await prisma.shift.updateMany({
    where: {
      tenantId,
      adminId: { not: permanentAdmin.id },
    },
    data: {
      adminId: permanentAdmin.id,
    },
  });

  const removedAdmins = await prisma.admin.deleteMany({
    where: {
      tenantId,
      id: { not: permanentAdmin.id },
    },
  });

  const posCustomer = await prisma.customer.upsert({
    where: {
      tenantId_email: {
        tenantId,
        email: POS_CUSTOMER_EMAIL,
      },
    },
    update: {
      name: 'Cliente Balcao',
    },
    create: {
      tenantId,
      name: 'Cliente Balcao',
      email: POS_CUSTOMER_EMAIL,
    },
  });

  const testCustomers = await prisma.customer.findMany({
    where: {
      tenantId,
      id: { not: posCustomer.id },
      OR: [
        { email: ADMIN_EMAIL },
        { email: 'cliente@teste.com' },
        { email: { endsWith: '@teste.com' } },
      ],
    },
    select: { id: true },
  });
  const testCustomerIds = testCustomers.map((customer) => customer.id);

  const reassignedOrders =
    testCustomerIds.length > 0
      ? await prisma.order.updateMany({
          where: {
            tenantId,
            customerId: { in: testCustomerIds },
          },
          data: {
            customerId: posCustomer.id,
          },
        })
      : { count: 0 };

  const removedCustomers =
    testCustomerIds.length > 0
      ? await prisma.customer.deleteMany({
          where: {
            tenantId,
            id: { in: testCustomerIds },
          },
        })
      : { count: 0 };

  const [totalAdmins, totalCustomers, totalOrders, totalProducts] = await Promise.all([
    prisma.admin.count({ where: { tenantId } }),
    prisma.customer.count({ where: { tenantId } }),
    prisma.order.count({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId } }),
  ]);

  console.log(`Admin permanente: ${permanentAdmin.email}`);
  console.log(`Senha resetada: ${ADMIN_PASSWORD}`);
  console.log(`Caixas reatribuidos: ${reassignedShifts.count}`);
  console.log(`Admins extras removidos: ${removedAdmins.count}`);
  console.log(`Pedidos de clientes de teste reatribuidos: ${reassignedOrders.count}`);
  console.log(`Clientes de teste removidos: ${removedCustomers.count}`);
  console.log(`Resumo tenant ${tenant.name}:`);
  console.log(`- Admins: ${totalAdmins}`);
  console.log(`- Clientes: ${totalCustomers}`);
  console.log(`- Pedidos preservados: ${totalOrders}`);
  console.log(`- Produtos preservados: ${totalProducts}`);
  console.log('\nReset seguro concluido.\n');
}

resetAdminAccess()
  .catch((error) => {
    console.error('\nErro no reset seguro de admin:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
