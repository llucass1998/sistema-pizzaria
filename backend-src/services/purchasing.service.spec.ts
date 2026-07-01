/**
 * Testes unitários do PurchasingService — P1
 *
 * Usa um banco em memória simulado via objeto mockado.
 * Nenhuma chamada real ao banco: todas as funções de tx são vi.fn().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PurchasingService } from './purchasing.service.js';

// ─── Helpers para montar mocks ────────────────────────────────────────────────

const TENANT = 'tenant-abc';
const SUPPLIER_ID = 'supplier-1';
const ING_A = 'ingredient-a';
const ING_B = 'ingredient-b';

function makeIngredient(id: string, stock = 100) {
  return { id, tenantId: TENANT, name: `Insumo ${id}`, unit: 'kg', stock, cost: 5 };
}

function makePO(overrides: Record<string, any> = {}) {
  return {
    id: 'po-1',
    tenantId: TENANT,
    supplierId: SUPPLIER_ID,
    status: 'APPROVED',
    totalAmount: 100,
    items: [
      { id: 'poi-a', ingredientId: ING_A, quantityOrdered: 10, unitCost: 5, totalCost: 50 },
      { id: 'poi-b', ingredientId: ING_B, quantityOrdered: 5, unitCost: 10, totalCost: 50 },
    ],
    receipts: [],
    ...overrides,
  };
}

/**
 * Cria um mock de `tx` (cliente Prisma dentro de transação)
 * suficiente para as operações do PurchasingService.
 */
