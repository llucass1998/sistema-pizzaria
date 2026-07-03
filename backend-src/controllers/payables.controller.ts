/**
 * PayablesController — Sprint 1
 *
 * Endpoints profissionais para gestão de Contas a Pagar:
 * - Validação estrita com Zod.
 * - Extração segura de tenantId via contexto.
 * - Delegação da lógica de negócio para PayablesService.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { getTenantId } from '../core/context/TenantContext.js';
import { PayablesService } from '../services/payables.service.js';

const PAYABLE_CATEGORIES = [
  'SUPPLIER',
  'RENT',
  'ENERGY',
  'WATER',
  'INTERNET',
  'SALARY',
  'MARKETING',
  'TAX',
  'MAINTENANCE',
  'OTHER',
] as const;

const RECURRENCE_TYPES = ['NONE', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;

const createPayableSchema = z.object({
  supplierId: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1, 'A descrição é obrigatória.'),
  category: z.enum(PAYABLE_CATEGORIES, {
    message: 'Categoria de despesa inválida.',
  }),
  amount: z.number().positive('O valor deve ser maior que zero.'),
  dueDate: z.string().min(1, 'A data de vencimento é obrigatória.'),
  recurrenceType: z.enum(RECURRENCE_TYPES).optional(),
  notes: z.string().trim().nullable().optional(),
});

const recordPaymentSchema = z.object({
  amount: z.number().positive('O valor do pagamento deve ser maior que zero.'),
  paymentMethod: z.string().trim().min(1, 'O método de pagamento é obrigatório.'),
  notes: z.string().trim().nullable().optional(),
  paidAt: z.string().optional(),
});

export const PayablesController = {
  /**
   * POST /api/admin/payables
   */
  async createPayable(req: Request, res: Response) {
    const tenantId = getTenantId();
    const payload = createPayableSchema.parse(req.body);

    const payable = await PayablesService.createPayable({
      tenantId,
      supplierId: payload.supplierId || null,
      description: payload.description,
      category: payload.category,
      amount: payload.amount,
      dueDate: payload.dueDate,
      recurrenceType: payload.recurrenceType || 'NONE',
      notes: payload.notes || null,
    });

    res.status(201).json(payable);
  },

  /**
   * GET /api/admin/payables
   */
  async getPayables(req: Request, res: Response) {
    const tenantId = getTenantId();
    const { status, category, supplierId, search } = req.query;

    const payables = await PayablesService.getPayables(tenantId, {
      status: status ? String(status) : undefined,
      category: category ? String(category) : undefined,
      supplierId: supplierId ? String(supplierId) : undefined,
      search: search ? String(search) : undefined,
    });

    res.json(payables);
  },

  /**
   * GET /api/admin/payables/summary
   */
  async getPayablesSummary(_req: Request, res: Response) {
    const tenantId = getTenantId();
    const summary = await PayablesService.getPayablesSummary(tenantId);
    res.json(summary);
  },

  /**
   * GET /api/admin/payables/:id
   */
  async getPayableById(req: Request, res: Response) {
    const tenantId = getTenantId();
    const id = String(req.params['id']);
    const payable = await PayablesService.getPayableById(tenantId, id);
    res.json(payable);
  },

  /**
   * POST /api/admin/payables/:id/payments
   */
  async recordPayment(req: Request, res: Response) {
    const tenantId = getTenantId();
    const accountPayableId = String(req.params['id']);
    const payload = recordPaymentSchema.parse(req.body);

    const updatedPayable = await PayablesService.recordPayment({
      tenantId,
      accountPayableId,
      amount: payload.amount,
      paymentMethod: payload.paymentMethod,
      notes: payload.notes || null,
      paidAt: payload.paidAt,
    });

    res.status(201).json(updatedPayable);
  },

  /**
   * POST /api/admin/payables/:id/cancel
   */
  async cancelPayable(req: Request, res: Response) {
    const tenantId = getTenantId();
    const id = String(req.params['id']);
    const canceledPayable = await PayablesService.cancelPayable(tenantId, id);
    res.json(canceledPayable);
  },
};
