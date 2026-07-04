import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/index.js';
import dotenv from 'dotenv';
dotenv.config();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- BANK ACCOUNTS ---');
  try { const banks = await prisma.bankAccount.findMany(); console.log(banks); } catch(e) { console.log('No BankAccount table or error:', e.message); }
  console.log('--- FINANCIAL TRANSACTIONS / MOVEMENTS ---');
  try { const trans = await prisma.financialTransaction?.findMany(); console.log(trans); } catch(e) { console.log('No trans'); }
  console.log('--- CATEGORIES & PRODUCTS ---');
  const cats = await prisma.menuCategory.findMany();
  for (const c of cats) {
    const prodCount = await prisma.product.count({ where: { categoryId: c.id } });
    const prodCountSlug = await prisma.product.count({ where: { category: c.slug } });
    console.log(`[${c.isActive ? 'ACTIVE' : 'INACTIVE'}] ${c.name} (${c.slug}) -> by id: ${prodCount}, by slug: ${prodCountSlug}`);
  }
  console.log('--- ACCOUNTS PAYABLE ---');
  try { const pay = await (prisma.accountPayable || prisma.billPayable || prisma.billToPay)?.findMany(); console.log(pay); } catch(e) { console.log('No pay'); }
  console.log('--- TENANTS ---');
  const tenants = await prisma.tenant.findMany();
  console.log(tenants);
  console.log('--- ADMINS ---');
  const admins = await prisma.admin.findMany();
  console.log(admins);
}

main().catch(console.error).finally(() => prisma.$disconnect());
