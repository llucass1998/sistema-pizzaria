import { Router, type Response } from 'express';

import { getTenantId } from '../core/context/TenantContext.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { createToken, setAuthCookie } from '../utils/auth.js';
import { normalizeEmail, normalizeText } from '../utils/normalize.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { couponRoutes } from './coupon.routes.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { requireRole } from '../middlewares/requireRole.js';

export const adminRoutes = Router();

const adminSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

function sendAdminSession(
  res: Response,
  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  },
) {
  const token = createToken({ id: admin.id, email: admin.email, role: admin.role });
  setAuthCookie(res, token);
  res.json({
    admin,
    token,
    role: admin.role,
  });
}

// Login direto do administrador no painel /admin.
adminRoutes.post(
  '/admin/login',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const email = normalizeEmail(req.body.email);
    const password = normalizeText(req.body.password);

    if (!email || !password) {
      res.status(400).json({ message: 'Informe email e senha do admin.' });
      return;
    }

    const admin = await prisma.admin.findFirst({
      where: { tenantId, email },
      select: { ...adminSelect, passwordHash: true },
    });

    if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
      res.status(401).json({ message: 'Email ou senha invalidos.' });
      return;
    }

    const { passwordHash: _passwordHash, ...safeAdmin } = admin;
    sendAdminSession(res, safeAdmin);
  }),
);

// Cria o primeiro administrador do sistema.
// Essa rota so funciona quando ainda nao existe nenhum admin cadastrado.
adminRoutes.post(
  '/admin/setup',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const name = normalizeText(req.body.name);
    const email = normalizeEmail(req.body.email);
    const password = normalizeText(req.body.password);

    if (!name || !email || !password) {
      res.status(400).json({ message: 'Informe nome, email e senha do admin.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'A senha precisa ter pelo menos 6 caracteres.' });
      return;
    }

    const adminCount = await prisma.admin.count({ where: { tenantId } });

    // Depois que o primeiro admin existir, essa rota nao cria mais ninguem.
    if (adminCount > 0) {
      const existingAdminWithoutPassword = await prisma.admin.findFirst({
        where: { tenantId, email },
        select: { id: true, passwordHash: true },
      });

      if (existingAdminWithoutPassword && !existingAdminWithoutPassword.passwordHash) {
        const admin = await prisma.admin.update({
          where: { id: existingAdminWithoutPassword.id },
          data: {
            name,
            passwordHash: await hashPassword(password),
          },
          select: adminSelect,
        });

        sendAdminSession(res, admin);
        return;
      }

      res.status(403).json({
        message: 'O primeiro administrador ja foi criado.',
      });
      return;
    }

    const admin = await prisma.admin.create({
      data: {
        tenantId,
        name,
        email,
        passwordHash: await hashPassword(password),
      },
      select: adminSelect,
    });

    res.status(201);
    sendAdminSession(res, admin);
  }),
);

adminRoutes.use(couponRoutes);

