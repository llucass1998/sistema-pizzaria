/**
 * Testes unitários do ManufacturingService — P1
 *
 * Cobre 8 casos com mocks de Prisma — sem banco real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ManufacturingService } from './manufacturing.service.js';

// ─── Constantes de teste ──────────────────────────────────────────────────────

const TENANT = 'tenant-mfg';
const PRODUCT_ID = 'product-pizza';
const ING_FLOUR = 'ingredient-farinha';
const ING_CHEESE = 'ingredient-queijo';
const ING_OUTPUT = 'ingredient-massa-pronta';
const ORDER_ID = 'mfg-order-1';

// ─── Helpers para construir mocks ─────────────────────────────────────────────

function makeOrder(overrides: Record<string, any> = {}) {
  return {
    id: ORDER_ID,
    tenantId: TENANT,
    productId: PRODUCT_ID,
    quantity: 2,
    status: 'IN_PROGRESS',
    notes: null,
    outputIngredientId: null,
    outputQuantityPerUnit: null,
    completedAt: null,
    canceledAt: null,
    ...overrides,
  };
}

function makeRecipes() {
  return [
    { ingredientId: ING_FLOUR, quantity: 0.5 }, // 0.5 kg por unidade
    { ingredientId: ING_CHEESE, quantity: 0.2 }, // 0.2 kg por unidade
  ];
}

function makeIngredients(flourStock = 5, cheeseStock = 5) {
  return [
    { id: ING_FLOUR, name: 'Farinha', stock: flourStock, tenantId: TENANT },
    { id: ING_CHEESE, name: 'Queijo', stock: cheeseStock, tenantId: TENANT },
  ];
}

/**
 * Cria um mock de tx com comportamento configurável.
 */
