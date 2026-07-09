import { prisma } from './backend-src/lib/prisma.ts';

async function main() {
  const email = 'admin@riopizzas.com';

  const admin = await prisma.admin.findFirst({
    where: { email },
  });

  if (!admin) {
    console.log(`Admin ${email} not found.`);
  } else {
    const updated = await prisma.admin.update({
      where: { id: admin.id },
      data: { role: 'SUPER_ADMIN' },
    });
    console.log(`Updated ${email} to SUPER_ADMIN`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