adminRoutes.get(
  '/admin/dashboard/summary',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  asyncHandler(async (_req, res) => {
    const tenantId = getTenantId();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: today },
      },
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        items: {
          select: {
            productId: true,
            product: { select: { name: true } },
            quantity: true,
            total: true,
          },
        },
        invoice: {
          select: {
            payments: {
              select: {
                method: true,
                amount: true,
              },
            },
          },
        },
      },
    });

    let totalRevenue = 0;
    let completedOrders = 0;
    let pendingOrders = 0;
    let cancelledOrders = 0;

    // Chart Data structures
    const revenueByHourMap = new Map<number, { hour: string; revenue: number; orders: number }>();
    const topProductsMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    const ordersByStatusMap = new Map<string, number>();
    const paymentsByMethodMap = new Map<string, number>();

    // Initialize hours (e.g., from 16 to 23 based on store hours, but let's initialize dynamically based on data, or prefill typical hours)
    // For a cleaner chart, let's just group by hour dynamically based on today's orders
    
    for (const order of orders) {
      // 1. Status count
      const statusKey = order.status;
      ordersByStatusMap.set(statusKey, (ordersByStatusMap.get(statusKey) || 0) + 1);

      if (order.status === 'DELIVERED') {
        completedOrders++;
        const orderTotal = Number(order.total?.toString() || 0);
        totalRevenue += orderTotal;

        // 2. Revenue by hour (only for delivered orders)
        const hour = order.createdAt.getHours();
        const hourLabel = `${String(hour).padStart(2, '0')}h`;
        const hourData = revenueByHourMap.get(hour) || { hour: hourLabel, revenue: 0, orders: 0 };
        hourData.revenue += orderTotal;
        hourData.orders += 1;
        revenueByHourMap.set(hour, hourData);

        // 3. Top Products (only for delivered orders)
        for (const item of order.items) {
          if (!item.product) continue;
          const prodKey = item.productId;
          const prodData = topProductsMap.get(prodKey) || { name: item.product.name, quantity: 0, revenue: 0 };
          prodData.quantity += item.quantity;
          prodData.revenue += Number(item.total?.toString() || 0);
          topProductsMap.set(prodKey, prodData);
        }

        // 4. Payments by Method (only for delivered orders, from invoices)
        if (order.invoice && order.invoice.payments) {
          for (const payment of order.invoice.payments) {
            const methodKey = payment.method;
            paymentsByMethodMap.set(methodKey, (paymentsByMethodMap.get(methodKey) || 0) + Number(payment.amount?.toString() || 0));
          }
        }
      } else if (order.status === 'CANCELED') {
        cancelledOrders++;
      } else if (['PENDING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(order.status)) {
        pendingOrders++;
      }
    }

    const averageTicket = completedOrders > 0 ? totalRevenue / completedOrders : 0;

    // Formatting chart arrays
    const revenueByHour = Array.from(revenueByHourMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, data]) => data);

    const topProducts = Array.from(topProductsMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5); // top 5

    // Standardize status names for frontend chart
    const statusTranslation: Record<string, string> = {
      PENDING: 'Pendente',
      PREPARING: 'Preparando',
      READY: 'Pronto',
      OUT_FOR_DELIVERY: 'Em Entrega',
      DELIVERED: 'Finalizado',
      CANCELED: 'Cancelado',
    };
    
    const ordersByStatus = Array.from(ordersByStatusMap.entries()).map(([status, count]) => ({
      name: statusTranslation[status] || status,
      value: count,
    }));

    // Method translations (e.g. PIX, CREDIT_CARD, etc)
    const methodTranslation: Record<string, string> = {
      PIX: 'PIX',
      CREDIT_CARD: 'Crédito',
      DEBIT_CARD: 'Débito',
      CASH: 'Dinheiro',
    };

    const paymentsByMethod = Array.from(paymentsByMethodMap.entries()).map(([method, amount]) => ({
      name: methodTranslation[method] || method,
      value: amount,
    }));

    res.json({
      summary: {
        totalRevenue,
        completedOrders,
        pendingOrders,
        cancelledOrders,
        averageTicket,
      },
      charts: {
        revenueByHour,
        topProducts,
        ordersByStatus,
        paymentsByMethod,
      },
      lastUpdated: new Date().toISOString(),
    });
  }),
);

adminRoutes.get(
  '/admin/clientes',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  asyncHandler(async (_req, res) => {
    const tenantId = getTenantId();

    // Aggregates CRM data
    const customers = await prisma.customer.findMany({
      where: { tenantId },
      orderBy: { totalSpent: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        segment: true,
        totalOrders: true,
        totalSpent: true,
        lastOrderDate: true,
        loyaltyBalance: true,
      },
    });

    const crmData = customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      segment: c.segment,
      totalOrders: c.totalOrders,
      totalSpent: Number(c.totalSpent),
      ticketMedio: c.totalOrders > 0 ? Number(c.totalSpent) / c.totalOrders : 0,
      lastOrderDate: c.lastOrderDate ? c.lastOrderDate.toISOString() : null,
      loyaltyBalance: Number(c.loyaltyBalance),
    }));

    res.json(crmData);
  }),
);

