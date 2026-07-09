import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getTenantId } from '../core/context/TenantContext.js';
import {
  getBrazilDateParts,
  normalizeBrazilDateRange,
  createBrazilDate,
} from '../utils/timezone.js';

/**
 * Helper para obter o tenantId de forma segura a partir do usuário autenticado (req.admin/req.user),
 * ignorando tenantId que venha de query/body, ou usando o TenantContext gerado pelo middleware.
 */
async function resolveSecureTenantId(req: Request): Promise<string> {
  const adminId = (req as any).adminId || (req as any).user?.id;
  if (adminId) {
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { tenantId: true },
    });
    if (admin?.tenantId) {
      return admin.tenantId;
    }
  }
  return getTenantId();
}

/**
 * Resolução robusta de período de datas respeitando o timezone America/Sao_Paulo.
 */
function resolveReportPeriod(req: Request): {
  startUtc: Date;
  endUtc: Date;
  label: string;
  timezone: string;
} {
  const { startDate, endDate, quickRange, period } = req.query as Record<
    string,
    string | undefined
  >;
  const rangeType = (quickRange || period || '').toUpperCase();
  const timezone = 'America/Sao_Paulo';

  // Validação de datas ISO se fornecidas
  if (startDate && isNaN(new Date(startDate).getTime())) {
    throw Object.assign(
      new Error('Data inicial (startDate) inválida. Utilize formato ISO (YYYY-MM-DD).'),
      { statusCode: 400 },
    );
  }
  if (endDate && isNaN(new Date(endDate).getTime())) {
    throw Object.assign(
      new Error('Data final (endDate) inválida. Utilize formato ISO (YYYY-MM-DD).'),
      { statusCode: 400 },
    );
  }

  const nowParts = getBrazilDateParts(new Date(), timezone);

  if (rangeType === 'TODAY' || (!rangeType && !startDate && !endDate)) {
    const s = createBrazilDate(nowParts.year, nowParts.month, nowParts.day, 0, 0, 0, 0);
    const e = createBrazilDate(nowParts.year, nowParts.month, nowParts.day, 23, 59, 59, 999);
    return { startUtc: s, endUtc: e, label: 'Hoje', timezone };
  }

  if (rangeType === 'LAST_7_DAYS') {
    const todayEnd = createBrazilDate(nowParts.year, nowParts.month, nowParts.day, 23, 59, 59, 999);
    const start = new Date(todayEnd.getTime() - 6 * 86400000);
    const sParts = getBrazilDateParts(start, timezone);
    const s = createBrazilDate(sParts.year, sParts.month, sParts.day, 0, 0, 0, 0);
    return { startUtc: s, endUtc: todayEnd, label: 'Últimos 7 dias', timezone };
  }

  if (rangeType === 'THIS_MONTH') {
    const s = createBrazilDate(nowParts.year, nowParts.month, 1, 0, 0, 0, 0);
    const e = createBrazilDate(nowParts.year, nowParts.month, nowParts.day, 23, 59, 59, 999);
    return { startUtc: s, endUtc: e, label: 'Este mês', timezone };
  }

  if (rangeType === 'LAST_30_DAYS') {
    const todayEnd = createBrazilDate(nowParts.year, nowParts.month, nowParts.day, 23, 59, 59, 999);
    const start = new Date(todayEnd.getTime() - 29 * 86400000);
    const sParts = getBrazilDateParts(start, timezone);
    const s = createBrazilDate(sParts.year, sParts.month, sParts.day, 0, 0, 0, 0);
    return { startUtc: s, endUtc: todayEnd, label: 'Últimos 30 dias', timezone };
  }

  const norm = normalizeBrazilDateRange(startDate, endDate, timezone);
  return { startUtc: norm.startUtc, endUtc: norm.endUtc, label: 'Período Customizado', timezone };
}

/**
 * Helper para extrair dia da semana (0-6) e hora (0-23) no fuso America/Sao_Paulo.
 */
function getBrazilDayAndHour(date: Date): { dayOfWeek: number; hour: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value || 'Sun';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = weekdayMap[weekdayStr] ?? 0;

  let hourStr = parts.find((p) => p.type === 'hour')?.value || '0';
  if (hourStr === '24') hourStr = '0';
  const hour = parseInt(hourStr, 10) || 0;
  return { dayOfWeek, hour };
}

/**
 * Verifica se um pedido está cancelado.
 */
