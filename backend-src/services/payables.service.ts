/**
 * PayablesService — Sprint 1
 *
 * Gestão profissional de Contas a Pagar com padrão ERP:
 * - Isolamento estrito por tenantId (Skill: prisma-tenant-query).
 * - Validações de negócio de saldo e quitação.
 * - Pagamentos parciais e totais com transações atômicas ($transaction).
 * - Transição automática de status para Vencido (OVERDUE).
 * - KPIs executivos financeiros.
 */

import { basePrisma } from '../lib/prisma.js';
import { Prisma } from '../../generated/prisma/index.js';

type Db = typeof basePrisma;

export interface CreatePayableInput {
  tenantId: string;
  supplierId?: string | null;
  description: string;
  category:
    | 'SUPPLIER'
    | 'RENT'
    | 'ENERGY'
    | 'WATER'
    | 'INTERNET'
    | 'SALARY'
    | 'MARKETING'
    | 'TAX'
    | 'MAINTENANCE'
    | 'OTHER';
  amount: number;
  dueDate: Date | string;
  recurrenceType?: 'NONE' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  notes?: string | null;
}

export interface RecordPayablePaymentInput {
  tenantId: string;
  accountPayableId: string;
  amount: number;
  paymentMethod: string;
  notes?: string | null;
  paidAt?: Date | string;
}

export interface PayablesFilter {
  status?: string;
  category?: string;
  supplierId?: string;
  search?: string;
}

function businessError(message: string, statusCode = 400, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(message), { statusCode, ...extra });
}

