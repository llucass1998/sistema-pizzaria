import { basePrisma } from '../lib/prisma.js';

export type StockImpactType =
  'NO_STOCK_IMPACT' | 'ADD_INGREDIENT' | 'REMOVE_INGREDIENT' | 'REPLACE_INGREDIENT';

type PlannerDb = typeof basePrisma;

type SnapshotOption = {
  id: string;
  name?: string;
  stockImpactType?: StockImpactType | string | null;
  ingredientId?: string | null;
  ingredientQuantity?: unknown;
  replacementIngredientId?: string | null;
};

export type ConsumptionSelection = {
  productId: string;
  quantity: number;
  optionIds?: string[];
  optionSnapshots?: SnapshotOption[];
  halfAndHalf?: {
    secondProductId?: string | null;
  } | null;
};

export type ConsumptionLine = {
  ingredientId: string;
  ingredientName?: string;
  unit?: string;
  quantity: number;
  origins: string[];
};

export type ConsumptionDiagnostic = {
  code: 'NO_RECIPE' | 'OPTION_WITHOUT_STOCK_CONFIG' | 'UNKNOWN_OPTION';
  productId?: string;
  optionId?: string;
  message: string;
};

export type ConsumptionPlan = {
  lines: ConsumptionLine[];
  diagnostics: ConsumptionDiagnostic[];
};

type ProductWithRecipes = {
  id: string;
  name: string;
  recipes: Array<{
    ingredientId: string;
    quantity: unknown;
    ingredient?: {
      id: string;
      name: string;
      unit: string;
    } | null;
  }>;
};

