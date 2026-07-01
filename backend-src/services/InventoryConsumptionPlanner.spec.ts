import { describe, expect, it } from 'vitest';

import { InventoryConsumptionPlanner } from './InventoryConsumptionPlanner.js';
import { ProductAvailabilityService } from './ProductAvailabilityService.js';

function createDb({
  products = [],
  globalOptions = [],
  itemOptions = [],
  ingredients = [],
  order = null,
}: {
  products?: any[];
  globalOptions?: any[];
  itemOptions?: any[];
  ingredients?: any[];
  order?: any;
}) {
  return {
    order: {
      findFirst: async () => order,
    },
    product: {
      findMany: async () => products,
    },
    productOption: {
      findMany: async () => globalOptions,
    },
    productOptionItem: {
      findMany: async () => itemOptions,
    },
    ingredient: {
      findMany: async () => ingredients,
    },
  } as any;
}

const cheese = { id: 'ing-cheese', name: 'Mussarela', unit: 'kg', stock: 10 };
const dough = { id: 'ing-dough', name: 'Massa', unit: 'un', stock: 10 };
const cheddar = { id: 'ing-cheddar', name: 'Cheddar', unit: 'kg', stock: 10 };

const pizza = {
  id: 'pizza-1',
  name: 'Pizza',
  isAvailable: true,
  recipes: [
    { ingredientId: cheese.id, quantity: 0.2, ingredient: cheese },
    { ingredientId: dough.id, quantity: 1, ingredient: dough },
  ],
};

const pizzaTwo = {
  id: 'pizza-2',
  name: 'Pizza 2',
  isAvailable: true,
  recipes: [{ ingredientId: cheese.id, quantity: 0.4, ingredient: cheese }],
};

