import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { getIdParam } from '../utils/request.js';
import { normalizeText, normalizeBarcode, parseMoney } from '../utils/normalize.js';

import { requireRole } from '../middlewares/requireRole.js';
import { InventoryService } from '../services/inventory.service.js';

const inventoryRouter = Router();

inventoryRouter.use(requireAdmin);
inventoryRouter.use(requireRole(['OWNER', 'ADMIN', 'MANAGER']));

const transactionTypes = ['IN', 'OUT', 'WASTE', 'ADJUSTMENT'] as const;
type InventoryTransactionType = (typeof transactionTypes)[number];

function parsePositiveNumber(value: unknown) {
  const parsed = parseMoney(value);
  const numberValue = parsed === null ? Number(value) : Number(parsed);

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function serializeIngredient(ingredient: {
  id: string;
  name: string;
  unit: string;
  cost: unknown;
  stock: unknown;
  minStock: unknown;
  createdAt: Date;
  updatedAt: Date;
  barcode?: string | null;
}) {
  const stock = Number(ingredient.stock);
  const minStock = Number(ingredient.minStock);
  const cost = Number(ingredient.cost);
  const targetStock = Math.max(minStock * 2, minStock + 1);
  const reorderQuantity = Math.max(0, targetStock - stock);
  const stockPercent = targetStock > 0 ? Math.min(100, (stock / targetStock) * 100) : 100;

  return {
    ...ingredient,
    barcode: (ingredient as any).barcode ?? null,
    cost,
    stock,
    minStock,
    stockValue: Number((stock * cost).toFixed(2)),
    reorderQuantity: Number(reorderQuantity.toFixed(2)),
    stockPercent: Number(stockPercent.toFixed(0)),
    status:
      stock <= 0 ? 'OUT' : stock < minStock ? 'CRITICAL' : stock <= minStock * 1.25 ? 'LOW' : 'OK',
  };
}

inventoryRouter.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const ingredients = await prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
    });

    const serialized = ingredients.map(serializeIngredient);
    const totalStockValue = serialized.reduce((sum, item) => sum + item.stockValue, 0);
    const criticalItems = serialized.filter(
      (item) => item.status === 'CRITICAL' || item.status === 'OUT',
    );
    const lowItems = serialized.filter((item) => item.status === 'LOW');
    const purchaseSuggestion = serialized.reduce(
      (sum, item) => sum + item.reorderQuantity * item.cost,
      0,
    );

    res.json({
      totalItems: serialized.length,
      totalStockValue: Number(totalStockValue.toFixed(2)),
      criticalCount: criticalItems.length,
      lowCount: lowItems.length,
      purchaseSuggestion: Number(purchaseSuggestion.toFixed(2)),
      ingredients: serialized,
    });
  }),
);

inventoryRouter.get(
  '/ingredients',
  asyncHandler(async (req, res) => {
    const search = normalizeText(req.query.search);
    const barcodeQuery = normalizeBarcode(req.query.barcode);
    let ingredients = await prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
    });

    if (barcodeQuery) {
      const byBarcode = ingredients.filter((item) => (item as any).barcode === barcodeQuery);
      res.json(byBarcode.map(serializeIngredient));
      return;
    }

    if (search) {
      const lower = search.toLowerCase();
      ingredients = ingredients.filter(
        (item) => item.name.toLowerCase().includes(lower) || (item as any).barcode?.toLowerCase() === lower
      );
    }

    res.json(ingredients.map(serializeIngredient));
  }),
);

inventoryRouter.post(
  '/ingredients',
  asyncHandler(async (req, res) => {
    const name = normalizeText(req.body.name);
    const barcode = normalizeBarcode(req.body.barcode);
    const unit = normalizeText(req.body.unit);
    const cost = parsePositiveNumber(req.body.cost) ?? 0;
    const stock = parsePositiveNumber(req.body.stock) ?? 0;
    const minStock = parsePositiveNumber(req.body.minStock) ?? 0;

    if (!name || !unit) {
      res.status(400).json({ message: 'Informe nome e unidade do insumo.' });
      return;
    }

    if (barcode) {
      const existing = await prisma.ingredient.findFirst({
        where: { tenantId: getTenantId(), barcode },
      });
      if (existing) {
        res.status(409).json({ message: 'Ja existe um insumo com este codigo de barras.' });
        return;
      }
    }

    const ingredient = await prisma.ingredient.create({
      data: {
        name,
        barcode,
        unit,
        cost: cost.toFixed(2),
        stock: stock.toFixed(2),
        minStock: minStock.toFixed(2),
      } as any,
    });

    res.status(201).json(serializeIngredient(ingredient));
  }),
);

