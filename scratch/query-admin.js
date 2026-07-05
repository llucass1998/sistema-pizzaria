import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@riopizzas.com';
  const user = await prisma.user.findUnique({
    where: { email },
    include: { tenant: true, store: true }
  });

  if (user) {
    console.log(JSON.stringify(user, null, 2));
  } else {
    console.log(`User ${email} not found.`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
