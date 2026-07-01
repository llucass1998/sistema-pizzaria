import { describe, expect, it } from 'vitest';

import { InventoryService } from './inventory.service.js';

function createStockDb(initialStock = 5, options: { failAtomicUpdate?: boolean } = {}) {
  const state = {
    ingredient: { id: 'ing-1', tenantId: 'tenant-1', name: 'Massa', stock: initialStock },
    transactions: [] as any[],
    lastUpdateMany: null as any,
  };

  const tx = {
    ingredient: {
      findFirst: async () => state.ingredient,
      updateMany: async ({ where, data }: any) => {
        state.lastUpdateMany = { where, data };
        if (options.failAtomicUpdate) return { count: 0 };
        if (where.tenantId && where.tenantId !== state.ingredient.tenantId) return { count: 0 };
        if (where.id && where.id !== state.ingredient.id) return { count: 0 };
        if (where.stock?.gte !== undefined && state.ingredient.stock < Number(where.stock.gte)) {
          return { count: 0 };
        }

        if (data.stock?.increment !== undefined) {
          state.ingredient = {
            ...state.ingredient,
            stock: state.ingredient.stock + Number(data.stock.increment),
          };
        } else if (data.stock?.decrement !== undefined) {
          state.ingredient = {
            ...state.ingredient,
            stock: state.ingredient.stock - Number(data.stock.decrement),
          };
        } else if (data.stock !== undefined) {
          state.ingredient = { ...state.ingredient, stock: Number(data.stock) };
        }

        return { count: 1 };
      },
    },
    inventoryTransaction: {
      findFirst: async ({ where }: any) =>
        state.transactions.find(
          (transaction) =>
            transaction.tenantId === where.tenantId &&
            (where.idempotencyKey
              ? transaction.idempotencyKey === where.idempotencyKey
              : transaction.referenceType === where.referenceType &&
                transaction.referenceId === where.referenceId &&
                transaction.type === where.type),
        ) ?? null,
      create: async ({ data }: any) => {
        const transaction = { id: `tx-${state.transactions.length + 1}`, ...data };
        state.transactions.push(transaction);
        return transaction;
      },
    },
  };

  return {
    state,
    db: {
      inventoryTransaction: tx.inventoryTransaction,
      $transaction: async (callback: any) => callback(tx),
    } as any,
  };
}

describe('InventoryService.moveStock', () => {
  it('records a movement once for the same idempotency key', async () => {
    const { db, state } = createStockDb(5);

    await InventoryService.moveStock(
      {
        tenantId: 'tenant-1',
        ingredientId: 'ing-1',
        type: 'OUT',
        quantity: 2,
        idempotencyKey: 'manual-1',
      },
      db,
    );
    const second = await InventoryService.moveStock(
      {
        tenantId: 'tenant-1',
        ingredientId: 'ing-1',
        type: 'OUT',
        quantity: 2,
        idempotencyKey: 'manual-1',
      },
      db,
    );

    expect(second.idempotent).toBe(true);
    expect(state.transactions).toHaveLength(1);
    expect(state.ingredient.stock).toBe(3);
  });

  it('uses an atomic stock predicate for outbound movements', async () => {
    const { db, state } = createStockDb(5);

    await InventoryService.moveStock(
      {
        tenantId: 'tenant-1',
        ingredientId: 'ing-1',
        type: 'OUT',
        quantity: 2,
        idempotencyKey: 'manual-atomic',
      },
      db,
    );

    expect(state.lastUpdateMany).toMatchObject({
      where: {
        id: 'ing-1',
        tenantId: 'tenant-1',
        stock: { gte: 2 },
      },
      data: { stock: { decrement: 2 } },
    });
    expect(state.ingredient.stock).toBe(3);
  });

  it('blocks negative stock', async () => {
    const { db } = createStockDb(1);

    await expect(
      InventoryService.moveStock(
        {
          tenantId: 'tenant-1',
          ingredientId: 'ing-1',
          type: 'OUT',
          quantity: 2,
        },
        db,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('blocks when the atomic outbound update does not affect the ingredient', async () => {
    const { db } = createStockDb(5, { failAtomicUpdate: true });

    await expect(
      InventoryService.moveStock(
        {
          tenantId: 'tenant-1',
          ingredientId: 'ing-1',
          type: 'OUT',
          quantity: 2,
          idempotencyKey: 'manual-race',
        },
        db,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('returns the existing transaction after an idempotency unique conflict', async () => {
    const existing = {
      id: 'tx-existing',
      tenantId: 'tenant-1',
      idempotencyKey: 'manual-conflict',
    };
    const db = {
      inventoryTransaction: {
        findFirst: async () => existing,
      },
      $transaction: async () => {
        throw { code: 'P2002' };
      },
    } as any;

    const result = await InventoryService.moveStock(
      {
        tenantId: 'tenant-1',
        ingredientId: 'ing-1',
        type: 'OUT',
        quantity: 2,
        idempotencyKey: 'manual-conflict',
      },
      db,
    );

    expect(result).toEqual({ transaction: existing, idempotent: true });
  });
});
