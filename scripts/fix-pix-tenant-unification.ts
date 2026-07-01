import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/index.js';
import { loadLocalEnv } from '../backend-src/config/loadEnv.js';

loadLocalEnv();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Iniciando script de unificacao de lojas ---');

  const domain = 'pizzarialucas.istigestao.com.br';
  const canonicalEmail = 'admin@riopizzas.com';

  const adminUser = await prisma.admin.findFirst({
    where: { email: canonicalEmail },
    include: { tenant: true }
  });

  if (!adminUser) {
    throw new Error('Admin nao encontrado');
  }

  const canonicalTenant = adminUser.tenant;
  console.log(`Loja Canonica encontrada: ${canonicalTenant.name} (ID: ${canonicalTenant.id}, Slug: ${canonicalTenant.slug})`);

  const emptyTenant = await prisma.tenant.findUnique({
    where: { customDomain: domain }
  });

  if (!emptyTenant) {
    console.log(`Nenhuma loja encontrada com o dominio ${domain}. O dominio pode ja estar na loja canonica.`);
    return;
  }

  if (emptyTenant.id === canonicalTenant.id) {
    console.log('A loja canonica JA ESTA vinculada ao dominio correto! Nada a fazer.');
    return;
  }

  console.log(`Loja duplicada encontrada: ${emptyTenant.name} (ID: ${emptyTenant.id}, Slug: ${emptyTenant.slug})`);

  console.log('Aplicando transacao de unificacao...');

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: emptyTenant.id },
      data: {
        customDomain: null,
        subdomain: null,
        slug: `${emptyTenant.slug}-arquivo`,
        isActive: false
      }
    });

    await tx.tenant.update({
      where: { id: canonicalTenant.id },
      data: {
        customDomain: domain,
        isActive: true
      }
    });
  });

  console.log('Transacao concluida com sucesso! Dominio transferido para a Loja Canonica.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