type StockOption = {
  id: string;
  name: string;
  stockImpactType?: StockImpactType | string | null;
  ingredientId?: string | null;
  ingredientQuantity?: unknown;
  replacementIngredientId?: string | null;
  ingredient?: { id: string; name: string; unit: string; tenantId?: string } | null;
  replacementIngredient?: { id: string; name: string; unit: string; tenantId?: string } | null;
};

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveQuantity(value: unknown, fallback = 1) {
  const parsed = numeric(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function parseJsonObject(value: unknown): any {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function optionIdsFromSnapshot(snapshot: unknown) {
  const parsed = parseJsonObject(snapshot);
  const options = Array.isArray(parsed?.options) ? parsed.options : [];
  return unique(options.map((option: any) => option?.id));
}

function optionSnapshotsFromSnapshot(snapshot: unknown): SnapshotOption[] {
  const parsed = parseJsonObject(snapshot);
  const options = Array.isArray(parsed?.options) ? parsed.options : [];

  return options
    .map((option: any) => ({
      id: String(option?.id ?? ''),
      name: option?.name,
      stockImpactType: option?.stockImpactType,
      ingredientId: option?.ingredientId ?? null,
      ingredientQuantity: option?.ingredientQuantity,
      replacementIngredientId: option?.replacementIngredientId ?? null,
    }))
    .filter((option: SnapshotOption) => option.id);
}

export class InventoryConsumptionPlanner {
  static async buildForSelections(
    tenantId: string,
    selections: ConsumptionSelection[],
    db: PlannerDb | any = basePrisma,
  ): Promise<ConsumptionPlan> {
    return InventoryConsumptionPlanner.buildPlan(tenantId, selections, db);
  }

  static async buildForOrder(
    tenantId: string,
    orderId: string,
    db: PlannerDb | any = basePrisma,
  ): Promise<ConsumptionPlan> {
    const order = await db.order.findFirst({
      where: { id: orderId, tenantId },
      include: { items: true },
    });

    if (!order) {
      throw Object.assign(new Error('Pedido nao encontrado para baixa de estoque.'), {
        statusCode: 404,
      });
    }

    const selections: ConsumptionSelection[] = order.items.map((item: any) => {
      const snapshot = parseJsonObject(item.optionsSnapshot);
      const halfAndHalf = parseJsonObject(item.halfAndHalfData) ?? snapshot?.halfAndHalf ?? null;

      return {
        productId: item.productId,
        quantity: positiveQuantity(item.quantity),
        optionIds: optionIdsFromSnapshot(item.optionsSnapshot),
        optionSnapshots: optionSnapshotsFromSnapshot(item.optionsSnapshot),
        halfAndHalf: halfAndHalf
          ? {
              secondProductId: halfAndHalf.secondProductId ?? null,
            }
          : null,
      };
    });

    return InventoryConsumptionPlanner.buildPlan(tenantId, selections, db);
  }

  private static async buildPlan(
    tenantId: string,
    selections: ConsumptionSelection[],
    db: PlannerDb | any,
  ): Promise<ConsumptionPlan> {
    const productIds = unique(
      selections.flatMap((item) => [item.productId, item.halfAndHalf?.secondProductId]),
    );
    const optionIds = unique(
      selections.flatMap((item) => [
        ...(item.optionIds ?? []),
        ...(item.optionSnapshots ?? []).map((option) => option.id),
      ]),
    );

    const [products, globalOptions, itemOptions] = await Promise.all([
      productIds.length
        ? db.product.findMany({
            where: { tenantId, id: { in: productIds } },
            include: {
              recipes: {
                include: { ingredient: true },
              },
            },
          })
        : Promise.resolve([]),
      optionIds.length
        ? db.productOption.findMany({
            where: { tenantId, id: { in: optionIds } },
            include: { ingredient: true, replacementIngredient: true },
          })
        : Promise.resolve([]),
      optionIds.length
        ? db.productOptionItem.findMany({
            where: { group: { tenantId }, id: { in: optionIds } },
            include: { ingredient: true, replacementIngredient: true },
          })
        : Promise.resolve([]),
    ]);

    const productsById = new Map<string, ProductWithRecipes>(
      products.map((product: ProductWithRecipes) => [product.id, product]),
    );
    const optionsById = new Map<string, StockOption>(
      [...globalOptions, ...itemOptions].map((option: StockOption) => [option.id, option]),
    );
    const snapshotOptionsById = new Map<string, SnapshotOption>();
    for (const selection of selections) {
      for (const snapshotOption of selection.optionSnapshots ?? []) {
        snapshotOptionsById.set(snapshotOption.id, snapshotOption);
      }
    }
    const diagnostics: ConsumptionDiagnostic[] = [];
    const aggregate = new Map<
      string,
      { quantity: number; ingredientName?: string; unit?: string; origins: Set<string> }
    >();

    const addDelta = (
      ingredientId: string | null | undefined,
      quantity: number,
      origin: string,
      ingredient?: { name?: string; unit?: string } | null,
    ) => {
      if (!ingredientId || !Number.isFinite(quantity) || quantity === 0) return;
      const current = aggregate.get(ingredientId) ?? {
        quantity: 0,
        ingredientName: ingredient?.name,
        unit: ingredient?.unit,
        origins: new Set<string>(),
      };
      current.quantity += quantity;
      if (ingredient?.name) current.ingredientName = ingredient.name;
      if (ingredient?.unit) current.unit = ingredient.unit;
      current.origins.add(origin);
      aggregate.set(ingredientId, current);
    };

    const applyProductRecipe = (productId: string, multiplier: number, origin: string) => {
      const product = productsById.get(productId);
      if (!product || product.recipes.length === 0) {
        diagnostics.push({
          code: 'NO_RECIPE',
          productId,
          message: `Produto ${product?.name ?? productId} sem ficha tecnica cadastrada.`,
        });
        return;
      }

      for (const recipe of product.recipes) {
        addDelta(
          recipe.ingredientId,
          numeric(recipe.quantity) * multiplier,
          origin,
          recipe.ingredient,
        );
      }
    };

    const applyOptionImpact = (optionId: string, multiplier: number) => {
      const snapshotOption = snapshotOptionsById.get(optionId);
      const dbOption = optionsById.get(optionId);
      const option =
        snapshotOption?.stockImpactType !== undefined && snapshotOption.stockImpactType !== null
          ? ({
              ...dbOption,
              ...snapshotOption,
              name: snapshotOption.name ?? dbOption?.name ?? optionId,
              ingredient:
                snapshotOption.ingredientId &&
                snapshotOption.ingredientId === dbOption?.ingredientId
                  ? dbOption?.ingredient
                  : null,
              replacementIngredient:
                snapshotOption.replacementIngredientId &&
                snapshotOption.replacementIngredientId === dbOption?.replacementIngredientId
                  ? dbOption?.replacementIngredient
                  : null,
            } as StockOption)
          : dbOption;

      if (!option) {
        diagnostics.push({
          code: 'UNKNOWN_OPTION',
          optionId,
          message: `Opcional ${optionId} nao encontrado para calculo de estoque.`,
        });
        return;
      }

      const impact = (option.stockImpactType ?? 'NO_STOCK_IMPACT') as StockImpactType;
      if (impact === 'NO_STOCK_IMPACT') return;

      const quantity = numeric(option.ingredientQuantity);
      if (!option.ingredientId || quantity <= 0) {
        diagnostics.push({
          code: 'OPTION_WITHOUT_STOCK_CONFIG',
          optionId,
          message: `Opcional ${option.name} tem impacto de estoque incompleto.`,
        });
        return;
      }

      if (impact === 'ADD_INGREDIENT') {
        addDelta(
          option.ingredientId,
          quantity * multiplier,
          `Opcional: ${option.name}`,
          option.ingredient,
        );
        return;
      }

      if (impact === 'REMOVE_INGREDIENT') {
        addDelta(
          option.ingredientId,
          -quantity * multiplier,
          `Remocao: ${option.name}`,
          option.ingredient,
        );
        return;
      }

      if (impact === 'REPLACE_INGREDIENT') {
        addDelta(
          option.ingredientId,
          -quantity * multiplier,
          `Substituicao remove: ${option.name}`,
          option.ingredient,
        );
        addDelta(
          option.replacementIngredientId,
          quantity * multiplier,
          `Substituicao adiciona: ${option.name}`,
          option.replacementIngredient,
        );
      }
    };

    for (const selection of selections) {
      const quantity = positiveQuantity(selection.quantity);
      const secondProductId = selection.halfAndHalf?.secondProductId ?? null;

      if (secondProductId) {
        applyProductRecipe(selection.productId, quantity * 0.5, `Meia-meia 1/2`);
        applyProductRecipe(secondProductId, quantity * 0.5, `Meia-meia 2/2`);
      } else {
        applyProductRecipe(selection.productId, quantity, `Produto`);
      }

      for (const optionId of selection.optionIds ?? []) {
        applyOptionImpact(optionId, quantity);
      }
    }

    return {
      lines: [...aggregate.entries()]
        .map(([ingredientId, line]) => ({
          ingredientId,
          ingredientName: line.ingredientName,
          unit: line.unit,
          quantity: Math.max(0, Number(line.quantity.toFixed(4))),
          origins: [...line.origins],
        }))
        .filter((line) => line.quantity > 0),
      diagnostics,
    };
  }
}
