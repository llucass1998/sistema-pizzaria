import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WasteService } from './waste.service.js';
import { InventoryService } from './inventory.service.js';

vi.mock('./inventory.service.js', () => ({
  InventoryService: {
    moveStock: vi.fn(),
  },
}));

const TENANT = 'tenant-waste';
const INGREDIENT_ID = 'ing-tomato';

function makeTx(ingredientStock = 10) {
  let records: any[] = [];
  return {
    ingredient: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.id === INGREDIENT_ID) {
          return { id: INGREDIENT_ID, tenantId: TENANT, stock: ingredientStock, name: 'Tomato' };
        }
        return null;
      }),
    },
    wasteRecord: {
      create: vi.fn(async ({ data }: any) => {
        const record = { id: 'waste-1', ...data, createdAt: new Date() };
        records.push(record);
        return record;
      }),
      findMany: vi.fn(async () => records),
    },
    _pushRecord: (rec: any) => records.push(rec),
  };
}

describe('WasteService.registerWaste', () => {
  let tx: ReturnType<typeof makeTx>;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = makeTx();
  });

  it('deve registrar perda e chamar InventoryService com tipo WASTE', async () => {
    const input = {
      tenantId: TENANT,
      ingredientId: INGREDIENT_ID,
      quantity: 2,
      reason: 'EXPIRED',
      registeredBy: 'John Doe',
      notes: 'Tomatoes got moldy',
    };

    const result = await WasteService.registerWaste(input, tx);

    expect(result.id).toBe('waste-1');
    expect(result.reason).toBe('EXPIRED');
    expect(result.registeredBy).toBe('John Doe');

    expect(InventoryService.moveStock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        ingredientId: INGREDIENT_ID,
        type: 'WASTE',
        quantity: 2,
        referenceType: 'WASTE_RECORD',
        referenceId: 'waste-1',
        idempotencyKey: 'WASTE:waste-1',
      }),
      tx,
    );
  });

  it('deve rejeitar se ingrediente nao for encontrado', async () => {
    const input = {
      tenantId: TENANT,
      ingredientId: 'wrong-id',
      quantity: 2,
      reason: 'EXPIRED',
      registeredBy: 'John Doe',
    };

    await expect(WasteService.registerWaste(input, tx)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(InventoryService.moveStock).not.toHaveBeenCalled();
  });

  it('deve rejeitar quantidade invalida', async () => {
    const input = {
      tenantId: TENANT,
      ingredientId: INGREDIENT_ID,
      quantity: -1,
      reason: 'EXPIRED',
      registeredBy: 'John Doe',
    };

    await expect(WasteService.registerWaste(input, tx)).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('deve rejeitar se motivo estiver vazio', async () => {
    const input = {
      tenantId: TENANT,
      ingredientId: INGREDIENT_ID,
      quantity: 1,
      reason: '   ',
      registeredBy: 'John Doe',
    };

    await expect(WasteService.registerWaste(input, tx)).rejects.toMatchObject({
      statusCode: 422,
    });
  });
});

describe('WasteService.getWasteReport', () => {
  let tx: ReturnType<typeof makeTx>;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = makeTx();
  });

  it('deve gerar relatorio agrupado por motivo e ingrediente', async () => {
    tx._pushRecord({
      reason: 'EXPIRED',
      ingredientId: INGREDIENT_ID,
      quantity: 2,
      ingredient: { id: INGREDIENT_ID, name: 'Tomato' },
    });
    tx._pushRecord({
      reason: 'EXPIRED',
      ingredientId: INGREDIENT_ID,
      quantity: 3,
      ingredient: { id: INGREDIENT_ID, name: 'Tomato' },
    });
    tx._pushRecord({
      reason: 'DAMAGED',
      ingredientId: 'ing-cheese',
      quantity: 1,
      ingredient: { id: 'ing-cheese', name: 'Cheese' },
    });

    const report = await WasteService.getWasteReport(TENANT, undefined, undefined, tx);

    expect(report).toHaveLength(2);

    const expiredTomato = report.find((r) => r.reason === 'EXPIRED');
    expect(expiredTomato?.totalQuantity).toBe(5);
    expect(expiredTomato?.count).toBe(2);
    expect(expiredTomato?.ingredient.name).toBe('Tomato');

    const damagedCheese = report.find((r) => r.reason === 'DAMAGED');
    expect(damagedCheese?.totalQuantity).toBe(1);
    expect(damagedCheese?.count).toBe(1);
  });
});
