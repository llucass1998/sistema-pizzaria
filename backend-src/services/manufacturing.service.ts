/**
 * ManufacturingService — P1
 *
 * Controla ordens de producao internas (massas, molhos, semiacabados).
 *
 * Fluxo de status: DRAFT → IN_PROGRESS → DONE | CANCELED
 *                  DRAFT → CANCELED
 *
 * Garantias de integridade:
 * - Conclusão atômica: updateMany com where { status: IN_PROGRESS } reclama a ordem.
 *   Se stock insuficiente, o throw dentro da transação reverte o update para DONE.
 * - Idempotência secundária: cada ingredient deduction tem idempotencyKey único,
 *   proteção extra contra retry após falha de rede pós-commit.
 * - Cross-tenant: todos os findFirst/updateMany incluem tenantId explícito.
 */

import { basePrisma } from '../lib/prisma.js';
import { InventoryService } from './inventory.service.js';

type Db = typeof basePrisma;

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface CreateManufacturingOrderInput {
  tenantId: string;
  productId: string;
  quantity: number;
  notes?: string;
  outputIngredientId?: string;
  outputQuantityPerUnit?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function businessError(message: string, statusCode = 400, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(message), { statusCode, ...extra });
}

const STARTABLE_STATUS = 'DRAFT';
const COMPLETABLE_STATUS = 'IN_PROGRESS';
const CANCELABLE_STATUSES = ['DRAFT', 'IN_PROGRESS'] as const;

// ─── Serviço ─────────────────────────────────────────────────────────────────

export class ManufacturingService {
  /**
   * Cria uma nova ordem de produção em status DRAFT.
   */
  static async createOrder(input: CreateManufacturingOrderInput, db: Db | any = basePrisma) {
    if (input.quantity <= 0) {
      throw businessError('Quantidade deve ser maior que zero.', 422);
    }

    // Verificar produto pertence ao tenant
    const product = await db.product.findFirst({
      where: { id: input.productId, tenantId: input.tenantId },
      select: { id: true, name: true },
    });
    if (!product) {
      throw businessError('Produto nao encontrado para esta loja.', 404);
    }

    // Verificar outputIngredient se fornecido
    if (input.outputIngredientId) {
      const ing = await db.ingredient.findFirst({
        where: { id: input.outputIngredientId, tenantId: input.tenantId },
        select: { id: true },
      });
      if (!ing) {
        throw businessError('Ingrediente de saida nao encontrado para esta loja.', 404);
      }
    }

    const order = await db.manufacturingOrder.create({
      data: {
        tenantId: input.tenantId,
        productId: input.productId,
        quantity: input.quantity.toFixed(4),
        status: 'DRAFT',
        notes: input.notes ?? null,
        outputIngredientId: input.outputIngredientId ?? null,
        outputQuantityPerUnit:
          input.outputQuantityPerUnit != null ? input.outputQuantityPerUnit.toFixed(4) : null,
      },
    });

    return order;
  }

  /**
   * Inicia uma ordem DRAFT, movendo-a para IN_PROGRESS.
   * Idempotente: se já estiver em IN_PROGRESS, retorna sem erro.
   */
  static async startOrder(orderId: string, tenantId: string, db: Db | any = basePrisma) {
    const execute = async (tx: any) => {
      const updated = await tx.manufacturingOrder.updateMany({
        where: { id: orderId, tenantId, status: STARTABLE_STATUS },
        data: { status: 'IN_PROGRESS', updatedAt: new Date() },
      });

      if (updated.count === 0) {
        const order = await tx.manufacturingOrder.findFirst({
          where: { id: orderId, tenantId },
        });
        if (!order) throw businessError('Ordem de producao nao encontrada.', 404);
        if (order.status === 'IN_PROGRESS') return { order, idempotent: true };
        throw businessError(
          `Ordem em status "${order.status}" nao pode ser iniciada. Status esperado: DRAFT.`,
          422,
        );
      }

      const order = await tx.manufacturingOrder.findFirst({
        where: { id: orderId, tenantId },
      });
      return { order, idempotent: false };
    };

    if (typeof db.$transaction === 'function') return db.$transaction(execute);
    return execute(db);
  }

