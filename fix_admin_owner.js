/**
 * Script de correção: Garante que admin@riopizzas.com tenha role OWNER.
 *
 * Executa: node fix_admin_owner.js
 *
 * O que faz:
 * 1. Localiza TODAS as contas admin@riopizzas.com no banco
 * 2. Define role = 'OWNER' em cada uma delas
 * 3. Exibe o resultado para confirmação
 */

const { PrismaClient } = require('./generated/prisma/index.js');

const ADMIN_EMAIL = 'admin@riopizzas.com';
const TARGET_ROLE = 'OWNER';

async function main() {
  // Carregar .env manualmente
  try {
    require('dotenv').config();
  } catch {
    // dotenv opcional
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL não definida no ambiente.');
    process.exit(1);
  }

  // Inicializar Prisma com o adapter pg
  let prisma;
  try {
    const { PrismaPg } = require('@prisma/adapter-pg');
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
  } catch {
    prisma = new PrismaClient();
  }

  try {
    console.log(`\n🔍 Buscando contas com email: ${ADMIN_EMAIL}...\n`);

    // 1. Listar contas existentes
    const before = await prisma.admin.findMany({
      where: { email: ADMIN_EMAIL },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        tenant: { select: { name: true, slug: true, customDomain: true } },
      },
    });

    if (before.length === 0) {
      console.log('⚠️  Nenhuma conta encontrada para este email.');
      console.log('   Execute o resetAdmin.ts para criar o admin primeiro.');
      return;
    }

    console.log(`📋 Contas encontradas: ${before.length}`);
    before.forEach((a, i) => {
      const status = a.role === TARGET_ROLE ? '✅' : '⚠️ ';
      console.log(`  ${i + 1}. ${status} [${a.role}] ${a.email}`);
      console.log(`     Tenant: ${a.tenant?.name} (slug: ${a.tenant?.slug})`);
      if (a.tenant?.customDomain) {
        console.log(`     Domínio: ${a.tenant.customDomain}`);
      }
      console.log(`     ID Admin: ${a.id}`);
      console.log(`     TenantID: ${a.tenantId}`);
      console.log();
    });

    // 2. Atualizar role para OWNER em todas as contas
    const needsUpdate = before.filter((a) => a.role !== TARGET_ROLE);
    if (needsUpdate.length === 0) {
      console.log(`✅ Todas as contas já têm role ${TARGET_ROLE}. Nenhuma correção necessária.\n`);
      return;
    }

    console.log(`🔧 Atualizando ${needsUpdate.length} conta(s) para role ${TARGET_ROLE}...`);

    const { count } = await prisma.admin.updateMany({
      where: { email: ADMIN_EMAIL, role: { not: TARGET_ROLE } },
      data: { role: TARGET_ROLE },
    });

    console.log(`\n✅ ${count} conta(s) atualizadas com sucesso!\n`);

    // 3. Verificar resultado
    const after = await prisma.admin.findMany({
      where: { email: ADMIN_EMAIL },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        tenant: { select: { name: true, slug: true } },
      },
    });

    console.log('📊 Estado final:');
    after.forEach((a, i) => {
      const status = a.role === TARGET_ROLE ? '✅' : '❌';
      console.log(`  ${i + 1}. ${status} [${a.role}] ${a.email} — Tenant: ${a.tenant?.name}`);
    });

    const allCorrect = after.every((a) => a.role === TARGET_ROLE);
    if (allCorrect) {
      console.log(`\n🎉 Correção concluída! admin@riopizzas.com tem acesso TOTAL ao sistema.\n`);
    } else {
      console.log(
        `\n❌ ATENÇÃO: Algumas contas ainda não têm role OWNER. Verifique manualmente.\n`,
      );
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