function isOrderCanceled(order: { status: string; paymentStatus?: string | null }): boolean {
  const st = (order.status || '').toUpperCase();
  const pst = (order.paymentStatus || '').toUpperCase();
  return st === 'CANCELED' || st === 'CANCELLED' || st === 'REFUNDED' || pst === 'REFUNDED';
}

/**
 * Verifica se um pedido está concluído/realizado (e não cancelado).
 */
function isOrderCompleted(order: { status: string; paymentStatus?: string | null }): boolean {
  if (isOrderCanceled(order)) return false;
  const st = (order.status || '').toUpperCase();
  const pst = (order.paymentStatus || '').toUpperCase();
  return st === 'DELIVERED' || st === 'COMPLETED' || pst === 'PAID' || pst === 'PARTIALLY_PAID';
}

export class ReportsController {
  /**
   * GET /api/admin/reports/summary
   * Resumo Geral Executivo
   */
  static async getGeneralSummary(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = await resolveSecureTenantId(req);
      const period = resolveReportPeriod(req);

      const whereClause: any = {
        tenantId,
        createdAt: { gte: period.startUtc, lte: period.endUtc },
      };

      if (req.query.paymentMethod) {
        whereClause.paymentMethod = String(req.query.paymentMethod);
      }
      if (req.query.driverId) {
        whereClause.driverId = String(req.query.driverId);
      }

      const orders = await prisma.order.findMany({
        where: whereClause,
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          total: true,
          paymentMode: true,
          depositAmount: true,
          remainingAmount: true,
          amountPaid: true,
          amountDue: true,
        },
      });

      const completedOrders = orders.filter(isOrderCompleted);
      const canceledOrders = orders.filter(isOrderCanceled);
      const pendingOrders = orders.filter((o) => !isOrderCompleted(o) && !isOrderCanceled(o));