// ─── ADMIN USERS MANAGEMENT ────────────────────────────────────────────────────

adminRoutes.get(
  '/admin/users',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN']),
  asyncHandler(async (_req, res) => {
    const tenantId = getTenantId();
    const admins = await prisma.admin.findMany({
      where: { tenantId },
      select: adminSelect,
      orderBy: { createdAt: 'desc' }
    });
    res.json(admins);
  }),
);

adminRoutes.post(
  '/admin/users',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const name = normalizeText(req.body.name);
    const email = normalizeEmail(req.body.email);
    const password = normalizeText(req.body.password);
    const role = normalizeText(req.body.role);

    if (!name || !email || !password || !role) {
      res.status(400).json({ message: 'Informe nome, email, senha e permissão.' });
      return;
    }

    const existing = await prisma.admin.findFirst({
      where: { email }
    });

    if (existing) {
      res.status(400).json({ message: 'Já existe um usuário com este email.' });
      return;
    }

    const admin = await prisma.admin.create({
      data: {
        tenantId,
        name,
        email,
        passwordHash: await hashPassword(password),
        role
      },
      select: adminSelect
    });

    res.status(201).json(admin);
  })
);

adminRoutes.patch(
  '/admin/users/:id/role',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const id = req.params.id as string;
    const role = normalizeText(req.body.role);

    if (!role) {
      res.status(400).json({ message: 'Informe a nova permissão.' });
      return;
    }

    // Owner protection
    const targetAdmin = await prisma.admin.findFirst({ where: { id, tenantId } });
    if (targetAdmin?.role === 'OWNER') {
      res.status(403).json({ message: 'Não é possível alterar a permissão do dono (OWNER).' });
      return;
    }

    const admin = await prisma.admin.update({
      where: { id, tenantId },
      data: { role },
      select: adminSelect
    });

    res.json(admin);
  })
);

adminRoutes.patch(
  '/admin/users/:id',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const id = req.params.id as string;
    const name = req.body.name ? normalizeText(req.body.name) : undefined;
    const email = req.body.email ? normalizeEmail(req.body.email) : undefined;

    const targetAdmin = await prisma.admin.findFirst({ where: { id, tenantId } });
    if (!targetAdmin) {
      res.status(404).json({ message: 'Administrador não encontrado.' });
      return;
    }

    if (email && email !== targetAdmin.email) {
      const existing = await prisma.admin.findFirst({ where: { tenantId, email } });
      if (existing) {
        res.status(400).json({ message: 'Email já está em uso.' });
        return;
      }
    }

    const admin = await prisma.admin.update({
      where: { id, tenantId },
      data: { 
        ...(name && { name }), 
        ...(email && { email }) 
      },
      select: adminSelect
    });

    res.json(admin);
  })
);

adminRoutes.delete(
  '/admin/users/:id',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const id = req.params.id as string;
    
    // Nao permitir excluir a si mesmo nesta rota (previne bloquear o acesso acidentalmente)
    if (id === (req as any).adminId) {
      res.status(403).json({ message: 'Você não pode excluir a sua própria conta logada.' });
      return;
    }

    const targetAdmin = await prisma.admin.findFirst({ where: { id, tenantId } });
    if (!targetAdmin) {
      res.status(404).json({ message: 'Administrador não encontrado.' });
      return;
    }

    if (targetAdmin.role === 'OWNER') {
      res.status(403).json({ message: 'O nível de acesso (OWNER) não pode ser excluído diretamente.' });
      return;
    }

    await prisma.admin.delete({
      where: { id, tenantId }
    });

    res.status(204).send();
  })
);
