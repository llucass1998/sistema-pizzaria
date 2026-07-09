/**
 * FinancialAnalyticsService — Sprint 3
 *
 * Camada Gerencial Financeira com Padrão ERP:
 * - Resumo Executivo com KPIs e variação % vs período anterior.
 * - Fluxo de Caixa Consolidado separando Realizado vs Previsto.
 * - DRE Simplificado com cálculo de CMV seguro sem invenção de custos.
 * - Conciliação Financeira por meio de pagamento sem duplicar faturamento com Caixa Físico.
 * - Motor de Alertas Operacionais e Financeiros.
 * - Suporte nativo ao timezone comercial do Brasil (America/Sao_Paulo).
 */

import { basePrisma } from '../lib/prisma.js';
import { parsePeriodDateRange, FinancialPeriod } from '../utils/timezone.js';

export interface CmvAnalysis {
  cmvTotal: number;
  cmvStatus: 'COMPLETED' | 'PARTIAL' | 'UNAVAILABLE';
  productsWithoutCost: Array<{ id: string; name: string; reason: string }>;
  reliablePercentage: number;
}

export class FinancialAnalyticsService {
  /**
   * 1. Resumo Executivo Financeiro (Dashboard)
   */
  static async getFinancialSummary(
    tenantId: string,
    period: FinancialPeriod | string = 'TODAY',
    startDate?: string,
    endDate?: string,
  ) {
    const currentRange = parsePeriodDateRange(period, startDate, endDate);

    // Calcular período anterior com mesma duração para variação %
    const durationMs = currentRange.endUtc.getTime() - currentRange.startUtc.getTime();
    const prevEndUtc = new Date(currentRange.startUtc.getTime() - 1);
    const prevStartUtc = new Date(prevEndUtc.getTime() - durationMs);

    // Queries do período atual
    const [currentOrders, currentPayables, currentPayments, currentShifts] = await Promise.all([
      basePrisma.order.findMany({
        where: {
          tenantId,
          createdAt: { gte: currentRange.startUtc, lte: currentRange.endUtc },
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  recipes: {
                    include: {
                      ingredient: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      basePrisma.accountPayable.findMany({
        where: {
          tenantId,
          dueDate: { gte: currentRange.startUtc, lte: currentRange.endUtc },
        },
      }),
      basePrisma.payablePayment.findMany({
        where: {
          accountPayable: { tenantId },
          paidAt: { gte: currentRange.startUtc, lte: currentRange.endUtc },
        },
      }),
      basePrisma.shift.findMany({
        where: {
          tenantId,
          startTime: { gte: currentRange.startUtc, lte: currentRange.endUtc },
        },
      }),
    ]);

    // Queries do período anterior (para variação %)
    const [prevOrders, prevPayments] = await Promise.all([
      basePrisma.order.findMany({
        where: {
          tenantId,
          createdAt: { gte: prevStartUtc, lte: prevEndUtc },
        },
      }),
      basePrisma.payablePayment.findMany({
        where: {
          accountPayable: { tenantId },
          paidAt: { gte: prevStartUtc, lte: prevEndUtc },
        },
      }),
    ]);

    // Separação rigorosa de receita realizada vs cancelada vs pendente
    const paidOrders = currentOrders.filter(
      (o) =>
        o.status !== 'CANCELED' &&
        (o.paymentStatus === 'PAID' || o.paymentStatus === 'PARTIALLY_PAID'),
    );
    const canceledOrders = currentOrders.filter((o) => o.status === 'CANCELED');
    const pendingOrders = currentOrders.filter(
      (o) => o.status !== 'CANCELED' && (o.paymentStatus === 'PENDING' || !o.paymentStatus),
    );

    const prevPaidOrders = prevOrders.filter(
      (o) =>
        o.status !== 'CANCELED' &&
        (o.paymentStatus === 'PAID' || o.paymentStatus === 'PARTIALLY_PAID'),
    );

    // Cálculos de Receita
    const grossRevenue = paidOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);
    const canceledAmount = canceledOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);
    const netRevenue = grossRevenue; // Receita líquida operacional (pedidos pagos confirmados)

    const prevGrossRevenue = prevPaidOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);
    const revenueGrowth =
      prevGrossRevenue > 0 ? ((grossRevenue - prevGrossRevenue) / prevGrossRevenue) * 100 : 0;

    // Recebimentos (Entradas Realizadas) vs Previsão a Receber
    const totalReceived = grossRevenue;
    const totalReceivable = pendingOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);

    // Despesas e Saídas Realizadas vs Previstas
    const paidExpenses = currentPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const prevPaidExpenses = prevPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const expenseGrowth =
      prevPaidExpenses > 0 ? ((paidExpenses - prevPaidExpenses) / prevPaidExpenses) * 100 : 0;

    const totalPayablePending = currentPayables
      .filter((p) => p.status === 'PENDING' || p.status === 'OVERDUE')
      .reduce((acc, p) => acc + Number(p.remainingAmount || 0), 0);

    // CMV Seguro (Cálculo Ficha Técnica sem inventar custos)
    const cmvAnalysis = this.calculateSafeCmv(paidOrders);

    // Lucros e Margens
    const estimatedProfit = netRevenue - cmvAnalysis.cmvTotal - paidExpenses;
    const estimatedMargin = netRevenue > 0 ? (estimatedProfit / netRevenue) * 100 : 0;

    // Ticket Médio
    const orderCount = paidOrders.length;
    const averageTicket = orderCount > 0 ? grossRevenue / orderCount : 0;

    // Saldo de Caixa Físico nos Turnos
    const cashRegisterBalance = currentShifts.reduce(
      (acc, s) => acc + Number(s.actualClosingCash || s.expectedClosingCash || s.openingCash || 0),
      0,
    );

    // Mix por forma de pagamento
    const paymentMethodBreakdown: Record<string, number> = {};
    for (const order of paidOrders) {
      const method = order.paymentMethod || 'OTHER';
      paymentMethodBreakdown[method] =
        (paymentMethodBreakdown[method] || 0) + Number(order.total || 0);
    }

    return {
      period: currentRange,
      kpis: {
        grossRevenue,
        netRevenue,
        totalReceived,
        totalReceivable,
        totalPayable: totalPayablePending,
        paidExpenses,
        estimatedProfit,
        estimatedMargin,
        averageTicket,
        orderCount,
        canceledCount: canceledOrders.length,
        canceledAmount,
        cashRegisterBalance,
        revenueGrowth,
        expenseGrowth,
      },
      cmv: cmvAnalysis,
      paymentMethods: paymentMethodBreakdown,
      transparencyNote:
        cmvAnalysis.cmvStatus !== 'COMPLETED'
          ? 'Atenção: O CMV e o Lucro estão marcados como parciais/estimados pois há itens vendidos sem ficha técnica ou custo de insumo cadastrado.'
          : 'CMV 100% confiável baseado nas fichas técnicas e custos de insumos ativos.',
    };
  }

  /**
   * 2. Fluxo de Caixa Consolidado (Realizado vs Previsto)
   */
  static async getCashFlow(
    tenantId: string,
    period: FinancialPeriod | string = 'LAST_30_DAYS',
    startDate?: string,
    endDate?: string,
  ) {
    const range = parsePeriodDateRange(period, startDate, endDate);

    // Buscar ordens pagas (Entradas Realizadas) e pendentes (Entradas Previstas)
    const orders = await basePrisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: range.startUtc, lte: range.endUtc },
        status: { not: 'CANCELED' },
      },
      select: { id: true, total: true, paymentStatus: true, createdAt: true, paymentMethod: true },
      orderBy: { createdAt: 'asc' },
    });

    // Buscar contas a pagar (Saídas Previstas e Realizadas via pagamentos)
    const payables = await basePrisma.accountPayable.findMany({
      where: {
        tenantId,
        dueDate: { gte: range.startUtc, lte: range.endUtc },
      },
      include: {
        payments: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    // Buscar movimentações de caixa físico (Sangria / Suprimento) para auditoria, sem duplicar receita
    const cashTransactions = await basePrisma.cashTransaction.findMany({
      where: {
        shift: { tenantId },
        createdAt: { gte: range.startUtc, lte: range.endUtc },
        type: { in: ['SANGRIA', 'SUPRIMENTO'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    let realizedInflow = 0;
    let realizedOutflow = 0;
    let predictedInflow = 0;
    let predictedOutflow = 0;
    let physicalSangria = 0;
    let physicalSuprimento = 0;

    const entries: Array<{
      date: Date;
      type:
        | 'INFLOW_REALIZED'
        | 'INFLOW_PREDICTED'
        | 'OUTFLOW_REALIZED'
        | 'OUTFLOW_PREDICTED'
        | 'PHYSICAL_MOVEMENT';
      category: string;
      description: string;
      amount: number;
      isRealized: boolean;
    }> = [];

    // Processar ordens
    for (const o of orders) {
      const val = Number(o.total || 0);
      if (o.paymentStatus === 'PAID' || o.paymentStatus === 'PARTIALLY_PAID') {
        realizedInflow += val;
        entries.push({
          date: o.createdAt,
          type: 'INFLOW_REALIZED',
          category: 'Vendas',
          description: `Pedido #${o.id.slice(0, 8)} (${o.paymentMethod || 'Diversos'})`,
          amount: val,
          isRealized: true,
        });
      } else {
        predictedInflow += val;
        entries.push({
          date: o.createdAt,
          type: 'INFLOW_PREDICTED',
          category: 'A Receber',
          description: `Pedido pendente #${o.id.slice(0, 8)}`,
          amount: val,
          isRealized: false,
        });
      }
    }

    // Processar Contas a Pagar
    for (const p of payables) {
      const paid = p.payments.reduce((acc, pay) => acc + Number(pay.amount || 0), 0);
      const remaining = Number(p.remainingAmount || 0);

      if (paid > 0) {
        realizedOutflow += paid;
        for (const pay of p.payments) {
          entries.push({
            date: pay.paidAt,
            type: 'OUTFLOW_REALIZED',
            category: p.category || 'Despesa Operacional',
            description: `Pagamento Conta a Pagar #${p.id.slice(0, 8)}`,
            amount: Number(pay.amount),
            isRealized: true,
          });
        }
      }

      if (remaining > 0 && (p.status === 'PENDING' || p.status === 'OVERDUE')) {
        predictedOutflow += remaining;
        entries.push({
          date: p.dueDate,
          type: 'OUTFLOW_PREDICTED',
          category: p.category || 'Despesa Prevista',
          description: `Previsão Conta #${p.id.slice(0, 8)} (${p.status === 'OVERDUE' ? 'VENCIDA' : 'A Vencer'})`,
          amount: remaining,
          isRealized: false,
        });
      }
    }

    // Processar Sangrias e Suprimentos (Apenas para auditoria física do caixa)
    for (const ct of cashTransactions) {
      const val = Number(ct.amount || 0);
      if (ct.type === 'SANGRIA') physicalSangria += val;
      if (ct.type === 'SUPRIMENTO') physicalSuprimento += val;

      entries.push({
        date: ct.createdAt,
        type: 'PHYSICAL_MOVEMENT',
        category: ct.type,
        description: `Movimento de Caixa Balcão: ${ct.type}`,
        amount: val,
        isRealized: true,
      });
    }

    // Ordenar cronologicamente
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const realizedBalance = realizedInflow - realizedOutflow;
    const projectedBalance = realizedBalance + predictedInflow - predictedOutflow;

    return {
      period: range,
      summary: {
        realizedInflow,
        realizedOutflow,
        realizedBalance,
        predictedInflow,
        predictedOutflow,
        projectedBalance,
        physicalSangria,
        physicalSuprimento,
      },
      entries,
      ruleDocumentation:
        'Nota de Segurança: O Fluxo de Caixa separa estritamente o Realizado (caixa recebido/pago) do Previsto. Pedidos pendentes e faturas a receber não somam saldo disponível. Sangrias e suprimentos são movimentações de gaveta física, não alterando a receita operacional.',
    };
  }

  /**
   * 3. DRE Simplificado
   */
  static async getDRE(
    tenantId: string,
    period: FinancialPeriod | string = 'MONTH',
    startDate?: string,
    endDate?: string,
  ) {
    const range = parsePeriodDateRange(period, startDate, endDate);

    const [orders, payables] = await Promise.all([
      basePrisma.order.findMany({
        where: {
          tenantId,
          createdAt: { gte: range.startUtc, lte: range.endUtc },
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  recipes: {
                    include: { ingredient: true },
                  },
                },
              },
            },
          },
        },
      }),
      basePrisma.accountPayable.findMany({
        where: {
          tenantId,
          status: { in: ['PAID', 'PARTIALLY_PAID'] },
        },
        include: {
          payments: {
            where: {
              paidAt: { gte: range.startUtc, lte: range.endUtc },
            },
          },
        },
      }),
    ]);

    const paidOrders = orders.filter(
      (o) =>
        o.status !== 'CANCELED' &&
        (o.paymentStatus === 'PAID' || o.paymentStatus === 'PARTIALLY_PAID'),
    );
    const canceledOrders = orders.filter((o) => o.status === 'CANCELED');

    const grossRevenue = paidOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);
    const canceledAmount = canceledOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);
    const netRevenue = grossRevenue;

    const cmvAnalysis = this.calculateSafeCmv(paidOrders);
    const grossProfit = netRevenue - cmvAnalysis.cmvTotal;
    const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    // Agrupar despesas pagas por categoria
    const expensesByCategory: Record<string, number> = {};
    let totalExpenses = 0;

    for (const p of payables) {
      const paidInPeriod = p.payments.reduce((acc, pay) => acc + Number(pay.amount || 0), 0);
      if (paidInPeriod > 0) {
        const cat = p.category || 'GERAL_OPERACIONAL';
        expensesByCategory[cat] = (expensesByCategory[cat] || 0) + paidInPeriod;
        totalExpenses += paidInPeriod;
      }
    }

    const operatingProfit = grossProfit - totalExpenses;
    const operatingMargin = netRevenue > 0 ? (operatingProfit / netRevenue) * 100 : 0;

    return {
      period: range,
      dre: {
        grossRevenue,
        canceledAmount,
        netRevenue,
        cmv: cmvAnalysis.cmvTotal,
        cmvStatus: cmvAnalysis.cmvStatus,
        grossProfit,
        grossMargin,
        expensesByCategory,
        totalExpenses,
        operatingProfit,
        operatingMargin,
      },
      productsWithoutCost: cmvAnalysis.productsWithoutCost,
      accountingNote:
        cmvAnalysis.cmvStatus !== 'COMPLETED'
          ? 'Margens marcadas como (Estimada/Parcial) devido a produtos sem ficha técnica ou insumos com custo R$ 0,00 cadastrados no estoque.'
          : 'DRE 100% apurado sobre custos de estoque confiáveis e despesas operacionais liquidadas.',
    };
  }

  /**
   * 4. Conciliação Financeira por Método de Pagamento vs Gaveta de Caixa
   */
  static async getReconciliation(
    tenantId: string,
    period: FinancialPeriod | string = 'TODAY',
    startDate?: string,
    endDate?: string,
  ) {
    const range = parsePeriodDateRange(period, startDate, endDate);

    const [orders, shifts] = await Promise.all([
      basePrisma.order.findMany({
        where: {
          tenantId,
          createdAt: { gte: range.startUtc, lte: range.endUtc },
        },
      }),
      basePrisma.shift.findMany({
        where: {
          tenantId,
          startTime: { gte: range.startUtc, lte: range.endUtc },
        },
        include: {
          transactions: true,
        },
      }),
    ]);

    const methods = [
      'CASH',
      'PIX',
      'CREDIT_CARD',
      'DEBIT_CARD',
      'VOUCHER',
      'ONLINE',
      'RECEIVABLE',
      'OTHER',
    ];
    const breakdown: Record<
      string,
      { sold: number; received: number; pending: number; canceled: number; count: number }
    > = {};

    for (const m of methods) {
      breakdown[m] = { sold: 0, received: 0, pending: 0, canceled: 0, count: 0 };
    }

    for (const o of orders) {
      const method = (o.paymentMethod || 'OTHER').toUpperCase();
      const mKey = breakdown[method] ? method : 'OTHER';
      const val = Number(o.total || 0);

      breakdown[mKey].count += 1;

      if (o.status === 'CANCELED') {
        breakdown[mKey].canceled += val;
      } else if (o.paymentStatus === 'PAID' || o.paymentStatus === 'PARTIALLY_PAID') {
        breakdown[mKey].sold += val;
        breakdown[mKey].received += val;
      } else {
        breakdown[mKey].sold += val;
        breakdown[mKey].pending += val;
      }
    }

    // Auditoria de Caixa Físico (Dinheiro no Sistema vs Dinheiro na Gaveta)
    let totalOpeningCash = 0;
    let totalExpectedCash = 0;
    let totalActualCash = 0;
    let totalCashDifference = 0;
    let totalSangria = 0;
    let totalSuprimento = 0;
    let totalPosSalesCash = 0;

    for (const s of shifts) {
      totalOpeningCash += Number(s.openingCash || 0);
      totalExpectedCash += Number(s.expectedClosingCash || 0);
      totalActualCash += Number(s.actualClosingCash || 0);
      totalCashDifference += Number(s.difference || 0);

      for (const ct of s.transactions || []) {
        const val = Number(ct.amount || 0);
        if (ct.type === 'SANGRIA') totalSangria += val;
        if (ct.type === 'SUPRIMENTO') totalSuprimento += val;
        if (ct.type === 'SALE') totalPosSalesCash += val;
      }
    }

    return {
      period: range,
      byMethod: breakdown,
      physicalCashAudit: {
        shiftsCount: shifts.length,
        systemCashSales: breakdown['CASH']?.received || 0,
        posRecordedCashSales: totalPosSalesCash,
        totalOpeningCash,
        totalSangria,
        totalSuprimento,
        totalExpectedCash,
        totalActualCash,
        totalCashDifference,
      },
      reconciliationNote:
        'O método CASH cruza as vendas confirmadas em dinheiro com as movimentações reais de gaveta (Shifts). Pagamentos PIX e Cartões necessitam de conferência com o extrato da adquirente.',
    };
  }

  /**
   * 5. Alertas Inteligentes Financeiros e Operacionais
   */
  static async getFinancialAlerts(tenantId: string) {
    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 86400000);
    const twelveHoursAgo = new Date(now.getTime() - 12 * 3600000);
    const fortyFiveMinAgo = new Date(now.getTime() - 45 * 60000);

    const [
      overduePayables,
      dueSoonPayables,
      longOpenShifts,
      closedShiftsDiff,
      recentOrders,
      lowStockIngredients,
    ] = await Promise.all([
      basePrisma.accountPayable.findMany({
        where: {
          tenantId,
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { lt: now },
        },
        take: 5,
      }),
      basePrisma.accountPayable.findMany({
        where: {
          tenantId,
          status: 'PENDING',
          dueDate: { gte: now, lte: next7Days },
        },
        take: 5,
      }),
      basePrisma.shift.findMany({
        where: {
          tenantId,
          status: 'OPEN',
          startTime: { lt: twelveHoursAgo },
        },
        take: 3,
      }),
      basePrisma.shift.findMany({
        where: {
          tenantId,
          status: 'CLOSED',
          difference: { not: 0 },
        },
        orderBy: { endTime: 'desc' },
        take: 3,
      }),
      basePrisma.order.findMany({
        where: {
          tenantId,
          status: 'PREPARING',
          updatedAt: { lt: fortyFiveMinAgo },
        },
        take: 5,
      }),
      basePrisma.ingredient.findMany({
        where: {
          tenantId,
        },
        take: 10,
      }),
    ]);

    const criticalStock = lowStockIngredients.filter((i) => Number(i.stock) <= Number(i.minStock));

    const alerts: Array<{
      id: string;
      type: 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';
      title: string;
      message: string;
      actionUrl?: string;
    }> = [];

    // Alertas de Contas Vencidas
    for (const p of overduePayables) {
      alerts.push({
        id: `overdue-${p.id}`,
        type: 'CRITICAL',
        title: 'Conta a Pagar Vencida',
        message: `A despesa #${p.id.slice(0, 6)} de R$ ${Number(p.remainingAmount || p.amount).toFixed(2)} venceu em ${p.dueDate.toLocaleDateString('pt-BR')}.`,
        actionUrl: '/admin/payables',
      });
    }

    // Alertas de Contas a Vencer
    for (const p of dueSoonPayables) {
      alerts.push({
        id: `due-${p.id}`,
        type: 'WARNING',
        title: 'Despesa Próxima do Vencimento',
        message: `Conta #${p.id.slice(0, 6)} de R$ ${Number(p.remainingAmount || p.amount).toFixed(2)} vence em até 7 dias (${p.dueDate.toLocaleDateString('pt-BR')}).`,
        actionUrl: '/admin/payables',
      });
    }

    // Turnos de Caixa Abertos por muito tempo
    for (const s of longOpenShifts) {
      alerts.push({
        id: `shift-${s.id}`,
        type: 'WARNING',
        title: 'Turno de Caixa Aberto há mais de 12 horas',
        message: `O caixa aberto em ${s.startTime.toLocaleTimeString('pt-BR')} ainda não foi encerrado. Verifique a conferência de turno.`,
        actionUrl: '/admin/caixa',
      });
    }

    // Diferenças de caixa no último fechamento
    for (const s of closedShiftsDiff) {
      const diff = Number(s.difference || 0);
      alerts.push({
        id: `diff-${s.id}`,
        type: diff < 0 ? 'CRITICAL' : 'INFO',
        title: diff < 0 ? 'Quebra de Caixa Detectada' : 'Sobra de Caixa Registrada',
        message: `O fechamento do turno #${s.id.slice(0, 6)} apresentou diferença de R$ ${diff.toFixed(2)}.`,
        actionUrl: '/admin/caixa',
      });
    }

    // Estoque crítico
    for (const i of criticalStock) {
      alerts.push({
        id: `stock-${i.id}`,
        type: 'CRITICAL',
        title: 'Estoque Crítico ou Zera',
        message: `Insumo "${i.name}" está com saldo (${Number(i.stock)} ${i.unit}) no limite mínimo (${Number(i.minStock)} ${i.unit}).`,
        actionUrl: '/admin/inventory',
      });
    }

    // Pedidos parados no KDS
    for (const o of recentOrders) {
      alerts.push({
        id: `kds-${o.id}`,
        type: 'WARNING',
        title: 'Pedido Parado no Preparo',
        message: `O pedido #${o.id.slice(0, 6)} está na cozinha há mais de 45 minutos sem despacho.`,
        actionUrl: '/admin/kds',
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        id: 'all-ok',
        type: 'SUCCESS',
        title: 'Operação e Finanças Saudáveis',
        message:
          'Nenhuma conta vencida, diferença de caixa ou estoque crítico detectado no momento.',
      });
    }

    return alerts;
  }

  /**
   * 6. Dados para Relatórios Gerenciais (Exportação CSV sanitizada / Impressão)
   */
  static async getFinancialReports(
    tenantId: string,
    type: string,
    period: FinancialPeriod | string = 'MONTH',
    startDate?: string,
    endDate?: string,
  ) {
    const range = parsePeriodDateRange(period, startDate, endDate);

    switch (type.toLowerCase()) {
      case 'sales-by-product': {
        const orders = await basePrisma.order.findMany({
          where: {
            tenantId,
            createdAt: { gte: range.startUtc, lte: range.endUtc },
            status: { not: 'CANCELED' },
            paymentStatus: { in: ['PAID', 'PARTIALLY_PAID'] },
          },
          include: {
            items: {
              include: { product: true },
            },
          },
        });

        const map: Record<
          string,
          { name: string; category: string; qty: number; revenue: number }
        > = {};
        for (const o of orders) {
          for (const item of o.items || []) {
            const pid = item.productId;
            const pName = item.product?.name || 'Produto Removido';
            const pCat = item.product?.category || 'Geral';
            const qty = Number(item.quantity || 1);
            const rev = Number((item as any).total || Number(item.unitPrice || 0) * qty);

            if (!map[pid]) map[pid] = { name: pName, category: pCat, qty: 0, revenue: 0 };
            map[pid].qty += qty;
            map[pid].revenue += rev;
          }
        }

        const rows = Object.values(map).map((i) => [i.name, i.category, i.qty, i.revenue]);
        return {
          title: `Relatório de Vendas por Produto (${range.label})`,
          headers: ['Produto', 'Categoria', 'Quantidade Vendida', 'Receita Total (R$)'],
          rows,
        };
      }

      case 'sales-by-method': {
        const orders = await basePrisma.order.findMany({
          where: {
            tenantId,
            createdAt: { gte: range.startUtc, lte: range.endUtc },
            status: { not: 'CANCELED' },
            paymentStatus: { in: ['PAID', 'PARTIALLY_PAID'] },
          },
        });

        const map: Record<string, { count: number; total: number }> = {};
        for (const o of orders) {
          const m = o.paymentMethod || 'OTHER';
          if (!map[m]) map[m] = { count: 0, total: 0 };
          map[m].count += 1;
          map[m].total += Number(o.total || 0);
        }

        const rows = Object.entries(map).map(([method, data]) => [method, data.count, data.total]);
        return {
          title: `Relatório de Vendas por Método de Pagamento (${range.label})`,
          headers: ['Método de Pagamento', 'Qtd. Pedidos', 'Total Recebido (R$)'],
          rows,
        };
      }

      case 'expenses-by-category': {
        const payments = await basePrisma.payablePayment.findMany({
          where: {
            accountPayable: { tenantId },
            paidAt: { gte: range.startUtc, lte: range.endUtc },
          },
          include: { accountPayable: true },
        });

        const map: Record<string, { count: number; total: number }> = {};
        for (const p of payments) {
          const cat = p.accountPayable?.category || 'GERAL_OPERACIONAL';
          if (!map[cat]) map[cat] = { count: 0, total: 0 };
          map[cat].count += 1;
          map[cat].total += Number(p.amount || 0);
        }

        const rows = Object.entries(map).map(([cat, data]) => [cat, data.count, data.total]);
        return {
          title: `Relatório de Despesas por Categoria (${range.label})`,
          headers: ['Categoria', 'Qtd. Pagamentos', 'Total Pago (R$)'],
          rows,
        };
      }

      case 'payables': {
        const payables = await basePrisma.accountPayable.findMany({
          where: {
            tenantId,
            dueDate: { gte: range.startUtc, lte: range.endUtc },
          },
          orderBy: { dueDate: 'asc' },
        });

        const rows = payables.map((p) => [
          p.id.slice(0, 8),
          p.category || 'Geral',
          Number(p.amount),
          Number(p.paidAmount),
          Number(p.remainingAmount),
          p.dueDate.toLocaleDateString('pt-BR'),
          p.status,
        ]);
        return {
          title: `Relatório de Contas a Pagar (${range.label})`,
          headers: [
            'ID',
            'Categoria',
            'Valor Total',
            'Valor Pago',
            'Saldo devedor',
            'Vencimento',
            'Status',
          ],
          rows,
        };
      }

      case 'dre': {
        const dreData = await this.getDRE(tenantId, period, startDate, endDate);
        const rows = [
          ['Receita Bruta Realizada', dreData.dre.grossRevenue],
          ['(-) Cancelamentos / Estornos', dreData.dre.canceledAmount],
          ['(=) Receita Líquida', dreData.dre.netRevenue],
          [
            `(-) CMV (${dreData.dre.cmvStatus === 'COMPLETED' ? 'Confiável' : 'Estimado/Parcial'})`,
            dreData.dre.cmv,
          ],
          ['(=) Lucro Bruto', dreData.dre.grossProfit],
          ['(-) Despesas Operacionais Pagas', dreData.dre.totalExpenses],
          ['(=) Lucro Operacional Estimado', dreData.dre.operatingProfit],
          ['Margem Bruta (%)', `${dreData.dre.grossMargin.toFixed(2)}%`],
          ['Margem Operacional (%)', `${dreData.dre.operatingMargin.toFixed(2)}%`],
        ];
        return {
          title: `DRE Simplificado (${range.label})`,
          headers: ['Linha Contábil', 'Valor (R$ / %)'],
          rows,
        };
      }

      default: {
        return {
          title: `Relatório Geral (${range.label})`,
          headers: ['Status'],
          rows: [['Tipo de relatório não implementado ou inválido']],
        };
      }
    }
  }

  /**
   * Helper Interno: Cálculo Seguro de CMV sem invenção de custos
   */
  private static calculateSafeCmv(orders: any[]): CmvAnalysis {
    let cmvTotal = 0;
    let totalItemsAnalyzed = 0;
    let reliableItemsCount = 0;
    const productsWithoutCostMap = new Map<string, { id: string; name: string; reason: string }>();

    for (const order of orders) {
      const items = order.items || order.orderItems || [];
      for (const item of items) {
        totalItemsAnalyzed += 1;
        const product = item.product;
        const qty = Number(item.quantity || 1);

        if (!product || !product.recipes || product.recipes.length === 0) {
          productsWithoutCostMap.set(product?.id || item.productId, {
            id: product?.id || item.productId,
            name: product?.name || 'Produto sem cadastro',
            reason: 'Ficha técnica não cadastrada',
          });
          continue;
        }

        let itemCmv = 0;
        let hasZeroCostIngredient = false;

        for (const recipe of product.recipes) {
          const ing = recipe.ingredient;
          const recipeQty = Number(recipe.quantity || 0);
          const ingCost = Number(ing?.cost || 0);

          if (!ing || ingCost <= 0) {
            hasZeroCostIngredient = true;
          }

          itemCmv += recipeQty * ingCost;
        }

        if (hasZeroCostIngredient) {
          productsWithoutCostMap.set(product.id, {
            id: product.id,
            name: product.name,
            reason: 'Insumo da ficha com custo R$ 0,00',
          });
        } else {
          reliableItemsCount += 1;
        }

        cmvTotal += itemCmv * qty;
      }
    }

    let cmvStatus: 'COMPLETED' | 'PARTIAL' | 'UNAVAILABLE' = 'COMPLETED';
    if (totalItemsAnalyzed === 0) {
      cmvStatus = 'COMPLETED';
    } else if (reliableItemsCount === 0 && totalItemsAnalyzed > 0) {
      cmvStatus = 'UNAVAILABLE';
    } else if (reliableItemsCount < totalItemsAnalyzed) {
      cmvStatus = 'PARTIAL';
    }

    const reliablePercentage =
      totalItemsAnalyzed > 0 ? Math.round((reliableItemsCount / totalItemsAnalyzed) * 100) : 100;

    return {
      cmvTotal,
      cmvStatus,
      productsWithoutCost: Array.from(productsWithoutCostMap.values()),
      reliablePercentage,
    };
  }
}