      const totalSold = orders
        .filter((o) => !isOrderCanceled(o))
        .reduce((acc, o) => acc + Number(o.total || 0), 0);
      const totalReceived = orders
        .filter((o) => !isOrderCanceled(o))
        .reduce(
          (acc, o) => acc + Number(o.amountPaid || (o.paymentStatus === 'PAID' ? o.total : 0) || 0),
          0,
        );
      const depositReceived = orders
        .filter((o) => !isOrderCanceled(o) && o.paymentMode === 'DEPOSIT')
        .reduce(
          (acc, o) => acc + Math.min(Number(o.depositAmount || 0), Number(o.amountPaid || 0)),
          0,
        );
      const pendingBalance = orders
        .filter((o) => !isOrderCanceled(o))
        .reduce((acc, o) => acc + Number(o.amountDue || 0), 0);
      const remainingReceived = orders
        .filter((o) => !isOrderCanceled(o) && o.paymentMode === 'DEPOSIT')
        .reduce(
          (acc, o) => acc + Math.max(0, Number(o.amountPaid || 0) - Number(o.depositAmount || 0)),
          0,
        );
      const partiallyPaidOrders = orders.filter((o) => o.paymentStatus === 'PARTIALLY_PAID').length;
      const paidOrders = orders.filter((o) => o.paymentStatus === 'PAID').length;
      const revenueRealized = totalReceived;
      const revenuePending =
        pendingBalance || pendingOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);
      const canceledAmount = canceledOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);

      const totalOrdersCount = orders.length;
      const completedOrdersCount = completedOrders.length;
      const pendingOrdersCount = pendingOrders.length;
      const canceledOrdersCount = canceledOrders.length;

      const cancellationRate =
        totalOrdersCount > 0
          ? Number(((canceledOrdersCount / totalOrdersCount) * 100).toFixed(2))
          : 0;

      const averageTicket =
        completedOrdersCount > 0 ? Number((revenueRealized / completedOrdersCount).toFixed(2)) : 0;

      res.json({
        revenueRealized: Number(revenueRealized.toFixed(2)),
        revenuePending: Number(revenuePending.toFixed(2)),
        totalSold: Number(totalSold.toFixed(2)),
        totalReceived: Number(totalReceived.toFixed(2)),
        depositReceived: Number(depositReceived.toFixed(2)),
        remainingReceived: Number(remainingReceived.toFixed(2)),
        pendingBalance: Number(pendingBalance.toFixed(2)),
        partiallyPaidOrders,
        paidOrders,
        canceledAmount: Number(canceledAmount.toFixed(2)),
        totalOrders: totalOrdersCount,
        completedOrders: completedOrdersCount,
        pendingOrders: pendingOrdersCount,
        canceledOrdersCount,
        cancellationRate,
        averageTicket,
        periodApplied: {
          start: period.startUtc.toISOString(),
          end: period.endUtc.toISOString(),
          label: period.label,
          timezone: period.timezone,
        },
      });
    } catch (err: any) {
      if (err.statusCode === 400) {
        res.status(400).json({ message: err.message });
        return;
      }
      console.error('Erro em getGeneralSummary:', err);
      res
        .status(500)
        .json({ message: 'Não foi possível carregar os relatórios. Tente novamente.' });
    }
  }

  /**
   * GET /api/admin/reports/abc-products
   * Curva ABC de Produtos
   */
  static async getAbcProducts(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = await resolveSecureTenantId(req);
      const period = resolveReportPeriod(req);

      const orderWhere: any = {
        tenantId,
        createdAt: { gte: period.startUtc, lte: period.endUtc },
        NOT: {
          status: { in: ['CANCELED', 'CANCELLED', 'REFUNDED'] },
        },
      };

      if (req.query.paymentMethod) {
        orderWhere.paymentMethod = String(req.query.paymentMethod);
      }
      if (req.query.driverId) {
        orderWhere.driverId = String(req.query.driverId);
      }

      const itemWhere: any = {
        order: orderWhere,
      };

      if (req.query.categoryId) {
        itemWhere.product = { categoryId: String(req.query.categoryId) };
      }
      if (req.query.productId) {
        itemWhere.productId = String(req.query.productId);
      }

      // Buscar itens dos pedidos válidos e agrupar por produto
      const items = await prisma.orderItem.findMany({
        where: itemWhere,
        select: {
          productId: true,
          displayName: true,
          quantity: true,
          total: true,
          product: {
            select: { name: true },
          },
        },
      });

      const productMap = new Map<
        string,
        { productId: string; productName: string; quantitySold: number; grossRevenue: number }
      >();

      for (const item of items) {
        const name = item.displayName || item.product?.name || 'Produto removido';
        const key = item.productId || name || 'removido';
        const current = productMap.get(key) || {
          productId: key,
          productName: name,
          quantitySold: 0,
          grossRevenue: 0,
        };
        current.quantitySold += Number(item.quantity || 0);
        current.grossRevenue += Number(item.total || 0);
        productMap.set(key, current);
      }

      const sortedProducts = Array.from(productMap.values()).sort(
        (a, b) => b.grossRevenue - a.grossRevenue,
      );
      const totalRevenue = sortedProducts.reduce((acc, p) => acc + p.grossRevenue, 0);

      let cumulativeRevenue = 0;
      const result = sortedProducts.map((prod, idx) => {
        const percentageOfRevenue =
          totalRevenue > 0 ? Number(((prod.grossRevenue / totalRevenue) * 100).toFixed(2)) : 0;
        cumulativeRevenue += prod.grossRevenue;
        const cumulativePercentage =
          totalRevenue > 0 ? Number(((cumulativeRevenue / totalRevenue) * 100).toFixed(2)) : 0;

        let abcClass = 'A';
        if (idx > 0 && cumulativePercentage > 95) {
          abcClass = 'C';
        } else if (idx > 0 && cumulativePercentage > 80) {
          abcClass = 'B';
        }

        return {
          rank: idx + 1,
          productId: prod.productId,
          productName: prod.productName,
          quantitySold: prod.quantitySold,
          grossRevenue: Number(prod.grossRevenue.toFixed(2)),
          percentageOfRevenue,
          cumulativePercentage,
          abcClass,
        };
      });

      res.json(result);
    } catch (err: any) {
      if (err.statusCode === 400) {
        res.status(400).json({ message: err.message });
        return;
      }
      console.error('Erro em getAbcProducts:', err);
      res.status(500).json({ message: 'Não foi possível carregar a Curva ABC. Tente novamente.' });
    }
  }

  /**
   * GET /api/admin/reports/sales-heatmap
   * Heatmap Operacional (Dias da Semana x Horas do Dia em America/Sao_Paulo)
   */
  static async getSalesHeatmap(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = await resolveSecureTenantId(req);
      const period = resolveReportPeriod(req);

      const whereClause: any = {
        tenantId,
        createdAt: { gte: period.startUtc, lte: period.endUtc },
        NOT: {
          status: { in: ['CANCELED', 'CANCELLED', 'REFUNDED'] },
        },
      };

      if (req.query.paymentMethod) {
        whereClause.paymentMethod = String(req.query.paymentMethod);
      }

      const orders = await prisma.order.findMany({
        where: whereClause,
        select: {
          createdAt: true,
          total: true,
        },
      });

      // Inicializar grade 7 (Dom-Sáb) x 24 (00h-23h)
      const gridMap = new Map<
        string,
        { dayOfWeek: number; hour: number; ordersCount: number; revenue: number }
      >();
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          gridMap.set(`${d}-${h}`, { dayOfWeek: d, hour: h, ordersCount: 0, revenue: 0 });
        }
      }

      for (const order of orders) {
        const { dayOfWeek, hour } = getBrazilDayAndHour(order.createdAt);
        const key = `${dayOfWeek}-${hour}`;
        const cell = gridMap.get(key);
        if (cell) {
          cell.ordersCount += 1;
          cell.revenue += Number(order.total || 0);
        }
      }

      const gridArray = Array.from(gridMap.values());
      const maxOrdersCount = Math.max(...gridArray.map((c) => c.ordersCount), 1);

      const result = gridArray.map((cell) => ({
        ...cell,
        revenue: Number(cell.revenue.toFixed(2)),
        intensity: Number((cell.ordersCount / maxOrdersCount).toFixed(2)),
      }));

      res.json(result);
    } catch (err: any) {
      if (err.statusCode === 400) {
        res.status(400).json({ message: err.message });
        return;
      }
      console.error('Erro em getSalesHeatmap:', err);
      res.status(500).json({ message: 'Não foi possível carregar o Heatmap. Tente novamente.' });
    }
  }

  /**
   * GET /api/admin/reports/driver-ranking
   * Ranking de Entregadores
   */
  static async getDriverRanking(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = await resolveSecureTenantId(req);
      const period = resolveReportPeriod(req);

      const whereClause: any = {
        tenantId,
        createdAt: { gte: period.startUtc, lte: period.endUtc },
        fulfillmentType: { in: ['DELIVERY', 'delivery', 'Delivery'] },
      };

      if (req.query.driverId) {
        whereClause.driverId = String(req.query.driverId);
      }

      const orders = await prisma.order.findMany({
        where: whereClause,
        select: {
          status: true,
          paymentStatus: true,
          total: true,
          deliveryFee: true,
          driverId: true,
          driver: {
            select: { id: true, name: true },
          },
        },
      });

      const driverMap = new Map<
        string,
        {
          driverId: string;
          driverName: string;
          deliveriesCompleted: number;
          revenueDelivered: number;
          deliveryFees: number;
          canceledDeliveries: number;
        }
      >();

      for (const order of orders) {
        const id = order.driverId || 'no-driver';
        const name = order.driver?.name || 'Sem entregador';
        const current = driverMap.get(id) || {
          driverId: id,
          driverName: name,
          deliveriesCompleted: 0,
          revenueDelivered: 0,
          deliveryFees: 0,
          canceledDeliveries: 0,
        };

        if (isOrderCanceled(order)) {
          current.canceledDeliveries += 1;
        } else if (isOrderCompleted(order)) {
          current.deliveriesCompleted += 1;
          current.revenueDelivered += Number(order.total || 0);
          current.deliveryFees += Number(order.deliveryFee || 0);
        }
        driverMap.set(id, current);
      }

      const ranking = Array.from(driverMap.values())
        .sort((a, b) => b.deliveriesCompleted - a.deliveriesCompleted)
        .map((d) => ({
          driverId: d.driverId,
          driverName: d.driverName,
          deliveriesCompleted: d.deliveriesCompleted,
          revenueDelivered: Number(d.revenueDelivered.toFixed(2)),
          deliveryFees: Number(d.deliveryFees.toFixed(2)),
          averageDeliveryValue:
            d.deliveriesCompleted > 0
              ? Number((d.revenueDelivered / d.deliveriesCompleted).toFixed(2))
              : 0,
          canceledDeliveries: d.canceledDeliveries,
        }));

      res.json(ranking);
    } catch (err: any) {
      if (err.statusCode === 400) {
        res.status(400).json({ message: err.message });
        return;
      }
      console.error('Erro em getDriverRanking:', err);
      res
        .status(500)
        .json({ message: 'Não foi possível carregar o ranking de entregadores. Tente novamente.' });
    }
  }

  /**
   * GET /api/admin/reports/payment-methods
   * Mix de Formas de Pagamento
   */
  static async getPaymentMethods(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = await resolveSecureTenantId(req);
      const period = resolveReportPeriod(req);

      const orders = await prisma.order.findMany({
        where: {
          tenantId,
          createdAt: { gte: period.startUtc, lte: period.endUtc },
        },
        select: {
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          total: true,
        },
      });

      const validOrders = orders.filter((o) => !isOrderCanceled(o));
      const totalAmountAll = validOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);

      const labelMap: Record<string, { method: string; label: string }> = {
        PIX: { method: 'PIX', label: 'PIX' },
        CASH: { method: 'CASH', label: 'Dinheiro' },
        DINHEIRO: { method: 'CASH', label: 'Dinheiro' },
        DEBIT_CARD: { method: 'DEBIT_CARD', label: 'Cartão de Débito' },
        DEBITO: { method: 'DEBIT_CARD', label: 'Cartão de Débito' },
        CREDIT_CARD: { method: 'CREDIT_CARD', label: 'Cartão de Crédito' },
        CREDITO: { method: 'CREDIT_CARD', label: 'Cartão de Crédito' },
        ONLINE_CARD: { method: 'ONLINE_CARD', label: 'Cartão Online' },
        ONLINE: { method: 'ONLINE_CARD', label: 'Cartão Online' },
      };

      const groupMap = new Map<
        string,
        { paymentMethod: string; label: string; ordersCount: number; totalAmount: number }
      >();

      for (const order of validOrders) {
        const raw = (order.paymentMethod || 'OTHER').toUpperCase().trim();
        const info = labelMap[raw] || { method: 'OTHER', label: 'Outro' };
        const current = groupMap.get(info.method) || {
          paymentMethod: info.method,
          label: info.label,
          ordersCount: 0,
          totalAmount: 0,
        };
        current.ordersCount += 1;
        current.totalAmount += Number(order.total || 0);
        groupMap.set(info.method, current);
      }

      const result = Array.from(groupMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .map((g) => ({
          paymentMethod: g.paymentMethod,
          label: g.label,
          ordersCount: g.ordersCount,
          totalAmount: Number(g.totalAmount.toFixed(2)),
          percentage:
            totalAmountAll > 0 ? Number(((g.totalAmount / totalAmountAll) * 100).toFixed(2)) : 0,
        }));

      res.json(result);
    } catch (err: any) {
      if (err.statusCode === 400) {
        res.status(400).json({ message: err.message });
        return;
      }
      console.error('Erro em getPaymentMethods:', err);
      res
        .status(500)
        .json({ message: 'Não foi possível carregar os métodos de pagamento. Tente novamente.' });
    }
  }

  /**
   * GET /api/admin/reports/cancellations
   * Detalhamento e Análise de Cancelamentos
   */
  static async getCancellations(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = await resolveSecureTenantId(req);
      const period = resolveReportPeriod(req);

      const canceledOrders = await prisma.order.findMany({
        where: {
          tenantId,
          createdAt: { gte: period.startUtc, lte: period.endUtc },
          OR: [
            { status: { in: ['CANCELED', 'CANCELLED', 'REFUNDED'] } },
            { paymentStatus: 'REFUNDED' },
          ],
        },
        select: {
          id: true,
          createdAt: true,
          total: true,
          notes: true,
          fulfillmentType: true,
          paymentMethod: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const totalCanceledAmount = canceledOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);

      const list = canceledOrders.map((o) => ({
        id: o.id,
        createdAt: o.createdAt.toISOString(),
        total: Number(Number(o.total || 0).toFixed(2)),
        notes: o.notes || 'Sem motivo registrado',
        fulfillmentType: o.fulfillmentType,
        paymentMethod: o.paymentMethod || 'Não informado',
      }));

      res.json({
        totalCanceledOrders: canceledOrders.length,
        totalCanceledAmount: Number(totalCanceledAmount.toFixed(2)),
        recentCancellations: list,
      });
    } catch (err: any) {
      if (err.statusCode === 400) {
        res.status(400).json({ message: err.message });
        return;
      }
      console.error('Erro em getCancellations:', err);
      res
        .status(500)
        .json({ message: 'Não foi possível carregar os dados de cancelamento. Tente novamente.' });
    }
  }
}
