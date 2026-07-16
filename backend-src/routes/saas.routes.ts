import { Router, Request, Response, NextFunction } from 'express';
import { basePrisma } from '../lib/prisma.js';
import { hashPassword } from '../utils/password.js';
import { verifyToken } from '../utils/auth.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const saasPublicRoutes = Router();
export const saasAdminRoutes = Router();

async function requireSaasSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.header('authorization')?.replace('Bearer ', '');
  const payload = verifyToken(token);

  if (
    !payload ||
    payload.type !== 'STAFF' ||
    !payload.userId ||
    payload.customerId ||
    payload.role !== 'SUPER_ADMIN'
  ) {
    res.status(payload ? 403 : 401).json({ message: 'Acesso restrito ao SUPER_ADMIN.' });
    return;
  }

  const admin = await basePrisma.admin.findFirst({
    where: { id: payload.id, email: payload.email, role: 'SUPER_ADMIN' },
    select: { id: true, email: true, role: true },
  });

  if (!admin) {
    res.status(403).json({ message: 'Acesso de SUPER_ADMIN invalido.' });
    return;
  }

  (req as any).adminId = admin.id;
  (req as any).admin = admin;
  (req as any).adminRole = admin.role;
  next();
}

saasPublicRoutes.post('/onboarding', async (req: Request, res: Response) => {
  try {
    const { storeName, slug, ownerName, email, password } = req.body;

    if (!storeName || !slug || !email || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    // Verifica se slug ja existe
    const existingTenant = await basePrisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      return res.status(400).json({ error: 'Este endereço de loja (slug) já está em uso.' });
    }

    // Verifica se email do dono ja existe (um email por admin de qualquer tenant)
    const existingAdmin = await basePrisma.admin.findFirst({ where: { email } });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Este e-mail já está em uso por outro administrador.' });
    }

    // 1. Cria Tenant
    const tenant = await basePrisma.tenant.create({
      data: {
        slug,
        name: storeName,
      },
    });

    // 2. Cria Store Settings
    await basePrisma.storeSetting.create({
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
    await basePrisma.menuCategory.createMany({
      data: [
        {
          tenantId: tenant.id,
          name: 'Pizzas',
          slug: 'pizzas',
          sortOrder: 1,
          allowSizes: true,
          allowHalfAndHalf: true,
        },
        { tenantId: tenant.id, name: 'Bebidas', slug: 'bebidas', sortOrder: 2 },
      ],
    });

    // 4. Cria Conta Admin
    const hashedPassword = await hashPassword(password);
    await basePrisma.admin.create({
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
      tenant: { slug: tenant.slug, name: tenant.name },
    });
  } catch (error) {
    console.error('Erro no onboarding:', error);
    res.status(500).json({ error: 'Erro interno ao criar loja.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SAAS (Super Admin)
// ─────────────────────────────────────────────────────────────────────────────

saasAdminRoutes.get(
  '/tenants',
  requireSaasSuperAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    // Busca todos os tenants com contagens basicas
    const tenants = await basePrisma.tenant.findMany({
      include: {
        _count: {
          select: {
            orders: true,
            customers: true,
            products: true,
          },
        },
        admins: {
          where: { role: 'OWNER' },
          select: { email: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      isActive: t.isActive,
      createdAt: t.createdAt,
      totalOrders: t._count.orders,
      totalCustomers: t._count.customers,
      totalProducts: t._count.products,
      ownerEmail: t.admins[0]?.email || null,
      ownerName: t.admins[0]?.name || null,
    }));

    res.json(mapped);
  }),
);

saasAdminRoutes.patch(
  '/tenants/:id/status',
  requireSaasSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { isActive } = req.body;
    const id = req.params.id as string;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({ message: 'isActive deve ser um booleano.' });
      return;
    }

    const tenant = await basePrisma.tenant.update({
      where: { id },
      data: { isActive },
    });

    res.json({ message: 'Status do Tenant atualizado com sucesso.', tenant });
  }),
);

export default saasPublicRoutes;
