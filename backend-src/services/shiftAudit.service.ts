/**
 * ShiftAuditService — Sprint 1
 *
 * Serviço profissional de auditoria de turnos e caixas do PDV:
 * - Cálculo detalhado de saldo inicial, suprimentos, sangrias e vendas por forma de pagamento.
 * - Cálculo de quebra de caixa (falta ou sobra).
 * - Proteção anti-fraude: trava sangrias superiores ao saldo em dinheiro disponível.
 * - Relatório consolidado de auditoria para o gestor.
 */

import { basePrisma } from '../lib/prisma.js';

type Db = typeof basePrisma;

export interface ShiftSummary {
  id: string;
  cashRegisterName: string;
  operatorName: string;
  status: 'OPEN' | 'CLOSED';
  startTime: Date;
  endTime: Date | null;
  openingCash: number;
  salesByMethod: Record<string, number>;
  totalSales: number;
  sangria: number;
  suprimento: number;
  expectedClosingCash: number;
  actualClosingCash: number | null;
  difference: number | null;
  auditStatus: 'OK' | 'SURPLUS' | 'DEFICIT' | 'IN_PROGRESS';
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string | null;
    paymentMethodId: string | null;
    createdAt: Date;
  }>;
}

function businessError(message: string, statusCode = 400, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(message), { statusCode, ...extra });
}

export class ShiftAuditService {
  /**
   * Calcula o resumo completo de um turno específico.
   */
  static async getShiftSummary(
    tenantId: string,
    shiftId: string,
    db: Db | any = basePrisma,
  ): Promise<ShiftSummary> {
    const shift = await db.shift.findFirst({
      where: { id: shiftId, tenantId },
      include: {
        cashRegister: true,
        admin: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!shift) {
      throw businessError('Turno/Caixa não encontrado.', 404);
    }

    const transactions = Array.isArray(shift.transactions) ? shift.transactions : [];
    const openingCash = Number(shift.openingCash ?? 0);

    // Agrupa vendas por método de pagamento
    const salesByMethod: Record<string, number> = transactions
      .filter((t: any) => t.type === 'SALE')
      .reduce((acc: Record<string, number>, t: any) => {
        const method = (t.paymentMethodId || 'OUTROS').toUpperCase();
        acc[method] = (acc[method] ?? 0) + Number(t.amount ?? 0);
        return acc;
      }, {});

    const totalSales = Object.values(salesByMethod).reduce((sum, val) => sum + val, 0);

    const sangria = transactions
      .filter((t: any) => t.type === 'SANGRIA')
      .reduce((total: number, t: any) => total + Number(t.amount ?? 0), 0);

    const suprimento = transactions
      .filter((t: any) => t.type === 'SUPRIMENTO')
      .reduce((total: number, t: any) => total + Number(t.amount ?? 0), 0);

    // Dinheiro esperado em gaveta = Fundo inicial + Vendas em Dinheiro + Suprimentos - Sangrias
    const cashSales = Number(salesByMethod['CASH'] ?? salesByMethod['DINHEIRO'] ?? 0);
    const expectedClosingCash = Number((openingCash + cashSales + suprimento - sangria).toFixed(2));

    const actualClosingCash =
      shift.actualClosingCash === null || shift.actualClosingCash === undefined
        ? null
        : Number(Number(shift.actualClosingCash).toFixed(2));

    let difference: number | null = null;
    let auditStatus: 'OK' | 'SURPLUS' | 'DEFICIT' | 'IN_PROGRESS' = 'IN_PROGRESS';

    if (actualClosingCash !== null && shift.status === 'CLOSED') {
      difference = Number((actualClosingCash - expectedClosingCash).toFixed(2));
      if (difference < -0.05) {
        auditStatus = 'DEFICIT'; // Quebra de caixa / Falta
      } else if (difference > 0.05) {
        auditStatus = 'SURPLUS'; // Sobra de caixa
      } else {
        auditStatus = 'OK';
      }
    }

    return {
      id: shift.id,
      cashRegisterName: shift.cashRegister?.name || 'Caixa Principal',
      operatorName: shift.admin?.name || shift.admin?.email || 'Operador',
      status: shift.status as 'OPEN' | 'CLOSED',
      startTime: shift.startTime,
      endTime: shift.endTime,
      openingCash,
      salesByMethod,
      totalSales: Number(totalSales.toFixed(2)),
      sangria: Number(sangria.toFixed(2)),
      suprimento: Number(suprimento.toFixed(2)),
      expectedClosingCash,
      actualClosingCash,
      difference,
      auditStatus,
      transactions: transactions.map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount ?? 0),
        description: t.description || null,
        paymentMethodId: t.paymentMethodId || null,
        createdAt: t.createdAt,
      })),
    };
  }

  /**
   * Valida se uma sangria pode ser realizada (anti-fraude / anti-duplicidade).
   * Impede sangria se o valor for maior que o dinheiro disponível na gaveta.
   */
  static async validateSangria(
    tenantId: string,
    shiftId: string,
    amount: number,
    db: Db | any = basePrisma,
  ): Promise<void> {
    if (amount <= 0) {
      throw businessError('O valor da sangria deve ser maior que zero.', 422);
    }

    const summary = await this.getShiftSummary(tenantId, shiftId, db);

    if (summary.status === 'CLOSED') {
      throw businessError('Não é possível realizar sangria em um caixa fechado.', 400);
    }

    if (amount > summary.expectedClosingCash) {
      throw businessError(
        `Saldo em caixa insuficiente para esta sangria. Saldo em dinheiro disponível: R$ ${summary.expectedClosingCash.toFixed(2)}`,
        422,
      );
    }
  }

  /**
   * Retorna relatório consolidado de auditoria de turnos.
   */
  static async getAuditReport(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; cashRegisterId?: string } = {},
    db: Db | any = basePrisma,
  ) {
    const where: any = { tenantId };

    if (filters.cashRegisterId && filters.cashRegisterId !== 'ALL') {
      where.cashRegisterId = filters.cashRegisterId;
    }

    if (filters.startDate || filters.endDate) {
      where.startTime = {};
      if (filters.startDate) where.startTime.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.startTime.lte = end;
      }
    }

    const shifts = await db.shift.findMany({
      where,
      orderBy: { startTime: 'desc' },
    });

    const summaries = await Promise.all(
      shifts.map((s: any) => this.getShiftSummary(tenantId, s.id, db)),
    );

    const totalShifts = summaries.length;
    const closedShifts = summaries.filter((s) => s.status === 'CLOSED').length;
    const totalSales = summaries.reduce((sum, s) => sum + s.totalSales, 0);
    const totalSangria = summaries.reduce((sum, s) => sum + s.sangria, 0);
    const totalSuprimento = summaries.reduce((sum, s) => sum + s.suprimento, 0);
    const netDifference = summaries.reduce((sum, s) => sum + (s.difference || 0), 0);

    const deficitShiftsCount = summaries.filter((s) => s.auditStatus === 'DEFICIT').length;
    const surplusShiftsCount = summaries.filter((s) => s.auditStatus === 'SURPLUS').length;

    return {
      kpis: {
        totalShifts,
        closedShifts,
        totalSales: Number(totalSales.toFixed(2)),
        totalSangria: Number(totalSangria.toFixed(2)),
        totalSuprimento: Number(totalSuprimento.toFixed(2)),
        netDifference: Number(netDifference.toFixed(2)),
        deficitShiftsCount,
        surplusShiftsCount,
      },
      shifts: summaries,
    };
  }
}
