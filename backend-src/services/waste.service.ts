/**
 * WasteService — P1
 *
 * Registra perdas de estoque (vencimento, avarias, erros) deduzindo atomicamente o estoque via InventoryService.
 */

import { basePrisma } from '../lib/prisma.js';
import { InventoryService } from './inventory.service.js';

type Db = typeof basePrisma;

export interface CreateWasteInput {
  tenantId: string;
  ingredientId: string;
  quantity: number;
  reason: string;
  registeredBy: string;
  notes?: string;
}

function businessError(message: string, statusCode = 400, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(message), { statusCode, ...extra });
}

export class WasteService {
  /**
   * Registra uma perda de estoque.
   * Deduz atomicamente via InventoryService (tipo WASTE).
   */
  static async registerWaste(input: CreateWasteInput, db: Db | any = basePrisma) {
    if (input.quantity <= 0) {
      throw businessError('A quantidade da perda deve ser maior que zero.', 422);
    }

    if (!input.reason || input.reason.trim() === '') {
      throw businessError('O motivo da perda é obrigatório.', 422);
    }

    const execute = async (tx: any) => {
      // 1. Verificar ingrediente
      const ingredient = await tx.ingredient.findFirst({
        where: { id: input.ingredientId, tenantId: input.tenantId },
      });

      if (!ingredient) {
        throw businessError('Ingrediente não encontrado para esta loja.', 404);
      }

      // 2. Criar registro de perda
      const wasteRecord = await tx.wasteRecord.create({
        data: {
          tenantId: input.tenantId,
          ingredientId: input.ingredientId,
          quantity: input.quantity.toFixed(4),
          reason: input.reason,
          registeredBy: input.registeredBy,
          notes: input.notes ?? null,
        },
      });

      // 3. Dar baixa no estoque via InventoryService repassando a transação
      // InventoryService lancará erro 422 se o estoque for insuficiente.
      await InventoryService.moveStock(
        {
          tenantId: input.tenantId,
          ingredientId: input.ingredientId,
          type: 'WASTE',
          quantity: input.quantity,
          notes: `Perda registrada: ${input.reason}${input.notes ? ' - ' + input.notes : ''}`,
          referenceType: 'WASTE_RECORD',
          referenceId: wasteRecord.id,
          idempotencyKey: `WASTE:${wasteRecord.id}`,
        },
        tx,
      );

      return wasteRecord;
    };

    if (typeof db.$transaction === 'function') {
      return db.$transaction(execute);
    }
    return execute(db);
  }

  /**
   * Agrupa e totaliza perdas por motivo e ingrediente em um período.
   */
  static async getWasteReport(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
    db: Db | any = basePrisma,
  ) {
    const whereClause: any = { tenantId };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const records = await db.wasteRecord.findMany({
      where: whereClause,
      include: {
        ingredient: { select: { id: true, name: true, unit: true } },
      },
    });

    const summary = new Map<string, { reason: string; ingredient: any; totalQuantity: number; count: number }>();

    for (const record of records) {
      const key = `${record.reason}_${record.ingredientId}`;
      const existing = summary.get(key) || {
        reason: record.reason,
        ingredient: record.ingredient,
        totalQuantity: 0,
        count: 0,
      };

      existing.totalQuantity += Number(record.quantity);
      existing.count += 1;

      summary.set(key, existing);
    }

    return Array.from(summary.values());
  }
}