function makeTx(po: any, ingredients: any[]) {
  const ingredientsMap = new Map(ingredients.map((i) => [i.id, i]));

  let currentPOStatus = po.status;

  const tx: any = {
    purchaseOrder: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.id !== po.id || where.tenantId !== TENANT) return null;
        return { ...po, status: currentPOStatus };
      }),
      updateMany: vi.fn(async ({ data }: any) => {
        currentPOStatus = data.status;
        return { count: 1 };
      }),
    },
    purchaseReceipt: {
      create: vi.fn(async ({ data }: any) => ({
        id: 'receipt-new',
        tenantId: TENANT,
        purchaseOrderId: po.id,
        receivedAt: new Date(),
        notes: data.notes ?? null,
        lines: (data.lines?.create ?? []).map((l: any, i: number) => ({
          id: `line-${i}`,
          receiptId: 'receipt-new',
          ingredientId: l.ingredientId,
          quantityReceived: Number(l.quantityReceived),
          unitCost: Number(l.unitCost),
        })),
      })),
    },
    ingredient: {
      findFirst: vi.fn(async ({ where }: any) => ingredientsMap.get(where.id) ?? null),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    inventoryTransaction: {
      findFirst: vi.fn(async () => null), // sem idempotência prévia por default
      create: vi.fn(async (args: any) => ({ id: 'txn-1', ...args.data })),
    },
    supplier: {
      findFirst: vi.fn(async () => ({ id: SUPPLIER_ID })),
    },
    purchaseRequest: {
      findFirst: vi.fn(async () => null),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    _currentPOStatus: () => currentPOStatus,
  };

  return tx;
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('PurchasingService.receivePartialPO', () => {
  let po: ReturnType<typeof makePO>;
  let tx: ReturnType<typeof makeTx>;

  beforeEach(() => {
    vi.clearAllMocks();
    po = makePO();
    tx = makeTx(po, [makeIngredient(ING_A), makeIngredient(ING_B)]);
  });

  // ── Caso 1: recebimento total ──────────────────────────────────────────────
  it('deve criar recibo e marcar PO como RECEIVED quando tudo é recebido', async () => {
    const result = await PurchasingService.receivePartialPO(
      {
        tenantId: TENANT,
        purchaseOrderId: 'po-1',
        lines: [
          { ingredientId: ING_A, quantityReceived: 10, unitCost: 5 },
          { ingredientId: ING_B, quantityReceived: 5, unitCost: 10 },
        ],
      },
      tx,
    );

    expect(result.poStatus).toBe('RECEIVED');
    expect(tx.purchaseReceipt.create).toHaveBeenCalledOnce();
    expect(tx.purchaseOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RECEIVED' }) }),
    );
  });

  // ── Caso 2: recebimento parcial ───────────────────────────────────────────
  it('deve marcar PO como PARTIALLY_RECEIVED quando não recebe tudo', async () => {
    const result = await PurchasingService.receivePartialPO(
      {
        tenantId: TENANT,
        purchaseOrderId: 'po-1',
        lines: [{ ingredientId: ING_A, quantityReceived: 5, unitCost: 5 }], // só metade de A, nada de B
      },
      tx,
    );

    expect(result.poStatus).toBe('PARTIALLY_RECEIVED');
    expect(tx.purchaseReceipt.create).toHaveBeenCalledOnce();
  });

  // ── Caso 3: excesso rejeitado ─────────────────────────────────────────────
  it('deve rejeitar quando quantidade excede o pedido', async () => {
    await expect(
      PurchasingService.receivePartialPO(
        {
          tenantId: TENANT,
          purchaseOrderId: 'po-1',
          lines: [{ ingredientId: ING_A, quantityReceived: 15, unitCost: 5 }], // pediu 10, quer 15
        },
        tx,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(tx.purchaseReceipt.create).not.toHaveBeenCalled();
  });

  // ── Caso 4: idempotência — mesmo receipt ID não duplica estoque ───────────
  it('deve ser idempotente: segundo recebimento com mesma idempotencyKey não altera estoque', async () => {
    // Primeira recepção
    await PurchasingService.receivePartialPO(
      {
        tenantId: TENANT,
        purchaseOrderId: 'po-1',
        lines: [{ ingredientId: ING_A, quantityReceived: 5, unitCost: 5 }],
      },
      tx,
    );

    const firstReceiptId = 'receipt-new';

    // Simular que a inventoryTransaction já existe (idempotencyKey igual)
    tx.inventoryTransaction.findFirst = vi.fn(async ({ where }: any) => {
      if (where.idempotencyKey === `RECEIPT:${firstReceiptId}:INGREDIENT:${ING_A}`) {
        return { id: 'txn-existing', idempotencyKey: where.idempotencyKey };
      }
      return null;
    });

    // Segunda tentativa com o mesmo receiptId (simulação de retry)
    // O InventoryService detecta idempotencyKey existente e não cria transação nova
    const createCalls = (tx.inventoryTransaction.create as any).mock.calls.length;

    // Chamada ao moveStock com idempotencyKey já existente não deve criar nova transação
    const { InventoryService } = await import('./inventory.service.js');
    const result = await InventoryService.moveStock(
      {
        tenantId: TENANT,
        ingredientId: ING_A,
        type: 'INBOUND_INVOICE',
        quantity: 5,
        cost: 5,
        referenceType: 'PURCHASE_RECEIPT',
        referenceId: firstReceiptId,
        idempotencyKey: `RECEIPT:${firstReceiptId}:INGREDIENT:${ING_A}`,
      },
      tx,
    );

    expect(result.idempotent).toBe(true);
    // Nenhum create adicional após detectar idempotência
    expect(tx.inventoryTransaction.create).toHaveBeenCalledTimes(createCalls);
  });

  // ── Caso 5: cross-tenant — PO de outro tenant retorna 404 ────────────────
  it('deve rejeitar PO de outro tenant com 404', async () => {
    await expect(
      PurchasingService.receivePartialPO(
        {
          tenantId: 'outro-tenant',
          purchaseOrderId: 'po-1',
          lines: [{ ingredientId: ING_A, quantityReceived: 5, unitCost: 5 }],
        },
        tx,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // ── Caso 6: PO cancelado — rejeita recebimento ────────────────────────────
  it('deve rejeitar recebimento em PO com status CANCELED', async () => {
    po = makePO({ status: 'CANCELED' });
    tx = makeTx(po, [makeIngredient(ING_A)]);

    await expect(
      PurchasingService.receivePartialPO(
        {
          tenantId: TENANT,
          purchaseOrderId: 'po-1',
          lines: [{ ingredientId: ING_A, quantityReceived: 5, unitCost: 5 }],
        },
        tx,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe('PurchasingService.convertRFQtoPO', () => {
  let tx: ReturnType<typeof makeTx>;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = makeTx(makePO(), [makeIngredient(ING_A)]);
  });

  // ── Caso 7: conversão bem sucedida ────────────────────────────────────────
  it('deve criar PO em APPROVED e marcar RFQ como CONVERTED', async () => {
    const rfq = {
      id: 'rfq-1',
      tenantId: TENANT,
      supplierId: SUPPLIER_ID,
      status: 'APPROVED',
    };

    tx.purchaseRequest.findFirst = vi.fn(async () => rfq);
    tx.purchaseOrder = {
      ...tx.purchaseOrder,
      create: vi.fn(async (args: any) => ({
        id: 'po-new',
        ...args.data,
        items: args.data.items?.create ?? [],
      })),
    };

    const po = await PurchasingService.convertRFQtoPO(
      {
        tenantId: TENANT,
        purchaseRequestId: 'rfq-1',
        items: [{ ingredientId: ING_A, quantityOrdered: 10, unitCost: 5 }],
      },
      tx,
    );

    expect(po.status).toBe('APPROVED');
    expect(tx.purchaseRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CONVERTED' }) }),
    );
  });

  // ── Caso 8: RFQ já convertido rejeita ────────────────────────────────────
  it('deve rejeitar conversão de RFQ já CONVERTED', async () => {
    tx.purchaseRequest.findFirst = vi.fn(async () => ({
      id: 'rfq-1',
      tenantId: TENANT,
      supplierId: SUPPLIER_ID,
      status: 'CONVERTED',
    }));

    await expect(
      PurchasingService.convertRFQtoPO(
        {
          tenantId: TENANT,
          purchaseRequestId: 'rfq-1',
          items: [{ ingredientId: ING_A, quantityOrdered: 10, unitCost: 5 }],
        },
        tx,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
