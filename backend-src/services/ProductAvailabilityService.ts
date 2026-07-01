import { basePrisma } from '../lib/prisma.js';
import {
  InventoryConsumptionPlanner,
  type ConsumptionSelection,
  type ConsumptionPlan,
} from './InventoryConsumptionPlanner.js';

type AvailabilityDb = typeof basePrisma;

export type MissingIngredient = {
  ingredientId: string;
  ingredientName?: string;
  unit?: string;
  required: number;
  available: number;
  missing: number;
};

export type AvailabilityResult = {
  available: boolean;
  reasons: string[];
  missingIngredients: MissingIngredient[];
  diagnostics: ConsumptionPlan['diagnostics'];
};

function createAvailabilityError(result: AvailabilityResult) {
  const message =
    result.reasons[0] ??
    'Nao foi possivel vender este item porque ha indisponibilidade de estoque.';

  return Object.assign(new Error(message), {
    statusCode: 409,
    availability: result,
  });
}

export class ProductAvailabilityService {
  static async checkSelections(
    tenantId: string,
    selections: ConsumptionSelection[],
    db: AvailabilityDb | any = basePrisma,
  ): Promise<AvailabilityResult> {
    const productIds = [
      ...new Set(
        selections
          .flatMap((selection) => [selection.productId, selection.halfAndHalf?.secondProductId])
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [products, plan] = await Promise.all([
      productIds.length
        ? db.product.findMany({
            where: { tenantId, id: { in: productIds } },
            select: { id: true, name: true, isAvailable: true },
          })
        : Promise.resolve([]),
      InventoryConsumptionPlanner.buildForSelections(tenantId, selections, db),
    ]);

    const productsById = new Map<string, any>(
      products.map((product: any) => [product.id, product]),
    );
    const reasons: string[] = [];

    for (const productId of productIds) {
      const product = productsById.get(productId);
      if (!product) {
        reasons.push(`Produto ${productId} nao encontrado para esta loja.`);
        continue;
      }
      if (product.isAvailable === false) {
        reasons.push(`Produto "${product.name}" esta bloqueado manualmente para venda.`);
      }
    }

    const ingredientIds = plan.lines.map((line) => line.ingredientId);
    const ingredients = ingredientIds.length
      ? await db.ingredient.findMany({
          where: { tenantId, id: { in: ingredientIds } },
          select: { id: true, name: true, unit: true, stock: true },
        })
      : [];
    const ingredientsById = new Map<string, any>(
      ingredients.map((ingredient: any) => [ingredient.id, ingredient]),
    );
    const missingIngredients: MissingIngredient[] = [];

    for (const line of plan.lines) {
      const ingredient = ingredientsById.get(line.ingredientId);
      const available = Number(ingredient?.stock ?? 0);

      if (!ingredient || available < line.quantity) {
        const missing = Number((line.quantity - available).toFixed(4));
        missingIngredients.push({
          ingredientId: line.ingredientId,
          ingredientName: ingredient?.name ?? line.ingredientName,
          unit: ingredient?.unit ?? line.unit,
          required: line.quantity,
          available,
          missing,
        });
        reasons.push(
          `Estoque insuficiente de ${ingredient?.name ?? line.ingredientName ?? line.ingredientId}: precisa ${line.quantity}, disponivel ${available}.`,
        );
      }
    }

    return {
      available: reasons.length === 0,
      reasons,
      missingIngredients,
      diagnostics: plan.diagnostics,
    };
  }

  static async assertSelectionsAvailable(
    tenantId: string,
    selections: ConsumptionSelection[],
    db: AvailabilityDb | any = basePrisma,
  ) {
    const result = await ProductAvailabilityService.checkSelections(tenantId, selections, db);
    if (!result.available) {
      throw createAvailabilityError(result);
    }
    return result;
  }

  static async getProductAvailability(
    tenantId: string,
    productId: string,
    db: AvailabilityDb | any = basePrisma,
  ) {
    return ProductAvailabilityService.checkSelections(tenantId, [{ productId, quantity: 1 }], db);
  }

  static async getAvailabilityMap(
    tenantId: string,
    productIds: string[],
    db: AvailabilityDb | any = basePrisma,
  ) {
    const uniqueIds = [...new Set(productIds.filter(Boolean))];
    const entries = await Promise.all(
      uniqueIds.map(async (productId) => [
        productId,
        await ProductAvailabilityService.getProductAvailability(tenantId, productId, db),
      ]),
    );

    return new Map(entries as Array<[string, AvailabilityResult]>);
  }
}