function makeTx(
  order: ReturnType<typeof makeOrder>,
  recipes: Array<{ ingredientId: string; quantity: number }>,
  ingredients: ReturnType<typeof makeIngredients>,
  opts: { claimCount?: number } = {},
) {
  let currentOrder = { ...order };
  const claimCount = opts.claimCount ?? 1;

  return {
    manufacturingOrder: {
      updateMany: vi.fn(async ({ where, data }: any) => {
        // Simulate status filter: only match if the expected status matches currentOrder
        const expectedStatus = where.status;
        const statusMatches = expectedStatus
          ? Array.isArray(expectedStatus?.in)
            ? (expectedStatus.in as string[]).includes(currentOrder.status)
            : currentOrder.status === expectedStatus
          : true;

        if (!statusMatches || claimCount === 0) return { count: 0 };

        if (data.status) currentOrder = { ...currentOrder, ...data };
        return { count: claimCount };
      }),
      findFirst: vi.fn(async () => ({ ...currentOrder })),
      create: vi.fn(async ({ data }: any) => ({ id: ORDER_ID, ...data })),
    },
    product: {
      findFirst: vi.fn(async () => ({ id: PRODUCT_ID, name: 'Pizza Margherita' })),
    },
    ingredient: {
      findFirst: vi.fn(async ({ where }: any) => {
        const found = ingredients.find((i) => i.id === where.id);
        return found ?? null;
      }),
      findMany: vi.fn(async () => ingredients),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    recipe: {
      findMany: vi.fn(async () => recipes),
    },
    inventoryTransaction: {
      findFirst: vi.fn(async () => null), // sem idempotência prévia
      create: vi.fn(async (args: any) => ({ id: 'txn-' + Math.random(), ...args.data })),
    },
  };
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('ManufacturingService.completeOrder', () => {
  let tx: ReturnType<typeof makeTx>;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = makeTx(makeOrder(), makeRecipes(), makeIngredients());
  });

  // ── Caso 1: conclusão com baixa de ingredientes ───────────────────────────
  it('deve concluir ordem e baixar ingredientes da ficha tecnica', async () => {
    const result = await ManufacturingService.completeOrder(ORDER_ID, TENANT, tx);

    expect(result.idempotent).toBe(false);
    expect(result.deducted).toBe(true);

    // updateMany deve ter sido chamado para reclamar status DONE
    expect(tx.manufacturingOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'IN_PROGRESS' }),
        data: expect.objectContaining({ status: 'DONE' }),
      }),
    );

    // Deve ter criado 2 transações de estoque (farinha + queijo)
    const txnCalls = (tx.inventoryTransaction.create as any).mock.calls;
    expect(txnCalls.length).toBeGreaterThanOrEqual(2);

    // Verificar quantidades: 2 unidades × 0.5 kg farinha = 1 kg; 2 × 0.2 = 0.4 kg queijo
    const flourTxn = txnCalls.find((call: any) => call[0].data.ingredientId === ING_FLOUR);
    const cheeseTxn = txnCalls.find((call: any) => call[0].data.ingredientId === ING_CHEESE);
    expect(Number(flourTxn?.[0].data.quantity)).toBeCloseTo(1.0, 4);
    expect(Number(cheeseTxn?.[0].data.quantity)).toBeCloseTo(0.4, 4);
  });

  // ── Caso 2: outputIngredient incrementado na conclusão ────────────────────
  it('deve incrementar outputIngredient quando configurado', async () => {
    const orderWithOutput = makeOrder({
      outputIngredientId: ING_OUTPUT,
      outputQuantityPerUnit: 0.3, // 0.3 kg de massa por pizza
    });
    const outputIngredient = { id: ING_OUTPUT, name: 'Massa Pronta', stock: 0, tenantId: TENANT };

    tx = makeTx(orderWithOutput, makeRecipes(), [...makeIngredients(), outputIngredient]);

    await ManufacturingService.completeOrder(ORDER_ID, TENANT, tx);

    const txnCalls = (tx.inventoryTransaction.create as any).mock.calls;
    // Deve ter 3 transações: farinha (OUT), queijo (OUT), massa-pronta (IN)
    expect(txnCalls.length).toBeGreaterThanOrEqual(3);

    const outputTxn = txnCalls.find(
      (call: any) => call[0].data.idempotencyKey === `MFG_ORDER:${ORDER_ID}:OUTPUT`,
    );
    expect(outputTxn).toBeDefined();
    // 2 unidades × 0.3 kg = 0.6 kg de massa
    expect(Number(outputTxn?.[0].data.quantity)).toBeCloseTo(0.6, 4);
    expect(outputTxn?.[0].data.type).toBe('IN');
  });

  // ── Caso 3: estoque insuficiente → 409 ────────────────────────────────────
  it('deve rejeitar com 409 quando estoque e insuficiente', async () => {
    // Farinha só tem 0.5 kg, mas a ordem precisa de 1 kg (2 unidades × 0.5)
    tx = makeTx(makeOrder(), makeRecipes(), makeIngredients(0.5, 5));

    await expect(ManufacturingService.completeOrder(ORDER_ID, TENANT, tx)).rejects.toMatchObject({
      statusCode: 409,
    });

    // Nenhuma transação de estoque deve ter sido criada
    expect(tx.inventoryTransaction.create).not.toHaveBeenCalled();
  });

  // ── Caso 4: idempotência — ordem DONE não altera estoque ──────────────────
  it('deve retornar idempotente se ordem ja esta DONE', async () => {
    // Simula que o updateMany não encontra linha (claim falha — já DONE)
    tx = makeTx(makeOrder({ status: 'DONE' }), makeRecipes(), makeIngredients(), {
      claimCount: 0,
    });

    const result = await ManufacturingService.completeOrder(ORDER_ID, TENANT, tx);

    expect(result.idempotent).toBe(true);
    // Nenhuma transação de estoque deve ter sido criada
    expect(tx.inventoryTransaction.create).not.toHaveBeenCalled();
  });

  // ── Caso 5: cross-tenant → 404 ────────────────────────────────────────────
  it('deve rejeitar ordem de outro tenant com 404', async () => {
    tx = makeTx(makeOrder(), makeRecipes(), makeIngredients(), { claimCount: 0 });
    // findFirst retorna null (nao encontrou no tenant errado)
    tx.manufacturingOrder.findFirst = vi.fn(async (): Promise<any> => null);

    await expect(
      ManufacturingService.completeOrder(ORDER_ID, 'outro-tenant', tx),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // ── Caso 6: ordem CANCELED → 422 ──────────────────────────────────────────
  it('deve rejeitar conclusao de ordem CANCELED', async () => {
    tx = makeTx(makeOrder({ status: 'CANCELED' }), makeRecipes(), makeIngredients(), {
      claimCount: 0,
    });

    await expect(ManufacturingService.completeOrder(ORDER_ID, TENANT, tx)).rejects.toMatchObject({
      statusCode: 422,
    });
  });
});

describe('ManufacturingService.startOrder', () => {
  let tx: ReturnType<typeof makeTx>;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = makeTx(makeOrder({ status: 'DRAFT' }), [], makeIngredients());
  });

  // ── Caso 7: iniciar ordem DRAFT → IN_PROGRESS ─────────────────────────────
  it('deve mover ordem de DRAFT para IN_PROGRESS', async () => {
    const result = await ManufacturingService.startOrder(ORDER_ID, TENANT, tx);

    expect(result.idempotent).toBe(false);
    expect(tx.manufacturingOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'DRAFT' }),
        data: expect.objectContaining({ status: 'IN_PROGRESS' }),
      }),
    );
  });

  // ── Caso 8: iniciar ordem já IN_PROGRESS → idempotente ───────────────────
  it('deve retornar idempotente se ordem ja esta IN_PROGRESS', async () => {
    // Simula claim falha (count 0) mas ordem existe em IN_PROGRESS
    tx = makeTx(makeOrder({ status: 'IN_PROGRESS' }), [], makeIngredients(), {
      claimCount: 0,
    });

    const result = await ManufacturingService.startOrder(ORDER_ID, TENANT, tx);

    expect(result.idempotent).toBe(true);
  });
});