describe('InventoryConsumptionPlanner', () => {
  it('builds consumption for product with enough stock', async () => {
    const db = createDb({ products: [pizza], ingredients: [cheese, dough] });
    const plan = await InventoryConsumptionPlanner.buildForSelections(
      'tenant-1',
      [{ productId: pizza.id, quantity: 2 }],
      db,
    );

    expect(plan.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ingredientId: cheese.id, quantity: 0.4 }),
        expect.objectContaining({ ingredientId: dough.id, quantity: 2 }),
      ]),
    );
  });

  it('reports product without recipe without blocking by itself', async () => {
    const db = createDb({
      products: [{ id: 'drink', name: 'Bebida', isAvailable: true, recipes: [] }],
    });
    const availability = await ProductAvailabilityService.checkSelections(
      'tenant-1',
      [{ productId: 'drink', quantity: 1 }],
      db,
    );

    expect(availability.available).toBe(true);
    expect(availability.diagnostics[0]).toMatchObject({ code: 'NO_RECIPE' });
  });

  it('blocks product manually unavailable', async () => {
    const db = createDb({
      products: [{ ...pizza, isAvailable: false }],
      ingredients: [cheese, dough],
    });
    const availability = await ProductAvailabilityService.checkSelections(
      'tenant-1',
      [{ productId: pizza.id, quantity: 1 }],
      db,
    );

    expect(availability.available).toBe(false);
    expect(availability.reasons[0]).toContain('bloqueado manualmente');
  });

  it('detects insufficient ingredient stock', async () => {
    const db = createDb({
      products: [pizza],
      ingredients: [{ ...cheese, stock: 0.1 }, dough],
    });
    const availability = await ProductAvailabilityService.checkSelections(
      'tenant-1',
      [{ productId: pizza.id, quantity: 1 }],
      db,
    );

    expect(availability.available).toBe(false);
    expect(availability.missingIngredients[0]).toMatchObject({
      ingredientId: cheese.id,
      required: 0.2,
      available: 0.1,
    });
  });

  it('adds ingredient for addon', async () => {
    const db = createDb({
      products: [pizza],
      itemOptions: [
        {
          id: 'opt-extra-cheese',
          name: 'Queijo extra',
          stockImpactType: 'ADD_INGREDIENT',
          ingredientId: cheese.id,
          ingredientQuantity: 0.1,
          ingredient: cheese,
        },
      ],
    });
    const plan = await InventoryConsumptionPlanner.buildForSelections(
      'tenant-1',
      [{ productId: pizza.id, quantity: 1, optionIds: ['opt-extra-cheese'] }],
      db,
    );

    expect(plan.lines.find((line) => line.ingredientId === cheese.id)?.quantity).toBe(0.3);
  });

  it('removes ingredient when configured', async () => {
    const db = createDb({
      products: [pizza],
      itemOptions: [
        {
          id: 'opt-no-cheese',
          name: 'Sem queijo',
          stockImpactType: 'REMOVE_INGREDIENT',
          ingredientId: cheese.id,
          ingredientQuantity: 0.2,
          ingredient: cheese,
        },
      ],
    });
    const plan = await InventoryConsumptionPlanner.buildForSelections(
      'tenant-1',
      [{ productId: pizza.id, quantity: 1, optionIds: ['opt-no-cheese'] }],
      db,
    );

    expect(plan.lines.find((line) => line.ingredientId === cheese.id)).toBeUndefined();
  });

  it('replaces ingredient when configured', async () => {
    const db = createDb({
      products: [pizza],
      itemOptions: [
        {
          id: 'opt-cheddar',
          name: 'Trocar queijo',
          stockImpactType: 'REPLACE_INGREDIENT',
          ingredientId: cheese.id,
          ingredientQuantity: 0.2,
          replacementIngredientId: cheddar.id,
          ingredient: cheese,
          replacementIngredient: cheddar,
        },
      ],
    });
    const plan = await InventoryConsumptionPlanner.buildForSelections(
      'tenant-1',
      [{ productId: pizza.id, quantity: 1, optionIds: ['opt-cheddar'] }],
      db,
    );

    expect(plan.lines.find((line) => line.ingredientId === cheese.id)).toBeUndefined();
    expect(plan.lines.find((line) => line.ingredientId === cheddar.id)?.quantity).toBe(0.2);
  });

  it('uses 50 percent of each recipe for half and half', async () => {
    const db = createDb({ products: [pizza, pizzaTwo] });
    const plan = await InventoryConsumptionPlanner.buildForSelections(
      'tenant-1',
      [{ productId: pizza.id, quantity: 1, halfAndHalf: { secondProductId: pizzaTwo.id } }],
      db,
    );

    expect(plan.lines.find((line) => line.ingredientId === cheese.id)?.quantity).toBe(0.3);
    expect(plan.lines.find((line) => line.ingredientId === dough.id)?.quantity).toBe(0.5);
  });

  it('does not change stock consumption for no-impact options', async () => {
    const db = createDb({
      products: [pizza],
      itemOptions: [
        {
          id: 'opt-cutlery',
          name: 'Talher descartavel',
          stockImpactType: 'NO_STOCK_IMPACT',
          ingredientId: cheese.id,
          ingredientQuantity: 9,
          ingredient: cheese,
        },
      ],
    });
    const plan = await InventoryConsumptionPlanner.buildForSelections(
      'tenant-1',
      [{ productId: pizza.id, quantity: 1, optionIds: ['opt-cutlery'] }],
      db,
    );

    expect(plan.lines.find((line) => line.ingredientId === cheese.id)?.quantity).toBe(0.2);
  });

  it('uses frozen option stock fields from order snapshot before current option config', async () => {
    const order = {
      id: 'order-1',
      tenantId: 'tenant-1',
      items: [
        {
          productId: pizza.id,
          quantity: 1,
          halfAndHalfData: null,
          optionsSnapshot: JSON.stringify({
            options: [
              {
                id: 'opt-extra-cheese',
                name: 'Queijo extra antigo',
                stockImpactType: 'ADD_INGREDIENT',
                ingredientId: cheese.id,
                ingredientQuantity: 0.1,
                replacementIngredientId: null,
              },
            ],
          }),
        },
      ],
    };
    const db = createDb({
      order,
      products: [pizza],
      itemOptions: [
        {
          id: 'opt-extra-cheese',
          name: 'Queijo extra alterado',
          stockImpactType: 'ADD_INGREDIENT',
          ingredientId: cheese.id,
          ingredientQuantity: 2,
          ingredient: cheese,
        },
      ],
    });

    const plan = await InventoryConsumptionPlanner.buildForOrder('tenant-1', 'order-1', db);

    expect(plan.lines.find((line) => line.ingredientId === cheese.id)?.quantity).toBe(0.3);
  });
});