export class PayablesService {
  /**
   * Atualiza automaticamente contas pendentes/parciais cuja data de vencimento já passou para OVERDUE.
   */
  static async checkAndMarkOverdue(tenantId: string, db: Db | any = basePrisma): Promise<void> {
    const now = new Date();
    await db.accountPayable.updateMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        dueDate: { lt: now },
      },
      data: {
        status: 'OVERDUE',
      },
    });
  }

  /**
   * Cria uma nova conta a pagar.
   */
  static async createPayable(input: CreatePayableInput, db: Db | any = basePrisma) {
    if (input.amount <= 0) {
      throw businessError('O valor da despesa deve ser maior que zero.', 422);
    }

    if (!input.description || input.description.trim() === '') {
      throw businessError('A descrição da despesa é obrigatória.', 422);
    }

    const dueDateObj = new Date(input.dueDate);
    if (isNaN(dueDateObj.getTime())) {
      throw businessError('Data de vencimento inválida.', 422);
    }

    const amountDec = new Prisma.Decimal(input.amount);

    return db.accountPayable.create({
      data: {
        tenantId: input.tenantId,
        supplierId: input.supplierId || null,
        description: input.description.trim(),
        category: input.category,
        amount: amountDec,
        paidAmount: new Prisma.Decimal(0),
        remainingAmount: amountDec,
        dueDate: dueDateObj,
        status: 'PENDING',
        recurrenceType: input.recurrenceType || 'NONE',
        notes: input.notes || null,
      },
      include: {
        supplier: true,
      },
    });
  }

  /**
   * Lista contas a pagar com filtros e suporte a pesquisa.
   */
  static async getPayables(
    tenantId: string,
    filters: PayablesFilter = {},
    db: Db | any = basePrisma,
  ) {
    await this.checkAndMarkOverdue(tenantId, db);

    const where: any = { tenantId };

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }

    if (filters.category && filters.category !== 'ALL') {
      where.category = filters.category;
    }

    if (filters.supplierId && filters.supplierId !== 'ALL') {
      where.supplierId = filters.supplierId;
    }

    if (filters.search && filters.search.trim() !== '') {
      const search = filters.search.trim();
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return db.accountPayable.findMany({
      where,
      include: {
        supplier: true,
        payments: {
          orderBy: { paidAt: 'desc' },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Busca uma conta por ID com isolamento multi-tenant.
   */
  static async getPayableById(tenantId: string, id: string, db: Db | any = basePrisma) {
    await this.checkAndMarkOverdue(tenantId, db);

    const payable = await db.accountPayable.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        payments: {
          orderBy: { paidAt: 'desc' },
        },
      },
    });

    if (!payable) {
      throw businessError('Conta a pagar não encontrada.', 404);
    }

    return payable;
  }

  /**
   * Registra um pagamento (parcial ou total) de forma atômica.
   */
  static async recordPayment(input: RecordPayablePaymentInput, db: Db | any = basePrisma) {
    if (input.amount <= 0) {
      throw businessError('O valor do pagamento deve ser maior que zero.', 422);
    }

    if (!input.paymentMethod || input.paymentMethod.trim() === '') {
      throw businessError('O método de pagamento é obrigatório.', 422);
    }

    const paidAtObj = input.paidAt ? new Date(input.paidAt) : new Date();

    return db.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM "AccountPayable" WHERE id = ${input.accountPayableId} AND "tenantId" = ${input.tenantId} FOR UPDATE`;

      const payable = await tx.accountPayable.findFirst({
        where: { id: input.accountPayableId, tenantId: input.tenantId },
      });

      if (!payable) {
        throw businessError('Conta a pagar não encontrada.', 404);
      }

      if (payable.status === 'CANCELED') {
        throw businessError('Não é possível realizar pagamentos em uma despesa cancelada.', 400);
      }

      if (payable.status === 'PAID') {
        throw businessError('Esta despesa já foi totalmente quitada.', 400);
      }

      const paymentDec = new Prisma.Decimal(input.amount);
      const currentRemaining = new Prisma.Decimal(payable.remainingAmount.toString());
      const currentPaid = new Prisma.Decimal(payable.paidAmount.toString());

      if (paymentDec.greaterThan(currentRemaining)) {
        throw businessError(
          `O valor do pagamento (R$ ${input.amount.toFixed(2)}) é maior que o saldo devedor (R$ ${Number(currentRemaining).toFixed(2)}).`,
          422,
        );
      }

      const newPaidAmount = currentPaid.plus(paymentDec);
      const newRemainingAmount = currentRemaining.minus(paymentDec);

      const isFullyPaid = newRemainingAmount.equals(0);
      const newStatus = isFullyPaid ? 'PAID' : 'PARTIALLY_PAID';
      const newPaidAt = isFullyPaid ? paidAtObj : payable.paidAt;

      // Cria registro do pagamento
      await tx.payablePayment.create({
        data: {
          tenantId: input.tenantId,
          accountPayableId: input.accountPayableId,
          amount: paymentDec,
          paymentMethod: input.paymentMethod.trim(),
          paidAt: paidAtObj,
          notes: input.notes || null,
        },
      });

      // Atualiza a conta a pagar
      const updatedPayable = await tx.accountPayable.update({
        where: { id: input.accountPayableId },
        data: {
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
          paidAt: newPaidAt,
        },
        include: {
          supplier: true,
          payments: {
            orderBy: { paidAt: 'desc' },
          },
        },
      });

      return updatedPayable;
    });
  }

  /**
   * Cancela uma conta a pagar.
   */
  static async cancelPayable(tenantId: string, id: string, db: Db | any = basePrisma) {
    const payable = await db.accountPayable.findFirst({
      where: { id, tenantId },
    });

    if (!payable) {
      throw businessError('Conta a pagar não encontrada.', 404);
    }

    if (payable.status === 'PAID') {
      throw businessError('Não é possível cancelar uma despesa já quitada.', 400);
    }

    if (payable.status === 'CANCELED') {
      throw businessError('Esta despesa já está cancelada.', 400);
    }

    return db.accountPayable.update({
      where: { id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
      },
      include: {
        supplier: true,
        payments: true,
      },
    });
  }

  /**
   * Retorna os KPIs executivos consolidados de Contas a Pagar.
   */
  static async getPayablesSummary(tenantId: string, db: Db | any = basePrisma) {
    await this.checkAndMarkOverdue(tenantId, db);

    const now = new Date();
    const in7Days = new Date();
    in7Days.setDate(now.getDate() + 7);

    const in30Days = new Date();
    in30Days.setDate(now.getDate() + 30);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Consulta de total vencido
    const overdueAgg = await db.accountPayable.aggregate({
      where: { tenantId, status: 'OVERDUE' },
      _sum: { remainingAmount: true },
    });

    // Vence em até 7 dias
    const due7DaysAgg = await db.accountPayable.aggregate({
      where: {
        tenantId,
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        dueDate: { gte: now, lte: in7Days },
      },
      _sum: { remainingAmount: true },
    });

    // Vence em até 30 dias
    const due30DaysAgg = await db.accountPayable.aggregate({
      where: {
        tenantId,
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        dueDate: { gte: now, lte: in30Days },
      },
      _sum: { remainingAmount: true },
    });

    // Total geral pendente (PENDING, PARTIALLY_PAID, OVERDUE)
    const pendingAgg = await db.accountPayable.aggregate({
      where: {
        tenantId,
        status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      _sum: { remainingAmount: true },
    });

    // Pago neste mês (soma de pagamentos na tabela PayablePayment)
    const paidMonthAgg = await db.payablePayment.aggregate({
      where: {
        tenantId,
        paidAt: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
    });

    return {
      totalOverdue: Number(overdueAgg._sum.remainingAmount || 0),
      dueIn7Days: Number(due7DaysAgg._sum.remainingAmount || 0),
      dueIn30Days: Number(due30DaysAgg._sum.remainingAmount || 0),
      totalPending: Number(pendingAgg._sum.remainingAmount || 0),
      paidThisMonth: Number(paidMonthAgg._sum.amount || 0),
    };
  }
}