inventoryRouter.patch(
  '/ingredients/:id',
  asyncHandler(async (req, res) => {
    const id = getIdParam(req, res);
    if (!id) return;

    const data: Record<string, unknown> = {};
    const name = normalizeText(req.body.name);
    const unit = normalizeText(req.body.unit);
    const cost = req.body.cost === undefined ? undefined : parsePositiveNumber(req.body.cost);
    const minStock =
      req.body.minStock === undefined ? undefined : parsePositiveNumber(req.body.minStock);

    if (req.body.name !== undefined) {
      if (!name) {
        res.status(400).json({ message: 'Informe um nome valido.' });
        return;
      }
      data.name = name;
    }

    if (req.body.barcode !== undefined) {
      const barcode = normalizeBarcode(req.body.barcode);
      if (barcode) {
        const existing = await prisma.ingredient.findFirst({
          where: { tenantId: getTenantId(), barcode, NOT: { id } },
        });
        if (existing) {
          res.status(409).json({ message: 'Ja existe outro insumo com este codigo de barras.' });
          return;
        }
      }
      data.barcode = barcode;
    }

    if (req.body.unit !== undefined) {
      if (!unit) {
        res.status(400).json({ message: 'Informe uma unidade valida.' });
        return;
      }
      data.unit = unit;
    }

    if (req.body.cost !== undefined) {
      if (cost === null || cost === undefined) {
        res.status(400).json({ message: 'Informe um custo valido.' });
        return;
      }
      data.cost = cost.toFixed(2);
    }

    if (req.body.minStock !== undefined) {
      if (minStock === null || minStock === undefined) {
        res.status(400).json({ message: 'Informe um estoque minimo valido.' });
        return;
      }
      data.minStock = minStock.toFixed(2);
    }

    const ingredient = await prisma.ingredient.update({
      where: { id },
      data,
    });

    res.json(serializeIngredient(ingredient));
  }),
);

inventoryRouter.get(
  '/transactions',
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));
    const transactions = await prisma.inventoryTransaction.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { ingredient: true },
    });

    res.json(
      transactions.map((transaction) => ({
        ...transaction,
        quantity: Number(transaction.quantity),
        cost: transaction.cost === null ? null : Number(transaction.cost),
        ingredient: transaction.ingredient
          ? serializeIngredient(transaction.ingredient)
          : transaction.ingredient,
      })),
    );
  }),
);

inventoryRouter.post(
  '/transactions',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const ingredientId = normalizeText(req.body.ingredientId);
    const type = normalizeText(req.body.type).toUpperCase() as InventoryTransactionType;
    const quantity = parsePositiveNumber(req.body.quantity);
    const cost = req.body.cost === undefined ? null : parsePositiveNumber(req.body.cost);
    const notes = normalizeText(req.body.notes) || null;

    if (!ingredientId) {
      res.status(400).json({ message: 'Informe o insumo.' });
      return;
    }

    if (!transactionTypes.includes(type)) {
      res.status(400).json({ message: 'Tipo de movimentacao invalido.' });
      return;
    }

    if (quantity === null) {
      res.status(400).json({ message: 'Informe uma quantidade maior que zero.' });
      return;
    }

    const result = await InventoryService.moveStock({
      tenantId,
      ingredientId,
      type,
      quantity,
      cost,
      notes,
      referenceType: 'MANUAL',
      referenceId: ingredientId,
      idempotencyKey: normalizeText(req.body.idempotencyKey) || null,
    });

    res.status(201).json({
      transaction: {
        ...result.transaction,
        quantity: Number(result.transaction.quantity),
        cost: result.transaction.cost === null ? null : Number(result.transaction.cost),
      },
      ingredient: serializeIngredient(result.ingredient),
    });
  }),
);

export { inventoryRouter };
