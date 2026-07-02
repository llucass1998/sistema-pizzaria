import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { requireRole } from '../middlewares/requireRole.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { getOrderPaymentStatus, getPrimaryPaymentMethod } from '../services/orderFinancial.service.js';

export const billingRoutes = Router();

billingRoutes.use(requireAdmin);
billingRoutes.use(requireRole(['OWNER', 'ADMIN']));

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function isPaidFinancialStatus(status: string) {
  return ['PAID', 'COMPLETED'].includes(status);
}

function getPaidAmount(order: {
  status?: string | null;
  total: unknown;
  paymentStatus?: string | null;
  invoice: { status?: string | null; payments: Array<{ amount: unknown }> } | null;
}) {
  const total = Number(order.total) || 0;
  const paidFromInvoice =
    order.invoice?.payments?.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0) ?? 0;
  return getOrderPaymentStatus(order) === 'PAID' && paidFromInvoice === 0 ? total : paidFromInvoice;
}

billingRoutes.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const tenantId = getTenantId();
    const today = startOfDay();
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: today },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        customer: true,
        items: true,
        invoice: { include: { payments: true } },
      },
    });

    const billableOrders = orders.filter((order) => order.status !== 'CANCELED');
    const paidOrders = billableOrders.filter((order) =>
      isPaidFinancialStatus(getOrderPaymentStatus(order)),
    );
    const pendingOrders = billableOrders.filter((order) =>
      !isPaidFinancialStatus(getOrderPaymentStatus(order)),
    );
    const totalBilled = billableOrders.reduce((sum, order) => sum + Number(order.total), 0);
    const todayRevenue = paidOrders.reduce((sum, order) => sum + getPaidAmount(order), 0);
    const pendingAmount = pendingOrders.reduce(
      (sum, order) => sum + Math.max(0, Number(order.total) - getPaidAmount(order)),
      0,
    );
    const averageTicket = billableOrders.length > 0 ? totalBilled / billableOrders.length : 0;

    const paymentMix = billableOrders.reduce<Record<string, number>>((acc, order) => {
      const method = getPrimaryPaymentMethod(order);
      acc[method] = (acc[method] ?? 0) + (getPaidAmount(order) || Number(order.total));
      return acc;
    }, {});

    const hourlyRevenue = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}h`,
      total: 0,
      orders: 0,
    }));

    for (const order of billableOrders) {
      const hour = order.createdAt.getHours();
      hourlyRevenue[hour].total += Number(order.total);
      hourlyRevenue[hour].orders += 1;
    }

    res.json({
      todayRevenue: Number(todayRevenue.toFixed(2)),
      pendingAmount: Number(pendingAmount.toFixed(2)),
      averageTicket: Number(averageTicket.toFixed(2)),
      orderCount: billableOrders.length,
      paidCount: paidOrders.length,
      pendingCount: pendingOrders.length,
      paymentMix: Object.entries(paymentMix).map(([method, total]) => ({
        method,
        total: Number(total.toFixed(2)),
      })),
      hourlyRevenue: hourlyRevenue.map((entry) => ({
        ...entry,
        total: Number(entry.total.toFixed(2)),
      })),
      transactions: billableOrders.slice(0, 12).map((order) => ({
        id: order.invoice?.id ?? order.id,
        orderId: order.id,
        customer: order.customer?.name ?? 'Cliente',
        date: order.createdAt,
        total: Number(order.total),
        status: getOrderPaymentStatus(order),
        paymentMethod: getPrimaryPaymentMethod(order),
        items: order.items.reduce((sum, item) => sum + item.quantity, 0),
      })),
    });
  }),
);
