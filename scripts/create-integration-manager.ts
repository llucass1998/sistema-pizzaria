import { prisma } from '../backend-src/lib/prisma.ts';
import { hashPassword } from '../backend-src/utils/password.ts';

async function main() {
  console.log('Criando usuário INTEGRATION_MANAGER...');

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.log('Nenhum tenant encontrado. Execute as migrations e seeds primeiro.');
    process.exit(1);
  }

  const email = 'ifood@pizzarialucas.com.br';
  const passwordHash = await hashPassword('ifood123456');

  const admin = await prisma.admin.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email,
      },
    },
    update: {
      role: 'INTEGRATION_MANAGER',
      passwordHash,
    },
    create: {
      tenantId: tenant.id,
      name: 'Gestor de Integrações',
      email,
      passwordHash,
      role: 'INTEGRATION_MANAGER',
    },
  });

  console.log(`Usuário INTEGRATION_MANAGER criado/atualizado com sucesso!`);
  console.log(`Email: ${admin.email}`);
  console.log(`Senha: ifood123456`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
