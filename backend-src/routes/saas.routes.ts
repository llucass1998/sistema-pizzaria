import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../utils/password.js';

const router = Router();

router.post('/onboarding', async (req: Request, res: Response) => {
  try {
    const { storeName, slug, ownerName, email, password } = req.body;

    if (!storeName || !slug || !email || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    // Verifica se slug ja existe
    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      return res.status(400).json({ error: 'Este endereço de loja (slug) já está em uso.' });
    }

    // Verifica se email do dono ja existe (um email por admin de qualquer tenant)
    const existingAdmin = await prisma.admin.findFirst({ where: { email } });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Este e-mail já está em uso por outro administrador.' });
    }

    // 1. Cria Tenant
    const tenant = await prisma.tenant.create({
      data: {
        slug,
        name: storeName,
      },
    });

    // 2. Cria Store Settings
    await prisma.storeSetting.create({
      data: {
        tenantId: tenant.id,
        storeName,
        phone: '11999999999',
        address: 'Rua Principal, 100',
        deliveryFee: 5,
        hours: '18:00 - 23:30',
        whatsappNumber: '5511999999999',
        isOpen: true,
      },
    });

    // 3. Cria Categorias Padrao
    await prisma.menuCategory.createMany({
      data: [
        { tenantId: tenant.id, name: 'Pizzas', slug: 'pizzas', sortOrder: 1, allowSizes: true, allowHalfAndHalf: true },
        { tenantId: tenant.id, name: 'Bebidas', slug: 'bebidas', sortOrder: 2 },
      ]
    });

    // 4. Cria Conta Admin
    const hashedPassword = await hashPassword(password);
    await prisma.admin.create({
      data: {
        tenantId: tenant.id,
        name: ownerName || storeName,
        email,
        passwordHash: hashedPassword,
        role: 'OWNER',
      },
    });

    // Em um SaaS real, aqui também criariamos a Subscription no gateway
    // const subscription = await gateway.createSubscription(...)

    return res.status(201).json({
      success: true,
      message: 'Loja criada com sucesso.',
      tenant: { slug: tenant.slug, name: tenant.name }
    });
  } catch (error) {
    console.error('Erro no onboarding:', error);
    res.status(500).json({ error: 'Erro interno ao criar loja.' });
  }
});

export default router;