  /**
   * Conclui uma ordem IN_PROGRESS:
   *   1. Reclama atomicamente o status (DONE) com updateMany.
   *   2. Verifica estoque de cada insumo da ficha técnica.
   *   3. Baixa insumos via InventoryService com idempotencyKey por insumo.
   *   4. Se outputIngredientId configurado, registra entrada do produto acabado.
   *
   * Se o estoque for insuficiente, o throw reverte o updateMany (mesma transação).
   * Se já estiver em DONE, retorna idempotente sem tocar estoque.
   */
  static async completeOrder(orderId: string, tenantId: string, db: Db | any = basePrisma) {
    const execute = async (tx: any) => {
      // ── 1. Reclamar status atomicamente ──────────────────────────────────────
      const claim = await tx.manufacturingOrder.updateMany({
        where: { id: orderId, tenantId, status: COMPLETABLE_STATUS },
        data: { status: 'DONE', completedAt: new Date(), updatedAt: new Date() },
      });

      if (claim.count === 0) {
        const order = await tx.manufacturingOrder.findFirst({
          where: { id: orderId, tenantId },
        });
        if (!order) throw businessError('Ordem de producao nao encontrada.', 404);
        if (order.status === 'DONE') return { order, idempotent: true, deducted: false };
        throw businessError(
          `Ordem em status "${order.status}" nao pode ser concluida. Status esperado: IN_PROGRESS.`,
          422,
        );
      }

      // ── 2. Carregar ordem e ficha técnica ────────────────────────────────────
      const order = await tx.manufacturingOrder.findFirst({
        where: { id: orderId, tenantId },
      });

      // Recipe é excluído do tenant-injection (sem tenantId) — query direta por productId
      const recipes: Array<{ ingredientId: string; quantity: unknown }> = await tx.recipe.findMany({
        where: { productId: order.productId },
      });

      if (recipes.length > 0) {
        // ── 3. Calcular quantidades e verificar estoque ────────────────────────
        const needed = recipes.map((r) => ({
          ingredientId: r.ingredientId,
          quantity: Number(r.quantity) * Number(order.quantity),
        }));

        const ingredientIds = needed.map((n) => n.ingredientId);
        const ingredients: Array<{ id: string; name: string; stock: unknown }> =
          await tx.ingredient.findMany({
            where: { tenantId, id: { in: ingredientIds } },
            select: { id: true, name: true, stock: true },
          });

        const stockMap = new Map(
          ingredients.map((i) => [i.id, { name: i.name, available: Number(i.stock) }]),
        );

        for (const item of needed) {
          const ing = stockMap.get(item.ingredientId);
          if (!ing || ing.available < item.quantity) {
            // Throw inside transaction → updateMany to DONE is rolled back automatically
            throw businessError(
              `Estoque insuficiente de ${ing?.name ?? item.ingredientId}. ` +
                `Disponivel: ${ing?.available ?? 0}, necessario: ${item.quantity.toFixed(4)}.`,
              409,
              {
                ingredientId: item.ingredientId,
                available: ing?.available ?? 0,
                required: item.quantity,
              },
            );
          }
        }

        // ── 4. Baixar insumos (idempotente por chave) ─────────────────────────
        for (const item of needed) {
          await InventoryService.moveStock(
            {
              tenantId,
              ingredientId: item.ingredientId,
              type: 'OUT',
              quantity: item.quantity,
              notes: `Baixa por ordem de producao ${orderId}`,
              referenceType: 'MANUFACTURING_ORDER',
              referenceId: orderId,
              idempotencyKey: `MFG_ORDER:${orderId}:INGREDIENT:${item.ingredientId}`,
            },
            tx,
          );
        }
      }

      // ── 5. Entrada do produto acabado (opcional) ─────────────────────────────
      if (order.outputIngredientId) {
        const outputQty = Number(order.outputQuantityPerUnit ?? 1) * Number(order.quantity);

        await InventoryService.moveStock(
          {
            tenantId,
            ingredientId: order.outputIngredientId,
            type: 'IN',
            quantity: outputQty,
            notes: `Produto acabado: ordem de producao ${orderId}`,
            referenceType: 'MANUFACTURING_ORDER',
            referenceId: orderId,
            idempotencyKey: `MFG_ORDER:${orderId}:OUTPUT`,
          },
          tx,
        );
      }

      return { order, idempotent: false, deducted: recipes.length > 0 };
    };

    if (typeof db.$transaction === 'function') return db.$transaction(execute);
    return execute(db);
  }

  /**
   * Cancela uma ordem em DRAFT ou IN_PROGRESS.
   */
  static async cancelOrder(orderId: string, tenantId: string, db: Db | any = basePrisma) {
    const execute = async (tx: any) => {
      const updated = await tx.manufacturingOrder.updateMany({
        where: { id: orderId, tenantId, status: { in: CANCELABLE_STATUSES } },
        data: { status: 'CANCELED', canceledAt: new Date(), updatedAt: new Date() },
      });

      if (updated.count === 0) {
        const order = await tx.manufacturingOrder.findFirst({
          where: { id: orderId, tenantId },
        });
        if (!order) throw businessError('Ordem de producao nao encontrada.', 404);
        throw businessError(`Ordem em status "${order.status}" nao pode ser cancelada.`, 422);
      }

      const order = await tx.manufacturingOrder.findFirst({
        where: { id: orderId, tenantId },
      });
      return { order };
    };

    if (typeof db.$transaction === 'function') return db.$transaction(execute);
    return execute(db);
  }
}
