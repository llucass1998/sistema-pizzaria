import { basePrisma } from '../lib/prisma.js';
import { InventoryConsumptionPlanner } from './InventoryConsumptionPlanner.js';

type InventoryDb = typeof basePrisma;

type StockMovementInput = {
  tenantId: string;
  ingredientId: string;
  type: string;
  quantity: number;
  cost?: number | null;
  notes?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  idempotencyKey?: string | null;
};

function createBusinessError(
  message: string,
  statusCode = 400,
  extra: Record<string, unknown> = {},
) {
  return Object.assign(new Error(message), { statusCode, ...extra });
}

function normalizeQuantity(value: unknown) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw createBusinessError('Informe uma quantidade maior que zero.');
  }
  return quantity;
}

function movementDelta(type: string, quantity: number, currentStock: number) {
  const normalizedType = type.toUpperCase();
  if (normalizedType === 'IN' || normalizedType === 'INBOUND_INVOICE') return quantity;
  if (normalizedType === 'ADJUSTMENT') return quantity - currentStock;
  return -quantity;
}

export class InventoryService {
  static async moveStock(input: StockMovementInput, db: InventoryDb | any = basePrisma) {
    const quantity = normalizeQuantity(input.quantity);
    const normalizedType = input.type.toUpperCase();
    const isInbound = normalizedType === 'IN' || normalizedType === 'INBOUND_INVOICE';
    const isAdjustment = normalizedType === 'ADJUSTMENT';

    const execute = async (tx: any) => {
      if (input.idempotencyKey) {
        const existing = await tx.inventoryTransaction.findFirst({
          where: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          return { transaction: existing, idempotent: true };
        }
      }

      const ingredient = await tx.ingredient.findFirst({
        where: { id: input.ingredientId, tenantId: input.tenantId },
      });

      if (!ingredient) {
        throw createBusinessError('Insumo nao encontrado para esta loja.', 404);
      }

      const currentStock = Number(ingredient.stock);
      const delta = movementDelta(input.type, quantity, currentStock);
      const nextStock = currentStock + delta;

      if (nextStock < 0) {
        throw createBusinessError(`Estoque insuficiente de ${ingredient.name}.`, 422, {
          ingredientId: ingredient.id,
          available: currentStock,
          requested: quantity,
        });
      }

      const costData =
        input.cost !== undefined && input.cost !== null && isInbound
          ? { cost: Number(input.cost).toFixed(2) }
          : {};

      if (isInbound) {
        const update = await tx.ingredient.updateMany({
          where: { id: ingredient.id, tenantId: input.tenantId },
          data: {
            stock: { increment: quantity },
            ...costData,
          },
        });
        if (update.count !== 1) {
          throw createBusinessError('Insumo nao encontrado para esta loja.', 404);
        }
      } else if (isAdjustment) {
        const update = await tx.ingredient.updateMany({
          where: {
            id: ingredient.id,
            tenantId: input.tenantId,
            ...(delta < 0 ? { stock: { gte: Math.abs(delta) } } : {}),
          },
          data: { stock: nextStock.toFixed(4) },
        });

        if (update.count !== 1) {
          throw createBusinessError(`Estoque insuficiente de ${ingredient.name}.`, 422, {
            ingredientId: ingredient.id,
            available: currentStock,
            requested: Math.abs(delta),
          });
        }
      } else {
        const update = await tx.ingredient.updateMany({
          where: {
            id: ingredient.id,
            tenantId: input.tenantId,
            stock: { gte: quantity },
          },
          data: { stock: { decrement: quantity } },
        });

        if (update.count !== 1) {
          throw createBusinessError(`Estoque insuficiente de ${ingredient.name}.`, 422, {
            ingredientId: ingredient.id,
            available: currentStock,
            requested: quantity,
          });
        }
      }

      const updatedIngredient = await tx.ingredient.findFirst({
        where: { id: ingredient.id, tenantId: input.tenantId },
      });

      const transaction = await tx.inventoryTransaction.create({
        data: {
          tenantId: input.tenantId,
          ingredientId: ingredient.id,
          type: input.type,
          quantity: Math.abs(delta).toFixed(4),
          cost:
            input.cost === undefined || input.cost === null ? null : Number(input.cost).toFixed(2),
          notes: input.notes ?? null,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });

      return { transaction, ingredient: updatedIngredient, idempotent: false };
    };

    try {
      if (typeof db.$transaction === 'function') {
        return await db.$transaction(execute);
      }

      return await execute(db);
    } catch (error: any) {
      if (input.idempotencyKey && error?.code === 'P2002') {
        const existing = await db.inventoryTransaction.findFirst({
          where: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          return { transaction: existing, idempotent: true };
        }
      }

      throw error;
    }
  }

  private static async deductStockForOrderInsideTransaction(
    orderId: string,
    tenantId: string,
    tx: any,
  ) {
    const existing = await tx.inventoryTransaction.findFirst({
      where: {
        tenantId,
        referenceType: 'ORDER',
        referenceId: orderId,
        type: 'OUT',
      },
    });

    if (existing) {
      return { deducted: false, idempotent: true };
    }

    const plan = await InventoryConsumptionPlanner.buildForOrder(tenantId, orderId, tx);
    if (plan.lines.length === 0) {
      return { deducted: false, idempotent: false, plan };
    }

    const ingredientIds = plan.lines.map((line) => line.ingredientId);
    const ingredients = await tx.ingredient.findMany({
      where: { tenantId, id: { in: ingredientIds } },
    });
    const ingredientsById = new Map<string, any>(
      ingredients.map((ingredient: any) => [ingredient.id, ingredient]),
    );
    const missing = plan.lines
      .map((line) => {
        const ingredient = ingredientsById.get(line.ingredientId);
        const available = Number(ingredient?.stock ?? 0);
        return {
          line,
          ingredient,
          available,
          missing: Number((line.quantity - available).toFixed(4)),
        };
      })
      .filter((entry) => !entry.ingredient || entry.available < entry.line.quantity);

    if (missing.length > 0) {
      throw createBusinessError(
        `Estoque insuficiente de ${missing[0].ingredient?.name ?? missing[0].line.ingredientName ?? missing[0].line.ingredientId}.`,
        409,
        {
          availability: {
            available: false,
            reasons: missing.map(
              (entry) =>
                `Estoque insuficiente de ${entry.ingredient?.name ?? entry.line.ingredientName ?? entry.line.ingredientId}: precisa ${entry.line.quantity}, disponivel ${entry.available}.`,
            ),
            missingIngredients: missing.map((entry) => ({
              ingredientId: entry.line.ingredientId,
              ingredientName: entry.ingredient?.name ?? entry.line.ingredientName,
              unit: entry.ingredient?.unit ?? entry.line.unit,
              required: entry.line.quantity,
              available: entry.available,
              missing: entry.missing,
            })),
            diagnostics: plan.diagnostics,
          },
        },
      );
    }

    for (const line of plan.lines) {
      const idempotencyKey = `ORDER:${orderId}:INGREDIENT:${line.ingredientId}`;
      const updated = await tx.ingredient.updateMany({
        where: {
          id: line.ingredientId,
          tenantId,
          stock: { gte: line.quantity },
        },
        data: {
          stock: { decrement: line.quantity },
        },
      });

      if (updated.count !== 1) {
        throw createBusinessError(
          `Estoque insuficiente para baixar ${line.ingredientName ?? line.ingredientId}.`,
          409,
        );
      }

      await tx.inventoryTransaction.create({
        data: {
          tenantId,
          ingredientId: line.ingredientId,
          type: 'OUT',
          quantity: line.quantity.toFixed(4),
          notes: `Baixa automatica do pedido ${orderId}`,
          referenceType: 'ORDER',
          referenceId: orderId,
          idempotencyKey,
        },
      });
    }

    return { deducted: true, idempotent: false, plan };
  }

  static async deductStockForOrderOrThrow(
    orderId: string,
    tenantId: string,
    db: InventoryDb | any = basePrisma,
  ) {
    if (typeof db.$transaction === 'function') {
      return db.$transaction((tx: any) =>
        InventoryService.deductStockForOrderInsideTransaction(orderId, tenantId, tx),
      );
    }

    return InventoryService.deductStockForOrderInsideTransaction(orderId, tenantId, db);
  }

  /**
   * Compatibilidade com chamadas antigas. Fluxos novos devem chamar
   * deductStockForOrderOrThrow para bloquear a operacao quando faltar estoque.
   */
  static async deductStockForOrder(orderId: string, tenantId: string) {
    try {
      const result = await InventoryService.deductStockForOrderOrThrow(orderId, tenantId);
      return Boolean(result.deducted);
    } catch (error) {
      console.error(
        `[Inventory] Erro ao realizar baixa de estoque para o pedido ${orderId}:`,
        error,
      );
      return false;
    }
  }
}
